import { useMemo, useState } from 'react'
import { useAppointments } from '../../hooks/useAppointments'
import type { Appointment } from '../../hooks/useAppointments'
import { useExpenses } from '../../hooks/useExpenses'
import type { Expense } from '../../hooks/useExpenses'
import type { Employee } from '../../hooks/useEmployees'
import { fmtMoney } from '../../hooks/useFinance'

// ── Período seleccionable, relativo a hoy ──
type Period = 'hoy' | 'semana' | 'mes' | 'anio'
const PERIOD_LABELS: [Period, string][] = [['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']]

const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Lunes de la semana de una fecha (semana Lun–Dom, como en la Agenda).
function weekBounds(today: Date) {
  const start = new Date(today)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const endD = new Date(start); endD.setDate(start.getDate() + 6)
  return { from: toKey(start), to: toKey(endD) }
}

interface Row {
  emp: Employee
  genero: number
  costo: number
  resultado: number
  cantidad: number
  ticket: number
  hasData: boolean
}

export default function RentabilidadPanel({ employees }: { employees: Employee[] }) {
  const { appointments, loading: loadingA } = useAppointments()
  const { expenses, loading: loadingE } = useExpenses()

  const [period, setPeriod] = useState<Period>('mes')
  // "Generó": por defecto contamos TODOS los turnos del período (trabajo
  // agendado/atendido). Con este toggle se limita a los ya cobrados.
  const [onlyPaid, setOnlyPaid] = useState(false)
  const [drill, setDrill] = useState<{ emp: Employee | null; kind: 'genero' | 'costo' } | null>(null)

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const todayKey = toKey(today)
  const week = useMemo(() => weekBounds(today), [today])

  const inPeriod = useMemo(() => (k: string) => {
    if (period === 'hoy') return k === todayKey
    if (period === 'mes') return k.startsWith(todayKey.slice(0, 7))
    if (period === 'anio') return k.startsWith(todayKey.slice(0, 4))
    return k >= week.from && k <= week.to   // semana
  }, [period, todayKey, week])

  // Turnos y gastos del período (base de todo el cálculo).
  const periodAppts = useMemo(
    () => appointments.filter(a => inPeriod(a.appt_date) && (!onlyPaid || a.paid)),
    [appointments, inPeriod, onlyPaid]
  )
  const periodExpenses = useMemo(
    () => expenses.filter(e => inPeriod(e.expense_date)),
    [expenses, inPeriod]
  )

  // Una fila por empleado (activos + inactivos que tengan movimiento en el período).
  const rows = useMemo<Row[]>(() => {
    const list = employees.map(emp => {
      const appts = periodAppts.filter(a => a.employee_id === emp.id)
      const genero = appts.reduce((s, a) => s + (a.price ?? 0), 0)
      const costo = periodExpenses.filter(e => e.employee_id === emp.id).reduce((s, e) => s + e.amount, 0)
      const cantidad = appts.length
      return {
        emp, genero, costo, resultado: genero - costo, cantidad,
        ticket: cantidad > 0 ? genero / cantidad : 0,
        hasData: cantidad > 0 || costo > 0,
      }
    })
    return list
      .filter(r => r.emp.active || r.hasData)
      .sort((a, b) => b.genero - a.genero)
  }, [employees, periodAppts, periodExpenses])

  // Turnos sin asignar y gastos generales: NUNCA se reparten, van aparte.
  const unassigned = useMemo(() => {
    const appts = periodAppts.filter(a => !a.employee_id)
    return { genero: appts.reduce((s, a) => s + (a.price ?? 0), 0), cantidad: appts.length }
  }, [periodAppts])
  const generalExpenses = useMemo(
    () => periodExpenses.filter(e => !e.employee_id).reduce((s, e) => s + e.amount, 0),
    [periodExpenses]
  )

  const maxGenero = useMemo(() => Math.max(1, ...rows.map(r => r.genero)), [rows])

  if (loadingA || loadingE) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Cargando…</div>
  }

  return (
    <>
      {/* Controles: período + solo cobrados */}
      <div className="rent-controls">
        <div className="fin-period-tabs">
          {PERIOD_LABELS.map(([p, l]) => (
            <button key={p} className={`fin-period-tab${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>{l}</button>
          ))}
        </div>
        <label className="rent-paid-toggle">
          <input type="checkbox" checked={onlyPaid} onChange={e => setOnlyPaid(e.target.checked)} />
          Contar solo turnos cobrados
        </label>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <p style={{ fontSize: 14, maxWidth: 360 }}>
            Cargá a tu equipo y asigná los turnos a cada persona para ver cuánto genera y cuánto cuesta cada una.
          </p>
        </div>
      ) : (
        <>
          {/* Ranking / comparativo */}
          {rows.some(r => r.genero > 0) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-h"><h3>Quién genera más</h3></div>
              <div className="rent-bars">
                {rows.filter(r => r.genero > 0).map(r => (
                  <div key={r.emp.id} className="rent-bar-row">
                    <span className="rent-bar-name">{r.emp.name}</span>
                    <div className="rent-bar-track">
                      <div className="rent-bar-fill" style={{ width: `${(r.genero / maxGenero) * 100}%`, background: r.emp.color || 'var(--volt)' }} />
                    </div>
                    <span className="rent-bar-val">{fmtMoney(r.genero)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tarjetas por empleado */}
          <div className="rent-grid">
            {rows.map(r => (
              <div key={r.emp.id} className="rent-card">
                <div className="rent-card-head">
                  <div className="team-av" style={{ background: r.emp.color || 'var(--volt)', width: 34, height: 34, fontSize: 12 }}>
                    {r.emp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="rent-card-name">
                    {r.emp.name}
                    {!r.emp.active && <span className="rent-inactive"> · inactivo</span>}
                  </div>
                </div>

                {!r.hasData ? (
                  <div className="rent-empty">Sin datos en este período</div>
                ) : (
                  <>
                    <div className="rent-metrics">
                      <button className="rent-metric" onClick={() => setDrill({ emp: r.emp, kind: 'genero' })} title="Ver turnos">
                        <span className="rent-metric-lbl">Generó</span>
                        <span className="rent-metric-val up">{fmtMoney(r.genero)}</span>
                      </button>
                      <button className="rent-metric" onClick={() => setDrill({ emp: r.emp, kind: 'costo' })} title="Ver gastos">
                        <span className="rent-metric-lbl">Costó</span>
                        <span className="rent-metric-val down">{fmtMoney(r.costo)}</span>
                      </button>
                    </div>
                    <div className="rent-result">
                      <span>Resultado</span>
                      <b style={{ color: r.resultado >= 0 ? 'var(--mint)' : 'var(--rose)' }}>
                        {r.resultado < 0 ? '−' : ''}{fmtMoney(Math.abs(r.resultado))}
                      </b>
                    </div>
                    <div className="rent-sub">
                      {r.cantidad} turno{r.cantidad === 1 ? '' : 's'}
                      {r.cantidad > 0 && <> · ticket promedio {fmtMoney(r.ticket)}</>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Sin asignar / gastos generales — nunca se reparten */}
          {(unassigned.cantidad > 0 || generalExpenses > 0) && (
            <div className="card rent-unassigned">
              <div className="card-h"><h3>Sin asignar</h3></div>
              <div className="sub">Estos no se pueden atribuir a nadie, por eso van aparte.</div>
              <div className="rent-unassigned-row">
                {unassigned.cantidad > 0 && (
                  <div>
                    <div className="rent-metric-lbl">Turnos sin empleado</div>
                    <div className="rent-metric-val up">{fmtMoney(unassigned.genero)}</div>
                    <div className="rent-sub">{unassigned.cantidad} turno{unassigned.cantidad === 1 ? '' : 's'}</div>
                  </div>
                )}
                {generalExpenses > 0 && (
                  <div>
                    <div className="rent-metric-lbl">Gastos generales</div>
                    <div className="rent-metric-val down">{fmtMoney(generalExpenses)}</div>
                    <div className="rent-sub">No atribuidos a una persona</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {drill && drill.emp && (
        <DrillModal
          emp={drill.emp}
          kind={drill.kind}
          appts={periodAppts.filter(a => a.employee_id === drill.emp!.id)}
          expenses={periodExpenses.filter(e => e.employee_id === drill.emp!.id)}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  )
}

/* ───────────── Desglose de un número (turnos o gastos) ───────────── */
function DrillModal({
  emp, kind, appts, expenses, onClose,
}: {
  emp: Employee
  kind: 'genero' | 'costo'
  appts: Appointment[]
  expenses: Expense[]
  onClose: () => void
}) {
  const isGen = kind === 'genero'
  const total = isGen
    ? appts.reduce((s, a) => s + (a.price ?? 0), 0)
    : expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{emp.name} · {isGen ? 'Turnos que generó' : 'Gastos que costó'}</h2>

        {isGen ? (
          appts.length === 0 ? (
            <div className="rent-empty" style={{ padding: '20px 0' }}>Sin turnos en este período.</div>
          ) : (
            <div className="rent-drill-list">
              {appts.map(a => (
                <div key={a.id} className="rent-drill-item">
                  <div className="rent-drill-main">
                    <div className="rent-drill-t">{a.customer_name}</div>
                    <div className="rent-drill-m">
                      {a.appt_date.split('-').reverse().join('/')}{a.service_name ? ` · ${a.service_name}` : ''}{a.paid ? ' · ✓ cobrado' : ''}
                    </div>
                  </div>
                  <span className="rent-drill-amt up">{fmtMoney(a.price ?? 0)}</span>
                </div>
              ))}
            </div>
          )
        ) : (
          expenses.length === 0 ? (
            <div className="rent-empty" style={{ padding: '20px 0' }}>Sin gastos en este período.</div>
          ) : (
            <div className="rent-drill-list">
              {expenses.map(e => (
                <div key={e.id} className="rent-drill-item">
                  <div className="rent-drill-main">
                    <div className="rent-drill-t">{e.description || e.category}</div>
                    <div className="rent-drill-m">{e.expense_date.split('-').reverse().join('/')} · {e.category}</div>
                  </div>
                  <span className="rent-drill-amt down">−{fmtMoney(e.amount)}</span>
                </div>
              ))}
            </div>
          )
        )}

        <div className="rent-drill-total">
          <span>Total</span>
          <b style={{ color: isGen ? 'var(--mint)' : 'var(--rose)' }}>{isGen ? '' : '−'}{fmtMoney(total)}</b>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
