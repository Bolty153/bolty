import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  onEnter: () => void
}

// Bolty no tiene registro libre: el acceso lo da el admin a mano.
// Estos botones quedan listos para conectar a WhatsApp o un formulario de contacto.
function handleContact() {
  // TODO: reemplazar por wa.me/<numero> o un formulario cuando esté definido.
}

// ───────────────────────── Reveal-on-scroll ─────────────────────────
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect() }
    }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, inView }
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal${inView ? ' in' : ''}${className ? ' ' + className : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// ───────────────────────── Iconos ─────────────────────────
function Icon({ d, viewBox = '0 0 24 24' }: { d: ReactNode; viewBox?: string }) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      viewBox={viewBox} width="20" height="20">{d}</svg>
  )
}
const ICONS = {
  check: <path d="M20 6L9 17l-5-5" />,
  whatsapp: <><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></>,
  mic: <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4" /></>,
  camera: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></>,
  box: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" />,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-4 4" /></>,
  bell: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" /></>,
  paw: <><circle cx="6" cy="9" r="2" /><circle cx="11" cy="5.5" r="2" /><circle cx="16" cy="5.5" r="2" /><circle cx="20" cy="9" r="2" /><path d="M9 18.5c0-2.5 2-4.5 4-4.5s4 2 4 4.5-1.8 3.5-4 3.5-4-1-4-3.5z" /></>,
  wrench: <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.4-3.4a6 6 0 01-7.9 7.9L4.7 22.3a2.1 2.1 0 01-3-3L10.2 11A6 6 0 0118.1 3.1l-3.4 3.2z" />,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" /></>,
  utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3z" /></>,
  cross: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  shirt: <path d="M16 4l4 3-3 3-1-1v9H8v-9l-1 1-3-3 4-3 2 2h4z" />,
  bag: <><path d="M6 7h12l1 13H5L6 7z" /><path d="M9 7V5a3 3 0 016 0v2" /></>,
  dumbbell: <><path d="M6.5 6.5l11 11M4 9l3-3M17 6l3-3M9 4l3-3 2 2-3 3M15 20l3 3-2 2-3-3M2.5 14.5l3-3M19 17l3-3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  zap: <path d="M13 2L3 14h7l-1 8 11-12h-7l1-8z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  trend: <><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
}

// ───────────────────────── Data ─────────────────────────
const STATS = [
  { num: '78%', lbl: 'de los clientes le compra al primero que le contesta. El que tarda, pierde.' },
  { num: '+3 hs', lbl: 'es el tiempo promedio que tarda un negocio en responder un WhatsApp.' },
  { num: '1 de 3', lbl: 'clientes no vuelve a escribir si lo dejaste esperando demasiado.' },
]

const STEPS = [
  { n: '1', h: 'Configurás tu negocio en minutos', p: 'Cargás tus productos, precios, horarios y preguntas frecuentes. Sin programar nada.' },
  { n: '2', h: 'Conectás tu WhatsApp', p: 'Usás el número que ya tenés, con tus contactos de siempre. No perdés nada.' },
  { n: '3', h: 'Bolty atiende solo, 24/7', p: 'Responde, agenda, vende y te avisa lo importante. Vos solo mirás los resultados.' },
]

const FEATURES = [
  { t: 'WhatsApp, Instagram y web', d: 'Atendé todos tus canales desde un solo lugar, sin perseguir mensajes.', ic: ICONS.whatsapp, bg: 'var(--mint-wash)', c: '#018a66' },
  { t: 'Entiende audios', d: '¿Tu cliente te manda un audio? Bolty lo escucha y responde como una persona.', ic: ICONS.mic, bg: 'var(--volt-wash)', c: 'var(--volt)' },
  { t: 'Lee fotos de productos', d: 'Le mandan una foto y Bolty identifica de qué producto se trata.', ic: ICONS.camera, bg: 'var(--amber-wash)', c: 'var(--amber)' },
  { t: 'Stock en tiempo real', d: 'Nunca más le digas a un cliente "no sé si tengo". Bolty lo sabe al instante.', ic: ICONS.box, bg: 'var(--rose-wash)', c: 'var(--rose)' },
  { t: 'Agenda turnos solo', d: 'Coordina turnos y citas sin que vos muevas un dedo.', ic: ICONS.calendar, bg: 'var(--volt-wash)', c: 'var(--volt)' },
  { t: 'Recupera clientes', d: 'Le escribe a quien no volvió, antes de que se olvide de vos.', ic: ICONS.heart, bg: 'var(--mint-wash)', c: '#018a66' },
  { t: 'Sabe cuándo no sabe', d: 'Si una consulta es compleja, te la deriva a vos en el momento, sin inventar.', ic: ICONS.alert, bg: 'var(--amber-wash)', c: 'var(--amber)' },
  { t: 'Reportes inteligentes', d: 'Te dice qué se vende, qué falta y cuándo reforzar. Más abajo te mostramos cómo.', ic: ICONS.chart, bg: 'var(--volt-wash)', c: 'var(--volt)' },
  { t: 'Alertas en el momento', d: 'Reclamo fuerte, pico de consultas o cliente importante: te avisa al toque.', ic: ICONS.bell, bg: 'var(--rose-wash)', c: 'var(--rose)' },
]

const RUBROS = [
  { t: 'Veterinarias', ic: ICONS.paw },
  { t: 'Ferreterías', ic: ICONS.wrench },
  { t: 'Peluquerías y barberías', ic: ICONS.scissors },
  { t: 'Restaurantes y deliveries', ic: ICONS.utensils },
  { t: 'Farmacias', ic: ICONS.cross },
  { t: 'Tiendas de ropa', ic: ICONS.shirt },
  { t: 'Kioscos y almacenes', ic: ICONS.bag },
  { t: 'Gimnasios y estudios', ic: ICONS.dumbbell },
]

const BENEFITS = [
  { t: 'Ahorrás tiempo de verdad', d: 'Dejá de contestar lo mismo 40 veces por día. Bolty se encarga, vos te ocupás de tu negocio.', ic: ICONS.clock },
  { t: 'Vendés más, sin esfuerzo', d: 'Cada consulta que hoy se pierde, mañana puede ser una venta cerrada por Bolty.', ic: ICONS.trend },
  { t: 'Nunca perdés un cliente', d: 'Respuesta inmediata, a cualquier hora. Ni feriados, ni domingos, ni 3 AM.', ic: ICONS.zap },
  { t: 'Atención siempre profesional', d: 'Mismo tono, mismo nivel de atención, todas las veces. Sin un mal día.', ic: ICONS.shield },
  { t: 'Decisiones con datos reales', d: 'Bolty te muestra qué pasa en tu negocio, no tenés que adivinar.', ic: ICONS.chart },
  { t: 'Crece mientras dormís', d: 'Tu negocio sigue atendiendo, agendando y vendiendo aunque vos no estés.', ic: ICONS.heart },
]

const PLANS = [
  {
    name: 'Básico', price: '—', desc: 'Para arrancar a automatizar tu WhatsApp.',
    feats: ['1 canal de WhatsApp', 'Respuestas automáticas 24/7', 'Agenda de turnos', 'Reporte diario', 'Soporte por chat'],
    featured: false,
  },
  {
    name: 'Pro', price: '—', desc: 'El más elegido por negocios que ya venden por WhatsApp.',
    feats: ['Todo lo del plan Básico', 'WhatsApp + Instagram + Web', 'Entiende audios y fotos', 'Consulta de stock en vivo', 'Reportes semanales inteligentes', 'Alertas en el momento'],
    featured: true,
  },
  {
    name: 'Empresa', price: '—', desc: 'Para negocios con varias sucursales o mucho volumen.',
    feats: ['Todo lo del plan Pro', 'Múltiples sucursales', 'Catálogo y stock avanzado', 'Reportes a medida', 'Soporte prioritario'],
    featured: false,
  },
]

const FAQS = [
  { q: '¿Necesito saber de tecnología para usarlo?', a: 'No. Vos cargás la información de tu negocio en un panel simple, en español, y Bolty hace el resto. No hay que programar ni instalar nada.' },
  { q: '¿Funciona con mi WhatsApp actual o necesito uno nuevo?', a: 'Funciona con tu número de siempre. No perdés tus contactos, tu historial ni tu identidad. Bolty se integra, no te hace empezar de cero.' },
  { q: '¿Cuánto tarda en estar listo y funcionando?', a: 'Por lo general, en minutos. Cargás tu negocio, conectás tu WhatsApp y Bolty ya puede empezar a atender.' },
  { q: '¿Bolty puede inventar respuestas o decir cosas que no sabe?', a: 'No. Cuando una consulta es compleja o no tiene la info, Bolty te la deriva a vos en el momento en lugar de improvisar.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí, sin letra chica. El acceso lo administramos nosotros para darte una atención más personal, y podés dar de baja cuando quieras.' },
  { q: '¿Y si tengo muchos productos o un catálogo grande?', a: 'No hay problema. Bolty está pensado para consultar stock y catálogos grandes en tiempo real, sin que tengas que simplificar nada.' },
]

// ───────────────────────── Componente ─────────────────────────
export default function Landing({ onEnter }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="landing">

      {/* ===== HERO ===== */}
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
        </div>

        <div className="landing-hero-inner">
          <span className="landing-eyebrow">🤖 Agente de IA para WhatsApp</span>
          <h1>El empleado que tu negocio <b>necesitaba</b>, y todavía no tenía</h1>
          <p>
            Bolty atiende tu WhatsApp, responde al instante, agenda turnos y vende por vos,
            las 24 horas, los 365 días del año. Sin descanso, sin mal humor, sin faltar nunca.
          </p>
          <div className="landing-cta">
            <button className="landing-btn-primary" onClick={onEnter}>Ingresar</button>
            <button className="landing-btn-ghost" onClick={handleContact}>Contactanos</button>
          </div>
        </div>

        <div className="landing-scroll-hint">
          <span>Conocé cómo funciona</span>
          <Icon d={ICONS.chevron} />
        </div>
      </div>

      {/* ===== EL PROBLEMA ===== */}
      <section className="lp-section" id="problema">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">El problema</span>
              <h2>¿Cuántos clientes ya perdiste por no contestar a tiempo?</h2>
              <p>
                Mientras dormís, atendés a otro cliente o estás arriba de un mostrador, tu WhatsApp
                se llena de mensajes sin responder. Y cada minuto que pasa, es un cliente que se va
                derechito a la competencia.
              </p>
            </div>
          </Reveal>
          <div className="lp-stats">
            {STATS.map((s, i) => (
              <Reveal key={s.num} delay={i * 90}>
                <div className="lp-stat">
                  <div className="num">{s.num}</div>
                  <div className="lbl">{s.lbl}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LA SOLUCIÓN ===== */}
      <section className="lp-section tight" id="solucion" style={{ background: 'var(--surf-2)' }}>
        <div className="lp-wrap">
          <div className="lp-split">
            <Reveal>
              <div className="lp-split-text">
                <span className="lp-eyebrow">La solución</span>
                <h2>Bolty es el empleado con IA que nunca duerme</h2>
                <p>
                  No es un chatbot que repite frases armadas. Es un agente con inteligencia artificial
                  que entiende a tus clientes, responde al instante y se mueve solo para que tu negocio
                  no pierda ni una venta.
                </p>
                <div className="lp-bullets">
                  <div className="lp-bullet">
                    <span className="ic"><Icon d={ICONS.check} /></span>
                    <p>Responde como una persona, no como un robot con menú de opciones.</p>
                  </div>
                  <div className="lp-bullet">
                    <span className="ic"><Icon d={ICONS.check} /></span>
                    <p>Vende, agenda turnos y resuelve dudas sin que vos tengas que estar atrás.</p>
                  </div>
                  <div className="lp-bullet">
                    <span className="ic"><Icon d={ICONS.check} /></span>
                    <p>Trabaja 24/7: feriados, madrugadas y fines de semana incluidos.</p>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="lp-chat-mock">
                <div className="lp-chat-head">
                  <span className="dot" />
                  <b>Bolty</b>
                  <span>en línea</span>
                </div>
                <div className="lp-chat-bubble in">Hola! ¿Tienen el champú antipulgas para perro grande?</div>
                <div className="lp-chat-bubble out">¡Hola! Sí, tenemos en stock 🐶 Sale $12.500. ¿Te lo reservo para retirar hoy?</div>
                <div className="lp-chat-bubble in">Sí, dale. ¿A qué hora cierran?</div>
                <div className="lp-chat-bubble out">Cerramos a las 20 hs. Te dejo reservado a tu nombre. ¡Te esperamos! 🙌</div>
                <div className="lp-chat-typing"><i /><i /><i /></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== CÓMO FUNCIONA ===== */}
      <section className="lp-section" id="como-funciona">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">Cómo funciona</span>
              <h2>Empezar es más fácil de lo que pensás</h2>
              <p>En 3 pasos simples, tu negocio ya tiene un agente trabajando para vos.</p>
            </div>
          </Reveal>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="lp-step">
                  <div className="n">{s.n}</div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FUNCIONES DESTACADAS ===== */}
      <section className="lp-section tight" id="funciones" style={{ background: 'var(--surf-2)' }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">Funciones destacadas</span>
              <h2>Todo lo que tu negocio necesita, en un solo agente</h2>
              <p>Bolty no solo contesta. Entiende, resuelve y se anticipa.</p>
            </div>
          </Reveal>
          <div className="lp-feat-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 80}>
                <div className="lp-feat-card">
                  <div className="lp-feat-ic" style={{ background: f.bg, color: f.c }}><Icon d={f.ic} /></div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== REPORTES INTELIGENTES (protagonismo especial) ===== */}
      <section className="lp-section" id="reportes">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-reports">
              <div className="lp-reports-head">
                <span className="lp-eyebrow">El diferencial de Bolty</span>
                <h2>Bolty no solo atiende. Te dice cómo hacer crecer tu negocio</h2>
                <p>
                  Además de responder a tus clientes, Bolty mira los números todos los días y te los
                  traduce en decisiones simples. Es como tener un asesor de negocios, además de un empleado.
                </p>
              </div>

              <div className="lp-report-strip">
                <div className="lp-report-pill"><div className="v">38</div><div className="l">consultas hoy</div></div>
                <div className="lp-report-pill"><div className="v">5</div><div className="l">turnos agendados</div></div>
                <div className="lp-report-pill"><div className="v">12</div><div className="l">ventas cerradas</div></div>
                <div className="lp-report-pill"><div className="v">2</div><div className="l">reclamos pendientes</div></div>
              </div>

              <div className="lp-reports-grid">
                <Reveal delay={0}>
                  <div className="lp-report-card">
                    <span className="tag" style={{ background: 'rgba(110,245,200,.18)', color: '#6ef5c8' }}>Reportes diarios</span>
                    <h3>Tu negocio, resumido todos los días</h3>
                    <ul>
                      <li><Icon d={ICONS.check} /><span>Consultas respondidas y pendientes</span></li>
                      <li><Icon d={ICONS.check} /><span>Ventas del día y turnos agendados</span></li>
                      <li><Icon d={ICONS.check} /><span>Reclamos que necesitan tu atención</span></li>
                    </ul>
                  </div>
                </Reveal>
                <Reveal delay={100}>
                  <div className="lp-report-card">
                    <span className="tag" style={{ background: 'rgba(139,92,255,.22)', color: '#c9b8ff' }}>Reportes semanales</span>
                    <h3>Inteligencia de negocio, sin esfuerzo</h3>
                    <ul>
                      <li><Icon d={ICONS.check} /><span>Qué productos te piden y no tenés (qué conviene comprar)</span></li>
                      <li><Icon d={ICONS.check} /><span>Días y horarios donde más te escriben</span></li>
                      <li><Icon d={ICONS.check} /><span>Qué se vende más y qué preguntan tus clientes</span></li>
                      <li><Icon d={ICONS.check} /><span>Cuántas consultas terminaron en venta</span></li>
                    </ul>
                  </div>
                </Reveal>
                <Reveal delay={200}>
                  <div className="lp-report-card">
                    <span className="tag" style={{ background: 'rgba(255,149,0,.2)', color: '#ffc169' }}>Alertas al instante</span>
                    <h3>Te avisa cuando realmente importa</h3>
                    <ul>
                      <li><Icon d={ICONS.check} /><span>Un reclamo fuerte que necesita tu respuesta</span></li>
                      <li><Icon d={ICONS.check} /><span>Un pico raro de consultas en tu negocio</span></li>
                      <li><Icon d={ICONS.check} /><span>Un cliente importante preguntando algo puntual</span></li>
                    </ul>
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== PARA QUIÉN ES ===== */}
      <section className="lp-section tight" id="para-quien" style={{ background: 'var(--surf-2)' }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">Para quién es</span>
              <h2>Si tu negocio recibe consultas por WhatsApp, Bolty es para vos</h2>
            </div>
          </Reveal>
          <div className="lp-rubros">
            {RUBROS.map((r, i) => (
              <Reveal key={r.t} delay={(i % 4) * 70}>
                <div className="lp-rubro">
                  <div className="ic"><Icon d={r.ic} /></div>
                  <span>{r.t}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== POR QUÉ BOLTY ===== */}
      <section className="lp-section" id="beneficios">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">Por qué Bolty</span>
              <h2>Llevá tu negocio al siguiente nivel</h2>
              <p>No es solo automatizar respuestas. Es cambiar la forma en que tu negocio atiende y vende.</p>
            </div>
          </Reveal>
          <div className="lp-benefits">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.t} delay={(i % 3) * 80}>
                <div className="lp-benefit">
                  <div className="ic"><Icon d={b.ic} /></div>
                  <h3>{b.t}</h3>
                  <p>{b.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PLANES Y PRECIOS ===== */}
      <section className="lp-section tight" id="planes" style={{ background: 'var(--surf-2)' }}>
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">Planes y precios</span>
              <h2>Un plan para cada etapa de tu negocio</h2>
            </div>
          </Reveal>
          <Reveal>
            <div className="lp-trial-banner">
              <div className="t">
                <strong>🎁 Probá Bolty GRATIS durante 7 días</strong>
                <span>Sin tarjeta, sin compromiso. Lo activamos por vos.</span>
              </div>
              <button className="landing-btn-primary" style={{ color: '#018a66', boxShadow: 'none' }} onClick={handleContact}>
                Quiero mi prueba gratis
              </button>
            </div>
          </Reveal>
          <div className="lp-plans">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 100}>
                <div className={`lp-plan${p.featured ? ' featured' : ''}`}>
                  {p.featured && <span className="lp-plan-badge">Más elegido</span>}
                  <h3>{p.name}</h3>
                  <div className="price">{p.price}<span> /mes</span></div>
                  <div className="desc">{p.desc}</div>
                  <ul>
                    {p.feats.map(f => (
                      <li key={f}><Icon d={ICONS.check} /><span>{f}</span></li>
                    ))}
                  </ul>
                  <button className="lp-plan-btn" onClick={handleContact}>Contactanos</button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="lp-section" id="faq">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-head">
              <span className="lp-eyebrow">Preguntas frecuentes</span>
              <h2>Lo que seguramente te estás preguntando</h2>
            </div>
          </Reveal>
          <div className="lp-faq">
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 50}>
                <div className={`lp-faq-item${openFaq === i ? ' open' : ''}`}>
                  <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    {f.q}
                    <Icon d={ICONS.chevron} />
                  </button>
                  <div className="lp-faq-a"><p>{f.a}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LLAMADO FINAL ===== */}
      <section className="lp-section tight" id="contacto">
        <div className="lp-wrap">
          <Reveal>
            <div className="lp-final">
              <h2>Empezá hoy a no perder más clientes</h2>
              <p>Sumate a los negocios que ya dejaron de contestar a las apuradas y empezaron a vender en serio.</p>
              <div className="landing-cta">
                <button className="landing-btn-primary" onClick={handleContact}>Quiero mi prueba gratis</button>
                <button className="landing-btn-ghost" onClick={handleContact}>Contactanos</button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div>
            <div className="lp-footer-brand">
              <div className="brand-logo" style={{ width: '34px', height: '34px', borderRadius: '9px' }}>
                <svg viewBox="5 3 28 32" fill="none" style={{ width: '24px', height: '24px' }}>
                  <text x="7" y="32" fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="38" fill="#fff">B</text>
                  <path d="M26 6 L17 21 H23 L20.5 33 L31 17 H25 L27.5 6 Z" fill="#00c896" />
                </svg>
              </div>
              <span>B.O.L.T.Y</span>
            </div>
            <p className="lp-footer-tag">
              <b style={{ color: 'rgba(255,255,255,.7)' }}>B</b>usiness <b style={{ color: 'rgba(255,255,255,.7)' }}>O</b>nline <b style={{ color: 'rgba(255,255,255,.7)' }}>L</b>ive <b style={{ color: 'rgba(255,255,255,.7)' }}>T</b>echnology for <b style={{ color: 'rgba(255,255,255,.7)' }}>Y</b>ou
            </p>
          </div>
          <div className="lp-footer-links">
            <div className="lp-footer-col">
              <h4>Producto</h4>
              <a href="#funciones">Funciones</a>
              <a href="#reportes">Reportes</a>
              <a href="#planes">Planes</a>
            </div>
            <div className="lp-footer-col">
              <h4>Empresa</h4>
              <a href="#para-quien">Para quién es</a>
              <a href="#faq">Preguntas frecuentes</a>
              <button onClick={onEnter}>Ingresar</button>
            </div>
            <div className="lp-footer-col">
              <h4>Contacto</h4>
              <button onClick={handleContact}>Contactanos</button>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          © {new Date().getFullYear()} Bolty — Business Online Live Technology for You
        </div>
      </footer>
    </div>
  )
}
