import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Client, Plan } from './types'
import { statusLabel, fmtDate, logActivity } from './utils'

interface Props {
  onImpersonate: (client: Client) => void
}

const STATUS_COLORS: Record<string, string> = {
  active: 'active', inactive: 'inactive', trial: 'trial', suspended: 'suspended',
}

const EMPTY_FORM = {
  email: '', password: '', business_name: '', whatsapp: '',
  plan_id: '', status: 'trial' as Client['status'], paid_until: '', trial_ends_at: '', notes: '',
}

export default function AdminClientes({ onImpersonate }: Props) {
  const [clients, setClients]     = useState<Client[]>([])
  const [plans, setPlans]         = useState<Plan[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<'all' | Client['status']>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [err, setErr]             = useState('')

  async function load() {
    const [{ data: cl }, { data: pl }] = await Promise.all([
      supabase.from('clients').select('*, plan:plans(id,name,price_ars,description)').order('created_at', { ascending: false }),
      supabase.from('plans').select('*').order('price_ars'),
    ])
    setClients(cl || [])
    setPlans(pl || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const visible = clients.filter(c => {
    const matchSearch = !search ||
      (c.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setErr('')
    setMsg('')
    setShowCreate(true)
  }

  function openEdit(c: Client) {
    setForm({
      email: c.email, password: '',
      business_name: c.business_name || '', whatsapp: c.whatsapp || '',
      plan_id: c.plan_id || '', status: c.status,
      paid_until: c.paid_until ? c.paid_until.slice(0, 10) : '',
      trial_ends_at: c.trial_ends_at ? c.trial_ends_at.slice(0, 10) : '',
      notes: c.notes || '',
    })
    setErr('')
    setMsg('')
    setEditClient(c)
  }

  async function handleCreate() {
    if (!form.email || !form.password) { setErr('Email y contraseña son obligatorios.'); return }
    setSaving(true); setErr('')
    try {
      const { data: { session: adminSess } } = await supabase.auth.getSession()
      if (!adminSess) { setErr('Sesión expirada, volvé a entrar.'); return }

      const { data: newUser, error: signUpErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { name: form.business_name || form.email } },
      })
      if (signUpErr) { setErr(signUpErr.message); return }
      const uid = newUser.user?.id
      if (!uid) { setErr('No se pudo crear el usuario.'); return }

      await supabase.auth.setSession({ access_token: adminSess.access_token, refresh_token: adminSess.refresh_token })

      const isActive = form.status === 'active' || form.status === 'trial'
      await Promise.all([
        supabase.from('profiles').upsert({ id: uid, is_active: isActive, is_admin: false }),
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
      await logActivity('create_client', uid, 'client', { email: form.email })
      setShowCreate(false)
      setMsg('Cliente creado.')
      load()
    } finally { setSaving(false) }
  }

  async function handleEdit() {
    if (!editClient) return
    setSaving(true); setErr('')
    const isActive = form.status === 'active' || form.status === 'trial'
    await Promise.all([
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
      supabase.from('profiles').update({ is_active: isActive }).eq('id', editClient.id),
    ])
    await logActivity('edit_client', editClient.id, 'client', { status: form.status })
    setEditClient(null)
    load()
    setSaving(false)
  }

  async function setStatus(c: Client, status: Client['status']) {
    const isActive = status === 'active' || status === 'trial'
    await Promise.all([
      supabase.from('clients').update({ status, updated_at: new Date().toISOString() }).eq('id', c.id),
      supabase.from('profiles').update({ is_active: isActive }).eq('id', c.id),
    ])
    await logActivity('set_status_' + status, c.id, 'client')
    load()
  }

  async function resetPassword(c: Client) {
    const { error } = await supabase.auth.resetPasswordForEmail(c.email)
    if (error) alert('Error: ' + error.message)
    else alert(`Mail de recuperación enviado a ${c.email}`)
  }

  const modalForm = (isEdit: boolean) => (
    <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) isEdit ? setEditClient(null) : setShowCreate(false) }}>
      <div className="modal-box">
        <h2>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>

        {err && <div style={{ background: 'var(--rose-wash)', color: 'var(--rose)', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{err}</div>}

        {!isEdit && (
          <>
            <div className="field">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
            </div>
            <div className="field">
              <label>Contraseña inicial *</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="mín. 6 caracteres" minLength={6} />
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
          <label>Estado</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}>
            <option value="trial">Prueba</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
            <option value="suspended">Suspendido</option>
          </select>
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

  return (
    <>
      <div className="adm-page-head">
        <div><h1>Clientes</h1><p>{clients.length} en total</p></div>
        <button className="abtn primary" onClick={openCreate}>+ Nuevo cliente</button>
      </div>

      {msg && <div style={{ background: 'var(--mint-wash)', color: '#018a66', padding: '10px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{msg}</div>}

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
                  <th>Estado</th>
                  <th>Vence</th>
                  <th>WhatsApp</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={6} className="adm-empty">Sin resultados.</td></tr>
                )}
                {visible.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.business_name || '—'}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{c.email}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{c.plan?.name || <span style={{ color: 'var(--ink-faint)' }}>Sin plan</span>}</td>
                    <td><span className={`sbadge ${STATUS_COLORS[c.status]}`}>{statusLabel(c.status)}</span></td>
                    <td style={{ fontSize: 13, color: isPastDue(c) ? 'var(--rose)' : undefined, fontWeight: isPastDue(c) ? 700 : undefined }}>
                      {fmtDate(c.paid_until)}
                    </td>
                    <td style={{ fontSize: 13 }}>{c.whatsapp || '—'}</td>
                    <td>
                      <div className="adm-actions">
                        <button className="abtn" title="Editar" onClick={() => openEdit(c)}>
                          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {c.status !== 'active' && <button className="abtn" title="Activar" onClick={() => setStatus(c, 'active')} style={{ color: '#018a66' }}>✓ Activar</button>}
                        {c.status === 'active' && <button className="abtn danger" title="Desactivar" onClick={() => setStatus(c, 'inactive')}>Desactivar</button>}
                        {c.status !== 'suspended' && <button className="abtn danger" title="Suspender" onClick={() => { if (confirm(`¿Suspender a ${c.business_name || c.email}?`)) setStatus(c, 'suspended') }}>Suspender</button>}
                        <button className="abtn" title="Reset contraseña" onClick={() => resetPassword(c)}>🔑</button>
                        <button className="abtn" title="Ver como cliente" onClick={() => onImpersonate(c)}>👁</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && modalForm(false)}
      {editClient && modalForm(true)}
    </>
  )
}

function isPastDue(c: Client) {
  return !!c.paid_until && new Date(c.paid_until) < new Date() && c.status === 'active'
}
