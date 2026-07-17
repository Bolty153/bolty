import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'
import type { ConvMode } from './useConversations'

// Rol de cada globo del chat:
//   customer -> lo escribió el cliente (o el dueño simulando ser cliente en la prueba)
//   agent    -> lo respondió el agente IA
//   human    -> lo respondió el humano (el dueño, cuando tomó la conversación)
export type MsgRole = 'customer' | 'agent' | 'human'

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  role: MsgRole
  content: string
  tokens_in: number | null
  tokens_out: number | null
  created_at: string
}

// Cuántos turnos de historial le mandamos al cerebro (para que tenga memoria
// sin que el payload crezca infinito).
const HISTORY_LIMIT = 40

/**
 * Mensajes de UNA conversación. Los trae, los mantiene en tiempo real y expone
 * las acciones para enviar como cliente (dispara al agente en modo auto) o como
 * humano (cuando el dueño tomó la conversación).
 */
export function useMessages(conversationId: string | null, mode: ConvMode) {
  const userId = useEffectiveUserId()

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [agentThinking, setAgentThinking] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      return
    }
    setLoading(true)
    const { data, error: e } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (e) console.error('[Bolty] load messages:', e.message)
    else setMessages((data ?? []) as Message[])
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    setError('')
    load()
  }, [load])

  // Realtime: los mensajes nuevos aparecen sin recargar (dedupe por id, porque
  // el que inserta este mismo cliente ya lo agregó al estado localmente).
  useEffect(() => {
    if (!conversationId) return
    const ch = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as Message
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const oldId = (payload.old as { id?: string })?.id
          if (oldId) setMessages((prev) => prev.filter((m) => m.id !== oldId))
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [conversationId])

  // Inserta un mensaje, lo agrega al estado (dedupe con Realtime) y "toca" la
  // conversación para que suba en la lista del inbox.
  const insertMessage = useCallback(
    async (role: MsgRole, content: string, tokensIn: number | null = null, tokensOut: number | null = null) => {
      if (!conversationId || !userId) return null
      const { data, error: e } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role,
          content,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
        })
        .select()
        .single()
      if (e) {
        console.error('[Bolty] insert message:', e.message)
        setError('No se pudo guardar el mensaje.')
        return null
      }
      const row = data as Message
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
      return row
    },
    [conversationId, userId],
  )

  // Llama al cerebro con TODO el historial y guarda la respuesta como 'agent',
  // con los tokens que reportó Claude (para el contador futuro).
  const runAgent = useCallback(
    async (history: Message[]) => {
      setAgentThinking(true)
      setError('')
      const payload = history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }))
      const { data, error: fnError } = await supabase.functions.invoke('chat', {
        body: { messages: payload },
      })

      if (fnError) {
        let msg = fnError.message
        try {
          const b = await fnError.context?.json()
          if (b?.error) msg = b.error
        } catch {
          /* nos quedamos con fnError.message */
        }
        setError(msg)
        setAgentThinking(false)
        return
      }
      if (data?.error) {
        setError(data.error)
        setAgentThinking(false)
        return
      }

      const reply: string = data?.reply ?? ''
      const usage = data?.usage ?? { input_tokens: 0, output_tokens: 0 }
      if (reply.trim()) {
        await insertMessage('agent', reply, usage.input_tokens ?? null, usage.output_tokens ?? null)
      }
      setAgentThinking(false)
    },
    [insertMessage],
  )

  // El dueño escribe simulando ser el CLIENTE. En modo auto dispara al agente.
  const sendAsCustomer = useCallback(
    async (content: string) => {
      const clean = content.trim()
      if (!clean || agentThinking) return
      const row = await insertMessage('customer', clean)
      if (row && mode === 'auto') {
        // Historial = lo que ya había + el mensaje recién insertado.
        const history = [...messages.filter((m) => m.id !== row.id), row]
        await runAgent(history)
      }
    },
    [insertMessage, mode, messages, runAgent, agentThinking],
  )

  // El humano tomó la conversación y responde en nombre del negocio.
  const sendAsHuman = useCallback(
    async (content: string) => {
      const clean = content.trim()
      if (!clean) return
      await insertMessage('human', clean)
    },
    [insertMessage],
  )

  // Borra un mensaje puntual. RLS: solo el dueño borra lo suyo. Optimista + reload si falla.
  const deleteMessage = useCallback(
    async (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
      const { error: e } = await supabase.from('messages').delete().eq('id', id)
      if (e) {
        console.error('[Bolty] delete message:', e.message)
        load()
      }
    },
    [load],
  )

  return { messages, loading, agentThinking, error, sendAsCustomer, sendAsHuman, deleteMessage, reload: load }
}
