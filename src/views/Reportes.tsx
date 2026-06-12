const topQuestions = [
  { q: '¿Hacen envíos a domicilio?', pct: '92%', count: 88 },
  { q: '¿Atienden los domingos?', pct: '74%', count: 61 },
  { q: '¿Aceptan Mercado Pago?', pct: '60%', count: 49 },
  { q: '¿Tienen planes de vacunación?', pct: '41%', count: 34 },
]

const topProducts = [
  { name: 'Alimento Premium 15kg', pct: '85%', count: 72 },
  { name: 'Pipeta perro mediano', pct: '67%', count: 55 },
  { name: 'Arena sanitaria gato', pct: '50%', count: 41 },
]

const weekSummary = [
  { label: 'Consultas atendidas', value: '312', color: '' },
  { label: 'Terminaron en venta', value: '47', color: 'var(--mint)' },
  { label: 'Turnos reservados', value: '23', color: '' },
  { label: 'Clientes recuperados', value: '9', color: 'var(--mint)' },
]

export default function Reportes() {
  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div><h1>Reportes</h1><div className="sub">Lo que Bolty aprende de tus clientes</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3>¿Qué pregunta la gente?</h3></div>
        <div className="sub">Las dudas más repetidas de la semana — oportunidades para mejorar</div>
        {topQuestions.map((item, i) => (
          <div key={i} className="rank">
            <div className="rank-n">{i + 1}</div>
            <div className="rank-nm">{item.q}</div>
            <div className="rank-bar"><i style={{ width: item.pct }} /></div>
            <div className="rank-c">{item.count}</div>
          </div>
        ))}
        <div className="alert" style={{ marginTop: 16, cursor: 'default' }}>
          <div className="alert-ic" style={{ background: 'var(--volt-wash)', color: 'var(--volt)' }}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9.66 18L9 21h6l-.66-3M12 2v1M12 12a4 4 0 004-4 4 4 0 00-8 0 4 4 0 004 4z" />
            </svg>
          </div>
          <div className="alert-b">
            <h4>Sugerencia de Bolty</h4>
            <p>88 personas preguntaron por envíos. Conviene aclararlo en tu perfil, o evaluar empezar a ofrecerlos.</p>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Lo más consultado</h3></div>
          <div className="sub">Productos que sí tenés y más se piden</div>
          {topProducts.map((item, i) => (
            <div key={i} className="rank">
              <div className="rank-n">{i + 1}</div>
              <div className="rank-nm">{item.name}</div>
              <div className="rank-bar"><i style={{ width: item.pct }} /></div>
              <div className="rank-c">{item.count}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-h"><h3>Tu parte</h3></div>
          <div className="sub">La semana de un vistazo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 4 }}>
            {weekSummary.map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{item.label}</span>
                <span style={{ fontFamily: "'Space Grotesk'", fontWeight: 700, fontSize: 19, color: item.color || 'inherit' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
