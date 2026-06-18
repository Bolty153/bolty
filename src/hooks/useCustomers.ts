import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface Customer {
  id: string
  user_id?: string
  name: string
  phone: string | null
  doc_id: string | null   // DNI / CUIT
  notes: string | null
  created_at?: string
}

/**
 * Memoria de clientes del negocio. Se va llenando sola desde los turnos
 * (y a futuro, desde una sección Clientes). RLS: cada negocio ve sólo los suyos.
 */
export function useCustomers() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
    if (error) console.error('[Bolty] load customers:', error.message)
    else setCustomers(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  // Guarda/actualiza un cliente a partir de un turno. Busca por nombre
  // (sin distinguir mayúsculas) para no duplicar; completa el teléfono si faltaba.
  const upsertFromAppointment = useCallback(async (name: string, phone: string | null) => {
    if (!userId) return
    const clean = name.trim()
    if (!clean) return
    const existing = customers.find(c => c.name.toLowerCase() === clean.toLowerCase())
    try {
      if (existing) {
        if (phone && phone !== existing.phone) {
          const { data } = await supabase.from('customers').update({ phone }).eq('id', existing.id).select().single()
          if (data) setCustomers(prev => prev.map(c => (c.id === existing.id ? (data as Customer) : c)))
        }
      } else {
        const { data } = await supabase.from('customers')
          .insert({ user_id: userId, name: clean, phone: phone || null })
          .select().single()
        if (data) setCustomers(prev => [...prev, data as Customer].sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch (e) {
      console.error('[Bolty] upsert customer:', (e as Error).message)
    }
  }, [userId, customers])

  return { customers, loading, reload: load, upsertFromAppointment }
}
