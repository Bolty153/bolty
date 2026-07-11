import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Plan, ActivityEntry, Announcement, Client } from './types'
import { fmtDate, logActivity } from './utils'

const EMPTY_PLAN = { name: '', price_ars: '', description: '' }
const EMPTY_ANN  = { title: '', body: '', expires_at: '' }

export default function AdminControl() {
  const [plans, setPlans]       = useState<Plan[]>([])
  const [log, setLog]           = useState<ActivityEntry[]>([])
  const [anns, setAnns]         = useState<Announcement[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)

  const [planForm, setPlanForm] = useState({ ...EMPTY_PLAN })
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [showPlanForm, setShowPlanForm] = useState(false)

  const [annForm, setAnnForm]   = useState({ ...EMPTY_ANN })
  const [showAnn, setShowAnn]   = useState(false)

  const [trialClient, setTrialClient] = useState('')
  const [trialDays, setTrialDays]     = useState('7')
  const [trialMsg, setTrialMsg]       = useState('')

  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: pl }, { data: lg }, { data: an }, { data: cl }] = await Promise.all([
      supabase.from('plans').select('*').order('price_ars'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*, plan:plans(id,name,price_ars)').order('created_at', { ascending: false }),
    ])
    setPlans(pl || [])
    setLog(lg || [])
    setAnns(an || [])
    setClients(cl || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function savePlan() {
    setSaving(true)
    const payload = { name: planForm.name, price_ars: parseFloat(planForm.price_ars) || 0, description: planForm.description || null }
    if (editPlan) {
      await supabase.from('plans').update(payload).eq('id', editPlan.id)
      await logActivity('edit_plan', editPlan.id, 'plan', { name: planForm.name })
    } else {
      await supabase.from('plans').insert(payload)
      await logActivity('create_plan', undefined, 'plan', { name: planForm.name })
    }
    setShowPlanForm(false); setEditPlan(null); setPlanForm({ ...EMPTY_PLAN })
    load(); setSaving(false)
  }

  async function deletePlan(p: Plan) {
    if (!confirm(`¿Borrar el plan "${p.name}"?`)) return
    await supabase.from('plans').delete().eq('id', p.id)
    await logActivity('delete_plan', p.id, 'plan', { name: p.name })
    load()
  }

  function openEditPlan(p: Plan) {
    setEditPlan(p)
    setPlanForm({ name: p.name, price_ars: String(p.price_ars), description: p.description || '' })
    setShowPlanForm(true)
  }

  async function sendAnnouncement() {
    if (!annForm.title || !annForm.body) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('announcements').insert({
      title: annForm.title, body: annForm.body,
      expires_at: annForm.expires_at || null,
      created_by: session?.user.id ?? null,
    })
    await logActivity('send_announcement', undefined, 'announcement', { title: annForm.title })
    setShowAnn(false); setAnnForm({ ...EMPTY_ANN })
    load(); setSaving(false)
  }

  async function deleteAnn(id: string) {
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  async function setTrialMode() {
    if (!trialClient || !trialDays) return
    setSaving(true)
    const ends = new Date()
    ends.setDate(ends.getDate() + parseInt(trialDays))
    await supabase.from('clients').update({
      status: 'trial', trial_ends_at: ends.toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', trialClient)
    await supabase.from('profiles').update({ is_active: true }).eq('id', trialClient)
    await logActivity('set_trial', trialClient, 'client', { days: parseInt(trialDays) })
    setTrialMsg(`✓ Modo prueba activado por ${trialDays} días.`)
    setTrialClient(''); setTrialDays('7'); load(); setSaving(false)
  }

  function exportCSV() {
    const header = 'Negocio,Email,Plan,Estado,Vence,WhatsApp,Creado'
    const rows = clients.map(c => [
      `"${c.business_name || ''}"`, c.email,
      `"${c.plan?.name || ''}"`,
      c.status, c.paid_until || '', c.whatsapp || '',
      new Date(c.created_at).toLocaleDateString('es-AR'),
    ].join(','))
    const csv = [header, ...rows].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `bolty-clientes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  async function exportFullCSV() {
    const { data: fullClients } = await supabase.from('clients').select('*, plan:plans(name)').order('created_at')
    if (!fullClients) return
    const header = 'Negocio,Email,Plan,Estado,Vence,WhatsApp,Creado,Notas'
    const rows = (fullClients as Client[]).map(c => [
      `"${c.business_name || ''}"`, c.email,
      `"${c.plan?.name || ''}"`, c.status,
      c.paid_until || '', c.whatsapp || '',
      new Date(c.created_at).toLocaleDateString('es-AR'),
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ].join(','))
    const csv = [header, ...rows].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `bolty-clientes-completo-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <div className="adm-empty">Cargando…</div>

  return (
    <>
      <div className="adm-page-head">
        <div><h1>Control</h1><p>Operaciones y configuración</p></div>
      </div>

      {/* Plans */}
      <div className="adm-sect">
        <div className="adm-sect-h">
          Planes
          <button className="abtn primary" onClick={() => { setPlanForm({ ...EMPTY_PLAN }); setEditPlan(null); setShowPlanForm(true) }}>+ Plan</button>
        </div>
        {plans.length === 0 ? <div className="adm-empty">Sin planes creados.</div> : (
          <table className="adm-table">
            <thead><tr><th>Nombre</th><th>Precio/mes</th><th>Descripción</th><th>Acciones</th></tr></thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id}>
                  <td data-label="Nombre" style={{ fontWeight: 600 }}>{p.name}</td>
                  <td data-label="Precio/mes">${p.price_ars.toLocaleString('es-AR')}</td>
                  <td data-label="Descripción" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.description || '—'}</td>
                  <td data-label="Acciones">
                    <div className="adm-actions">
                      <button className="abtn" onClick={() => openEditPlan(p)}>Editar</button>
                      <button className="abtn danger" onClick={() => deletePlan(p)}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Announcements */}
      <div className="adm-sect">
        <div className="adm-sect-h">
          Avisos a clientes
          <button className="abtn primary" onClick={() => setShowAnn(true)}>+ Nuevo aviso</button>
        </div>
        {anns.length === 0 ? <div className="adm-empty">Sin avisos enviados.</div> : (
          anns.map(a => (
            <div key={a.id} style={{ background: 'var(--surf-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.5 }}>{a.body}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>
                  {fmtDate(a.created_at)}{a.expires_at ? ` · Expira: ${fmtDate(a.expires_at)}` : ''}
                </div>
              </div>
              <button className="abtn danger" onClick={() => deleteAnn(a.id)} style={{ flexShrink: 0 }}>Borrar</button>
            </div>
          ))
        )}
      </div>

      {/* Trial mode */}
      <div className="adm-sect">
        <div className="adm-sect-h">Modo prueba gratis</div>
        <div className="adm-flex-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Cliente</label>
            <select value={trialClient} onChange={e => setTrialClient(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }}>
              <option value="">— Seleccioná un cliente —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name || c.email}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Días</label>
            <input type="number" min="1" max="90" value={trialDays} onChange={e => setTrialDays(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', border: '1px solid var(--line)', borderRadius: 'var(--rs)', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)' }} />
          </div>
          <button className="abtn primary" onClick={setTrialMode} disabled={saving || !trialClient}>Activar prueba</button>
        </div>
        {trialMsg && <div style={{ marginTop: 10, fontSize: 13, color: '#018a66' }}>{trialMsg}</div>}
      </div>

      {/* Export */}
      <div className="adm-sect">
        <div className="adm-sect-h">Exportar datos</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="abtn" onClick={exportCSV}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14" style={{ marginRight: 5 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar lista básica (CSV)
          </button>
          <button className="abtn" onClick={exportFullCSV}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14" style={{ marginRight: 5 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar lista completa con notas (CSV)
          </button>
        </div>
      </div>

      {/* Activity log */}
      <div className="adm-sect">
        <div className="adm-sect-h">Registro de actividad</div>
        {log.length === 0 ? <div className="adm-empty">Sin actividad registrada.</div> : (
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Acción</th><th>Tipo</th><th>Detalles</th></tr></thead>
            <tbody>
              {log.map(e => (
                <tr key={e.id}>
                  <td data-label="Fecha" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td data-label="Acción" style={{ fontWeight: 600, fontSize: 13 }}>{e.action}</td>
                  <td data-label="Tipo" style={{ fontSize: 12 }}><span className="sbadge inactive">{e.target_type || '—'}</span></td>
                  <td data-label="Detalles" style={{ fontSize: 11.5, color: 'var(--ink-soft)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.details ? JSON.stringify(e.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPlanForm && (
        <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) { setShowPlanForm(false); setEditPlan(null) } }}>
          <div className="modal-box">
            <h2>{editPlan ? 'Editar plan' : 'Nuevo plan'}</h2>
            <div className="field"><label>Nombre *</label><input value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Estándar" /></div>
            <div className="field"><label>Precio mensual ($) *</label><input type="number" value={planForm.price_ars} onChange={e => setPlanForm(f => ({ ...f, price_ars: e.target.value }))} placeholder="0" /></div>
            <div className="field"><label>Descripción</label><input value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} placeholder="Ej: Hasta 2000 mensajes/mes" /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="abtn" onClick={() => { setShowPlanForm(false); setEditPlan(null) }}>Cancelar</button>
              <button className="abtn primary" onClick={savePlan} disabled={saving || !planForm.name}>{saving ? 'Guardando…' : editPlan ? 'Guardar' : 'Crear plan'}</button>
            </div>
          </div>
        </div>
      )}

      {showAnn && (
        <div className="modal-ov" onClick={e => { if (e.target === e.currentTarget) setShowAnn(false) }}>
          <div className="modal-box">
            <h2>Nuevo aviso para clientes</h2>
            <div className="field"><label>Título *</label><input value={annForm.title} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Mantenimiento programado" /></div>
            <div className="field"><label>Mensaje *</label><textarea value={annForm.body} onChange={e => setAnnForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Texto del aviso…" style={{ resize: 'vertical' }} /></div>
            <div className="field"><label>Expira el (opcional)</label><input type="date" value={annForm.expires_at} onChange={e => setAnnForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="abtn" onClick={() => setShowAnn(false)}>Cancelar</button>
              <button className="abtn primary" onClick={sendAnnouncement} disabled={saving || !annForm.title || !annForm.body}>{saving ? 'Enviando…' : 'Publicar aviso'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
