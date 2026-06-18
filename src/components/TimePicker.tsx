import { useEffect, useRef, useState } from 'react'

const z = (n: number) => String(n).padStart(2, '0')

// Todas las horas del día, cada 15 min (00:00 a 23:45)
const SLOTS: string[] = (() => {
  const out: string[] = []
  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) out.push(`${z(h)}:${z(m)}`)
  return out
})()

// Mientras escribís inserta el ":" solo: "1300" -> "13:00", "930" -> "09:30"
function formatTyping(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (!d) return ''
  if (+d[0] > 2) {
    // hora de un dígito (3..9) -> con cero adelante (9 -> 09)
    const mm = d.slice(1, 3)
    return mm ? `0${d[0]}:${mm}` : `0${d[0]}`
  }
  if (d.length <= 2) return d
  return `${d.slice(0, 2)}:${d.slice(2, 4)}`
}

// Al salir del campo deja una hora válida (HH:MM, acotada a 23:59)
function normalize(v: string): string {
  const m = v.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return v
  return `${z(Math.min(23, +m[1]))}:${z(Math.min(59, +m[2]))}`
}

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export default function TimePicker({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const qd = value.replace(/\D/g, '')
  const exact = SLOTS.includes(value)
  const filtered = (!qd || exact) ? SLOTS : SLOTS.filter(s => s.replace(/\D/g, '').startsWith(qd))

  return (
    <div className="cbx" ref={ref}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(formatTyping(e.target.value)); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => onChange(normalize(value))}
      />
      {open && filtered.length > 0 && (
        <div className="cbx-menu">
          {filtered.map(s => (
            <button key={s} type="button" className="cbx-item" onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false) }}>
              <span className="cbx-label">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
