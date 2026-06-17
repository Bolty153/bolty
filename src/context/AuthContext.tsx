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

    // Carga inicial: obtiene la sesión desde localStorage y carga el perfil.
    // Todo lo que ocurre después (refreshes automáticos) se maneja en onAuthStateChange.
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        // init() ya resolvió el estado inicial; ignoramos esta notificación duplicada.
        if (event === 'INITIAL_SESSION') return
        if (cancelled) return

        if (event === 'TOKEN_REFRESHED') {
          // El cliente refrescó el JWT automáticamente (pasa cada ~1 hora o al volver
          // al tab). Solo actualizamos el objeto de sesión con el nuevo access token.
          // No mostramos spinner ni volvemos a pedir el perfil — eso causaba el bug
          // de "sesión cerrada" al cambiar de pestaña.
          setSession(sess)
          return
        }

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setLoading(false)
          return
        }

        // SIGNED_IN, USER_UPDATED, PASSWORD_RECOVERY, etc.
        // Usamos setLoading(true) mientras buscamos el perfil para que la UI
        // muestre el spinner en vez de mostrar <AccessDenied> durante el await.
        setLoading(true)
        setSession(sess)
        if (sess) {
          const p = await fetchProfile(sess.user.id)
          if (!cancelled) {
            setProfile(p)
            setLoading(false)
          }
        } else {
          setProfile(null)
          setLoading(false)
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
