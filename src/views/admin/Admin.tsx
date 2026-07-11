import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAdminSupportAccess, isActiveNow } from '../../hooks/useSupportAccess'
import AdminInicio from './AdminInicio'
import AdminClientes from './AdminClientes'
import AdminDinero from './AdminDinero'
import AdminMetricas from './AdminMetricas'
import AdminControl from './AdminControl'
import AdminSoporte from './AdminSoporte'
import type { Client } from './types'
import { useAdminTickets } from '../../hooks/useSupport'
import { Dashboard } from '../../App'

type AdminView = 'inicio' | 'clientes' | 'dinero' | 'metricas' | 'control' | 'soporte'

export default function Admin() {
  const { signOut, session, setImpersonatedUserId } = useAuth()
  const [view, setView] = useState<AdminView>('inicio')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [impersonating, setImpersonating] = useState<Client | null>(null)
  const [, setTick] = useState(0)   // refresca el contador de tiempo del banner
  const email = session?.user?.email || ''
  const { tickets } = useAdminTickets()
  const pendingSupport = tickets.filter(t => t.status === 'pendiente').length
  const access = useAdminSupportAccess()

  // Solicitud vigente del cliente al que estamos entrando.
  const activeReq = impersonating ? access.byClient[impersonating.id] : null

  // Entrar al panel del cliente: fija el id efectivo (para que TODO el dashboard
  // lea/escriba los datos del cliente) y guarda el cliente para el banner.
  function enterImpersonation(client: Client) {
    setImpersonatedUserId(client.id)
    setImpersonating(client)
  }

  // Salir: cierra la solicitud (si sigue activa) y limpia el modo soporte.
  function exitImpersonation() {
    if (activeReq && isActiveNow(activeReq)) access.endAccess(activeReq.id)
    setImpersonatedUserId(null)
    setImpersonating(null)
  }

  // Si el cliente corta (revoked) o la solicitud deja de estar activa, sacamos
  // al admin del panel al instante (llega por Realtime → access.byClient).
  useEffect(() => {
    if (!impersonating) return
    const r = access.byClient[impersonating.id]
    if (!r || !isActiveNow(r)) {
      setImpersonatedUserId(null)
      setImpersonating(null)
      if (r && (r.status === 'revoked' || r.status === 'expired')) {
        alert(r.status === 'revoked'
          ? 'El cliente cortó el acceso de soporte.'
          : 'El acceso de soporte expiró.')
      }
    }
  }, [access.byClient, impersonating, setImpersonatedUserId])

  // Al llegar a expires_at, cerramos el acceso automáticamente.
  useEffect(() => {
    if (!impersonating || !activeReq?.expires_at) return
    const ms = new Date(activeReq.expires_at).getTime() - Date.now()
    if (ms <= 0) { setImpersonatedUserId(null); setImpersonating(null); return }
    const t = setTimeout(() => { setImpersonatedUserId(null); setImpersonating(null) }, ms)
    return () => clearTimeout(t)
  }, [impersonating, activeReq, setImpersonatedUserId])

  // Contador visible del tiempo restante (tick cada segundo mientras hay acceso).
  useEffect(() => {
    if (!impersonating) return
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [impersonating])

  // Por las dudas: al desmontar el panel admin, limpiar el modo soporte.
  useEffect(() => () => setImpersonatedUserId(null), [setImpersonatedUserId])

  if (impersonating) {
    return (
      <>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 400,
          background: '#ff9500', color: '#fff', padding: '11px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,.15)',
        }}>
          <span>
            Acceso autorizado: <strong>{impersonating.business_name || impersonating.email}</strong>
            {activeReq?.expires_at && (
              <span style={{ opacity: .9, fontWeight: 500 }}> · quedan {fmtRemaining(activeReq.expires_at)}</span>
            )}
          </span>
          <button onClick={exitImpersonation} style={{
            background: 'rgba(0,0,0,.22)', border: 'none', color: '#fff',
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            fontWeight: 700, fontSize: 13, fontFamily: 'Space Grotesk',
          }}>✕ Salir</button>
        </div>
        <div style={{ paddingTop: 46 }}>
          <Dashboard />
        </div>
      </>
    )
  }

  function go(id: AdminView) { setView(id); setSidebarOpen(false) }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="adm-mobile-topbar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(v => !v)} title="Menú" aria-label="Abrir menú">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="brand-logo" style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0 }}>
          <svg viewBox="5 3 28 32" fill="none" style={{ width: 22, height: 22 }}>
            <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
            <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
          </svg>
        </div>
        <span className="adm-mobile-topbar-title">Admin</span>
      </div>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className={`adm-side${sidebarOpen ? ' adm-side-open' : ''}`}>
        <div className="adm-brand">
          <div className="brand-logo" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }}>
            <svg viewBox="5 3 28 32" fill="none" style={{ width: 26, height: 26 }}>
              <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
              <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.2 }}>Admin</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2, maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
          </div>
        </div>

        <nav style={{ flex: 1, paddingTop: 8 }}>
          {([
            { id: 'inicio',   label: 'Panel',     icon: <IcHome /> },
            { id: 'clientes', label: 'Clientes',  icon: <IcUsers /> },
            { id: 'dinero',   label: 'Dinero',    icon: <IcMoney /> },
            { id: 'metricas', label: 'Métricas',  icon: <IcChart /> },
            { id: 'soporte',  label: 'Soporte',   icon: <IcLife /> },
            { id: 'control',  label: 'Control',   icon: <IcSettings /> },
          ] as { id: AdminView; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
            <button key={id} onClick={() => go(id)}
              className={`adm-nav-item${view === id ? ' active' : ''}`}>
              {icon}{label}
              {id === 'soporte' && pendingSupport > 0 && <span className="adm-nav-dot" />}
            </button>
          ))}
        </nav>

        <button onClick={signOut} className="adm-nav-item" style={{ marginBottom: 16 }}>
          <IcLogout /> Cerrar sesión
        </button>
      </div>

      <div className="adm-main">
        <div key={view} className="view-anim">
          {view === 'inicio'   && <AdminInicio onNavigate={v => setView(v as AdminView)} />}
          {view === 'clientes' && <AdminClientes onImpersonate={enterImpersonation} access={access} />}
          {view === 'dinero'   && <AdminDinero />}
          {view === 'metricas' && <AdminMetricas />}
          {view === 'soporte'  && <AdminSoporte />}
          {view === 'control'  && <AdminControl />}
        </div>
      </div>
    </div>
  )
}

// Tiempo restante del acceso, en MM:SS.
function fmtRemaining(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60), s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function IcHome()     { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg> }
function IcUsers()    { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> }
function IcMoney()    { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> }
function IcChart()    { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IcSettings() { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
function IcLogout()   { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function IcLife()     { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M14.9 9.1l4.2-4.2M14.9 9.1l3.5-3.5M4.9 19.1l4.2-4.2"/></svg> }
