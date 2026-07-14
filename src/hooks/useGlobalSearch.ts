import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'
import type { Product } from './useProducts'
import type { Service } from './useServices'
import type { Customer } from './useCustomers'
import type { Appointment } from './useAppointments'
import type { Payment } from './useFinance'
import type { Employee } from './useEmployees'
import type { Expense } from './useExpenses'
import type { BankAccount } from './useBankAccounts'
import type { Card } from './useCards'

// Buscador global del dashboard. Corre queries por entidad contra Supabase
// (ilike), DEBOUNCED, filtrando por el negocio del usuario (RLS ya aísla).
// No depende de que los hooks de cada sección estén montados.

export interface GlobalResults {
  productos: Product[]
  servicios: Service[]
  clientes: Customer[]
  turnos: Appointment[]
  pagos: Payment[]
  empleados: Employee[]
  gastos: Expense[]
  cuentas: BankAccount[]
  tarjetas: Card[]
}

const EMPTY: GlobalResults = {
  productos: [], servicios: [], clientes: [], turnos: [], pagos: [],
  empleados: [], gastos: [], cuentas: [], tarjetas: [],
}

/** Máximo de resultados por grupo en el dropdown. */
export const PER_GROUP = 5
/** Mínimo de caracteres para disparar la búsqueda. */
export const MIN_CHARS = 2
const DEBOUNCE_MS = 250

// Sacamos los comodines de ilike (%, _, \) para que no alteren la búsqueda.
// Los acentos SÍ se conservan: unaccent() los normaliza del lado de la base.
function sanitize(q: string) {
  return q.replace(/[%_\\]/g, ' ').trim()
}

export function totalCount(r: GlobalResults) {
  return r.productos.length + r.servicios.length + r.clientes.length + r.turnos.length + r.pagos.length
    + r.empleados.length + r.gastos.length + r.cuentas.length + r.tarjetas.length
}

export function useGlobalSearch(term: string) {
  const uid = useEffectiveUserId()
  const [results, setResults] = useState<GlobalResults>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = sanitize(term)
    if (!uid || q.length < MIN_CHARS) {
      setResults(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    let cancelled = false
    const handle = setTimeout(async () => {
      // Preferimos la RPC con unaccent() (insensible a acentos y mayúsculas).
      // target_uid respeta el modo soporte; RLS sigue aislando cada negocio.
      const { data, error } = await supabase.rpc('global_search', { target_uid: uid, q, per: PER_GROUP })
      if (cancelled) return

      if (!error && data) {
        const d = data as Partial<GlobalResults>
        setResults({
          productos: (d.productos as Product[]) ?? [],
          servicios: (d.servicios as Service[]) ?? [],
          clientes: (d.clientes as Customer[]) ?? [],
          turnos: (d.turnos as Appointment[]) ?? [],
          pagos: (d.pagos as Payment[]) ?? [],
          empleados: (d.empleados as Employee[]) ?? [],
          gastos: (d.gastos as Expense[]) ?? [],
          cuentas: (d.cuentas as BankAccount[]) ?? [],
          tarjetas: (d.tarjetas as Card[]) ?? [],
        })
        setLoading(false)
        return
      }

      // Fallback: si la función RPC todavía no está creada en la base (falta
      // correr el SQL de la sección 17), buscamos con queries por entidad.
      // Sensible a acentos, pero al menos el buscador sigue andando.
      if (error) console.warn('[Bolty] global_search RPC no disponible, uso fallback:', error.message)
      const fb = await fallbackSearch(uid, q)
      if (cancelled) return
      setResults(fb)
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => { cancelled = true; clearTimeout(handle) }
  }, [term, uid])

  return { results, loading }
}

// Búsqueda por entidad (fallback sin unaccent). El término ya viene saneado,
// pero para el sintaxis de .or() de PostgREST sacamos también comas/paréntesis.
async function fallbackSearch(uid: string, q: string): Promise<GlobalResults> {
  const like = `%${q.replace(/[,()]/g, ' ')}%`
  const [pr, sv, cu, ap, pa, em, ga, cta, tj] = await Promise.all([
    supabase.from('products').select('*').eq('user_id', uid)
      .or(`name.ilike.${like},barcode.ilike.${like},category.ilike.${like}`)
      .order('name', { ascending: true }).limit(PER_GROUP),
    supabase.from('services').select('*').eq('user_id', uid)
      .or(`name.ilike.${like},category.ilike.${like}`)
      .order('name', { ascending: true }).limit(PER_GROUP),
    supabase.from('customers').select('*').eq('user_id', uid)
      .or(`name.ilike.${like},phone.ilike.${like},doc_id.ilike.${like}`)
      .order('name', { ascending: true }).limit(PER_GROUP),
    supabase.from('appointments').select('*').eq('user_id', uid)
      .or(`customer_name.ilike.${like},service_name.ilike.${like},phone.ilike.${like}`)
      .order('appt_date', { ascending: false }).limit(PER_GROUP),
    supabase.from('payments').select('*').eq('user_id', uid)
      .or(`customer_name.ilike.${like},description.ilike.${like},account.ilike.${like}`)
      .order('pay_date', { ascending: false }).limit(PER_GROUP),
    supabase.from('employees').select('*').eq('user_id', uid)
      .or(`name.ilike.${like},role.ilike.${like}`)
      .order('name', { ascending: true }).limit(PER_GROUP),
    supabase.from('expenses').select('*').eq('user_id', uid)
      .or(`description.ilike.${like},category.ilike.${like},supplier.ilike.${like}`)
      .order('expense_date', { ascending: false }).limit(PER_GROUP),
    supabase.from('bank_accounts').select('*').eq('user_id', uid)
      .or(`name.ilike.${like},bank.ilike.${like},number.ilike.${like},alias_cbu.ilike.${like},holder.ilike.${like}`)
      .order('name', { ascending: true }).limit(PER_GROUP),
    supabase.from('cards').select('*').eq('user_id', uid)
      .or(`name.ilike.${like},bank.ilike.${like},last4.ilike.${like}`)
      .order('name', { ascending: true }).limit(PER_GROUP),
  ])
  return {
    productos: (pr.data as Product[]) ?? [],
    servicios: (sv.data as Service[]) ?? [],
    clientes: (cu.data as Customer[]) ?? [],
    turnos: (ap.data as Appointment[]) ?? [],
    pagos: (pa.data as Payment[]) ?? [],
    empleados: (em.data as Employee[]) ?? [],
    gastos: (ga.data as Expense[]) ?? [],
    cuentas: (cta.data as BankAccount[]) ?? [],
    tarjetas: (tj.data as Card[]) ?? [],
  }
}
