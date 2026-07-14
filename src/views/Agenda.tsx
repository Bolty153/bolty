import { useMemo, useRef, useState, useEffect } from 'react'
import type { ViewFocus } from '../App'
import { useAppointments } from '../hooks/useAppointments'
import type { Appointment, AppointmentInput } from '../hooks/useAppointments'
import { useServices, fmtDuration } from '../hooks/useServices'
import { useEmployees } from '../hooks/useEmployees'
import type { Employee } from '../hooks/useEmployees'
import { useBusinessContext } from '../context/BusinessContext'
import type { AgendaConfig, Day, DayHours } from '../context/BusinessContext'
import { useCustomers } from '../hooks/useCustomers'
import { useFinance } from '../hooks/useFinance'
import { useBankAccounts } from '../hooks/useBankAccounts'
import Combobox from '../components/Combobox'
import TimePicker from '../components/TimePicker'
import PaymentForm from '../components/finance/PaymentForm'
import { serviceColor } from '../lib/colors'
import { initPhone, cleanPhone } from '../lib/phone'
import {
  timeToMin as tMin, employeeStatus, overlapCount, packLanes,
  type EmpStatus, type SlotCtx,
} from '../lib/availability'

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0)

interface SvcOpt { id: string; name: string; duration: number | null; price: number; on_request: boolean }

const timeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const minToTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
// getDay() (0=domingo) -> clave de business_hours
const DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const

/* ── Utilidades de fecha (en horario local, sin problemas de zona) ── */
const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const pad = (n: number) => String(n).padStart(2, '0')
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}
function fromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmtLong = (d: Date) => cap(new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d))
const fmtShort = (d: Date) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(d)

export default function Agenda({ focus }: { focus?: ViewFocus }) {
  const { appointments, loading, addAppointment, updateAppointment, deleteAppointment } = useAppointments()
  const { services } = useServices()
  const { employees, serviceMap } = useEmployees()
  const { customers, upsertFromAppointment } = useCustomers()
  const { business } = useBusinessContext()
  const { payments, addPayment } = useFinance()
  const { accounts, addAccount } = useBankAccounts()

  // Estado de pago de cada turno, derivado del pago asociado (si lo hay):
  //  - pago pendiente de confirmar -> 'pending' (ámbar)
  //  - pago confirmado (o turno marcado pagado) -> 'paid' (verde)
  //  - sin pago -> 'unpaid'
  // Así Agenda y Finanzas quedan sincronizadas: al confirmar/rechazar el pago
  // en Finanzas, el turno cambia de estado solo.
  const payByAppt = useMemo(() => {
    const m: Record<string, typeof payments[number]> = {}
    payments.forEach(p => {
      if (!p.appointment_id) return
      const prev = m[p.appointment_id]
      // Priorizamos un pago verificado; si no, el más reciente.
      if (!prev || (p.verified !== false && prev.verified === false)) m[p.appointment_id] = p
    })
    return m
  }, [payments])
  const payStateOf = (a: Appointment): 'pending' | 'paid' | 'unpaid' => {
    const p = payByAppt[a.id]
    if (p && p.verified === false) return 'pending'
    if (a.paid || (p && p.verified !== false)) return 'paid'
    return 'unpaid'
  }

  const cfg = business.agenda_config
  const staffMode = cfg.mode === 'staff' && employees.length > 0

  const svcOpts: SvcOpt[] = useMemo(
    () => services.map(s => ({ id: s.id, name: s.name, duration: s.duration_min, price: s.price, on_request: s.price_on_request })),
    [services]
  )

  const activeEmployees = useMemo(() => employees.filter(e => e.active), [employees])
  const employeeById = useMemo(() => {
    const m: Record<string, Employee> = {}
    employees.forEach(e => { m[e.id] = e })
    return m
  }, [employees])

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const [ref, setRef] = useState<Date>(today)
  const [selected, setSelected] = useState<Date>(today)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [presetTime, setPresetTime] = useState('')
  const [presetEmp, setPresetEmp] = useState<string | null>(null)
  const [toCancel, setToCancel] = useState<Appointment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [payFor, setPayFor] = useState<Appointment | null>(null)

  // Si venimos del buscador global a un turno, saltamos a su día.
  useEffect(() => {
    if (focus?.date) { const d = fromKey(focus.date); setRef(d); setSelected(d) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.ts])

  const weekDays = useMemo(() => {
    const start = startOfWeek(ref)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [ref])

  const selectedKey = toKey(selected)
  const todayKey = toKey(today)

  const dayAppts = useMemo(
    () => appointments
      .filter(a => a.appt_date === selectedKey)
      .sort((a, b) => a.appt_time.localeCompare(b.appt_time)),
    [appointments, selectedKey]
  )

  // Cuántos turnos hay por día de la semana visible (para el puntito en el calendario)
  const countByDay = useMemo(() => {
    const m: Record<string, number> = {}
    appointments.forEach(a => { m[a.appt_date] = (m[a.appt_date] ?? 0) + 1 })
    return m
  }, [appointments])

  function shiftWeek(n: number) { setRef(addDays(ref, n * 7)); setSelected(addDays(selected, n * 7)) }
  function goToday() { setRef(today); setSelected(today) }

  function openAdd() { setEditing(null); setPresetTime(''); setPresetEmp(null); setFormOpen(true) }
  function openAddAt(min: number, emp: string | null = null) { setEditing(null); setPresetTime(minToTime(min)); setPresetEmp(emp); setFormOpen(true) }
  function openEdit(a: Appointment) { setEditing(a); setPresetTime(''); setPresetEmp(null); setFormOpen(true) }

  // Rango de horas de la grilla del día: arranca con tus horarios de atención
  // y se estira si hay turnos antes o después de ese rango.
  const { startH, endH } = useMemo(() => {
    const dh = business.business_hours?.[DAY_KEYS[selected.getDay()]]
    let s = 8, e = 20
    if (dh && dh.open) {
      const end = dh.split && dh.to2 ? dh.to2 : dh.to
      s = Math.floor(timeToMin(dh.from) / 60)
      e = Math.ceil(timeToMin(end) / 60)
    }
    dayAppts.forEach(a => {
      s = Math.min(s, Math.floor(timeToMin(a.appt_time) / 60))
      e = Math.max(e, Math.ceil((timeToMin(a.appt_time) + (a.duration_min ?? 30)) / 60))
    })
    if (e <= s) e = s + 1
    return { startH: s, endH: e }
  }, [business.business_hours, selected, dayAppts])

  const HOUR_H = 64                       // px por hora
  const PX_PER_MIN = HOUR_H / 60
  const startMin0 = startH * 60
  const gridHeight = (endH - startH) * HOUR_H
  const calRef = useRef<HTMLDivElement>(null)

  // Reparto en columnas del día. Cada turno recibe { i, j, k }: i = columna
  // principal (empleado, o sub-columna del packing), k = cuántas sub-columnas
  // tiene esa columna, j = cuál ocupa. En modo por empleado hay una columna por
  // persona (+ "Sin asignar"), y dentro de cada una se sub-reparte si hay
  // solapamientos (sólo pasa si se permite superponer). Sin empleados es el
  // packing greedy de siempre: con capacidad 1 y sin solapes queda idéntico.
  const NONE_LANE = '__none__'
  const start = (a: Appointment) => tMin(a.appt_time)
  const end = (a: Appointment) => tMin(a.appt_time) + (a.duration_min ?? 30)
  const layout = useMemo(() => {
    const pos: Record<string, { i: number; j: number; k: number }> = {}
    if (staffMode) {
      const lanes: { key: string; label: string; color: string | null }[] =
        activeEmployees.map(e => ({ key: e.id, label: e.name, color: e.color }))
      const usesNone = dayAppts.some(a => !a.employee_id || !employeeById[a.employee_id]?.active)
      if (usesNone) lanes.push({ key: NONE_LANE, label: 'Sin asignar', color: null })
      const idx: Record<string, number> = {}
      lanes.forEach((l, i) => { idx[l.key] = i })
      // Turnos agrupados por columna, y dentro de cada columna packing propio.
      const byLane: Record<string, Appointment[]> = {}
      dayAppts.forEach(a => {
        const key = (a.employee_id && employeeById[a.employee_id]?.active) ? a.employee_id : NONE_LANE
        ;(byLane[key] ??= []).push(a)
      })
      lanes.forEach(l => {
        const group = byLane[l.key] ?? []
        const { lanes: subOf, laneCount: k } = packLanes(group.map(a => ({ id: a.id, startMin: start(a), endMin: end(a) })))
        group.forEach(a => { pos[a.id] = { i: idx[l.key], j: subOf[a.id] ?? 0, k } })
      })
      return { lanes, pos, laneCount: Math.max(1, lanes.length) }
    }
    const { lanes: laneOf, laneCount } = packLanes(dayAppts.map(a => ({ id: a.id, startMin: start(a), endMin: end(a) })))
    dayAppts.forEach(a => { pos[a.id] = { i: laneOf[a.id] ?? 0, j: 0, k: 1 } })
    return { lanes: null as null | { key: string; label: string; color: string | null }[], pos, laneCount }
  }, [staffMode, activeEmployees, dayAppts, employeeById])

  // Estilo de columna para un turno. Con una sola columna y sin sub-división
  // dejamos el ancho completo del CSS (mismo desktop de antes).
  function laneStyle(id: string): React.CSSProperties {
    const N = layout.laneCount
    const p = layout.pos[id] ?? { i: 0, j: 0, k: 1 }
    if (N <= 1 && p.k <= 1) return {}
    const frac = p.i + p.j / p.k          // posición en unidades de columna principal
    return {
      left: `calc(52px + (100% - 58px) * ${frac} / ${N})`,
      width: `calc((100% - 58px) / ${N} / ${p.k} - 4px)`,
      right: 'auto',
    }
  }

  // Clic en una zona libre de la grilla: agenda en esa hora (redondeada a 15 min).
  // En modo por empleado, además detecta en qué columna clickeaste para preseleccionar a la persona.
  function onGridClick(e: React.MouseEvent) {
    const rect = calRef.current?.getBoundingClientRect()
    if (!rect) return
    const y = e.clientY - rect.top
    let min = startMin0 + y / PX_PER_MIN
    min = Math.round(min / 15) * 15
    min = Math.max(startMin0, Math.min((endH * 60) - 15, min))
    let emp: string | null = null
    if (staffMode && layout.lanes) {
      const area = rect.width - 58        // descuenta gutter de horas (52) + margen derecho (6)
      const rel = e.clientX - rect.left - 52
      const i = Math.max(0, Math.min(layout.lanes.length - 1, Math.floor((rel / area) * layout.lanes.length)))
      const key = layout.lanes[i]?.key
      emp = key && key !== NONE_LANE ? key : null
    }
    openAddAt(min, emp)
  }

  async function confirmCancel() {
    if (!toCancel) return
    setDeleting(true)
    try {
      await deleteAppointment(toCancel.id)
      setToCancel(null)
    } catch (e) {
      alert('No se pudo cancelar: ' + (e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  const weekLabel = `${fmtShort(weekDays[0])} – ${fmtShort(weekDays[6])}`

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div><h1>Agenda y turnos</h1><div className="sub">Los turnos que reservás vos o que reserva Bolty</div></div>
        </div>
        <button className="btn" onClick={openAdd}>+ Agendar turno</button>
      </div>

      {/* Navegación de semana */}
      <div className="cal-nav">
        <button className="cal-arrow" onClick={() => shiftWeek(-1)} aria-label="Semana anterior">‹</button>
        <span className="cal-range">{weekLabel}</span>
        <button className="cal-arrow" onClick={() => shiftWeek(1)} aria-label="Semana siguiente">›</button>
        <button className="cal-today" onClick={goToday}>Hoy</button>
      </div>

      {/* Strip de 7 días */}
      <div className="cal-week">
        {weekDays.map(d => {
          const key = toKey(d)
          const count = countByDay[key] ?? 0
          return (
            <button
              key={key}
              className={`cal-day${key === selectedKey ? ' sel' : ''}${key === todayKey ? ' today' : ''}`}
              onClick={() => setSelected(d)}
            >
              <span className="cal-day-wd">{WD_SHORT[d.getDay()]}</span>
              <span className="cal-day-num">{d.getDate()}</span>
              {count > 0 && <span className="cal-day-dot">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Turnos del día seleccionado */}
      <div className="card">
        <div className="card-h">
          <h3>{fmtLong(selected)}{selectedKey === todayKey ? ' · Hoy' : ''}</h3>
        </div>
        <div className="sub">{dayAppts.length === 0 ? 'Sin turnos para este día' : `${dayAppts.length} turno${dayAppts.length === 1 ? '' : 's'}`}</div>

        {loading ? (
          <div style={{ padding: '30px 0', color: 'var(--ink-faint)', fontSize: 14, textAlign: 'center' }}>Cargando…</div>
        ) : (
          <>
            <div className="daycal-hint">
              {staffMode
                ? 'Cada columna es una persona de tu equipo. Tocá un espacio libre para agendar en ese horario.'
                : cfg.mode === 'simple' && cfg.capacity > 1
                  ? `Podés dar hasta ${cfg.capacity} turnos por horario. Tocá un espacio libre para agendar.`
                  : 'Tocá un espacio libre para agendar un turno en ese horario.'}
            </div>

            {/* Encabezados de columna por empleado (modo por empleado) */}
            {staffMode && layout.lanes && (
              <div className="daycal-heads">
                {layout.lanes.map(l => (
                  <div key={l.key} className="daycal-head">
                    <span className="daycal-head-dot" style={{ background: l.color || 'var(--line-2)' }} />
                    <span className="daycal-head-lbl">{l.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="daycal" style={{ height: gridHeight }} ref={calRef} onClick={onGridClick}>
              {/* Líneas de hora */}
              {Array.from({ length: endH - startH + 1 }, (_, i) => startH + i).map(h => (
                <div key={h} className="daycal-line" style={{ top: (h - startH) * HOUR_H }}>
                  <span className="daycal-time">{String(h).padStart(2, '0')}:00</span>
                </div>
              ))}

              {/* Turnos posicionados por hora y altura según duración */}
              {dayAppts.map(a => {
                const top = (timeToMin(a.appt_time) - startMin0) * PX_PER_MIN
                const dur = a.duration_min ?? 30
                const height = Math.max(dur * PX_PER_MIN - 3, 20)
                const emp = a.employee_id ? employeeById[a.employee_id] : null
                // En modo por empleado el color lo da la persona; si no, el servicio.
                const color = staffMode && emp?.color ? emp.color : serviceColor(a.service_name)
                const hasColor = color.startsWith('#')
                const compact = height < 52
                const payState = payStateOf(a)
                return (
                  <div
                    key={a.id}
                    className={`daycal-appt${compact ? ' compact' : ''}`}
                    style={{
                      top, height,
                      background: hasColor ? color + '1f' : 'var(--surf-2)',
                      borderLeft: `4px solid ${hasColor ? color : 'var(--line-2)'}`,
                      ...laneStyle(a.id),
                    }}
                    onClick={e => { e.stopPropagation(); openEdit(a) }}
                  >
                    <div className="daycal-appt-main">
                      <div className="daycal-appt-top">
                        <span className="daycal-appt-name">{a.customer_name}</span>
                        {payState === 'paid' && <span className="appt-paid">✓ Cobrado</span>}
                        {payState === 'pending' && <span className="appt-pending">⏳ Pago pendiente</span>}
                        <span className="daycal-appt-time">{a.appt_time}{a.duration_min ? ` · ${fmtDuration(a.duration_min)}` : ''}</span>
                      </div>
                      {!compact && (
                        <div className="daycal-appt-meta">
                          {a.service_name && <span>{a.service_name}</span>}
                          {!staffMode && emp && <span>· {emp.name}</span>}
                          {a.price != null && <span>· {fmtPrice(a.price)}</span>}
                          {a.phone && <span>· {a.phone}</span>}
                          {a.source !== 'manual' && <span className="appt-src">· {a.source}</span>}
                          {a.notes && <span className="daycal-appt-notes">· {a.notes}</span>}
                        </div>
                      )}
                    </div>
                    {payState === 'paid' ? (
                      <span className="daycal-appt-paid" title="Pago confirmado">✓</span>
                    ) : payState === 'pending' ? (
                      <span className="daycal-appt-pending" title="Pago pendiente de confirmación. Confirmalo desde Finanzas.">⏳</span>
                    ) : (
                      <button
                        className="daycal-appt-pay"
                        title="Registrar pago"
                        onClick={e => { e.stopPropagation(); setPayFor(a) }}
                      >$</button>
                    )}
                    <button
                      className="daycal-appt-del"
                      title="Cancelar turno"
                      onClick={e => { e.stopPropagation(); setToCancel(a) }}
                    >×</button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {formOpen && (
        <AppointmentForm
          appointment={editing}
          defaultDate={selectedKey}
          defaultTime={presetTime}
          defaultEmployee={presetEmp}
          services={svcOpts}
          customers={customers.map(c => ({ name: c.name, phone: c.phone }))}
          staffMode={staffMode}
          config={cfg}
          employees={activeEmployees}
          serviceMap={serviceMap}
          businessHours={business.business_hours}
          appointments={appointments}
          onClose={() => setFormOpen(false)}
          onSave={async (input, saveCustomer) => {
            if (editing) await updateAppointment(editing.id, input)
            else await addAppointment(input)
            if (saveCustomer) await upsertFromAppointment(input.customer_name, input.phone ?? null)
            setFormOpen(false)
          }}
        />
      )}

      {payFor && (
        <PaymentForm
          services={svcOpts.map(s => ({ name: s.name, price: s.price, on_request: s.on_request }))}
          accounts={accounts}
          initial={{
            customer: payFor.customer_name,
            service: payFor.service_name ?? '',
            amount: payFor.price ?? svcOpts.find(s => s.name === payFor.service_name)?.price,
          }}
          onSaveAccount={addAccount}
          onClose={() => setPayFor(null)}
          onSave={async input => {
            // Vinculamos el pago al turno. Si el pago queda pendiente de confirmar,
            // el turno NO pasa a "pagado": muestra "Pago pendiente" hasta confirmarlo.
            await addPayment({ ...input, appointment_id: payFor.id })
            await updateAppointment(payFor.id, { paid: input.verified !== false })
            setPayFor(null)
          }}
        />
      )}

      {toCancel && (
        <div className="modal-ov" onClick={() => !deleting && setToCancel(null)}>
          <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="26" height="26">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </div>
            <h2>Cancelar turno</h2>
            <p>
              ¿Seguro que querés cancelar el turno de <b>{toCancel.customer_name}</b>
              {' '}del {fmtLong(fromKey(toCancel.appt_date)).toLowerCase()} a las {toCancel.appt_time}?
              <br />Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setToCancel(null)} disabled={deleting}>Volver</button>
              <button className="btn btn-danger" onClick={confirmCancel} disabled={deleting}>
                {deleting ? 'Cancelando…' : 'Sí, cancelar turno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ───────────── Alta / edición de turno ───────────── */
const AUTO = '__auto__'          // asignación automática (elige uno libre)
const STATUS_TXT: Record<EmpStatus, string> = { free: 'libre', busy: 'ocupado', off: 'no trabaja', cant: 'no hace ese servicio' }

function AppointmentForm({
  appointment, defaultDate, defaultTime, defaultEmployee, services, customers,
  staffMode, config, employees, serviceMap, businessHours, appointments,
  onClose, onSave,
}: {
  appointment: Appointment | null
  defaultDate: string
  defaultTime: string
  defaultEmployee: string | null
  services: SvcOpt[]
  customers: { name: string; phone: string | null }[]
  staffMode: boolean
  config: AgendaConfig
  employees: Employee[]
  serviceMap: Record<string, string[]>
  businessHours: Record<Day, DayHours>
  appointments: Appointment[]
  onClose: () => void
  onSave: (input: AppointmentInput, saveCustomer: boolean) => Promise<void>
}) {
  const [customer, setCustomer] = useState(appointment?.customer_name ?? '')
  const [serviceName, setServiceName] = useState(appointment?.service_name ?? '')
  const [serviceId, setServiceId] = useState<string | null>(appointment?.service_id ?? null)
  const [date, setDate] = useState(appointment?.appt_date ?? defaultDate)
  const [time, setTime] = useState(appointment?.appt_time ?? defaultTime)
  const [duration, setDuration] = useState(appointment?.duration_min ? String(appointment.duration_min) : '')
  const [price, setPrice] = useState(appointment?.price != null ? String(appointment.price) : '')
  const [phone, setPhone] = useState(initPhone(appointment?.phone))
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  // Empleado elegido: '' = sin asignar, AUTO = automático, o el id de la persona.
  const [employee, setEmployee] = useState<string>(
    appointment?.employee_id ?? defaultEmployee ?? (config.assignment === 'auto' ? AUTO : '')
  )
  const [saveCustomer, setSaveCustomer] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Al elegir un servicio de la lista, completa duración y precio, y fija el id
  // (que sirve para saber qué empleados lo hacen).
  function pickService(s: SvcOpt) {
    setServiceId(s.id)
    setDuration(s.duration ? String(s.duration) : '')
    setPrice(s.on_request ? '' : String(s.price))
  }
  // Si escribe a mano, resolvemos el id por nombre exacto (o null si es libre).
  function onServiceText(v: string) {
    setServiceName(v)
    setServiceId(services.find(s => s.name === v)?.id ?? null)
  }

  const effDur = (() => { const d = parseInt(duration, 10); return !isNaN(d) && d > 0 ? d : 30 })()

  // En el alta manual el dueño puede elegir a CUALQUIER persona del equipo;
  // al lado de cada una mostramos su estado (libre / ocupado / no trabaja /
  // no hace ese servicio) para que decida con la info a la vista.
  const candidates = useMemo(() => (staffMode ? employees : []), [staffMode, employees])
  const statusMap = useMemo(() => {
    const m: Record<string, EmpStatus> = {}
    if (!staffMode || !date || !time) return m
    const ctx: SlotCtx = {
      businessHours, serviceMap, appts: appointments, dayDate: date,
      startMin: tMin(time), durMin: effDur, serviceId, excludeId: appointment?.id,
    }
    candidates.forEach(e => { m[e.id] = employeeStatus(e, ctx) })
    return m
  }, [staffMode, date, time, effDur, serviceId, candidates, appointments, businessHours, serviceMap, appointment?.id])

  // Bloqueo duro: por defecto una persona no puede tener dos turnos a la misma
  // hora. Se puede permitir desde Equipo ("permitir superponer").
  const block = useMemo(() => {
    if (!staffMode || config.allow_overlap) return null
    if (!employee || employee === AUTO) return null
    if (statusMap[employee] === 'busy') {
      return 'Esa persona ya tiene un turno a esa hora. Cambiá el horario o la persona (o activá "permitir superponer" en Equipo).'
    }
    return null
  }, [staffMode, config.allow_overlap, employee, statusMap])

  // Aviso blando (no bloquea): sobrecupo, persona que no trabaja o que no hace ese servicio.
  const warn = useMemo(() => {
    if (!date || !time) return null
    if (!staffMode) {
      if (config.mode === 'simple' && config.capacity > 0) {
        const n = overlapCount(appointments, date, tMin(time), effDur, appointment?.id)
        if (n >= config.capacity) return `Ya hay ${n} turno${n === 1 ? '' : 's'} a esa hora y tu cupo es de ${config.capacity}. Podés guardarlo igual.`
      }
      return null
    }
    if (employee === AUTO) {
      const anyFree = candidates.some(e => statusMap[e.id] === 'free')
      if (!anyFree) return 'No hay nadie libre para ese servicio a esa hora. Si guardás, el turno queda sin asignar.'
      return null
    }
    if (employee) {
      const st = statusMap[employee]
      if (st === 'busy' && config.allow_overlap) return 'Esa persona ya tiene un turno a esa hora. Podés guardarlo igual.'
      if (st === 'off') return 'Esa persona no trabaja ese día u horario. Podés guardarlo igual.'
      if (st === 'cant') return 'Esa persona no tiene marcado ese servicio. Podés guardarlo igual.'
    }
    return null
  }, [staffMode, config, employee, statusMap, candidates, appointments, date, time, effDur, appointment?.id])

  async function submit() {
    setErr(null)
    if (!customer.trim()) return setErr('El nombre del cliente es obligatorio.')
    if (!date) return setErr('Elegí una fecha.')
    if (!time) return setErr('Elegí una hora.')
    if (block) return setErr(block)
    let durationMin: number | null = null
    if (duration.trim() !== '') {
      const d = parseInt(duration, 10)
      if (isNaN(d) || d < 0) return setErr('La duración tiene que ser un número de minutos.')
      durationMin = d
    }
    let priceNum: number | null = null
    if (price.trim() !== '') {
      const p = parseFloat(price.replace(',', '.'))
      if (isNaN(p) || p < 0) return setErr('El precio tiene que ser un número válido.')
      priceNum = p
    }
    // Resolución del empleado: en automático elegimos al primero libre; si no
    // hay ninguno, el turno queda sin asignar (el dueño lo ve después).
    let employeeId: string | null = null
    if (staffMode) {
      if (employee === AUTO) employeeId = candidates.find(e => statusMap[e.id] === 'free')?.id ?? null
      else employeeId = employee || null
    }
    setSaving(true)
    try {
      await onSave({
        customer_name: customer.trim(),
        service_name: serviceName.trim() || null,
        service_id: serviceId,
        employee_id: employeeId,
        appt_date: date,
        appt_time: time,
        duration_min: durationMin,
        price: priceNum,
        phone: cleanPhone(phone) || null,
        notes: notes.trim() || null,
      }, saveCustomer)
    } catch (e) {
      setErr('No se pudo guardar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{appointment ? 'Editar turno' : 'Agendar turno'}</h2>

        <div className="field">
          <label>Nombre del cliente *</label>
          <Combobox
            value={customer}
            onChange={setCustomer}
            items={customers}
            getLabel={c => c.name}
            getSub={c => c.phone}
            onPick={c => { if (c.phone) setPhone(c.phone) }}
            placeholder="Ej: Juan Pérez"
            autoFocus
          />
          {customers.length > 0 && <div className="hint">Empezá a escribir: si ya es cliente, se autocompleta el teléfono.</div>}
        </div>

        <div className="field">
          <label>Servicio (opcional)</label>
          <Combobox
            value={serviceName}
            onChange={onServiceText}
            items={services}
            getLabel={s => s.name}
            getColor={s => serviceColor(s.name)}
            getSub={s => {
              const pr = s.on_request ? 'A consultar' : fmtPrice(s.price)
              return s.duration ? `${pr} · ${fmtDuration(s.duration)}` : pr
            }}
            onPick={pickService}
            placeholder="Ej: Lavado completo"
          />
        </div>

        {staffMode && (
          <div className="field">
            <label>¿Con quién?</label>
            <select className="appt-emp-select" value={employee} onChange={e => setEmployee(e.target.value)}>
              <option value="">Sin asignar</option>
              <option value={AUTO}>Automático — asignar a alguien libre</option>
              {candidates.map(e => {
                const st = statusMap[e.id]
                return (
                  <option key={e.id} value={e.id}>
                    {e.name}{st && st !== 'free' ? ` · ${STATUS_TXT[st]}` : (st === 'free' ? ' · libre' : '')}
                  </option>
                )
              })}
            </select>
            {candidates.length === 0 && (
              <div className="hint">Todavía no cargaste a nadie en tu equipo. Sumalos en la sección Equipo.</div>
            )}
          </div>
        )}

        <div className="field-row-2" style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label>Fecha *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Hora *</label>
            <TimePicker value={time} onChange={setTime} placeholder="Ej: 13:00" />
          </div>
        </div>

        <div className="field-row-2" style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label>Duración (min)</label>
            <input type="text" inputMode="numeric" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ej: 60" />
          </div>
          <div className="field">
            <label>Precio</label>
            <input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ej: 5000" />
          </div>
        </div>

        <div className="field">
          <label>Teléfono (opcional)</label>
          <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 9 341 555-0000" />
        </div>

        <div className="field">
          <label>Notas (opcional)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: pasa a buscar el auto a domicilio" />
        </div>

        <label className="svc-check" style={{ marginTop: 2 }}>
          <input type="checkbox" checked={saveCustomer} onChange={e => setSaveCustomer(e.target.checked)} />
          Guardar como cliente (recordar su teléfono para la próxima)
        </label>

        {block && <div className="onb-error" style={{ marginTop: 12 }}>{block}</div>}
        {!block && warn && <div className="appt-warn" style={{ marginTop: 12 }}>{warn}</div>}
        {err && !block && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" type="button" onClick={submit} disabled={saving || !!block}>
            {saving ? 'Guardando…' : (appointment ? 'Guardar cambios' : 'Agendar turno')}
          </button>
        </div>
      </div>
    </div>
  )
}
