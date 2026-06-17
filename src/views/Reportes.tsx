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
        <div className="empty-state" style={{ marginTop: 6 }}>
          <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="36" height="36">
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <p>Todavía no hay datos. Cuando Bolty empiece a responder, vas a ver acá las preguntas más frecuentes de tus clientes.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-h"><h3>Lo más consultado</h3></div>
          <div className="sub">Productos que sí tenés y más se piden</div>
          <div className="empty-state" style={{ marginTop: 6 }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <p>Todavía no hay datos para mostrar.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Tu parte</h3></div>
          <div className="sub">La semana de un vistazo</div>
          <div className="empty-state" style={{ marginTop: 6 }}>
            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="32" height="32">
              <path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-3" />
            </svg>
            <p>Todavía no hay datos. Tu resumen semanal aparece cuando haya actividad.</p>
          </div>
        </div>
      </div>
    </>
  )
}
