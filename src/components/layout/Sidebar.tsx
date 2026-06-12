import type { ViewId } from '../../App'

interface Props {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
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

const servicesNav: NavItemDef[] = [
  {
    id: 'agenda',
    label: 'Agenda y turnos',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    id: 'canales',
    label: 'Canales',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
]

export default function Sidebar({ activeView, onNavigate }: Props) {
  return (
    <aside className="side">
      <div className="nav-label">Tu negocio</div>
      {mainNav.map(item => (
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
