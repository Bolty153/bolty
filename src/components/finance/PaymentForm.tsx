import { useState, useEffect } from 'react'
import Combobox from '../Combobox'
import AccountFields, { emptyAccount } from './AccountFields'
import type { AccountState } from './AccountFields'
import { computeAdjustment, fmtMoney } from '../../hooks/useFinance'
import type { PaymentInput, PayMethod, CardType } from '../../hooks/useFinance'
import type { BankAccount, BankAccountInput } from '../../hooks/useBankAccounts'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface SvcOpt { name: string; price: number; on_request: boolean }

export default function PaymentForm({
  services, accounts, initial, onSaveAccount, onClose, onSave,
}: {
  services: SvcOpt[]
  accounts: BankAccount[]
  initial?: { customer?: string; service?: string; amount?: number }
  onSaveAccount: (a: BankAccountInput) => Promise<void>
  onClose: () => void
  onSave: (input: PaymentInput) => Promise<void>
}) {
  const [customer, setCustomer] = useState(initial?.customer ?? '')
  const [service, setService] = useState(initial?.service ?? '')
  const [base, setBase] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [method, setMethod] = useState<PayMethod>('efectivo')
  const [cardType, setCardType] = useState<CardType>('debito')
  const [account, setAccount] = useState<AccountState>(emptyAccount())
  const [adjType, setAdjType] = useState<'descuento' | 'recargo'>('descuento')
  const [adjValue, setAdjValue] = useState('')
  const [adjUnit, setAdjUnit] = useState<'$' | '%'>('$')
  const [date, setDate] = useState(todayKey())
  const [pending, setPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const baseNum = parseFloat(base.replace(',', '.')) || 0
  const adjustment = computeAdjustment(baseNum, adjType, adjValue, adjUnit)
  const final = Math.max(0, baseNum + adjustment)

  // La cuenta/terminal destino aplica a transferencia y a tarjeta.
  const usesAccount = method === 'transferencia' || method === 'tarjeta'
  // "Pendiente de confirmación" sólo tiene sentido con transferencia (hay un
  // comprobante para verificar en el banco). Con efectivo/tarjeta se resetea,
  // así nunca queda un pago no-transferencia marcado como pendiente.
  const canBePending = method === 'transferencia'
  useEffect(() => { if (!canBePending) setPending(false) }, [canBePending])

  async function submit() {
    setErr(null)
    if (baseNum <= 0) return setErr('Ingresá el monto del servicio.')
    if (method === 'transferencia' && !account.name.trim()) return setErr('Indicá a qué cuenta entró la transferencia.')
    setSaving(true)
    try {
      if (usesAccount && account.save && account.name.trim()) {
        await onSaveAccount({ name: account.name.trim(), bank: account.bank, number: account.number, alias_cbu: account.alias, holder: account.holder })
      }
      await onSave({
        kind: 'servicio',
        customer_name: customer.trim() || null,
        description: service.trim() || 'Pago de servicio',
        amount: final,
        method,
        account: usesAccount ? (account.name.trim() || null) : null,
        card_type: method === 'tarjeta' ? cardType : null,
        adjustment,
        pay_date: date,
        verified: !(canBePending && pending),
      })
    } catch (e) {
      setErr('No se pudo registrar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>Registrar pago de servicio</h2>

        <div className="field">
          <label>Cliente que pagó</label>
          <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Ej: Juan Pérez" />
        </div>

        <div className="field">
          <label>Servicio (opcional)</label>
          <Combobox
            value={service}
            onChange={setService}
            items={services}
            getLabel={s => s.name}
            getSub={s => (s.on_request ? 'A consultar' : fmtMoney(s.price))}
            onPick={s => { if (!s.on_request) setBase(String(s.price)) }}
            placeholder=""
          />
        </div>

        <div className="field">
          <label>Monto *</label>
          <input type="text" inputMode="decimal" value={base} onChange={e => setBase(e.target.value)} placeholder="Ej: 5000" />
        </div>

        <MethodPicker method={method} setMethod={setMethod} />
        {method === 'tarjeta' && <CardTypePicker cardType={cardType} setCardType={setCardType} />}
        {usesAccount && (
          <AccountFields
            accounts={accounts} value={account} onChange={setAccount}
            label={method === 'tarjeta' ? '¿A qué cuenta o terminal entró? (opcional)' : undefined}
          />
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

        {canBePending && <PendingToggle pending={pending} setPending={setPending} />}

        <div className="fin-total-row">
          <span>Total a cobrar</span>
          <b>{fmtMoney(final)}</b>
        </div>

        {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Registrar pago'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Subcomponentes compartidos ── */
export function MethodPicker({ method, setMethod }: {
  method: PayMethod; setMethod: (m: PayMethod) => void
}) {
  return (
    <div className="field">
      <label>Forma de pago</label>
      <div className="chips">
        <div className={`chip${method === 'efectivo' ? ' sel' : ''}`} onClick={() => setMethod('efectivo')}>💵 Efectivo</div>
        <div className={`chip${method === 'transferencia' ? ' sel' : ''}`} onClick={() => setMethod('transferencia')}>🏦 Transferencia</div>
        <div className={`chip${method === 'tarjeta' ? ' sel' : ''}`} onClick={() => setMethod('tarjeta')}>💳 Tarjeta</div>
      </div>
    </div>
  )
}

export function CardTypePicker({ cardType, setCardType }: {
  cardType: CardType; setCardType: (c: CardType) => void
}) {
  return (
    <div className="field">
      <label>Tipo de tarjeta</label>
      <div className="chips">
        <div className={`chip${cardType === 'debito' ? ' sel' : ''}`} onClick={() => setCardType('debito')}>Débito</div>
        <div className={`chip${cardType === 'credito' ? ' sel' : ''}`} onClick={() => setCardType('credito')}>Crédito</div>
      </div>
    </div>
  )
}

// Toggle "Pendiente de confirmación": el dueño recibió el comprobante pero
// todavía no verificó en su banco que la plata entró. Marca verified = FALSE:
// el pago NO cuenta como ingreso hasta que lo confirme.
export function PendingToggle({ pending, setPending }: {
  pending: boolean; setPending: (v: boolean) => void
}) {
  return (
    <label className={`fin-pending-toggle${pending ? ' on' : ''}`}>
      <input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} />
      <span className="fin-pending-txt">
        <b>Pendiente de confirmación</b>
        <small>Recibí el comprobante, pero todavía no verifiqué que entró la plata. No se suma a tus ingresos hasta que lo confirmes.</small>
      </span>
    </label>
  )
}

export function AdjustmentPicker({ adjType, setAdjType, adjValue, setAdjValue, adjUnit, setAdjUnit }: {
  adjType: 'descuento' | 'recargo'; setAdjType: (t: 'descuento' | 'recargo') => void
  adjValue: string; setAdjValue: (s: string) => void
  adjUnit: '$' | '%'; setAdjUnit: (u: '$' | '%') => void
}) {
  return (
    <div className="field">
      <label>Descuento / recargo (opcional)</label>
      <div className="fin-adj">
        <select className="inv-select" value={adjType} onChange={e => setAdjType(e.target.value as 'descuento' | 'recargo')}>
          <option value="descuento">Descuento</option>
          <option value="recargo">Recargo</option>
        </select>
        <input className="fin-adj-num" type="text" inputMode="decimal" value={adjValue} onChange={e => setAdjValue(e.target.value)} placeholder="0" />
        <select className="inv-select" value={adjUnit} onChange={e => setAdjUnit(e.target.value as '$' | '%')}>
          <option value="$">$</option>
          <option value="%">%</option>
        </select>
      </div>
    </div>
  )
}
