import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface Appointment {
  id: string
  user_id?: string
  customer_name: string
  service_name: string | null
  appt_date: string   // 'YYYY-MM-DD'
  appt_time: string   // 'HH:MM'
  duration_min: number | null
  price: number | null
  phone: string | null
  notes: string | null
  status: string
  source: string
  paid: boolean
  created_at?: string
}

export interface AppointmentInput {
  customer_name: string
  service_name?: string | null
  appt_date: string
  appt_time: string
  duration_min?: number | null
  price?: number | null
  phone?: string | null
  notes?: string | null
  status?: string
  source?: string
  paid?: boolean
}

/**
 * Maneja los turnos del cliente logueado. La seguridad la garantiza RLS
 * (cada cliente sólo ve y toca SUS turnos).
 */
export function useAppointments() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .order('appt_date', { ascending: true })
      .order('appt_time', { ascending: true })
    if (error) {
      console.error('[Bolty] load appointments:', error.message)
      setError(error.message)
    } else {
      setAppointments(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addAppointment = useCallback(async (input: AppointmentInput): Promise<Appointment> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('appointments')
      .insert({ ...input, user_id: userId })
      .select()
      .single()
    if (error) throw error
    setAppointments(prev => [...prev, data as Appointment])
    return data as Appointment
  }, [userId])

  const updateAppointment = useCallback(async (id: string, patch: Partial<AppointmentInput>): Promise<Appointment> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setAppointments(prev => prev.map(a => (a.id === id ? (data as Appointment) : a)))
    return data as Appointment
  }, [userId])

  const deleteAppointment = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (error) throw error
    setAppointments(prev => prev.filter(a => a.id !== id))
  }, [])

  return { appointments, loading, error, reload: load, addAppointment, updateAppointment, deleteAppointment }
}
