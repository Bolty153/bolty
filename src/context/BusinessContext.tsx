import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface DayHours {
  open: boolean
  from: string
  to: string
  split?: boolean   // segundo turno activo
  from2?: string    // inicio segundo turno
  to2?: string      // fin segundo turno
}

export const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const
export type Day = typeof DAYS[number]

export const DAY_LABELS: Record<Day, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}

const DEFAULT_HOURS: Record<Day, DayHours> = {
  lunes:     { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  martes:    { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  miercoles: { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  jueves:    { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  viernes:   { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  sabado:    { open: true,  from: '09:00', to: '13:00', split: false, from2: '17:00', to2: '21:00' },
  domingo:   { open: false, from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
}

export interface BusinessProfile {
  id?: string
  user_id?: string
  business_name: string
  industry: string
  description: string
  address: string
  phone: string
  logo_url: string | null
  business_hours: Record<Day, DayHours>
  onboarding_complete: boolean
  plan: string
}

export interface AgentConfig {
  id?: string
  user_id?: string
  agent_name: string
  tone: string
  business_type: string
  instructions: string
  features_enabled: Record<string, boolean>
}

const DEFAULT_BUSINESS: BusinessProfile = {
  business_name: '',
  industry: '',
  description: '',
  address: '',
  phone: '',
  logo_url: null,
  business_hours: DEFAULT_HOURS,
  onboarding_complete: false,
  plan: 'basico',
}

const DEFAULT_AGENT: AgentConfig = {
  agent_name: 'Bolty',
  tone: 'Cercano',
  business_type: 'Productos y servicios',
  instructions: '',
  features_enabled: {},
}

/**
 * A partir del tipo de negocio define qué secciones ve el cliente.
 * Tolera valores viejos ("Productos y turnos", "Solo servicios con turno")
 * y los nuevos ("Productos y servicios", "Solo servicios").
 */
export function getBusinessFlags(businessType: string | undefined) {
  const t = (businessType || '').toLowerCase()
  const onlyProducts = t.includes('solo producto')
  const onlyServices = t.includes('solo servicio')
  return {
    products: !onlyServices,       // ve Productos salvo que sea "solo servicios"
    services: !onlyProducts,       // ve Servicios salvo que sea "solo productos"
    agenda: !onlyProducts,         // la Agenda aplica a negocios con servicios/turnos
  }
}

interface BusinessContextType {
  business: BusinessProfile
  agent: AgentConfig
  loading: boolean
  saving: boolean
  saveBusiness: (data: Partial<BusinessProfile>) => Promise<void>
  saveAgent: (data: Partial<AgentConfig>) => Promise<void>
  completeOnboarding: (businessData: Partial<BusinessProfile>, agentData: Partial<AgentConfig>) => Promise<void>
  uploadLogo: (file: File) => Promise<string | null>
}

const BusinessContext = createContext<BusinessContextType>({
  business: DEFAULT_BUSINESS,
  agent: DEFAULT_AGENT,
  loading: true,
  saving: false,
  saveBusiness: async () => {},
  saveAgent: async () => {},
  completeOnboarding: async () => {},
  uploadLogo: async () => null,
})

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [business, setBusiness] = useState<BusinessProfile>(DEFAULT_BUSINESS)
  const [agent, setAgent] = useState<AgentConfig>(DEFAULT_AGENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dependemos solo del user ID, no del objeto session entero.
  // Cuando TOKEN_REFRESHED crea un nuevo objeto session (mismo usuario, distinto token),
  // el user ID no cambia → load() no se re-ejecuta → no hay spinner innecesario.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    load()
  }, [userId])

  async function load() {
    setLoading(true)
    try {
      const uid = session!.user.id

      const [bpRes, acRes] = await Promise.all([
        supabase.from('business_profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('agent_configs').select('*').eq('user_id', uid).maybeSingle(),
      ])

      if (bpRes.error) console.error('[Bolty] load business_profiles:', bpRes.error.message)
      if (acRes.error) console.error('[Bolty] load agent_configs:', acRes.error.message)

      if (bpRes.data) {
        setBusiness({
          ...DEFAULT_BUSINESS,
          ...bpRes.data,
          business_hours: bpRes.data.business_hours ?? DEFAULT_HOURS,
        })
      }
      if (acRes.data) {
        setAgent({ ...DEFAULT_AGENT, ...acRes.data })
      }
    } catch (e) {
      console.error('[Bolty] load error:', e)
    } finally {
      setLoading(false)
    }
  }

  const saveBusiness = useCallback(async (data: Partial<BusinessProfile>) => {
    if (!session) throw new Error('No hay sesión activa')
    setSaving(true)
    const uid = session.user.id
    const updated = { ...business, ...data }
    try {
      // .select().single() nos devuelve la fila persistida: así confirmamos que
      // realmente se guardó (y no quedamos con un estado optimista que miente).
      const { data: row, error } = await supabase
        .from('business_profiles')
        .upsert({ ...updated, user_id: uid }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      setBusiness({ ...DEFAULT_BUSINESS, ...row, business_hours: row.business_hours ?? DEFAULT_HOURS })
    } catch (e) {
      console.error('[Bolty] saveBusiness:', (e as Error).message)
      throw e
    } finally {
      setSaving(false)
    }
  }, [business, session])

  const saveAgent = useCallback(async (data: Partial<AgentConfig>) => {
    if (!session) throw new Error('No hay sesión activa')
    setSaving(true)
    const uid = session.user.id
    const updated = { ...agent, ...data }
    try {
      const { data: row, error } = await supabase
        .from('agent_configs')
        .upsert({ ...updated, user_id: uid }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      setAgent({ ...DEFAULT_AGENT, ...row })
    } catch (e) {
      console.error('[Bolty] saveAgent:', (e as Error).message)
      throw e
    } finally {
      setSaving(false)
    }
  }, [agent, session])

  const completeOnboarding = useCallback(async (
    businessData: Partial<BusinessProfile>,
    agentData: Partial<AgentConfig>,
  ) => {
    if (!session) throw new Error('No hay sesión activa')
    setSaving(true)
    const uid = session.user.id
    const bpPayload = { ...business, ...businessData, onboarding_complete: true, user_id: uid }
    const acPayload = { ...agent, ...agentData, user_id: uid }
    try {
      // Escribimos PRIMERO y verificamos el resultado. Solo si ambos guardados
      // funcionan marcamos el onboarding como completo en el estado local
      // (que es lo que hace que la app pase al dashboard). Si falla, lanzamos
      // el error para que la pantalla de onboarding lo muestre y no avance.
      const [bpRes, acRes] = await Promise.all([
        supabase.from('business_profiles').upsert(bpPayload, { onConflict: 'user_id' }).select().single(),
        supabase.from('agent_configs').upsert(acPayload, { onConflict: 'user_id' }).select().single(),
      ])
      if (bpRes.error) throw bpRes.error
      if (acRes.error) throw acRes.error
      setBusiness({ ...DEFAULT_BUSINESS, ...bpRes.data, business_hours: bpRes.data.business_hours ?? DEFAULT_HOURS })
      setAgent({ ...DEFAULT_AGENT, ...acRes.data })
    } catch (e) {
      console.error('[Bolty] completeOnboarding:', (e as Error).message)
      throw e
    } finally {
      setSaving(false)
    }
  }, [business, agent, session])

  const uploadLogo = useCallback(async (file: File): Promise<string | null> => {
    if (!session) return null
    const uid = session.user.id
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${uid}/logo.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) {
      console.error('[Bolty] uploadLogo:', error.message)
      return null
    }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    return data.publicUrl
  }, [session])

  return (
    <BusinessContext.Provider value={{ business, agent, loading, saving, saveBusiness, saveAgent, completeOnboarding, uploadLogo }}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusinessContext() {
  return useContext(BusinessContext)
}
