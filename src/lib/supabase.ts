import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase. Revisá tu archivo .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,       // Guarda la sesión en localStorage (default, pero explícito)
    autoRefreshToken: true,     // Refresca el JWT automáticamente (default, pero explícito)
    detectSessionInUrl: false,  // No usamos OAuth ni magic links; desactivar evita
                                // que cambios en la URL se interpreten como eventos de auth
  },
})
