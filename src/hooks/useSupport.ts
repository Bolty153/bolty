import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

export type TicketType = 'falla' | 'sugerencia' | 'medida'

export interface SupportTicket {
  id: string
  user_id: string
  business_name: string | null
  phone: string | null
  type: TicketType
  title: string | null
  description: string
  screenshot_url: string | null
  status: string   // pendiente | resuelto
  created_at: string
}

export interface TicketInput {
  type: TicketType
  title?: string | null
  description: string
  screenshot_url?: string | null
}

/** Cliente: envía reportes de falla, sugerencias y pedidos a medida. */
export function useSupport() {
  const userId = useEffectiveUserId()

  const submit = useCallback(async (input: TicketInput, businessName: string, phone: string) => {
    if (!userId) throw new Error('No hay sesión activa')
    const { error } = await supabase.from('support_tickets').insert({
      user_id: userId,
      business_name: businessName || null,
      phone: phone || null,
      type: input.type,
      title: input.title ?? null,
      description: input.description,
      screenshot_url: input.screenshot_url ?? null,
    })
    if (error) throw error
  }, [userId])

  const uploadScreenshot = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) return null
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('soporte').upload(path, file, { upsert: true })
    if (error) { console.error('[Bolty] uploadScreenshot:', error.message); throw error }
    const { data } = supabase.storage.from('soporte').getPublicUrl(path)
    return data.publicUrl
  }, [userId])

  return { submit, uploadScreenshot }
}

/** Admin: lista todos los tickets de soporte y permite marcar estado. */
export function useAdminTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('[Bolty] load support_tickets:', error.message)
    else setTickets(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = useCallback(async (id: string, status: string) => {
    const { data, error } = await supabase.from('support_tickets').update({ status }).eq('id', id).select().single()
    if (error) { console.error('[Bolty] update ticket:', error.message); return }
    if (data) setTickets(prev => prev.map(t => t.id === id ? (data as SupportTicket) : t))
  }, [])

  return { tickets, loading, reload: load, setStatus }
}
