import { useState } from 'react'
import { useEmployees } from '../hooks/useEmployees'
import type { Employee, EmployeeInput } from '../hooks/useEmployees'
import { useServices } from '../hooks/useServices'
import type { Service } from '../hooks/useServices'
import { serviceColor } from '../lib/colors'
import { DAYS, DAY_LABELS, useBusinessContext } from '../context/BusinessContext'
import type { Day, DayHours, AgendaMode, AssignmentMode } from '../context/BusinessContext'

// Colores para distinguir a cada empleado de un vistazo en la agenda.
const EMP_COLORS = ['#6029ff', '#00c896', '#ff9500', '#ff3d71', '#0aa2ff', '#a855f7', '#14b8a6', '#ec4899']

const ASSIGN_LABELS: Record<AssignmentMode, { t: string; d: string }> = {
  client:     { t: 'El cliente elige', d: 'Cada cliente pide con quién quiere el turno (ej: "con Raúl").' },
  auto:       { t: 'Automático',       d: 'Bolty asigna a alguien libre que haga ese servicio.' },
  unassigned: { t: 'Sin asignar',      d: 'Se toma el turno y vos asignás después, cuando quieras.' },
}

export default function Equipo() {
  const { business, saveBusiness, saving } = useBusinessContext()
  const { employees, serviceMap, loading, error, reload, addEmployee, updateEmployee, deleteEmployee, setEmployeeServices } = useEmployees()
  const { services } = useServices()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const cfg = business.agenda_config

  // Persistimos cada cambio de configuración al toque (upsert del negocio).
  function setMode(mode: AgendaMode) { saveBusiness({ agenda_config: { ...cfg, mode } }) }
  function setCapacity(capacity: number) { saveBusiness({ agenda_config: { ...cfg, capacity: Math.max(1, capacity) } }) }
  function setAssignment(assignment: AssignmentMode) { saveBusiness({ agenda_config: { ...cfg, assignment } }) }
  function setAllowOverlap(allow_overlap: boolean) { saveBusiness({ agenda_config: { ...cfg, allow_overlap } }) }

  function openAdd() { setEditing(null); setFormOpen(true) }
  function openEdit(e: Employee) { setEditing(e); setFormOpen(true) }

  async function handleDelete(e: Employee) {
    if (!window.confirm(`¿Sacar a "${e.name}" del equipo? Los turnos que tenga quedan sin asignar (no se borran).`)) return
    try { await deleteEmployee(e.id) }
    catch (err) { alert('No se pudo borrar: ' + (err as Error).message) }
  }

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av" style={{ background: 'linear-gradient(135deg,var(--volt),var(--volt-2))', boxShadow: '0 6px 18px rgba(96,41,255,.25)' }}>
            <svg fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" width="24" height="24">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h1>Equipo</h1>
            <div className="sub">Cuántos turnos podés dar a la vez y quién atiende cada uno</div>
          </div>
        </div>
      </div>

      {/* ── Configuración del modo de agenda ── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3>Cómo se dan los turnos</h3></div>
        <div className="sub">Elegí cómo trabaja tu negocio. Podés cambiarlo cuando quieras.</div>

        <div className="team-mode-grid" style={{ marginTop: 16 }}>
          <button
            type="button"
            className={`team-mode-card${cfg.mode === 'simple' ? ' sel' : ''}`}
            onClick={() => setMode('simple')}
          >
            <div className="team-mode-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
                <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
            </div>
            <div className="team-mode-t">Por capacidad</div>
            <div className="team-mode-d">Cuántos turnos entran en el mismo horario, sin importar quién atienda. Ideal si es indistinto (ej: peluquería con varios peluqueros iguales).</div>
          </button>

          <button
            type="button"
            className={`team-mode-card${cfg.mode === 'staff' ? ' sel' : ''}`}
            onClick={() => setMode('staff')}
          >
            <div className="team-mode-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <div className="team-mode-t">Por empleado</div>
            <div className="team-mode-d">Cada uno hace sus servicios y tiene sus horarios (ej: dermatóloga, manicura). El turno se toma con una persona puntual.</div>
          </button>
        </div>

        {cfg.mode === 'simple' ? (
          <div className="team-cap-row">
            <div>
              <div className="team-cap-lbl">Turnos por horario</div>
              <div className="hint">Cuántas personas podés atender a la misma hora.</div>
            </div>
            <div className="team-stepper">
              <button type="button" onClick={() => setCapacity(cfg.capacity - 1)} disabled={cfg.capacity <= 1 || saving} aria-label="Menos">−</button>
              <span>{cfg.capacity}</span>
              <button type="button" onClick={() => setCapacity(cfg.capacity + 1)} disabled={saving} aria-label="Más">+</button>
            </div>
          </div>
        ) : (
          <div className="team-assign">
            <div className="team-cap-lbl" style={{ marginBottom: 10 }}>¿Cómo se elige con quién es el turno?</div>
            <div className="team-assign-list">
              {(Object.keys(ASSIGN_LABELS) as AssignmentMode[]).map(k => (
                <label key={k} className={`team-assign-opt${cfg.assignment === k ? ' sel' : ''}`}>
                  <input type="radio" name="assign" checked={cfg.assignment === k} onChange={() => setAssignment(k)} />
                  <div>
                    <div className="team-assign-t">{ASSIGN_LABELS[k].t}</div>
                    <div className="team-assign-d">{ASSIGN_LABELS[k].d}</div>
                  </div>
                </label>
              ))}
            </div>

            <label className="team-overlap">
              <input type="checkbox" checked={cfg.allow_overlap} onChange={e => setAllowOverlap(e.target.checked)} disabled={saving} />
              <div>
                <div className="team-assign-t">Permitir superponer turnos de una misma persona</div>
                <div className="team-assign-d">Por defecto, cada persona hace un solo turno por horario. Activalo si alguien puede atender a más de uno a la vez.</div>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* ── ABM de empleados ── */}
      <div className="card">
        <div className="card-h" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>Tu equipo</h3>
          <button className="btn" onClick={openAdd}>+ Agregar</button>
        </div>
        <div className="sub">
          {cfg.mode === 'simple'
            ? 'Podés cargar tu equipo igual, aunque des turnos por capacidad. Lo vas a necesitar si algún día pasás a turnos por empleado.'
            : 'Cargá a cada persona (o recurso) que atiende. Después definís qué hace y en qué horario.'}
        </div>

        {error && (
          <div className="onb-error" style={{ margin: '14px 0' }}>
            No pudimos cargar tu equipo. (Detalle: {error}){' '}
            <button className="link-btn" onClick={reload}>Reintentar</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>Cargando…</div>
        ) : employees.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="42" height="42">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            <p style={{ fontSize: 14, maxWidth: 340 }}>Todavía no cargaste a nadie. Sumá a la primera persona de tu equipo.</p>
            <button className="btn" onClick={openAdd}>+ Agregar</button>
          </div>
        ) : (
          <div className="team-grid">
            {employees.map(e => (
              <div key={e.id} className="team-card">
                <div className="team-av" style={{ background: e.color || 'var(--volt)' }}>
                  {e.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="team-info">
                  <div className="team-name">{e.name}</div>
                  {e.role && <div className="team-role">{e.role}</div>}
                  <div className="team-tags">
                    <span className="team-tag">
                      {e.does_all_services
                        ? 'Hace todo'
                        : `${(serviceMap[e.id]?.length ?? 0)} servicio${(serviceMap[e.id]?.length ?? 0) === 1 ? '' : 's'}`}
                    </span>
                    <span className="team-tag">{e.uses_business_hours ? 'Horario del negocio' : 'Horario propio'}</span>
                  </div>
                </div>
                <div className="team-actions">
                  <button onClick={() => openEdit(e)}>Editar</button>
                  <button className="danger" onClick={() => handleDelete(e)}>Borrar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen && (
        <EmployeeForm
          employee={editing}
          services={services}
          initialServiceIds={editing ? (serviceMap[editing.id] ?? []) : []}
          onClose={() => setFormOpen(false)}
          onSave={async (input, serviceIds) => {
            const emp = editing ? await updateEmployee(editing.id, input) : await addEmployee(input)
            // Si hace todo, no guardamos filas (se interpreta "todos los servicios").
            await setEmployeeServices(emp.id, input.does_all_services ? [] : serviceIds)
            setFormOpen(false)
          }}
        />
      )}
    </>
  )
}

/* ───────────── Alta / edición de empleado ───────────── */
function EmployeeForm({
  employee, services, initialServiceIds, onClose, onSave,
}: {
  employee: Employee | null
  services: Service[]
  initialServiceIds: string[]
  onClose: () => void
  onSave: (input: EmployeeInput, serviceIds: string[]) => Promise<void>
}) {
  const { business } = useBusinessContext()

  const [name, setName] = useState(employee?.name ?? '')
  const [role, setRole] = useState(employee?.role ?? '')
  const [color, setColor] = useState(employee?.color ?? EMP_COLORS[0])
  const [doesAll, setDoesAll] = useState(employee?.does_all_services ?? true)
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds)
  const [usesBiz, setUsesBiz] = useState(employee?.uses_business_hours ?? true)

  function toggleService(id: string) {
    setServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  // Punto de partida de los horarios propios: los del empleado si ya tenía, o
  // una copia de los del negocio para que arranque sobre algo conocido.
  const [schedule, setSchedule] = useState<Partial<Record<Day, DayHours>>>(
    () => (employee?.schedule && Object.keys(employee.schedule).length > 0)
      ? employee.schedule
      : { ...business.business_hours }
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function updateDay(day: Day, patch: Partial<DayHours>) {
    setSchedule(prev => ({ ...prev, [day]: { ...(prev[day] ?? business.business_hours[day]), ...patch } }))
  }

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('El nombre es obligatorio.')
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        role: role.trim() || null,
        color,
        does_all_services: doesAll,
        uses_business_hours: usesBiz,
        // Sólo guardamos horario propio si lo va a usar; si no, dejamos lo que haya.
        schedule: usesBiz ? (employee?.schedule ?? {}) : schedule,
      }, serviceIds)
    } catch (e) {
      setErr('No se pudo guardar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{employee ? 'Editar' : 'Agregar al equipo'}</h2>

        <div className="field">
          <label>Nombre *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Raúl / Dra. Gómez / Sillón 2" autoFocus />
        </div>

        <div className="field">
          <label>Rol o especialidad (opcional)</label>
          <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="Ej: Peluquero, Dermatóloga, Manicura" />
        </div>

        <div className="field">
          <label>Color en la agenda</label>
          <div className="team-color-row">
            {EMP_COLORS.map(c => (
              <button
                key={c} type="button"
                className={`team-color-dot${color === c ? ' sel' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <label className="svc-check" style={{ marginTop: 4 }}>
          <input type="checkbox" checked={doesAll} onChange={e => setDoesAll(e.target.checked)} />
          Hace todos los servicios
        </label>
        {!doesAll && (
          services.length === 0 ? (
            <div className="hint" style={{ marginTop: 8 }}>
              Todavía no cargaste servicios. Agregalos en la sección <b>Servicios</b> y después elegí cuáles hace.
            </div>
          ) : (
            <div className="team-svc-pick">
              <div className="hint" style={{ marginBottom: 8 }}>Elegí qué servicios hace:</div>
              <div className="team-svc-chips">
                {services.map(s => {
                  const on = serviceIds.includes(s.id)
                  return (
                    <button
                      key={s.id} type="button"
                      className={`team-svc-chip${on ? ' sel' : ''}`}
                      onClick={() => toggleService(s.id)}
                    >
                      <span className="team-svc-dot" style={{ background: serviceColor(s.name) }} />
                      {s.name}
                    </button>
                  )
                })}
              </div>
              {serviceIds.length === 0 && (
                <div className="hint" style={{ marginTop: 8, color: 'var(--amber)' }}>
                  Ojo: sin servicios elegidos, esta persona no va a poder tomar turnos.
                </div>
              )}
            </div>
          )
        )}

        <label className="svc-check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={usesBiz} onChange={e => setUsesBiz(e.target.checked)} />
          Trabaja en el mismo horario que el negocio
        </label>

        {!usesBiz && (
          <div className="onb-hours team-hours" style={{ marginTop: 14 }}>
            {DAYS.map(day => {
              const h = schedule[day] ?? business.business_hours[day]
              return (
                <div key={day} className="onb-day">
                  <div className="onb-day-left">
                    <label className="sw" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={h?.open ?? false} onChange={e => updateDay(day, { open: e.target.checked })} />
                      <span className="sl" />
                    </label>
                    <span className={`onb-day-name${h?.open ? '' : ' closed'}`}>{DAY_LABELS[day]}</span>
                  </div>
                  {h?.open ? (
                    <div className="onb-day-right">
                      <div className="onb-shift-row">
                        <input type="time" value={h.from} onChange={e => updateDay(day, { from: e.target.value })} />
                        <span className="onb-to-label">a</span>
                        <input type="time" value={h.to} onChange={e => updateDay(day, { to: e.target.value })} />
                        {!h.split && (
                          <button type="button" className="onb-split-btn" onClick={() => updateDay(day, { split: true })}>＋ turno</button>
                        )}
                      </div>
                      {h.split && (
                        <div className="onb-shift-row">
                          <input type="time" value={h.from2 ?? '17:00'} onChange={e => updateDay(day, { from2: e.target.value })} />
                          <span className="onb-to-label">a</span>
                          <input type="time" value={h.to2 ?? '21:00'} onChange={e => updateDay(day, { to2: e.target.value })} />
                          <button type="button" className="onb-remove-split-btn" onClick={() => updateDay(day, { split: false })} title="Quitar segundo turno">×</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="onb-closed-lbl">No trabaja</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" type="button" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : (employee ? 'Guardar cambios' : 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  )
}
