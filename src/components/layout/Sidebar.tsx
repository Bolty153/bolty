import { useState } from 'react'
import type { ViewId } from '../../App'
import { useBusinessContext } from '../../context/BusinessContext'
import { usePlanRequests, useCurrentPlan } from '../../hooks/usePlanRequests'
import { useSupport } from '../../hooks/useSupport'
import type { TicketType } from '../../hooks/useSupport'
import PlansModal from '../PlansModal'
import SupportModal from '../support/SupportModal'
import SupportAccessHistoryModal from '../support/SupportAccessHistoryModal'
import { useSupportAccessCtx } from '../../context/SupportAccessContext'

interface Props {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  showProductos: boolean
  showServicios: boolean
  showAgenda: boolean
  mobileOpen: boolean
  onMobileClose: () => void
}

interface NavItemDef {
  id: ViewId
  label: string
  icon: React.ReactNode
}

const mainNav: NavItemDef[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    id: 'negocio',
    label: 'Mi negocio',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l1-6h16l1 6" />
        <path d="M3 9a2 2 0 002 2 2 2 0 002-2 2 2 0 002 2 2 2 0 002-2 2 2 0 002 2 2 2 0 002-2" />
        <path d="M5 11v9h14v-9" />
        <path d="M10 15h4v5h-4z" />
      </svg>
    ),
  },
  {
    id: 'agente',
    label: 'Mi agente',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4M8 16h.01M16 16h.01" />
      </svg>
    ),
  },
  {
    id: 'funciones',
    label: 'Funciones',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1L14.5 2h-5l-.3 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1l.3 2.5h5l.3-2.5a7 7 0 001.7-1l2.4 1 2-3.5-2-1.5a7 7 0 00.1-1z" />
      </svg>
    ),
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 3v18h18" />
        <rect x="7" y="12" width="3" height="6" />
        <rect x="12" y="8" width="3" height="10" />
        <rect x="17" y="5" width="3" height="13" />
      </svg>
    ),
  },
]

const productosNav: NavItemDef = {
  id: 'productos',
  label: 'Inventario',
  icon: (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
}

const serviciosNav: NavItemDef = {
  id: 'servicios',
  label: 'Servicios',
  icon: (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14.7 6.3a4 4 0 00-5.6 5.6l-6 6a2 2 0 102.8 2.8l6-6a4 4 0 005.6-5.6l-2.1 2.1-2.2-.6-.6-2.2z" />
    </svg>
  ),
}

const agendaNav: NavItemDef = {
  id: 'agenda',
  label: 'Agenda y turnos',
  icon: (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
}

const equipoNav: NavItemDef = {
  id: 'equipo',
  label: 'Equipo',
  icon: (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
}

const canalesNav: NavItemDef = {
  id: 'canales',
  label: 'Canales',
  icon: (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
}

export default function Sidebar({ activeView, onNavigate, showProductos, showServicios, showAgenda, mobileOpen, onMobileClose }: Props) {
  // Inicio y Mi negocio siempre; luego Productos/Servicios según el tipo de negocio.
  const catalogNav: NavItemDef[] = [
    ...(showProductos ? [productosNav] : []),
    ...(showServicios ? [serviciosNav] : []),
  ]
  const fullMainNav: NavItemDef[] = [mainNav[0], mainNav[1], ...catalogNav, ...mainNav.slice(2)]

  // Canales se muestra siempre; Agenda y Equipo sólo si el negocio trabaja con turnos.
  const servicesNav: NavItemDef[] = showAgenda ? [agendaNav, equipoNav, canalesNav] : [canalesNav]

  const { business } = useBusinessContext()
  const { requestChange } = usePlanRequests()
  const { submit: submitTicket, uploadScreenshot } = useSupport()
  const currentPlan = useCurrentPlan() || ''
  const { pending: accessPending } = useSupportAccessCtx()
  const [plansOpen, setPlansOpen] = useState(false)
  const [supportType, setSupportType] = useState<TicketType | null>(null)
  const [accessHistoryOpen, setAccessHistoryOpen] = useState(false)

  const supportItems: { type: TicketType; label: string; icon: React.ReactNode }[] = [
    { type: 'falla', label: 'Reportar una falla', icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
    ) },
    { type: 'sugerencia', label: 'Enviar sugerencia', icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0012 2z" /></svg>
    ) },
    { type: 'medida', label: 'Servicio a medida', icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z" /></svg>
    ) },
  ]

  return (
    <>
    {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose} />}
    <aside className={`side${mobileOpen ? ' side-open' : ''}`}>
      {/* Zona NAV: scrollea sola si no entran todos los ítems */}
      <div className="side-nav">
        <div className="nav-label">Tu negocio</div>
        {fullMainNav.map(item => (
          <button
            key={item.id}
            className={`nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <div className="nav-sep" />
        <div className="nav-label">Servicios</div>
        {servicesNav.map(item => (
          <button
            key={item.id}
            className={`nav-item${activeView === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        <div className="nav-sep" />
        <div className="nav-label">Soporte y ayuda</div>
        {supportItems.map(item => (
          <button key={item.type} className="nav-item support" onClick={() => { setSupportType(item.type); onMobileClose() }}>
            {item.icon}
            {item.label}
          </button>
        ))}
        <button className="nav-item support" onClick={() => { setAccessHistoryOpen(true); onMobileClose() }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Accesos de soporte
          {accessPending && <span className="adm-nav-dot" />}
        </button>
      </div>

      {/* Zona FOOTER: siempre visible al pie, nunca cortada */}
      <div className="side-foot">
        <div className="upsell">
          <h5>⚡ Subí a Pro+</h5>
          <p>Sumá sucursales ilimitadas y conexión con tu sistema de stock.</p>
          <button onClick={() => { setPlansOpen(true); onMobileClose() }}>Ver planes</button>
        </div>
      </div>
    </aside>

    {plansOpen && (
      <PlansModal
        currentPlan={currentPlan}
        onClose={() => setPlansOpen(false)}
        onRequest={plan => requestChange(plan, business.business_name || '', currentPlan)}
      />
    )}

    {supportType && (
      <SupportModal
        type={supportType}
        uploadScreenshot={uploadScreenshot}
        onClose={() => setSupportType(null)}
        onSubmit={input => submitTicket(input, business.business_name || '', business.phone || '')}
      />
    )}

    {accessHistoryOpen && <SupportAccessHistoryModal onClose={() => setAccessHistoryOpen(false)} />}
    </>
  )
}
