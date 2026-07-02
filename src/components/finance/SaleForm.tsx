import { useMemo, useState } from 'react'
import Combobox from '../Combobox'
import { MethodPicker, CardTypePicker, AdjustmentPicker } from './PaymentForm'
import AccountFields, { emptyAccount } from './AccountFields'
import type { AccountState } from './AccountFields'
import { computeAdjustment, fmtMoney } from '../../hooks/useFinance'
import type { PaymentInput, PayMethod, CardType, PaymentItem } from '../../hooks/useFinance'
import type { BankAccount, BankAccountInput } from '../../hooks/useBankAccounts'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface ProductOpt { id: string; name: string; price: number; stock: number }
interface Row { name: string; qty: string }

export default function SaleForm({
  products, accounts, onSaveAccount, onClose, onSave,
}: {
  products: ProductOpt[]
  accounts: BankAccount[]
  onSaveAccount: (a: BankAccountInput) => Promise<void>
  onClose: () => void
  onSave: (input: PaymentInput, discountStock: boolean) => Promise<void>
}) {
  const [mode, setMode] = useState<'inventario' | 'manual'>('inventario')
  const [rows, setRows] = useState<Row[]>([{ name: '', qty: '1' }])
  const [discountStock, setDiscountStock] = useState(true)
  const [method, setMethod] = useState<PayMethod>('efectivo')
  const [cardType, setCardType] = useState<CardType>('debito')
  const [account, setAccount] = useState<AccountState>(emptyAccount())
  const [adjType, setAdjType] = useState<'descuento' | 'recargo'>('descuento')
  const [adjValue, setAdjValue] = useState('')
  const [adjUnit, setAdjUnit] = useState<'$' | '%'>('$')
  const [date, setDate] = useState(todayKey())
  // manual
  const [manualAmount, setManualAmount] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const findProduct = (name: string) => products.find(p => p.name.toLowerCase() === name.trim().toLowerCase())

  const lineItems = useMemo<PaymentItem[]>(() => {
    const out: PaymentItem[] = []
    rows.forEach(r => {
      const p = findProduct(r.name)
      const qty = parseInt(r.qty, 10)
      if (p && qty > 0) out.push({ product_id: p.id, name: p.name, qty, price: p.price })
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, products])

  const subtotal = lineItems.reduce((s, i) => s + i.qty * i.price, 0)
  const adjustment = computeAdjustment(subtotal, adjType, adjValue, adjUnit)
  const final = Math.max(0, subtotal + adjustment)

  function setRow(i: number, patch: Partial<Row>) { setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addRow() { setRows(prev => [...prev, { name: '', qty: '1' }]) }
  function removeRow(i: number) { setRows(prev => prev.filter((_, idx) => idx !== i)) }

  // La cuenta/terminal destino aplica a transferencia y a tarjeta.
  const usesAccount = method === 'transferencia' || method === 'tarjeta'
  const accountText = usesAccount ? (account.name.trim() || null) : null
  const cardTypeVal: CardType | null = method === 'tarjeta' ? cardType : null

  async function maybeSaveAccount() {
    if (usesAccount && account.save && account.name.trim()) {
      await onSaveAccount({ name: account.name.trim(), bank: account.bank, number: account.number, alias_cbu: account.alias, holder: account.holder })
    }
  }

  async function submit() {
    setErr(null)
    if (method === 'transferencia' && !account.name.trim()) return setErr('Indicá a qué cuenta entró la transferencia.')

    if (mode === 'manual') {
      const amt = parseFloat(manualAmount.replace(',', '.')) || 0
      if (amt <= 0) return setErr('Ingresá el monto de la venta.')
      setSaving(true)
      try {
        await maybeSaveAccount()
        await onSave({
          kind: 'manual',
          description: manualDesc.trim() || 'Venta',
          amount: amt,
          method,
          account: accountText,
          card_type: cardTypeVal,
          adjustment: 0,
          pay_date: date,
        }, false)
      } catch (e) { setErr('No se pudo registrar: ' + (e as Error).message); setSaving(false) }
      return
    }

    if (lineItems.length === 0) return setErr('Elegí al menos un producto de tu inventario.')
    const desc = lineItems.map(i => `${i.qty}× ${i.name}`).join(', ')
    setSaving(true)
    try {
      await maybeSaveAccount()
      await onSave({
        kind: 'producto',
        description: desc,
        amount: final,
        method,
        account: accountText,
        card_type: cardTypeVal,
        adjustment,
        items: lineItems,
        pay_date: date,
      }, discountStock)
    } catch (e) { setErr('No se pudo registrar: ' + (e as Error).message); setSaving(false) }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <h2>Registrar venta</h2>

        <div className="chips" style={{ marginBottom: 16 }}>
          <div className={`chip${mode === 'inventario' ? ' sel' : ''}`} onClick={() => setMode('inventario')}>Desde inventario</div>
          <div className={`chip${mode === 'manual' ? ' sel' : ''}`} onClick={() => setMode('manual')}>Venta manual</div>
        </div>

        {mode === 'inventario' ? (
          <>
            <div className="sale-sec-title">Productos</div>
            <div className="sale-items">
              <div className="sale-head">
                <span>Producto</span><span>Cantidad</span><span>Subtotal</span><span />
              </div>
              {rows.map((r, i) => {
                const p = findProduct(r.name)
                const qty = parseInt(r.qty, 10) || 0
                const line = p ? p.price * qty : 0
                return (
                  <div key={i} className="sale-item">
                    <div className="sale-cell sale-cell-prod">
                      <Combobox
                        value={r.name}
                        onChange={v => setRow(i, { name: v })}
                        items={products}
                        getLabel={p => p.name}
                        getSub={p => `${fmtMoney(p.price)} · ${p.stock} en stock`}
                        placeholder="Elegí un producto"
                      />
                    </div>
                    <div className="sale-cell sale-cell-qty">
                      <input type="text" inputMode="numeric" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} />
                    </div>
                    <div className="sale-cell sale-cell-sub">
                      <span className="sale-sub-lbl">Subtotal:</span>{fmtMoney(line)}
                    </div>
                    <button className="sale-item-del" onClick={() => removeRow(i)} disabled={rows.length === 1} title="Quitar producto">
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <button className="sale-add" onClick={addRow}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" /></svg>
              Agregar producto
            </button>

            <label className="sale-discount">
              <input type="checkbox" checked={discountStock} onChange={e => setDiscountStock(e.target.checked)} />
              <span className="sale-discount-txt">
                <b>Descontar del stock</b>
                <small>Resta las cantidades vendidas del inventario al registrar</small>
              </span>
            </label>

            <MethodPicker method={method} setMethod={setMethod} />
            {method === 'tarjeta' && <CardTypePicker cardType={cardType} setCardType={setCardType} />}
            {usesAccount && (
              <AccountFields accounts={accounts} value={account} onChange={setAccount}
                label={method === 'tarjeta' ? '¿A qué cuenta o terminal entró? (opcional)' : undefined} />
            )}
            <AdjustmentPicker
              adjType={adjType} setAdjType={setAdjType}
              adjValue={adjValue} setAdjValue={setAdjValue}
              adjUnit={adjUnit} setAdjUnit={setAdjUnit}
            />
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="fin-total-row"><span>Total</span><b>{fmtMoney(final)}</b></div>
          </>
        ) : (
          <>
            <div className="field">
              <label>Monto *</label>
              <input type="text" inputMode="decimal" value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder="Ej: 12000" autoFocus />
            </div>
            <div className="field">
              <label>Descripción (opcional)</label>
              <input type="text" value={manualDesc} onChange={e => setManualDesc(e.target.value)} placeholder="Ej: Venta de mostrador" />
            </div>
            <MethodPicker method={method} setMethod={setMethod} />
            {method === 'tarjeta' && <CardTypePicker cardType={cardType} setCardType={setCardType} />}
            {usesAccount && (
              <AccountFields accounts={accounts} value={account} onChange={setAccount}
                label={method === 'tarjeta' ? '¿A qué cuenta o terminal entró? (opcional)' : undefined} />
            )}
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </>
        )}

        {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Registrar venta'}</button>
        </div>
      </div>
    </div>
  )
}
