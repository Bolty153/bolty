import { useState, useEffect, useRef } from 'react'
import { DAYS, DAY_LABELS, useBusinessContext } from '../context/BusinessContext'
import type { Day, DayHours } from '../context/BusinessContext'
import type { ViewId } from '../App'
import { initPhone, cleanPhone } from '../lib/phone'

interface Props {
  onNavigate: (view: ViewId) => void
}

export default function MiNegocio({ onNavigate }: Props) {
  const { business, saving, saveBusiness, uploadLogo, loading } = useBusinessContext()
  const [local, setLocal] = useState(business)
  const [initialized, setInitialized] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedDay, setCopiedDay] = useState<Day | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !initialized) {
      setLocal({ ...business, phone: initPhone(business.phone) })
      setInitialized(true)
    }
  }, [loading, business, initialized])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function updateDay(day: Day, patch: Partial<DayHours>) {
    setLocal(prev => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [day]: { ...prev.business_hours[day], ...patch },
      },
    }))
  }

  function copyToAll(day: Day) {
    const src = local.business_hours[day]
    setLocal(prev => {
      const next = { ...prev.business_hours }
      DAYS.forEach(d => {
        if (d !== day) {
          next[d] = { ...prev.business_hours[d], from: src.from, to: src.to, split: src.split, from2: src.from2, to2: src.to2 }
        }
      })
      return { ...prev, business_hours: next }
    })
    setCopiedDay(day)
    setTimeout(() => setCopiedDay(null), 2000)
  }

  async function handleSave() {
    setError(null)
    try {
      let logoUrl = local.logo_url
      if (logoFile) {
        const url = await uploadLogo(logoFile)
        if (url) {
          logoUrl = url
          setLocal(prev => ({ ...prev, logo_url: url }))
          setLogoFile(null)
        }
      }
      await saveBusiness({ ...local, logo_url: logoUrl, phone: cleanPhone(local.phone) })
      setSaved(true)
      // Mostramos el "✓ Guardado" un instante y volvemos al inicio.
      setTimeout(() => onNavigate('inicio'), 900)
    } catch (e) {
      setError('No se pudieron guardar los cambios. Revisá tu conexión e intentá de nuevo. (' + (e as Error).message + ')')
    }
  }

  if (loading) {
    return <div style={{ padding: '40px 0', color: 'var(--ink-faint)', fontSize: 14 }}>Cargando…</div>
  }

  const hours = local.business_hours ?? {}

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av" style={{ background: 'linear-gradient(135deg,var(--mint),#00a378)', boxShadow: '0 6px 18px rgba(0,200,150,.25)' }}>
            {local.logo_url
              ? <img src={logoPreview || local.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              : (local.business_name ? local.business_name.slice(0, 2).toUpperCase() : '?')
            }
          </div>
          <div>
            <h1>Mi negocio</h1>
            <div className="sub">Datos que usa Bolty para atender a tus clientes</div>
          </div>
        </div>
      </div>

      {/* Datos del negocio */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3>Datos del negocio</h3></div>
        <div className="sub">Nombre y descripción que aparecen en las respuestas de Bolty</div>

        <div className="onb-logo-row" style={{ marginTop: 18 }}>
          <div className="onb-logo-preview" onClick={() => fileRef.current?.click()}>
            {(logoPreview || local.logo_url)
              ? <img src={logoPreview || local.logo_url!} alt="logo" />
              : <span>＋<br />Logo</span>
            }
          </div>
          <input
            ref={fileRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleLogoChange}
          />
          <div>
            <div className="onb-logo-hint">Logo del negocio (opcional)</div>
            <button className="onb-upload-btn" type="button" onClick={() => fileRef.current?.click()}>
              {local.logo_url ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
          </div>
        </div>

        <div className="field">
          <label>Nombre del negocio</label>
          <input
            type="text" value={local.business_name}
            onChange={e => setLocal({ ...local, business_name: e.target.value })}
            placeholder="Ej: Veterinaria Centro"
          />
        </div>
        <div className="field">
          <label>Rubro o a qué te dedicás</label>
          <input
            type="text" value={local.industry}
            onChange={e => setLocal({ ...local, industry: e.target.value })}
            placeholder="Ej: Veterinaria, Peluquería, Ferretería…"
          />
        </div>
        <div className="field">
          <label>Descripción corta</label>
          <textarea
            rows={2} value={local.description}
            onChange={e => setLocal({ ...local, description: e.target.value })}
            placeholder="Breve descripción de tu negocio"
          />
        </div>
        <div className="field-row-2" style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            <label>Dirección o zona</label>
            <input
              type="text" value={local.address}
              onChange={e => setLocal({ ...local, address: e.target.value })}
              placeholder="Ej: Av. Corrientes 1234"
            />
          </div>
          <div className="field">
            <label>Teléfono de contacto</label>
            <input
              type="text" value={local.phone}
              onChange={e => setLocal({ ...local, phone: e.target.value })}
              placeholder="+54 11 4567-8900"
            />
          </div>
        </div>
      </div>

      {/* Horarios */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3>Horarios de atención</h3></div>
        <div className="sub">Bolty los usa para informar a tus clientes cuándo podés atenderlos</div>

        <div className="onb-hours" style={{ marginTop: 18 }}>
          {DAYS.map(day => {
            const h = hours[day]
            return (
              <div key={day} className="onb-day">
                <div className="onb-day-left">
                  <label className="sw" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={h?.open ?? false} onChange={e => updateDay(day, { open: e.target.checked })} />
                    <span className="sl" />
                  </label>
                  <span className={`onb-day-name${h?.open ? '' : ' closed'}`}>{DAY_LABELS[day]}</span>
                </div>

                {h?.open ? (
                  <div className="onb-day-right">
                    <div className="onb-shift-row">
                      <input type="time" value={h.from} onChange={e => updateDay(day, { from: e.target.value })} />
                      <span className="onb-to-label">a</span>
                      <input type="time" value={h.to} onChange={e => updateDay(day, { to: e.target.value })} />
                      {!h.split && (
                        <button type="button" className="onb-split-btn" onClick={() => updateDay(day, { split: true })}>＋ turno</button>
                      )}
                    </div>
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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {saved && (
          <span style={{ color: 'var(--mint)', fontSize: 13, fontWeight: 600 }}>✓ Guardado</span>
        )}
      </div>
      {error && <div className="onb-error" style={{ marginTop: 14 }}>{error}</div>}
    </>
  )
}
