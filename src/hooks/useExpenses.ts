import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

// GASTOS (egresos). Tabla SEPARADA de payments: un gasto NO es facturación.
// `source` es de DÓNDE sale la plata (no cómo te pagaron a vos).
export type ExpenseSource = 'efectivo' | 'cuenta_bancaria' | 'tarjeta_empresa'

export const EXPENSE_CATEGORIES = [
  'Mercadería/Proveedores', 'Sueldos', 'Alquiler', 'Servicios',
  'Impuestos', 'Mantenimiento', 'Otros',
]

export const SOURCE_LABEL: Record<ExpenseSource, string> = {
  efectivo: 'Efectivo',
  cuenta_bancaria: 'Cuenta bancaria',
  tarjeta_empresa: 'Tarjeta de la empresa',
}

export interface Expense {
  id: string
  user_id?: string
  amount: number
  category: string
  source: ExpenseSource
  account: string | null        // qué cuenta/tarjeta, si source lo requiere
  employee_id: string | null    // gasto atribuido a un empleado (null = gasto general)
  description: string | null
  supplier: string | null
  expense_date: string          // 'YYYY-MM-DD'
  created_at?: string
}

export interface ExpenseInput {
  amount: number
  category: string
  source: ExpenseSource
  account?: string | null
  employee_id?: string | null
  description?: string | null
  supplier?: string | null
  expense_date: string
}

/** Gastos del negocio. RLS: cada cliente ve sólo los suyos. */
export function useExpenses() {
  const userId = useEffectiveUserId()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      // Si la tabla todavía no existe (falta correr el SQL), no rompemos Finanzas.
      console.error('[Bolty] load expenses:', error.message)
      setError(error.message)
      setExpenses([])
    } else {
      setExpenses(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addExpense = useCallback(async (input: ExpenseInput): Promise<Expense> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...input, user_id: userId })
      .select()
      .single()
    if (error) throw error
    setExpenses(prev => [data as Expense, ...prev])
    return data as Expense
  }, [userId])

  const updateExpense = useCallback(async (id: string, input: ExpenseInput): Promise<Expense> => {
    const { data, error } = await supabase
      .from('expenses')
      .update({ ...input })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setExpenses(prev => prev.map(e => e.id === id ? (data as Expense) : e))
    return data as Expense
  }, [])

  const deleteExpense = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
    setExpenses(prev => prev.filter(e => e.id !== id))
  }, [])

  return { expenses, loading, error, reload: load, addExpense, updateExpense, deleteExpense }
}
