import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  is_active: boolean
  is_admin: boolean
}

interface AuthContextType {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_active, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error) console.error('[Bolty] fetchProfile error:', error.message)
  return data ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Carga inicial: primero sesión, después perfil, en secuencia.
    // Así el cliente de Supabase ya tiene el JWT listo cuando hacemos la query.
    async function init() {
      const { data } = await supabase.auth.getSession()
      const sess = data.session
      if (cancelled) return

      setSession(sess)

      if (sess) {
        const p = await fetchProfile(sess.user.id)
        if (!cancelled) setProfile(p)
      }

      if (!cancelled) setLoading(false)
    }

    init()

    // Cambios posteriores (login / logout).
    // Saltamos INITIAL_SESSION porque ya lo maneja init() arriba.
    // Sin este skip, onAuthStateChange pisaba el resultado de init() con null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (event === 'INITIAL_SESSION') return

        if (cancelled) return
        setSession(sess)

        if (sess) {
          setLoading(true)
          const p = await fetchProfile(sess.user.id)
          if (!cancelled) {
            setProfile(p)
            setLoading(false)
          }
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
