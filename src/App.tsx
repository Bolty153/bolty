import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { BusinessProvider, useBusinessContext, getBusinessFlags } from './context/BusinessContext'
import { SupportAccessProvider } from './context/SupportAccessContext'
import TopNav from './components/layout/TopNav'
import Sidebar from './components/layout/Sidebar'
import Inicio from './views/Inicio'
import Agente from './views/Agente'
import Funciones from './views/Funciones'
import Reportes from './views/Reportes'
import Agenda from './views/Agenda'
import Canales from './views/Canales'
import MiNegocio from './views/MiNegocio'
import Productos from './views/Productos'
import Servicios from './views/Servicios'
import Finanzas from './views/Finanzas'
import Onboarding from './views/Onboarding'
import Auth from './views/Auth'
import Landing from './views/Landing'
import Admin from './views/admin/Admin'
import BoltyMascot from './components/BoltyMascot'
import ForcePasswordChange from './views/ForcePasswordChange'
import CustomerFicha from './components/search/CustomerFicha'
import type { NavFocus } from './components/search/GlobalSearch'
import type { Customer } from './hooks/useCustomers'

export type ViewId = 'inicio' | 'agente' | 'funciones' | 'reportes' | 'agenda' | 'canales' | 'negocio' | 'productos' | 'servicios' | 'finanzas'

// Foco de navegación: al abrir un resultado del buscador prefiltramos la vista
// destino. `ts` fuerza que el efecto de la vista se dispare aunque el término repita.
export interface ViewFocus { term?: string; date?: string; ts: number }

function renderView(view: ViewId, onNavigate: (v: ViewId) => void, focus: ViewFocus | null) {
  const f = focus ?? undefined
  switch (view) {
    case 'inicio':    return <Inicio onNavigate={onNavigate} />
    case 'agente':    return <Agente />
    case 'funciones': return <Funciones />
    case 'reportes':  return <Reportes />
    case 'agenda':    return <Agenda focus={f} />
    case 'canales':   return <Canales />
    case 'negocio':   return <MiNegocio onNavigate={onNavigate} />
    case 'productos': return <Productos focus={f} />
    case 'servicios': return <Servicios focus={f} />
    case 'finanzas':  return <Finanzas focus={f} />
  }
}

function DashboardContent() {
  const [view, setView] = useState<ViewId>('inicio')
  const [focus, setFocus] = useState<ViewFocus | null>(null)
  const [ficha, setFicha] = useState<Customer | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { business, agent, loading } = useBusinessContext()

  // Navegación con foco opcional. Sin foco (ej. click en el sidebar) limpia el
  // prefiltro para no reaplicar un término viejo al re-montar la vista.
  function navigateTo(v: ViewId, f?: NavFocus) {
    setFocus(f ? { ...f, ts: Date.now() } : null)
    setView(v)
    setSidebarOpen(false)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '14px',
      }}>
        Cargando…
      </div>
    )
  }

  if (!business.onboarding_complete) {
    return <Onboarding />
  }

  // Según el tipo de negocio se muestran Productos y/o Servicios (y la Agenda).
  // Si la vista activa no está permitida, caemos a Inicio.
  const { products: showProductos, services: showServicios, agenda: showAgenda } = getBusinessFlags(agent.business_type)
  const isAllowed = (v: ViewId) =>
    v === 'productos' ? showProductos :
    v === 'servicios' ? showServicios :
    v === 'agenda' ? showAgenda : true
  const safeView: ViewId = isAllowed(view) ? view : 'inicio'

  return (
    <>
      <TopNav onNavigate={navigateTo} onOpenCustomer={setFicha} onMenuToggle={() => setSidebarOpen(v => !v)} />
      <div className="shell">
        <Sidebar
          activeView={safeView}
          onNavigate={v => navigateTo(v)}
          showProductos={showProductos}
          showServicios={showServicios}
          showAgenda={showAgenda}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        <main className="main">
          <div key={safeView} className="view-anim">
            {renderView(safeView, v => navigateTo(v), focus)}
          </div>
        </main>
      </div>
      {ficha && <CustomerFicha customer={ficha} onClose={() => setFicha(null)} />}
    </>
  )
}

export function Dashboard() {
  return (
    <BusinessProvider>
      <SupportAccessProvider>
        <DashboardContent />
      </SupportAccessProvider>
    </BusinessProvider>
  )
}

function AccessDenied() {
  const { signOut } = useAuth()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px', background: 'var(--bg)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{
          width: '68px', height: '68px', borderRadius: '20px',
          background: 'var(--amber-wash)', color: 'var(--amber)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 22px',
        }}>
          <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="34" height="34">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: '22px', marginBottom: '10px' }}>Tu acceso no está activo</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: '14px', lineHeight: 1.7, marginBottom: '26px' }}>
          Tu cuenta existe pero todavía no tiene acceso al panel de Bolty.
          Contactá al administrador para que la active.
        </p>
        <button className="btn" onClick={signOut} style={{ background: 'var(--ink)', boxShadow: 'none' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function AppContent() {
  const { session, profile, loading, recovery } = useAuth()
  const [showLanding, setShowLanding] = useState(true)

  // Sin sesión SIEMPRE arrancamos por la landing. Al cerrar sesión, volvemos
  // a mostrarla (y no saltar directo al login del intento anterior).
  useEffect(() => {
    if (!session) setShowLanding(true)
  }, [session])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--ink-faint)', fontSize: '14px',
      }}>
        Cargando…
      </div>
    )
  }

  // Recuperación de contraseña (venimos del link del email): pantalla para
  // poner la contraseña nueva, antes que cualquier otra cosa.
  if (recovery) return <ForcePasswordChange mode="recovery" />

  if (!session) {
    // En la landing mostramos a Bolty sólo en la esquina (sin bienvenida central).
    if (showLanding) return <><Landing onEnter={() => setShowLanding(false)} /><BoltyMascot cornerOnly /></>
    return <Auth onBack={() => setShowLanding(true)} />
  }
  if (!profile || !profile.is_active) return <AccessDenied />
  // Primer ingreso con contraseña temporal: obligamos a crear una nueva antes de seguir.
  if (profile.must_change_password) return <ForcePasswordChange />
  if (profile.is_admin) return <><Admin /><BoltyMascot /></>
  return <><Dashboard /><BoltyMascot /></>
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
