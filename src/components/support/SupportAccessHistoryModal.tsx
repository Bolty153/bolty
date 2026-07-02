import { useSupportAccessCtx } from '../../context/SupportAccessContext'
import { accessStatusLabel, accessDuration, isActiveNow, type AccessStatus } from '../../hooks/useSupportAccess'

// Historial de accesos de soporte al panel del cliente: fecha, estado y duración.

const STATUS_COLOR: Record<AccessStatus, { bg: string; fg: string }> = {
  pending: { bg: 'var(--amber-wash)', fg: 'var(--amber)' },
  active:  { bg: 'var(--mint-wash)',  fg: '#018a66' },
  denied:  { bg: 'var(--surf-2)',     fg: 'var(--ink-soft)' },
  revoked: { bg: 'var(--rose-wash)',  fg: 'var(--rose)' },
  expired: { bg: 'var(--surf-2)',     fg: 'var(--ink-soft)' },
  ended:   { bg: 'var(--surf-2)',     fg: 'var(--ink-soft)' },
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function SupportAccessHistoryModal({ onClose }: { onClose: () => void }) {
  const { history, revoke } = useSupportAccessCtx()

  return (
    <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <h2>Accesos de soporte</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '-8px 0 20px' }}>
          Cada vez que el soporte de Bolty entra a tu panel queda registrado acá. El acceso
          siempre necesita tu permiso y podés cortarlo cuando quieras.
        </p>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '32px 0', fontSize: 13.5 }}>
            Todavía no hubo ningún acceso de soporte.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
            {history.map(r => {
              const live = isActiveNow(r)
              const c = STATUS_COLOR[r.status]
              return (
                <div key={r.id} style={{
                  border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtDateTime(r.created_at)}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
                      {r.responded_at ? `Duración: ${accessDuration(r)}` : 'Sin respuesta todavía'}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{
                      background: c.bg, color: c.fg, padding: '4px 10px', borderRadius: 20,
                      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {live ? 'Activo ahora' : accessStatusLabel(r.status)}
                    </span>
                    {live && (
                      <button className="abtn danger" onClick={() => revoke(r.id)}>Cortar</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="modal-actions">
          <button className="abtn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
