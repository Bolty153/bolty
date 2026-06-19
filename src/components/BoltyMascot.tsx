import { useEffect, useRef, useState } from 'react'

const VIDEO = '/bolty-animado.webm'
const IMG = '/bolty-mascota.png'   // respaldo (poster + navegadores sin WebM alfa)

/**
 * Mascota animada de Bolty (video WebM con fondo transparente). Aparece en todas
 * las pantallas internas (no en landing ni login). Al ingresar hace una bienvenida
 * en el centro (una vez por sesión) y después se acomoda en la esquina, flotando.
 */
export default function BoltyMascot({ cornerOnly = false }: { cornerOnly?: boolean }) {
  const greeted = sessionStorage.getItem('bolty_greeted_v2') === '1'
  // cornerOnly (ej. en la landing): aparece directo en la esquina, sin bienvenida central.
  const [phase, setPhase] = useState<'welcome' | 'corner'>(cornerOnly || greeted ? 'corner' : 'welcome')
  const [closed, setClosed] = useState(sessionStorage.getItem('bolty_closed') === '1')
  const [videoError, setVideoError] = useState(false)
  // Saludo al costado (sólo en la landing): cartelito por unos segundos
  const [cornerHi, setCornerHi] = useState(cornerOnly)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!cornerHi) return
    const t = setTimeout(() => setCornerHi(false), 4500)
    return () => clearTimeout(t)
  }, [cornerHi])

  // Asegura autoplay silencioso (algunos navegadores lo bloquean sin esto)
  useEffect(() => {
    const v = videoRef.current
    if (v) { v.muted = true; v.play().catch(() => {}) }
  }, [phase, closed, videoError])

  // Bienvenida: se muestra ~2.8s y luego viaja a la esquina. Una vez por sesión.
  useEffect(() => {
    if (phase !== 'welcome') return
    const t = setTimeout(() => {
      setPhase('corner')
      sessionStorage.setItem('bolty_greeted_v2', '1')
    }, 2800)
    return () => clearTimeout(t)
  }, [phase])

  function close() {
    setClosed(true)
    sessionStorage.setItem('bolty_closed', '1')
  }
  function reopen() {
    setClosed(false)
    sessionStorage.removeItem('bolty_closed')
  }

  // El video (o la imagen de respaldo si el navegador no soporta WebM con alfa)
  const Avatar = videoError
    ? <img src={IMG} alt="Bolty" className="bolty-img" draggable={false} />
    : (
      <video
        ref={videoRef}
        className="bolty-img"
        src={VIDEO}
        poster={IMG}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setVideoError(true)}
      />
    )

  // Si está cerrado, sólo mostramos un botón chico para traerlo de vuelta.
  if (closed) {
    return (
      <button className="bolty-launcher" onClick={reopen} title="Mostrar a Bolty" aria-label="Mostrar a Bolty">
        <img src={IMG} alt="Bolty" draggable={false} />
      </button>
    )
  }

  return (
    <>
      {phase === 'welcome' && (
        <>
          <div className="bolty-flash" />
          <div className="bolty-welcome-bubble">¡Hola! Soy Bolty <span>👋</span></div>
        </>
      )}

      <div className={`bolty-wrap${phase === 'welcome' ? ' is-welcome' : ''}`}>
        <div className="bolty-float">
          {cornerHi && <div className="bolty-hi-bubble">¡Hola! Soy Bolty <span>👋</span></div>}
          <div className="bolty-hover-bubble">¿En qué te ayudo? 👋</div>
          <div className="bolty-badge">{Avatar}</div>
          <button className="bolty-close" onClick={close} title="Ocultar a Bolty" aria-label="Ocultar a Bolty">×</button>
        </div>
      </div>
    </>
  )
}
