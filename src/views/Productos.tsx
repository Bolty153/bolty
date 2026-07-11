import { useMemo, useRef, useState, useEffect } from 'react'
import type { ViewFocus } from '../App'
import { useProducts, LOW_STOCK_THRESHOLD } from '../hooks/useProducts'
import type { Product, ProductInput } from '../hooks/useProducts'
import { parseProductsFile, downloadTemplate } from '../lib/productImport'
import type { ParseResult } from '../lib/productImport'
import BarcodeScanner from '../components/inventory/BarcodeScanner'
import RemitoModal from '../components/inventory/RemitoModal'
import BulkAdjustModal from '../components/inventory/BulkAdjustModal'

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n || 0)

const ALL = '__all__'
const NONE = '__none__'

export default function Productos({ focus }: { focus?: ViewFocus }) {
  const {
    products, loading, error, reload,
    addProduct, updateProduct, deleteProduct, importProducts,
    bulkUpdateStock, uploadImage, uploadRemito, findByBarcode,
  } = useProducts()

  const [search, setSearch] = useState('')

  // Si llegamos desde el buscador global, prefiltramos por el término.
  useEffect(() => { if (focus?.term != null) setSearch(focus.term) }, [focus?.ts])
  const [catFilter, setCatFilter] = useState<string>(ALL)
  const [lowOnly, setLowOnly] = useState(false)
  const [quickMode, setQuickMode] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [prefillBarcode, setPrefillBarcode] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [remitoOpen, setRemitoOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)

  const categories = useMemo(() => {
    const set = new Set<string>()
    products.forEach(p => { if (p.category) set.add(p.category) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [products])

  const lowCount = useMemo(
    () => products.filter(p => p.stock <= LOW_STOCK_THRESHOLD).length,
    [products]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return products.filter(p => {
      const okSearch = !q || p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q)
      const okCat =
        catFilter === ALL ? true :
        catFilter === NONE ? !p.category :
        p.category === catFilter
      const okLow = !lowOnly || p.stock <= LOW_STOCK_THRESHOLD
      return okSearch && okCat && okLow
    })
  }, [products, search, catFilter, lowOnly])

  async function changeStock(p: Product, delta: number) {
    const next = Math.max(0, p.stock + delta)
    if (next === p.stock) return
    try { await updateProduct(p.id, { stock: next }) }
    catch (e) { alert('No se pudo actualizar el stock: ' + (e as Error).message) }
  }

  async function setStock(p: Product, value: number) {
    const next = Math.max(0, value)
    if (next === p.stock) return
    try { await updateProduct(p.id, { stock: next }) }
    catch (e) { alert('No se pudo actualizar el stock: ' + (e as Error).message) }
  }

  async function handleDelete(p: Product) {
    if (!window.confirm(`¿Borrar "${p.name}"? Esta acción no se puede deshacer.`)) return
    try { await deleteProduct(p.id) }
    catch (e) { alert('No se pudo borrar: ' + (e as Error).message) }
  }

  function openAdd() { setEditing(null); setPrefillBarcode(null); setFormOpen(true) }
  function openEdit(p: Product) { setEditing(p); setPrefillBarcode(null); setFormOpen(true) }

  function handleScanned(code: string) {
    setScanOpen(false)
    const found = findByBarcode(code)
    if (found) { setEditing(found); setPrefillBarcode(null); setFormOpen(true) }
    else { setEditing(null); setPrefillBarcode(code); setFormOpen(true) }
  }

  const hasProducts = !loading && products.length > 0

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av" style={{ background: 'linear-gradient(135deg,var(--volt),var(--volt-2))', boxShadow: '0 6px 18px rgba(96,41,255,.25)' }}>
            <svg fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24" width="24" height="24">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <div>
            <h1>Inventario</h1>
            <div className="sub">Los productos que tu agente consulta para responder y vender</div>
          </div>
        </div>
        <div className="inv-head-actions">
          <button className="btn-outline" onClick={() => setScanOpen(true)} title="Escanear código de barras">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
              <path d="M7 7v10M11 7v10M15 7v10M18 7v10" />
            </svg>
            Escanear
          </button>
          <button className="btn-outline" onClick={() => setRemitoOpen(true)}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h8" />
            </svg>
            Remito
          </button>
          <button className="btn-outline" onClick={() => setImportOpen(true)}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
            </svg>
            Importar
          </button>
          <button className="btn" onClick={openAdd}>+ Agregar producto</button>
        </div>
      </div>

      {error && (
        <div className="onb-error" style={{ marginBottom: 16 }}>
          No pudimos cargar tu inventario. (Detalle: {error}){' '}
          <button className="link-btn" onClick={reload}>Reintentar</button>
        </div>
      )}

      {hasProducts && (
        <div className="inv-toolbar">
          <div className="inv-search">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
            <input
              type="text" placeholder="Buscar por nombre o código…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="inv-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value={ALL}>Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value={NONE}>Sin categoría</option>
          </select>
          <button className={`inv-chip${lowOnly ? ' sel' : ''}`} onClick={() => setLowOnly(v => !v)}>
            ⚠ Stock bajo{lowCount > 0 ? ` (${lowCount})` : ''}
          </button>
          <div className="inv-toolbar-spacer" />
          <button className={`inv-chip${quickMode ? ' sel' : ''}`} onClick={() => setQuickMode(v => !v)}>
            ⚡ Carga rápida
          </button>
          <button className="inv-chip" onClick={() => setBulkOpen(true)}>Ajuste masivo</button>
          <span className="inv-count">{filtered.length} de {products.length}</span>
        </div>
      )}

      {/* Estados */}
      {loading ? (
        <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
          Cargando tu inventario…
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state" style={{ padding: '52px 20px' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="46" height="46">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" />
          </svg>
          <p style={{ fontSize: 14, maxWidth: 340 }}>
            Todavía no cargaste productos. Agregá el primero, escaneá un código, importá tu lista de Excel o cargá un remito.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn" onClick={openAdd}>+ Agregar producto</button>
            <button className="btn-outline" onClick={() => setImportOpen(true)}>Importar planilla</button>
            <button className="btn-outline" onClick={() => setRemitoOpen(true)}>Cargar remito</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <p>No encontramos productos con esos filtros.</p>
        </div>
      ) : quickMode ? (
        <div className="quick-list">
          {filtered.map(p => (
            <QuickRow key={p.id} product={p} onCommit={v => setStock(p, v)} onStep={d => changeStock(p, d)} />
          ))}
        </div>
      ) : (
        <div className="prod-grid">
          {filtered.map(p => (
            <div key={p.id} className="prod-card">
              <div className="prod-thumb">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} />
                  : (
                    <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="28" height="28">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                  )}
              </div>
              <div className="prod-body">
                <div className="prod-name" title={p.name}>{p.name}</div>
                {p.category
                  ? <span className="prod-cat">{p.category}</span>
                  : <span className="prod-cat empty">Sin categoría</span>}
                {p.description && <div className="prod-desc">{p.description}</div>}
                <div className="prod-price">{fmtPrice(p.price)}</div>

                <div className="prod-stock-row">
                  <span className={`prod-stock-tag${p.stock === 0 ? ' out' : p.stock <= LOW_STOCK_THRESHOLD ? ' low' : ''}`}>
                    {p.stock === 0 ? 'Sin stock' : `${p.stock} en stock`}
                  </span>
                  <div className="prod-stepper">
                    <button onClick={() => changeStock(p, -1)} disabled={p.stock === 0} aria-label="Restar stock">−</button>
                    <button onClick={() => changeStock(p, +1)} aria-label="Sumar stock">+</button>
                  </div>
                </div>
              </div>

              <div className="prod-actions">
                <button onClick={() => openEdit(p)}>Editar</button>
                <button className="danger" onClick={() => handleDelete(p)}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <ProductForm
          product={editing}
          categories={categories}
          initialBarcode={prefillBarcode}
          onClose={() => setFormOpen(false)}
          onSave={async (input, file) => {
            let image_url = input.image_url ?? null
            if (file) image_url = await uploadImage(file)
            if (editing) await updateProduct(editing.id, { ...input, image_url })
            else await addProduct({ ...input, image_url })
            setFormOpen(false)
          }}
        />
      )}

      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onConfirm={async rows => { const n = await importProducts(rows); setImportOpen(false); return n }}
        />
      )}

      {remitoOpen && (
        <RemitoModal
          onClose={() => setRemitoOpen(false)}
          uploadRemito={uploadRemito}
          onConfirm={async rows => importProducts(rows)}
        />
      )}

      {bulkOpen && (
        <BulkAdjustModal
          products={products}
          categories={categories}
          onClose={() => setBulkOpen(false)}
          onApply={bulkUpdateStock}
        />
      )}

      {scanOpen && (
        <BarcodeScanner onClose={() => setScanOpen(false)} onDetected={handleScanned} />
      )}
    </>
  )
}

/* ───────────── Fila de carga rápida ───────────── */
function QuickRow({ product, onCommit, onStep }: {
  product: Product
  onCommit: (value: number) => void
  onStep: (delta: number) => void
}) {
  const [draft, setDraft] = useState(String(product.stock))

  function commit() {
    const n = parseInt(draft, 10)
    if (isNaN(n)) { setDraft(String(product.stock)); return }
    onCommit(n)
  }

  return (
    <div className="quick-row">
      <div className="quick-thumb">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} />
          : <svg fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24" width="18" height="18"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" /></svg>}
      </div>
      <div className="quick-info">
        <div className="quick-name">{product.name}</div>
        {product.category && <span className="quick-cat">{product.category}</span>}
      </div>
      <div className="quick-stepper">
        <button onClick={() => { onStep(-1); setDraft(String(Math.max(0, product.stock - 1))) }} disabled={product.stock === 0}>−</button>
        <input
          data-id={product.id}
          value={draft}
          inputMode="numeric"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
        <button onClick={() => { onStep(+1); setDraft(String(product.stock + 1)) }}>+</button>
      </div>
    </div>
  )
}

/* ───────────── Formulario de alta / edición ───────────── */
function ProductForm({
  product, categories, initialBarcode, onClose, onSave,
}: {
  product: Product | null
  categories: string[]
  initialBarcode: string | null
  onClose: () => void
  onSave: (input: ProductInput, file: File | null) => Promise<void>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? initialBarcode ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('El nombre del producto es obligatorio.')
    const priceNum = parseFloat(price.replace(',', '.'))
    if (price.trim() === '' || isNaN(priceNum) || priceNum < 0) return setErr('Ingresá un precio válido.')
    const stockNum = parseInt(stock, 10)
    if (stock.trim() === '' || isNaN(stockNum) || stockNum < 0) return setErr('Ingresá un stock válido.')

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        price: priceNum,
        stock: stockNum,
        category: category.trim() || null,
        description: description.trim() || null,
        barcode: barcode.trim() || null,
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
        <h2>{product ? 'Editar producto' : 'Agregar producto'}</h2>

        <div className="onb-logo-row" style={{ marginBottom: 4 }}>
          <div className="onb-logo-preview" onClick={() => fileRef.current?.click()}>
            {shownImage ? <img src={shownImage} alt="producto" /> : <span>＋<br />Foto</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
          <div>
            <div className="onb-logo-hint">Foto del producto (opcional)</div>
            <button className="onb-upload-btn" type="button" onClick={() => fileRef.current?.click()}>
              {shownImage ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {shownImage && (
              <button
                className="link-btn" type="button" style={{ marginLeft: 10 }}
                onClick={() => { setFile(null); setPreview(null); setImageUrl(null) }}
              >Quitar</button>
            )}
          </div>
        </div>

        <div className="field">
          <label>Nombre del producto *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Alimento Premium 15kg" autoFocus />
        </div>

        <div className="field-row-2" style={{ display: 'grid', gap: 14 }}>
          <div className="field">
            <label>Precio *</label>
            <input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ej: 18500" />
          </div>
          <div className="field">
            <label>Stock disponible *</label>
            <input type="text" inputMode="numeric" value={stock} onChange={e => setStock(e.target.value)} placeholder="Ej: 12" />
          </div>
        </div>

        <div className="field">
          <label>Categoría (opcional)</label>
          <input
            type="text" list="cat-options" value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Elegí una o creá la tuya"
          />
          <datalist id="cat-options">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
          <div className="hint">Podés dejarla vacía, elegir una que ya usaste o escribir una nueva.</div>
        </div>

        <div className="field">
          <label>Código de barras (opcional)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" inputMode="numeric" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Para negocios que usan lector" style={{ flex: 1 }} />
            <button type="button" className="btn-outline" onClick={() => setScanning(true)} style={{ padding: '0 14px' }}>Escanear</button>
          </div>
          <div className="hint">Solo si tu negocio se maneja con códigos de barras. No es obligatorio.</div>
        </div>

        <div className="field">
          <label>Descripción (opcional)</label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle breve del producto" />
        </div>

        {err && <div className="onb-error" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" type="button" onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : (product ? 'Guardar cambios' : 'Agregar producto')}
          </button>
        </div>

        {scanning && (
          <BarcodeScanner
            onClose={() => setScanning(false)}
            onDetected={code => { setBarcode(code); setScanning(false) }}
          />
        )}
      </div>
    </div>
  )
}

/* ───────────── Importar Excel / CSV ───────────── */
function ImportModal({
  onClose, onConfirm,
}: {
  onClose: () => void
  onConfirm: (rows: ProductInput[]) => Promise<number>
}) {
  const [result, setResult] = useState<ParseResult | null>(null)
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
      setResult(await parseProductsFile(f))
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
      setFatal('No se pudieron guardar los productos: ' + (e as Error).message)
      setImporting(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>Importar productos</h2>

        {done !== null ? (
          <>
            <div className="import-ok">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="40" height="40"><path d="M20 6L9 17l-5-5" /></svg>
              <p>¡Listo! Se importaron <b>{done}</b> producto{done === 1 ? '' : 's'}.</p>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <p className="import-intro">
              Subí una planilla <b>Excel (.xlsx)</b> o <b>CSV</b> con una fila por producto.
              La primera fila tiene que tener los encabezados:
            </p>
            <div className="import-cols">
              <code>nombre</code><code>precio</code><code>stock</code>
              <code>categoria</code><code>descripcion</code>
            </div>
            <p className="import-note">
              <b>nombre</b>, <b>precio</b> y <b>stock</b> son obligatorios. <b>categoria</b> y <b>descripcion</b> pueden ir vacías.
              ¿No sabés cómo armarla? <button className="link-btn" onClick={downloadTemplate}>Descargá la plantilla de ejemplo</button>.
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
                  ✓ {result.valid.length} producto{result.valid.length === 1 ? '' : 's'} listo{result.valid.length === 1 ? '' : 's'} para importar
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
              <button
                className="btn" onClick={confirm}
                disabled={!result || result.valid.length === 0 || importing}
              >
                {importing ? 'Importando…' : result ? `Importar ${result.valid.length}` : 'Importar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
