import { createContext, useContext, useState, type ReactNode } from 'react'
import { useClientSupportAccess, type AccessRequest } from '../hooks/useSupportAccess'

// Lado cliente: comparte el estado de las solicitudes de acceso de soporte
// (una sola suscripción Realtime) y muestra el modal de permiso + el banner
// de "el soporte está viendo tu panel". Lo consumen la campanita y el historial.

interface SupportAccessContextType {
  pending: AccessRequest | null
  active: AccessRequest | null
  history: AccessRequest[]
  loading: boolean
  accept: (id: string) => Promise<void>
  deny: (id: string) => Promise<void>
  revoke: (id: string) => Promise<void>
}

const SupportAccessContext = createContext<SupportAccessContextType>({
  pending: null, active: null, history: [], loading: true,
  accept: async () => {}, deny: async () => {}, revoke: async () => {},
})

export function SupportAccessProvider({ children }: { children: ReactNode }) {
  const { pending, active, history, loading, accept, deny, revoke } = useClientSupportAccess()
  // El cliente puede posponer el modal (queda el aviso en la campanita).
  const [dismissed, setDismissed] = useState(false)
  const showModal = pending && !dismissed

  return (
    <SupportAccessContext.Provider value={{ pending, active, history, loading, accept, deny, revoke }}>
      {active && <SupportAccessBanner onRevoke={() => revoke(active.id)} />}
      <div style={active ? { paddingTop: 48 } : undefined}>
        {children}
      </div>
      {showModal && pending && (
        <SupportAccessModal
          request={pending}
          onAccept={() => accept(pending.id)}
          onDeny={() => deny(pending.id)}
          onDefer={() => setDismissed(true)}
        />
      )}
    </SupportAccessContext.Provider>
  )
}

export function useSupportAccessCtx() {
  return useContext(SupportAccessContext)
}

// "45 minutos" / "1 hora" / "1 h 30 min"
export function fmtDurationText(mins: number): string {
  if (!mins || mins < 60) return `${mins || 30} minutos`
  const h = Math.floor(mins / 60), m = mins % 60
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h} h ${m} min`
}

// ─── Banner fijo mientras el soporte está adentro ──────────────────────────
function SupportAccessBanner({ onRevoke }: { onRevoke: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      background: 'linear-gradient(135deg,var(--volt),var(--volt-2))', color: '#fff',
      padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14,
      boxShadow: '0 2px 12px rgba(96,41,255,.28)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,.3)', flexShrink: 0 }} />
        El soporte de Bolty está viendo tu panel
      </span>
      <button onClick={onRevoke} style={{
        background: 'rgba(255,255,255,.22)', border: 'none', color: '#fff',
        padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
        fontWeight: 700, fontSize: 13, fontFamily: 'Space Grotesk, sans-serif',
      }}>Cortar acceso</button>
    </div>
  )
}

// ─── Modal de permiso cuando llega una solicitud ───────────────────────────
function SupportAccessModal({ request, onAccept, onDeny, onDefer }: {
  request: AccessRequest
  onAccept: () => void
  onDeny: () => void
  onDefer: () => void
}) {
  return (
    <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) onDefer() }}>
      <div className="modal-box" style={{ maxWidth: 440, textAlign: 'center' }}>
        <div className="confirm-ic" style={{ background: 'var(--volt-wash)', color: 'var(--volt)', margin: '0 auto 16px', width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" width="28" height="28">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" /><path d="M12 17h.01" />
          </svg>
        </div>
        <h2>El soporte de Bolty quiere acceder a tu panel</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '8px 0 6px' }}>
          Un integrante del equipo de soporte pide permiso para entrar a tu panel y ayudarte.
          Vas a ver un aviso mientras esté adentro y podés cortar el acceso cuando quieras.
        </p>
        {request.reason && (
          <div style={{ background: 'var(--surf-2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '4px 0 8px', textAlign: 'left' }}>
            <b>Motivo:</b> {request.reason}
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 20 }}>
          El acceso dura hasta {fmtDurationText(request.duration_min)} y es por esta única vez.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button className="abtn" onClick={onDeny}>Rechazar</button>
          <button className="btn" onClick={onAccept} style={{ background: 'var(--volt)' }}>Aceptar acceso</button>
        </div>
        <button onClick={onDefer} style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 12.5, cursor: 'pointer', marginTop: 12, fontFamily: 'inherit' }}>
          Ahora no (te lo recordamos en la campanita)
        </button>
      </div>
    </div>
  )
}
