import { useRef, useState } from 'react'
import type { ProductInput } from '../../hooks/useProducts'

interface Row {
  name: string
  price: string
  stock: string
  category: string
}

const emptyRow = (): Row => ({ name: '', price: '', stock: '', category: '' })

const DEMO_ROWS: Row[] = [
  { name: 'Alimento Premium 15kg', price: '18500', stock: '20', category: 'Alimentos' },
  { name: 'Pipeta antipulgas grande', price: '4200', stock: '50', category: 'Salud' },
  { name: 'Collar regulable azul', price: '3500', stock: '15', category: 'Accesorios' },
]

interface Props {
  onClose: () => void
  onConfirm: (rows: ProductInput[]) => Promise<number>
  uploadRemito: (file: File) => Promise<string | null>
}

/**
 * Cargar productos desde un remito.
 * Hoy: subís la foto/PDF del remito (se guarda como comprobante) y completás
 * una tabla editable que se carga al inventario de una.
 * Próximo paso: Claude Vision lee el remito y pre-llena esta misma tabla solo.
 */
export default function RemitoModal({ onClose, onConfirm, uploadRemito }: Props) {
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [preview, setPreview] = useState<string | null>(null)
  const [remitoName, setRemitoName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function setRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() { setRows(prev => [...prev, emptyRow()]) }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)) }

  async function pickRemito(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setRemitoName(f.name)
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f))
    else setPreview(null)
    setUploading(true); setErr(null)
    try {
      await uploadRemito(f) // se guarda como comprobante
    } catch (e) {
      setErr('No pudimos guardar la imagen del remito, pero igual podés cargar los productos a mano. (' + (e as Error).message + ')')
    } finally {
      setUploading(false)
    }
  }

  async function confirm() {
    setErr(null)
    const valid: ProductInput[] = []
    rows.forEach(r => {
      const name = r.name.trim()
      if (!name) return
      const price = parseFloat(r.price.replace(',', '.'))
      const stock = parseInt(r.stock, 10)
      valid.push({
        name,
        price: isNaN(price) ? 0 : price,
        stock: isNaN(stock) ? 0 : stock,
        category: r.category.trim() || null,
      })
    })
    if (valid.length === 0) { setErr('Cargá al menos un producto (con nombre) para agregar.'); return }
    setImporting(true)
    try {
      const n = await onConfirm(valid)
      setDone(n)
    } catch (e) {
      setErr('No se pudieron agregar los productos: ' + (e as Error).message)
      setImporting(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <h2>Cargar desde remito</h2>

        {done !== null ? (
          <>
            <div className="import-ok">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="40" height="40"><path d="M20 6L9 17l-5-5" /></svg>
              <p>¡Listo! Se agregaron <b>{done}</b> producto{done === 1 ? '' : 's'} al inventario.</p>
            </div>
            <div className="modal-actions"><button className="btn" onClick={onClose}>Cerrar</button></div>
          </>
        ) : (
          <>
            <div className="remito-soon">
              🔧 <b>Lectura automática con IA: muy pronto.</b> Cuando conectes tu agente,
              Claude va a leer el remito y completar esta tabla solo. Por ahora subí el remito como comprobante
              y cargá los productos abajo (o probá la demo para ver cómo va a quedar).
            </div>

            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={pickRemito} />
            <div className="remito-upload-row">
              <button className="import-drop" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                <svg fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
                </svg>
                <span>{uploading ? 'Subiendo…' : remitoName || 'Subir foto o PDF del remito'}</span>
              </button>
              {preview && <img className="remito-thumb" src={preview} alt="remito" />}
            </div>

            <div className="remito-table-head">
              <span>Productos del remito</span>
              <button className="link-btn" onClick={() => setRows(DEMO_ROWS.map(r => ({ ...r })))}>Probar con demo</button>
            </div>

            <div className="remito-table">
              <div className="remito-row remito-row-h">
                <span>Nombre</span><span>Precio</span><span>Stock</span><span>Categoría</span><span />
              </div>
              {rows.map((r, i) => (
                <div key={i} className="remito-row">
                  <input value={r.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="Producto" />
                  <input value={r.price} inputMode="decimal" onChange={e => setRow(i, { price: e.target.value })} placeholder="0" />
                  <input value={r.stock} inputMode="numeric" onChange={e => setRow(i, { stock: e.target.value })} placeholder="0" />
                  <input value={r.category} onChange={e => setRow(i, { category: e.target.value })} placeholder="Opcional" />
                  <button className="remito-del" onClick={() => removeRow(i)} title="Quitar fila" disabled={rows.length === 1}>×</button>
                </div>
              ))}
            </div>
            <button className="link-btn" style={{ marginTop: 10 }} onClick={addRow}>+ Agregar fila</button>

            {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

            <div className="modal-actions">
              <button className="btn-outline" onClick={onClose} disabled={importing}>Cancelar</button>
              <button className="btn" onClick={confirm} disabled={importing}>
                {importing ? 'Agregando…' : 'Agregar al inventario'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
