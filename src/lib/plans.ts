// ─────────────────────────────────────────────────────────────────────────────
// FUENTE ÚNICA DE VERDAD de la escalera de planes de Bolty.
// Antes esto estaba hardcodeado en 3 lugares distintos que ni coincidían entre sí
// (la landing decía "Empresa", el dashboard decía "Estándar/Pro"). Ahora TODOS
// —Landing, PlansModal, usePlanRequests y el admin— leen de acá.
//
// La escalera está definida en bolty-proyecto-maestro.md §4.1 (TANDA 2, 14/07/2026).
// Los PRECIOS todavía no están cerrados: se dejan los actuales donde los había y
// "Consultar" (null) donde no hay. NO inventar precios.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanKey = 'entrada' | 'medio' | 'pro' | 'proplus'

export interface PlanDef {
  key: PlanKey
  name: string              // nombre visible
  order: number             // posición en la escalera (0 = más barato)
  recommended?: boolean     // el que queremos destacar (Medio)
  tagline: string           // pitch corto (landing + modal)
  priceArs: number | null   // precio actual en ARS; null → "Consultar"
  // Los 5 ejes de la escalera, con el "+" ya incluido para que se vea de un
  // vistazo QUÉ se gana al subir de plan.
  axes: {
    canales: string
    lineas: string
    modulos: string
    usuarios: string
    conversaciones: string
  }
  // Titular de "lo que desbloqueás al llegar a este plan" (respecto del anterior).
  unlock?: string
  // Bullets con tilde para el modal del cliente.
  features: string[]
}

export const PLANS: PlanDef[] = [
  {
    key: 'entrada',
    name: 'Entrada',
    order: 0,
    tagline: 'Un agente que ya funciona en tu WhatsApp.',
    priceArs: 50000,
    axes: {
      canales: 'WhatsApp',
      lineas: '1 línea de WhatsApp',
      modulos: 'Agente + inventario + agenda simple',
      usuarios: '1 usuario',
      conversaciones: '300 conversaciones/mes',
    },
    features: [
      'WhatsApp con respuestas automáticas 24/7',
      'Agente con inventario y agenda',
      '1 línea de WhatsApp · 1 usuario',
      'Hasta 300 conversaciones por mes',
    ],
  },
  {
    key: 'medio',
    name: 'Medio',
    order: 1,
    recommended: true,
    tagline: 'Pasás de tener un bot a tener un sistema.',
    priceArs: 75000,
    axes: {
      canales: '+ Instagram, mail y chat web',
      lineas: '1 línea de WhatsApp',
      modulos: '+ Finanzas completas + Agenda con empleados',
      usuarios: '2 usuarios',
      conversaciones: '1.000 conversaciones/mes',
    },
    unlock: 'Sumás Instagram, mail y chat web, Finanzas completas y Agenda con empleados.',
    features: [
      'Todo lo del plan Entrada',
      'Suma Instagram, mail y chat web',
      'Finanzas completas',
      'Agenda con empleados',
      '2 usuarios',
      'Hasta 1.000 conversaciones por mes',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    order: 2,
    tagline: 'Para entender la rentabilidad de tu negocio.',
    priceArs: 125000,
    axes: {
      canales: 'Igual que Medio',
      lineas: '2 líneas de WhatsApp',
      modulos: '+ Rentabilidad por empleado',
      usuarios: '3 usuarios',
      conversaciones: '3.000 conversaciones/mes',
    },
    unlock: 'Sumás una segunda línea de WhatsApp y la rentabilidad por empleado.',
    features: [
      'Todo lo del plan Medio',
      '2 líneas de WhatsApp',
      'Rentabilidad por empleado',
      '3 usuarios',
      'Hasta 3.000 conversaciones por mes',
    ],
  },
  {
    key: 'proplus',
    name: 'Pro+',
    order: 3,
    tagline: 'Para negocios con varias líneas y mucho volumen.',
    priceArs: null,
    axes: {
      canales: '+ Multi-idioma',
      lineas: '3+ líneas de WhatsApp (extras pagos)',
      modulos: '+ Reportes avanzados',
      usuarios: '5 usuarios (+ extras pagos)',
      conversaciones: '8.000 conversaciones/mes',
    },
    unlock: 'Sumás multi-idioma, reportes avanzados y líneas de WhatsApp extra.',
    features: [
      'Todo lo del plan Pro',
      'Multi-idioma (responde en el idioma del cliente)',
      '3+ líneas de WhatsApp (extras pagos)',
      'Reportes avanzados',
      '5 usuarios (+ extras pagos)',
      'Hasta 8.000 conversaciones por mes',
    ],
  },
]

/** Nombre visible por clave interna. Incluye alias de las claves viejas
 *  (basico/estandar) para que los pedidos previos se sigan mostrando bien. */
export const PLAN_NAMES: Record<string, string> = {
  entrada: 'Entrada',
  medio: 'Medio',
  pro: 'Pro',
  proplus: 'Pro+',
  // alias legacy
  basico: 'Entrada',
  estandar: 'Medio',
}

/** Devuelve la definición completa de un plan por su clave (o alias legacy). */
export function planByKey(key?: string | null): PlanDef | null {
  if (!key) return null
  const k = key.toLowerCase()
  const alias: Record<string, PlanKey> = { basico: 'entrada', estandar: 'medio' }
  const norm = (alias[k] ?? k) as PlanKey
  return PLANS.find(p => p.key === norm) ?? null
}

/**
 * Mapea el NOMBRE de un plan (como está guardado en la tabla `plans` de Supabase,
 * ej. "Pro+", "Medio", o incluso los viejos "Estándar"/"Básico") a nuestra clave
 * interna. Es el eje del flujo de pedido/aprobación de cambio de plan:
 * el admin busca en `plans` la fila cuyo planKeyFromName(name) coincide con la
 * clave pedida. Por eso tolera nombres nuevos Y viejos.
 * OJO con el orden: "pro+" contiene "pro", así que se chequea primero.
 */
export function planKeyFromName(name?: string | null): PlanKey | null {
  if (!name) return null
  const t = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (t.includes('pro+') || t.includes('pro plus') || t.includes('proplus') || t.includes('pro +')) return 'proplus'
  if (t.includes('empresa')) return 'proplus'   // legacy landing name
  if (t.includes('pro')) return 'pro'
  if (t.includes('medio') || t.includes('estandar') || t.includes('standard')) return 'medio'
  if (t.includes('entrada') || t.includes('basico')) return 'entrada'
  return null
}
