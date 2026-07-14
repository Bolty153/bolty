import { useEffect, useMemo, useRef, useState } from 'react'
import { fmtMoney } from '../../hooks/useFinance'
import type { Expense } from '../../hooks/useExpenses'
import type { BankAccount, BankAccountInput } from '../../hooks/useBankAccounts'
import type { Card, CardInput, CardKind } from '../../hooks/useCards'

type Tab = 'cuentas' | 'tarjetas'
type DelTarget = { kind: Tab; id: string; name: string }

const CLOSE_WARN_DAYS = 5

// Próxima fecha en la que cae un día del mes (clampeado al último día del mes,
// para que día 31 en febrero no desborde a marzo).
function nextDateForDay(day: number, from: Date): Date {
  const dateFor = (y: number, m: number) => {
    const lastDay = new Date(y, m + 1, 0).getDate()
    const d = new Date(y, m, Math.min(day, lastDay))
    d.setHours(0, 0, 0, 0)
    return d
  }
  let candidate = dateFor(from.getFullYear(), from.getMonth())
  if (candidate < from) candidate = dateFor(from.getFullYear(), from.getMonth() + 1)
  return candidate
}

function daysUntil(day: number, from: Date): number {
  const d = nextDateForDay(day, from)
  return Math.round((d.getTime() - from.getTime()) / 86400000)
}

const dayLabel = (n: number) => n === 0 ? 'hoy' : n === 1 ? 'en 1 día' : `en ${n} días`

export default function PaymentMethods({
  accounts, addAccount, updateAccount, deleteAccount,
  cards, addCard, updateCard, deleteCard,
  rangeExpenses, periodLabel, focusTab, focusTs,
}: {
  accounts: BankAccount[]
  addAccount: (input: BankAccountInput) => Promise<void>
  updateAccount: (id: string, input: BankAccountInput) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  cards: Card[]
  addCard: (input: CardInput) => Promise<void>
  updateCard: (id: string, input: CardInput) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  rangeExpenses: Expense[]
  periodLabel: string
  focusTab?: Tab
  focusTs?: number
}) {
  const [tab, setTab] = useState<Tab>('cuentas')
  const rootRef = useRef<HTMLDivElement>(null)

  // Cuando llega un foco desde el buscador global (Cuentas/Tarjetas), abrimos
  // esa pestaña y traemos la sección a la vista. `focusTs` fuerza el re-disparo.
  useEffect(() => {
    if (!focusTab) return
    setTab(focusTab)
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusTs, focusTab])
  const [accFormOpen, setAccFormOpen] = useState(false)
  const [editingAcc, setEditingAcc] = useState<BankAccount | null>(null)
  const [cardFormOpen, setCardFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [toDelete, setToDelete] = useState<DelTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  const expensesByCard = useMemo(() => {
    const map: Record<string, Expense[]> = {}
    rangeExpenses.forEach(e => {
      if (e.source !== 'tarjeta_empresa' || !e.account) return
      const key = e.account.trim().toLowerCase()
      ;(map[key] ??= []).push(e)
    })
    Object.values(map).forEach(list => list.sort((a, b) => b.expense_date.localeCompare(a.expense_date)))
    return map
  }, [rangeExpenses])

  const cardExpenses = (name: string) => expensesByCard[name.trim().toLowerCase()] ?? []
  const cardSpent = (name: string) => cardExpenses(name).reduce((s, e) => s + e.amount, 0)

  // Avisos pasivos: tarjetas de crédito que cierran o vencen pronto (fecha local del navegador).
  const alerts = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const out: { card: Card; text: string; days: number }[] = []
    cards.forEach(c => {
      if (c.type !== 'credito') return
      if (c.closing_day) {
        const d = daysUntil(c.closing_day, now)
        if (d <= CLOSE_WARN_DAYS) out.push({ card: c, text: `${c.name} cierra ${dayLabel(d)}`, days: d })
      }
      if (c.due_day) {
        const d = daysUntil(c.due_day, now)
        if (d <= CLOSE_WARN_DAYS) out.push({ card: c, text: `${c.name} vence ${dayLabel(d)}`, days: d })
      }
    })
    return out.sort((a, b) => a.days - b.days)
  }, [cards])

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      if (toDelete.kind === 'cuentas') await deleteAccount(toDelete.id)
      else await deleteCard(toDelete.id)
      setToDelete(null)
    } catch (e) {
      alert('No se pudo borrar: ' + (e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 18 }} ref={rootRef}>
      <div className="card-h"><h3>Medios de pago</h3></div>
      <div className="sub">Cuentas bancarias y tarjetas que usa tu negocio</div>

      <div className="pm-tabs-row" style={{ marginTop: 14 }}>
        <div className="fin-period-tabs">
          <button className={`fin-period-tab${tab === 'cuentas' ? ' active' : ''}`} onClick={() => setTab('cuentas')}>Cuentas bancarias</button>
          <button className={`fin-period-tab${tab === 'tarjetas' ? ' active' : ''}`} onClick={() => setTab('tarjetas')}>Tarjetas</button>
        </div>
        {tab === 'cuentas'
          ? <button className="btn-outline" onClick={() => { setEditingAcc(null); setAccFormOpen(true) }}>+ Agregar cuenta</button>
          : <button className="btn-outline" onClick={() => { setEditingCard(null); setCardFormOpen(true) }}>+ Agregar tarjeta</button>}
      </div>

      {tab === 'cuentas' ? (
        accounts.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12, minHeight: 100 }}>
            <p>Todavía no cargaste cuentas bancarias.</p>
          </div>
        ) : (
          <div className="pm-list">
            {accounts.map(a => {
              const metaParts = [a.bank, a.number || a.alias_cbu, a.holder].filter(Boolean)
              return (
                <div key={a.id} className="pm-row">
                  <div className="pm-ic">🏦</div>
                  <div className="pm-main">
                    <div className="pm-name-row"><span className="pm-name">{a.name}</span></div>
                    {metaParts.length > 0 && <div className="pm-meta">{metaParts.join(' · ')}</div>}
                  </div>
                  <div className="pm-actions">
                    <button onClick={() => { setEditingAcc(a); setAccFormOpen(true) }}>Editar</button>
                    <button className="danger" onClick={() => setToDelete({ kind: 'cuentas', id: a.id, name: a.name })}>Borrar</button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <>
          {alerts.length > 0 && (
            <div className="pm-alert-list" style={{ marginTop: 14 }}>
              {alerts.map((al, i) => (
                <div key={i} className="alert" style={{ cursor: 'default' }}>
                  <div className="alert-ic" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
                    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  </div>
                  <div className="alert-b"><h4>{al.text}</h4></div>
                </div>
              ))}
            </div>
          )}

          {cards.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 12, minHeight: 100 }}>
              <p>Todavía no cargaste tarjetas.</p>
            </div>
          ) : (
            <div className="pm-list">
              {cards.map(c => {
                const metaParts = [c.bank, c.type === 'credito' && c.closing_day ? `cierra el ${c.closing_day}` : null, c.type === 'credito' && c.due_day ? `vence el ${c.due_day}` : null].filter(Boolean)
                const isOpen = expandedCard === c.id
                const list = c.type === 'credito' ? cardExpenses(c.name) : []
                return (
                  <div key={c.id}>
                    <div className="pm-row">
                      <div className="pm-ic">💳</div>
                      <div className="pm-main">
                        <div className="pm-name-row">
                          <span className="pm-name">{c.name}{c.last4 ? ` ••••${c.last4}` : ''}</span>
                          <span className={`pm-type-badge${c.type === 'credito' ? ' credito' : ''}`}>{c.type === 'credito' ? 'Crédito' : 'Débito'}</span>
                        </div>
                        {metaParts.length > 0 && <div className="pm-meta">{metaParts.join(' · ')}</div>}
                      </div>
                      {c.type === 'credito' && (
                        <button className="pm-spent-btn" onClick={() => setExpandedCard(isOpen ? null : c.id)}>
                          <span className="pm-spent">Gastado · {periodLabel}<br />{fmtMoney(cardSpent(c.name))}</span>
                          <svg className={`pm-chev${isOpen ? ' open' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                      )}
                      <div className="pm-actions">
                        <button onClick={() => { setEditingCard(c); setCardFormOpen(true) }}>Editar</button>
                        <button className="danger" onClick={() => setToDelete({ kind: 'tarjetas', id: c.id, name: c.name })}>Borrar</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="pm-detail">
                        {list.length === 0 ? (
                          <div className="pm-detail-empty">Sin gastos con esta tarjeta en {periodLabel.toLowerCase()}.</div>
                        ) : list.map(e => {
                          const [y, mm, d] = e.expense_date.split('-')
                          return (
                            <div key={e.id} className="pm-detail-row">
                              <span className="pm-detail-date">{d}/{mm}/{y}</span>
                              <span className="pm-detail-desc">{e.description || e.category}</span>
                              <span className="pm-detail-cat">{e.category}</span>
                              <span className="pm-detail-amt">{fmtMoney(e.amount)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {accFormOpen && (
        <AccountFormModal
          account={editingAcc}
          onClose={() => setAccFormOpen(false)}
          onSave={async input => {
            if (editingAcc) await updateAccount(editingAcc.id, input)
            else await addAccount(input)
            setAccFormOpen(false)
          }}
        />
      )}

      {cardFormOpen && (
        <CardFormModal
          card={editingCard}
          onClose={() => setCardFormOpen(false)}
          onSave={async input => {
            if (editingCard) await updateCard(editingCard.id, input)
            else await addCard(input)
            setCardFormOpen(false)
          }}
        />
      )}

      {toDelete && (
        <div className="modal-ov" onClick={() => !deleting && setToDelete(null)}>
          <div className="modal-box confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="26" height="26">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              </svg>
            </div>
            <h2>Borrar {toDelete.kind === 'cuentas' ? 'cuenta' : 'tarjeta'}</h2>
            <p>
              ¿Seguro que querés borrar <b>{toDelete.name}</b>?
              <br />Esto no borra los movimientos ya registrados con esta {toDelete.kind === 'cuentas' ? 'cuenta' : 'tarjeta'}, solo la saca de la lista.
            </p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setToDelete(null)} disabled={deleting}>Volver</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Borrando…' : 'Sí, borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── Alta / edición de cuenta bancaria ───────────── */
function AccountFormModal({
  account, onClose, onSave,
}: {
  account: BankAccount | null
  onClose: () => void
  onSave: (input: BankAccountInput) => Promise<void>
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [bank, setBank] = useState(account?.bank ?? '')
  const [number, setNumber] = useState(account?.number ?? '')
  const [alias, setAlias] = useState(account?.alias_cbu ?? '')
  const [holder, setHolder] = useState(account?.holder ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('El nombre de la cuenta es obligatorio.')
    setSaving(true)
    try {
      await onSave({ name: name.trim(), bank: bank.trim() || null, number: number.trim() || null, alias_cbu: alias.trim() || null, holder: holder.trim() || null })
    } catch (e) {
      setErr('No se pudo guardar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{account ? 'Editar cuenta' : 'Agregar cuenta'}</h2>

        <div className="field">
          <label>Nombre / alias de la cuenta *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Cuenta principal" autoFocus />
        </div>
        <div className="field">
          <label>Banco (opcional)</label>
          <input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="Ej: Banco Nación" />
        </div>
        <div className="field">
          <label>Número de cuenta (opcional)</label>
          <input type="text" value={number} onChange={e => setNumber(e.target.value)} />
        </div>
        <div className="field">
          <label>Alias / CBU (opcional)</label>
          <input type="text" value={alias} onChange={e => setAlias(e.target.value)} />
        </div>
        <div className="field">
          <label>Titular (opcional)</label>
          <input type="text" value={holder} onChange={e => setHolder(e.target.value)} />
        </div>

        {err && <div className="onb-error" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : (account ? 'Guardar cambios' : 'Agregar cuenta')}</button>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Alta / edición de tarjeta ───────────── */
function CardFormModal({
  card, onClose, onSave,
}: {
  card: Card | null
  onClose: () => void
  onSave: (input: CardInput) => Promise<void>
}) {
  const [name, setName] = useState(card?.name ?? '')
  const [bank, setBank] = useState(card?.bank ?? '')
  const [type, setType] = useState<CardKind>(card?.type ?? 'debito')
  const [last4, setLast4] = useState(card?.last4 ?? '')
  const [closingDay, setClosingDay] = useState(card?.closing_day ? String(card.closing_day) : '')
  const [dueDay, setDueDay] = useState(card?.due_day ? String(card.due_day) : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const parseDay = (s: string): number | null => {
    const n = parseInt(s, 10)
    return (!isNaN(n) && n >= 1 && n <= 31) ? n : null
  }

  async function submit() {
    setErr(null)
    if (!name.trim()) return setErr('El nombre de la tarjeta es obligatorio.')
    if (last4.trim() && !/^\d{4}$/.test(last4.trim())) return setErr('Los últimos dígitos tienen que ser exactamente 4 números.')
    if (closingDay.trim() && !parseDay(closingDay)) return setErr('El día de cierre tiene que ser un número entre 1 y 31.')
    if (dueDay.trim() && !parseDay(dueDay)) return setErr('El día de vencimiento tiene que ser un número entre 1 y 31.')
    setSaving(true)
    try {
      await onSave({
        name: name.trim(), bank: bank.trim() || null, type, last4: last4.trim() || null,
        closing_day: type === 'credito' ? parseDay(closingDay) : null,
        due_day: type === 'credito' ? parseDay(dueDay) : null,
      })
    } catch (e) {
      setErr('No se pudo guardar: ' + (e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h2>{card ? 'Editar tarjeta' : 'Agregar tarjeta'}</h2>

        <div className="field">
          <label>Nombre de la tarjeta *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Visa Empresa" autoFocus />
        </div>
        <div className="field">
          <label>Banco (opcional)</label>
          <input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="Ej: Banco Nación" />
        </div>
        <div className="field">
          <label>Últimos 4 dígitos (opcional)</label>
          <input
            type="text" inputMode="numeric" maxLength={4} value={last4}
            onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Ej: 1234"
          />
        </div>

        <div className="field">
          <label>Tipo *</label>
          <div className="chips">
            <div className={`chip${type === 'debito' ? ' sel' : ''}`} onClick={() => setType('debito')}>Débito</div>
            <div className={`chip${type === 'credito' ? ' sel' : ''}`} onClick={() => setType('credito')}>Crédito</div>
          </div>
        </div>

        {type === 'credito' && (
          <div className="pm-2col">
            <div className="field">
              <label>Día de cierre (opcional)</label>
              <input type="number" min={1} max={31} value={closingDay} onChange={e => setClosingDay(e.target.value)} placeholder="Ej: 15" />
            </div>
            <div className="field">
              <label>Día de vencimiento (opcional)</label>
              <input type="number" min={1} max={31} value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="Ej: 22" />
            </div>
          </div>
        )}

        {err && <div className="onb-error" style={{ marginTop: 4 }}>{err}</div>}

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : (card ? 'Guardar cambios' : 'Agregar tarjeta')}</button>
        </div>
      </div>
    </div>
  )
}
