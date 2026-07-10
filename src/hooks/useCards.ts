import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

export type CardKind = 'credito' | 'debito'

export interface Card {
  id: string
  user_id?: string
  name: string
  bank: string | null
  type: CardKind
  last4: string | null         // últimos 4 dígitos (nunca el número completo)
  closing_day: number | null   // sólo crédito, 1-31
  due_day: number | null       // sólo crédito, 1-31
  created_at?: string
}

export interface CardInput {
  name: string
  bank?: string | null
  type: CardKind
  last4?: string | null
  closing_day?: number | null
  due_day?: number | null
}

/**
 * Tarjetas (débito/crédito) del negocio, para clasificar gastos.
 * RLS: cada cliente ve sólo las suyas.
 */
export function useCards() {
  const userId = useEffectiveUserId()

  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
    if (error) {
      // Si la tabla todavía no existe (falta correr el SQL), no rompemos Finanzas.
      console.error('[Bolty] load cards:', error.message)
      setError(error.message)
      setCards([])
    } else {
      setCards(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addCard = useCallback(async (input: CardInput): Promise<void> => {
    if (!userId) return
    const clean = input.name.trim()
    if (!clean) return
    const { data, error } = await supabase.from('cards')
      .insert({
        user_id: userId,
        name: clean,
        bank: input.bank?.trim() || null,
        type: input.type,
        last4: input.last4?.trim() || null,
        closing_day: input.type === 'credito' ? (input.closing_day ?? null) : null,
        due_day: input.type === 'credito' ? (input.due_day ?? null) : null,
      })
      .select().single()
    if (error) throw error
    setCards(prev => [...prev, data as Card].sort((a, b) => a.name.localeCompare(b.name)))
  }, [userId])

  // Edita una tarjeta existente. Si cambia el nombre, actualiza también los
  // gastos (source='tarjeta_empresa') que la referencian por texto.
  const updateCard = useCallback(async (id: string, input: CardInput): Promise<void> => {
    if (!userId) return
    const clean = input.name.trim()
    if (!clean) return
    const prev = cards.find(c => c.id === id)
    const { data, error } = await supabase.from('cards')
      .update({
        name: clean,
        bank: input.bank?.trim() || null,
        type: input.type,
        last4: input.last4?.trim() || null,
        closing_day: input.type === 'credito' ? (input.closing_day ?? null) : null,
        due_day: input.type === 'credito' ? (input.due_day ?? null) : null,
      })
      .eq('id', id).eq('user_id', userId)
      .select().single()
    if (error) throw error
    setCards(prevList => prevList.map(c => c.id === id ? (data as Card) : c).sort((a, b) => a.name.localeCompare(b.name)))

    if (prev && prev.name.trim().toLowerCase() !== clean.toLowerCase()) {
      const { error: expErr } = await supabase.from('expenses')
        .update({ account: clean })
        .eq('user_id', userId).eq('source', 'tarjeta_empresa').eq('account', prev.name)
      if (expErr) console.error('[Bolty] rename card in expenses:', expErr.message)
    }
  }, [userId, cards])

  // Borra una tarjeta guardada. No toca los gastos ya registrados: sólo deja
  // de aparecer en la lista y como sugerencia.
  const deleteCard = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) throw error
    setCards(prev => prev.filter(c => c.id !== id))
  }, [])

  return { cards, loading, error, reload: load, addCard, updateCard, deleteCard }
}
