import { useEffect, useRef, useState } from 'react'

interface Props<T> {
  value: string
  onChange: (v: string) => void
  items: T[]
  getLabel: (item: T) => string
  getSub?: (item: T) => string | null
  getColor?: (item: T) => string
  onPick?: (item: T) => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Campo de texto con sugerencias (combobox): podés escribir libre o elegir
 * uno de la lista. Cada ítem puede mostrar un subtítulo y una barra de color.
 */
export default function Combobox<T,>({
  value, onChange, items, getLabel, getSub, getColor, onPick, placeholder, autoFocus,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const q = value.toLowerCase().trim()
  // Si lo escrito coincide exacto con una opción, mostramos toda la lista igual
  // (así se puede volver a elegir otra sin tener que borrar).
  const exact = items.some(it => getLabel(it).toLowerCase() === q)
  const filtered = (!q || exact)
    ? items
    : items.filter(it => getLabel(it).toLowerCase().includes(q) || (getSub?.(it) ?? '').toLowerCase().includes(q))

  function pick(it: T) {
    onChange(getLabel(it))
    onPick?.(it)
    setOpen(false)
  }

  return (
    <div className="cbx" ref={wrapRef}>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="cbx-menu">
          {filtered.map((it, i) => (
            <button
              key={i}
              type="button"
              className="cbx-item"
              onMouseDown={e => { e.preventDefault(); pick(it) }}
            >
              {getColor && <span className="cbx-bar" style={{ background: getColor(it) }} />}
              <span className="cbx-label">{getLabel(it)}</span>
              {getSub && getSub(it) && <span className="cbx-sub">{getSub(it)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
