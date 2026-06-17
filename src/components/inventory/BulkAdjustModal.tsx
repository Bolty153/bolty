import { useMemo, useState } from 'react'
import type { Product } from '../../hooks/useProducts'

const ALL = '__all__'
const NONE = '__none__'
type Op = 'set' | 'add' | 'sub' | 'zero'

interface Props {
  products: Product[]
  categories: string[]
  onClose: () => void
  onApply: (updates: { id: string; stock: number }[]) => Promise<void>
}

export default function BulkAdjustModal({ products, categories, onClose, onApply }: Props) {
  const [scope, setScope] = useState<string>(ALL)
  const [op, setOp] = useState<Op>('add')
  const [value, setValue] = useState('')
  const [applying, setApplying] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const affected = useMemo(() => products.filter(p =>
    scope === ALL ? true : scope === NONE ? !p.category : p.category === scope
  ), [products, scope])

  function compute(): { id: string; stock: number }[] {
    const n = parseInt(value, 10)
    return affected.map(p => {
      let stock = p.stock
      if (op === 'set') stock = isNaN(n) ? p.stock : n
      else if (op === 'add') stock = p.stock + (isNaN(n) ? 0 : n)
      else if (op === 'sub') stock = p.stock - (isNaN(n) ? 0 : n)
      else if (op === 'zero') stock = 0
      return { id: p.id, stock: Math.max(0, stock) }
    })
  }

  async function apply() {
    setErr(null)
    if (op !== 'zero' && (value.trim() === '' || isNaN(parseInt(value, 10)))) {
      setErr('Ingresá un número válido.')
      return
    }
    if (affected.length === 0) { setErr('No hay productos en ese grupo.'); return }
    setApplying(true)
    try {
      await onApply(compute())
      onClose()
    } catch (e) {
      setErr('No se pudo aplicar el ajuste: ' + (e as Error).message)
      setApplying(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <h2>Ajuste masivo de stock</h2>
        <p className="import-intro">Cambiá el stock de varios productos juntos.</p>

        <div className="field">
          <label>Aplicar a</label>
          <select className="inv-select" style={{ width: '100%' }} value={scope} onChange={e => setScope(e.target.value)}>
            <option value={ALL}>Todos los productos ({products.length})</option>
            {categories.map(c => <option key={c} value={c}>Categoría: {c}</option>)}
            <option value={NONE}>Sin categoría</option>
          </select>
        </div>

        <div className="field">
          <label>Acción</label>
          <div className="chips">
            {([['add', 'Sumar'], ['sub', 'Restar'], ['set', 'Poner en'], ['zero', 'Poner en cero']] as [Op, string][]).map(([k, lbl]) => (
              <div key={k} className={`chip${op === k ? ' sel' : ''}`} onClick={() => setOp(k)}>{lbl}</div>
            ))}
          </div>
        </div>

        {op !== 'zero' && (
          <div className="field">
            <label>Cantidad</label>
            <input type="text" inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} placeholder="Ej: 10" autoFocus />
          </div>
        )}

        <div className="import-summary-row ok" style={{ background: 'var(--volt-wash)', color: 'var(--volt-ink)' }}>
          Afecta a <b>{affected.length}</b> producto{affected.length === 1 ? '' : 's'}.
        </div>

        {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={applying}>Cancelar</button>
          <button className="btn" onClick={apply} disabled={applying}>{applying ? 'Aplicando…' : 'Aplicar'}</button>
        </div>
      </div>
    </div>
  )
}
