import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Client, Plan } from './types'
import { statusLabel, fmtDate, logActivity } from './utils'
import { useAdminSupportAccess, isActiveNow } from '../../hooks/useSupportAccess'

interface Props {
  onImpersonate: (client: Client) => void
  access: ReturnType<typeof useAdminSupportAccess>
}

// Client + is_active leído de profiles (la fuente real de verdad del acceso)
interface ClientRow extends Client {
  is_active: boolean
}

// Consumo del mes de un cliente (tokens + costo en USD ya calculado por la vista).
interface ClientUsage {
  tokens_in: number
  tokens_out: number
  cost_usd: number
}
// Fila cruda de la vista token_usage_by_client (una por user_id + mes + modelo).
interface UsageRow extends ClientUsage {
  user_id: string
}

const EMPTY_FORM = {
  email: '', password: '', business_name: '', whatsapp: '',
  // Default: inactivo → el admin activa cuando confirma el pago
  plan_id: '', status: 'inactive' as Client['status'], paid_until: '', trial_ends_at: '', notes: '',
}

export default function AdminClientes({ onImpersonate, access }: Props) {
  const [clients, setClients]       = useState<ClientRow[]>([])
  const [plans, setPlans]           = useState<Plan[]>([])
  // Consumo del mes actual por cliente (vista token_usage_by_client, ya costeada).
  // Mapa user_id -> tokens y costo en USD del mes en curso.
  const [usage, setUsage]           = useState<Record<string, ClientUsage>>({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState<'all' | Client['status']>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editClient, setEditClient] = useState<ClientRow | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [formErr, setFormErr]       = useState('')
  // Estado de operación sobre una fila concreta
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [opErr, setOpErr]           = useState('')
  // Contraseña provisoria al crear cliente
  const [showPass, setShowPass]     = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ name: string; password: string } | null>(null)
  const [copied, setCopied]         = useState(false)
  // Modal para pedir acceso al panel de un cliente (con duración y motivo)
  const [accessModal, setAccessModal] = useState<ClientRow | null>(null)
  const [accessReason, setAccessReason] = useState('')
  const [accessMinutes, setAccessMinutes] = useState(30)

  async function load() {
    // Primer día del mes en curso, en el mismo formato que devuelve la vista
    // (month = date_trunc('month', created_at)::date, ej. '2026-07-01').
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [{ data: cl }, { data: pl }, { data: usageRows }] = await Promise.all([
      supabase.from('clients').select('*, plan:plans(id,name,price_ars,description)').order('created_at', { ascending: false }),
      supabase.from('plans').select('*').order('price_ars'),
      // La vista respeta la RLS de messages (security_invoker): el admin ve el de todos.
      supabase.from('token_usage_by_client').select('user_id, tokens_in, tokens_out, cost_usd').eq('month', monthKey),
    ])

    // Sumamos por cliente (una fila por modelo → las juntamos en un total del mes).
    const usageMap: Record<string, ClientUsage> = {}
    for (const r of (usageRows || []) as UsageRow[]) {
      const cur = usageMap[r.user_id] || { tokens_in: 0, tokens_out: 0, cost_usd: 0 }
      cur.tokens_in  += Number(r.tokens_in)  || 0
      cur.tokens_out += Number(r.tokens_out) || 0
      cur.cost_usd   += Number(r.cost_usd)   || 0
      usageMap[r.user_id] = cur
    }
    setUsage(usageMap)

    // Cargamos is_active real desde profiles para cada cliente
    const ids = (cl || []).map(c => c.id)
    let profileMap: Record<string, boolean> = {}
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, is_active')
        .in('id', ids)
      ;(profs || []).forEach((p: { id: string; is_active: boolean }) => {
        profileMap[p.id] = p.is_active
      })
    }

    const enriched: ClientRow[] = (cl || []).map(c => ({
      ...c,
      // Si no se pudo leer profiles, derivamos is_active del status de clients
      is_active: profileMap[c.id] !== undefined
        ? profileMap[c.id]
        : (c.status === 'active' || c.status === 'trial'),
    }))

    setClients(enriched)
    setPlans(pl || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Total del mes: suma del consumo de TODOS los clientes (para el KPI de arriba).
  const totalUsage = Object.values(usage).reduce<ClientUsage>(
    (acc, u) => ({
      tokens_in:  acc.tokens_in  + u.tokens_in,
      tokens_out: acc.tokens_out + u.tokens_out,
      cost_usd:   acc.cost_usd   + u.cost_usd,
    }),
    { tokens_in: 0, tokens_out: 0, cost_usd: 0 },
  )
  // Nombre del mes en curso (ej: "julio 2026") para rotular el KPI.
  const monthLabel = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const visible = clients.filter(c => {
    const matchSearch = !search ||
      (c.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  // ─── Activar / Desactivar acceso ──────────────────────────────────────────
  async function toggleAccess(c: ClientRow) {
    const newActive = !c.is_active
    setUpdatingId(c.id)
    setOpErr('')

    // UPSERT: crea la fila en profiles si no existe, o la actualiza si ya existe.
    // UPDATE silencioso era el problema: si no había fila, no fallaba pero tampoco hacía nada.
    // email es NOT NULL en profiles, así que siempre hay que mandarlo (si no, el upsert falla).
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({ id: c.id, email: c.email, is_active: newActive, is_admin: false })

    if (profErr) {
      setOpErr(
        `No se pudo ${newActive ? 'activar' : 'desactivar'} "${c.business_name || c.email}": ${profErr.message}`
        + (profErr.code === '42501' ? ' — Corré el SQL de permisos de profiles en Supabase.' : '')
      )
      setUpdatingId(null)
      return
    }

    // Sincronizamos clients.status para que el resto del panel quede consistente
    const newStatus: Client['status'] = newActive ? 'active' : 'inactive'
    await supabase
      .from('clients')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', c.id)

    await logActivity(
      newActive ? 'activate_client' : 'deactivate_client',
      c.id, 'client', { email: c.email }
    )

    setUpdatingId(null)
    load()
  }

  // ─── Suspender (bloqueo fuerte) ───────────────────────────────────────────
  async function suspend(c: ClientRow) {
    if (!confirm(`¿Suspender a ${c.business_name || c.email}?\nNo podrá entrar hasta que lo reactives.`)) return
    setUpdatingId(c.id)
    await Promise.all([
      supabase.from('profiles').upsert({ id: c.id, email: c.email, is_active: false, is_admin: false }),
      supabase.from('clients').update({ status: 'suspended', updated_at: new Date().toISOString() }).eq('id', c.id),
    ])
    await logActivity('suspend_client', c.id, 'client')
    setUpdatingId(null)
    load()
  }

  // ─── Crear cliente ────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.email || !form.password) { setFormErr('Email y contraseña son obligatorios.'); return }
    setSaving(true); setFormErr('')
    try {
      const { data: { session: adminSess } } = await supabase.auth.getSession()
      if (!adminSess) { setFormErr('Sesión expirada, volvé a entrar.'); return }

      const { data: newUser, error: signUpErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { name: form.business_name || form.email } },
      })
      if (signUpErr) { setFormErr(signUpErr.message); return }
      const uid = newUser.user?.id
      if (!uid) { setFormErr('No se pudo crear el usuario.'); return }

      // Restaurar sesión del admin (signUp puede haber cambiado la sesión)
      await supabase.auth.setSession({
        access_token: adminSess.access_token,
        refresh_token: adminSess.refresh_token,
      })

      const isActive = form.status === 'active' || form.status === 'trial'
      const [profRes, clientRes] = await Promise.all([
        supabase.from('profiles').upsert({ id: uid, email: form.email.trim(), is_active: isActive, is_admin: false, must_change_password: true }),
        supabase.from('clients').insert({
          id: uid, email: form.email.trim(),
          business_name: form.business_name || null,
          whatsapp: form.whatsapp || null,
          plan_id: form.plan_id || null,
          status: form.status,
          paid_until: form.paid_until || null,
          trial_ends_at: form.trial_ends_at || null,
          notes: form.notes || null,
        }),
      ])

      if (profRes.error)   { setFormErr('Error al crear perfil: ' + profRes.error.message); return }
      if (clientRes.error) { setFormErr('Error al guardar datos: ' + clientRes.error.message); return }

      await logActivity('create_client', uid, 'client', { email: form.email })
      setShowCreate(false)
      setCreatedInfo({ name: form.business_name || form.email, password: form.password })
      load()
    } finally { setSaving(false) }
  }

  // ─── Editar cliente ───────────────────────────────────────────────────────
  async function handleEdit() {
    if (!editClient) return
    setSaving(true); setFormErr('')
    const isActive = form.status === 'active' || form.status === 'trial'
    const [profRes, clientRes] = await Promise.all([
      supabase.from('profiles').upsert({ id: editClient.id, email: editClient.email, is_active: isActive, is_admin: false }),
      supabase.from('clients').update({
        business_name: form.business_name || null,
        whatsapp: form.whatsapp || null,
        plan_id: form.plan_id || null,
        status: form.status,
        paid_until: form.paid_until || null,
        trial_ends_at: form.trial_ends_at || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editClient.id),
    ])
    if (profRes.error)   setFormErr('Error al actualizar acceso: ' + profRes.error.message)
    if (clientRes.error) setFormErr('Error al guardar datos: ' + clientRes.error.message)
    if (!profRes.error && !clientRes.error) {
      await logActivity('edit_client', editClient.id, 'client', { status: form.status })
      setEditClient(null)
    }
    load()
    setSaving(false)
  }

  async function resetPassword(c: ClientRow) {
    const { error } = await supabase.auth.resetPasswordForEmail(c.email)
    if (error) setOpErr('Error enviando email: ' + error.message)
    else setMsg(`✓ Email de recuperación enviado a ${c.email}`)
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM }); setFormErr(''); setMsg(''); setShowPass(false)
    setShowCreate(true)
  }

  function copyPass() {
    if (!createdInfo) return
    navigator.clipboard?.writeText(createdInfo.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function openEdit(c: ClientRow) {
    setForm({
      email: c.email, password: '',
      business_name: c.business_name || '', whatsapp: c.whatsapp || '',
      plan_id: c.plan_id || '', status: c.status,
      paid_until: c.paid_until ? c.paid_until.slice(0, 10) : '',
      trial_ends_at: c.trial_ends_at ? c.trial_ends_at.slice(0, 10) : '',
      notes: c.notes || '',
    })
    setFormErr(''); setMsg('')
    setEditClient(c)
  }

  // ─── Acceso al panel del cliente con permiso (modo soporte) ────────────────
  function askAccess(c: ClientRow) {
    setAccessReason('')
    setAccessMinutes(30)
    setAccessModal(c)
  }

  function confirmAccess() {
    if (!accessModal) return
    const mins = Math.max(1, Math.min(240, Math.round(accessMinutes) || 30))
    access.requestAccess(accessModal.id, accessReason.trim() || undefined, mins)
    logActivity('request_support_access', accessModal.id, 'client', { email: accessModal.email, minutes: mins })
    setAccessModal(null)
  }

  function renderAccessBtn(c: ClientRow) {
    const req = access.byClient[c.id]

    // Ya aceptado y vigente → puede entrar (reutiliza el mecanismo de impersonation).
    if (isActiveNow(req)) {
      return (
        <button className="abtn primary" title="Entrar al panel del cliente"
          onClick={() => { onImpersonate(c); logActivity('enter_support_access', c.id, 'client') }}
          style={{ background: 'var(--mint)', borderColor: 'var(--mint)', boxShadow: 'none' }}>
          Entrar al panel
        </button>
      )
    }

    // Esperando que el cliente confirme.
    if (req?.status === 'pending') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className="pulse-dot" style={{ background: 'var(--amber)' }} />
            Esperando confirmación…
          </span>
          <button className="abtn" title="Cancelar solicitud" onClick={() => access.endAccess(req.id)}>Cancelar</button>
        </span>
      )
    }

    // Rechazado / cortado / expirado / sin pedido → pedir (de nuevo).
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {req?.status === 'denied' && (
          <span style={{ fontSize: 12, color: 'var(--rose)', fontWeight: 600, whiteSpace: 'nowrap' }}>Rechazó</span>
        )}
        <button className="abtn" title="Pedir permiso para entrar al panel" onClick={() => askAccess(c)}>
          {req && req.status !== 'denied' ? 'Solicitar de nuevo' : 'Solicitar acceso'}
        </button>
      </span>
    )
  }

  // ─── Modal de crear/editar ────────────────────────────────────────────────
  const modalForm = (isEdit: boolean) => (
    <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) isEdit ? setEditClient(null) : setShowCreate(false) }}>
      <div className="modal-box">
        <h2>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>

        {formErr && (
          <div style={{ background: 'var(--rose-wash)', color: 'var(--rose)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
            {formErr}
          </div>
        )}

        {!isEdit && (
          <>
            <div className="field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
            </div>
            <div className="field">
              <label>Contraseña temporal *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="mín. 6 caracteres" minLength={6}
                    style={{ width: '100%', paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)} title={showPass ? 'Ocultar' : 'Mostrar'}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4, display: 'flex', lineHeight: 0 }}>
                    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
                <button type="button" className="abtn" onClick={() => { setForm(f => ({ ...f, password: genPassword() })); setShowPass(true) }}>
                  Generar automática
                </button>
              </div>
              <div className="hint" style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
                El cliente la cambia obligatoriamente al entrar por primera vez. La "automática" usa letras y números fáciles de leer.
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label>Nombre del negocio</label>
          <input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="Ej: Veterinaria Centro" />
        </div>
        <div className="field">
          <label>WhatsApp</label>
          <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+54 9 11 1234-5678" />
        </div>
        <div className="field">
          <label>Plan</label>
          <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value }))}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}>
            <option value="">Sin plan</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_ars.toLocaleString('es-AR')}/mes</option>)}
          </select>
        </div>
        <div className="field">
          <label>Estado / Acceso</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}>
            <option value="inactive">Inactivo — sin acceso (esperando pago)</option>
            <option value="active">Activo — puede entrar</option>
            <option value="trial">Prueba — puede entrar</option>
            <option value="suspended">Suspendido — bloqueado</option>
          </select>
          <div className="hint" style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
            Inactivo = no puede entrar. Lo activás cuando confirmás el pago.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Pago hasta</label>
            <input type="date" value={form.paid_until} onChange={e => setForm(f => ({ ...f, paid_until: e.target.value }))} />
          </div>
          <div className="field">
            <label>Prueba hasta</label>
            <input type="date" value={form.trial_ends_at} onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
          </div>
        </div>
        <div className="field">
          <label>Notas internas</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3} placeholder="Solo las ve el admin" style={{ resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="abtn" onClick={() => isEdit ? setEditClient(null) : setShowCreate(false)}>Cancelar</button>
          <button className="abtn primary" onClick={isEdit ? handleEdit : handleCreate} disabled={saving}>
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="adm-page-head">
        <div><h1>Clientes</h1><p>{clients.length} en total · {clients.filter(c => c.is_active).length} con acceso activo</p></div>
        <button className="abtn primary" onClick={openCreate}>+ Nuevo cliente</button>
      </div>

      {msg && (
        <div style={{ background: 'var(--mint-wash)', color: '#018a66', padding: '11px 16px', borderRadius: 10, fontSize: 13.5, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#018a66', fontSize: 16, padding: '0 4px' }}>✕</button>
        </div>
      )}
      {opErr && (
        <div style={{ background: 'var(--rose-wash)', color: 'var(--rose)', padding: '11px 16px', borderRadius: 10, fontSize: 13.5, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{opErr}</span>
          <button onClick={() => setOpErr('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontSize: 16, padding: '0 4px' }}>✕</button>
        </div>
      )}

      {/* KPI: costo total de API del mes (todos los clientes juntos). */}
      <div className="adm-sect" style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
            Consumo de API · {monthLabel}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
            {fmtUsd(totalUsage.cost_usd)}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {fmtTokens(totalUsage.tokens_in)} tokens in · {fmtTokens(totalUsage.tokens_out)} tokens out
          <span style={{ color: 'var(--ink-faint)' }}> · {clients.length} cliente{clients.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="adm-toolbar">
        <input className="adm-search" placeholder="Buscar por nombre o email…" value={search} onChange={e => setSearch(e.target.value)} />
        {(['all', 'active', 'trial', 'inactive', 'suspended'] as const).map(f => (
          <button key={f} className={`adm-filter-btn${filter === f ? ' sel' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Todos' : statusLabel(f)}
          </button>
        ))}
      </div>

      {loading ? <div className="adm-empty">Cargando…</div> : (
        <div className="adm-sect" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Negocio / Email</th>
                  <th>Plan</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Consumo del mes</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Acceso al dashboard</th>
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>Más</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} className="adm-empty">Sin resultados.</td></tr>
                )}
                {visible.map(c => {
                  const isUpdating = updatingId === c.id
                  return (
                    <tr key={c.id}>
                      <td data-label="Negocio / Email">
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.business_name || '—'}</div>
                        <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{c.email}</div>
                      </td>
                      <td data-label="Plan" style={{ fontSize: 13 }}>
                        {c.plan?.name || <span style={{ color: 'var(--ink-faint)' }}>Sin plan</span>}
                      </td>

                      {/* ── Consumo del mes: costo en USD + desglose de tokens ── */}
                      <td data-label="Consumo del mes" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                        {(() => {
                          const u = usage[c.id] || { tokens_in: 0, tokens_out: 0, cost_usd: 0 }
                          const sinConsumo = u.tokens_in === 0 && u.tokens_out === 0
                          return (
                            <>
                              <div style={{ fontWeight: 600, color: sinConsumo ? 'var(--ink-faint)' : undefined }}>
                                {fmtUsd(u.cost_usd)}
                              </div>
                              <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
                                {fmtTokens(u.tokens_in)} in · {fmtTokens(u.tokens_out)} out
                              </div>
                            </>
                          )
                        })()}
                      </td>

                      {/* ── Columna de acceso: el toggle principal ── */}
                      <td data-label="Acceso al dashboard">
                        <button
                          onClick={() => toggleAccess(c)}
                          disabled={isUpdating}
                          title={c.is_active ? 'Clic para DESACTIVAR acceso' : 'Clic para ACTIVAR acceso'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '8px 16px', borderRadius: 24, border: 'none',
                            cursor: isUpdating ? 'wait' : 'pointer',
                            fontWeight: 700, fontSize: 13, transition: 'all .15s',
                            fontFamily: 'Space Grotesk, sans-serif',
                            background: isUpdating
                              ? 'var(--surf-2)'
                              : c.is_active
                                ? 'var(--mint-wash)'
                                : 'var(--surf-2)',
                            color: isUpdating
                              ? 'var(--ink-faint)'
                              : c.is_active
                                ? '#018a66'
                                : 'var(--ink-soft)',
                            boxShadow: c.is_active && !isUpdating ? '0 0 0 1.5px #00c89640' : 'none',
                          }}
                        >
                          <span style={{
                            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                            background: isUpdating
                              ? 'var(--ink-faint)'
                              : c.is_active ? 'var(--mint)' : 'var(--ink-faint)',
                            boxShadow: c.is_active && !isUpdating ? '0 0 0 3px #00c89625' : 'none',
                          }} />
                          {isUpdating ? 'Actualizando…' : c.is_active ? 'Activo' : 'En espera'}
                        </button>
                      </td>

                      <td data-label="Estado">
                        <span className={`sbadge ${c.status}`}>{statusLabel(c.status)}</span>
                      </td>
                      <td data-label="Vence" style={{
                        fontSize: 13,
                        color: isPastDue(c) ? 'var(--rose)' : undefined,
                        fontWeight: isPastDue(c) ? 700 : undefined,
                      }}>
                        {fmtDate(c.paid_until)}
                      </td>
                      <td data-label="Más">
                        <div className="adm-actions">
                          <button className="abtn" title="Editar datos" onClick={() => openEdit(c)}>
                            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="13" height="13">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          {c.status !== 'suspended' && (
                            <button className="abtn danger" title="Suspender" onClick={() => suspend(c)} disabled={isUpdating}>
                              Suspender
                            </button>
                          )}
                          <button className="abtn" title="Resetear contraseña" onClick={() => resetPassword(c)}>🔑</button>
                          {renderAccessBtn(c)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && modalForm(false)}
      {editClient && modalForm(true)}

      {accessModal && (
        <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) setAccessModal(null) }}>
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <h2>Solicitar acceso al panel</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '-8px 0 18px' }}>
              Le pedís permiso a <b>{accessModal.business_name || accessModal.email}</b> para entrar a su panel.
              Sólo entrás cuando lo acepta, y podés modificar como si fueras el cliente.
            </p>

            <div className="field">
              <label>¿Cuánto tiempo necesitás?</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {[15, 30, 60, 120].map(m => (
                  <button key={m} type="button"
                    className={`abtn${accessMinutes === m ? ' primary' : ''}`}
                    onClick={() => setAccessMinutes(m)}>
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={1} max={240} value={accessMinutes}
                  onChange={e => setAccessMinutes(Number(e.target.value))}
                  style={{ width: 90 }} />
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>minutos (máx. 240)</span>
              </div>
            </div>

            <div className="field">
              <label>Motivo (opcional, lo ve el cliente)</label>
              <textarea value={accessReason} onChange={e => setAccessReason(e.target.value)}
                rows={2} placeholder="Ej: Revisar un problema con el inventario" style={{ resize: 'vertical' }} />
            </div>

            <div className="modal-actions">
              <button className="abtn" onClick={() => setAccessModal(null)}>Cancelar</button>
              <button className="abtn primary" onClick={confirmAccess}>Enviar solicitud</button>
            </div>
          </div>
        </div>
      )}

      {createdInfo && (
        <div className="modal-ov" onClick={() => setCreatedInfo(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, textAlign: 'center' }}>
            <div className="confirm-ic" style={{ background: 'var(--mint-wash)', color: 'var(--mint)', margin: '0 auto 16px' }}>
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="28" height="28"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2>Cliente creado</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6, margin: '8px 0 18px' }}>
              Pasale esta contraseña a <b>{createdInfo.name}</b>. Cuando entre por primera vez, va a tener que cambiarla.
            </p>
            <div className="pass-box">
              <code>{createdInfo.password}</code>
              <button className="abtn primary" onClick={copyPass}>{copied ? '✓ Copiado' : 'Copiar'}</button>
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setCreatedInfo(null)}>Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function isPastDue(c: ClientRow) {
  return !!c.paid_until && new Date(c.paid_until) < new Date() && c.is_active
}

// Costo en USD con 2 a 4 decimales (el consumo mensual suele ser chico). 0 → "$0.00".
function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(n || 0)
}

// Tokens con separador de miles (es-AR: punto). 0 → "0".
function fmtTokens(n: number): string {
  return (n || 0).toLocaleString('es-AR')
}

// Contraseña aleatoria legible (sin caracteres confusos: l, 1, I, O, 0).
function genPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length]
  return out
}
