import { useState } from 'react'
import { supabase } from '../lib/supabase'

function EyeIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="18" height="18">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
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

interface Props {
  onBack?: () => void
}

export default function Auth({ onBack }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(translateError(error.message))
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Ingresá tu email en el campo de arriba para recuperar tu contraseña.')
      return
    }
    setError('')
    setSuccess('')
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) setError(translateForgotError(error.message))
    else setSuccess('Te mandamos un email con el link para recuperar tu contraseña. Revisá tu casilla.')
    setForgotLoading(false)
  }

  return (
    <div className="auth-mesh">

      {onBack && (
        <button type="button" className="auth-back" onClick={onBack}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
      )}

      <div className="auth-col">

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          <div className="brand-logo" style={{
            width: '88px', height: '88px', borderRadius: '24px',
            boxShadow: '0 18px 34px rgba(91,33,182,.55)',
          }}>
            <svg viewBox="5 3 28 32" fill="none" style={{ width: '70px', height: '70px' }}>
              <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
              <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
            </svg>
          </div>
          <h1 style={{ fontSize: '30px', letterSpacing: '0.14em', color: '#fff', marginTop: '16px' }}>B.O.L.T.Y</h1>
          <p style={{ color: 'rgba(255,255,255,.76)', fontSize: '12.5px', letterSpacing: '0.01em', marginTop: '8px' }}>
            <b style={{ color: '#fff' }}>B</b>usiness <b style={{ color: '#fff' }}>O</b>nline <b style={{ color: '#fff' }}>L</b>ive <b style={{ color: '#fff' }}>T</b>echnology for <b style={{ color: '#fff' }}>Y</b>ou
          </p>
          <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', marginTop: '10px' }}>
            Iniciá sesión para acceder a tu panel
          </p>
        </div>

        <div className="auth-card">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email" placeholder="tu@email.com" required
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="field" style={{ marginBottom: 6 }}>
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required minLength={6}
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-faint)', padding: '4px', display: 'flex',
                    alignItems: 'center', lineHeight: 0,
                  }}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                style={{
                  background: 'none', border: 'none', color: 'var(--volt)',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  padding: 0, fontFamily: 'inherit',
                }}
              >
                {forgotLoading ? 'Enviando…' : '¿Olvidaste tu contraseña?'}
              </button>
            </div>

            {error && (
              <div style={{
                background: 'var(--rose-wash)', color: 'var(--rose)', padding: '11px 14px',
                borderRadius: '10px', fontSize: '13.5px', marginBottom: '16px',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  width="16" height="16" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'var(--mint-wash)', color: '#018a66', padding: '11px 14px',
                borderRadius: '10px', fontSize: '13.5px', marginBottom: '16px',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  width="16" height="16" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
                {success}
              </div>
            )}

            <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Cargando…' : 'Entrar'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

function translateForgotError(msg: string): string {
  if (msg.includes('rate limit')) return 'Enviaste demasiados emails seguidos. Esperá unos minutos e intentá de nuevo.'
  if (msg.includes('Invalid email') || msg.includes('valid email')) return 'El formato del email no es válido.'
  return 'No pudimos enviar el email. Intentá de nuevo en unos minutos.'
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials'))   return 'Email o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))          return 'Confirmá tu email antes de entrar. Revisá tu casilla.'
  if (msg.includes('too many requests') || msg.includes('security purposes'))
                                                    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
  if (msg.includes('network') || msg.includes('fetch'))
                                                    return 'Error de conexión. Verificá tu internet.'
  return 'Ocurrió un error inesperado. Intentá de nuevo.'
}
