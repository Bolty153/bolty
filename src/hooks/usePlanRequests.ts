import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'
// Fuente única de verdad de los planes (ver src/lib/plans.ts).
import { planKeyFromName } from '../lib/plans'

// Re-export por compatibilidad con quienes lo importaban desde acá.
export { planKeyFromName }

export interface PlanRequest {
  id: string
  user_id: string
  business_name: string | null
  current_plan: string | null
  requested_plan: string
  status: string   // pendiente | hecho | rechazado
  created_at: string
}

/** Cliente: lee su plan actual real desde la tabla clients/plans. */
export function useCurrentPlan() {
  const uid = useEffectiveUserId()
  const [planKey, setPlanKey] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    supabase
      .from('clients')
      .select('plan:plans(name)')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error('[Bolty] current plan:', error.message); return }
        const name = (data as { plan?: { name?: string } | null } | null)?.plan?.name ?? null
        setPlanKey(planKeyFromName(name))
      })
  }, [uid])

  return planKey
}

/** Cliente: registra un pedido de cambio de plan. */
export function usePlanRequests() {
  const userId = useEffectiveUserId()

  const requestChange = useCallback(async (plan: string, businessName: string, currentPlan: string) => {
    if (!userId) throw new Error('No hay sesión activa')
    const { error } = await supabase.from('plan_requests').insert({
      user_id: userId,
      business_name: businessName || null,
      current_plan: currentPlan || null,
      requested_plan: plan,
    })
    if (error) throw error
  }, [userId])

  return { requestChange }
}

/** Admin: lista todos los pedidos y permite marcarlos. */
export function useAdminPlanRequests() {
  const [requests, setRequests] = useState<PlanRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('plan_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('[Bolty] load plan_requests:', error.message)
    else setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = useCallback(async (id: string, status: string) => {
    const { data, error } = await supabase.from('plan_requests').update({ status }).eq('id', id).select().single()
    if (error) { console.error('[Bolty] update plan_request:', error.message); return }
    if (data) setRequests(prev => prev.map(r => r.id === id ? (data as PlanRequest) : r))
  }, [])

  return { requests, loading, reload: load, setStatus }
}
