import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'
import type { Day, DayHours } from '../context/BusinessContext'

export interface Employee {
  id: string
  user_id?: string
  name: string
  role: string | null
  color: string | null
  // Horarios propios (mismo shape que business_hours). Si uses_business_hours
  // es true se ignora y valen los horarios del negocio.
  schedule: Partial<Record<Day, DayHours>>
  uses_business_hours: boolean
  does_all_services: boolean
  active: boolean
  created_at?: string
}

export interface EmployeeInput {
  name: string
  role?: string | null
  color?: string | null
  schedule?: Partial<Record<Day, DayHours>>
  uses_business_hours?: boolean
  does_all_services?: boolean
  active?: boolean
}

/**
 * Maneja el equipo (empleados / recursos) del cliente logueado.
 * La seguridad la garantiza RLS (cada cliente sólo ve y toca lo suyo).
 */
export function useEmployees() {
  const userId = useEffectiveUserId()

  const [employees, setEmployees] = useState<Employee[]>([])
  // Qué servicios hace cada empleado: { employeeId: [serviceId, …] }.
  // Sólo aplica cuando does_all_services es false (si no, hace todo y no hay filas).
  const [serviceMap, setServiceMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [empRes, esRes] = await Promise.all([
      supabase.from('employees').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('employee_services').select('employee_id, service_id').eq('user_id', userId),
    ])
    if (empRes.error) {
      console.error('[Bolty] load employees:', empRes.error.message)
      setError(empRes.error.message)
    } else {
      setEmployees((empRes.data ?? []) as Employee[])
      setError(null)
    }
    if (esRes.error) {
      console.error('[Bolty] load employee_services:', esRes.error.message)
    } else {
      const m: Record<string, string[]> = {}
      ;(esRes.data ?? []).forEach(r => { (m[r.employee_id] ??= []).push(r.service_id) })
      setServiceMap(m)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addEmployee = useCallback(async (input: EmployeeInput): Promise<Employee> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('employees')
      .insert({ ...input, user_id: userId })
      .select()
      .single()
    if (error) throw error
    setEmployees(prev => [...prev, data as Employee])
    return data as Employee
  }, [userId])

  const updateEmployee = useCallback(async (id: string, patch: Partial<EmployeeInput>): Promise<Employee> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('employees')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setEmployees(prev => prev.map(e => (e.id === id ? (data as Employee) : e)))
    return data as Employee
  }, [userId])

  const deleteEmployee = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) throw error
    setEmployees(prev => prev.filter(e => e.id !== id))
    setServiceMap(prev => { const m = { ...prev }; delete m[id]; return m })  // el cascade ya borró las filas en la base
  }, [])

  // Define qué servicios hace un empleado. Sincroniza por borrado + inserción
  // (simple y confiable para el volumen chico de servicios de un negocio).
  const setEmployeeServices = useCallback(async (employeeId: string, serviceIds: string[]): Promise<void> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { error: delErr } = await supabase.from('employee_services').delete().eq('employee_id', employeeId)
    if (delErr) throw delErr
    if (serviceIds.length > 0) {
      const payload = serviceIds.map(service_id => ({ user_id: userId, employee_id: employeeId, service_id }))
      const { error: insErr } = await supabase.from('employee_services').insert(payload)
      if (insErr) throw insErr
    }
    setServiceMap(prev => ({ ...prev, [employeeId]: serviceIds }))
  }, [userId])

  return {
    employees, serviceMap, loading, error, reload: load,
    addEmployee, updateEmployee, deleteEmployee, setEmployeeServices,
  }
}
