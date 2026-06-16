import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import TopNav from './components/layout/TopNav'
import Sidebar from './components/layout/Sidebar'
import Inicio from './views/Inicio'
import Agente from './views/Agente'
import Funciones from './views/Funciones'
import Reportes from './views/Reportes'
import Agenda from './views/Agenda'
import Canales from './views/Canales'
import Auth from './views/Auth'
import Landing from './views/Landing'
import Admin from './views/admin/Admin'

export type ViewId = 'inicio' | 'agente' | 'funciones' | 'reportes' | 'agenda' | 'canales'

function renderView(view: ViewId) {
  switch (view) {
    case 'inicio':    return <Inicio />
    case 'agente':    return <Agente />
    case 'funciones': return <Funciones />
    case 'reportes':  return <Reportes />
    case 'agenda':    return <Agenda />
    case 'canales':   return <Canales />
  }
}

function Dashboard() {
  const [view, setView] = useState<ViewId>('inicio')
  return (
    <>
      <TopNav />
      <div className="shell">
        <Sidebar activeView={view} onNavigate={setView} />
        <main className="main">
          <div key={view} className="view-anim">
            {renderView(view)}
          </div>
        </main>
      </div>
    </>
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
        <button className="btn" onClick={signOut}
          style={{ background: 'var(--ink)', boxShadow: 'none' }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function AppContent() {
  const { session, profile, loading } = useAuth()
  const [showLanding, setShowLanding] = useState(true)

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

  if (!session) {
    if (showLanding) return <Landing onEnter={() => setShowLanding(false)} />
    return <Auth onBack={() => setShowLanding(true)} />
  }
  if (!profile || !profile.is_active) return <AccessDenied />
  if (profile.is_admin) return <Admin />
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
