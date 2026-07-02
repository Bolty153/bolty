import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Acceso al dashboard del cliente con permiso (modo soporte).
// Flujo: el admin PIDE (pending); el cliente ACEPTA (active) / RECHAZA (denied).
// Desde active: el cliente CORTA (revoked), expira a los 30 min (expired) o el
// admin SALE (ended). Cada acceso es una fila nueva: no hay permiso permanente.

export type AccessStatus = 'pending' | 'active' | 'denied' | 'revoked' | 'expired' | 'ended'

export interface AccessRequest {
  id: string
  client_profile_id: string
  admin_id: string
  status: AccessStatus
  reason: string | null
  duration_min: number
  created_at: string
  responded_at: string | null
  expires_at: string | null
  ended_at: string | null
}

/** Minutos que dura el acceso una vez aceptado. */
export const ACCESS_DURATION_MIN = 30

const TABLE = 'support_access_requests'

/** Está realmente activo AHORA (aceptado y sin vencer). */
export function isActiveNow(r: AccessRequest | null | undefined): boolean {
  if (!r || r.status !== 'active') return false
  return !r.expires_at || new Date(r.expires_at).getTime() > Date.now()
}

export function accessStatusLabel(s: AccessStatus): string {
  switch (s) {
    case 'pending': return 'Esperando respuesta'
    case 'active':  return 'Acceso activo'
    case 'denied':  return 'Rechazado'
    case 'revoked': return 'Cortado por vos'
    case 'expired': return 'Expirado'
    case 'ended':   return 'Finalizado'
    default:        return s
  }
}

/** Duración legible del acceso (desde que se aceptó hasta que terminó). */
export function accessDuration(r: AccessRequest): string {
  if (!r.responded_at) return '—'
  const start = new Date(r.responded_at).getTime()
  const endIso = r.ended_at || r.expires_at
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const mins = Math.max(0, Math.round((end - start) / 60000))
  if (mins < 1) return 'menos de 1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

// ─── Cliente: recibe y responde solicitudes de acceso ──────────────────────
export function useClientSupportAccess() {
  const { session } = useAuth()
  const uid = session?.user?.id
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!uid) return
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('client_profile_id', uid)
      .order('created_at', { ascending: false })
    if (error) console.error('[Bolty] load support_access (cliente):', error.message)
    else setRequests((data as AccessRequest[]) ?? [])
    setLoading(false)
  }, [uid])

  useEffect(() => { if (uid) load() }, [uid, load])

  // Realtime: cualquier cambio en MIS solicitudes recarga la lista.
  useEffect(() => {
    if (!uid) return
    const ch = supabase
      .channel(`sar_client_${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `client_profile_id=eq.${uid}` },
        () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid, load])

  const pending = useMemo(() => requests.find(r => r.status === 'pending') ?? null, [requests])
  const active  = useMemo(() => requests.find(r => isActiveNow(r)) ?? null, [requests])

  const accept = useCallback(async (id: string) => {
    // La duración la eligió el admin al pedir el acceso (default 30 min).
    const req = requests.find(r => r.id === id)
    const mins = req?.duration_min || ACCESS_DURATION_MIN
    const now = new Date()
    const expires = new Date(now.getTime() + mins * 60_000)
    const { error } = await supabase.from(TABLE)
      .update({ status: 'active', responded_at: now.toISOString(), expires_at: expires.toISOString() })
      .eq('id', id)
    if (error) console.error('[Bolty] accept access:', error.message)
    load()
  }, [requests, load])

  const deny = useCallback(async (id: string) => {
    const { error } = await supabase.from(TABLE)
      .update({ status: 'denied', responded_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('[Bolty] deny access:', error.message)
    load()
  }, [load])

  const revoke = useCallback(async (id: string) => {
    const { error } = await supabase.from(TABLE)
      .update({ status: 'revoked', ended_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('[Bolty] revoke access:', error.message)
    load()
  }, [load])

  // Marca 'expired' cuando se cumplen los 30 min mientras el cliente está online.
  const expire = useCallback(async (id: string) => {
    const { error } = await supabase.from(TABLE)
      .update({ status: 'expired', ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'active')
    if (error) console.error('[Bolty] expire access:', error.message)
    load()
  }, [load])

  // Timer: al vencer expires_at del acceso activo, lo pasa a 'expired'.
  useEffect(() => {
    if (!active?.expires_at) return
    const ms = new Date(active.expires_at).getTime() - Date.now()
    if (ms <= 0) { expire(active.id); return }
    const t = setTimeout(() => expire(active.id), ms)
    return () => clearTimeout(t)
  }, [active, expire])

  return { requests, pending, active, history: requests, loading, accept, deny, revoke, reload: load }
}

// ─── Admin: pide acceso y sigue el estado en vivo ──────────────────────────
export function useAdminSupportAccess() {
  const { session } = useAuth()
  const uid = session?.user?.id
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!uid) return
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('admin_id', uid)
      .order('created_at', { ascending: false })
    if (error) console.error('[Bolty] load support_access (admin):', error.message)
    else setRequests((data as AccessRequest[]) ?? [])
    setLoading(false)
  }, [uid])

  useEffect(() => { if (uid) load() }, [uid, load])

  useEffect(() => {
    if (!uid) return
    const ch = supabase
      .channel(`sar_admin_${uid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `admin_id=eq.${uid}` },
        () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [uid, load])

  // Última solicitud por cliente (la lista viene ordenada desc por fecha).
  const byClient = useMemo(() => {
    const map: Record<string, AccessRequest> = {}
    for (const r of requests) if (!map[r.client_profile_id]) map[r.client_profile_id] = r
    return map
  }, [requests])

  const requestAccess = useCallback(async (clientProfileId: string, reason?: string, durationMin: number = ACCESS_DURATION_MIN) => {
    if (!uid) return
    const { error } = await supabase.from(TABLE).insert({
      client_profile_id: clientProfileId,
      admin_id: uid,
      status: 'pending',
      reason: reason || null,
      duration_min: durationMin,
    })
    if (error) console.error('[Bolty] requestAccess:', error.message)
    load()
  }, [uid, load])

  // El admin cancela la espera o sale del panel → cierra la solicitud.
  const endAccess = useCallback(async (id: string) => {
    const { error } = await supabase.from(TABLE)
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('[Bolty] endAccess:', error.message)
    load()
  }, [load])

  return { requests, byClient, loading, requestAccess, endAccess, reload: load }
}
