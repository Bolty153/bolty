import { useBusinessContext } from '../context/BusinessContext'

export default function Agenda() {
  const { agent } = useBusinessContext()
  const agentName = agent.agent_name || 'Bolty'

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div><h1>Agenda y turnos</h1><div className="sub">Los turnos que {agentName} reserva por vos</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Próximos turnos</h3></div>
        <div className="sub">Reservados solos desde WhatsApp, Instagram o tu web</div>
        <div className="empty-state" style={{ marginTop: 6, minHeight: 180 }}>
          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="38" height="38">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <p>Todavía no hay turnos. Cuando un cliente reserve, lo vas a ver acá automáticamente.</p>
        </div>
      </div>
    </>
  )
}
