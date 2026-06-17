import { useEffect, useRef, useState } from 'react'

interface Props {
  onClose: () => void
  onDetected: (code: string) => void
}

/**
 * Lector de código de barras con la cámara del dispositivo.
 * Usa la API nativa BarcodeDetector (Chrome/Android). Si el navegador no la
 * soporta (ej. iPhone/Safari), ofrece escribir el código a mano.
 */
export default function BarcodeScanner({ onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [manual, setManual] = useState('')
  const [error, setError] = useState<string | null>(null)
  const supported = typeof (window as any).BarcodeDetector !== 'undefined'

  useEffect(() => {
    if (!supported) return
    let stopped = false
    const Detector = (window as any).BarcodeDetector
    const detector = new Detector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
    })

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        scan()
      } catch {
        setError('No pudimos acceder a la cámara. Revisá los permisos del navegador o ingresá el código a mano.')
      }
    }

    async function scan() {
      if (stopped || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes && codes.length > 0 && codes[0].rawValue) {
          finish(String(codes[0].rawValue))
          return
        }
      } catch { /* ignora frames que no se pueden leer */ }
      rafRef.current = requestAnimationFrame(scan)
    }

    function finish(code: string) {
      stopped = true
      cleanup()
      onDetected(code)
    }

    start()
    return () => { stopped = true; cleanup() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h2>Escanear código de barras</h2>

        {supported ? (
          <>
            <div className="scan-frame">
              <video ref={videoRef} playsInline muted />
              <div className="scan-line" />
            </div>
            <p className="import-note" style={{ marginTop: 12 }}>
              Acercá el código de barras a la cámara. Se detecta solo.
            </p>
          </>
        ) : (
          <p className="import-note">
            Tu navegador no permite escanear con la cámara (suele pasar en iPhone).
            Ingresá el código de barras a mano:
          </p>
        )}

        {error && <div className="onb-error" style={{ marginTop: 4 }}>{error}</div>}

        <div className="field" style={{ marginTop: 12 }}>
          <label>Código de barras (manual)</label>
          <input
            type="text" inputMode="numeric" value={manual}
            onChange={e => setManual(e.target.value)}
            placeholder="Ej: 7791234567890"
            onKeyDown={e => { if (e.key === 'Enter' && manual.trim()) { cleanup(); onDetected(manual.trim()) } }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn" disabled={!manual.trim()} onClick={() => { cleanup(); onDetected(manual.trim()) }}>
            Usar código
          </button>
        </div>
      </div>
    </div>
  )
}
