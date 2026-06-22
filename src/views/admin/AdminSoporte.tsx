import { useState } from 'react'
import { useAdminTickets } from '../../hooks/useSupport'
import type { TicketType } from '../../hooks/useSupport'
import { fmtDate } from './utils'

const TABS: { key: TicketType; label: string; empty: string }[] = [
  { key: 'falla', label: 'Fallas', empty: 'No hay fallas reportadas.' },
  { key: 'sugerencia', label: 'Sugerencias', empty: 'No hay sugerencias.' },
  { key: 'medida', label: 'Servicio a medida', empty: 'No hay pedidos a medida.' },
]

export default function AdminSoporte() {
  const { tickets, loading, setStatus } = useAdminTickets()
  const [tab, setTab] = useState<TicketType>('falla')

  const list = tickets.filter(t => t.type === tab)
  const pending = (type: TicketType) => tickets.filter(t => t.type === type && t.status === 'pendiente').length

  return (
    <>
      <div className="adm-page-head">
        <div><h1>Soporte</h1><p>Reportes de falla, sugerencias y pedidos de servicio a medida</p></div>
      </div>

      <div className="adm-toolbar">
        {TABS.map(t => (
          <button key={t.key} className={`adm-filter-btn${tab === t.key ? ' sel' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{pending(t.key) > 0 ? ` (${pending(t.key)})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="adm-empty">Cargando…</div>
      ) : list.length === 0 ? (
        <div className="adm-empty">{TABS.find(t => t.key === tab)?.empty}</div>
      ) : (
        <div className="adm-sect" style={{ padding: 0, overflow: 'hidden' }}>
          {list.map(t => (
            <div key={t.id} className="sup-row">
              <div className="sup-main">
                <div className="sup-top">
                  {t.title && <b>{t.title}</b>}
                  <span className={`sup-badge ${t.status}`}>{t.status === 'resuelto' ? 'Resuelto' : 'Pendiente'}</span>
                </div>
                <div className="sup-desc">{t.description}</div>
                {t.screenshot_url && (
                  <a href={t.screenshot_url} target="_blank" rel="noreferrer" className="link-btn" style={{ fontSize: 12.5 }}>Ver captura adjunta</a>
                )}
                <div className="sup-meta">
                  {t.business_name || 'Cliente'}
                  {t.phone && <> · <a href={`tel:${t.phone.replace(/\s/g, '')}`} className="sup-phone">📞 {t.phone}</a></>}
                  {' '}· {fmtDate(t.created_at)}
                </div>
              </div>
              <div className="sup-actions">
                {t.status === 'pendiente'
                  ? <button className="abtn primary" onClick={() => setStatus(t.id, 'resuelto')}>Marcar resuelto</button>
                  : <button className="abtn" onClick={() => setStatus(t.id, 'pendiente')}>Reabrir</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
