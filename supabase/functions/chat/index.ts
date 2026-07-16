// supabase/functions/chat/index.ts
//
// EL CEREBRO — Capa 1: el caño seguro hacia la API de Claude.
// Esta función corre del lado del SERVIDOR (Supabase Edge, Deno). El front le manda
// un mensaje y ella le pregunta a Claude. La API key vive como SECRETO de Supabase
// (ANTHROPIC_API_KEY) y NUNCA viaja al navegador ni queda en el repo.
//
// Todavía no hay bandeja, ni datos del negocio, ni personalidad: solo la plomería.

// ── Configuración fácil de cambiar ─────────────────────────────────────────────
// Modelo más barato para probar. El día de mañana lo subimos a uno más capaz
// cambiando SOLO esta constante.
const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 1024
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// ── CORS ────────────────────────────────────────────────────────────────────────
// Necesario para que el navegador pueda llamar a la función desde tu app.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Helper: siempre respondemos JSON + CORS, con el status que corresponda.
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  // 1) Preflight de CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2) Solo aceptamos POST.
  if (req.method !== 'POST') {
    return json({ error: 'Usá POST para hablar con Claude.' }, 405)
  }

  // 3) La API key tiene que estar cargada como secreto en Supabase.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json(
      { error: 'Falta el secreto ANTHROPIC_API_KEY en Supabase. Cargalo y volvé a probar.' },
      500,
    )
  }

  // 4) Leemos el mensaje que mandó el front.
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

  // 5) Le preguntamos a Claude.
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
        messages: [{ role: 'user', content: message }],
      }),
    })
  } catch (e) {
    // Falla de red antes de que Anthropic responda.
    return json(
      { error: 'No se pudo contactar a la API de Claude.', detalle: String(e) },
      502,
    )
  }

  // 6) Si Anthropic devolvió error (sin saldo, key inválida, etc.), lo mostramos legible.
  if (!apiRes.ok) {
    let anthropicError = `La API de Claude respondió con estado ${apiRes.status}.`
    try {
      const errBody = await apiRes.json()
      // Forma típica: { type: "error", error: { type, message } }
      if (errBody?.error?.message) {
        anthropicError = errBody.error.message
      }
    } catch {
      // Si el error no vino en JSON, nos quedamos con el mensaje genérico de arriba.
    }
    return json({ error: anthropicError, status: apiRes.status }, apiRes.status)
  }

  // 7) Éxito. Extraemos el texto y los tokens.
  const data = await apiRes.json()

  // El texto viene como una lista de bloques; juntamos los de tipo "text".
  const reply = Array.isArray(data.content)
    ? data.content
        .filter((b: { type?: string }) => b?.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('')
    : ''

  // Tokens: los devolvemos SIEMPRE (aunque todavía no los mostremos) para el contador.
  const usage = {
    input_tokens: data.usage?.input_tokens ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
  }

  return json({ reply, usage, model: MODEL, stop_reason: data.stop_reason ?? null })
})
