import { useState } from 'react'
import { fmtMoney } from '../hooks/useFinance'

export const PLAN_NAMES: Record<string, string> = { basico: 'Básico', estandar: 'Estándar', pro: 'Pro' }

interface Plan {
  id: string
  name: string
  price: number
  highlighted?: boolean
  features: string[]
}

const PLANS: Plan[] = [
  {
    id: 'basico', name: 'Básico', price: 50000,
    features: ['1 canal (WhatsApp)', 'Hasta 300 conversaciones/mes', 'Agenda y turnos', 'Inventario y finanzas', 'Soporte por email'],
  },
  {
    id: 'estandar', name: 'Estándar', price: 75000, highlighted: true,
    features: ['WhatsApp + Instagram', 'Hasta 800 conversaciones/mes', 'Todo lo del plan Básico', 'Reportes y métricas', 'Lista de espera inteligente', 'Soporte prioritario'],
  },
  {
    id: 'pro', name: 'Pro', price: 125000,
    features: ['WhatsApp + Instagram + Web', 'Conversaciones ilimitadas', 'Todo lo del plan Estándar', 'Múltiples sucursales', 'Integraciones a medida', 'Soporte dedicado'],
  },
]

export default function PlansModal({ currentPlan, onClose, onRequest }: {
  currentPlan: string
  onClose: () => void
  onRequest: (planId: string) => Promise<void>
}) {
  const [requesting, setRequesting] = useState<string | null>(null)
  const [sentPlan, setSentPlan] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

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
            <p>Pediste pasar al plan <b>{PLAN_NAMES[sentPlan]}</b>. Te vamos a contactar para coordinar el cambio.</p>
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <h2>Planes de Bolty</h2>
            <p className="plans-sub">Elegí el plan que mejor le queda a tu negocio. Lo coordinamos con vos, sin cobro automático.</p>

            <div className="plans-grid">
              {PLANS.map(p => {
                const isCurrent = p.id === currentPlan
                return (
                  <div key={p.id} className={`plan-card${p.highlighted ? ' hl' : ''}${isCurrent ? ' current' : ''}`}>
                    {p.highlighted && !isCurrent && <div className="plan-tag">Más elegido</div>}
                    {isCurrent && <div className="plan-tag current">Tu plan actual</div>}
                    <div className="plan-name">{p.name}</div>
                    <div className="plan-price">{fmtMoney(p.price)}<span>/mes</span></div>
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
                      <button className="btn plan-btn" disabled={requesting === p.id} onClick={() => pedir(p.id)}>
                        {requesting === p.id ? 'Enviando…' : 'Pedir cambio'}
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
