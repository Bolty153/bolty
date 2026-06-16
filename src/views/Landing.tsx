interface Props {
  onEnter: () => void
}

const FEATURES = [
  {
    title: 'Atención 24/7 por WhatsApp',
    desc: 'Tu agente de IA responde a tus clientes en cualquier momento, sin que tengas que estar pendiente del teléfono.',
    bg: 'var(--volt-wash)', color: 'var(--volt)',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    title: 'Respuestas automáticas',
    desc: 'Configurá las preguntas frecuentes y dejá que Bolty se encargue de resolver dudas, tomar pedidos y agendar turnos.',
    bg: 'var(--mint-wash)', color: '#018a66',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20">
        <path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z" />
      </svg>
    ),
  },
  {
    title: 'Métricas en un panel claro',
    desc: 'Mirá cuántas conversaciones atendió tu agente, qué tan rápido respondió y cómo evoluciona tu negocio mes a mes.',
    bg: 'var(--amber-wash)', color: 'var(--amber)',
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20">
        <path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-4 4" />
      </svg>
    ),
  },
]

export default function Landing({ onEnter }: Props) {
  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-nav">
          <div className="landing-nav-brand">
            <div className="brand-logo" style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
              <svg viewBox="5 3 28 32" fill="none" style={{ width: '28px', height: '28px' }}>
                <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
                <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
              </svg>
            </div>
            <span>B.O.L.T.Y</span>
          </div>
          <button className="landing-btn-ghost" onClick={onEnter} style={{ padding: '10px 20px', fontSize: '13.5px' }}>
            Ingresar
          </button>
        </div>

        <div className="landing-hero-inner">
          <h1>El agente de <b>IA por WhatsApp</b> que atiende tu negocio</h1>
          <p>
            Bolty conecta tu WhatsApp con un asistente inteligente que responde, agenda y vende por vos,
            las 24 horas. Vos solo mirás los resultados desde tu panel.
          </p>
          <div className="landing-cta">
            <button className="landing-btn-primary" onClick={onEnter}>Ingresar</button>
            {/* Sin link todavía — más adelante puede abrir WhatsApp directo */}
            <button className="landing-btn-ghost">Contactanos</button>
          </div>
        </div>
      </div>

      <div className="landing-feats">
        {FEATURES.map(f => (
          <div key={f.title} className="landing-feat">
            <div className="landing-feat-ic" style={{ background: f.bg, color: f.color }}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="landing-foot">
        © {new Date().getFullYear()} Bolty — Business Online Live Technology for You
      </div>
    </div>
  )
}
