import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
  const { session } = useAuth()
  const userId = session?.user?.id

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

  return { accounts, loading, reload: load, addAccount }
}
