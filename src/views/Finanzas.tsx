import { useMemo, useState, useEffect, useCallback } from 'react'
import type { ViewFocus } from '../App'
import { useFinance, fmtMoney } from '../hooks/useFinance'
import type { Payment } from '../hooks/useFinance'
import { useExpenses, SOURCE_LABEL } from '../hooks/useExpenses'
import type { Expense } from '../hooks/useExpenses'
import { useProducts } from '../hooks/useProducts'
import { useServices } from '../hooks/useServices'
import { useBankAccounts } from '../hooks/useBankAccounts'
import { useCards } from '../hooks/useCards'
import PaymentForm from '../components/finance/PaymentForm'
import SaleForm from '../components/finance/SaleForm'
import ExpenseForm from '../components/finance/ExpenseForm'
import PaymentMethods from '../components/finance/PaymentMethods'

// Granularidad del selector de período.
type Gran = 'dia' | 'mes' | 'anio' | 'todo'

const kindLabel = (k: string) => k === 'servicio' ? 'Servicio' : k === 'producto' ? 'Producto' : 'Venta'
const SRC_ICON: Record<string, string> = { efectivo: '💵', cuenta_bancaria: '🏦', tarjeta_empresa: '💳' }

// Movimiento unificado para la lista (ingreso o gasto).
interface Movi { id: string; type: 'ingreso' | 'gasto'; date: string; title: string; meta: string; amount: number; badge: string; badgeClass: string }
type DelTarget = { type: 'ingreso' | 'gasto'; id: string; amount: number; title: string }

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromKey = (key: string) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const shortMoney = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const monthLongLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return cap(new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(y, m - 1, 1))) + ' ' + y
}
const dayLongLabel = (key: string) => { const [y, m, d] = key.split('-'); return `${d}/${m}/${y}` }

export default function Finanzas({ focus }: { focus?: ViewFocus }) {
  const { payments, loading, addPayment, deletePayment } = useFinance()
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenses()
  const { products, bulkUpdateStock } = useProducts()
  const { services } = useServices()
  const { accounts, addAccount, updateAccount, deleteAccount } = useBankAccounts()
  const { cards, addCard, updateCard, deleteCard } = useCards()

  const [payOpen, setPayOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [toDelete, setToDelete] = useState<DelTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [finSearch, setFinSearch] = useState('')

  // Prefiltro de movimientos cuando venimos del buscador global.
  useEffect(() => { if (focus?.term != null) setFinSearch(focus.term) }, [focus?.ts])

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const todayKey = toKey(today)

  // ── Selector de período: día / mes / año / todo (histórico) ──
  const [gran, setGran] = useState<Gran>('mes')
  const [dayKey, setDayKey]     = useState(todayKey)
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7))
  const [yearKey, setYearKey]   = useState(todayKey.slice(0, 4))

  // Años con datos (para el selector de año)
  const years = useMemo(() => {
    const set = new Set<string>([todayKey.slice(0, 4)])
    payments.forEach(p => set.add(p.pay_date.slice(0, 4)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [payments, todayKey])

  // ¿Una fecha cae dentro del período elegido?
  const inRange = useCallback((payDate: string) => {
    if (gran === 'dia')  return payDate === dayKey
    if (gran === 'mes')  return payDate.startsWith(monthKey)
    if (gran === 'anio') return payDate.startsWith(yearKey)
    return true // todo
  }, [gran, dayKey, monthKey, yearKey])

  const periodLabel = useMemo(() => {
    if (gran === 'dia')  return dayLongLabel(dayKey)
    if (gran === 'mes')  return monthLongLabel(monthKey)
    if (gran === 'anio') return yearKey
    return 'Todo el historial'
  }, [gran, dayKey, monthKey, yearKey])

  // INGRESOS y GASTOS del período (base de todos los cálculos). Los gastos
  // NUNCA se suman como ingreso/facturación: son totales aparte.
  const rangePayments = useMemo(() => payments.filter(p => inRange(p.pay_date)), [payments, inRange])
  const rangeExpenses = useMemo(() => expenses.filter(e => inRange(e.expense_date)), [expenses, inRange])

  // Totales de ingresos por forma de pago (efectivo / transferencia / tarjeta).
  const stats = useMemo(() => {
    let total = 0, efectivo = 0, transferencia = 0, tarjeta = 0
    rangePayments.forEach(p => {
      total += p.amount
      if (p.method === 'efectivo') efectivo += p.amount
      else if (p.method === 'tarjeta') tarjeta += p.amount
      else transferencia += p.amount
    })
    return { total, efectivo, transferencia, tarjeta, count: rangePayments.length }
  }, [rangePayments])

  const methodTotal = stats.efectivo + stats.transferencia + stats.tarjeta

  // Totales de gastos y por categoría (del período).
  const gastos = useMemo(() => {
    let total = 0
    const cat: Record<string, number> = {}
    rangeExpenses.forEach(e => { total += e.amount; cat[e.category || 'Otros'] = (cat[e.category || 'Otros'] ?? 0) + e.amount })
    const byCategory = Object.entries(cat).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
    return { total, byCategory, count: rangeExpenses.length }
  }, [rangeExpenses])

  const balance = stats.total - gastos.total

  // Serie de barras según la granularidad: días (7) para día, días del mes,
  // meses del año, o meses con datos para "todo".
  const series = useMemo(() => {
    const sum: Record<string, number> = {}
    if (gran === 'dia') {
      payments.forEach(p => { sum[p.pay_date] = (sum[p.pay_date] ?? 0) + p.amount })
      const base = fromKey(dayKey)
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(base, -(6 - i)); const k = toKey(d)
        return { label: cap(new Intl.DateTimeFormat('es-AR', { weekday: 'short' }).format(d)).slice(0, 3), total: sum[k] ?? 0, isNow: k === todayKey }
      })
    }
    if (gran === 'mes') {
      const [y, m] = monthKey.split('-').map(Number)
      const days = new Date(y, m, 0).getDate()
      payments.forEach(p => { if (p.pay_date.startsWith(monthKey)) { const dd = p.pay_date.slice(8, 10); sum[dd] = (sum[dd] ?? 0) + p.amount } })
      return Array.from({ length: days }, (_, i) => {
        const dd = pad(i + 1)
        return { label: String(i + 1), total: sum[dd] ?? 0, isNow: `${monthKey}-${dd}` === todayKey }
      })
    }
    if (gran === 'anio') {
      payments.forEach(p => { if (p.pay_date.startsWith(yearKey)) { const mm = p.pay_date.slice(5, 7); sum[mm] = (sum[mm] ?? 0) + p.amount } })
      return Array.from({ length: 12 }, (_, i) => {
        const mm = pad(i + 1)
        return { label: MONTHS_SHORT[i], total: sum[mm] ?? 0, isNow: `${yearKey}-${mm}` === todayKey.slice(0, 7) }
      })
    }
    // todo: por mes, sólo los meses con datos
    payments.forEach(p => { const ym = p.pay_date.slice(0, 7); sum[ym] = (sum[ym] ?? 0) + p.amount })
    return Object.keys(sum).sort().map(ym => {
      const [yy, mm] = ym.split('-')
      return { label: `${MONTHS_SHORT[Number(mm) - 1]} ${yy.slice(2)}`, total: sum[ym], isNow: ym === todayKey.slice(0, 7) }
    })
  }, [payments, gran, dayKey, monthKey, yearKey, todayKey])

  const maxBar = Math.max(1, ...series.map(d => d.total))
  const manyBars = series.length > 14
  const seriesTitle = gran === 'dia' ? 'Ingresos de los últimos 7 días'
    : gran === 'mes' ? 'Ingresos por día del mes'
    : gran === 'anio' ? 'Ingresos por mes del año'
    : 'Ingresos por mes'

  // Cuánto entró a cada cuenta (transferencias del período).
  const byAccount = useMemo(() => {
    const map: Record<string, number> = {}
    rangePayments.forEach(p => {
      if (p.method === 'transferencia') {
        const key = p.account?.trim() || 'Sin especificar'
        map[key] = (map[key] ?? 0) + p.amount
      }
    })
    return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  }, [rangePayments])

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      if (toDelete.type === 'gasto') await deleteExpense(toDelete.id)
      else await deletePayment(toDelete.id)
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

  // Cómo te pagó el cliente (para el detalle del movimiento).
  const methodMeta = (p: Payment) => {
    if (p.method === 'efectivo') return '💵 Efectivo'
    const acc = p.account ? ` (${p.account}${accNumberOf(p.account) ? ` · ${accNumberOf(p.account)}` : ''})` : ''
    if (p.method === 'tarjeta') return `💳 Tarjeta ${p.card_type === 'credito' ? 'crédito' : 'débito'}${acc}`
    return `🏦 Transferencia${acc}`
  }
  // Origen de los fondos del gasto (para el detalle del movimiento).
  const expenseMeta = (e: Expense) =>
    `${SRC_ICON[e.source] || ''} ${SOURCE_LABEL[e.source]}${e.account ? ` (${e.account})` : ''}${e.supplier ? ` · ${e.supplier}` : ''}`

  // Movimientos unificados: ingresos (+) y gastos (−), ordenados por fecha.
  const movimientos = useMemo<Movi[]>(() => {
    const ing: Movi[] = rangePayments.map(p => ({
      id: p.id, type: 'ingreso', date: p.pay_date,
      title: (p.description || kindLabel(p.kind)) + (p.customer_name ? ` · ${p.customer_name}` : ''),
      meta: methodMeta(p), amount: p.amount, badge: kindLabel(p.kind), badgeClass: p.kind,
    }))
    const gas: Movi[] = rangeExpenses.map(e => ({
      id: e.id, type: 'gasto', date: e.expense_date,
      title: e.description || e.category,
      meta: expenseMeta(e), amount: e.amount, badge: e.category, badgeClass: 'gasto',
    }))
    let all = [...ing, ...gas].sort((a, b) => b.date.localeCompare(a.date))
    const q = finSearch.trim().toLowerCase()
    if (q) all = all.filter(m => m.title.toLowerCase().includes(q) || m.meta.toLowerCase().includes(q) || m.badge.toLowerCase().includes(q))
    return all.slice(0, 30)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangePayments, rangeExpenses, finSearch])

  // Donut de forma de pago (3 partes) — siempre visible.
  const methodParts = [
    { name: 'Efectivo', total: stats.efectivo, color: 'var(--mint)' },
    { name: 'Transferencia', total: stats.transferencia, color: 'var(--volt)' },
    { name: 'Tarjeta', total: stats.tarjeta, color: 'var(--amber)' },
  ]
  let mCum = 0
  const methodSegs = methodParts.map(p => {
    const start = methodTotal > 0 ? (mCum / methodTotal) * 100 : 0
    mCum += p.total
    const end = methodTotal > 0 ? (mCum / methodTotal) * 100 : 0
    return { ...p, start, end }
  })
  const methodGradient = methodTotal > 0
    ? `conic-gradient(${methodSegs.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`
    : 'var(--surf-2)'

  // Torta de gastos por categoría
  const EXP_COLORS = ['#ff3d71', '#ff9500', '#6029ff', '#0aa2ff', '#a855f7', '#14b8a6', '#ec4899', '#00c896']
  const catTotal = gastos.byCategory.reduce((s, c) => s + c.total, 0)
  let catCum = 0
  const catSegments = gastos.byCategory.map((c, i) => {
    const start = catTotal > 0 ? (catCum / catTotal) * 100 : 0
    catCum += c.total
    const end = catTotal > 0 ? (catCum / catTotal) * 100 : 0
    return { ...c, color: EXP_COLORS[i % EXP_COLORS.length], start, end }
  })
  const catGradient = catSegments.length
    ? `conic-gradient(${catSegments.map(s => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`
    : 'var(--surf-2)'

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
            <div className="sub">Ingresos (pagos y ventas) y gastos del negocio</div>
          </div>
        </div>
        <div className="inv-head-actions">
          <button className="btn-outline" onClick={() => { setEditingExpense(null); setExpenseOpen(true) }}>− Registrar gasto</button>
          <button className="btn-outline" onClick={() => setPayOpen(true)}>+ Registrar pago</button>
          <button className="btn" onClick={() => setSaleOpen(true)}>+ Registrar venta</button>
        </div>
      </div>

      {/* Selector de período */}
      <div className="fin-period">
        <div className="fin-period-tabs">
          {([['dia', 'Día'], ['mes', 'Mes'], ['anio', 'Año'], ['todo', 'Todo']] as [Gran, string][]).map(([g, l]) => (
            <button key={g} className={`fin-period-tab${gran === g ? ' active' : ''}`} onClick={() => setGran(g)}>{l}</button>
          ))}
        </div>
        {gran === 'dia' && (
          <input type="date" className="fin-period-input" value={dayKey}
            onChange={e => { if (e.target.value) setDayKey(e.target.value) }} />
        )}
        {gran === 'mes' && (
          <input type="month" className="fin-period-input" value={monthKey}
            onChange={e => { if (e.target.value) setMonthKey(e.target.value) }} />
        )}
        {gran === 'anio' && (
          <select className="fin-period-input" value={yearKey} onChange={e => setYearKey(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <span className="fin-period-label">{periodLabel}</span>
      </div>

      {/* KPIs del período: Ingresos, Gastos y Balance */}
      <div className="fin-kpis" style={{ marginTop: 16 }}>
        <div className="kpi">
          <div className="kpi-lbl">Ingresos · {periodLabel}</div>
          <div className="kpi-val" style={{ color: 'var(--mint)' }}>{fmtMoney(stats.total)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Gastos · {periodLabel}</div>
          <div className="kpi-val" style={{ color: 'var(--rose)' }}>{gastos.total > 0 ? '−' : ''}{fmtMoney(gastos.total)}</div>
        </div>
        <div className="kpi feat">
          <div className="kpi-lbl">Balance (ingresos − gastos)</div>
          <div className="kpi-val">{fmtMoney(balance)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        {/* Evolución del período (barras) */}
        <div className="card">
          <div className="card-h"><h3>{seriesTitle}</h3></div>
          <div className="sub">{periodLabel}</div>
          {series.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 12, minHeight: 150 }}>
              <p>Registrá ingresos para ver acá su evolución.</p>
            </div>
          ) : (
            <div className="bars" style={{ marginTop: 18, gap: manyBars ? 4 : 10 }}>
              {series.map((d, i) => (
                <div key={i} className="bw">
                  <div className={`bar${d.isNow ? ' pk' : ''}`} style={{ height: `${Math.max(4, (d.total / maxBar) * 120)}px` }}>
                    {d.total > 0 && !manyBars && <span className="bv">{shortMoney(d.total)}</span>}
                  </div>
                  <span className="bd">{manyBars && i % 5 !== 0 ? '' : d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por forma de pago (del período) — siempre visible, en 0 si no hay datos */}
        <div className="card">
          <div className="card-h"><h3>Por forma de pago</h3></div>
          <div className="sub">Cómo te pagaron · {periodLabel}</div>
          <div className="fin-method">
            <div className="fin-donut" style={{ background: methodGradient }}>
              <div className="fin-donut-hole"><b>{fmtMoney(methodTotal)}</b><span>total</span></div>
            </div>
            <div className="fin-legend">
              <div className="fin-leg"><span className="dot" style={{ background: 'var(--mint)' }} /> Efectivo<b>{fmtMoney(stats.efectivo)}</b></div>
              <div className="fin-leg"><span className="dot" style={{ background: 'var(--volt)' }} /> Transferencia<b>{fmtMoney(stats.transferencia)}</b></div>
              <div className="fin-leg"><span className="dot" style={{ background: 'var(--amber)' }} /> Tarjeta<b>{fmtMoney(stats.tarjeta)}</b></div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingresos por cuenta (transferencias del período) — siempre visible */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h"><h3>Ingresos por cuenta</h3></div>
        <div className="sub">A qué cuenta ingresó el dinero (transferencias · {periodLabel})</div>
        {byAccount.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12, minHeight: 120 }}>
            <p>No hubo transferencias en este período.</p>
          </div>
        ) : (
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
        )}
      </div>

      {/* Gastos por categoría (del período) — siempre visible */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h"><h3>Gastos por categoría</h3></div>
        <div className="sub">Distribución de los gastos · {periodLabel}</div>
        {gastos.byCategory.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12, minHeight: 120 }}>
            <p>No registraste gastos en este período.</p>
          </div>
        ) : (
          <div className="fin-method">
            <div className="fin-donut" style={{ background: catGradient }}>
              <div className="fin-donut-hole"><b>{fmtMoney(catTotal)}</b><span>total</span></div>
            </div>
            <div className="fin-legend">
              {catSegments.map(s => (
                <div key={s.name} className="fin-leg">
                  <span className="dot" style={{ background: s.color }} />
                  <span className="fin-leg-name">{s.name}</span>
                  <b>{fmtMoney(s.total)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Medios de pago: cuentas bancarias y tarjetas */}
      <PaymentMethods
        accounts={accounts} addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount}
        cards={cards} addCard={addCard} updateCard={updateCard} deleteCard={deleteCard}
        rangeExpenses={rangeExpenses} periodLabel={periodLabel}
      />

      {/* Movimientos: ingresos (+) y gastos (−) unidos */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h" style={{ gap: 12, flexWrap: 'wrap' }}>
          <h3>Movimientos</h3>
          {(payments.length > 0 || expenses.length > 0) && (
            <input className="adm-search fin-search" style={{ maxWidth: 240, marginLeft: 'auto' }}
              placeholder="Buscar por detalle, categoría o cuenta…"
              value={finSearch} onChange={e => setFinSearch(e.target.value)} />
          )}
        </div>
        {loading ? (
          <div style={{ padding: '24px 0', color: 'var(--ink-faint)', fontSize: 14, textAlign: 'center' }}>Cargando…</div>
        ) : payments.length === 0 && expenses.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 10, padding: '40px 20px' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="40" height="40">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            <p>Todavía no registraste movimientos. Registrá un pago, una venta o un gasto para comenzar.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn" onClick={() => setSaleOpen(true)}>+ Registrar venta</button>
              <button className="btn-outline" onClick={() => setPayOpen(true)}>+ Registrar pago</button>
              <button className="btn-outline" onClick={() => { setEditingExpense(null); setExpenseOpen(true) }}>− Registrar gasto</button>
            </div>
          </div>
        ) : (
          <div className="fin-list">
            {movimientos.length === 0 ? (
              <div style={{ padding: '24px 0', color: 'var(--ink-faint)', fontSize: 13.5, textAlign: 'center' }}>
                {finSearch ? `Sin movimientos que coincidan con “${finSearch}”.` : `Sin movimientos en ${periodLabel.toLowerCase()}.`}
              </div>
            ) : movimientos.map(m => {
              const [y, mm, d] = m.date.split('-')
              const isGasto = m.type === 'gasto'
              return (
                <div key={`${m.type}-${m.id}`} className="fin-item">
                  <div className={`fin-kind ${m.badgeClass}`}>{m.badge}</div>
                  <div className="fin-item-main">
                    <div className="fin-item-desc">{m.title}</div>
                    <div className="fin-item-meta">{d}/{mm}/{y} · {m.meta}</div>
                  </div>
                  <div className="fin-amount" style={{ color: isGasto ? 'var(--rose)' : 'var(--mint)' }}>
                    {isGasto ? '−' : '+'}{fmtMoney(m.amount)}
                  </div>
                  {isGasto && (
                    <button className="fin-edit" onClick={() => { const ex = expenses.find(e => e.id === m.id); if (ex) { setEditingExpense(ex); setExpenseOpen(true) } }} title="Editar gasto">
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  <button className="fin-del" onClick={() => setToDelete({ type: m.type, id: m.id, amount: m.amount, title: m.title })} title="Borrar movimiento">×</button>
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

      {expenseOpen && (
        <ExpenseForm
          accounts={accounts}
          onSaveAccount={addAccount}
          cards={cards}
          expense={editingExpense}
          onClose={() => { setExpenseOpen(false); setEditingExpense(null) }}
          onSave={async input => {
            if (editingExpense) await updateExpense(editingExpense.id, input)
            else await addExpense(input)
            setExpenseOpen(false); setEditingExpense(null)
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
            <h2>Borrar {toDelete.type === 'gasto' ? 'gasto' : 'movimiento'}</h2>
            <p>
              ¿Seguro que querés borrar este {toDelete.type === 'gasto' ? 'gasto' : 'movimiento'} de <b>{fmtMoney(toDelete.amount)}</b>
              {toDelete.title ? ` (${toDelete.title})` : ''}?
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
