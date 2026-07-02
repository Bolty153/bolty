import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEffectiveUserId } from '../context/AuthContext'

export interface Service {
  id: string
  user_id?: string
  name: string
  price: number
  price_on_request: boolean
  duration_min: number | null
  category: string | null
  description: string | null
  image_url: string | null
  created_at?: string
}

export interface ServiceInput {
  name: string
  price: number
  price_on_request: boolean
  duration_min?: number | null
  category?: string | null
  description?: string | null
  image_url?: string | null
}

/**
 * Maneja los servicios del cliente logueado (peluquerías, consultorios, etc.).
 * A diferencia de productos, los servicios NO tienen stock.
 * La seguridad real la garantiza RLS (cada cliente sólo ve y toca lo suyo).
 */
export function useServices() {
  const userId = useEffectiveUserId()

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Bolty] load services:', error.message)
      setError(error.message)
    } else {
      setServices(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) load()
  }, [userId, load])

  const addService = useCallback(async (input: ServiceInput): Promise<Service> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('services')
      .insert({ ...input, user_id: userId })
      .select()
      .single()
    if (error) throw error
    setServices(prev => [data as Service, ...prev])
    return data as Service
  }, [userId])

  const updateService = useCallback(async (id: string, patch: Partial<ServiceInput>): Promise<Service> => {
    if (!userId) throw new Error('No hay sesión activa')
    const { data, error } = await supabase
      .from('services')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setServices(prev => prev.map(s => (s.id === id ? (data as Service) : s)))
    return data as Service
  }, [userId])

  const deleteService = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) throw error
    setServices(prev => prev.filter(s => s.id !== id))
  }, [])

  const importServices = useCallback(async (rows: ServiceInput[]): Promise<number> => {
    if (!userId) throw new Error('No hay sesión activa')
    if (rows.length === 0) return 0
    const payload = rows.map(r => ({ ...r, user_id: userId }))
    const { data, error } = await supabase.from('services').insert(payload).select()
    if (error) throw error
    setServices(prev => [...((data as Service[]) ?? []), ...prev])
    return data?.length ?? 0
  }, [userId])

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) return null
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('servicios').upload(path, file, { upsert: true })
    if (error) {
      console.error('[Bolty] upload servicios:', error.message)
      throw error
    }
    const { data } = supabase.storage.from('servicios').getPublicUrl(path)
    return data.publicUrl
  }, [userId])

  return {
    services,
    loading,
    error,
    reload: load,
    addService,
    updateService,
    deleteService,
    importServices,
    uploadImage,
  }
}

// "90" -> "1 h 30 min", "30" -> "30 min", null -> ""
export function fmtDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
