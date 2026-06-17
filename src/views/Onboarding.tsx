import { useState, useRef } from 'react'
import { DAYS, DAY_LABELS, useBusinessContext } from '../context/BusinessContext'
import type { Day, DayHours } from '../context/BusinessContext'
import { useAuth } from '../context/AuthContext'

const TONES = ['Formal', 'Cercano', 'Divertido', 'Con modismos argentinos']

const DEFAULT_HOURS: Record<Day, DayHours> = {
  lunes:     { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  martes:    { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  miercoles: { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  jueves:    { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  viernes:   { open: true,  from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
  sabado:    { open: true,  from: '09:00', to: '13:00', split: false, from2: '17:00', to2: '21:00' },
  domingo:   { open: false, from: '09:00', to: '18:00', split: false, from2: '17:00', to2: '21:00' },
}

export default function Onboarding() {
  const { completeOnboarding, uploadLogo, saving } = useBusinessContext()
  const { signOut } = useAuth()
  const [step, setStep] = useState(1)

  // Paso 1 – datos del negocio
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Paso 2 – horarios
  const [hours, setHours] = useState<Record<Day, DayHours>>(DEFAULT_HOURS)
  const [copiedDay, setCopiedDay] = useState<Day | null>(null)

  // Paso 3 – agente
  const [agentName, setAgentName] = useState('Bolty')
  const [tone, setTone] = useState('Cercano')
  const [instructions, setInstructions] = useState('')

  const [error, setError] = useState<string | null>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function updateDay(day: Day, patch: Partial<DayHours>) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  function copyToAll(day: Day) {
    const src = hours[day]
    setHours(prev => {
      const next = { ...prev }
      DAYS.forEach(d => {
        if (d !== day) {
          next[d] = { ...prev[d], from: src.from, to: src.to, split: src.split, from2: src.from2, to2: src.to2 }
        }
      })
      return next
    })
    setCopiedDay(day)
    setTimeout(() => setCopiedDay(null), 2000)
  }

  async function handleFinish() {
    setError(null)
    try {
      let logoUrl: string | null = null
      if (logoFile) logoUrl = await uploadLogo(logoFile)
      await completeOnboarding(
        { business_name: businessName, industry, description, address, phone, logo_url: logoUrl, business_hours: hours },
        { agent_name: agentName, tone, instructions },
      )
      // Si llega acá, se guardó OK: la app pasa sola al dashboard.
    } catch (e) {
      setError(
        'No pudimos guardar tus datos. Revisá tu conexión e intentá de nuevo. ' +
        'Si el problema sigue, avisanos. (Detalle: ' + (e as Error).message + ')'
      )
    }
  }

  return (
    <div className="onb-shell">
      <div className="onb-topbar">
        <div className="onb-logo-mark">
          <svg viewBox="5 3 28 32" fill="none" width="26" height="26">
            <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#6029ff">B</text>
            <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
          </svg>
          <span>Bolty</span>
        </div>
        <button type="button" className="onb-signout-btn" onClick={signOut}>
          Cerrar sesión
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="onb-progress">
        <div className="onb-progress-line" />
        {(['Tu negocio', 'Horarios', 'Tu agente'] as const).map((label, idx) => {
          const n = idx + 1
          return (
            <div key={n} className={`onb-step${step > n ? ' done' : ''}${step === n ? ' active' : ''}`}>
              <div className="onb-step-dot">{step > n ? '✓' : n}</div>
              <span>{label}</span>
            </div>
          )
        })}
      </div>

      <div className="onb-card">

        {/* ── PASO 1 ── */}
        {step === 1 && (
          <>
            <h2>Contanos sobre tu negocio</h2>
            <p className="onb-sub">
              Esta información la usa Bolty para presentar tu negocio y atender a tus clientes como si fuera vos.
            </p>

            <div className="onb-logo-row">
              <div className="onb-logo-preview" onClick={() => fileRef.current?.click()}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" />
                  : <span>＋<br />Logo</span>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
              <div>
                <div className="onb-logo-hint">Logo de tu negocio (opcional)</div>
                <button className="onb-upload-btn" type="button" onClick={() => fileRef.current?.click()}>Subir imagen</button>
              </div>
            </div>

            <div className="field">
              <label>Nombre del negocio *</label>
              <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Ej: Veterinaria Centro" autoFocus />
            </div>
            <div className="field">
              <label>Rubro o a qué te dedicás</label>
              <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Ej: Veterinaria, Peluquería, Ferretería…" />
            </div>
            <div className="field">
              <label>Descripción corta</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Atendemos mascotas desde hace 10 años." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="field">
                <label>Dirección o zona</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Av. Corrientes 1234, CABA" />
              </div>
              <div className="field">
                <label>Teléfono de contacto</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 11 4567-8900" />
              </div>
            </div>

            <div className="onb-actions">
              <button className="btn" disabled={!businessName.trim()} onClick={() => setStep(2)}>Continuar →</button>
            </div>
          </>
        )}

        {/* ── PASO 2 ── */}
        {step === 2 && (
          <>
            <h2>¿Cuándo atendés?</h2>
            <p className="onb-sub">
              Podés poner horario corrido o cortado (dos turnos por día). Todo se puede editar después.
            </p>

            <div className="onb-hours">
              {DAYS.map(day => {
                const h = hours[day]
                return (
                  <div key={day} className="onb-day">
                    <div className="onb-day-left">
                      <label className="sw" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={h.open} onChange={e => updateDay(day, { open: e.target.checked })} />
                        <span className="sl" />
                      </label>
                      <span className={`onb-day-name${h.open ? '' : ' closed'}`}>{DAY_LABELS[day]}</span>
                    </div>

                    {h.open ? (
                      <div className="onb-day-right">
                        {/* Primer turno */}
                        <div className="onb-shift-row">
                          <input type="time" value={h.from} onChange={e => updateDay(day, { from: e.target.value })} />
                          <span className="onb-to-label">a</span>
                          <input type="time" value={h.to} onChange={e => updateDay(day, { to: e.target.value })} />
                          {!h.split && (
                            <button type="button" className="onb-split-btn" onClick={() => updateDay(day, { split: true })}>
                              ＋ turno
                            </button>
                          )}
                        </div>
                        {/* Segundo turno */}
                        {h.split && (
                          <div className="onb-shift-row">
                            <input type="time" value={h.from2 ?? '17:00'} onChange={e => updateDay(day, { from2: e.target.value })} />
                            <span className="onb-to-label">a</span>
                            <input type="time" value={h.to2 ?? '21:00'} onChange={e => updateDay(day, { to2: e.target.value })} />
                            <button type="button" className="onb-remove-split-btn" onClick={() => updateDay(day, { split: false })} title="Quitar segundo turno">×</button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="onb-copy-all-btn"
                          onClick={() => copyToAll(day)}
                        >
                          {copiedDay === day ? '✓ Aplicado' : 'Aplicar a todos'}
                        </button>
                      </div>
                    ) : (
                      <span className="onb-closed-lbl">Cerrado</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="onb-actions" style={{ justifyContent: 'space-between' }}>
              <button className="onb-back-btn" type="button" onClick={() => setStep(1)}>← Volver</button>
              <button className="btn" onClick={() => setStep(3)}>Continuar →</button>
            </div>
          </>
        )}

        {/* ── PASO 3 ── */}
        {step === 3 && (
          <>
            <h2>Tu agente de IA</h2>
            <p className="onb-sub">Dale un nombre y personalidad. Todo esto lo podés cambiar después desde "Mi agente".</p>

            <div className="field">
              <label>Nombre del agente</label>
              <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Ej: Bolty, Luna, Max…" />
              <div className="hint">Así se va a presentar con tus clientes</div>
            </div>

            <div className="field">
              <label>Tono de conversación</label>
              <div className="chips">
                {TONES.map(t => (
                  <div key={t} className={`chip${tone === t ? ' sel' : ''}`} onClick={() => setTone(t)}>{t}</div>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Instrucciones especiales (opcional)</label>
              <textarea
                rows={4} value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder={'Escribile indicaciones como a un empleado nuevo.\n\nEj: "Si preguntan por urgencias fuera de horario, decí que atendemos guardia los sábados hasta las 18h."'}
              />
              <div className="hint">Podés dejarlo vacío por ahora y completarlo después.</div>
            </div>

            {error && (
              <div className="onb-error" role="alert">{error}</div>
            )}

            <div className="onb-actions" style={{ justifyContent: 'space-between' }}>
              <button className="onb-back-btn" type="button" onClick={() => setStep(2)}>← Volver</button>
              <button className="btn" disabled={saving} onClick={handleFinish}>
                {saving ? 'Guardando…' : '¡Listo, empecemos! →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
