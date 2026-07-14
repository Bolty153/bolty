import { useState } from 'react'
import Combobox from '../Combobox'
import AccountFields, { emptyAccount } from './AccountFields'
import type { AccountState } from './AccountFields'
import { fmtMoney } from '../../hooks/useFinance'
import { EXPENSE_CATEGORIES } from '../../hooks/useExpenses'
import type { Expense, ExpenseInput, ExpenseSource } from '../../hooks/useExpenses'
import type { BankAccount, BankAccountInput } from '../../hooks/useBankAccounts'
import type { Card, CardKind } from '../../hooks/useCards'
import type { Employee } from '../../hooks/useEmployees'

const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const OTHER = '__otra__'
const CARD_TYPE_LABEL: Record<CardKind, string> = { credito: 'Crédito', debito: 'Débito' }

export default function ExpenseForm({
  accounts, onSaveAccount, cards, employees = [], expense, onClose, onSave,
}: {
  accounts: BankAccount[]
  onSaveAccount: (a: BankAccountInput) => Promise<void>
  cards?: Card[]
  employees?: Employee[]
  expense?: Expense | null
  onClose: () => void
  onSave: (input: ExpenseInput) => Promise<void>
}) {
  const isKnownCategory = !!expense && EXPENSE_CATEGORIES.includes(expense.category)
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [category, setCategory] = useState(expense ? (isKnownCategory ? expense.category : OTHER) : EXPENSE_CATEGORIES[0])
  const [customCat, setCustomCat] = useState(expense && !isKnownCategory ? expense.category : '')
  const [source, setSource] = useState<ExpenseSource>(expense?.source ?? 'efectivo')
  const [account, setAccount] = useState<AccountState>(expense?.source === 'cuenta_bancaria' ? { ...emptyAccount(), name: expense.account ?? '' } : emptyAccount())
  const [cardName, setCardName] = useState(expense?.source === 'tarjeta_empresa' ? (expense.account ?? '') : '')
  const [employeeId, setEmployeeId] = useState<string>(expense?.employee_id ?? '')
  const [supplier, setSupplier] = useState(expense?.supplier ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [date, setDate] = useState(expense?.expense_date ?? todayKey())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const amtNum = parseFloat(amount.replace(',', '.')) || 0
  const finalCategory = category === OTHER ? customCat.trim() : category

  async function submit() {
    setErr(null)
    if (amtNum <= 0) return setErr('Ingresá el monto del gasto.')
    if (!finalCategory) return setErr('Elegí o escribí una categoría.')
    if (source === 'cuenta_bancaria' && !account.name.trim()) return setErr('Indicá de qué cuenta salen los fondos.')
    if (source === 'tarjeta_empresa' && !cardName.trim()) return setErr('Indicá con qué tarjeta pagaste.')
    setSaving(true)
    try {
      if (source === 'cuenta_bancaria' && account.save && account.name.trim()) {
        await onSaveAccount({ name: account.name.trim(), bank: account.bank, number: account.number, alias_cbu: account.alias, holder: account.holder })
      }
      const accountText =
        source === 'cuenta_bancaria' ? account.name.trim() :
        source === 'tarjeta_empresa' ? cardName.trim() : null
      await onSave({
        amount: amtNum,
        category: finalCategory,
        source,
        account: accountText,
        employee_id: employeeId || null,
        supplier: supplier.trim() || null,
        description: description.trim() || null,
        expense_date: date,
      })
    } catch (e) {
      setErr('No se pudo registrar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{expense ? 'Editar gasto' : 'Registrar gasto'}</h2>

        <div className="field">
          <label>Monto *</label>
          <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
        </div>

        <div className="field">
          <label>Categoría *</label>
          <select className="inv-select" style={{ width: '100%' }} value={category} onChange={e => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            <option value={OTHER}>Otra (escribir)…</option>
          </select>
          {category === OTHER && (
            <input type="text" style={{ marginTop: 10 }} value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="Nombre de la categoría" />
          )}
        </div>

        {employees.length > 0 && (
          <div className="field">
            <label>¿Es de un empleado? (opcional)</label>
            <select className="inv-select" style={{ width: '100%' }} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">Gasto general del negocio</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}{e.role ? ` · ${e.role}` : ''}</option>)}
            </select>
            <div className="hint">Si es un costo de una persona puntual (sueldo, comisión…), elegila para medir su rentabilidad.</div>
          </div>
        )}

        {/* ORIGEN de los fondos con que se paga el gasto */}
        <div className="field">
          <label>Origen de los fondos *</label>
          <div className="chips">
            <div className={`chip${source === 'efectivo' ? ' sel' : ''}`} onClick={() => setSource('efectivo')}>💵 Efectivo</div>
            <div className={`chip${source === 'cuenta_bancaria' ? ' sel' : ''}`} onClick={() => setSource('cuenta_bancaria')}>🏦 Cuenta bancaria</div>
            <div className={`chip${source === 'tarjeta_empresa' ? ' sel' : ''}`} onClick={() => setSource('tarjeta_empresa')}>💳 Tarjeta de la empresa</div>
          </div>
        </div>

        {source === 'cuenta_bancaria' && (
          <AccountFields accounts={accounts} value={account} onChange={setAccount} label="¿De qué cuenta salen los fondos?" />
        )}
        {source === 'tarjeta_empresa' && (
          <div className="field">
            <label>¿Con qué tarjeta?</label>
            <Combobox
              value={cardName}
              onChange={setCardName}
              items={cards ?? []}
              getLabel={c => c.name}
              getSub={c => [c.bank, CARD_TYPE_LABEL[c.type]].filter(Boolean).join(' · ')}
              placeholder="Elegí una guardada o escribí una nueva"
            />
          </div>
        )}

        <div className="field">
          <label>Proveedor (opcional)</label>
          <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Ej: Distribuidora del Centro" />
        </div>

        <div className="field">
          <label>Descripción (opcional)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Compra de mercadería" />
        </div>

        <div className="field">
          <label>Fecha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="fin-total-row">
          <span>Total del gasto</span>
          <b style={{ color: 'var(--rose)' }}>−{fmtMoney(amtNum)}</b>
        </div>

        {err && <div className="onb-error" style={{ marginTop: 12 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : (expense ? 'Guardar cambios' : 'Registrar gasto')}</button>
        </div>
      </div>
    </div>
  )
}
