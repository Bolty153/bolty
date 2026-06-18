// Asigna un color estable a cada servicio según su nombre (sin tocar la base):
// el mismo nombre siempre da el mismo color, para diferenciarlos de un vistazo.
const PALETTE = [
  '#6029ff', '#00c896', '#ff9500', '#ff3d71', '#0aa2ff',
  '#a855f7', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function serviceColor(name: string | null | undefined): string {
  if (!name) return 'var(--line-2)'
  return PALETTE[hash(name.toLowerCase()) % PALETTE.length]
}
