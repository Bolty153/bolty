import { useState } from 'react'
import { fmtMoney } from '../hooks/useFinance'
// Fuente única de verdad de los planes (ver src/lib/plans.ts).
import { PLANS, PLAN_NAMES } from '../lib/plans'

export default function PlansModal({ currentPlan, onClose, onRequest }: {
  currentPlan: string
  onClose: () => void
  onRequest: (planId: string) => Promise<void>
}) {
  const [requesting, setRequesting] = useState<string | null>(null)
  const [sentPlan, setSentPlan] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const currentOrder = PLANS.find(p => p.key === currentPlan)?.order ?? -1

  async function pedir(planId: string) {
    setErr(null); setRequesting(planId)
    try {
      await onRequest(planId)
      setSentPlan(planId)
    } catch (e) {
      setErr('No se pudo enviar el pedido: ' + (e as Error).message)
    } finally {
      setRequesting(null)
    }
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box plans-box" onClick={e => e.stopPropagation()}>
        {sentPlan ? (
          <div className="plans-done">
            <div className="confirm-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="28" height="28"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2>¡Listo! Recibimos tu pedido</h2>
            <p>Pediste pasar al plan <b>{PLAN_NAMES[sentPlan] || sentPlan}</b>. Te vamos a contactar para coordinar el cambio.</p>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <h2>Planes de Bolty</h2>
            <p className="plans-sub">Elegí el plan que mejor le queda a tu negocio. Lo coordinamos con vos, sin cobro automático.</p>

            <div className="plans-grid plans-grid-4">
              {PLANS.map(p => {
                const isCurrent = p.key === currentPlan
                const isUpgrade = currentOrder >= 0 && p.order > currentOrder
                return (
                  <div key={p.key} className={`plan-card${p.recommended ? ' hl' : ''}${isCurrent ? ' current' : ''}`}>
                    {p.recommended && !isCurrent && <div className="plan-tag">Más elegido</div>}
                    {isCurrent && <div className="plan-tag current">Tu plan actual</div>}
                    <div className="plan-name">{p.name}</div>
                    <div className="plan-price">
                      {p.priceArs != null ? <>{fmtMoney(p.priceArs)}<span>/mes</span></> : <span className="plan-price-ask">Consultar</span>}
                    </div>
                    {isUpgrade && p.unlock && (
                      <div className="plan-unlock">Al subir: {p.unlock}</div>
                    )}
                    <ul className="plan-feats">
                      {p.features.map(f => (
                        <li key={f}>
                          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="15" height="15"><path d="M20 6L9 17l-5-5" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <button className="btn-outline plan-btn" disabled>Plan actual</button>
                    ) : (
                      <button className="btn plan-btn" disabled={requesting === p.key} onClick={() => pedir(p.key)}>
                        {requesting === p.key ? 'Enviando…' : isUpgrade ? 'Subir a este plan' : 'Pedir cambio'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {err && <div className="onb-error" style={{ marginTop: 14 }}>{err}</div>}

            <div className="modal-actions">
              <button className="btn-outline" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
