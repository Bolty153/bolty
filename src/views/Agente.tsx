import { useState, useEffect } from 'react'
import { useBusinessContext, getBusinessFlags } from '../context/BusinessContext'

const TONES = ['Formal', 'Cercano', 'Divertido', 'Con modismos argentinos']
const BUSINESS_TYPES = ['Solo productos', 'Solo servicios', 'Productos y servicios']

export default function Agente() {
  const { agent, saving, saveAgent, loading } = useBusinessContext()
  const [local, setLocal] = useState(agent)
  const [initialized, setInitialized] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sincronizar una sola vez cuando el contexto termina de cargar desde Supabase
  useEffect(() => {
    if (!loading && !initialized) {
      setLocal(agent)
      setInitialized(true)
    }
  }, [loading, agent, initialized])

  async function handleSave() {
    await saveAgent(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return <div style={{ padding: '40px 0', color: 'var(--ink-faint)', fontSize: 14 }}>Cargando…</div>
  }

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div
            className="greet-av"
            style={{ background: 'linear-gradient(135deg,var(--volt),var(--volt-2))', boxShadow: '0 6px 18px rgba(96,41,255,.25)' }}
          >
            {(local.agent_name || 'B')[0].toUpperCase()}
          </div>
          <div>
            <h1>Mi agente</h1>
            <div className="sub">Configurá cómo se presenta y conversa {local.agent_name || 'tu agente'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3>Personalidad</h3></div>
        <div className="sub">Así habla con tus clientes</div>

        <div className="field">
          <label>Nombre del agente</label>
          <input
            type="text"
            value={local.agent_name}
            onChange={e => setLocal({ ...local, agent_name: e.target.value })}
          />
          <div className="hint">Con este nombre saluda a tus clientes</div>
        </div>

        <div className="field">
          <label>Tono de conversación</label>
          <div className="chips">
            {TONES.map(t => (
              <div
                key={t}
                className={`chip${local.tone === t ? ' sel' : ''}`}
                onClick={() => setLocal({ ...local, tone: t })}
              >{t}</div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Instrucciones especiales para {local.agent_name || 'tu agente'}</label>
          <textarea
            rows={4}
            value={local.instructions}
            onChange={e => setLocal({ ...local, instructions: e.target.value })}
            placeholder="Escribile indicaciones como a un empleado nuevo. Las aprende al instante."
          />
          <div className="hint">Podés decirle cómo manejar situaciones específicas de tu negocio.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saved && <span style={{ color: 'var(--mint)', fontSize: 13, fontWeight: 600 }}>✓ Guardado</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-h"><h3>Tipo de negocio</h3></div>
        <div className="sub">Define qué herramientas ves en tu panel</div>
        <div className="chips">
          {BUSINESS_TYPES.map(t => (
            <div
              key={t}
              className={`chip${local.business_type === t ? ' sel' : ''}`}
              onClick={() => setLocal({ ...local, business_type: t })}
            >{t}</div>
          ))}
        </div>
        {(() => {
          const f = getBusinessFlags(local.business_type)
          const txt = f.products && f.services
            ? 'Ves las secciones de Inventario y Servicios en tu menú.'
            : f.services
              ? 'Ves la sección de Servicios y el módulo de Agenda en tu menú.'
              : 'Ves la sección de Inventario en tu menú.'
          return <div className="hint" style={{ marginTop: 13 }}>{txt}</div>
        })()}
        <button className="btn" style={{ marginTop: 18 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </>
  )
}
