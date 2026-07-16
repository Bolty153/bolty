// supabase/functions/chat/index.ts
//
// EL CEREBRO — Capa 3: personalidad.
// La Edge Function corre del lado del SERVIDOR (Supabase Edge, Deno). Recibe un
// mensaje del front y le pregunta a Claude, pero AHORA con contexto del negocio:
// arma un system prompt con los datos reales (nombre, rubro, productos/servicios
// con precios, horarios con turno cortado, zona) + la personalidad configurada
// en "Mi agente" (agent_configs: nombre, tono, instrucciones).
//
// SEGURIDAD:
//  - La API key de Anthropic vive como SECRETO (ANTHROPIC_API_KEY), nunca en el front.
//  - Los datos del negocio NO se confían al front: la función saca el user_id del
//    JWT del usuario logueado y los trae ella misma de la base (con RLS).

import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Configuración fácil de cambiar ─────────────────────────────────────────────
const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 1024
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
type Product = { name: string; price: number; stock?: number; category?: string | null }
type Service = { name: string; price: number; price_on_request?: boolean; duration_min?: number | null; category?: string | null }

// Orden y etiquetas de los días (coincide con lo que guarda el front).
const DAYS: [string, string][] = [
  ['lunes', 'Lunes'], ['martes', 'Martes'], ['miercoles', 'Miércoles'],
  ['jueves', 'Jueves'], ['viernes', 'Viernes'], ['sabado', 'Sábado'], ['domingo', 'Domingo'],
]

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

function formatProducts(products: Product[]): string {
  if (!products.length) return ''
  const lines = products.map((p) => {
    const cat = p.category ? ` (${p.category})` : ''
    const sinStock = typeof p.stock === 'number' && p.stock <= 0 ? ' — SIN STOCK ahora' : ''
    return `- ${p.name}${cat}: $${p.price}${sinStock}`
  })
  return lines.join('\n')
}

// Convierte minutos a un formato legible tipo WhatsApp: 45→"45min", 90→"1h 30min",
// 120→"2h", 210→"3h 30min". Nunca deja "120 min".
function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function formatServices(services: Service[]): string {
  if (!services.length) return ''
  const lines = services.map((s) => {
    const cat = s.category ? ` (${s.category})` : ''
    const precio = s.price_on_request ? 'precio a consultar' : `$${s.price}`
    const dur = s.duration_min ? `, dura ${formatDuration(s.duration_min)}` : ''
    return `- ${s.name}${cat}: ${precio}${dur}`
  })
  return lines.join('\n')
}

function buildSystemPrompt(
  bp: BusinessProfile | null,
  ac: AgentConfig | null,
  products: Product[],
  services: Service[],
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

  // 2) Datos del negocio (base automática)
  const datos: string[] = []
  if (bp?.industry?.trim()) datos.push(`Rubro: ${bp.industry.trim()}`)
  if (bp?.description?.trim()) datos.push(`Descripción: ${bp.description.trim()}`)
  if (bp?.address?.trim()) datos.push(`Ubicación / zona: ${bp.address.trim()}`)
  if (bp?.phone?.trim()) datos.push(`Teléfono de contacto: ${bp.phone.trim()}`)
  if (datos.length) parts.push(`DATOS DEL NEGOCIO:\n${datos.join('\n')}`)

  // 3) Horarios (incluye turno cortado)
  parts.push(`HORARIOS DE ATENCIÓN:\n${formatHours(bp?.business_hours)}`)

  // 4) Qué vende
  const prods = formatProducts(products)
  const servs = formatServices(services)
  if (prods) parts.push(`PRODUCTOS QUE OFRECE:\n${prods}`)
  if (servs) parts.push(`SERVICIOS QUE OFRECE:\n${servs}`)
  if (!prods && !servs) {
    parts.push(`Todavía no hay productos ni servicios cargados en el sistema.`)
  }

  // 5) Personalidad configurada por el dueño (agent_configs)
  parts.push(`TONO DE CONVERSACIÓN: ${tone}.`)
  if (ac?.instructions?.trim()) {
    parts.push(
      `INSTRUCCIONES DEL DUEÑO (respetalas siempre que no contradigan las reglas de abajo):\n` +
      ac.instructions.trim(),
    )
  }

  // 6) Reglas de comportamiento (innegociables)
  parts.push(
    `REGLAS:\n` +
    `- Respondé siempre en español argentino (rioplatense), amable y cercano pero profesional.\n` +
    `- Usá ÚNICAMENTE la información de este contexto. NO inventes productos, precios, horarios ni datos.\n` +
    `- Si te preguntan algo que no está en el contexto, decí con sinceridad que no lo tenés a mano y ofrecé ` +
    `contactar al negocio${bp?.phone?.trim() ? ` (tel: ${bp.phone.trim()})` : ''}.\n` +
    `- NO prometas ni realices acciones que todavía no podés hacer: no confirmes ni reserves turnos, no tomes ` +
    `pagos y no cierres ventas. Si te lo piden, explicá amablemente que para eso pueden contactar al negocio directamente.`,
  )

  // 7) Estilo de escritura (el destino final es WhatsApp)
  parts.push(
    `ESTILO DE ESCRITURA (importante, escribís para WhatsApp):\n` +
    `- NO uses markdown NUNCA: nada de ** para negrita, nada de ## títulos, nada de símbolos para dar formato. ` +
    `En WhatsApp el markdown no se renderiza y se ven los símbolos literales (queda feo). Escribí natural, sin símbolos.\n` +
    `- Si alguna vez necesitás destacar algo, como mucho usá el formato propio de WhatsApp (un solo asterisco *así*), ` +
    `pero por defecto escribí sin símbolos.\n` +
    `- Las listas hacelas con guiones simples o en texto corrido, sin negritas ni símbolos raros.\n` +
    `- Cuando menciones la duración de un servicio, decila en horas y minutos legibles (ej: "2h", "3h 30min", "45min"). ` +
    `Nunca digas la duración en minutos sueltos como "120 min".\n` +
    `- Respuestas CORTAS y naturales, como un mensaje de WhatsApp: cálidas, breves, argentinas. ` +
    `No vuelques toda la información de una ni pegues el catálogo entero; respondé puntual lo que se consulta y, si hace falta, ofrecé contar más.`,
  )

  return parts.join('\n\n')
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

  // Leemos el mensaje del front.
  let message: unknown
  try {
    const body = await req.json()
    message = body?.message
  } catch {
    return json({ error: 'El cuerpo del pedido no es JSON válido.' }, 400)
  }
  if (typeof message !== 'string' || message.trim() === '') {
    return json({ error: 'Mandá un campo "message" con texto.' }, 400)
  }

  // ── Contexto del negocio (server-side, con el user_id del JWT) ──
  // Cliente de Supabase con el token del usuario: RLS garantiza que solo lea SUS datos.
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

  // Traemos todo en paralelo. RLS ya filtra por dueño; igual filtramos por user_id.
  const [bpRes, acRes, prodRes, servRes] = await Promise.all([
    supabase.from('business_profiles').select('business_name, industry, description, address, phone, business_hours').eq('user_id', user.id).maybeSingle(),
    supabase.from('agent_configs').select('agent_name, tone, instructions, business_type').eq('user_id', user.id).maybeSingle(),
    supabase.from('products').select('name, price, stock, category').eq('user_id', user.id).order('name').limit(200),
    supabase.from('services').select('name, price, price_on_request, duration_min, category').eq('user_id', user.id).order('name').limit(200),
  ])

  const systemPrompt = buildSystemPrompt(
    (bpRes.data as BusinessProfile) ?? null,
    (acRes.data as AgentConfig) ?? null,
    (prodRes.data as Product[]) ?? [],
    (servRes.data as Service[]) ?? [],
  )

  // ── Le preguntamos a Claude ──
  let apiRes: Response
  try {
    apiRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
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

  const data = await apiRes.json()

  const reply = Array.isArray(data.content)
    ? data.content
        .filter((b: { type?: string }) => b?.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('')
    : ''

  // Tokens: los devolvemos SIEMPRE para el contador futuro.
  const usage = {
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
  }

  return json({ reply, usage, model: MODEL, stop_reason: data.stop_reason ?? null })
})
