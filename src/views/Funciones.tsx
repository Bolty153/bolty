import { useLocalStorage } from '../hooks/useLocalStorage'

interface ToggleDef {
  title: string
  desc: string
  paths: string[]
  on: boolean
}

const coreFeatures: { title: string; desc: string; paths: string[] }[] = [
  {
    title: 'Te avisa lo que no sabe',
    desc: 'Si no tiene la respuesta, te pregunta a vos en vez de inventar.',
    paths: ['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 01-3.46 0'],
  },
  {
    title: 'Reportes semanales',
    desc: 'Qué comprar, qué se vende y qué horarios son fuertes.',
    paths: ['M3 3v18h18','M18 17V9','M13 17V5','M8 17v-3'],
  },
  {
    title: 'Entiende audios',
    desc: 'Escucha los audios de WhatsApp y responde como si los leyera.',
    paths: ['M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z','M19 10v2a7 7 0 01-14 0v-2','M12 19v4'],
  },
  {
    title: 'Alertas en el momento',
    desc: 'Te avisa al toque si pasa algo importante.',
    paths: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z','M12 9v4','M12 17h.01'],
  },
]

const toggleDefs: ToggleDef[] = [
  { title: 'Vende y agenda', desc: 'Cierra la venta o reserva el turno dentro de la charla.', paths: ['M9 11l3 3L22 4','M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'], on: true },
  { title: 'Recupera clientes', desc: 'Si alguien preguntó y no compró, le reescribe con una promo.', paths: ['M3 12a9 9 0 109-9 9 9 0 00-9 9z','M3 12l4-4','M3 12l4 4'], on: true },
  { title: 'Detecta el idioma', desc: 'Si escriben en inglés o portugués, responde en ese idioma.', paths: ['M5 8l6 6','M4 14l6-6 2-3','M2 5h12','M7 2h1','M22 22l-5-10-5 10','M14 18h6'], on: false },
  { title: 'Deriva a humano', desc: 'Si el cliente se enoja o pide una persona, te pasa la charla.', paths: ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2','M9 11a4 4 0 100-8 4 4 0 000 8','M19 8v6','M22 11h-6'], on: true },
  { title: 'Productos relacionados', desc: 'Ofrece sumar algo más a la compra. Vende más por charla.', paths: ['M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z','M3 6h18','M16 10a4 4 0 01-8 0'], on: true },
  { title: 'Cupones y promos', desc: 'Ofrece una promo en el momento justo o a quien hace rato no compra.', paths: ['M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6','M2 7h20v5a2 2 0 01-2 2H4a2 2 0 01-2-2z','M12 22V7','M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z','M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z'], on: false },
  { title: 'Personalidad propia', desc: 'Elegís el tono: formal, canchero, divertido, con modismos.', paths: ['M12 2a10 10 0 100 20 10 10 0 000-20z','M8 14s1.5 2 4 2 4-2 4-2','M9 9h.01','M15 9h.01'], on: true },
  { title: 'Resumen de voz diario', desc: 'Cada noche te llega un audio corto con el parte del día.', paths: ['M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z','M19 10v2a7 7 0 01-14 0v-2'], on: false },
  { title: '¿Qué pregunta la gente?', desc: 'Resumen de las dudas más repetidas para mejorar tu negocio.', paths: ['M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3','M12 17h.01','M12 2a10 10 0 100 20 10 10 0 000-20z'], on: true },
  { title: 'Comparador de días', desc: 'Te muestra tu mejor y peor día para reforzar o hacer promos.', paths: ['M3 3v18h18','M18 17V9','M13 17V5','M8 17v-3'], on: true },
]

function SvgIcon({ paths }: { paths: string[] }) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

export default function Funciones() {
  const [waitlistOn, setWaitlistOn] = useLocalStorage('bolty_waitlist', true)
  const [toggleStates, setToggleStates] = useLocalStorage<boolean[]>('bolty_toggles', toggleDefs.map(t => t.on))

  function setToggle(i: number, val: boolean) {
    setToggleStates(toggleStates.map((s, idx) => idx === i ? val : s))
  }

  return (
    <>
      <div className="page-head">
        <div className="greet">
          <div><h1>Funciones</h1><div className="sub">Activá o desactivá lo que quieras para tu agente</div></div>
        </div>
      </div>

      <div className="cat">Siempre activas <span className="ln" /></div>
      <div className="fgrid">
        {coreFeatures.map(f => (
          <div key={f.title} className="feat on">
            <div className="feat-t">
              <div style={{ display: 'flex', gap: 13 }}>
                <div className="feat-ic"><SvgIcon paths={f.paths} /></div>
                <div><h4>{f.title}</h4><p>{f.desc}</p></div>
              </div>
              <span className="lock">NÚCLEO</span>
            </div>
          </div>
        ))}
      </div>

      <div className="cat">Destacada <span className="ln" /></div>
      <div className="fgrid">
        <div className={`feat feat-hl${waitlistOn ? ' on' : ''}`}>
          <div className="feat-t">
            <div style={{ display: 'flex', gap: 13 }}>
              <div className="feat-ic">
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>
              </div>
              <div>
                <h4>Lista de espera inteligente <span className="star">★ RECOMENDADA</span></h4>
                <p>Si no tenés stock, anota al cliente y le avisa solo cuando llega. No perdés la venta.</p>
              </div>
            </div>
            <label className="sw">
              <input type="checkbox" checked={waitlistOn} onChange={e => setWaitlistOn(e.target.checked)} />
              <span className="sl" />
            </label>
          </div>
        </div>
      </div>

      <div className="cat">Activá las que quieras <span className="ln" /></div>
      <div className="fgrid">
        {toggleDefs.map((f, i) => (
          <div key={f.title} className={`feat${toggleStates[i] ? ' on' : ''}`}>
            <div className="feat-t">
              <div style={{ display: 'flex', gap: 13 }}>
                <div className="feat-ic"><SvgIcon paths={f.paths} /></div>
                <div><h4>{f.title}</h4><p>{f.desc}</p></div>
              </div>
              <label className="sw">
                <input type="checkbox" checked={toggleStates[i]} onChange={e => setToggle(i, e.target.checked)} />
                <span className="sl" />
              </label>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
