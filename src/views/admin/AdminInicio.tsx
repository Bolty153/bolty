import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Client, Plan } from './types'
import { fmtDate, fmtMoney } from './utils'
import { useAdminPlanRequests, planKeyFromName } from '../../hooks/usePlanRequests'
import type { PlanRequest } from '../../hooks/usePlanRequests'
import { PLAN_NAMES } from '../../components/PlansModal'

interface Props {
  onNavigate: (view: string) => void
}

export default function AdminInicio({ onNavigate }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const { requests, setStatus, reload: reloadReqs } = useAdminPlanRequests()
  const [plans, setPlans] = useState<Plan[]>([])
  const pendingReqs = requests.filter(r => r.status === 'pendiente')

  useEffect(() => {
    supabase.from('plans').select('*').then(({ data }) => setPlans(data || []))
  }, [])

  // Aprobar: cambia el plan REAL del cliente (clients.plan_id) y marca el pedido hecho
  async function aprobar(r: PlanRequest) {
    const planRow = plans.find(p => planKeyFromName(p.name) === r.requested_plan)
    if (planRow) {
      const { error } = await supabase
        .from('clients')
        .update({ plan_id: planRow.id, updated_at: new Date().toISOString() })
        .eq('id', r.user_id)
      if (error) { alert('No se pudo cambiar el plan del cliente: ' + error.message); return }
    } else {
      if (!confirm(`No encontré un plan llamado "${PLAN_NAMES[r.requested_plan] || r.requested_plan}" en tu lista de planes. ¿Marcar el pedido como hecho igual (sin cambiar el plan)?`)) return
    }
    await setStatus(r.id, 'hecho')
    reloadReqs()
  }

  useEffect(() => {
    supabase
      .from('clients')
      .select('*, plan:plans(id,name,price_ars)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients(data || [])
        setLoading(false)
      })
  }, [])

  const now = new Date()

  const active   = clients.filter(c => c.status === 'active')
  const revenue  = active.reduce((s, c) => s + (c.plan?.price_ars ?? 0), 0)
  const newMonth = clients.filter(c => {
    const d = new Date(c.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const expiringWeek = clients.filter(c => {
    if (!c.paid_until) return false
    const diff = (new Date(c.paid_until).getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  })
  const overdue = clients.filter(c =>
    c.paid_until && new Date(c.paid_until) < now && c.status === 'active'
  )

  const monthBars = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const count = clients.filter(c => {
      const cd = new Date(c.created_at)
      return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()
    }).length
    return { label: d.toLocaleString('es-AR', { month: 'short' }), count }
  })
  const maxBar = Math.max(...monthBars.map(b => b.count), 1)

  if (loading) return <div className="adm-empty">Cargando…</div>

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Panel Admin</h1>
          <p>Resumen general de Bolty</p>
        </div>
      </div>

      <div className="adm-kpis">
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div className="kpi-spark">
              {['40%','55%','50%','70%','80%'].map((h,i) => <i key={i} style={{ height: h }} />)}
            </div>
          </div>
          <div className="kpi-val">{active.length}</div>
          <div className="kpi-lbl">Clientes activos</div>
          <div className="kpi-trend">{clients.length} en total</div>
        </div>

        <div className="kpi feat">
          <div className="kpi-top">
            <div className="kpi-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
          </div>
          <div className="kpi-val">{fmtMoney(revenue)}</div>
          <div className="kpi-lbl">Facturación mensual</div>
          {active.length > 0 && <div className="kpi-trend up">▲ {active.length} suscripciones</div>}
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            </div>
          </div>
          <div className="kpi-val">{expiringWeek.length}</div>
          <div className="kpi-lbl">Vencen esta semana</div>
          {expiringWeek.length > 0 && <div className="kpi-trend warn">⚠ Avisar</div>}
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--volt-wash)', color: 'var(--volt)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12l7-7 7 7"/>
              </svg>
            </div>
          </div>
          <div className="kpi-val">{newMonth}</div>
          <div className="kpi-lbl">Nuevos este mes</div>
        </div>
      </div>

      {pendingReqs.length > 0 && (
        <div className="adm-sect" style={{ marginBottom: 18, borderColor: 'var(--volt)' }}>
          <div className="adm-sect-h">
            🔔 Pedidos de cambio de plan ({pendingReqs.length})
          </div>
          {pendingReqs.map(r => (
            <div key={r.id} className="req-row">
              <div className="req-info">
                <b>{r.business_name || 'Cliente'}</b> quiere pasar
                {r.current_plan ? <> de <span className="req-plan">{PLAN_NAMES[r.current_plan] || r.current_plan}</span></> : null}
                {' '}al plan <span className="req-plan hl">{PLAN_NAMES[r.requested_plan] || r.requested_plan}</span>
                <span className="req-date"> · {fmtDate(r.created_at)}</span>
              </div>
              <div className="req-actions">
                <button className="abtn primary" onClick={() => aprobar(r)}>Aprobar y cambiar plan</button>
                <button className="abtn" onClick={() => setStatus(r.id, 'rechazado')}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Clientes nuevos por mes</h3></div>
          <div className="sub">Últimos 6 meses</div>
          <div className="bars">
            {monthBars.map((b, i) => {
              const pct = `${Math.max(6, Math.round((b.count / maxBar) * 100))}%`
              const isPeak = b.count > 0 && b.count === Math.max(...monthBars.map(x => x.count))
              return (
                <div key={i} className="bw">
                  <div className={`bar${isPeak ? ' pk' : ''}`} style={{ height: pct }}>
                    {b.count > 0 && <span className="bv">{b.count}</span>}
                  </div>
                  <div className="bd">{b.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Próximos vencimientos</h3>
            <span className="more" onClick={() => onNavigate('clientes')}>Ver clientes</span>
          </div>
          <div className="sub">Esta semana y vencidos</div>
          {overdue.length === 0 && expiringWeek.length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13, paddingTop: 8 }}>Sin vencimientos próximos.</div>
          ) : (
            <>
              {overdue.slice(0, 4).map(c => (
                <div key={c.id} className="rank">
                  <div className="rank-n" style={{ background: 'var(--rose-wash)', color: 'var(--rose)', fontSize: 11 }}>!</div>
                  <div className="rank-nm">{c.business_name || c.email}</div>
                  <span className="tag-out">Vencido</span>
                </div>
              ))}
              {expiringWeek.slice(0, 3).map(c => {
                const days = Math.ceil((new Date(c.paid_until!).getTime() - now.getTime()) / 86400000)
                return (
                  <div key={c.id} className="rank">
                    <div className="rank-n" style={{ background: 'var(--amber-wash)', color: 'var(--amber)', fontSize: 11 }}>!</div>
                    <div className="rank-nm">{c.business_name || c.email}</div>
                    <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>en {days}d</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="alert" style={{ marginTop: 18, cursor: 'default' }}>
          <div className="alert-ic" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <path d="M12 9v4M12 17h.01"/>
            </svg>
          </div>
          <div className="alert-b">
            <h4>{overdue.length} cliente{overdue.length > 1 ? 's' : ''} con pago vencido</h4>
            <p>{overdue.slice(0, 3).map(c => c.business_name || c.email).join(', ')}{overdue.length > 3 ? ` y ${overdue.length - 3} más` : ''}</p>
          </div>
        </div>
      )}

      <div className="adm-sect" style={{ marginTop: 18 }}>
        <div className="adm-sect-h">Distribución por estado</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { key: 'active',    label: 'Activos',    color: 'var(--mint)' },
            { key: 'trial',     label: 'Prueba',     color: 'var(--amber)' },
            { key: 'inactive',  label: 'Inactivos',  color: 'var(--ink-faint)' },
            { key: 'suspended', label: 'Suspendidos', color: 'var(--rose)' },
          ].map(({ key, label, color }) => {
            const n = clients.filter(c => c.status === key).length
            const pct = clients.length > 0 ? Math.round((n / clients.length) * 100) : 0
            return (
              <div key={key} style={{ flex: 1, minWidth: 100, background: 'var(--surf-2)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color }}>{n}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
