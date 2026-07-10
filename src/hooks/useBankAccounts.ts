import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

export interface BankAccount {
  id: string
  user_id?: string
  name: string
  bank: string | null
  number: string | null
  alias_cbu: string | null
  holder: string | null
  created_at?: string
}

export interface BankAccountInput {
  name: string
  bank?: string | null
  number?: string | null
  alias_cbu?: string | null
  holder?: string | null
}

/**
 * Cuentas bancarias guardadas del negocio (para registrar transferencias).
 * RLS: cada cliente ve sólo las suyas.
 */
export function useBankAccounts() {
  const userId = useEffectiveUserId()

  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
    if (error) console.error('[Bolty] load bank_accounts:', error.message)
    else setAccounts(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  // Guarda una cuenta nueva. Si ya existe una con el mismo nombre, no duplica.
  const addAccount = useCallback(async (input: BankAccountInput): Promise<void> => {
    if (!userId) return
    const clean = input.name.trim()
    if (!clean) return
    const existing = accounts.find(a => a.name.toLowerCase() === clean.toLowerCase())
    try {
      if (existing) {
        const { data } = await supabase.from('bank_accounts')
          .update({ bank: input.bank ?? null, number: input.number ?? null, alias_cbu: input.alias_cbu ?? null, holder: input.holder ?? null })
          .eq('id', existing.id).select().single()
        if (data) setAccounts(prev => prev.map(a => a.id === existing.id ? (data as BankAccount) : a))
      } else {
        const { data } = await supabase.from('bank_accounts')
          .insert({ user_id: userId, name: clean, bank: input.bank ?? null, number: input.number ?? null, alias_cbu: input.alias_cbu ?? null, holder: input.holder ?? null })
          .select().single()
        if (data) setAccounts(prev => [...prev, data as BankAccount].sort((a, b) => a.name.localeCompare(b.name)))
      }
    } catch (e) {
      console.error('[Bolty] addAccount:', (e as Error).message)
    }
  }, [userId, accounts])

  // Edita una cuenta existente. Si cambia el nombre, actualiza también los
  // movimientos (pagos y gastos) que la referencian por texto, para no
  // romper los cruces ni el histórico.
  const updateAccount = useCallback(async (id: string, input: BankAccountInput): Promise<void> => {
    if (!userId) return
    const clean = input.name.trim()
    if (!clean) return
    const prev = accounts.find(a => a.id === id)
    const { data, error } = await supabase.from('bank_accounts')
      .update({ name: clean, bank: input.bank ?? null, number: input.number ?? null, alias_cbu: input.alias_cbu ?? null, holder: input.holder ?? null })
      .eq('id', id).eq('user_id', userId)
      .select().single()
    if (error) throw error
    setAccounts(prevList => prevList.map(a => a.id === id ? (data as BankAccount) : a).sort((a, b) => a.name.localeCompare(b.name)))

    if (prev && prev.name.trim().toLowerCase() !== clean.toLowerCase()) {
      const [payRes, expRes] = await Promise.all([
        supabase.from('payments').update({ account: clean }).eq('user_id', userId).eq('account', prev.name),
        supabase.from('expenses').update({ account: clean }).eq('user_id', userId).eq('source', 'cuenta_bancaria').eq('account', prev.name),
      ])
      if (payRes.error) console.error('[Bolty] rename account in payments:', payRes.error.message)
      if (expRes.error) console.error('[Bolty] rename account in expenses:', expRes.error.message)
    }
  }, [userId, accounts])

  // Borra una cuenta guardada. No toca los movimientos ya registrados: sólo
  // deja de aparecer en la lista y como sugerencia.
  const deleteAccount = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id)
    if (error) throw error
    setAccounts(prev => prev.filter(a => a.id !== id))
  }, [])

  return { accounts, loading, reload: load, addAccount, updateAccount, deleteAccount }
}
