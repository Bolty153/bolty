import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useBusinessContext } from '../../context/BusinessContext'
import { useSupportAccessCtx, fmtDurationText } from '../../context/SupportAccessContext'
import GlobalSearch, { type NavFocus } from '../search/GlobalSearch'
import type { ViewId } from '../../App'
import type { Customer } from '../../hooks/useCustomers'

interface Props {
  onNavigate: (view: ViewId, focus?: NavFocus) => void
  onOpenCustomer: (c: Customer) => void
  onMenuToggle: () => void
}

export default function TopNav({ onNavigate, onOpenCustomer, onMenuToggle }: Props) {
  const { session, signOut } = useAuth()
  const { business } = useBusinessContext()
  const { pending, accept, deny } = useSupportAccessCtx()
  const [notifOpen, setNotifOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const name: string = session?.user?.user_metadata?.name || session?.user?.email || ''
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  const companyName = business.business_name || session?.user?.email?.split('@')[0] || ''
  // Avatar mobile: logo del negocio si tiene, si no la inicial del nombre del negocio (no la del usuario).
  const businessInitial = (business.business_name || companyName || '?').trim().slice(0, 1).toUpperCase()

  useEffect(() => {
    if (!notifOpen) return
    function onClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [notifOpen])

  return (
    <div className="topnav">
      <button className="hamburger-btn" onClick={onMenuToggle} title="Menú" aria-label="Abrir menú">
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <div className="brand">
        <div className="brand-logo">
          <svg viewBox="5 3 28 32" fill="none">
            <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
            <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
          </svg>
        </div>
        <div className="brand-txt">
          <div className="n">Bolty</div>
          <div className="f"><b>B</b>usiness <b>O</b>nline <b>L</b>ive <b>T</b>echnology For <b>Y</b>ou</div>
        </div>
      </div>

      <GlobalSearch onNavigate={onNavigate} onOpenCustomer={onOpenCustomer} />

      <div className="topnav-right">
        {/* Buscador mobile: despliega una barra de búsqueda debajo de la TopNav */}
        <button className="icon-btn mobile-search-btn" onClick={() => setMobileSearchOpen(true)} title="Buscar" aria-label="Buscar">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </button>

        {/* Campanita de notificaciones */}
        <div className="icon-btn notif-trigger" ref={notifRef} onClick={() => setNotifOpen(v => !v)}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {pending && <span className="badge">1</span>}

          {notifOpen && (
            <div className="notif-panel" onClick={e => e.stopPropagation()}>
              <div className="notif-panel-head">Notificaciones</div>
              {pending ? (
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    El soporte de Bolty quiere acceder a tu panel
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 12 }}>
                    {pending.reason || 'Pide permiso para entrar y ayudarte.'} Dura hasta {fmtDurationText(pending.duration_min)}.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="abtn" onClick={() => { deny(pending.id); setNotifOpen(false) }}>Rechazar</button>
                    <button className="abtn primary" onClick={() => { accept(pending.id); setNotifOpen(false) }}>Aceptar</button>
                  </div>
                </div>
              ) : (
                <div className="notif-empty">
                  <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  <p>Todavía no hay notificaciones</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="acct" onClick={signOut} title="Cerrar sesión">
          <div className="acct-av acct-av-desktop">{initials}</div>
          <div className="acct-av acct-av-mobile">
            {business.logo_url
              ? <img src={business.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              : businessInitial}
          </div>
          {companyName && <span className="acct-company">{companyName}</span>}
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--ink-faint)' }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="mobile-search-bar">
          <GlobalSearch
            autoFocus
            onNavigate={(v, f) => { onNavigate(v, f); setMobileSearchOpen(false) }}
            onOpenCustomer={c => { onOpenCustomer(c); setMobileSearchOpen(false) }}
          />
          <button className="mobile-search-close" onClick={() => setMobileSearchOpen(false)} aria-label="Cerrar buscador">✕</button>
        </div>
      )}
    </div>
  )
}
