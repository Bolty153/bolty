import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

// Canales de la bandeja unificada. Hoy sólo entra 'web'; el resto queda
// preparado para cuando conectemos WhatsApp / Instagram / Mail (parte futura).
export type Channel = 'web' | 'whatsapp' | 'instagram' | 'mail'

// Quién responde en la conversación:
//   'auto'   -> el agente IA responde solo
//   'manual' -> el humano tomó la conversación (el agente se frena)
export type ConvMode = 'auto' | 'manual'

export interface Conversation {
  id: string
  user_id: string
  channel: Channel
  customer_name: string | null
  customer_identifier: string | null
  status: 'open' | 'closed'
  mode: ConvMode
  last_message_at: string
  created_at: string
}

/**
 * Lista de conversaciones del negocio (el inbox). RLS: cada negocio ve sólo
 * las suyas. Se mantiene ordenada por actividad reciente y se actualiza sola
 * con Realtime (nuevas conversaciones, cambio de modo, último mensaje).
 */
export function useConversations() {
  const userId = useEffectiveUserId()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
    if (error) console.error('[Bolty] load conversations:', error.message)
    else setConversations((data ?? []) as Conversation[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  // Realtime: reordena la lista y refleja cambios sin recargar.
  useEffect(() => {
    if (!userId) return
    const ch = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` },
        (payload) => {
          setConversations((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== (payload.old as { id: string }).id)
            }
            const row = payload.new as Conversation
            const rest = prev.filter((c) => c.id !== row.id)
            return [row, ...rest].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [userId])

  // Crea una conversación de prueba "Cliente web" para testear al agente desde
  // la bandeja (persistente, a diferencia del viejo #chat-test).
  const createTestConversation = useCallback(async () => {
    if (!userId) return null
    const identifier = `web-test-${Date.now()}`
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        channel: 'web',
        customer_name: null,
        customer_identifier: identifier,
        status: 'open',
        mode: 'auto',
      })
      .select()
      .single()
    if (error) {
      console.error('[Bolty] create conversation:', error.message)
      return null
    }
    const row = data as Conversation
    setConversations((prev) => (prev.some((c) => c.id === row.id) ? prev : [row, ...prev]))
    return row
  }, [userId])

  // Freno híbrido: pasa la conversación a manual ('Tomar conversación') o
  // la devuelve al agente ('Devolver al agente'). Optimista + Realtime confirma.
  const setMode = useCallback(async (id: string, mode: ConvMode) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, mode } : c)))
    const { error } = await supabase.from('conversations').update({ mode }).eq('id', id)
    if (error) console.error('[Bolty] set mode:', error.message)
  }, [])

  // Borra la conversación entera (sus mensajes se van solos por FK on delete cascade).
  // RLS: solo el dueño puede borrar lo suyo. Optimista + reload si algo falla.
  const deleteConversation = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    const { error } = await supabase.from('conversations').delete().eq('id', id)
    if (error) {
      console.error('[Bolty] delete conversation:', error.message)
      load()
    }
  }, [load])

  return { conversations, loading, reload: load, createTestConversation, setMode, deleteConversation }
}
