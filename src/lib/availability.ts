// =====================================================================
// Disponibilidad de turnos: capacidad, horarios y empleados.
// Lógica pura (sin React ni red) para poder testearla y, más adelante,
// replicarla en una RPC de Postgres que consuma el agente (la IA).
// =====================================================================
import type { Appointment } from '../hooks/useAppointments'
import type { Employee } from '../hooks/useEmployees'
import type { Day, DayHours } from '../context/BusinessContext'

// getDay() de JS: 0=domingo … 6=sábado → clave de business_hours
const JS_DAY_TO_KEY: Day[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export function dayKeyOf(dateStr: string): Day {
  const [y, m, d] = dateStr.split('-').map(Number)
  return JS_DAY_TO_KEY[new Date(y, m - 1, d).getDay()]
}

export const timeToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

const DEFAULT_DUR = 30

// Intervalos abiertos de un día (contempla turno cortado), en minutos.
export function intervalsFor(hours: DayHours | undefined): Array<[number, number]> {
  if (!hours || !hours.open) return []
  const res: Array<[number, number]> = [[timeToMin(hours.from), timeToMin(hours.to)]]
  if (hours.split && hours.from2 && hours.to2) res.push([timeToMin(hours.from2), timeToMin(hours.to2)])
  return res
}

// ¿El turno (start, dur) entra completo dentro de algún intervalo abierto?
export function fitsInHours(hours: DayHours | undefined, startMin: number, durMin: number): boolean {
  const end = startMin + (durMin || DEFAULT_DUR)
  return intervalsFor(hours).some(([a, b]) => startMin >= a && end <= b)
}

export function overlaps(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + (bDur || DEFAULT_DUR) && bStart < aStart + (aDur || DEFAULT_DUR)
}

// ── Empleados ──
export function employeeDoesService(emp: Employee, serviceMap: Record<string, string[]>, serviceId: string | null): boolean {
  if (emp.does_all_services) return true
  if (!serviceId) return false   // sin servicio de catálogo, sólo califican los que "hacen todo"
  return (serviceMap[emp.id] ?? []).includes(serviceId)
}

export function employeeHoursForDay(emp: Employee, businessHours: Record<Day, DayHours>, dayKey: Day): DayHours | undefined {
  return emp.uses_business_hours ? businessHours[dayKey] : emp.schedule?.[dayKey]
}

export function employeeWorksAt(emp: Employee, businessHours: Record<Day, DayHours>, dayKey: Day, startMin: number, durMin: number): boolean {
  return fitsInHours(employeeHoursForDay(emp, businessHours, dayKey), startMin, durMin)
}

export function employeeBusyAt(emp: Employee, appts: Appointment[], dayDate: string, startMin: number, durMin: number, excludeId?: string): boolean {
  return appts.some(a =>
    a.employee_id === emp.id && a.appt_date === dayDate && a.id !== excludeId &&
    overlaps(startMin, durMin, timeToMin(a.appt_time), a.duration_min ?? DEFAULT_DUR)
  )
}

// Estado de un empleado para un turno puntual.
// free = libre · busy = ocupado · off = no trabaja ese día/hora · cant = no hace ese servicio
export type EmpStatus = 'free' | 'busy' | 'off' | 'cant'

export interface SlotCtx {
  businessHours: Record<Day, DayHours>
  serviceMap: Record<string, string[]>
  appts: Appointment[]
  dayDate: string
  startMin: number
  durMin: number
  serviceId: string | null
  excludeId?: string
}

export function employeeStatus(emp: Employee, ctx: SlotCtx): EmpStatus {
  if (!employeeDoesService(emp, ctx.serviceMap, ctx.serviceId)) return 'cant'
  const dayKey = dayKeyOf(ctx.dayDate)
  if (!employeeWorksAt(emp, ctx.businessHours, dayKey, ctx.startMin, ctx.durMin)) return 'off'
  if (employeeBusyAt(emp, ctx.appts, ctx.dayDate, ctx.startMin, ctx.durMin, ctx.excludeId)) return 'busy'
  return 'free'
}

// Cuántos turnos solapan ese horario (para el modo capacidad simple).
export function overlapCount(appts: Appointment[], dayDate: string, startMin: number, durMin: number, excludeId?: string): number {
  return appts.filter(a =>
    a.appt_date === dayDate && a.id !== excludeId &&
    overlaps(startMin, durMin, timeToMin(a.appt_time), a.duration_min ?? DEFAULT_DUR)
  ).length
}

// ── Reparto en columnas (greedy) para dibujar turnos solapados sin encimarlos ──
export interface Laned { id: string; laneIndex: number }
export function packLanes(items: Array<{ id: string; startMin: number; endMin: number }>): { lanes: Record<string, number>; laneCount: number } {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const laneEnds: number[] = []   // fin del último turno en cada columna
  const lanes: Record<string, number> = {}
  for (const it of sorted) {
    let placed = false
    for (let i = 0; i < laneEnds.length; i++) {
      if (it.startMin >= laneEnds[i]) { lanes[it.id] = i; laneEnds[i] = it.endMin; placed = true; break }
    }
    if (!placed) { lanes[it.id] = laneEnds.length; laneEnds.push(it.endMin) }
  }
  return { lanes, laneCount: Math.max(1, laneEnds.length) }
}
