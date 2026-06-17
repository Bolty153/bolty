import { useBusinessContext } from '../context/BusinessContext'
import type { Day } from '../context/BusinessContext'
import { useProducts, LOW_STOCK_THRESHOLD } from '../hooks/useProducts'
import type { ViewId } from '../App'

const DAY_SHORT: Record<Day, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
}
const DAY_ORDER: Day[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

interface Props {
  onNavigate: (view: ViewId) => void
}

export default function Inicio({ onNavigate }: Props) {
  const { business, agent, loading } = useBusinessContext()
  const { products } = useProducts()

  const lowStock = products.filter(p => p.stock <= LOW_STOCK_THRESHOLD)
  const outStock = lowStock.filter(p => p.stock === 0)

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14 }}>
        Cargando tu panel…
      </div>
    )
  }

  const name = business.business_name || 'tu negocio'
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  const agentInitial = (agent.agent_name || 'B')[0].toUpperCase()
  const hours = business.business_hours ?? {}

  // Primeros pasos: reflejan el estado real de la cuenta
  const steps: { done: boolean; title: string; desc: string; view: ViewId }[] = [
    {
      done: !!(business.business_name && business.address && business.phone),
      title: 'Completá los datos de tu negocio',
      desc: 'Dirección, teléfono y descripción que usa tu agente.',
      view: 'negocio',
    },
    {
      done: !!agent.instructions?.trim(),
      title: `Personalizá a ${agent.agent_name || 'tu agente'}`,
      desc: 'Dale instrucciones para que responda como vos.',
      view: 'agente',
    },
    {
      done: false,
      title: 'Conectá WhatsApp',
      desc: 'Sumá tu número para que empiece a atender 24/7.',
      view: 'canales',
    },
    {
      done: false,
      title: 'Revisá las funciones de tu agente',
      desc: 'Activá lo que quieras: recuperar clientes, promos y más.',
      view: 'funciones',
    },
  ]

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av">
            {business.logo_url
              ? <img src={business.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              : initials
            }
          </div>
          <div>
            <h1>Buenas, {name}</h1>
            <div className="sub">Tu panel de actividad de Bolty</div>
          </div>
        </div>
        <div className="agent-live">
          <div className="av">{agentInitial}</div>
          <div className="meta">
            <div className="nm">{agent.agent_name || 'Bolty'}</div>
            <div className="st"><span className="pulse-dot" />Listo para atender</div>
          </div>
        </div>
      </div>

      {/* KPIs vacíos */}
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--volt-wash)', color: 'var(--volt)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--ink-faint)' }}>—</div>
          <div className="kpi-lbl">Consultas respondidas</div>
          <div className="kpi-trend" style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>Sin datos aún</div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--ink-faint)' }}>—</div>
          <div className="kpi-lbl">Ventas cerradas</div>
          <div className="kpi-trend" style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>Sin datos aún</div>
        </div>

        <div className="kpi feat">
          <div className="kpi-top">
            <div className="kpi-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'rgba(255,255,255,.45)' }}>—</div>
          <div className="kpi-lbl">Turnos reservados</div>
          <div className="kpi-trend" style={{ color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>Sin datos aún</div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>
          </div>
          <div className="kpi-val" style={{ color: 'var(--ink-faint)' }}>—</div>
          <div className="kpi-lbl">Pendientes para vos</div>
          <div className="kpi-trend" style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>Todo tranquilo</div>
        </div>
      </div>

      {/* Aviso de stock bajo */}
      {lowStock.length > 0 && (
        <div className="alert" style={{ marginBottom: 22, cursor: 'pointer' }} onClick={() => onNavigate('productos')}>
          <div className="alert-ic" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>
          <div className="alert-b">
            <h4>
              {outStock.length > 0
                ? `${outStock.length} producto${outStock.length === 1 ? '' : 's'} sin stock`
                : `${lowStock.length} producto${lowStock.length === 1 ? '' : 's'} por agotarse`}
            </h4>
            <p>
              {outStock.length > 0 && `${outStock.length} agotado${outStock.length === 1 ? '' : 's'}. `}
              Tenés {lowStock.length} producto{lowStock.length === 1 ? '' : 's'} con stock bajo. Revisalos para reponer.
            </p>
          </div>
          <span className="alert-go">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </span>
        </div>
      )}

      {/* Primeros pasos + Horarios */}
      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Primeros pasos</h3></div>
          <div className="sub">Dejá todo listo para que tu agente empiece a vender</div>
          <div className="steps-list">
            {steps.map(s => (
              <div key={s.title} className={`step-item${s.done ? ' done' : ''}`}>
                <div className="step-check">
                  {s.done ? (
                    <svg fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : (
                    <svg fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /></svg>
                  )}
                </div>
                <div className="step-body">
                  <h5>{s.title}</h5>
                  <p>{s.desc}</p>
                </div>
                {s.done
                  ? <span className="step-done-lbl">✓ Listo</span>
                  : <button className="step-go" onClick={() => onNavigate(s.view)}>Ir →</button>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Horarios reales */}
        <div className="card">
          <div className="card-h"><h3>Horarios de atención</h3></div>
          <div className="sub">Lo que Bolty le dice a tus clientes</div>
          {Object.keys(hours).length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13, marginTop: 14 }}>
              Todavía no configuraste horarios. Hacelo en "Mi negocio".
            </div>
          ) : (
            <div className="hours-list">
              {DAY_ORDER.map(day => {
                const h = hours[day]
                if (!h) return null
                return (
                  <div key={day} className="hours-row">
                    <span className="hours-day">{DAY_SHORT[day]}</span>
                    {h.open ? (
                      <div className="hours-shifts">
                        <span className="hours-time">{h.from} – {h.to}</span>
                        {h.split && h.from2 && h.to2 && (
                          <span className="hours-time hours-time-2">{h.from2} – {h.to2}</span>
                        )}
                      </div>
                    ) : (
                      <span className="hours-closed">Cerrado</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actividad + Alertas */}
      <div className="grid-2" style={{ marginTop: 18 }}>
        {/* Gráfico de días – estado vacío */}
        <div className="card">
          <div className="card-h"><h3>Actividad por día</h3></div>
          <div className="sub">Cuándo te escriben más, para reforzar o hacer promos</div>
          <div className="empty-state" style={{ marginTop: 12, minHeight: 150 }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32">
              <path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" />
            </svg>
            <p>Los datos aparecen cuando Bolty empiece a atender.</p>
          </div>
        </div>

        {/* Alertas – estado vacío */}
        <div className="card">
          <div className="card-h"><h3>Alertas en el momento</h3></div>
          <div className="sub">Te avisamos al toque si pasa algo importante</div>
          <div className="empty-state" style={{ marginTop: 12, minHeight: 150 }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <p>Todavía no hay alertas. Cuando haya actividad, las vas a ver acá.</p>
          </div>
        </div>
      </div>
    </>
  )
}
