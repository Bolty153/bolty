import { useMemo, useState, useEffect } from 'react'
import type { ViewFocus } from '../App'
import { useFinance, fmtMoney } from '../hooks/useFinance'
import type { Payment } from '../hooks/useFinance'
import { useProducts } from '../hooks/useProducts'
import { useServices } from '../hooks/useServices'
import { useBankAccounts } from '../hooks/useBankAccounts'
import PaymentForm from '../components/finance/PaymentForm'
import SaleForm from '../components/finance/SaleForm'

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const shortMoney = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`

export default function Finanzas({ focus }: { focus?: ViewFocus }) {
  const { payments, loading, addPayment, deletePayment } = useFinance()
  const { products, bulkUpdateStock } = useProducts()
  const { services } = useServices()
  const { accounts, addAccount } = useBankAccounts()

  const [payOpen, setPayOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [finSearch, setFinSearch] = useState('')

  // Prefiltro de movimientos cuando venimos del buscador global.
  useEffect(() => { if (focus?.term != null) setFinSearch(focus.term) }, [focus?.ts])

  // Movimientos visibles (filtrados por el buscador de esta sección).
  const shownPayments = useMemo(() => {
    const q = finSearch.trim().toLowerCase()
    const list = !q ? payments : payments.filter(p =>
      (p.customer_name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.account || '').toLowerCase().includes(q))
    return list.slice(0, 20)
  }, [payments, finSearch])

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const todayKey = toKey(today)

  const stats = useMemo(() => {
    const monthPrefix = todayKey.slice(0, 7) // 'YYYY-MM'
    const weekStartKey = toKey(addDays(today, -6))
    let day = 0, week = 0, month = 0, efectivo = 0, transferencia = 0
    payments.forEach(p => {
      if (p.pay_date === todayKey) day += p.amount
      if (p.pay_date >= weekStartKey) week += p.amount
      if (p.pay_date.startsWith(monthPrefix)) {
        month += p.amount
        if (p.method === 'efectivo') efectivo += p.amount
        else transferencia += p.amount
      }
    })
    return { day, week, month, efectivo, transferencia }
  }, [payments, todayKey, today])

  // Últimos 7 días para el gráfico de barras
  const last7 = useMemo(() => {
    const map: Record<string, number> = {}
    payments.forEach(p => { map[p.pay_date] = (map[p.pay_date] ?? 0) + p.amount })
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6 - i))
      const key = toKey(d)
      return {
        key,
        label: cap(new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(d)).slice(0, 3),
        total: map[key] ?? 0,
        isToday: key === todayKey,
      }
    })
  }, [payments, today, todayKey])

  const maxBar = Math.max(1, ...last7.map(d => d.total))
  const methodTotal = stats.efectivo + stats.transferencia
  const efPct = methodTotal > 0 ? Math.round((stats.efectivo / methodTotal) * 100) : 0

  // Cuánto entró a cada cuenta (transferencias de este mes)
  const byAccount = useMemo(() => {
    const monthPrefix = todayKey.slice(0, 7)
    const map: Record<string, number> = {}
    payments.forEach(p => {
      if (p.method === 'transferencia' && p.pay_date.startsWith(monthPrefix)) {
        const key = p.account?.trim() || 'Sin especificar'
        map[key] = (map[key] ?? 0) + p.amount
      }
    })
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [payments, todayKey])

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deletePayment(toDelete.id)
      setToDelete(null)
    } catch (e) {
      alert('No se pudo borrar: ' + (e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  // Busca el número de cuenta (o alias/CBU) guardado, por el nombre de la cuenta
  const accNumberOf = (name?: string | null) => {
    if (!name) return ''
    const a = accounts.find(x => x.name.trim().toLowerCase() === name.trim().toLowerCase())
    return a?.number || a?.alias_cbu || ''
  }

  // Torta de ingresos por cuenta
  const ACC_COLORS = ['#6029ff', '#00c896', '#ff9500', '#ff3d71', '#0aa2ff', '#a855f7', '#14b8a6', '#ec4899']
  const accTotal = byAccount.reduce((s, a) => s + a.total, 0)
  let accCum = 0
  const accSegments = byAccount.map((a, i) => {
    const start = accTotal > 0 ? (accCum / accTotal) * 100 : 0
    accCum += a.total
    const end = accTotal > 0 ? (accCum / accTotal) * 100 : 0
    return { ...a, color: ACC_COLORS[i % ACC_COLORS.length], start, end }
  })
  const accGradient = accSegments.length
    ? `conic-gradient(${accSegments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`
    : 'var(--surf-2)'

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av" style={{ background: 'linear-gradient(135deg,var(--mint),#00a378)', boxShadow: '0 6px 18px rgba(0,200,150,.25)' }}>
            <svg fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" width="24" height="24">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          </div>
          <div>
            <h1>Finanzas</h1>
            <div className="sub">Todo lo que entra: pagos de servicios y ventas de productos</div>
          </div>
        </div>
        <div className="inv-head-actions">
          <button className="btn-outline" onClick={() => setPayOpen(true)}>+ Registrar pago</button>
          <button className="btn" onClick={() => setSaleOpen(true)}>+ Registrar venta</button>
        </div>
      </div>

      {/* KPIs por tiempo */}
      <div className="fin-kpis">
        <div className="kpi">
          <div className="kpi-lbl">Hoy</div>
          <div className="kpi-val">{fmtMoney(stats.day)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Esta semana</div>
          <div className="kpi-val">{fmtMoney(stats.week)}</div>
        </div>
        <div className="kpi feat">
          <div className="kpi-lbl">Este mes</div>
          <div className="kpi-val">{fmtMoney(stats.month)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        {/* Evolución últimos 7 días */}
        <div className="card">
          <div className="card-h"><h3>Ingresos de los últimos 7 días</h3></div>
          <div className="sub">Lo que entró cada día</div>
          {methodTotal === 0 && stats.week === 0 ? (
            <div className="empty-state" style={{ marginTop: 12, minHeight: 150 }}>
              <p>Cuando registres pagos o ventas, vas a ver acá la evolución.</p>
            </div>
          ) : (
            <div className="bars" style={{ marginTop: 18 }}>
              {last7.map(d => (
                <div key={d.key} className="bw">
                  <div className={`bar${d.isToday ? ' pk' : ''}`} style={{ height: `${Math.max(4, (d.total / maxBar) * 120)}px` }}>
                    {d.total > 0 && <span className="bv">{shortMoney(d.total)}</span>}
                  </div>
                  <span className="bd">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por forma de pago (este mes) */}
        <div className="card">
          <div className="card-h"><h3>Por forma de pago</h3></div>
          <div className="sub">Este mes</div>
          {methodTotal === 0 ? (
            <div className="empty-state" style={{ marginTop: 12, minHeight: 150 }}>
              <p>Todavía no hay ingresos este mes.</p>
            </div>
          ) : (
            <div className="fin-method">
              <div className="fin-donut" style={{ background: `conic-gradient(var(--mint) 0 ${efPct}%, var(--volt) ${efPct}% 100%)` }}>
                <div className="fin-donut-hole"><b>{fmtMoney(methodTotal)}</b><span>total</span></div>
              </div>
              <div className="fin-legend">
                <div className="fin-leg"><span className="dot" style={{ background: 'var(--mint)' }} /> Efectivo<b>{fmtMoney(stats.efectivo)}</b></div>
                <div className="fin-leg"><span className="dot" style={{ background: 'var(--volt)' }} /> Transferencia<b>{fmtMoney(stats.transferencia)}</b></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ingresos por cuenta (transferencias del mes) */}
      {byAccount.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-h"><h3>Ingresos por cuenta</h3></div>
          <div className="sub">A qué cuenta entró la plata (transferencias de este mes)</div>
          <div className="fin-method">
            <div className="fin-donut" style={{ background: accGradient }}>
              <div className="fin-donut-hole"><b>{fmtMoney(accTotal)}</b><span>total</span></div>
            </div>
            <div className="fin-legend">
              {accSegments.map(s => {
                const num = accNumberOf(s.name)
                return (
                  <div key={s.name} className="fin-leg">
                    <span className="dot" style={{ background: s.color }} />
                    <span className="fin-leg-name">{s.name}</span>
                    {num && <span className="fin-leg-num">{num}</span>}
                    <b>{fmtMoney(s.total)}</b>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Últimos movimientos */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3>Últimos movimientos</h3>
          {payments.length > 0 && (
            <input className="adm-search" style={{ maxWidth: 240, marginLeft: 'auto' }}
              placeholder="Buscar por cliente, detalle o cuenta…"
              value={finSearch} onChange={e => setFinSearch(e.target.value)} />
          )}
        </div>
        {loading ? (
          <div style={{ padding: '24px 0', color: 'var(--ink-faint)', fontSize: 14, textAlign: 'center' }}>Cargando…</div>
        ) : payments.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 10, padding: '40px 20px' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="40" height="40">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            <p>Todavía no registraste movimientos. Cargá un pago o una venta para empezar.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn" onClick={() => setSaleOpen(true)}>+ Registrar venta</button>
              <button className="btn-outline" onClick={() => setPayOpen(true)}>+ Registrar pago</button>
            </div>
          </div>
        ) : (
          <div className="fin-list">
            {shownPayments.length === 0 ? (
              <div style={{ padding: '24px 0', color: 'var(--ink-faint)', fontSize: 13.5, textAlign: 'center' }}>
                Sin movimientos que coincidan con “{finSearch}”.
              </div>
            ) : shownPayments.map(p => {
              const [y, m, d] = p.pay_date.split('-')
              const kindLabel = p.kind === 'servicio' ? 'Servicio' : p.kind === 'producto' ? 'Producto' : 'Venta'
              return (
                <div key={p.id} className="fin-item">
                  <div className={`fin-kind ${p.kind}`}>{kindLabel}</div>
                  <div className="fin-item-main">
                    <div className="fin-item-desc">
                      {p.description || kindLabel}
                      {p.customer_name ? <span className="fin-item-who"> · {p.customer_name}</span> : null}
                    </div>
                    <div className="fin-item-meta">
                      {d}/{m}/{y} · {p.method === 'efectivo'
                        ? '💵 Efectivo'
                        : `🏦 Transferencia${p.account ? ` (${p.account}${accNumberOf(p.account) ? ` · ${accNumberOf(p.account)}` : ''})` : ''}`}
                    </div>
                  </div>
                  <div className="fin-amount">{fmtMoney(p.amount)}</div>
                  <button className="fin-del" onClick={() => setToDelete(p)} title="Borrar movimiento">×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {payOpen && (
        <PaymentForm
          services={services.map(s => ({ name: s.name, price: s.price, on_request: s.price_on_request }))}
          accounts={accounts}
          onSaveAccount={addAccount}
          onClose={() => setPayOpen(false)}
          onSave={async input => { await addPayment(input); setPayOpen(false) }}
        />
      )}

      {saleOpen && (
        <SaleForm
          products={products.map(p => ({ id: p.id, name: p.name, price: p.price, stock: p.stock }))}
          accounts={accounts}
          onSaveAccount={addAccount}
          onClose={() => setSaleOpen(false)}
          onSave={async (input, discountStock) => {
            await addPayment(input)
            if (discountStock && input.items && input.items.length > 0) {
              const updates = input.items
                .filter(it => it.product_id)
                .map(it => {
                  const prod = products.find(pr => pr.id === it.product_id)
                  return { id: it.product_id as string, stock: Math.max(0, (prod?.stock ?? 0) - it.qty) }
                })
              if (updates.length > 0) await bulkUpdateStock(updates)
            }
            setSaleOpen(false)
          }}
        />
      )}

      {toDelete && (
        <div className="modal-ov" onClick={() => !deleting && setToDelete(null)}>
          <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="26" height="26">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </div>
            <h2>Borrar movimiento</h2>
            <p>
              ¿Seguro que querés borrar este movimiento de <b>{fmtMoney(toDelete.amount)}</b>
              {toDelete.description ? ` (${toDelete.description})` : ''}?
              <br />Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setToDelete(null)} disabled={deleting}>Volver</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
