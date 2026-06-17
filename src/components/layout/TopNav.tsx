import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useBusinessContext } from '../../context/BusinessContext'

export default function TopNav() {
  const { session, signOut } = useAuth()
  const { business } = useBusinessContext()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const name: string = session?.user?.user_metadata?.name || session?.user?.email || ''
  const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  const companyName = business.business_name || session?.user?.email?.split('@')[0] || ''

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

      <div className="topnav-search">
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
        </svg>
        Buscar conversaciones, productos…
      </div>

      <div className="topnav-right">
        {/* Campanita de notificaciones */}
        <div className="icon-btn notif-trigger" ref={notifRef} onClick={() => setNotifOpen(v => !v)}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>

          {notifOpen && (
            <div className="notif-panel" onClick={e => e.stopPropagation()}>
              <div className="notif-panel-head">Notificaciones</div>
              <div className="notif-empty">
                <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                <p>Todavía no hay notificaciones</p>
              </div>
            </div>
          )}
        </div>

        <div className="acct" onClick={signOut} title="Cerrar sesión">
          <div className="acct-av">{initials}</div>
          {companyName && <span className="acct-company">{companyName}</span>}
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--ink-faint)' }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </div>
      </div>
    </div>
  )
}
