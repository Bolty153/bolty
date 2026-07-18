// supabase/functions/chat/index.ts
//
// EL CEREBRO — Capa 4: LAS MANOS (tool use, TANDA 1 = solo LEER).
// Antes metíamos el catálogo ENTERO (todos los productos + servicios) dentro del
// system prompt. Eso no escala: con muchos productos no entra, cuesta carísimo por
// tokens en cada mensaje, y el agente tiende a "vomitar" toda la lista.
//
// AHORA: el system prompt lleva solo un RESUMEN (nombre, rubro, horarios, cuántos
// productos/servicios hay, categorías). Para los detalles puntuales (un precio, el
// stock, un servicio, si hay turno) el agente usa HERRAMIENTAS que la función
// ejecuta contra la base, con el user_id del token + RLS, y responde SOLO con lo que
// las tools devuelven. Nunca inventa.
//
// TANDA 1 son herramientas de LECTURA (no modifican nada). Agendar/reservar (escribir)
// viene en la tanda 2.
//
// SEGURIDAD:
//  - La API key de Anthropic vive como SECRETO (ANTHROPIC_API_KEY), nunca en el front.
//  - Los datos del negocio NO se confían al front: la función saca el user_id del JWT
//    del usuario logueado y consulta ella misma la base (con RLS). Las tools también.

import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Configuración fácil de cambiar ─────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5'   // modelo de atención (elegido por costo, a propósito)
const MAX_TOKENS = 1024
const MAX_TOOL_ITERS = 5           // tope de vueltas del loop de tools por turno (anti-bucle)
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// ── CORS ────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Tipos mínimos de lo que leemos de la base ───────────────────────────────────
type DayHours = { open?: boolean; from?: string; to?: string; split?: boolean; from2?: string; to2?: string }
type BusinessProfile = {
  business_name?: string
  industry?: string
  description?: string
  address?: string
  phone?: string
  business_hours?: Record<string, DayHours> | null
}
type AgentConfig = {
  agent_name?: string
  tone?: string
  instructions?: string
  business_type?: string
}
type CatalogSummary = { count: number; categories: string[] }

// Orden y etiquetas de los días (coincide con lo que guarda el front).
const DAYS: [string, string][] = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'],
  ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo'],
]

// ── Contexto temporal (SIEMPRE zona horaria de Argentina) ───────────────────────
// El cliente nunca escribe la fecha en números: habla relativo ("mañana", "el
// viernes"). El agente necesita saber qué día/hora es HOY para poder traducir eso
// a una fecha concreta. Se calcula en el servidor en cada request. Usamos
// Intl con timeZone de Argentina para NO correr el día (nada de UTC directo).
const AR_TZ = 'America/Argentina/Buenos_Aires'

function contextoTemporal(): { natural: string; iso: string } {
  const now = new Date()
  // "martes, 15 de julio de 2026, 18:30"
  const natural = new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TZ,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now)
  // "2026-07-15" (en-CA da directamente AAAA-MM-DD, ya en hora de Argentina)
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  return { natural, iso }
}

// Tabla de los PRÓXIMOS 14 DÍAS (nombre del día + fecha AAAA-MM-DD) en zona
// horaria de Argentina. La inyectamos en el system prompt para que el agente NO
// calcule el día de la semana de memoria (ahí es donde erraba "el lunes" -> fecha mal).
function tablaFechas(): string {
  // "hoy" en Argentina como AAAA-MM-DD, base para iterar sin correr el día.
  const isoHoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [y, m, d] = isoHoy.split('-').map(Number)
  const wd = new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ, weekday: 'long' })
  const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

  const lines = ['REFERENCIA DE FECHAS (Argentina) — usá esto y NO calcules a mano:']
  for (let i = 0; i < 14; i++) {
    // Mediodía UTC + i días: Argentina es UTC-3, así que nunca cruza de día.
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    dt.setUTCDate(dt.getUTCDate() + i)
    const dia = wd.format(dt)          // "lunes"
    const fecha = isoFmt.format(dt)     // "2026-07-20"
    const prefijo = i === 0 ? 'hoy ' : i === 1 ? 'mañana ' : ''
    lines.push(`${prefijo}${dia} ${fecha}`)
  }
  return lines.join('\n')
}

// ── Armado del system prompt ────────────────────────────────────────────────────
function formatHours(hours: Record<string, DayHours> | null | undefined): string {
  if (!hours || typeof hours !== 'object') return 'No cargados.'
  const lines: string[] = []
  for (const [key, label] of DAYS) {
    const d = hours[key]
    if (!d || !d.open) {
      lines.push(`${label}: cerrado`)
      continue
    }
    let tramo = `${d.from ?? '—'} a ${d.to ?? '—'}`
    if (d.split && d.from2 && d.to2) tramo += ` y ${d.from2} a ${d.to2}` // turno cortado
    lines.push(`${label}: ${tramo}`)
  }
  return lines.join('\n')
}

function buildSystemPrompt(
  bp: BusinessProfile | null,
  ac: AgentConfig | null,
  prod: CatalogSummary,
  serv: CatalogSummary,
  hasEmployees: boolean,
): string {
  const businessName = bp?.business_name?.trim() || 'el negocio'
  const agentName = ac?.agent_name?.trim() || 'el asistente'
  const tone = ac?.tone?.trim() || 'Cercano'

  const parts: string[] = []

  // 1) Identidad
  parts.push(
    `Sos ${agentName}, el asistente virtual de "${businessName}". ` +
    `Atendés a los clientes del negocio por chat. NO sos "Claude" ni un asistente genérico: ` +
    `sos parte de este negocio y hablás en su nombre.`,
  )

  // 1.b) Contexto temporal (hora de Argentina, calculado ahora)
  const t = contextoTemporal()
  parts.push(
    `CONTEXTO TEMPORAL (hora de Argentina):\n` +
    `Hoy es ${t.natural} (hora de Argentina). En formato de fecha para las herramientas, hoy es ${t.iso}.\n\n` +
    `${tablaFechas()}\n\n` +
    `- Para fechas relativas (hoy, mañana, el lunes, la semana que viene) usá SIEMPRE la tabla ` +
    `REFERENCIA DE FECHAS de arriba. Nunca calcules el día de la semana de memoria.\n` +
    `- El cliente SIEMPRE habla de fechas en relativo ("hoy", "mañana", "pasado mañana", "el viernes", ` +
    `"la semana que viene", "en un rato"). NUNCA le pidas que escriba la fecha en números: traducila vos.\n` +
    `- Convertí esas expresiones a la fecha concreta en formato AAAA-MM-DD (buscándola en la tabla de ` +
    `arriba) y usá ESA fecha en las herramientas consultar_disponibilidad y agendar_turno.\n` +
    `- Cuando confirmes o consultes algo con fecha, decísela al cliente en lenguaje natural y claro ` +
    `(ej: "para mañana martes 16") para evitar malentendidos. Nunca le muestres el formato numérico.`,
  )

  // 2) Datos del negocio (base automática)
  const datos: string[] = []
  if (bp?.industry?.trim()) datos.push(`Rubro: ${bp.industry.trim()}`)
  if (bp?.description?.trim()) datos.push(`Descripción: ${bp.description.trim()}`)
  if (bp?.address?.trim()) datos.push(`Ubicación / zona: ${bp.address.trim()}`)
  if (bp?.phone?.trim()) datos.push(`Teléfono de contacto: ${bp.phone.trim()}`)
  if (datos.length) parts.push(`DATOS DEL NEGOCIO:\n${datos.join('\n')}`)

  // 3) Horarios (incluye turno cortado)
  parts.push(`HORARIOS DE ATENCIÓN:\n${formatHours(bp?.business_hours)}`)

  // 4) QUÉ OFRECE — solo un resumen (NO la lista completa; para el detalle, tools).
  const resumen: string[] = []
  if (prod.count > 0) {
    resumen.push(`Tiene ${prod.count} producto(s) cargado(s).` +
      (prod.categories.length ? ` Categorías de productos: ${prod.categories.join(', ')}.` : ''))
  }
  if (serv.count > 0) {
    resumen.push(`Ofrece ${serv.count} servicio(s).` +
      (serv.categories.length ? ` Categorías de servicios: ${serv.categories.join(', ')}.` : ''))
  }
  if (resumen.length) parts.push(`QUÉ OFRECE (resumen):\n${resumen.join('\n')}`)
  else parts.push(`Todavía no hay productos ni servicios cargados en el sistema.`)

  // 5) Cómo consultar el catálogo (el corazón de esta capa)
  parts.push(
    `CÓMO CONSULTAR EL CATÁLOGO (IMPORTANTE):\n` +
    `- NO tenés la lista de productos/servicios en tu memoria, solo el resumen de arriba.\n` +
    `- Para responder un precio, el stock, un servicio, su duración o si hay turno, USÁ LAS HERRAMIENTAS ` +
    `(tools) que tenés disponibles y respondé ÚNICAMENTE con lo que te devuelvan.\n` +
    `- NUNCA inventes un producto, precio, stock, duración ni disponibilidad. Si una herramienta no ` +
    `devuelve resultados, decí con sinceridad que no lo encontrás y ofrecé contactar al negocio` +
    `${bp?.phone?.trim() ? ` (tel: ${bp.phone.trim()})` : ''}.\n` +
    `- Podés llamar varias herramientas si hace falta para responder bien.\n` +
    `- Cuando el cliente pregunta qué incluye un servicio/producto o la diferencia entre dos, usá SIEMPRE el ` +
    `campo "descripcion" que te devuelve la herramienta. Si la descripción existe, respondé con eso. NUNCA ` +
    `digas que no tenés los detalles si la herramienta te devolvió una descripción, y NUNCA derives al ` +
    `teléfono del negocio para "consultar detalles".`,
  )

  // 5.b) Equipo / empleados (solo si el negocio trabaja con empleados)
  if (hasEmployees) {
    parts.push(
      `SOBRE EL EQUIPO:\n` +
      `- Para saber quién trabaja, quién hace qué servicio o si está una persona puntual, usá la herramienta ` +
      `buscar_empleados.\n` +
      `- Si el cliente pide un profesional que NO existe, NO lo mandes solo a llamar por teléfono: primero ` +
      `fijate con buscar_empleados quiénes SÍ están y ofrecéselos ` +
      `(ej: "No tengo un Dr. Gómez, pero está Raúl y Tomás, ¿con alguno de ellos?").\n` +
      `- Si el nombre que dijo el cliente coincide con VARIOS del equipo, preguntá cuál de ellos antes de seguir.`,
    )
  }

  // 6) Personalidad configurada por el dueño (agent_configs)
  parts.push(`TONO DE CONVERSACIÓN: ${tone}.`)
  if (ac?.instructions?.trim()) {
    parts.push(
      `INSTRUCCIONES DEL DUEÑO (respetalas siempre que no contradigan las reglas de abajo):\n` +
      ac.instructions.trim(),
    )
  }

  // 7) Actitud comercial (vendedor, no catálogo)
  parts.push(
    `ACTITUD COMERCIAL:\n` +
    `- Sos un vendedor, no un catálogo. Ante una consulta amplia ("¿qué venden?", "¿qué servicios ` +
    `tienen?") NO vuelques toda la lista de una: preguntá qué está buscando la persona y recomendá ` +
    `según eso, como lo haría un buen vendedor.\n` +
    `- Solo listás todo si el cliente lo pide EXPLÍCITAMENTE (ej: "mandame todo", "pasame la lista completa").`,
  )

  // 8) Reglas de comportamiento (innegociables)
  parts.push(
    `REGLAS:\n` +
    `- Respondé siempre en español argentino (rioplatense), amable y cercano pero profesional.\n` +
    `- Usá ÚNICAMENTE datos de este contexto o de las herramientas. No inventes nada.\n` +
    `- SÍ podés agendar turnos (ver AGENDADO abajo). Lo que TODAVÍA no podés hacer: tomar pagos ni cerrar ` +
    `ventas de productos (ver VENTAS Y COMPRAS abajo).`,
  )

  // 8.a) Ventas y compras de productos (todavía no hay tool para cerrar la venta)
  parts.push(
    `VENTAS Y COMPRAS DE PRODUCTOS:\n` +
    `- Vos SOS el canal de atención del negocio. NUNCA le digas al cliente que llame, escriba o contacte al ` +
    `negocio por teléfono ni por otro canal: ya está hablando con el negocio a través tuyo. Nunca des un ` +
    `número de teléfono para "coordinar la compra" ni para "consultar detalles".\n` +
    `- NUNCA inventes cómo se compra, se retira o se entrega un producto (retiro en el local, envío a ` +
    `domicilio, dirección de retiro, medios de pago). Que el negocio tenga una dirección NO significa que se ` +
    `pueda retirar ahí. No lo asumas.\n` +
    `- Por ahora NO tenés una herramienta para cerrar la venta de un producto. Cuando el cliente quiere ` +
    `comprar: confirmá producto, precio y disponibilidad, decile que tomás nota de su pedido, y ofrecé seguir ` +
    `ayudando. Corto, sin inventar formas de pago ni de entrega.`,
  )

  // 8.b) Agendado de turnos (la ÚNICA acción que escribe)
  parts.push(
    `AGENDADO DE TURNOS (podés reservar de verdad, con cuidado):\n` +
    `- ANTES de reservar, SIEMPRE chequeá con consultar_disponibilidad que ese horario esté libre.\n` +
    `- Juntá los datos necesarios: nombre del cliente, servicio, día y hora` +
    (hasEmployees ? `, y con qué empleado (este negocio trabaja con empleados)` : ``) + `.\n` +
    `- Antes de llamar a agendar_turno, REPETÍ los datos y pedí un "sí" explícito del cliente. ` +
    `Ej: "Te agendo corte con Vero el martes 16 a las 15, ¿confirmás?".\n` +
    `- Recién con el "sí" del cliente, llamá a agendar_turno.\n` +
    `- Al llamar agendar_turno, si ya sabés qué servicio quiere el cliente, pasá SIEMPRE el nombre del ` +
    `servicio en el parámetro "servicio". No agendes un turno sin servicio si el cliente ya lo eligió.\n` +
    `- Pasá el nombre del servicio EXACTAMENTE como lo devolvió buscar_servicios. No le agregues palabras ` +
    `como "para", "de" ni el objeto ("para auto"): solo el nombre tal cual del catálogo. Si no estás seguro ` +
    `de cuál servicio es, preguntale al cliente antes de agendar.\n` +
    `- Si agendar_turno devolvió ok:true, el turno está CONFIRMADO. Confirmá al cliente que quedó agendado ` +
    `(servicio, día, hora) y ofrecé ayuda para otra cosa. NO digas que lo van a contactar para confirmar, ` +
    `ni que "queda sujeto a confirmación": ya está.\n` +
    `- Decí que el turno quedó agendado SOLO si la herramienta devolvió ok:true. Si devuelve ok:false ` +
    `(ej: el horario ya se ocupó), pedí disculpas y ofrecé otros horarios volviendo a usar consultar_disponibilidad.\n` +
    `- Nunca inventes que un turno quedó reservado sin el ok:true de la herramienta.\n` +
    `- CLAVE: preguntar "¿te lo agendo?" NO agenda nada. Para que el turno exista tenés que EMITIR la ` +
    `herramienta agendar_turno y esperar su ok:true. Está PROHIBIDO responder "listo", "agendado", ` +
    `"confirmado" o "te espero" si en ESTE mismo mensaje no llamaste agendar_turno y no recibiste ok:true. ` +
    `Cuando el cliente diga "sí", tu próxima acción es LLAMAR la herramienta, no escribir la confirmación.`,
  )

  // 9) Estilo de escritura (el destino final es WhatsApp)
  parts.push(
    `ESTILO DE ESCRITURA (importante, escribís para WhatsApp):\n` +
    `- NUNCA uses asteriscos (**) ni ningún markdown. WhatsApp no los renderiza y se ven literales. ` +
    `Escribí en texto plano: sin negritas, sin listas con guiones de markdown.\n` +
    `- NO uses markdown NUNCA: nada de ** para negrita, nada de ## títulos, nada de símbolos para dar formato. ` +
    `En WhatsApp el markdown no se renderiza y se ven los símbolos literales (queda feo). Escribí natural, sin símbolos.\n` +
    `- Si alguna vez necesitás destacar algo, como mucho usá el formato propio de WhatsApp (un solo asterisco *así*), ` +
    `pero por defecto escribí sin símbolos.\n` +
    `- Las listas hacelas con guiones simples o en texto corrido, sin negritas ni símbolos raros.\n` +
    `- Cuando menciones la duración de un servicio, decila en horas y minutos legibles (ej: "2h", "3h 30min", "45min"). ` +
    `Nunca digas la duración en minutos sueltos como "120 min".\n` +
    `- Respuestas CORTAS y naturales, como un mensaje de WhatsApp: cálidas, breves, argentinas. ` +
    `Respondé puntual lo que se consulta y, si hace falta, ofrecé contar más.`,
  )

  return parts.join('\n\n')
}

// ── Definiciones de las herramientas (formato tool use de Anthropic) ────────────
// Solo LECTURA. Cada una se ejecuta server-side contra la base con RLS.
type AnthropicTool = { name: string; description: string; input_schema: Record<string, unknown> }

const TOOL_BUSCAR_PRODUCTOS: AnthropicTool = {
  name: 'buscar_productos',
  description:
    'Busca productos del negocio por nombre, categoría o descripción. Devuelve como máximo 10 (nombre, precio, ' +
    'stock, categoría). Usala cuando el cliente pregunta por un producto puntual o un precio. NO la uses para ' +
    'volcar todo el catálogo.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Texto a buscar en nombre/categoría/descripción (ej: "shampoo", "antipulgas").' },
      categoria: { type: 'string', description: 'Filtrar por categoría (opcional).' },
    },
    required: ['query'],
  },
}

const TOOL_CONSULTAR_STOCK: AnthropicTool = {
  name: 'consultar_stock',
  description:
    'Devuelve el stock actual real de un producto por su nombre. Usala cuando el cliente pregunta "¿tenés X?" o ' +
    '"¿hay stock de X?".',
  input_schema: {
    type: 'object',
    properties: {
      nombre_producto: { type: 'string', description: 'Nombre del producto a consultar.' },
    },
    required: ['nombre_producto'],
  },
}

const TOOL_BUSCAR_SERVICIOS: AnthropicTool = {
  name: 'buscar_servicios',
  description:
    'Lista o busca servicios que ofrece el negocio, con su precio (o "a consultar") y duración en minutos. Usala ' +
    'cuando el cliente pregunta por un servicio, su precio o cuánto dura. Si mandás query vacío, lista los servicios.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Texto a buscar (opcional; vacío lista los servicios).' },
      categoria: { type: 'string', description: 'Filtrar por categoría (opcional).' },
    },
    required: [],
  },
}

const TOOL_CONSULTAR_DISPONIBILIDAD: AnthropicTool = {
  name: 'consultar_disponibilidad',
  description:
    'Consulta si hay lugar para un turno (NO reserva, solo consulta). Si pasás "hora", responde si esa hora está ' +
    'disponible; si NO pasás "hora", devuelve los horarios libres de ese día. Podés filtrar por servicio (define la ' +
    'duración) y por empleado/profesional (el nombre no necesita tildes ni mayúsculas exactas).',
  input_schema: {
    type: 'object',
    properties: {
      fecha: { type: 'string', description: 'Fecha en formato AAAA-MM-DD.' },
      hora: { type: 'string', description: 'Hora puntual HH:MM (opcional). Si se omite, devuelve todos los horarios libres del día.' },
      servicio: { type: 'string', description: 'Nombre del servicio (opcional pero recomendado; define la duración).' },
      empleado: { type: 'string', description: 'Nombre del empleado/profesional (opcional).' },
    },
    required: ['fecha'],
  },
}

const TOOL_BUSCAR_EMPLEADOS: AnthropicTool = {
  name: 'buscar_empleados',
  description:
    'Devuelve los empleados / miembros del equipo del negocio, con su nombre, rol y qué servicios hace cada uno. ' +
    'Usala cuando el cliente pregunta por una persona ("¿atiende Raúl?", "¿está el Dr. Gómez?"), por quién hace un ' +
    'servicio ("¿quién hace las uñas?"), o para ofrecer alternativas si el que pidió no existe. Si mandás query ' +
    'vacío, lista todo el equipo. El nombre NO necesita tildes ni mayúsculas exactas.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Nombre (o parte) a buscar (opcional; vacío lista todo el equipo).' },
    },
    required: [],
  },
}

// ÚNICA tool que ESCRIBE: reserva el turno de verdad en la agenda (RPC atómica
// agendar_turno). Se ejecuta server-side con RLS. Ver reglas de uso en el system prompt.
const TOOL_AGENDAR_TURNO: AnthropicTool = {
  name: 'agendar_turno',
  description:
    'Reserva el turno DE VERDAD en la agenda. Usar SOLO después de haber chequeado disponibilidad con ' +
    'consultar_disponibilidad Y de que el cliente confirmó los datos. No usar para consultar.',
  input_schema: {
    type: 'object',
    properties: {
      fecha: { type: 'string', description: 'Fecha en formato AAAA-MM-DD.' },
      hora: { type: 'string', description: 'Hora puntual HH:MM.' },
      nombre_cliente: { type: 'string', description: 'Nombre del cliente que reserva.' },
      telefono: { type: 'string', description: 'Teléfono del cliente (opcional).' },
      servicio: { type: 'string', description: 'Nombre del servicio (opcional; define la duración).' },
      empleado: { type: 'string', description: 'Nombre del empleado/profesional (opcional).' },
      duracion_min: { type: 'number', description: 'Duración en minutos (opcional; si se omite, la toma del servicio).' },
      notas: { type: 'string', description: 'Notas del turno (opcional).' },
    },
    required: ['fecha', 'hora', 'nombre_cliente'],
  },
}

// Saca caracteres que rompen el filtro .or() de PostgREST (comas, paréntesis, %).
function safeText(s: unknown): string {
  return String(s ?? '').replace(/[,%()\\]/g, ' ').trim()
}

// Normaliza para comparar SIN tildes ni mayúsculas (igual criterio que el buscador
// global con unaccent): "Dr. Gómez" y "dr. gomez" quedan iguales.
function fold(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// ── Handler ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Usá POST para hablar con el asistente.' }, 405)
  }

  // Secreto con la API key de Anthropic.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({ error: 'Falta el secreto ANTHROPIC_API_KEY en Supabase. Cargalo y volvé a probar.' }, 500)
  }

  // Leemos el cuerpo. Aceptamos DOS formas:
  //  1) { messages: [{ role, content }, ...] }  -> historial completo (la bandeja)
  //  2) { message: "texto" }                    -> un solo turno (compat pantalla vieja)
  let body: { message?: unknown; messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'El cuerpo del pedido no es JSON válido.' }, 400)
  }

  type InMsg = { role?: unknown; content?: unknown }
  let history: InMsg[] = []
  if (Array.isArray(body?.messages)) {
    history = body.messages as InMsg[]
  } else if (typeof body?.message === 'string') {
    history = [{ role: 'customer', content: body.message }]
  }

  // Normalizamos a los roles de la API de Claude:
  //   customer -> user   |   agent/human -> assistant
  const normalized = history
    .filter((m) => typeof m?.content === 'string' && (m.content as string).trim() !== '')
    .map((m) => ({
      role: (m.role === 'agent' || m.role === 'human' || m.role === 'assistant') ? 'assistant' : 'user',
      content: (m.content as string).trim(),
    }))

  // La API exige que los turnos ALTERNEN user/assistant y ARRANQUEN en user.
  // Colapsamos turnos consecutivos del mismo rol y sacamos assistant iniciales.
  type ChatMsg = { role: string; content: unknown }
  const chatMessages: ChatMsg[] = []
  for (const m of normalized) {
    const last = chatMessages[chatMessages.length - 1]
    if (last && last.role === m.role && typeof last.content === 'string') last.content += '\n' + m.content
    else chatMessages.push({ role: m.role, content: m.content })
  }
  while (chatMessages.length && chatMessages[0].role === 'assistant') chatMessages.shift()

  if (chatMessages.length === 0) {
    return json({ error: 'Mandá "messages" (historial) o "message" con texto.' }, 400)
  }

  // ── Contexto del negocio (server-side, con el user_id del JWT) ──
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) {
    return json({ error: 'No pudimos identificar tu sesión. Volvé a iniciar sesión.' }, 401)
  }
  const uid = user.id

  // Resumen del catálogo (count + categorías), sin traer la lista completa.
  async function summarize(table: 'products' | 'services'): Promise<CatalogSummary> {
    const { data, count, error } = await supabase
      .from(table)
      .select('category', { count: 'exact' })
      .eq('user_id', uid)
      .limit(500)
    if (error) return { count: 0, categories: [] }
    const categories = Array.from(
      new Set((data ?? []).map((r) => (r as { category?: string | null }).category).filter(Boolean) as string[]),
    ).slice(0, 20)
    return { count: count ?? 0, categories }
  }

  const [bpRes, acRes, prodSummary, servSummary, empCountRes] = await Promise.all([
    supabase.from('business_profiles').select('business_name, industry, description, address, phone, business_hours').eq('user_id', uid).maybeSingle(),
    supabase.from('agent_configs').select('agent_name, tone, instructions, business_type').eq('user_id', uid).maybeSingle(),
    summarize('products'),
    summarize('services'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('active', true),
  ])

  const hasEmployees = (empCountRes.count ?? 0) > 0

  const systemPrompt = buildSystemPrompt(
    (bpRes.data as BusinessProfile) ?? null,
    (acRes.data as AgentConfig) ?? null,
    prodSummary,
    servSummary,
    hasEmployees,
  )

  // Solo ofrecemos las tools que tienen sentido para este negocio.
  const tools: AnthropicTool[] = []
  if (prodSummary.count > 0) tools.push(TOOL_BUSCAR_PRODUCTOS, TOOL_CONSULTAR_STOCK)
  if (servSummary.count > 0) tools.push(TOOL_BUSCAR_SERVICIOS, TOOL_CONSULTAR_DISPONIBILIDAD, TOOL_AGENDAR_TURNO)
  if (hasEmployees) tools.push(TOOL_BUSCAR_EMPLEADOS)

  // ── Ejecutores de las tools (LECTURA, con RLS por el token del usuario) ──
  async function buscarProductos(input: Record<string, unknown>) {
    const query = safeText(input?.query)
    let q = supabase.from('products').select('name, price, stock, category, description').eq('user_id', uid).order('name').limit(10)
    if (query) q = q.or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`)
    if (input?.categoria) q = q.ilike('category', `%${safeText(input.categoria)}%`)
    const { data, error } = await q
    if (error) return { error: 'No se pudo buscar productos.' }
    const resultados = (data ?? []).map((p) => {
      const x = p as { name: string; price: number; stock: number; category: string | null; description: string | null }
      return { nombre: x.name, precio: x.price, stock: x.stock, categoria: x.category, descripcion: x.description }
    })
    return resultados.length ? { resultados } : { resultados: [], nota: 'No se encontraron productos con esa búsqueda.' }
  }

  async function consultarStock(input: Record<string, unknown>) {
    const nombre = safeText(input?.nombre_producto)
    if (!nombre) return { error: 'Falta el nombre del producto.' }
    const { data, error } = await supabase
      .from('products').select('name, stock, price, description').eq('user_id', uid).ilike('name', `%${nombre}%`).order('name').limit(5)
    if (error) return { error: 'No se pudo consultar el stock.' }
    if (!data || !data.length) return { encontrado: false, nota: `No encontré un producto llamado "${input?.nombre_producto}".` }
    return {
      encontrado: true,
      resultados: (data as { name: string; stock: number; price: number; description: string | null }[]).map((p) => ({ nombre: p.name, stock: p.stock, precio: p.price, descripcion: p.description })),
    }
  }

  async function buscarServicios(input: Record<string, unknown>) {
    const query = safeText(input?.query)
    let q = supabase.from('services').select('name, price, price_on_request, duration_min, category, description').eq('user_id', uid).order('name').limit(15)
    if (query) q = q.or(`name.ilike.%${query}%,category.ilike.%${query}%,description.ilike.%${query}%`)
    if (input?.categoria) q = q.ilike('category', `%${safeText(input.categoria)}%`)
    const { data, error } = await q
    if (error) return { error: 'No se pudo buscar servicios.' }
    const resultados = (data ?? []).map((s) => {
      const x = s as { name: string; price: number; price_on_request: boolean; duration_min: number | null; category: string | null; description: string | null }
      return {
        nombre: x.name,
        precio: x.price_on_request ? 'a consultar' : x.price,
        duracion_min: x.duration_min,
        categoria: x.category,
        descripcion: x.description,
      }
    })
    return resultados.length ? { resultados } : { resultados: [], nota: 'No se encontraron servicios.' }
  }

  // Trae el equipo activo. Como son pocos, el match por nombre lo hacemos en el
  // servidor con fold() (sin tildes ni mayúsculas), no con ilike (que no ignora tildes).
  type Emp = { id: string; name: string; role: string | null; does_all_services: boolean }
  async function traerEmpleadosActivos(): Promise<Emp[]> {
    const { data } = await supabase
      .from('employees').select('id, name, role, does_all_services').eq('user_id', uid).eq('active', true).order('name')
    return (data ?? []) as Emp[]
  }

  async function buscarEmpleados(input: Record<string, unknown>) {
    const emps = await traerEmpleadosActivos()
    if (!emps.length) return { resultados: [], nota: 'No hay empleados cargados.' }

    // Servicios que hace cada empleado (para los que NO hacen todos).
    const { data: esData } = await supabase.from('employee_services').select('employee_id, services(name)').eq('user_id', uid)
    const svcByEmp = new Map<string, string[]>()
    for (const row of (esData ?? [])) {
      const r = row as { employee_id: string; services: { name: string } | { name: string }[] | null }
      const svc = Array.isArray(r.services) ? r.services[0] : r.services
      if (svc?.name) {
        const arr = svcByEmp.get(r.employee_id) ?? []
        arr.push(svc.name)
        svcByEmp.set(r.employee_id, arr)
      }
    }

    const q = fold(input?.query)
    const filtrados = q ? emps.filter((e) => fold(e.name).includes(q)) : emps
    const resultados = filtrados.map((e) => ({
      nombre: e.name,
      rol: e.role,
      servicios: e.does_all_services ? 'todos los servicios' : (svcByEmp.get(e.id) ?? []),
    }))
    if (resultados.length) return { resultados }
    // No hubo match: devolvemos igual el equipo completo para que el agente ofrezca alternativas.
    return {
      resultados: [],
      nota: `No encontré a nadie que coincida con "${input?.query}".`,
      equipo_disponible: emps.map((e) => e.name),
    }
  }

  async function consultarDisponibilidad(input: Record<string, unknown>) {
    const fecha = String(input?.fecha ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Necesito la fecha en formato AAAA-MM-DD.' }

    // Resolver servicio (nombre -> id + duración)
    let serviceId: string | null = null
    let dur: number | null = null
    let servicioNombre: string | null = null
    if (input?.servicio) {
      const { data } = await supabase.from('services').select('id, name, duration_min').eq('user_id', uid).ilike('name', `%${safeText(input.servicio)}%`).limit(1)
      if (data && data.length) {
        const s = data[0] as { id: string; name: string; duration_min: number | null }
        serviceId = s.id; dur = s.duration_min; servicioNombre = s.name
      } else {
        return { nota: `No encontré un servicio llamado "${input.servicio}".` }
      }
    }

    // Resolver empleado (nombre -> id) con match flexible: sin tildes ni mayúsculas
    // y parcial. Si hay varios, pedimos que el agente pregunte cuál.
    let employeeId: string | null = null
    let empleadoNombre: string | null = null
    if (input?.empleado) {
      const emps = await traerEmpleadosActivos()
      const q = fold(input.empleado)
      const matches = emps.filter((e) => fold(e.name).includes(q))
      if (matches.length === 0) {
        return {
          nota: `No encontré a "${input.empleado}" en el equipo.`,
          equipo_disponible: emps.map((e) => e.name),
        }
      }
      if (matches.length > 1) {
        return {
          ambiguo: true,
          coincidencias: matches.map((e) => e.name),
          nota: `Hay varios que coinciden con "${input.empleado}". Preguntale al cliente con cuál de ellos.`,
        }
      }
      employeeId = matches[0].id
      empleadoNombre = matches[0].name
    }

    const hora = input?.hora ? String(input.hora).trim() : null
    if (hora) {
      if (!/^\d{1,2}:\d{2}$/.test(hora)) return { error: 'La hora tiene que ser HH:MM.' }
      const { data, error } = await supabase.rpc('check_availability', {
        target_uid: uid, p_date: fecha, p_time: hora, p_service_id: serviceId, p_duration_min: dur, p_employee_id: employeeId,
      })
      if (error) return { error: 'No se pudo consultar la disponibilidad.' }
      return { tipo: 'hora_puntual', fecha, hora, servicio: servicioNombre, empleado: empleadoNombre, resultado: data }
    }
    const { data, error } = await supabase.rpc('agenda_free_slots', {
      target_uid: uid, p_date: fecha, p_service_id: serviceId, p_duration_min: dur, p_step_min: 30, p_employee_id: employeeId,
    })
    if (error) return { error: 'No se pudieron traer los horarios libres.' }
    return { tipo: 'horarios_libres', fecha, servicio: servicioNombre, empleado: empleadoNombre, resultado: data }
  }

  // ── Tool que ESCRIBE: reserva el turno de verdad vía la RPC atómica agendar_turno. ──
  // Resuelve servicio y empleado igual que consultarDisponibilidad (mismos helpers)
  // para quedar 100% consistente con la tool que CONSULTA.
  async function agendarTurno(input: Record<string, unknown>) {
    console.log('[agendar_turno] input:', JSON.stringify(input))
    const fecha = String(input?.fecha ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: 'Necesito la fecha en formato AAAA-MM-DD.' }
    const hora = String(input?.hora ?? '').trim()
    if (!/^\d{1,2}:\d{2}$/.test(hora)) return { ok: false, error: 'La hora tiene que ser HH:MM.' }
    const nombreCliente = String(input?.nombre_cliente ?? '').trim()
    if (!nombreCliente) return { ok: false, error: 'Falta el nombre del cliente.' }

    // Resolver servicio con match FLEXIBLE (mismo criterio que empleados): sin tildes
    // ni mayúsculas y sacando palabras de relleno. El agente suele mandar el nombre con
    // ruido ("lavado comun PARA auto") y el ilike exacto no matchea "lavado comun auto".
    const STOPWORDS = ['para', 'de', 'del', 'la', 'el', 'un', 'una', 'y', 'con', 'a', 'al']
    let serviceId: string | null = null
    let servicioNombre: string | null = null
    let svcDuration: number | null = null
    let svcPrice: number | null = null
    if (input?.servicio) {
      const { data: svcData } = await supabase
        .from('services').select('id, name, duration_min, price, price_on_request').eq('user_id', uid).order('name')
      const servicios = (svcData ?? []) as { id: string; name: string; duration_min: number | null; price: number; price_on_request: boolean }[]
      // Palabras significativas de lo que mandó el agente (sin tildes/mayúsculas ni relleno).
      const palabras = fold(input.servicio).split(/\s+/).filter((w) => w && !STOPWORDS.includes(w))
      // Un servicio matchea si su nombre (folded) contiene TODAS esas palabras.
      const matches = palabras.length
        ? servicios.filter((s) => { const n = fold(s.name); return palabras.every((w) => n.includes(w)) })
        : []
      if (matches.length === 1) {
        const s = matches[0]
        serviceId = s.id
        servicioNombre = s.name                                 // nombre REAL del catálogo
        svcDuration = s.duration_min
        svcPrice = s.price_on_request ? null : s.price           // "a consultar" => sin precio
      } else if (matches.length > 1) {
        return {
          ok: false,
          ambiguo: true,
          coincidencias: matches.map((s) => s.name),
          nota: `Hay varios servicios que coinciden con "${input.servicio}". Preguntale al cliente cuál de ellos.`,
        }
      } else {
        return {
          ok: false,
          nota: `No encontré un servicio llamado "${input.servicio}".`,
          servicios_disponibles: servicios.map((s) => s.name),
        }
      }
    }

    // Resolver empleado (nombre -> id) con match flexible: sin tildes ni mayúsculas
    let employeeId: string | null = null
    if (input?.empleado) {
      const emps = await traerEmpleadosActivos()
      const q = fold(input.empleado)
      const matches = emps.filter((e) => fold(e.name).includes(q))
      if (matches.length === 0) {
        return {
          ok: false,
          nota: `No encontré a "${input.empleado}" en el equipo.`,
          equipo_disponible: emps.map((e) => e.name),
        }
      }
      if (matches.length > 1) {
        return {
          ok: false,
          ambiguo: true,
          coincidencias: matches.map((e) => e.name),
          nota: `Hay varios que coinciden con "${input.empleado}". Preguntale al cliente con cuál de ellos.`,
        }
      }
      employeeId = matches[0].id
    }

    // Duración: la que mandó el agente, o (si no) la del servicio del catálogo.
    const duracion = input?.duracion_min != null ? Number(input.duracion_min) : null
    const durMin = (duracion != null && !isNaN(duracion) && duracion > 0) ? duracion : svcDuration
    // Precio: el agente no lo manda; si el servicio tiene precio, lo usamos.
    const priceNum = svcPrice
    const telefono = input?.telefono ? String(input.telefono).trim() || null : null
    const notas = input?.notas ? String(input.notas).trim() || null : null

    console.log('[agendar_turno] servicio resuelto:', serviceId, servicioNombre, 'dur:', durMin, 'precio:', priceNum)

    const { data, error } = await supabase.rpc('agendar_turno', {
      target_uid: uid,
      p_date: fecha,
      p_time: hora,
      p_customer_name: nombreCliente,
      p_phone: telefono,
      p_service_id: serviceId,
      p_service_name: servicioNombre,
      p_employee_id: employeeId,
      p_duration_min: durMin,
      p_price: priceNum,
      p_notes: notas,
      p_source: 'web',
      p_save_customer: true,
    })
    console.log('[agendar_turno] rpc data:', JSON.stringify(data), 'error:', JSON.stringify(error))
    if (error) return { ok: false, error: 'No se pudo agendar el turno.', detalle: error.message }
    return data
  }

  async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    try {
      switch (name) {
        case 'buscar_productos': return await buscarProductos(input)
        case 'consultar_stock': return await consultarStock(input)
        case 'buscar_servicios': return await buscarServicios(input)
        case 'consultar_disponibilidad': return await consultarDisponibilidad(input)
        case 'agendar_turno': return await agendarTurno(input)
        case 'buscar_empleados': return await buscarEmpleados(input)
        default: return { error: `Herramienta desconocida: ${name}` }
      }
    } catch (e) {
      return { error: 'Error ejecutando la herramienta.', detalle: String(e) }
    }
  }

  // ── Loop de tool use ──
  // El agente puede pedir usar tools; ejecutamos, le devolvemos el resultado y
  // seguimos hasta que responda al cliente (o tope de vueltas). Sumamos los tokens
  // de TODAS las llamadas del turno.
  const usage = { input_tokens: 0, output_tokens: 0 }
  const convo: ChatMsg[] = chatMessages.slice()
  // ¿Se concretó una reserva REAL en este mensaje? (agendar_turno devolvió ok:true)
  // Lo usamos para loguear y para avisarle al front, así "confirmado" deja de ser
  // una afirmación del modelo y pasa a ser un hecho verificado por el servidor.
  let booked = false
  let bookedApptId: string | null = null
  let agendarLlamada = false
  let finalData: {
    content?: { type?: string; text?: string; id?: string; name?: string; input?: unknown }[]
    stop_reason?: string
    usage?: { input_tokens?: number; output_tokens?: number }
  } | null = null

  for (let i = 0; i <= MAX_TOOL_ITERS; i++) {
    const reqBody: Record<string, unknown> = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: convo,
    }
    if (tools.length) reqBody.tools = tools

    let apiRes: Response
    try {
      apiRes = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(reqBody),
      })
    } catch (e) {
      return json({ error: 'No se pudo contactar a la API de Claude.', detalle: String(e) }, 502)
    }

    if (!apiRes.ok) {
      let anthropicError = `La API de Claude respondió con estado ${apiRes.status}.`
      try {
        const errBody = await apiRes.json()
        if (errBody?.error?.message) anthropicError = errBody.error.message
      } catch {
        // nos quedamos con el mensaje genérico
      }
      return json({ error: anthropicError, status: apiRes.status }, apiRes.status)
    }

    finalData = await apiRes.json()
    usage.input_tokens += finalData?.usage?.input_tokens ?? 0
    usage.output_tokens += finalData?.usage?.output_tokens ?? 0

    // Si NO pidió tools, terminó: esta respuesta es para el cliente.
    if (finalData?.stop_reason !== 'tool_use') break
    // Alcanzamos el tope de vueltas: cortamos (evita bucles infinitos).
    if (i === MAX_TOOL_ITERS) break

    // Guardamos la respuesta del agente (incluye los bloques tool_use) tal cual.
    convo.push({ role: 'assistant', content: finalData.content ?? [] })

    // Ejecutamos cada tool pedida y devolvemos TODOS los resultados en un solo user turn.
    const toolUses = (finalData.content ?? []).filter((b) => b?.type === 'tool_use')
    const toolResults = []
    for (const tu of toolUses) {
      const result = await runTool(String(tu.name), (tu.input as Record<string, unknown>) ?? {})
      if (tu.name === 'agendar_turno') {
        agendarLlamada = true
        const r = result as { ok?: boolean; appointment_id?: string }
        if (r?.ok === true) { booked = true; bookedApptId = r.appointment_id ?? null }
      }
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
    }
    convo.push({ role: 'user', content: toolResults })
  }

  // Texto final para el cliente.
  let reply = Array.isArray(finalData?.content)
    ? finalData!.content
        .filter((b) => b?.type === 'text')
        .map((b) => b.text ?? '')
        .join('')
    : ''
  if (!reply.trim()) reply = 'Perdoná, no pude completar la consulta ahora. ¿Lo intentamos de nuevo?'

  // Red de seguridad: por más que el prompt lo prohíba, si el modelo se zarpa y mete
  // markdown de negrita (** o __), lo sacamos. WhatsApp no lo renderiza y se ve literal.
  reply = reply.replace(/\*\*/g, '').replace(/__/g, '')

  // Log inequívoco del desenlace: si el modelo dijo "confirmado" pero acá ves
  // agendo_llamada:false, es que NUNCA llamó la tool (narró la acción). Si ves
  // agendo_llamada:true y booked:false, la RPC rechazó (mirá el log rpc data).
  console.log('[chat] desenlace:', JSON.stringify({ agendo_llamada: agendarLlamada, booked, appointment_id: bookedApptId }))

  return json({ reply, usage, model: MODEL, stop_reason: finalData?.stop_reason ?? null, booked, appointment_id: bookedApptId })
})
