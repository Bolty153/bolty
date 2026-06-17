import type { ProductInput } from '../hooks/useProducts'

export interface ParseResult {
  valid: ProductInput[]
  errors: string[]
  totalRows: number
}

// Quita acentos, pasa a minúsculas y normaliza espacios para comparar encabezados.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Mapea encabezados de la planilla (con sus variantes) a nuestros campos.
const HEADER_MAP: Record<string, keyof ProductInput> = {}
const aliases: Record<keyof ProductInput, string[]> = {
  name: ['nombre', 'producto', 'nombre del producto', 'name', 'titulo', 'articulo'],
  price: ['precio', 'price', 'valor', 'importe', 'precio unitario'],
  stock: ['stock', 'cantidad', 'cantidad disponible', 'existencias', 'unidades'],
  category: ['categoria', 'category', 'rubro', 'tipo'],
  description: ['descripcion', 'description', 'detalle', 'detalles'],
  image_url: ['imagen', 'foto', 'image', 'image_url', 'url'],
}
for (const field in aliases) {
  for (const a of aliases[field as keyof ProductInput]) {
    HEADER_MAP[normalize(a)] = field as keyof ProductInput
  }
}

// Convierte "$18.500,50" / "18500.50" / "1.234,5" a número. null = vacío, NaN = inválido.
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

export async function parseProductsFile(file: File): Promise<ParseResult> {
  // xlsx se carga sólo al importar (es pesado): así no infla la carga inicial.
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { valid: [], errors: ['El archivo no tiene ninguna hoja con datos.'], totalRows: 0 }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const valid: ProductInput[] = []
  const errors: string[] = []

  if (rows.length === 0) {
    return { valid, errors: ['La planilla está vacía o no tiene encabezados.'], totalRows: 0 }
  }

  rows.forEach((row, i) => {
    const fila = i + 2 // +2: fila 1 son los encabezados, y contamos desde 1
    const mapped: Record<string, unknown> = {}
    for (const key in row) {
      const field = HEADER_MAP[normalize(key)]
      if (field) mapped[field] = row[key]
    }

    const name = String(mapped.name ?? '').trim()
    if (!name) {
      errors.push(`Fila ${fila}: falta el nombre del producto (se omite).`)
      return
    }

    const price = parseNumber(mapped.price)
    if (price !== null && Number.isNaN(price)) {
      errors.push(`Fila ${fila} ("${name}"): el precio no es un número válido (se omite).`)
      return
    }

    const stockNum = parseNumber(mapped.stock)
    if (stockNum !== null && Number.isNaN(stockNum)) {
      errors.push(`Fila ${fila} ("${name}"): el stock no es un número válido (se omite).`)
      return
    }

    const category = String(mapped.category ?? '').trim()
    const description = String(mapped.description ?? '').trim()

    valid.push({
      name,
      price: price ?? 0,
      stock: Math.round(stockNum ?? 0),
      category: category || null,
      description: description || null,
    })
  })

  return { valid, errors, totalRows: rows.length }
}

// Genera y descarga una plantilla CSV de ejemplo (con BOM para que Excel respete los acentos).
export function downloadTemplate() {
  const csv = [
    'nombre,precio,stock,categoria,descripcion',
    'Remera lisa blanca,8999,25,Indumentaria,Algodón premium talle M',
    'Gorra trucker,5500,12,Accesorios,',
    'Botella térmica 1L,12000,8,,Acero inoxidable',
  ].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-productos-bolty.csv'
  a.click()
  URL.revokeObjectURL(url)
}
