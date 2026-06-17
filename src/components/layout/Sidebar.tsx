import type { ViewId } from '../../App'

interface Props {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
  showProductos: boolean
  showServicios: boolean
  showAgenda: boolean
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

const canalesNav: NavItemDef = {
  id: 'canales',
  label: 'Canales',
  icon: (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
}

export default function Sidebar({ activeView, onNavigate, showProductos, showServicios, showAgenda }: Props) {
  // Inicio y Mi negocio siempre; luego Productos/Servicios según el tipo de negocio.
  const catalogNav: NavItemDef[] = [
    ...(showProductos ? [productosNav] : []),
    ...(showServicios ? [serviciosNav] : []),
  ]
  const fullMainNav: NavItemDef[] = [mainNav[0], mainNav[1], ...catalogNav, ...mainNav.slice(2)]

  // Canales se muestra siempre; Agenda sólo si el negocio trabaja con turnos.
  const servicesNav: NavItemDef[] = showAgenda ? [agendaNav, canalesNav] : [canalesNav]

  return (
    <aside className="side">
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

      <div className="side-foot">
        <div className="upsell">
          <h5>⚡ Subí a Pro+</h5>
          <p>Sumá sucursales ilimitadas y conexión con tu sistema de stock.</p>
          <button>Ver planes</button>
        </div>
      </div>
    </aside>
  )
}
