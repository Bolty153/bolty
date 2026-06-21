import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export type PayKind = 'servicio' | 'producto' | 'manual'
export type PayMethod = 'efectivo' | 'transferencia'

export interface PaymentItem {
  product_id?: string
  name: string
  qty: number
  price: number
}

export interface Payment {
  id: string
  user_id?: string
  kind: PayKind
  customer_name: string | null
  description: string | null
  amount: number
  method: PayMethod
  account: string | null
  adjustment: number
  items: PaymentItem[] | null
  pay_date: string   // 'YYYY-MM-DD'
  created_at?: string
}

export interface PaymentInput {
  kind: PayKind
  customer_name?: string | null
  description?: string | null
  amount: number
  method: PayMethod
  account?: string | null
  adjustment?: number
  items?: PaymentItem[] | null
  pay_date: string
}

/**
 * Movimientos de dinero del cliente (pagos de servicios + ventas de productos +
 * ventas manuales), todos en una sola tabla. RLS: cada cliente ve sólo lo suyo.
 */
export function useFinance() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('pay_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Bolty] load payments:', error.message)
      setError(error.message)
    } else {
      setPayments(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addPayment = useCallback(async (input: PaymentInput): Promise<Payment> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('payments')
      .insert({ ...input, user_id: userId })
      .select()
      .single()
    if (error) throw error
    setPayments(prev => [data as Payment, ...prev])
    return data as Payment
  }, [userId])

  const deletePayment = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) throw error
    setPayments(prev => prev.filter(p => p.id !== id))
  }, [])

  return { payments, loading, error, reload: load, addPayment, deletePayment }
}

// + recargo / - descuento, en $ (acepta monto o porcentaje sobre la base)
export function computeAdjustment(base: number, type: 'descuento' | 'recargo', value: string, unit: '$' | '%'): number {
  const v = parseFloat((value || '').replace(',', '.')) || 0
  const delta = unit === '%' ? (base * v) / 100 : v
  return type === 'descuento' ? -delta : delta
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0)
