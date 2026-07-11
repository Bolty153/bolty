import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Client, Payment } from './types'
import { fmtDate, fmtMoney, logActivity } from './utils'

interface ClientWithPayments extends Client {
  lastPayment?: Payment
}

const EMPTY_PAY = { client_id: '', amount: '', method: 'transfer', note: '', period_start: '', period_end: '' }

export default function AdminDinero() {
  const [clients, setClients]   = useState<ClientWithPayments[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [plans, setPlans]       = useState<{id:string;price_ars:number}[]>([])
  const [loading, setLoading]   = useState(true)
  const [showPay, setShowPay]   = useState(false)
  const [payForm, setPayForm]   = useState({ ...EMPTY_PAY })
  const [saving, setSaving]     = useState(false)
  const [histClient, setHistClient] = useState<string | null>(null)

  async function load() {
    const [{ data: cl }, { data: py }, { data: pl }] = await Promise.all([
      supabase.from('clients').select('*, plan:plans(id,name,price_ars)').order('paid_until'),
      supabase.from('payments').select('*').order('paid_at', { ascending: false }),
      supabase.from('plans').select('id,price_ars'),
    ])
    const clientList = (cl || []) as Client[]
    const payList    = (py || []) as Payment[]
    const enriched: ClientWithPayments[] = clientList.map(c => ({
      ...c,
      lastPayment: payList.find(p => p.client_id === c.id),
    }))
    setClients(enriched)
    setPayments(payList)
    setPlans(pl || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const now = new Date()

  const overdue = clients.filter(c =>
    c.paid_until && new Date(c.paid_until) < now && c.status === 'active'
  )
  const expiringWeek = clients.filter(c => {
    if (!c.paid_until) return false
    const diff = (new Date(c.paid_until).getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  })
  const monthlyRevenue = clients
    .filter(c => c.status === 'active')
    .reduce((s, c) => s + (c.plan?.price_ars ?? 0), 0)

  const thisMonthPaid = payments
    .filter(p => { const d = new Date(p.paid_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    .reduce((s, p) => s + p.amount, 0)

  async function registerPayment() {
    if (!payForm.client_id || !payForm.amount) return
    setSaving(true)
    const amount = parseFloat(payForm.amount)
    await supabase.from('payments').insert({
      client_id: payForm.client_id,
      amount,
      method: payForm.method,
      note: payForm.note || null,
      period_start: payForm.period_start || null,
      period_end: payForm.period_end || null,
    })
    // Auto-extend paid_until by 1 month
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    await supabase.from('clients').update({
      paid_until: nextMonth.toISOString().slice(0, 10),
      status: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', payForm.client_id)
    await supabase.from('profiles').update({ is_active: true }).eq('id', payForm.client_id)
    await logActivity('register_payment', payForm.client_id, 'payment', { amount })
    setShowPay(false)
    setPayForm({ ...EMPTY_PAY })
    load()
    setSaving(false)
  }

  function openPayFor(clientId: string) {
    const c = clients.find(cl => cl.id === clientId)
    setPayForm({ ...EMPTY_PAY, client_id: clientId, amount: String(c?.plan?.price_ars ?? '') })
    setShowPay(true)
  }

  const histPayments = histClient ? payments.filter(p => p.client_id === histClient) : []
  const histClientName = histClient ? (clients.find(c => c.id === histClient)?.business_name || clients.find(c => c.id === histClient)?.email || '') : ''

  if (loading) return <div className="adm-empty">Cargando…</div>

  return (
    <>
      <div className="adm-page-head">
        <div><h1>Dinero</h1><p>Pagos y facturación</p></div>
        <button className="abtn primary" onClick={() => setShowPay(true)}>+ Registrar pago</button>
      </div>

      <div className="adm-kpis">
        <div className="kpi feat">
          <div className="kpi-top"><div className="kpi-ic">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div></div>
          <div className="kpi-val">{fmtMoney(monthlyRevenue)}</div>
          <div className="kpi-lbl">Facturación mensual estimada</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
          </div></div>
          <div className="kpi-val">{fmtMoney(thisMonthPaid)}</div>
          <div className="kpi-lbl">Cobrado este mes</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          </div></div>
          <div className="kpi-val">{overdue.length}</div>
          <div className="kpi-lbl">Con pago vencido</div>
        </div>
        <div className="kpi">
          <div className="kpi-top"><div className="kpi-ic" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div></div>
          <div className="kpi-val">{expiringWeek.length}</div>
          <div className="kpi-lbl">Vencen esta semana</div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="adm-sect" style={{ borderLeft: '3px solid var(--rose)', marginBottom: 18 }}>
          <div className="adm-sect-h" style={{ color: 'var(--rose)' }}>⚠ Pagos vencidos</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {overdue.map(c => (
              <div key={c.id} style={{ background: 'var(--rose-wash)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.business_name || c.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--rose)' }}>Vencido: {fmtDate(c.paid_until)}</div>
                </div>
                <button className="abtn primary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => openPayFor(c.id)}>Cobrar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="adm-sect" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--line)' }}>
          <div className="adm-sect-h" style={{ margin: 0 }}>Estado de pago de todos los clientes</div>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Plan</th>
                <th>Estado pago</th>
                <th>Vence</th>
                <th>Último pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => {
                const pastDue = c.paid_until && new Date(c.paid_until) < now && c.status === 'active'
                const expSoon = c.paid_until && !pastDue && (new Date(c.paid_until).getTime() - now.getTime()) / 86400000 <= 7
                return (
                  <tr key={c.id}>
                    <td data-label="Cliente">
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.business_name || '—'}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{c.email}</div>
                    </td>
                    <td data-label="Plan" style={{ fontSize: 13 }}>{c.plan?.name || '—'}</td>
                    <td data-label="Estado pago">
                      {pastDue ? <span className="sbadge suspended">Vencido</span>
                        : expSoon ? <span className="sbadge trial">Por vencer</span>
                        : c.paid_until ? <span className="sbadge active">Al día</span>
                        : <span className="sbadge inactive">Sin fecha</span>}
                    </td>
                    <td data-label="Vence" style={{ fontSize: 13, color: pastDue ? 'var(--rose)' : undefined, fontWeight: pastDue ? 700 : undefined }}>
                      {fmtDate(c.paid_until)}
                    </td>
                    <td data-label="Último pago" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {c.lastPayment ? `${fmtMoney(c.lastPayment.amount)} el ${fmtDate(c.lastPayment.paid_at)}` : '—'}
                    </td>
                    <td data-label="Acciones">
                      <div className="adm-actions">
                        <button className="abtn primary" style={{ fontSize: 12 }} onClick={() => openPayFor(c.id)}>Cobrar</button>
                        <button className="abtn" style={{ fontSize: 12 }} onClick={() => setHistClient(c.id)}>Historial</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showPay && (
        <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) setShowPay(false) }}>
          <div className="modal-box">
            <h2>Registrar pago</h2>
            <div className="field">
              <label>Cliente *</label>
              <select value={payForm.client_id} onChange={e => {
                const c = clients.find(cl => cl.id === e.target.value)
                setPayForm(f => ({ ...f, client_id: e.target.value, amount: String(c?.plan?.price_ars ?? f.amount) }))
              }} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}>
                <option value="">— Seleccioná un cliente —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.business_name || c.email}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Monto ($) *</label>
              <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="field">
              <label>Método</label>
              <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}>
                <option value="transfer">Transferencia</option>
                <option value="cash">Efectivo</option>
                <option value="mp">Mercado Pago</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>Período desde</label><input type="date" value={payForm.period_start} onChange={e => setPayForm(f => ({ ...f, period_start: e.target.value }))} /></div>
              <div className="field"><label>Período hasta</label><input type="date" value={payForm.period_end} onChange={e => setPayForm(f => ({ ...f, period_end: e.target.value }))} /></div>
            </div>
            <div className="field">
              <label>Nota</label>
              <input value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} placeholder="Opcional" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 16 }}>Al registrar, el estado se pondrá en "Activo" y se extiende la fecha de vencimiento 1 mes.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="abtn" onClick={() => setShowPay(false)}>Cancelar</button>
              <button className="abtn primary" onClick={registerPayment} disabled={saving || !payForm.client_id || !payForm.amount}>
                {saving ? 'Guardando…' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {histClient && (
        <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) setHistClient(null) }}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <h2>Historial de pagos — {histClientName}</h2>
            {histPayments.length === 0 ? (
              <div className="adm-empty">Sin pagos registrados.</div>
            ) : (
              <table className="adm-table" style={{ marginTop: 0 }}>
                <thead><tr><th>Fecha</th><th>Monto</th><th>Método</th><th>Período</th><th>Nota</th></tr></thead>
                <tbody>
                  {histPayments.map(p => (
                    <tr key={p.id}>
                      <td data-label="Fecha" style={{ fontSize: 13 }}>{fmtDate(p.paid_at)}</td>
                      <td data-label="Monto" style={{ fontWeight: 700 }}>{fmtMoney(p.amount)}</td>
                      <td data-label="Método" style={{ fontSize: 13 }}>{p.method}</td>
                      <td data-label="Período" style={{ fontSize: 12 }}>{p.period_start ? `${fmtDate(p.period_start)} – ${fmtDate(p.period_end)}` : '—'}</td>
                      <td data-label="Nota" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="abtn" onClick={() => setHistClient(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
