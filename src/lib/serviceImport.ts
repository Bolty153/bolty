import type { ServiceInput } from '../hooks/useServices'

export interface ServiceParseResult {
  valid: ServiceInput[]
  errors: string[]
  totalRows: number
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

const HEADER_MAP: Record<string, keyof ServiceInput | 'duration'> = {}
const aliases: Record<string, string[]> = {
  name: ['nombre', 'servicio', 'nombre del servicio', 'name', 'titulo'],
  price: ['precio', 'price', 'valor', 'importe', 'tarifa'],
  duration: ['duracion', 'duration', 'tiempo', 'demora', 'minutos'],
  category: ['categoria', 'category', 'rubro', 'tipo'],
  description: ['descripcion', 'description', 'detalle', 'detalles'],
}
for (const field in aliases) {
  for (const a of aliases[field]) HEADER_MAP[normalize(a)] = field as keyof ServiceInput | 'duration'
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  let s = String(raw ?? '').trim()
  if (!s) return null
  s = s.replace(/[^\d.,-]/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

// "30", "30 min", "1 hora", "1h", "1:30", "1h30" -> minutos. null = vacío, NaN = inválido.
export function parseDuration(raw: unknown): number | null {
  if (typeof raw === 'number') return Math.round(raw)
  let s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null

  // formato "1:30"
  const colon = s.match(/^(\d+)\s*:\s*(\d+)$/)
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10)

  const hMatch = s.match(/(\d+)\s*(h|hora|horas)/)
  const mMatch = s.match(/(\d+)\s*(m|min|minuto|minutos)/)
  if (hMatch || mMatch) {
    const h = hMatch ? parseInt(hMatch[1], 10) : 0
    const m = mMatch ? parseInt(mMatch[1], 10) : 0
    return h * 60 + m
  }

  // número pelado = minutos
  const n = parseInt(s.replace(/[^\d]/g, ''), 10)
  return isNaN(n) ? NaN : n
}

export async function parseServicesFile(file: File): Promise<ServiceParseResult> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { valid: [], errors: ['El archivo no tiene ninguna hoja con datos.'], totalRows: 0 }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const valid: ServiceInput[] = []
  const errors: string[] = []

  if (rows.length === 0) return { valid, errors: ['La planilla está vacía o no tiene encabezados.'], totalRows: 0 }

  rows.forEach((row, i) => {
    const fila = i + 2
    const mapped: Record<string, unknown> = {}
    for (const key in row) {
      const field = HEADER_MAP[normalize(key)]
      if (field) mapped[field] = row[key]
    }

    const name = String(mapped.name ?? '').trim()
    if (!name) { errors.push(`Fila ${fila}: falta el nombre del servicio (se omite).`); return }

    // Precio: vacío o texto tipo "a consultar" => a consultar
    const rawPrice = String(mapped.price ?? '').trim().toLowerCase()
    let price = 0
    let price_on_request = false
    if (rawPrice === '' || rawPrice.includes('consult')) {
      price_on_request = true
    } else {
      const n = parseNumber(mapped.price)
      if (n === null || Number.isNaN(n)) {
        errors.push(`Fila ${fila} ("${name}"): el precio no es válido. Dejalo vacío o poné "a consultar" (se omite).`)
        return
      }
      price = n
    }

    const dur = parseDuration(mapped.duration)
    if (dur !== null && Number.isNaN(dur)) {
      errors.push(`Fila ${fila} ("${name}"): la duración no es válida (se omite).`)
      return
    }

    const category = String(mapped.category ?? '').trim()
    const description = String(mapped.description ?? '').trim()

    valid.push({
      name,
      price,
      price_on_request,
      duration_min: dur ?? null,
      category: category || null,
      description: description || null,
    })
  })

  return { valid, errors, totalRows: rows.length }
}

export function downloadServicesTemplate() {
  const csv = [
    'nombre,precio,duracion,categoria,descripcion',
    'Corte de pelo,5000,30 min,Peluquería,Corte con lavado',
    'Coloración,a consultar,1h 30min,Peluquería,',
    'Consulta general,8000,45,Salud,Primera visita',
  ].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-servicios-bolty.csv'
  a.click()
  URL.revokeObjectURL(url)
}
