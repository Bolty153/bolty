import { useLocalStorage } from '../hooks/useLocalStorage'

const tones = ['Formal', 'Cercano', 'Divertido', 'Con modismos argentinos']
const businessTypes = ['Solo productos', 'Solo servicios con turno', 'Productos y turnos']

export default function Agente() {
  const [tone, setTone] = useLocalStorage('bolty_tone', 'Cercano')
  const [businessType, setBusinessType] = useLocalStorage('bolty_business_type', 'Productos y turnos')
  const [agentName, setAgentName] = useLocalStorage('bolty_agent_name', 'Pelusa')
  const [instructions, setInstructions] = useLocalStorage(
    'bolty_instructions',
    'Cuando pregunten por urgencias fuera de horario, decí que atendemos guardia los sábados hasta las 18h. Los domingos no abrimos.'
  )

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av" style={{ background: 'linear-gradient(135deg,var(--volt),var(--volt-2))', boxShadow: '0 6px 18px rgba(96,41,255,.25)' }}>P</div>
          <div>
            <h1>Mi agente</h1>
            <div className="sub">Configurá cómo se presenta y conversa {agentName}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3>Personalidad</h3></div>
        <div className="sub">Así habla con tus clientes</div>

        <div className="field">
          <label>Nombre del agente</label>
          <input type="text" value={agentName} onChange={e => setAgentName(e.target.value)} />
          <div className="hint">Con este nombre saluda a tus clientes</div>
        </div>

        <div className="field">
          <label>Tono de conversación</label>
          <div className="chips">
            {tones.map(t => (
              <div key={t} className={`chip${tone === t ? ' sel' : ''}`} onClick={() => setTone(t)}>{t}</div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Entrená a {agentName} hablándole</label>
          <textarea rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} />
          <div className="hint">Escribile indicaciones como a un empleado nuevo. Las aprende al instante.</div>
        </div>

        <button className="btn">Guardar cambios</button>
      </div>

      <div className="card">
        <div className="card-h"><h3>Tipo de negocio</h3></div>
        <div className="sub">Define qué herramientas ves en tu panel</div>
        <div className="chips">
          {businessTypes.map(t => (
            <div key={t} className={`chip${businessType === t ? ' sel' : ''}`} onClick={() => setBusinessType(t)}>{t}</div>
          ))}
        </div>
        {businessType.includes('turno') && (
          <div className="hint" style={{ marginTop: 13 }}>
            Como elegiste turnos, tenés activo el módulo de Agenda en tu menú.
          </div>
        )}
      </div>
    </>
  )
}
