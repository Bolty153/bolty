import { useRef, useState } from 'react'
import type { TicketType, TicketInput } from '../../hooks/useSupport'

interface Cfg {
  title: string
  intro?: string
  pitch?: boolean
  titleField?: { label: string; placeholder: string }
  descLabel: string
  descPlaceholder: string
  screenshot?: boolean
  cta: string
  success: string
}

const CONFIG: Record<TicketType, Cfg> = {
  falla: {
    title: 'Reportar una falla',
    intro: 'Contanos qué no está funcionando y lo revisamos lo antes posible.',
    titleField: { label: '¿Qué falla? *', placeholder: 'Ej: No me deja guardar un turno' },
    descLabel: 'Contanos qué pasó *',
    descPlaceholder: 'Describí el problema: qué hacías, qué esperabas y qué pasó.',
    screenshot: true,
    cta: 'Enviar reporte',
    success: '¡Gracias! Recibimos tu reporte y lo vamos a revisar.',
  },
  sugerencia: {
    title: 'Enviar una sugerencia',
    intro: '¿Se te ocurre algo para mejorar Bolty? Nos encanta escucharte.',
    titleField: { label: 'Título *', placeholder: 'Ej: Poder exportar las ventas a Excel' },
    descLabel: 'Contanos tu idea *',
    descPlaceholder: 'Describí tu sugerencia con el mayor detalle posible.',
    cta: 'Enviar sugerencia',
    success: '¡Gracias por tu sugerencia! La vamos a tener en cuenta.',
  },
  medida: {
    title: 'Servicio a medida',
    pitch: true,
    descLabel: '¿Qué necesitás que creemos? *',
    descPlaceholder: 'Contanos qué función o herramienta te gustaría tener dentro de tu Bolty.',
    cta: 'Pedir presupuesto',
    success: '¡Listo! Recibimos tu pedido. Te vamos a contactar con un presupuesto.',
  },
}

export default function SupportModal({ type, onClose, onSubmit, uploadScreenshot }: {
  type: TicketType
  onClose: () => void
  onSubmit: (input: TicketInput) => Promise<void>
  uploadScreenshot: (file: File) => Promise<string | null>
}) {
  const cfg = CONFIG[type]
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    setErr(null)
    if (cfg.titleField && !title.trim()) return setErr('Completá el título.')
    if (!description.trim()) return setErr('Completá la descripción.')
    setSaving(true)
    try {
      let screenshot_url: string | null = null
      if (cfg.screenshot && file) screenshot_url = await uploadScreenshot(file)
      await onSubmit({ type, title: cfg.titleField ? title.trim() : null, description: description.trim(), screenshot_url })
      setSent(true)
    } catch (e) {
      setErr('No se pudo enviar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {sent ? (
          <div className="plans-done">
            <div className="confirm-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="28" height="28"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2>¡Recibido!</h2>
            <p>{cfg.success}</p>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <h2>{cfg.title}</h2>
            {cfg.pitch ? (
              <div className="support-pitch">
                <b>Creamos lo que tu negocio necesite, dentro de tu Bolty.</b>
                <p>¿Te falta una función específica, un reporte especial, una automatización? La desarrollamos a tu medida por un precio acordado. Contanos qué necesitás y te pasamos un presupuesto.</p>
              </div>
            ) : (
              cfg.intro && <p className="plans-sub" style={{ marginBottom: 18 }}>{cfg.intro}</p>
            )}

            {cfg.titleField && (
              <div className="field">
                <label>{cfg.titleField.label}</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={cfg.titleField.placeholder} autoFocus />
              </div>
            )}

            <div className="field">
              <label>{cfg.descLabel}</label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder={cfg.descPlaceholder} autoFocus={!cfg.titleField} />
            </div>

            {cfg.screenshot && (
              <div className="field">
                <label>Captura de pantalla (opcional)</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
                <div className="support-shot">
                  {preview && <img src={preview} alt="captura" />}
                  <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
                    {preview ? 'Cambiar captura' : 'Adjuntar captura'}
                  </button>
                  {preview && <button type="button" className="link-btn" onClick={() => { setFile(null); setPreview(null) }}>Quitar</button>}
                </div>
              </div>
            )}

            {err && <div className="onb-error" style={{ marginTop: 4 }}>{err}</div>}

            <div className="modal-actions">
              <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Enviando…' : cfg.cta}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
