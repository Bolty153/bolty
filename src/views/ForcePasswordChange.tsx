import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function EyeIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function ForcePasswordChange({ mode = 'forced' }: { mode?: 'forced' | 'recovery' }) {
  const { refreshProfile, signOut, clearRecovery } = useAuth()
  const isRecovery = mode === 'recovery'
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pass.length < 8) { setError('La contraseña tiene que tener al menos 8 caracteres.'); return }
    if (pass !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setSaving(true)
    // 1) Cambiamos la contraseña en Supabase Auth
    const { error: passErr } = await supabase.auth.updateUser({ password: pass })
    if (passErr) {
      setError(traducir(passErr.message))
      setSaving(false)
      return
    }

    if (isRecovery) {
      // Recuperación: ya está, salimos del modo recuperación y seguimos normal.
      clearRecovery()
      await refreshProfile()
      return
    }

    // 2) (Primer ingreso) Apagamos el flag must_change_password con una función
    //    segura (el cliente no puede editar su fila de profiles por RLS).
    const { error: rpcErr } = await supabase.rpc('clear_must_change_password')
    if (rpcErr) {
      setError('Cambiamos tu contraseña, pero no pudimos finalizar. Recargá la página e intentá de nuevo.')
      setSaving(false)
      return
    }

    // 3) Refrescamos el perfil → la app sigue sola al onboarding o al dashboard.
    await refreshProfile()
  }

  return (
    <div className="auth-mesh">
      <button type="button" className="auth-back" onClick={signOut}>
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
        Cerrar sesión
      </button>

      <div className="auth-col">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 24 }}>
          <div className="brand-logo" style={{ width: 72, height: 72, borderRadius: 20, boxShadow: '0 16px 30px rgba(91,33,182,.55)' }}>
            <svg viewBox="5 3 28 32" fill="none" style={{ width: 56, height: 56 }}>
              <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
              <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, color: '#fff', marginTop: 16 }}>{isRecovery ? 'Restablecé tu contraseña' : 'Creá tu contraseña'}</h1>
          <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13.5, marginTop: 10, maxWidth: 320, lineHeight: 1.6 }}>
            {isRecovery
              ? 'Elegí una contraseña nueva para tu cuenta de Bolty.'
              : 'Entraste con una contraseña temporal. Por seguridad, elegí una contraseña nueva y privada para usar tu panel.'}
          </p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Nueva contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="Mínimo 8 caracteres" required minLength={8}
                  style={{ paddingRight: 44 }} autoFocus
                />
                <button type="button" onClick={() => setShow(s => !s)} title={show ? 'Ocultar' : 'Mostrar'}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'flex', lineHeight: 0 }}>
                  {show ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="hint">Mínimo 8 caracteres.</div>
            </div>

            <div className="field">
              <label>Repetí la contraseña</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Volvé a escribirla" required minLength={8}
              />
            </div>

            {error && (
              <div style={{ background: 'var(--rose-wash)', color: 'var(--rose)', padding: '11px 14px', borderRadius: 10, fontSize: 13.5, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button className="btn" type="submit" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Guardando…' : 'Guardar y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function traducir(msg: string): string {
  if (msg.includes('different from the old')) return 'La contraseña nueva tiene que ser distinta a la temporal.'
  if (msg.includes('at least')) return 'La contraseña es demasiado corta.'
  if (msg.includes('network') || msg.includes('fetch')) return 'Error de conexión. Verificá tu internet.'
  return 'No se pudo guardar la contraseña. Intentá de nuevo.'
}
