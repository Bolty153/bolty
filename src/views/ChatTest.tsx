// src/views/ChatTest.tsx
//
// PANTALLA DE PRUEBA PROVISORIA (tosca a propósito).
// Solo sirve para confirmar que el caño hacia Claude funciona punta a punta.
// NO es la bandeja. Cuando llegue la bandeja real, borramos este archivo y el
// enganche en main.tsx.
//
// Se muestra visitando la app con  #chat-test  al final de la URL, por ejemplo:
//   http://localhost:5173/#chat-test
// El resto de la app queda intacta.

import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Usage = { input_tokens: number; output_tokens: number }

export default function ChatTest() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [usage, setUsage] = useState<Usage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function enviar() {
    if (!message.trim() || loading) return
    setLoading(true)
    setError('')
    setReply('')
    setUsage(null)

    const { data, error: fnError } = await supabase.functions.invoke('chat', {
      body: { message },
    })

    if (fnError) {
      // Cuando la función responde con error (4xx/5xx), el cuerpo viene en el context.
      let msg = fnError.message
      try {
        const body = await fnError.context?.json()
        if (body?.error) msg = body.error
      } catch {
        /* nos quedamos con fnError.message */
      }
      setError(msg)
    } else if (data?.error) {
      setError(data.error)
    } else {
      setReply(data?.reply ?? '(respuesta vacía)')
      setUsage(data?.usage ?? null)
    }

    setLoading(false)
  }

  return (
    <div
      style={{
        maxWidth: 640,
        margin: '48px auto',
        padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#1a1a1a',
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>🧠 Prueba del cerebro (provisoria)</h1>
      <p style={{ fontSize: 13, color: '#666', marginTop: 0 }}>
        Escribí un mensaje y confirmá que Claude responde. Esto se borra cuando llegue la
        bandeja.
      </p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar()
        }}
        placeholder="Escribí algo para Claude… (Ctrl/Cmd + Enter para enviar)"
        rows={4}
        style={{
          width: '100%',
          padding: 12,
          fontSize: 14,
          borderRadius: 8,
          border: '1px solid #ccc',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      <button
        onClick={enviar}
        disabled={loading || !message.trim()}
        style={{
          marginTop: 12,
          padding: '10px 20px',
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          background: loading ? '#999' : '#4f46e5',
          color: 'white',
          cursor: loading || !message.trim() ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Pensando…' : 'Enviar'}
      </button>

      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 14,
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {reply && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 8,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {reply}
        </div>
      )}

      {usage && (
        <p style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
          Tokens — entrada: {usage.input_tokens} · salida: {usage.output_tokens}
        </p>
      )}
    </div>
  )
}
