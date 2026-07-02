import { useMemo, useRef, useState, useEffect } from 'react'
import type { ViewFocus } from '../App'
import { useServices, fmtDuration } from '../hooks/useServices'
import type { Service, ServiceInput } from '../hooks/useServices'
import { parseServicesFile, downloadServicesTemplate } from '../lib/serviceImport'
import type { ServiceParseResult } from '../lib/serviceImport'

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n || 0)

const ALL = '__all__'
const NONE = '__none__'
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120]

export default function Servicios({ focus }: { focus?: ViewFocus }) {
  const {
    services, loading, error, reload,
    addService, updateService, deleteService, importServices, uploadImage,
  } = useServices()

  const [search, setSearch] = useState('')

  // Prefiltro cuando venimos del buscador global.
  useEffect(() => { if (focus?.term != null) setSearch(focus.term) }, [focus?.ts])
  const [catFilter, setCatFilter] = useState<string>(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    services.forEach(s => { if (s.category) set.add(s.category) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [services])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return services.filter(s => {
      const okSearch = !q || s.name.toLowerCase().includes(q)
      const okCat =
        catFilter === ALL ? true :
        catFilter === NONE ? !s.category :
        s.category === catFilter
      return okSearch && okCat
    })
  }, [services, search, catFilter])

  async function handleDelete(s: Service) {
    if (!window.confirm(`¿Borrar "${s.name}"? Esta acción no se puede deshacer.`)) return
    try { await deleteService(s.id) }
    catch (e) { alert('No se pudo borrar: ' + (e as Error).message) }
  }

  function openAdd() { setEditing(null); setFormOpen(true) }
  function openEdit(s: Service) { setEditing(s); setFormOpen(true) }

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av" style={{ background: 'linear-gradient(135deg,var(--mint),#00a378)', boxShadow: '0 6px 18px rgba(0,200,150,.25)' }}>
            <svg fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" width="24" height="24">
              <path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6 6a2 2 0 102.8 2.8l6-6a4 4 0 005.6-5.6l-2.1 2.1-2.2-.6-.6-2.2z" />
            </svg>
          </div>
          <div>
            <h1>Servicios</h1>
            <div className="sub">Lo que ofrece tu negocio: tu agente lo usa para informar y agendar</div>
          </div>
        </div>
        <div className="inv-head-actions">
          <button className="btn-outline" onClick={() => setImportOpen(true)}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
            </svg>
            Importar
          </button>
          <button className="btn" onClick={openAdd}>+ Agregar servicio</button>
        </div>
      </div>

      {error && (
        <div className="onb-error" style={{ marginBottom: 16 }}>
          No pudimos cargar tus servicios. (Detalle: {error}){' '}
          <button className="link-btn" onClick={reload}>Reintentar</button>
        </div>
      )}

      {!loading && services.length > 0 && (
        <div className="inv-toolbar">
          <div className="inv-search">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
            <input type="text" placeholder="Buscar servicio por nombre…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="inv-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value={ALL}>Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value={NONE}>Sin categoría</option>
          </select>
          <span className="inv-count">{filtered.length} de {services.length}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
          Cargando tus servicios…
        </div>
      ) : services.length === 0 ? (
        <div className="empty-state" style={{ padding: '52px 20px' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="46" height="46">
            <path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6 6a2 2 0 102.8 2.8l6-6a4 4 0 005.6-5.6l-2.1 2.1-2.2-.6-.6-2.2z" />
          </svg>
          <p style={{ fontSize: 14, maxWidth: 340 }}>
            Todavía no cargaste servicios. Agregá el primero o importá tu lista desde Excel.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button className="btn" onClick={openAdd}>+ Agregar servicio</button>
            <button className="btn-outline" onClick={() => setImportOpen(true)}>Importar planilla</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <p>No encontramos servicios con esos filtros.</p>
        </div>
      ) : (
        <div className="prod-grid">
          {filtered.map(s => (
            <div key={s.id} className="prod-card">
              <div className="prod-thumb">
                {s.image_url
                  ? <img src={s.image_url} alt={s.name} />
                  : (
                    <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="28" height="28">
                      <path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6 6a2 2 0 102.8 2.8l6-6a4 4 0 005.6-5.6l-2.1 2.1-2.2-.6-.6-2.2z" />
                    </svg>
                  )}
              </div>
              <div className="prod-body">
                <div className="prod-name" title={s.name}>{s.name}</div>
                {s.category
                  ? <span className="prod-cat">{s.category}</span>
                  : <span className="prod-cat empty">Sin categoría</span>}
                {s.description && <div className="prod-desc">{s.description}</div>}

                {s.duration_min ? (
                  <div className="svc-duration">
                    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {fmtDuration(s.duration_min)}
                  </div>
                ) : null}

                <div className="prod-price" style={{ marginTop: s.duration_min ? 8 : 'auto' }}>
                  {s.price_on_request ? <span className="svc-consult">A consultar</span> : fmtPrice(s.price)}
                </div>
              </div>

              <div className="prod-actions">
                <button onClick={() => openEdit(s)}>Editar</button>
                <button className="danger" onClick={() => handleDelete(s)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <ServiceForm
          service={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSave={async (input, file) => {
            let image_url = input.image_url ?? null
            if (file) image_url = await uploadImage(file)
            if (editing) await updateService(editing.id, { ...input, image_url })
            else await addService({ ...input, image_url })
            setFormOpen(false)
          }}
        />
      )}

      {importOpen && (
        <ImportServicesModal
          onClose={() => setImportOpen(false)}
          onConfirm={async rows => { const n = await importServices(rows); setImportOpen(false); return n }}
        />
      )}
    </>
  )
}

/* ───────────── Formulario de alta / edición ───────────── */
function ServiceForm({
  service, categories, onClose, onSave,
}: {
  service: Service | null
  categories: string[]
  onClose: () => void
  onSave: (input: ServiceInput, file: File | null) => Promise<void>
}) {
  const [name, setName] = useState(service?.name ?? '')
  const [onRequest, setOnRequest] = useState(service?.price_on_request ?? false)
  const [price, setPrice] = useState(service && !service.price_on_request ? String(service.price) : '')
  const initMin = service?.duration_min ?? 0
  const [durH, setDurH] = useState(initMin ? String(Math.floor(initMin / 60)) : '')
  const [durM, setDurM] = useState(initMin ? String(initMin % 60) : '')
  const totalMin = (parseInt(durH, 10) || 0) * 60 + (parseInt(durM, 10) || 0)
  const [category, setCategory] = useState(service?.category ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('El nombre del servicio es obligatorio.')
    let priceNum = 0
    if (!onRequest) {
      priceNum = parseFloat(price.replace(',', '.'))
      if (price.trim() === '' || isNaN(priceNum) || priceNum < 0) {
        return setErr('Ingresá un precio válido o marcá "A consultar".')
      }
    }
    const h = parseInt(durH || '0', 10)
    const m = parseInt(durM || '0', 10)
    if (isNaN(h) || isNaN(m) || h < 0 || m < 0) return setErr('La duración tiene que ser un número válido de horas y minutos.')
    const durationMin: number | null = (h * 60 + m) > 0 ? (h * 60 + m) : null

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        price: priceNum,
        price_on_request: onRequest,
        duration_min: durationMin,
        category: category.trim() || null,
        description: description.trim() || null,
        image_url: imageUrl,
      }, file)
    } catch (e) {
      setErr('No se pudo guardar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  const shownImage = preview || imageUrl

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{service ? 'Editar servicio' : 'Agregar servicio'}</h2>

        <div className="onb-logo-row" style={{ marginBottom: 4 }}>
          <div className="onb-logo-preview" onClick={() => fileRef.current?.click()}>
            {shownImage ? <img src={shownImage} alt="servicio" /> : <span>＋<br />Foto</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
          <div>
            <div className="onb-logo-hint">Foto del servicio (opcional)</div>
            <button className="onb-upload-btn" type="button" onClick={() => fileRef.current?.click()}>
              {shownImage ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {shownImage && (
              <button className="link-btn" type="button" style={{ marginLeft: 10 }}
                onClick={() => { setFile(null); setPreview(null); setImageUrl(null) }}>Quitar</button>
            )}
          </div>
        </div>

        <div className="field">
          <label>Nombre del servicio *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Corte de pelo" autoFocus />
        </div>

        <div className="field">
          <label>Precio *</label>
          <input
            type="text" inputMode="decimal" value={onRequest ? '' : price}
            onChange={e => setPrice(e.target.value)} placeholder="Ej: 5000"
            disabled={onRequest} style={{ opacity: onRequest ? .5 : 1 }}
          />
          <label className="svc-check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={onRequest} onChange={e => setOnRequest(e.target.checked)} />
            A consultar (sin precio fijo)
          </label>
        </div>

        <div className="field">
          <label>Duración (opcional)</label>
          <div className="svc-dur-chips">
            {DURATION_PRESETS.map(m => (
              <div
                key={m}
                className={`chip${m === totalMin ? ' sel' : ''}`}
                onClick={() => { setDurH(String(Math.floor(m / 60))); setDurM(String(m % 60)) }}
              >
                {fmtDuration(m)}
              </div>
            ))}
          </div>
          <div className="svc-dur-inputs">
            <div className="svc-dur-field">
              <input type="text" inputMode="numeric" value={durH} onChange={e => setDurH(e.target.value)} placeholder="0" />
              <span>h</span>
            </div>
            <div className="svc-dur-field">
              <input type="text" inputMode="numeric" value={durM} onChange={e => setDurM(e.target.value)} placeholder="0" />
              <span>min</span>
            </div>
            {totalMin > 0 && <span className="svc-dur-total">= {fmtDuration(totalMin)}</span>}
          </div>
          <div className="hint">Cuánto tarda el servicio. Lo usa Bolty para organizar los turnos.</div>
        </div>

        <div className="field">
          <label>Categoría (opcional)</label>
          <input type="text" list="svc-cat-options" value={category} onChange={e => setCategory(e.target.value)} placeholder="Elegí una o creá la tuya" />
          <datalist id="svc-cat-options">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="field">
          <label>Descripción (opcional)</label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle breve del servicio" />
        </div>

        {err && <div className="onb-error" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" type="button" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : (service ? 'Guardar cambios' : 'Agregar servicio')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Importar Excel / CSV ───────────── */
function ImportServicesModal({
  onClose, onConfirm,
}: {
  onClose: () => void
  onConfirm: (rows: ServiceInput[]) => Promise<number>
}) {
  const [result, setResult] = useState<ServiceParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name); setParsing(true); setFatal(null); setResult(null)
    try {
      setResult(await parseServicesFile(f))
    } catch (err) {
      setFatal('No pudimos leer el archivo. Asegurate de que sea un .csv, .xlsx o .xls válido. (' + (err as Error).message + ')')
    } finally {
      setParsing(false)
    }
  }

  async function confirm() {
    if (!result || result.valid.length === 0) return
    setImporting(true)
    try {
      const n = await onConfirm(result.valid)
      setDone(n)
    } catch (e) {
      setFatal('No se pudieron guardar los servicios: ' + (e as Error).message)
      setImporting(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>Importar servicios</h2>

        {done !== null ? (
          <>
            <div className="import-ok">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="40" height="40"><path d="M20 6L9 17l-5-5" /></svg>
              <p>¡Listo! Se importaron <b>{done}</b> servicio{done === 1 ? '' : 's'}.</p>
            </div>
            <div className="modal-actions"><button className="btn" onClick={onClose}>Cerrar</button></div>
          </>
        ) : (
          <>
            <p className="import-intro">
              Subí una planilla <b>Excel (.xlsx)</b> o <b>CSV</b> con una fila por servicio.
              La primera fila tiene que tener los encabezados:
            </p>
            <div className="import-cols">
              <code>nombre</code><code>precio</code><code>duracion</code>
              <code>categoria</code><code>descripcion</code>
            </div>
            <p className="import-note">
              <b>nombre</b> es obligatorio. En <b>precio</b> podés poner un número o escribir <b>"a consultar"</b> (o dejarlo vacío).
              <b> duracion</b>, <b>categoria</b> y <b>descripcion</b> son opcionales.
              ¿No sabés cómo armarla? <button className="link-btn" onClick={downloadServicesTemplate}>Descargá la plantilla de ejemplo</button>.
            </p>

            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={pickFile} />
            <button className="import-drop" onClick={() => fileRef.current?.click()}>
              <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="26" height="26">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
              </svg>
              <span>{fileName || 'Elegir archivo (.xlsx o .csv)'}</span>
            </button>

            {parsing && <div className="import-status">Leyendo el archivo…</div>}
            {fatal && <div className="onb-error" style={{ marginTop: 12 }}>{fatal}</div>}

            {result && (
              <div className="import-summary">
                <div className="import-summary-row ok">
                  ✓ {result.valid.length} servicio{result.valid.length === 1 ? '' : 's'} listo{result.valid.length === 1 ? '' : 's'} para importar
                </div>
                {result.errors.length > 0 && (
                  <div className="import-summary-row warn">
                    ⚠ {result.errors.length} fila{result.errors.length === 1 ? '' : 's'} con problemas (se omiten):
                    <ul>
                      {result.errors.slice(0, 6).map((er, i) => <li key={i}>{er}</li>)}
                      {result.errors.length > 6 && <li>…y {result.errors.length - 6} más.</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-outline" onClick={onClose} disabled={importing}>Cancelar</button>
              <button className="btn" onClick={confirm} disabled={!result || result.valid.length === 0 || importing}>
                {importing ? 'Importando…' : result ? `Importar ${result.valid.length}` : 'Importar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
