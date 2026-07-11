import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ViewId } from '../../App'
import type { Customer } from '../../hooks/useCustomers'
import { fmtMoney } from '../../hooks/useFinance'
import { useGlobalSearch, totalCount, MIN_CHARS } from '../../hooks/useGlobalSearch'

export interface NavFocus { term?: string; date?: string }

interface Props {
  onNavigate: (view: ViewId, focus?: NavFocus) => void
  onOpenCustomer: (c: Customer) => void
  autoFocus?: boolean
}

type GroupKey = 'productos' | 'servicios' | 'clientes' | 'turnos' | 'pagos'

const GROUP_META: Record<GroupKey, { label: string; view: ViewId | null; icon: ReactNode }> = {
  productos: { label: 'Productos', view: 'productos', icon: <IcBox /> },
  servicios: { label: 'Servicios', view: 'servicios', icon: <IcTag /> },
  clientes:  { label: 'Clientes',  view: null,        icon: <IcUser /> },
  turnos:    { label: 'Turnos',    view: 'agenda',    icon: <IcCal /> },
  pagos:     { label: 'Pagos y ventas', view: 'finanzas', icon: <IcMoney /> },
}

// Normaliza para comparar: minúsculas + sin acentos, preservando la longitud
// (cada carácter precompuesto vuelve a su base), así los índices siguen alineados
// con el texto original y podemos resaltar el fragmento acentuado tal cual.
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

// Resalta la parte que coincide con el término buscado (insensible a acentos).
function hl(text: string, term: string): ReactNode {
  const t = term.trim()
  if (!t) return text
  const fq = fold(t)
  const i = fold(text).indexOf(fq)
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark className="gs-mark">{text.slice(i, i + fq.length)}</mark>{text.slice(i + fq.length)}</>
}

// Una fila plana de la lista (para poder navegar con el teclado por todo el dropdown).
interface Flat { group: GroupKey; kind: 'item' | 'all'; action: () => void; content: ReactNode }

export default function GlobalSearch({ onNavigate, onOpenCustomer, autoFocus }: Props) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { results, loading } = useGlobalSearch(term)

  const wrapRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  const q = term.trim()
  const showPanel = open && q.length >= MIN_CHARS
  const total = totalCount(results)

  // Construye la lista plana en orden de grupos (con "Ver todos" al final de cada grupo).
  const flat = useMemo<Flat[]>(() => {
    const out: Flat[] = []
    const push = (f: Flat) => out.push(f)

    const close = () => { setOpen(false) }

    if (results.productos.length) {
      results.productos.forEach(p => push({
        group: 'productos', kind: 'item',
        action: () => { onNavigate('productos', { term: p.name }); close() },
        content: <Row title={hl(p.name, q)} sub={[p.category || null, p.barcode ? `#${p.barcode}` : null]} right={fmtMoney(p.price)} />,
      }))
      push(verTodos('productos', () => { onNavigate('productos', { term: q }); setOpen(false) }))
    }
    if (results.servicios.length) {
      results.servicios.forEach(s => push({
        group: 'servicios', kind: 'item',
        action: () => { onNavigate('servicios', { term: s.name }); close() },
        content: <Row title={hl(s.name, q)} sub={[s.category || null]} right={s.price_on_request ? 'A consultar' : fmtMoney(s.price)} />,
      }))
      push(verTodos('servicios', () => { onNavigate('servicios', { term: q }); setOpen(false) }))
    }
    if (results.clientes.length) {
      results.clientes.forEach(c => push({
        group: 'clientes', kind: 'item',
        action: () => { onOpenCustomer(c); close() },
        content: <Row title={hl(c.name, q)} sub={[c.phone ? hl(c.phone, q) : null, c.doc_id || null]} />,
      }))
      // Clientes no tiene sección propia: la ficha se abre desde acá.
    }
    if (results.turnos.length) {
      results.turnos.forEach(a => push({
        group: 'turnos', kind: 'item',
        action: () => { onNavigate('agenda', { date: a.appt_date }); close() },
        content: <Row title={hl(a.customer_name, q)} sub={[a.service_name || null, `${fmtDay(a.appt_date)} · ${a.appt_time}`]} />,
      }))
      push(verTodos('turnos', () => { onNavigate('agenda', {}); setOpen(false) }))
    }
    if (results.pagos.length) {
      results.pagos.forEach(p => push({
        group: 'pagos', kind: 'item',
        action: () => { onNavigate('finanzas', { term: p.customer_name || p.description || '' }); close() },
        content: <Row title={hl(p.customer_name || p.description || 'Pago', q)} sub={[fmtDay(p.pay_date), p.method]} right={fmtMoney(p.amount)} />,
      }))
      push(verTodos('pagos', () => { onNavigate('finanzas', { term: q }); setOpen(false) }))
    }
    return out

    function verTodos(group: GroupKey, action: () => void): Flat {
      return { group, kind: 'all', action, content: <span className="gs-all">Ver todos</span> }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, q])

  // Reset del índice activo cuando cambian los resultados.
  useEffect(() => { setActive(0) }, [flat.length])

  // Cerrar al hacer click afuera.
  useEffect(() => {
    if (!showPanel) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [showPanel])

  // Mantener el ítem activo a la vista al moverse con el teclado.
  useEffect(() => {
    itemRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!showPanel || flat.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.action() }
  }

  // Render agrupado: recorremos el flat y metemos un encabezado al cambiar de grupo.
  let idx = -1
  let lastGroup: GroupKey | null = null

  return (
    <div className="gsearch" ref={wrapRef}>
      <div className="topnav-search gsearch-input">
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={term}
          onChange={e => { setTerm(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar productos, servicios, clientes, turnos, pagos…"
          autoFocus={autoFocus}
        />
        {term && (
          <button className="gs-clear" onClick={() => { setTerm(''); setActive(0) }} title="Limpiar" aria-label="Limpiar">✕</button>
        )}
      </div>

      {showPanel && (
        <div className="gsearch-panel" onMouseDown={e => e.preventDefault()}>
          {loading ? (
            <div className="gs-state"><span className="gs-spinner" /> Buscando…</div>
          ) : total === 0 ? (
            <div className="gs-state">Sin resultados para “{q}”.</div>
          ) : (
            flat.map((f, i) => {
              idx++
              const header = f.group !== lastGroup ? (lastGroup = f.group, GROUP_META[f.group]) : null
              const myIndex = idx
              return (
                <div key={i}>
                  {header && (
                    <div className="gs-group-head">{header.icon}{header.label}</div>
                  )}
                  <div
                    ref={el => { itemRefs.current[myIndex] = el }}
                    className={`gs-row${f.kind === 'all' ? ' gs-row-all' : ''}${myIndex === active ? ' active' : ''}`}
                    onMouseEnter={() => setActive(myIndex)}
                    onClick={() => f.action()}
                  >
                    {f.content}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Fila de resultado (título + subtítulos + valor a la derecha) ──
function Row({ title, sub, right }: { title: ReactNode; sub?: (string | ReactNode | null)[]; right?: string }) {
  const parts = (sub || []).filter(Boolean)
  return (
    <div className="gs-item">
      <div style={{ minWidth: 0 }}>
        <div className="gs-title">{title}</div>
        {parts.length > 0 && (
          <div className="gs-sub">{parts.map((p, i) => <span key={i}>{i > 0 && <span className="gs-dot">·</span>}{p}</span>)}</div>
        )}
      </div>
      {right && <div className="gs-right">{right}</div>}
    </div>
  )
}

function fmtDay(iso?: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

// ── Íconos por grupo ──
function IcBox()   { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg> }
function IcTag()   { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6 6a2 2 0 102.8 2.8l6-6a4 4 0 005.6-5.6l-2.1 2.1-2.2-.6-.6-2.2z" /></svg> }
function IcUser()  { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> }
function IcCal()   { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> }
function IcMoney() { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg> }
