import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

export type PayKind = 'servicio' | 'producto' | 'manual'
// Cómo te PAGÓ el cliente (ingreso). Ojo: es distinto del ORIGEN de un gasto.
export type PayMethod = 'efectivo' | 'transferencia' | 'tarjeta'
export type CardType = 'debito' | 'credito'

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
  account: string | null         // destino: cuenta (transferencia) o terminal (tarjeta)
  card_type?: string | null      // 'debito' | 'credito' (solo si method = tarjeta)
  adjustment: number
  items: PaymentItem[] | null
  pay_date: string   // 'YYYY-MM-DD'
  verified?: boolean            // false = pendiente de confirmar (no cuenta como ingreso)
  verified_at?: string | null   // cuándo se confirmó
  proof_url?: string | null     // comprobante (a futuro)
  appointment_id?: string | null // turno que originó el pago (si vino de la Agenda)
  created_at?: string
}

export interface PaymentInput {
  kind: PayKind
  customer_name?: string | null
  description?: string | null
  amount: number
  method: PayMethod
  account?: string | null
  card_type?: CardType | null
  adjustment?: number
  items?: PaymentItem[] | null
  pay_date: string
  verified?: boolean
  appointment_id?: string | null
}

// Un pago cuenta como ingreso real sólo si está verificado. Tratamos el valor
// ausente (columna todavía sin migrar) como verificado, igual que el default.
export const isVerified = (p: Payment) => p.verified !== false

/**
 * Movimientos de dinero del cliente (pagos de servicios + ventas de productos +
 * ventas manuales), todos en una sola tabla. RLS: cada cliente ve sólo lo suyo.
 */
export function useFinance() {
  const userId = useEffectiveUserId()

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
    // Solo mandamos card_type cuando hay valor: así los cobros efectivo/transferencia
    // siguen funcionando aunque todavía no se haya corrido el ALTER de la columna.
    const payload: Record<string, unknown> = { ...input, user_id: userId }
    if (!payload.card_type) delete payload.card_type
    // Mandamos verified/appointment_id sólo cuando aportan algo: así los cobros
    // comunes siguen andando aunque todavía no se haya corrido el ALTER (default TRUE).
    if (payload.verified !== false) delete payload.verified
    if (!payload.appointment_id) delete payload.appointment_id
    const { data, error } = await supabase
      .from('payments')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    setPayments(prev => [data as Payment, ...prev])
    return data as Payment
  }, [userId])

  const deletePayment = useCallback(async (id: string): Promise<void> => {
    // Si el pago venía de un turno, ese turno vuelve a quedar "no pagado".
    const target = payments.find(p => p.id === id)
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) throw error
    if (target?.appointment_id) {
      await supabase.from('appointments').update({ paid: false }).eq('id', target.appointment_id)
    }
    setPayments(prev => prev.filter(p => p.id !== id))
  }, [payments])

  // Confirmar un pendiente: la plata entró de verdad. Pasa a contar como ingreso
  // y, si tiene turno asociado, ese turno queda "Pagado".
  const confirmPayment = useCallback(async (id: string): Promise<void> => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('payments')
      .update({ verified: true, verified_at: now })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const p = data as Payment
    if (p.appointment_id) {
      await supabase.from('appointments').update({ paid: true }).eq('id', p.appointment_id)
    }
    setPayments(prev => prev.map(x => (x.id === id ? p : x)))
  }, [])

  // Rechazar un pendiente: la plata nunca entró. Lo borramos (lo más limpio) y
  // el turno asociado, si lo hay, vuelve a "no pagado".
  const rejectPayment = useCallback(async (id: string): Promise<void> => {
    await deletePayment(id)
  }, [deletePayment])

  return { payments, loading, error, reload: load, addPayment, deletePayment, confirmPayment, rejectPayment }
}

// + recargo / - descuento, en $ (acepta monto o porcentaje sobre la base)
export function computeAdjustment(base: number, type: 'descuento' | 'recargo', value: string, unit: '$' | '%'): number {
  const v = parseFloat((value || '').replace(',', '.')) || 0
  const delta = unit === '%' ? (base * v) / 100 : v
  return type === 'descuento' ? -delta : delta
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0)
