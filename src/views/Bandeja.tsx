// src/views/Bandeja.tsx
//
// LA BANDEJA UNIFICADA (inbox omnicanal) — la CARA del cerebro.
// Layout de dos columnas: IZQUIERDA la lista de conversaciones, DERECHA la
// conversación abierta (globos + campo para escribir). Preparada para multicanal
// (el ícono de canal ya vive por conversación aunque hoy todas sean 'web').
//
// PARTE 1: estructura + chat web con agente automático + freno manual.
// (La derivación inteligente a humano y las reglas llegan en la parte 2.)

import { useEffect, useMemo, useRef, useState } from 'react'
import { useConversations, type Channel, type Conversation } from '../hooks/useConversations'
import { useMessages, type MsgRole } from '../hooks/useMessages'

// ── Ícono + estilo por canal (multicanal-ready) ────────────────────────────────
const channelMeta: Record<Channel, { label: string; style: React.CSSProperties; icon: React.ReactNode }> = {
  web: {
    label: 'Chat web',
    style: { background: 'var(--volt-wash)', color: 'var(--volt)' },
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 014 10 15 15 0 01-4 10 15 15 0 01-4-10 15 15 0 014-10z" />
      </svg>
    ),
  },
  whatsapp: {
    label: 'WhatsApp',
    style: { background: 'var(--mint-wash)', color: 'var(--mint)' },
    icon: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.2-1.3-.1-.2-.3-.2-.6-.3zM12 2a10 10 0 00-8.5 15.3L2 22l4.8-1.5A10 10 0 1012 2z" />
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    style: { background: '#fce4f0', color: '#d6248f' },
    icon: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.1.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.1-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.1-.4-.3-1-.4-2.2-.1-1.3-.1-1.7-.1-4.9s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.1 1-.3 2.2-.4 1.3-.1 1.7-.1 4.9-.1zM12 7.8a4.2 4.2 0 100 8.4 4.2 4.2 0 000-8.4zm0 6.9a2.7 2.7 0 110-5.4 2.7 2.7 0 010 5.4zm5.3-7.1a1 1 0 11-2 0 1 1 0 012 0z" />
      </svg>
    ),
  },
  mail: {
    label: 'Mail',
    style: { background: 'var(--amber-wash)', color: 'var(--amber)' },
    icon: (
      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <path d="M22 6l-10 7L2 6" />
      </svg>
    ),
  },
}

function displayName(c: Conversation) {
  return c.customer_name?.trim() || 'Cliente web'
}

function initialOf(c: Conversation) {
  const n = c.customer_name?.trim()
  return n ? n[0].toUpperCase() : 'W'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

// ── Ítem de la lista ────────────────────────────────────────────────────────────
function ConvListItem({
  conv,
  active,
  preview,
  onClick,
}: {
  conv: Conversation
  active: boolean
  preview: string
  onClick: () => void
}) {
  const ch = channelMeta[conv.channel] ?? channelMeta.web
  return (
    <button className={`inbox-item${active ? ' active' : ''}`} onClick={onClick}>
      <div className="inbox-av">{initialOf(conv)}</div>
      <div className="inbox-item-body">
        <div className="inbox-item-top">
          <span className="inbox-item-name">{displayName(conv)}</span>
          <span className="inbox-item-time">{formatTime(conv.last_message_at)}</span>
        </div>
        <div className="inbox-item-bottom">
          <span className="inbox-item-preview">{preview || 'Sin mensajes todavía'}</span>
          <span className="inbox-chan" style={ch.style} title={ch.label}>
            {ch.icon}
          </span>
        </div>
      </div>
      {conv.mode === 'manual' && <span className="inbox-mode-tag manual" title="Vos respondés">✋</span>}
    </button>
  )
}

// ── La conversación abierta (globos + composer) ───────────────────────────────────
function Thread({
  conv,
  onBack,
  onSetMode,
  onPreview,
}: {
  conv: Conversation
  onBack: () => void
  onSetMode: (mode: 'auto' | 'manual') => void
  onPreview: (text: string) => void
}) {
  const { messages, loading, agentThinking, error, sendAsCustomer, sendAsHuman } = useMessages(conv.id, conv.mode)
  const [text, setText] = useState('')
  // Con qué "sombrero" escribo: como cliente (para probar) o como negocio (humano).
  // El default sigue al modo, pero se puede cambiar para testear ambos lados.
  const [writeAs, setWriteAs] = useState<'customer' | 'human'>(conv.mode === 'auto' ? 'customer' : 'human')
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setWriteAs(conv.mode === 'auto' ? 'customer' : 'human')
  }, [conv.mode, conv.id])

  // Refleja el último mensaje como preview en la lista de la izquierda.
  const last = messages[messages.length - 1]
  useEffect(() => {
    if (last) onPreview(last.content)
  }, [last?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll al último mensaje.
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, agentThinking])

  async function send() {
    const clean = text.trim()
    if (!clean || agentThinking) return
    setText('')
    if (writeAs === 'customer') await sendAsCustomer(clean)
    else await sendAsHuman(clean)
  }

  const ch = channelMeta[conv.channel] ?? channelMeta.web

  return (
    <section className="inbox-thread">
      {/* Header de la conversación */}
      <div className="inbox-thread-head">
        <button className="inbox-back" onClick={onBack} aria-label="Volver">
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="inbox-av">{initialOf(conv)}</div>
        <div className="inbox-thread-id">
          <h3>{displayName(conv)}</h3>
          <span className="inbox-thread-chan">
            <span className="inbox-chan sm" style={ch.style}>{ch.icon}</span>
            {ch.label}
          </span>
        </div>
        <div className="inbox-mode-zone">
          <span className={`inbox-mode-badge ${conv.mode}`}>
            {conv.mode === 'auto' ? '🤖 Agente automático' : '✋ Vos respondés'}
          </span>
          {conv.mode === 'auto' ? (
            <button className="inbox-mode-btn take" onClick={() => onSetMode('manual')}>Tomar conversación</button>
          ) : (
            <button className="inbox-mode-btn give" onClick={() => onSetMode('auto')}>Devolver al agente</button>
          )}
        </div>
      </div>

      {/* Cuerpo: globos */}
      <div className="inbox-thread-body" ref={bodyRef}>
        {loading ? (
          <div className="inbox-empty-note">Cargando conversación…</div>
        ) : messages.length === 0 ? (
          <div className="inbox-empty-note">
            Todavía no hay mensajes. Escribí abajo como si fueras un cliente y mirá cómo responde tu agente.
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)
        )}
        {agentThinking && (
          <div className="msg-row agent">
            <div className="msg-bubble agent typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        {error && <div className="inbox-error">⚠️ {error}</div>}
      </div>

      {/* Composer */}
      <div className="inbox-composer">
        <div className="inbox-writeas">
          <button
            className={`inbox-writeas-chip${writeAs === 'customer' ? ' on' : ''}`}
            onClick={() => setWriteAs('customer')}
          >
            👤 Cliente
          </button>
          <button
            className={`inbox-writeas-chip${writeAs === 'human' ? ' on' : ''}`}
            onClick={() => setWriteAs('human')}
          >
            🏢 Negocio
          </button>
          {writeAs === 'customer' && conv.mode === 'auto' && (
            <span className="inbox-writeas-hint">el agente responde solo</span>
          )}
          {writeAs === 'customer' && conv.mode === 'manual' && (
            <span className="inbox-writeas-hint">el agente está frenado, no responde</span>
          )}
        </div>
        <div className="inbox-composer-row">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={
              writeAs === 'customer'
                ? 'Escribí como cliente para probar al agente…'
                : 'Respondé como negocio…'
            }
          />
          <button className="inbox-send" onClick={send} disabled={!text.trim() || agentThinking} aria-label="Enviar">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
      </div>
    </section>
  )
}

function Bubble({ role, content }: { role: MsgRole; content: string }) {
  // customer = entrante (izquierda) · agent/human = saliente (derecha)
  const outgoing = role !== 'customer'
  const label = role === 'agent' ? 'Agente' : role === 'human' ? 'Vos' : null
  return (
    <div className={`msg-row ${role}${outgoing ? ' out' : ' in'}`}>
      <div className={`msg-bubble ${role}`}>
        {label && <span className="msg-role">{label}</span>}
        {content}
      </div>
    </div>
  )
}

// ── Vista principal ───────────────────────────────────────────────────────────────
export default function Bandeja() {
  const { conversations, loading, createTestConversation, setMode } = useConversations()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})

  // Al cargar, seleccionamos la primera conversación (en desktop). En mobile
  // arranca sin selección para que se vea la lista completa.
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  useEffect(() => {
    if (!selectedId && conversations.length && !isMobile) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId, isMobile])

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  async function handleNewTest() {
    const row = await createTestConversation()
    if (row) setSelectedId(row.id)
  }

  return (
    <div className={`inbox-shell${selected ? ' has-open' : ''}`}>
      {/* IZQUIERDA: lista de conversaciones */}
      <aside className="inbox-list">
        <div className="inbox-list-head">
          <div>
            <h1>Conversaciones</h1>
            <div className="inbox-list-sub">Todos tus canales en un solo lugar</div>
          </div>
          <button className="inbox-new" onClick={handleNewTest} title="Nueva conversación de prueba">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>

        <div className="inbox-list-scroll">
          {loading ? (
            <div className="inbox-empty-note">Cargando…</div>
          ) : conversations.length === 0 ? (
            <div className="inbox-empty-list">
              <p>Todavía no hay conversaciones.</p>
              <button className="btn-mint" onClick={handleNewTest}>Crear conversación de prueba</button>
            </div>
          ) : (
            conversations.map((c) => (
              <ConvListItem
                key={c.id}
                conv={c}
                active={c.id === selectedId}
                preview={previews[c.id] ?? ''}
                onClick={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* DERECHA: conversación abierta */}
      {selected ? (
        <Thread
          key={selected.id}
          conv={selected}
          onBack={() => setSelectedId(null)}
          onSetMode={(mode) => setMode(selected.id, mode)}
          onPreview={(text) => setPreviews((p) => ({ ...p, [selected.id]: text }))}
        />
      ) : (
        <section className="inbox-thread inbox-thread-empty">
          <div className="inbox-empty-hero">
            <div className="inbox-empty-ic">
              <svg fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            </div>
            <h2>Elegí una conversación</h2>
            <p>Seleccioná una charla de la izquierda o creá una de prueba para hablar con tu agente.</p>
          </div>
        </section>
      )}
    </div>
  )
}
