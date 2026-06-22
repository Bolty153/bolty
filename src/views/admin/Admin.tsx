import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import AdminInicio from './AdminInicio'
import AdminClientes from './AdminClientes'
import AdminDinero from './AdminDinero'
import AdminMetricas from './AdminMetricas'
import AdminControl from './AdminControl'
import AdminSoporte from './AdminSoporte'
import type { Client } from './types'
import { statusLabel, fmtDate, fmtMoney } from './utils'
import { useAdminTickets } from '../../hooks/useSupport'

type AdminView = 'inicio' | 'clientes' | 'dinero' | 'metricas' | 'control' | 'soporte'

export default function Admin() {
  const { signOut, session } = useAuth()
  const [view, setView] = useState<AdminView>('inicio')
  const [impersonating, setImpersonating] = useState<Client | null>(null)
  const email = session?.user?.email || ''
  const { tickets } = useAdminTickets()
  const pendingSupport = tickets.filter(t => t.status === 'pendiente').length

  if (impersonating) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          background: '#ff9500', color: '#fff', padding: '11px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,.15)',
        }}>
          <span>Vista de soporte: <strong>{impersonating.business_name || impersonating.email}</strong></span>
          <button onClick={() => setImpersonating(null)} style={{
            background: 'rgba(0,0,0,.22)', border: 'none', color: '#fff',
            padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
            fontWeight: 700, fontSize: 13, fontFamily: 'Space Grotesk',
          }}>✕ Salir</button>
        </div>
        <div style={{ paddingTop: 60, padding: '72px 24px 40px', maxWidth: 680, margin: '0 auto' }}>
          <div className="card">
            <h2 style={{ fontSize: 22, marginBottom: 20 }}>{impersonating.business_name || impersonating.email}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { l: 'Email', v: impersonating.email },
                { l: 'WhatsApp', v: impersonating.whatsapp || '—' },
                { l: 'Plan', v: impersonating.plan?.name || 'Sin plan' },
                { l: 'Precio', v: impersonating.plan ? fmtMoney(impersonating.plan.price_ars) + '/mes' : '—' },
                { l: 'Estado', v: statusLabel(impersonating.status) },
                { l: 'Vence', v: fmtDate(impersonating.paid_until) },
                { l: 'Cliente desde', v: fmtDate(impersonating.created_at) },
                { l: 'Prueba hasta', v: fmtDate(impersonating.trial_ends_at) },
              ].map(({ l, v }) => (
                <div key={l}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-faint)', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            {impersonating.notes && (
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--surf-2)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-faint)', marginBottom: 6 }}>Notas internas</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{impersonating.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="adm-side">
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
            <button key={id} onClick={() => setView(id)}
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
          {view === 'clientes' && <AdminClientes onImpersonate={setImpersonating} />}
          {view === 'dinero'   && <AdminDinero />}
          {view === 'metricas' && <AdminMetricas />}
          {view === 'soporte'  && <AdminSoporte />}
          {view === 'control'  && <AdminControl />}
        </div>
      </div>
    </div>
  )
}

function IcHome()     { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg> }
function IcUsers()    { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> }
function IcMoney()    { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> }
function IcChart()    { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IcSettings() { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg> }
function IcLogout()   { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function IcLife()     { return <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M14.9 9.1l4.2-4.2M14.9 9.1l3.5-3.5M4.9 19.1l4.2-4.2"/></svg> }
