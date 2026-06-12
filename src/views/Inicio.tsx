const bars = [
  { day: 'Lun', value: 31, height: '48%', peak: false },
  { day: 'Mar', value: 21, height: '32%', peak: false },
  { day: 'Mié', value: 36, height: '55%', peak: false },
  { day: 'Jue', value: 58, height: '90%', peak: true },
  { day: 'Vie', value: 46, height: '70%', peak: false },
  { day: 'Sáb', value: 51, height: '78%', peak: false },
  { day: 'Dom', value: 18, height: '28%', peak: false },
]

const outOfStock = [
  { name: 'Pipeta gato grande', count: 19 },
  { name: 'Alimento renal perro', count: 14 },
  { name: 'Collar isabelino XL', count: 11 },
  { name: 'Shampoo antialérgico', count: 8 },
]

export default function Inicio() {
  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div className="greet-av">VC</div>
          <div>
            <h1>Buenas, Veterinaria Centro</h1>
            <div className="sub">Esto hizo tu agente esta semana</div>
          </div>
        </div>
        <div className="agent-live">
          <div className="av">P</div>
          <div className="meta">
            <div className="nm">Pelusa</div>
            <div className="st"><span className="pulse-dot" />Respondiendo en vivo</div>
          </div>
        </div>
      </div>

      <div className="kpis">
        {/* Consultas */}
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--volt-wash)', color: 'var(--volt)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div className="kpi-spark">
              {['40%','60%','45%','75%','90%'].map((h,i) => <i key={i} style={{ height: h }} />)}
            </div>
          </div>
          <div className="kpi-val">312</div>
          <div className="kpi-lbl">Consultas respondidas</div>
          <div className="kpi-trend up">▲ 18% vs anterior</div>
        </div>

        {/* Ventas */}
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="kpi-spark">
              {['50%','40%','70%','60%','85%'].map((h,i) => <i key={i} style={{ height: h }} />)}
            </div>
          </div>
          <div className="kpi-val">47</div>
          <div className="kpi-lbl">Ventas cerradas</div>
          <div className="kpi-trend up">▲ 9% vs anterior</div>
        </div>

        {/* Turnos — featured */}
        <div className="kpi feat">
          <div className="kpi-top">
            <div className="kpi-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <div className="kpi-spark">
              {['55%','70%','50%','80%','95%'].map((h,i) => <i key={i} style={{ height: h }} />)}
            </div>
          </div>
          <div className="kpi-val">23</div>
          <div className="kpi-lbl">Turnos reservados solos</div>
          <div className="kpi-trend up">▲ 4 más que la anterior</div>
        </div>

        {/* Reclamos */}
        <div className="kpi">
          <div className="kpi-top">
            <div className="kpi-ic" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </div>
          </div>
          <div className="kpi-val">2</div>
          <div className="kpi-lbl">Reclamos para vos</div>
          <div className="kpi-trend warn">Esperan respuesta</div>
        </div>
      </div>

      <div className="sec-title">
        <span className="sq" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </span>
        Alertas en el momento
      </div>

      <div className="alert">
        <div className="alert-ic" style={{ background: 'var(--rose-wash)', color: 'var(--rose)' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
        </div>
        <div className="alert-b">
          <h4>Reclamo fuerte detectado</h4>
          <p>Cliente molesto por un producto vencido. Pelusa ya te lo derivó.</p>
        </div>
        <div className="alert-t">hace 12 min</div>
        <div className="alert-go"><svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg></div>
      </div>

      <div className="alert">
        <div className="alert-ic" style={{ background: 'var(--amber-wash)', color: 'var(--amber)' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" />
          </svg>
        </div>
        <div className="alert-b">
          <h4>Pico raro de consultas</h4>
          <p>15 personas preguntaron por "antipulgas gato" en 2 horas. ¿Promo del día?</p>
        </div>
        <div className="alert-t">hace 1 h</div>
        <div className="alert-go"><svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg></div>
      </div>

      <div className="alert">
        <div className="alert-ic" style={{ background: 'var(--volt-wash)', color: 'var(--volt)' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="alert-b">
          <h4>Cliente grande preguntando</h4>
          <p>Una protectora pidió presupuesto por compra mayorista de alimento.</p>
        </div>
        <div className="alert-t">hace 3 h</div>
        <div className="alert-go"><svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg></div>
      </div>

      <div className="grid-2" style={{ marginTop: 26 }}>
        <div className="card">
          <div className="card-h">
            <h3>Comparador de días</h3>
            <span className="more">Ver detalle</span>
          </div>
          <div className="sub">Cuándo te escriben más, para reforzar o hacer promos</div>
          <div className="bars">
            {bars.map(b => (
              <div key={b.day} className="bw">
                <div className={`bar${b.peak ? ' pk' : ''}`} style={{ height: b.height }}>
                  <span className="bv">{b.value}</span>
                </div>
                <div className="bd">{b.day}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Te piden y no tenés</h3></div>
          <div className="sub">Qué conviene traer</div>
          {outOfStock.map((item, i) => (
            <div key={i} className="rank">
              <div className="rank-n">{i + 1}</div>
              <div className="rank-nm">{item.name}</div>
              <span className="tag-out">{item.count}×</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
