import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Client, Payment } from './types'
import { fmtMoney } from './utils'

export default function AdminMetricas() {
  const [clients, setClients]   = useState<Client[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*, plan:plans(id,name,price_ars)').order('created_at'),
      supabase.from('payments').select('*').order('paid_at'),
    ]).then(([{ data: cl }, { data: py }]) => {
      setClients(cl || [])
      setPayments(py || [])
      setLoading(false)
    })
  }, [])

  const now = new Date()
  const active   = clients.filter(c => c.status === 'active')
  const inactive = clients.filter(c => c.status === 'inactive')
  const trial    = clients.filter(c => c.status === 'trial')
  const newMonth = clients.filter(c => {
    const d = new Date(c.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // Clients per month (last 8 months)
  const clientBars = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1)
    const count = clients.filter(c => {
      const cd = new Date(c.created_at)
      return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()
    }).length
    return { label: d.toLocaleString('es-AR', { month: 'short' }), count }
  })
  const maxClientBar = Math.max(...clientBars.map(b => b.count), 1)

  // Revenue per month (last 8 months, from payments)
  const revBars = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1)
    const total = payments.filter(p => {
      const pd = new Date(p.paid_at)
      return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear()
    }).reduce((s, p) => s + p.amount, 0)
    return { label: d.toLocaleString('es-AR', { month: 'short' }), total }
  })
  const maxRevBar = Math.max(...revBars.map(b => b.total), 1)

  // Plan distribution
  const planCounts: Record<string, { name: string; count: number }> = {}
  clients.forEach(c => {
    const key = c.plan_id || '__none__'
    const name = c.plan?.name || 'Sin plan'
    if (!planCounts[key]) planCounts[key] = { name, count: 0 }
    planCounts[key].count++
  })
  const planList = Object.values(planCounts).sort((a, b) => b.count - a.count)
  const maxPlanCount = Math.max(...planList.map(p => p.count), 1)

  // Top clients by payments
  const payByClient: Record<string, number> = {}
  payments.forEach(p => { payByClient[p.client_id] = (payByClient[p.client_id] || 0) + p.amount })
  const topClients = Object.entries(payByClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => ({
      name: clients.find(c => c.id === id)?.business_name || clients.find(c => c.id === id)?.email || id,
      total,
    }))
  const maxTopPay = topClients.length > 0 ? topClients[0].total : 1

  if (loading) return <div className="adm-empty">Cargando…</div>

  return (
    <>
      <div className="adm-page-head">
        <div><h1>Métricas</h1><p>Estadísticas de la plataforma</p></div>
      </div>

      <div className="adm-kpis">
        {[
          { label: 'Clientes totales',  val: clients.length, color: 'var(--volt-wash)', ic: 'var(--volt)' },
          { label: 'Activos',           val: active.length,  color: 'var(--mint-wash)', ic: 'var(--mint)' },
          { label: 'En prueba',         val: trial.length,   color: 'var(--amber-wash)', ic: 'var(--amber)' },
          { label: 'Nuevos este mes',   val: newMonth,       color: 'var(--surf-2)', ic: 'var(--ink-soft)' },
        ].map(({ label, val, color, ic }) => (
          <div key={label} className="kpi">
            <div className="kpi-top">
              <div className="kpi-ic" style={{ background: color, color: ic }}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
            </div>
            <div className="kpi-val">{val}</div>
            <div className="kpi-lbl">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-h"><h3>Clientes nuevos por mes</h3></div>
          <div className="sub">Últimos 8 meses</div>
          <div className="bars">
            {clientBars.map((b, i) => {
              const pct = `${Math.max(5, Math.round((b.count / maxClientBar) * 100))}%`
              const isPeak = b.count > 0 && b.count === Math.max(...clientBars.map(x => x.count))
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
          <div className="card-h"><h3>Cobrado por mes</h3></div>
          <div className="sub">Pagos registrados</div>
          <div className="bars">
            {revBars.map((b, i) => {
              const pct = `${Math.max(5, Math.round((b.total / maxRevBar) * 100))}%`
              const isPeak = b.total > 0 && b.total === Math.max(...revBars.map(x => x.total))
              return (
                <div key={i} className="bw">
                  <div className={`bar${isPeak ? ' pk' : ''}`} style={{ height: pct, background: isPeak ? 'linear-gradient(180deg,var(--mint),#00a378)' : undefined, boxShadow: isPeak ? '0 4px 12px rgba(0,200,150,.3)' : undefined }}>
                    {b.total > 0 && <span className="bv" style={{ color: isPeak ? 'var(--mint)' : undefined }}>${(b.total/1000).toFixed(0)}k</span>}
                  </div>
                  <div className="bd">{b.label}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Distribución por plan</h3></div>
          <div className="sub">{clients.length} clientes en total</div>
          {planList.length === 0 ? <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Sin datos aún.</div> : (
            planList.map((p, i) => (
              <div key={i} className="rank">
                <div className="rank-n">{i + 1}</div>
                <div className="rank-nm">{p.name}</div>
                <div className="rank-bar"><i style={{ width: `${(p.count / maxPlanCount) * 100}%` }} /></div>
                <div className="rank-c">{p.count}</div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-h"><h3>Top clientes por pagos</h3></div>
          <div className="sub">Acumulado histórico</div>
          {topClients.length === 0 ? <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Sin pagos registrados aún.</div> : (
            topClients.map((c, i) => (
              <div key={i} className="rank">
                <div className="rank-n">{i + 1}</div>
                <div className="rank-nm" style={{ fontSize: 13 }}>{c.name}</div>
                <div className="rank-bar"><i style={{ width: `${(c.total / maxTopPay) * 100}%` }} /></div>
                <div className="rank-c" style={{ width: 'auto', minWidth: 60 }}>{fmtMoney(c.total)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="adm-sect" style={{ marginTop: 18 }}>
        <div className="adm-sect-h">Retención</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Tasa de retención', val: clients.length > 0 ? `${Math.round((active.length / clients.length) * 100)}%` : '—', desc: 'Activos / Total' },
            { label: 'Tasa de prueba',    val: clients.length > 0 ? `${Math.round((trial.length / clients.length) * 100)}%` : '—', desc: 'En prueba / Total' },
            { label: 'Tasa de baja',      val: clients.length > 0 ? `${Math.round((inactive.length / clients.length) * 100)}%` : '—', desc: 'Inactivos / Total' },
          ].map(({ label, val, desc }) => (
            <div key={label} style={{ flex: 1, minWidth: 140, background: 'var(--surf-2)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--volt)' }}>{val}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
