import { supabase } from '../../lib/supabase'

export async function logActivity(
  action: string,
  targetId?: string,
  targetType?: string,
  details?: Record<string, unknown>
) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await supabase.from('activity_log').insert({
    admin_id: session.user.id,
    action,
    target_id: targetId ?? null,
    target_type: targetType ?? null,
    details: details ?? null,
  })
}

export function statusLabel(status: string) {
  switch (status) {
    case 'active':    return 'Activo'
    case 'inactive':  return 'Inactivo'
    case 'trial':     return 'Prueba'
    case 'suspended': return 'Suspendido'
    default:          return status
  }
}

export function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtMoney(n: number) {
  return '$' + n.toLocaleString('es-AR')
}
