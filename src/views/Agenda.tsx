import { useMemo, useRef, useState } from 'react'
import { useAppointments } from '../hooks/useAppointments'
import type { Appointment, AppointmentInput } from '../hooks/useAppointments'
import { useServices, fmtDuration } from '../hooks/useServices'
import { useBusinessContext } from '../context/BusinessContext'
import { useCustomers } from '../hooks/useCustomers'
import Combobox from '../components/Combobox'
import TimePicker from '../components/TimePicker'
import { serviceColor } from '../lib/colors'
import { initPhone, cleanPhone } from '../lib/phone'

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0)

interface SvcOpt { name: string; duration: number | null; price: number; on_request: boolean }

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

export default function Agenda() {
  const { appointments, loading, addAppointment, updateAppointment, deleteAppointment } = useAppointments()
  const { services } = useServices()
  const { customers, upsertFromAppointment } = useCustomers()
  const { business } = useBusinessContext()

  const svcOpts: SvcOpt[] = useMemo(
    () => services.map(s => ({ name: s.name, duration: s.duration_min, price: s.price, on_request: s.price_on_request })),
    [services]
  )

  const today = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t }, [])
  const [ref, setRef] = useState<Date>(today)
  const [selected, setSelected] = useState<Date>(today)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [presetTime, setPresetTime] = useState('')
  const [toCancel, setToCancel] = useState<Appointment | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  function openAdd() { setEditing(null); setPresetTime(''); setFormOpen(true) }
  function openAddAt(min: number) { setEditing(null); setPresetTime(minToTime(min)); setFormOpen(true) }
  function openEdit(a: Appointment) { setEditing(a); setPresetTime(''); setFormOpen(true) }

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

  // Clic en una zona libre de la grilla: agenda en esa hora (redondeada a 15 min)
  function onGridClick(e: React.MouseEvent) {
    const rect = calRef.current?.getBoundingClientRect()
    if (!rect) return
    const y = e.clientY - rect.top
    let min = startMin0 + y / PX_PER_MIN
    min = Math.round(min / 15) * 15
    min = Math.max(startMin0, Math.min((endH * 60) - 15, min))
    openAddAt(min)
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
            <div className="daycal-hint">Tocá un espacio libre para agendar un turno en ese horario.</div>
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
                const color = serviceColor(a.service_name)
                const hasColor = color.startsWith('#')
                const compact = height < 52
                return (
                  <div
                    key={a.id}
                    className={`daycal-appt${compact ? ' compact' : ''}`}
                    style={{
                      top, height,
                      background: hasColor ? color + '1f' : 'var(--surf-2)',
                      borderLeft: `4px solid ${hasColor ? color : 'var(--line-2)'}`,
                    }}
                    onClick={e => { e.stopPropagation(); openEdit(a) }}
                  >
                    <div className="daycal-appt-main">
                      <div className="daycal-appt-top">
                        <span className="daycal-appt-name">{a.customer_name}</span>
                        <span className="daycal-appt-time">{a.appt_time}{a.duration_min ? ` · ${fmtDuration(a.duration_min)}` : ''}</span>
                      </div>
                      {!compact && (
                        <div className="daycal-appt-meta">
                          {a.service_name && <span>{a.service_name}</span>}
                          {a.price != null && <span>· {fmtPrice(a.price)}</span>}
                          {a.phone && <span>· {a.phone}</span>}
                          {a.source !== 'manual' && <span className="appt-src">· {a.source}</span>}
                          {a.notes && <span className="daycal-appt-notes">· {a.notes}</span>}
                        </div>
                      )}
                    </div>
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
          services={svcOpts}
          customers={customers.map(c => ({ name: c.name, phone: c.phone }))}
          onClose={() => setFormOpen(false)}
          onSave={async (input, saveCustomer) => {
            if (editing) await updateAppointment(editing.id, input)
            else await addAppointment(input)
            if (saveCustomer) await upsertFromAppointment(input.customer_name, input.phone ?? null)
            setFormOpen(false)
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
function AppointmentForm({
  appointment, defaultDate, defaultTime, services, customers, onClose, onSave,
}: {
  appointment: Appointment | null
  defaultDate: string
  defaultTime: string
  services: SvcOpt[]
  customers: { name: string; phone: string | null }[]
  onClose: () => void
  onSave: (input: AppointmentInput, saveCustomer: boolean) => Promise<void>
}) {
  const [customer, setCustomer] = useState(appointment?.customer_name ?? '')
  const [serviceName, setServiceName] = useState(appointment?.service_name ?? '')
  const [date, setDate] = useState(appointment?.appt_date ?? defaultDate)
  const [time, setTime] = useState(appointment?.appt_time ?? defaultTime)
  const [duration, setDuration] = useState(appointment?.duration_min ? String(appointment.duration_min) : '')
  const [price, setPrice] = useState(appointment?.price != null ? String(appointment.price) : '')
  const [phone, setPhone] = useState(initPhone(appointment?.phone))
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [saveCustomer, setSaveCustomer] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Al elegir un servicio de la lista, completa duración y precio automáticamente.
  function pickService(s: SvcOpt) {
    setDuration(s.duration ? String(s.duration) : '')
    setPrice(s.on_request ? '' : String(s.price))
  }

  async function submit() {
    setErr(null)
    if (!customer.trim()) return setErr('El nombre del cliente es obligatorio.')
    if (!date) return setErr('Elegí una fecha.')
    if (!time) return setErr('Elegí una hora.')
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
    setSaving(true)
    try {
      await onSave({
        customer_name: customer.trim(),
        service_name: serviceName.trim() || null,
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
            onChange={setServiceName}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Fecha *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Hora *</label>
            <TimePicker value={time} onChange={setTime} placeholder="Ej: 13:00" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

        {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" type="button" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : (appointment ? 'Guardar cambios' : 'Agendar turno')}
          </button>
        </div>
      </div>
    </div>
  )
}
