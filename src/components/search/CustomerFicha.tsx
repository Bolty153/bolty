import { useMemo } from 'react'
import type { Customer } from '../../hooks/useCustomers'
import { useAppointments } from '../../hooks/useAppointments'
import { useFinance, fmtMoney } from '../../hooks/useFinance'
import { useBankAccounts } from '../../hooks/useBankAccounts'

// Ficha completa de un cliente del negocio: sus datos + historial cruzado
// (turnos y pagos/ventas), y en cada pago la cuenta donde se registró.

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  // appt_date / pay_date vienen como 'YYYY-MM-DD'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

const KIND_LABEL: Record<string, string> = { servicio: 'Pago de servicio', producto: 'Venta', manual: 'Venta manual' }

export default function CustomerFicha({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { appointments } = useAppointments()
  const { payments } = useFinance()
  const { accounts } = useBankAccounts()

  // Turnos del cliente: por nombre (sin distinguir mayúsculas) o por teléfono.
  const turnos = useMemo(() =>
    appointments
      .filter(a => eq(a.customer_name, customer.name) || eq(a.phone, customer.phone))
      .sort((a, b) => (b.appt_date + b.appt_time).localeCompare(a.appt_date + a.appt_time)),
    [appointments, customer])

  // Pagos/ventas del cliente: por nombre.
  const pagos = useMemo(() =>
    payments
      .filter(p => eq(p.customer_name, customer.name))
      .sort((a, b) => (b.pay_date).localeCompare(a.pay_date)),
    [payments, customer])

  const totalGastado = useMemo(() => pagos.reduce((s, p) => s + (p.amount || 0), 0), [pagos])

  // Para mostrar banco/CBU: la cuenta del pago es un texto (el nombre).
  const accountByName = useMemo(() => {
    const map: Record<string, typeof accounts[number]> = {}
    accounts.forEach(a => { map[a.name.trim().toLowerCase()] = a })
    return map
  }, [accounts])

  const initials = customer.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box ficha-box" onClick={e => e.stopPropagation()}>
        {/* Encabezado */}
        <div className="ficha-head">
          <div className="ficha-av">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>{customer.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {customer.phone && <span>📞 {customer.phone}</span>}
              {customer.doc_id && <span>🪪 {customer.doc_id}</span>}
            </div>
          </div>
          <button className="abtn" onClick={onClose} style={{ marginLeft: 'auto' }}>Cerrar</button>
        </div>

        {/* Métricas */}
        <div className="ficha-stats">
          <div className="ficha-stat"><b>{turnos.length}</b><span>Turnos</span></div>
          <div className="ficha-stat"><b>{pagos.length}</b><span>Pagos</span></div>
          <div className="ficha-stat"><b>{fmtMoney(totalGastado)}</b><span>Total</span></div>
        </div>

        {customer.notes && (
          <div className="ficha-notes">
            <div className="ficha-lbl">Notas</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{customer.notes}</div>
          </div>
        )}

        {/* Turnos */}
        <div className="ficha-sect">
          <div className="ficha-lbl">Turnos ({turnos.length})</div>
          {turnos.length === 0 ? (
            <div className="ficha-empty">Sin turnos registrados.</div>
          ) : (
            <div className="ficha-list">
              {turnos.map(t => (
                <div key={t.id} className="ficha-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.service_name || 'Turno'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {fmtDate(t.appt_date)} · {t.appt_time}{t.status ? ` · ${t.status}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {t.price != null && <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fmtMoney(t.price)}</div>}
                    <span className="ficha-tag" style={{
                      background: t.paid ? 'var(--mint-wash)' : 'var(--surf-2)',
                      color: t.paid ? '#018a66' : 'var(--ink-soft)',
                    }}>{t.paid ? 'Cobrado' : 'Sin cobrar'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagos y ventas */}
        <div className="ficha-sect">
          <div className="ficha-lbl">Pagos y ventas ({pagos.length})</div>
          {pagos.length === 0 ? (
            <div className="ficha-empty">Sin pagos registrados.</div>
          ) : (
            <div className="ficha-list">
              {pagos.map(p => {
                const acc = p.account ? accountByName[p.account.trim().toLowerCase()] : undefined
                const cuentaTxt = p.method === 'transferencia'
                  ? (p.account || 'Transferencia') + (acc?.bank ? ` · ${acc.bank}` : '') + (acc?.alias_cbu ? ` · ${acc.alias_cbu}` : '')
                  : 'Efectivo'
                return (
                  <div key={p.id} className="ficha-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {KIND_LABEL[p.kind] || 'Pago'}{p.description ? ` · ${p.description}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        {fmtDate(p.pay_date)} · {cuentaTxt}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{fmtMoney(p.amount)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
