'use client'
import { useEffect, useState, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import {
  SESSION_DATA, TOTAL_SESSIONS, getInitials, formatDate, formatTime, formatWeekday, parseDate, safeStorageName,
} from '../../lib/supabase'
import { LOGO_B64 } from '../../lib/logo'

const CARD = { background: '#112d54', border: '1px solid rgba(201,147,42,.25)' }
const INP = { background: '#071526', border: '1px solid rgba(201,147,42,.25)' }
const inp = 'w-full text-sm px-3 py-2 rounded-lg text-white outline-none placeholder-slate-600'
const btnPrimary = 'text-xs px-4 py-2 rounded-lg font-medium'
const btnGhost = 'text-xs px-3 py-2 rounded-lg text-slate-400 hover:text-white transition'
const TABS = ['Sessões', 'Reuniões', 'Metas', 'Arquivos', 'Perfil']
const MAX_UPLOAD_MB = 50

const MEETING_STATUS = [['scheduled', 'Agendada'], ['next', 'Próxima'], ['completed', 'Concluída'], ['cancelled', 'Cancelada']]
const ITEM_STATUS = [['pending', 'Aguardando'], ['current', 'Em andamento'], ['completed', 'Concluída']]

// timestamptz do banco -> valor do <input type="datetime-local"> no fuso do navegador
function toLocalInput(iso) {
  const d = parseDate(iso)
  if (!d) return ''
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
// valor do datetime-local (sem fuso) -> ISO em UTC, respeitando o fuso de quem cadastra
function fromLocalInput(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
function fmtBytes(b) {
  b = Number(b) || 0
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
function labelOf(list, value) {
  const f = list.find(x => x[0] === value)
  return f ? f[1] : value
}

export default function AdminPage() {
  const supabase = createClientComponentClient()
  const router   = useRouter()

  const [me,       setMe]       = useState(null)
  const [mentees,  setMentees]  = useState([])
  const [selected, setSelected] = useState(null)
  const [sessions, setSessions] = useState([])
  const [meetings, setMeetings] = useState([])
  const [goals,    setGoals]    = useState([])
  const [files,    setFiles]    = useState([])
  const [tab,      setTab]      = useState('Sessões')
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState(false)
  const [toast,    setToast]    = useState(null)
  const [uploading, setUploading] = useState(false)
  const [newMentee, setNewMentee] = useState(false)
  const fileRef = useRef()

  function notify(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(t => (t && t.text === text ? null : t)), 3500)
  }
  function fail(err, text) {
    console.error(err)
    notify('error', text + (err && err.message ? ' — ' + err.message : ''))
  }

  /* ── Verificar se é admin ── */
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      const { data: prof } = await supabase.from('profiles').select('id, role, full_name').eq('id', user.id).maybeSingle()
      if (!prof || prof.role !== 'admin') return router.replace('/portal')
      setMe(prof)
      await loadMentees()
      setLoading(false)
    }
    init()
  }, [])

  async function loadMentees() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, sessions(status)')
      .eq('role', 'mentee')
      .order('full_name')
    if (error) return fail(error, 'Não foi possível carregar os mentorados')
    setMentees(data || [])
  }
  const completedFor = (m) => (m.sessions || []).filter(s => s.status === 'completed').length

  async function reload(kind, id) {
    const menteeId = id || (selected && selected.id)
    if (!menteeId) return
    if (kind === 'sessions') {
      const { data } = await supabase.from('sessions').select('*').eq('mentee_id', menteeId).order('session_number')
      setSessions(data || [])
    } else if (kind === 'meetings') {
      const { data } = await supabase.from('meetings').select('*').eq('mentee_id', menteeId).order('scheduled_at')
      setMeetings(data || [])
    } else if (kind === 'goals') {
      const { data } = await supabase.from('goals').select('*').eq('mentee_id', menteeId).order('sort_order')
      setGoals(data || [])
    } else if (kind === 'files') {
      const { data } = await supabase.from('files').select('*').eq('mentee_id', menteeId).order('created_at', { ascending: false })
      setFiles(data || [])
    }
  }

  async function selectMentee(m) {
    setSelected(m)
    setTab('Sessões')
    await Promise.all([reload('sessions', m.id), reload('meetings', m.id), reload('goals', m.id), reload('files', m.id)])
  }

  /* ── Perfil ── */
  async function saveProfile(form) {
    if (!form.full_name.trim()) return notify('error', 'O nome é obrigatório')
    setBusy(true)
    const payload = {
      full_name: form.full_name.trim(),
      specialty: form.specialty || null,
      city: form.city || null,
      whatsapp: form.whatsapp || null,
      start_date: form.start_date || null,
      investment: form.investment === '' ? null : Number(form.investment),
      photo_url: form.photo_url || null,
      drive_folder_url: form.drive_folder_url || null,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', selected.id)
    setBusy(false)
    if (error) return fail(error, 'Não foi possível salvar o perfil')
    const updated = { ...selected, ...payload }
    setSelected(updated)
    setMentees(ms => ms.map(x => (x.id === updated.id ? { ...x, ...payload } : x)))
    notify('ok', 'Perfil salvo')
  }

  /* ── Sessões ── */
  async function upsertSession(sessionNumber, patch) {
    setBusy(true)
    const existing = sessions.find(s => s.session_number === sessionNumber)
    let error
    if (existing) {
      ;({ error } = await supabase.from('sessions').update(patch).eq('id', existing.id))
    } else {
      const sd = SESSION_DATA.find(s => s.number === sessionNumber)
      ;({ error } = await supabase.from('sessions').insert({
        mentee_id: selected.id, session_number: sessionNumber,
        title: sd.title, description: sd.desc, status: 'pending', ...patch,
      }))
    }
    setBusy(false)
    if (error) return fail(error, 'Não foi possível salvar a sessão')
    await reload('sessions')
    await loadMentees()
    notify('ok', 'Sessão ' + sessionNumber + ' salva')
  }

  /* ── Reuniões ── */
  async function saveMeeting(form, id) {
    if (!form.title.trim()) return notify('error', 'Informe o título da reunião')
    const scheduledAt = fromLocalInput(form.scheduled_at)
    if (!scheduledAt) return notify('error', 'Informe data e hora válidas')
    setBusy(true)
    const payload = {
      title: form.title.trim(),
      scheduled_at: scheduledAt,
      meet_link: form.meet_link || null,
      session_id: form.session_id || null,
      status: form.status || 'scheduled',
    }
    const { error } = id
      ? await supabase.from('meetings').update(payload).eq('id', id)
      : await supabase.from('meetings').insert({ ...payload, mentee_id: selected.id })
    setBusy(false)
    if (error) return fail(error, 'Não foi possível salvar a reunião')
    await reload('meetings')
    notify('ok', id ? 'Reunião atualizada' : 'Reunião criada')
    return true
  }
  async function deleteMeeting(m) {
    if (!window.confirm(`Excluir a reunião "${m.title}"?`)) return
    const { error } = await supabase.from('meetings').delete().eq('id', m.id)
    if (error) return fail(error, 'Não foi possível excluir')
    await reload('meetings')
    notify('ok', 'Reunião excluída')
  }

  /* ── Metas ── */
  async function saveGoal(form, id) {
    if (!form.title.trim()) return notify('error', 'Informe o título da meta')
    setBusy(true)
    const payload = { period: form.period || null, title: form.title.trim(), detail: form.detail || null, status: form.status || 'pending' }
    const { error } = id
      ? await supabase.from('goals').update(payload).eq('id', id)
      : await supabase.from('goals').insert({ ...payload, mentee_id: selected.id, sort_order: goals.length + 1 })
    setBusy(false)
    if (error) return fail(error, 'Não foi possível salvar a meta')
    await reload('goals')
    notify('ok', id ? 'Meta atualizada' : 'Meta criada')
    return true
  }
  async function deleteGoal(g) {
    if (!window.confirm(`Excluir a meta "${g.title}"?`)) return
    const { error } = await supabase.from('goals').delete().eq('id', g.id)
    if (error) return fail(error, 'Não foi possível excluir')
    await reload('goals')
    notify('ok', 'Meta excluída')
  }
  async function moveGoal(g, dir) {
    const idx = goals.findIndex(x => x.id === g.id)
    const other = goals[idx + dir]
    if (!other) return
    await Promise.all([
      supabase.from('goals').update({ sort_order: other.sort_order }).eq('id', g.id),
      supabase.from('goals').update({ sort_order: g.sort_order }).eq('id', other.id),
    ])
    await reload('goals')
  }

  /* ── Arquivos ── */
  async function uploadFile(file) {
    if (!file || !selected || !me) return
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return notify('error', `Arquivo acima de ${MAX_UPLOAD_MB} MB`)
    setUploading(true)
    const path = selected.id + '/' + Date.now() + '-' + safeStorageName(file.name)
    const { error } = await supabase.storage.from('mentee-files').upload(path, file, { contentType: file.type || undefined })
    if (error) { setUploading(false); return fail(error, 'Falha no upload') }
    const { error: e2 } = await supabase.from('files').insert({
      mentee_id: selected.id, name: file.name, size: file.size, type: file.type, storage_path: path, uploaded_by: me.id,
    })
    setUploading(false)
    if (e2) return fail(e2, 'Arquivo subiu mas não foi registrado')
    await reload('files')
    notify('ok', `"${file.name}" enviado para ${selected.full_name}`)
  }
  async function downloadFile(f) {
    const { data, error } = await supabase.storage.from('mentee-files').createSignedUrl(f.storage_path, 300, { download: f.name })
    if (error || !data || !data.signedUrl) return fail(error, 'Não foi possível baixar')
    window.location.href = data.signedUrl
  }
  async function deleteFile(f) {
    if (!window.confirm(`Excluir o arquivo "${f.name}"?`)) return
    const { error } = await supabase.storage.from('mentee-files').remove([f.storage_path])
    if (error) return fail(error, 'Não foi possível excluir do armazenamento')
    const { error: e2 } = await supabase.from('files').delete().eq('id', f.id)
    if (e2) return fail(e2, 'Não foi possível excluir o registro')
    await reload('files')
    notify('ok', 'Arquivo excluído')
  }

  /* ── Novo mentorado (função segura no banco, só admin) ── */
  async function createMentee(form) {
    const { data, error } = await supabase.rpc('admin_create_mentee', {
      p_email: form.email.trim(),
      p_password: form.password,
      p_full_name: form.full_name.trim(),
      p_specialty: form.specialty || null,
      p_city: form.city || null,
      p_whatsapp: form.whatsapp || null,
      p_start_date: form.start_date || null,
      p_investment: form.investment === '' ? 7000 : Number(form.investment),
      p_drive_folder_url: form.drive_folder_url || null,
    })
    if (error) return { error: error.message.replace(/^.*?exception:?\s*/i, '') }
    await loadMentees()
    const { data: prof } = await supabase.from('profiles').select('*, sessions(status)').eq('id', data).maybeSingle()
    if (prof) selectMentee(prof)
    notify('ok', `${form.full_name.trim()} cadastrado(a)`)
    return { id: data }
  }

  async function resetMenteePassword(password) {
    const { error } = await supabase.rpc('admin_set_password', { p_user_id: selected.id, p_password: password })
    if (error) return fail(error, 'Não foi possível redefinir a senha')
    notify('ok', 'Senha redefinida para ' + selected.full_name)
    return true
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a1e38' }}>
      <p className="text-slate-500 animate-pulse text-sm">Carregando painel...</p>
    </div>
  )

  const doneCount = sessions.filter(s => s.status === 'completed').length

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: '#0a1e38' }}>
      {/* ─ SIDEBAR MENTORADOS ─ */}
      <aside className="w-full md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-[#1c3560] flex flex-col md:h-screen md:sticky md:top-0">
        <div className="p-5 border-b border-[#1c3560] flex items-center justify-between">
          <div>
            <img src={LOGO_B64} alt="Filipe Abdalla" style={{ height: 30, filter: 'brightness(0) invert(1)', marginBottom: 6 }} />
            <p className="text-sm font-semibold text-white">Painel Admin</p>
            <p className="text-xs text-slate-500">{me ? me.full_name : 'Gestão de Mentorados'}</p>
          </div>
          <button onClick={handleLogout} className="md:hidden text-xs text-slate-500 hover:text-white">Sair</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 max-h-72 md:max-h-none">
          <button onClick={() => setNewMentee(true)}
            className="w-full py-2 rounded-xl text-sm font-medium transition mb-2"
            style={{ background: 'rgba(201,147,42,.15)', color: '#c9932a', border: '1px dashed rgba(201,147,42,.4)' }}>
            + Novo mentorado
          </button>
          <p className="text-xs text-slate-600 px-2 py-1 font-medium">Mentorados ativos ({mentees.length})</p>
          {mentees.map(m => (
            <button key={m.id} onClick={() => selectMentee(m)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${selected && selected.id === m.id ? 'bg-[rgba(201,147,42,.12)] border border-[rgba(201,147,42,.4)]' : 'hover:bg-[#112d54]'}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 text-[#e8b04a]"
                   style={{ background: 'rgba(201,147,42,.1)', border: '1px solid rgba(201,147,42,.2)' }}>
                {getInitials(m.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{m.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{completedFor(m)}/{TOTAL_SESSIONS} sessões · {m.city || m.email}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="hidden md:block p-3 border-t border-[#1c3560]">
          <button onClick={handleLogout} className="w-full text-xs text-slate-500 hover:text-white py-2 transition">Sair</button>
        </div>
      </aside>

      {/* ─ CONTEÚDO PRINCIPAL ─ */}
      <main className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(201,147,42,.1)', border: '1px solid rgba(201,147,42,.2)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9932a" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <p className="text-white font-medium">Selecione um mentorado</p>
            <p className="text-sm text-slate-500 mt-1">Escolha na lista para editar sessões, reuniões, metas, arquivos e perfil</p>
            <div className="grid grid-cols-3 gap-4 mt-10 w-full max-w-lg">
              {(() => {
                const totalSess = mentees.reduce((a, m) => a + completedFor(m), 0)
                const taxaMedia = mentees.length ? Math.round(mentees.reduce((a, m) => a + (completedFor(m) / TOTAL_SESSIONS) * 100, 0) / mentees.length) : 0
                return [
                  { label: 'Mentorados ativos', value: mentees.length },
                  { label: 'Sessões concluídas', value: totalSess },
                  { label: 'Progresso médio', value: taxaMedia + '%' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl p-4 text-center" style={CARD}>
                    <p className="text-2xl font-semibold text-white">{c.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{c.label}</p>
                  </div>
                ))
              })()}
            </div>
            <button onClick={() => setNewMentee(true)} className="mt-10 text-sm px-5 py-2.5 rounded-xl font-medium" style={{ background: '#c9932a', color: '#0a1e38' }}>
              + Cadastrar novo mentorado
            </button>
          </div>
        ) : (
          <>
            {/* Header do mentorado */}
            <div className="flex flex-wrap items-center gap-4 p-5 border-b border-[#1c3560]">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-[#e8b04a] flex-shrink-0"
                   style={{ background: 'rgba(201,147,42,.1)', border: '1px solid rgba(201,147,42,.2)' }}>
                {getInitials(selected.full_name)}
              </div>
              <div className="flex-1 min-w-[200px]">
                <h2 className="text-base font-semibold text-white">{selected.full_name}</h2>
                <p className="text-xs text-slate-500">
                  {selected.email}{selected.start_date ? ' · Início: ' + formatDate(selected.start_date) : ''}
                  {selected.drive_folder_url && <> · <a href={selected.drive_folder_url} target="_blank" rel="noreferrer" style={{ color: '#e8b04a' }}>Pasta do Drive ↗</a></>}
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={CARD}>
                <div className="w-16 h-1 rounded-full bg-[rgba(255,255,255,.1)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#c9932a]" style={{ width: `${(doneCount / TOTAL_SESSIONS) * 100}%` }}/>
                </div>
                <span className="text-slate-400">{doneCount}/{TOTAL_SESSIONS}</span>
              </div>
              {busy && <span className="text-xs text-slate-500 animate-pulse">Salvando...</span>}
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-[#1c3560] px-5 overflow-x-auto">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`py-3 px-4 text-sm transition border-b-2 whitespace-nowrap ${tab === t ? 'text-[#e8b04a] border-[#c9932a]' : 'text-slate-500 border-transparent hover:text-white'}`}>
                  {t}{t === 'Arquivos' && files.length > 0 ? ` (${files.length})` : ''}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">

              {/* ── SESSÕES ── */}
              {tab === 'Sessões' && SESSION_DATA.map(sd => (
                <SessionCard key={sd.number} sd={sd} sess={sessions.find(s => s.session_number === sd.number)} onSave={upsertSession} />
              ))}

              {/* ── REUNIÕES ── */}
              {tab === 'Reuniões' && (
                <MeetingsTab meetings={meetings} sessions={sessions} onSave={saveMeeting} onDelete={deleteMeeting} />
              )}

              {/* ── METAS ── */}
              {tab === 'Metas' && (
                <GoalsTab goals={goals} onSave={saveGoal} onDelete={deleteGoal} onMove={moveGoal} />
              )}

              {/* ── ARQUIVOS ── */}
              {tab === 'Arquivos' && (
                <>
                  <div onClick={() => !uploading && fileRef.current && fileRef.current.click()}
                    className="rounded-xl p-6 text-center cursor-pointer"
                    style={{ border: '1px dashed rgba(201,147,42,.4)', background: 'rgba(201,147,42,.05)' }}>
                    <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; uploadFile(f) }} />
                    <p className="text-sm font-medium" style={{ color: '#c9932a' }}>{uploading ? 'Enviando...' : `+ Enviar arquivo para ${selected.full_name.split(' ')[0]}`}</p>
                    <p className="text-xs text-slate-500 mt-1">O mentorado vê o arquivo na aba Arquivos do portal · até {MAX_UPLOAD_MB} MB</p>
                  </div>
                  {files.length === 0 ? (
                    <p className="text-sm text-slate-600 text-center py-8">Nenhum arquivo ainda.</p>
                  ) : files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl" style={CARD}>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-[rgba(201,147,42,.15)] text-[#e8b04a] flex-shrink-0">
                        {((f.name || '').includes('.') ? f.name.split('.').pop() : 'ARQ').toUpperCase().slice(0, 5)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{f.name}</p>
                        <p className="text-xs text-slate-500">{fmtBytes(f.size)} · {formatDate(f.created_at)} · {f.uploaded_by === selected.id ? 'enviado pelo mentorado' : 'enviado por você'}</p>
                      </div>
                      <button onClick={() => downloadFile(f)} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)' }}>Baixar</button>
                      <button onClick={() => deleteFile(f)} className="text-xs px-3 py-2 rounded-lg text-red-400 hover:text-red-300" style={{ border: '1px solid rgba(239,68,68,.3)' }}>Excluir</button>
                    </div>
                  ))}
                </>
              )}

              {/* ── PERFIL ── */}
              {tab === 'Perfil' && (
                <>
                  <ProfileForm key={selected.id} profile={selected} busy={busy} onSave={saveProfile} />
                  <PasswordReset key={'pw-' + selected.id} onReset={resetMenteePassword} />
                </>
              )}
            </div>
          </>
        )}
      </main>

      {newMentee && <NewMenteeModal onCreate={createMentee} onClose={() => setNewMentee(false)} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg"
          style={toast.type === 'error'
            ? { background: '#3f1d1d', color: '#fca5a5', border: '1px solid rgba(239,68,68,.4)' }
            : { background: '#112d54', color: '#e8b04a', border: '1px solid rgba(201,147,42,.5)' }}>
          {toast.text}
        </div>
      )}
    </div>
  )
}

/* ═══════════════ Sessão ═══════════════ */
function SessionCard({ sd, sess, onSave }) {
  const status = sess ? sess.status : 'pending'
  const [date, setDate] = useState(sess && sess.session_date ? sess.session_date : '')
  const [homework, setHomework] = useState(sess && sess.homework ? sess.homework : '')
  useEffect(() => {
    setDate(sess && sess.session_date ? sess.session_date : '')
    setHomework(sess && sess.homework ? sess.homework : '')
  }, [sess && sess.id, sess && sess.session_date, sess && sess.homework])
  const dirty = date !== (sess && sess.session_date ? sess.session_date : '') || homework !== (sess && sess.homework ? sess.homework : '')

  return (
    <div className="rounded-xl p-4" style={CARD}>
      <div className="flex items-start gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
          status === 'completed' ? 'bg-[rgba(201,147,42,.15)] text-[#e8b04a]' : status === 'current' ? 'bg-[#c9932a] text-[#0a1e38]' : 'bg-[rgba(255,255,255,.05)] text-slate-500'}`}>
          {sd.number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{sd.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">{sd.desc}</p>
          <div className="flex gap-2 flex-wrap">
            {ITEM_STATUS.map(([s, label]) => (
              <button key={s} onClick={() => onSave(sd.number, { status: s })}
                className={`text-xs px-3 py-1 rounded-full transition border ${status === s
                  ? s === 'completed' ? 'bg-[rgba(201,147,42,.15)] text-[#e8b04a] border-[rgba(201,147,42,.5)]'
                    : s === 'current' ? 'bg-[#c9932a] text-[#0a1e38] border-[#c9932a]'
                    : 'bg-[rgba(255,255,255,.08)] text-slate-200 border-[rgba(255,255,255,.2)]'
                  : 'text-slate-600 border-slate-700 hover:text-slate-400'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 mt-3">
            <div>
              <p className="text-xs text-slate-600 mb-1">Data da sessão</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} style={INP} />
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">Tarefa para o mentorado</p>
              <input value={homework} onChange={e => setHomework(e.target.value)} placeholder="Ex: Calcular ticket médio atual..." className={inp} style={INP} />
            </div>
          </div>
          {sess && sess.notes && (
            <div className="mt-3 rounded-lg p-3" style={{ background: '#071526', borderLeft: '3px solid #c9932a' }}>
              <p className="text-xs text-slate-500 mb-1">Anotações do mentorado</p>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">{sess.notes}</p>
            </div>
          )}
          {dirty && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => onSave(sd.number, { session_date: date || null, homework: homework || null })}
                className={btnPrimary} style={{ background: '#c9932a', color: '#0a1e38' }}>Salvar</button>
              <button onClick={() => { setDate(sess && sess.session_date ? sess.session_date : ''); setHomework(sess && sess.homework ? sess.homework : '') }} className={btnGhost}>Cancelar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════ Reuniões ═══════════════ */
function emptyMeeting() { return { title: '', scheduled_at: '', meet_link: '', session_id: '', status: 'scheduled' } }
function meetingToForm(m) {
  return { title: m.title || '', scheduled_at: toLocalInput(m.scheduled_at), meet_link: m.meet_link || '', session_id: m.session_id || '', status: m.status || 'scheduled' }
}

function MeetingForm({ initial, sessions, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ ...CARD, borderColor: 'rgba(201,147,42,.4)' }}>
      <input placeholder="Título (ex: Sessão 4 — Conteúdo)" value={form.title} onChange={e => set('title', e.target.value)} className={inp} style={INP} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-600 mb-1">Data e hora (horário de Brasília)</p>
          <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} className={inp} style={INP} />
        </div>
        <div>
          <p className="text-xs text-slate-600 mb-1">Status</p>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={inp + ' text-slate-300'} style={INP}>
            {MEETING_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <input placeholder="Link do Google Meet / Zoom (opcional)" value={form.meet_link} onChange={e => set('meet_link', e.target.value)} className={inp} style={INP} />
      <select value={form.session_id} onChange={e => set('session_id', e.target.value)} className={inp + ' text-slate-300'} style={INP}>
        <option value="">Vincular a uma sessão (opcional)</option>
        {sessions.map(s => <option key={s.id} value={s.id}>Sessão {s.session_number} — {s.title}</option>)}
      </select>
      <div className="flex gap-2 pt-1">
        <button onClick={async () => { if (await onSave(form)) onCancel() }} className={btnPrimary} style={{ background: '#c9932a', color: '#0a1e38' }}>{saveLabel}</button>
        <button onClick={onCancel} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)' }}>Cancelar</button>
      </div>
    </div>
  )
}

function MeetingsTab({ meetings, sessions, onSave, onDelete }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const now = Date.now()
  return (
    <>
      {adding
        ? <MeetingForm initial={emptyMeeting()} sessions={sessions} saveLabel="Criar reunião" onSave={f => onSave(f, null)} onCancel={() => setAdding(false)} />
        : (
          <button onClick={() => setAdding(true)} className="w-full py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: 'rgba(201,147,42,.15)', color: '#c9932a', border: '1px dashed rgba(201,147,42,.4)' }}>
            + Adicionar reunião
          </button>
        )}
      {meetings.length === 0 && <p className="text-sm text-slate-600 text-center py-6">Nenhuma reunião agendada.</p>}
      {meetings.map(m => {
        if (editing === m.id) {
          return <MeetingForm key={m.id} initial={meetingToForm(m)} sessions={sessions} saveLabel="Salvar alterações" onSave={f => onSave(f, m.id)} onCancel={() => setEditing(null)} />
        }
        const d = parseDate(m.scheduled_at)
        const isPast = d && d.getTime() < now && m.status !== 'cancelled'
        return (
          <div key={m.id} className="rounded-xl p-4 flex flex-wrap items-center gap-4" style={{ ...CARD, opacity: m.status === 'cancelled' ? .6 : 1 }}>
            <div className="text-center min-w-[44px]">
              <p className="text-xl font-semibold text-white">{d ? String(d.getDate()).padStart(2, '0') : '—'}</p>
              <p className="text-xs text-slate-500 uppercase">{d ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : ''}</p>
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-medium text-white">{m.title}</p>
              <p className="text-xs text-slate-500">
                {d ? `${formatWeekday(m.scheduled_at)}, ${formatDate(m.scheduled_at)} às ${formatTime(m.scheduled_at)}` : 'sem data'}
                {isPast && m.status !== 'completed' ? ' · já passou' : ''}
              </p>
              {m.meet_link && <a href={m.meet_link} target="_blank" rel="noreferrer" className="text-xs text-[#e8b04a] mt-1 block">Link da sala ↗</a>}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${
              m.status === 'next' ? 'text-[#0a1e38] border-[#c9932a] bg-[#c9932a]'
              : m.status === 'completed' ? 'text-[#e8b04a] border-[rgba(201,147,42,.5)] bg-[rgba(201,147,42,.15)]'
              : m.status === 'cancelled' ? 'text-red-300 border-red-800 bg-red-900/20'
              : 'text-slate-300 border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.06)]'}`}>
              {labelOf(MEETING_STATUS, m.status)}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setEditing(m.id) }} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)' }}>Editar</button>
              <button onClick={() => onDelete(m)} className="text-xs px-3 py-2 rounded-lg text-red-400 hover:text-red-300" style={{ border: '1px solid rgba(239,68,68,.3)' }}>Excluir</button>
            </div>
          </div>
        )
      })}
    </>
  )
}

/* ═══════════════ Metas ═══════════════ */
function emptyGoal() { return { period: '', title: '', detail: '', status: 'pending' } }
function goalToForm(g) { return { period: g.period || '', title: g.title || '', detail: g.detail || '', status: g.status || 'pending' } }

function GoalForm({ initial, onSave, onCancel, saveLabel }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ ...CARD, borderColor: 'rgba(201,147,42,.4)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="Período (ex: Abr 2026)" value={form.period} onChange={e => set('period', e.target.value)} className={inp} style={INP} />
        <select value={form.status} onChange={e => set('status', e.target.value)} className={inp + ' text-slate-300'} style={INP}>
          {ITEM_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <input placeholder="Título da meta" value={form.title} onChange={e => set('title', e.target.value)} className={inp} style={INP} />
      <textarea placeholder="Descrição (opcional) — quebras de linha são preservadas no portal" value={form.detail} onChange={e => set('detail', e.target.value)} rows={3} className={inp} style={{ ...INP, resize: 'vertical' }} />
      <div className="flex gap-2">
        <button onClick={async () => { if (await onSave(form)) onCancel() }} className={btnPrimary} style={{ background: '#c9932a', color: '#0a1e38' }}>{saveLabel}</button>
        <button onClick={onCancel} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)' }}>Cancelar</button>
      </div>
    </div>
  )
}

function GoalsTab({ goals, onSave, onDelete, onMove }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  return (
    <>
      {adding
        ? <GoalForm initial={emptyGoal()} saveLabel="Salvar meta" onSave={f => onSave(f, null)} onCancel={() => setAdding(false)} />
        : (
          <button onClick={() => setAdding(true)} className="w-full py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: 'rgba(201,147,42,.15)', color: '#c9932a', border: '1px dashed rgba(201,147,42,.4)' }}>
            + Adicionar meta
          </button>
        )}
      {goals.length === 0 && <p className="text-sm text-slate-600 text-center py-6">Nenhuma meta definida.</p>}
      {goals.map((g, i) => editing === g.id
        ? <GoalForm key={g.id} initial={goalToForm(g)} saveLabel="Salvar alterações" onSave={f => onSave(f, g.id)} onCancel={() => setEditing(null)} />
        : (
          <div key={g.id} className="rounded-xl p-4 flex flex-wrap items-start gap-3" style={CARD}>
            <div className="flex flex-col gap-1 pt-1">
              <button onClick={() => onMove(g, -1)} disabled={i === 0} className="text-slate-600 hover:text-white disabled:opacity-20 text-xs leading-none">▲</button>
              <button onClick={() => onMove(g, 1)} disabled={i === goals.length - 1} className="text-slate-600 hover:text-white disabled:opacity-20 text-xs leading-none">▼</button>
            </div>
            <div className="flex-1 min-w-[180px]">
              <p className="text-xs text-slate-500">{g.period}</p>
              <p className="text-sm font-medium text-white mt-0.5">{g.title}</p>
              {g.detail && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{g.detail}</p>}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border ${
              g.status === 'completed' ? 'text-[#e8b04a] border-[rgba(201,147,42,.5)] bg-[rgba(201,147,42,.15)]'
              : g.status === 'current' ? 'text-[#0a1e38] border-[#c9932a] bg-[#c9932a]'
              : 'text-slate-400 border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.06)]'}`}>
              {labelOf(ITEM_STATUS, g.status)}
            </span>
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setEditing(g.id) }} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)' }}>Editar</button>
              <button onClick={() => onDelete(g)} className="text-xs px-3 py-2 rounded-lg text-red-400 hover:text-red-300" style={{ border: '1px solid rgba(239,68,68,.3)' }}>Excluir</button>
            </div>
          </div>
        ))}
    </>
  )
}

/* ═══════════════ Perfil ═══════════════ */
function ProfileForm({ profile, busy, onSave }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || '',
    specialty: profile.specialty || '',
    city: profile.city || '',
    whatsapp: profile.whatsapp || '',
    start_date: profile.start_date || '',
    investment: profile.investment === null || profile.investment === undefined ? '' : String(profile.investment),
    photo_url: profile.photo_url || '',
    drive_folder_url: profile.drive_folder_url || '',
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  // Função comum (não um componente): assim o input não é recriado a cada tecla e mantém o foco
  const field = (label, k, type = 'text', placeholder) => (
    <ProfileField key={k} label={label} type={type} placeholder={placeholder} value={form[k]} onChange={v => set(k, v)} />
  )
  return (
    <div className="rounded-xl p-5 space-y-4 max-w-2xl" style={CARD}>
      <div>
        <p className="text-xs text-slate-500 mb-1">E-mail de acesso</p>
        <p className="text-sm text-slate-300">{profile.email}</p>
        <p className="text-xs text-slate-600 mt-1">Para trocar a senha, use "Redefinir senha do mentorado" logo abaixo.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('Nome completo', 'full_name')}
        {field('Especialidade', 'specialty', 'text', 'Ex: Fisioterapeuta Empreendedora')}
        {field('Cidade', 'city', 'text', 'Ex: Campo Grande, MS')}
        {field('WhatsApp', 'whatsapp', 'text', 'Ex: 67 99999-9999')}
        {field('Data de início', 'start_date', 'date')}
        {field('Investimento (R$)', 'investment', 'number', '7000')}
      </div>
      {field('Link da pasta no Google Drive', 'drive_folder_url', 'text', 'https://drive.google.com/drive/folders/...')}
      {field('URL da foto (opcional)', 'photo_url', 'text', 'https://...')}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => onSave(form)} disabled={busy} className={btnPrimary} style={{ background: '#c9932a', color: '#0a1e38', opacity: busy ? .6 : 1 }}>Salvar perfil</button>
        <span className="text-xs text-slate-600">As alterações aparecem na hora no portal do mentorado.</span>
      </div>
    </div>
  )
}

// Definido fora do ProfileForm para não ser recriado a cada tecla (o input perderia o foco)
function ProfileField({ label, type, placeholder, value, onChange }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={inp} style={INP} />
    </div>
  )
}


/* ═══════════════ Senha ═══════════════ */
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint32Array(12)
  window.crypto.getRandomValues(arr)
  for (let i = 0; i < 12; i++) out += chars[arr[i] % chars.length]
  return out
}

function PasswordReset({ onReset }) {
  const [pw, setPw] = useState('')
  const [done, setDone] = useState('')
  return (
    <div className="rounded-xl p-5 space-y-3 max-w-2xl" style={CARD}>
      <p className="text-sm font-medium text-white">Redefinir senha do mentorado</p>
      <p className="text-xs text-slate-500">Defina uma senha nova e envie para o mentorado. A senha atual deixa de valer na hora.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={pw} onChange={e => { setPw(e.target.value); setDone('') }} placeholder="Nova senha (mín. 8 caracteres)" className={inp} style={INP} />
        <button onClick={() => { setPw(generatePassword()); setDone('') }} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)', whiteSpace: 'nowrap' }}>Gerar</button>
        <button onClick={async () => { if (await onReset(pw)) setDone(pw) }} disabled={pw.length < 8}
          className={btnPrimary} style={{ background: '#c9932a', color: '#0a1e38', opacity: pw.length < 8 ? .5 : 1, whiteSpace: 'nowrap' }}>
          Redefinir senha
        </button>
      </div>
      {done && (
        <div className="rounded-lg p-3 text-xs" style={{ background: '#071526', border: '1px solid rgba(201,147,42,.4)' }}>
          <p className="text-slate-400">Senha nova (envie ao mentorado):</p>
          <p className="text-[#e8b04a] font-mono text-sm mt-1 select-all">{done}</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════ Novo mentorado ═══════════════ */
function NewMenteeModal({ onCreate, onClose }) {
  const [form, setForm] = useState({
    full_name: '', email: '', password: generatePassword(), specialty: '', city: '', whatsapp: '',
    start_date: '', investment: '7000', drive_folder_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const canSubmit = form.full_name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && form.password.length >= 8

  async function submit() {
    setSaving(true); setError('')
    const res = await onCreate(form)
    setSaving(false)
    if (res.error) return setError(res.error)
    setCreated({ email: form.email.trim().toLowerCase(), password: form.password, name: form.full_name.trim() })
  }

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const message = created
    ? `Olá, ${created.name.split(' ')[0]}! Seu acesso ao Portal da Mentoria:\n\nLink: ${portalUrl}\nE-mail: ${created.email}\nSenha: ${created.password}\n\nQualquer dúvida, fale com a Paola.`
    : ''

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto" style={CARD} onClick={e => e.stopPropagation()}>
        {!created ? (
          <>
            <div>
              <h3 className="text-base font-semibold text-white">Novo mentorado</h3>
              <p className="text-xs text-slate-500 mt-1">Cria o login de acesso e o perfil no portal. Você recebe o e-mail e a senha prontos para enviar.</p>
            </div>
            <div className="space-y-3">
              <ProfileField label="Nome completo *" type="text" value={form.full_name} onChange={v => set('full_name', v)} placeholder="Ex: Maria Silva" />
              <ProfileField label="E-mail de acesso *" type="email" value={form.email} onChange={v => set('email', v)} placeholder="email@exemplo.com" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Senha inicial * (mín. 8 caracteres)</p>
                <div className="flex gap-2">
                  <input value={form.password} onChange={e => set('password', e.target.value)} className={inp + ' font-mono'} style={INP} />
                  <button onClick={() => set('password', generatePassword())} className={btnGhost} style={{ border: '1px solid rgba(201,147,42,.25)', whiteSpace: 'nowrap' }}>Gerar</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ProfileField label="Especialidade" type="text" value={form.specialty} onChange={v => set('specialty', v)} placeholder="Ex: Fisioterapeuta" />
                <ProfileField label="Cidade" type="text" value={form.city} onChange={v => set('city', v)} placeholder="Ex: Campo Grande, MS" />
                <ProfileField label="WhatsApp" type="text" value={form.whatsapp} onChange={v => set('whatsapp', v)} placeholder="67 99999-9999" />
                <ProfileField label="Data de início" type="date" value={form.start_date} onChange={v => set('start_date', v)} />
                <ProfileField label="Investimento (R$)" type="number" value={form.investment} onChange={v => set('investment', v)} placeholder="7000" />
                <ProfileField label="Pasta do Drive" type="text" value={form.drive_folder_url} onChange={v => set('drive_folder_url', v)} placeholder="https://drive.google.com/..." />
              </div>
            </div>
            {error && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5' }}>{error}</div>}
            <div className="flex gap-3 pt-1">
              <button onClick={submit} disabled={!canSubmit || saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#c9932a', color: '#0a1e38', opacity: (!canSubmit || saving) ? .5 : 1 }}>
                {saving ? 'Cadastrando...' : 'Cadastrar mentorado'}
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition" style={{ border: '1px solid rgba(201,147,42,.25)' }}>Cancelar</button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-base font-semibold text-white">{created.name} cadastrado(a) ✓</h3>
              <p className="text-xs text-slate-500 mt-1">Envie estes dados de acesso. A senha não fica visível depois; se perder, redefina na aba Perfil.</p>
            </div>
            <div className="rounded-lg p-4 space-y-1 text-sm" style={{ background: '#071526', border: '1px solid rgba(201,147,42,.4)' }}>
              <p className="text-slate-400 text-xs">Link</p><p className="text-white select-all">{portalUrl}</p>
              <p className="text-slate-400 text-xs pt-2">E-mail</p><p className="text-white select-all">{created.email}</p>
              <p className="text-slate-400 text-xs pt-2">Senha</p><p className="text-[#e8b04a] font-mono select-all">{created.password}</p>
            </div>
            <textarea readOnly value={message} rows={6} className={inp + ' text-xs'} style={{ ...INP, resize: 'none' }} onFocus={e => e.target.select()} />
            <div className="flex gap-3">
              <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(message) }} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#c9932a', color: '#0a1e38' }}>Copiar mensagem</button>
              <a href={'https://wa.me/?text=' + encodeURIComponent(message)} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-xl text-sm text-center text-slate-200" style={{ border: '1px solid rgba(201,147,42,.25)' }}>Enviar no WhatsApp</a>
              <button onClick={onClose} className="py-2.5 px-4 rounded-xl text-sm text-slate-400 hover:text-white" style={{ border: '1px solid rgba(201,147,42,.25)' }}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
