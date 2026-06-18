// Prefijo argentino para no tener que escribirlo cada vez (se puede borrar).
export const PHONE_PREFIX = '+54 9 '

// Valor inicial del campo: lo guardado, o el prefijo si está vacío.
export function initPhone(v?: string | null): string {
  return v && v.trim() ? v : PHONE_PREFIX
}

// Antes de guardar: si quedó sólo el prefijo (sin número real), guardamos vacío.
export function cleanPhone(v: string): string {
  const t = v.trim()
  if (!t) return ''
  const digits = t.replace(/\D/g, '')
  if (digits === '' || digits === '549') return ''
  return t
}
