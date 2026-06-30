import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  is_active: boolean
  is_admin: boolean
  must_change_password: boolean
}

interface AuthContextType {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recovery: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearRecovery: () => void
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  loading: true,
  recovery: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  clearRecovery: () => {},
})

// ¿Veníamos de un link de "recuperar contraseña"? (token en el hash de la URL)
const HAS_RECOVERY_HASH = typeof window !== 'undefined' && window.location.hash.toLowerCase().includes('type=recovery')

async function fetchProfile(userId: string): Promise<Profile | null> {
  // Pedimos must_change_password; si la columna todavía no se creó en Supabase,
  // hacemos un fallback para no romper el login.
  let res = await supabase
    .from('profiles')
    .select('is_active, is_admin, must_change_password')
    .eq('id', userId)
    .maybeSingle()

  if (res.error && res.error.message.includes('must_change_password')) {
    res = await supabase.from('profiles').select('is_active, is_admin').eq('id', userId).maybeSingle()
  }

  if (res.error) console.error('[Bolty] fetchProfile error:', res.error.message)
  const d = res.data as { is_active: boolean; is_admin: boolean; must_change_password?: boolean } | null
  if (!d) return null
  return { is_active: d.is_active, is_admin: d.is_admin, must_change_password: d.must_change_password ?? false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(HAS_RECOVERY_HASH)

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

        if (event === 'PASSWORD_RECOVERY') {
          // El usuario llegó desde el link de recuperación: tiene sesión, pero
          // lo mandamos a poner una contraseña nueva antes de usar el panel.
          setSession(sess)
          setRecovery(true)
          if (sess) { const p = await fetchProfile(sess.user.id); if (!cancelled) setProfile(p) }
          if (!cancelled) setLoading(false)
          return
        }

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setProfile(null)
          setRecovery(false)
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

  // Re-lee el perfil del usuario actual (ej. después de cambiar la contraseña).
  async function refreshProfile() {
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return
    const p = await fetchProfile(uid)
    setProfile(p)
  }

  function clearRecovery() { setRecovery(false) }

  return (
    <AuthContext.Provider value={{ session, profile, loading, recovery, signOut, refreshProfile, clearRecovery }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
