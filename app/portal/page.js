'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { SESSION_DATA, getInitials, formatDate, formatDateTime } from '../../lib/supabase'

/* ─── Ícones simples em SVG ─── */
const Icon = {
  sessions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 12l2 2 4-4"/></svg>,
  files:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  goals:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  logout:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  upload:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  wpp:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
}

const TABS = ['Sessões', 'Arquivos', 'Calendário', 'Metas']

export default function PortalPage() {
  const supabase = createClientComponentClient()
  const router   = useRouter()

  const [profile,  setProfile]  = useState(null)
  const [sessions, setSessions] = useState([])
  const [files,    setFiles]    = useState([])
  const [meetings, setMeetings] = useState([])
  const [goals,    setGoals]    = useState([])
  const [tab,      setTab]      = useState('Sessões')
  const [loading,  setLoading]  = useState(true)
  const [openSess, setOpenSess] = useState(null)
  const [noteText, setNoteText] = useState({})
  const [uploading,setUploading]= useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  /* ── Carrega dados ── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const [{ data: prof }, { data: sess }, { data: fils }, { data: meet }, { data: gols }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('sessions').select('*').eq('mentee_id', user.id).order('session_number'),
        supabase.from('files').select('*').eq('mentee_id', user.id).order('created_at', { ascending: false }),
        supabase.from('meetings').select('*').eq('mentee_id', user.id).order('scheduled_at'),
        supabase.from('goals').select('*').eq('mentee_id', user.id).order('sort_order'),
      ])

      setProfile(prof)
      setSessions(sess || [])
      setFiles(fils || [])
      setMeetings(meet || [])
      setGoals(gols || [])

      const initNotes = {}
      ;(sess || []).forEach(s => { initNotes[s.id] = s.notes || '' })
      setNoteText(initNotes)
      setLoading(false)
    }
    load()
  }, [])

  /* ── Salva anotação ── */
  async function saveNote(sessionId) {
    await supabase.from('sessions').update({ notes: noteText[sessionId] }).eq('id', sessionId)
    alert('Anotação salva!')
  }

  /* ── Upload de arquivo ── */
  const handleUpload = useCallback(async (file) => {
    if (!file || !profile) return
    setUploading(true)
    const path = `${profile.id}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('mentee-files').upload(path, file)
    if (upErr) { alert('Erro no upload.'); setUploading(false); return }
    await supabase.from('files').insert({
      mentee_id: profile.id, name: file.name,
      size: file.size, type: file.type,
      storage_path: path, uploaded_by: profile.id
    })
    const { data: fils } = await supabase.from('files').select('*').eq('mentee_id', profile.id).order('created_at', { ascending: false })
    setFiles(fils || [])
    setUploading(false)
  }, [profile])

  /* ── Download de arquivo ── */
  async function downloadFile(f) {
    const { data } = await supabase.storage.from('mentee-files').createSignedUrl(f.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  /* ── Helpers visuais ── */
  const completedCount = sessions.filter(s => s.status === 'completed').length
  const progressPct    = sessions.length ? Math.round((completedCount / 8) * 100) : 0

  function statusBadge(status) {
    const map = {
      completed: { label: 'Concluída',    bg: 'bg-emerald-900/40', text: 'text-emerald-400', border: 'border-emerald-800/50' },
      current:   { label: 'Em andamento', bg: 'bg-sky-900/40',     text: 'text-sky-400',     border: 'border-sky-800/50' },
      pending:   { label: 'Aguardando',   bg: 'bg-slate-800',       text: 'text-slate-400',   border: 'border-slate-700' },
    }
    const s = map[status] || map.pending
    return <span className={`text-xs px-2.5 py-1 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>
  }

  function meetBadge(status) {
    const map = {
      scheduled: { label: 'Agendada',  bg: 'bg-sky-900/40',      text: 'text-sky-400' },
      next:      { label: 'Próxima',   bg: 'bg-emerald-900/40',  text: 'text-emerald-400' },
      completed: { label: 'Concluída', bg: 'bg-slate-800',        text: 'text-slate-400' },
      cancelled: { label: 'Cancelada', bg: 'bg-red-900/40',       text: 'text-red-400' },
    }
    const s = map[status] || map.scheduled
    return <span className={`text-xs px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
  }

  function goalDot(status) {
    if (status === 'completed') return (
      <div className="w-8 h-8 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center text-emerald-400">{Icon.check}</div>
    )
    if (status === 'current') return (
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-white"/>
      </div>
    )
    return <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800/50"/>
  }

  function fileExt(name = '') {
    const ext = name.split('.').pop().toUpperCase()
    const colors = { PDF: 'text-red-400 bg-red-900/30', XLS: 'text-emerald-400 bg-emerald-900/30', XLSX: 'text-emerald-400 bg-emerald-900/30', DOC: 'text-sky-400 bg-sky-900/30', DOCX: 'text-sky-400 bg-sky-900/30', MP4: 'text-purple-400 bg-purple-900/30' }
    return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${colors[ext] || 'text-slate-400 bg-slate-800'}`}>{ext}</span>
  }

  function formatBytes(bytes = 0) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-500 text-sm animate-pulse">Carregando portal...</div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* ── TOP BAR ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)' }}>
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4z" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,.2)"/><path d="M16 9v7l5 3" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span className="text-sm font-medium text-white">Mentoria Abdalla</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://wa.me/5521999999999?text=Olá Paola" target="_blank" rel="noreferrer"
             className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-1.5 rounded-lg transition"
             style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)' }}>
            {Icon.wpp} Falar com a Paola
          </a>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition px-2 py-1.5">
            {Icon.logout} Sair
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6 fade-up">
        {/* ── HEADER MENTORADO ── */}
        <div className="rounded-2xl p-6 flex items-center gap-5" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt={profile.full_name} className="w-16 h-16 rounded-full object-cover ring-2 ring-emerald-500/30"/>
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-emerald-400"
                 style={{ background: 'rgba(16,185,129,.1)', border: '2px solid rgba(16,185,129,.25)' }}>
              {getInitials(profile?.full_name)}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white">{profile?.full_name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {profile?.specialty && <>{profile.specialty} · </>}
              {profile?.city && <>{profile.city} · </>}
              Início: {formatDate(profile?.start_date)}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPct}%` }}/>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{completedCount} de 8 sessões</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/50">Em andamento</span>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-semibold text-white">R$ {Number(profile?.investment || 0).toLocaleString('pt-BR')}</p>
            <p className="text-xs text-slate-500 mt-0.5">investimento realizado</p>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 flex-1 justify-center py-2 text-sm rounded-lg transition font-medium ${tab === t ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t === 'Sessões' && Icon.sessions}
              {t === 'Arquivos' && Icon.files}
              {t === 'Calendário' && Icon.calendar}
              {t === 'Metas' && Icon.goals}
              {t}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════
             ABA SESSÕES
        ══════════════════════════════ */}
        {tab === 'Sessões' && (
          <div className="space-y-3 fade-up">
            {SESSION_DATA.map(sd => {
              const sess = sessions.find(s => s.session_number === sd.number)
              const status = sess?.status || 'pending'
              const isOpen = openSess === sd.number
              return (
                <div key={sd.number}
                  className={`rounded-xl overflow-hidden transition ${status === 'current' ? 'ring-1 ring-sky-500/50' : ''}`}
                  style={{ background: '#1e293b', border: '1px solid #334155' }}>
                  <div className="flex items-center gap-4 p-4 cursor-pointer"
                       onClick={() => setOpenSess(isOpen ? null : sd.number)}>
                    {/* Número */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                      status === 'completed' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' :
                      status === 'current'   ? 'bg-sky-500 text-white' :
                                               'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                      {status === 'completed' ? Icon.check : sd.number}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${status === 'pending' ? 'text-slate-400' : 'text-white'}`}>{sd.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{sd.desc}</p>
                    </div>
                    {/* Badge + chevron */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {statusBadge(status)}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                           className={`text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-3 fade-up">
                      {sess?.homework && (
                        <div className="rounded-lg p-3" style={{ background: '#0f172a', borderLeft: '3px solid #10b981' }}>
                          <p className="text-xs font-medium text-emerald-400 mb-1">Tarefa da sessão</p>
                          <p className="text-sm text-slate-300">{sess.homework}</p>
                        </div>
                      )}
                      {sess && (
                        <>
                          <div>
                            <p className="text-xs text-slate-500 mb-1.5">Anotações</p>
                            <textarea
                              value={noteText[sess.id] || ''}
                              onChange={e => setNoteText(p => ({ ...p, [sess.id]: e.target.value }))}
                              placeholder="Adicione suas anotações desta sessão..."
                              rows={3}
                              className="w-full text-sm text-slate-300 rounded-lg p-3 resize-none outline-none placeholder-slate-600 transition"
                              style={{ background: '#0f172a', border: '1px solid #334155' }}
                              onFocus={e => e.target.style.borderColor = '#10b981'}
                              onBlur={e => e.target.style.borderColor = '#334155'}
                            />
                          </div>
                          <button onClick={() => saveNote(sess.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
                            style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)' }}>
                            Salvar anotação
                          </button>
                        </>
                      )}
                      {!sess && <p className="text-xs text-slate-600">Esta sessão ainda não foi iniciada.</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════
             ABA ARQUIVOS
        ══════════════════════════════ */}
        {tab === 'Arquivos' && (
          <div className="space-y-4 fade-up">
            {/* Drop zone */}
            <div
              className={`drop-zone rounded-xl p-10 text-center cursor-pointer transition ${dragOver ? 'over' : ''}`}
              style={{ background: '#1e293b' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}>
              <input ref={fileRef} type="file" className="hidden" onChange={e => handleUpload(e.target.files[0])}/>
              <div className="flex justify-center mb-3 text-slate-500">{Icon.upload}</div>
              {uploading ? (
                <p className="text-sm text-emerald-400 animate-pulse">Enviando arquivo...</p>
              ) : (
                <>
                  <p className="text-sm text-slate-300 font-medium">Arraste um arquivo ou clique para enviar</p>
                  <p className="text-xs text-slate-600 mt-1">PDF, DOCX, XLSX, MP4 · máx. 50 MB</p>
                </>
              )}
            </div>

            {/* Lista */}
            {files.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-4">Nenhum arquivo enviado ainda.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">Arquivos ({files.length})</p>
                {files.map(f => (
                  <div key={f.id}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:border-slate-600 transition"
                    style={{ background: '#1e293b', border: '1px solid #334155' }}
                    onClick={() => downloadFile(f)}>
                    {fileExt(f.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{f.name}</p>
                      <p className="text-xs text-slate-500">{formatBytes(f.size)} · {formatDate(f.created_at)}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
             ABA CALENDÁRIO
        ══════════════════════════════ */}
        {tab === 'Calendário' && (
          <div className="space-y-3 fade-up">
            {meetings.length === 0 ? (
              <div className="rounded-xl p-10 text-center" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                <p className="text-sm text-slate-500">Nenhuma reunião agendada.</p>
                <p className="text-xs text-slate-600 mt-1">O Dr. Filipe vai adicionar os encontros em breve.</p>
              </div>
            ) : meetings.map(m => {
              const d = m.scheduled_at ? new Date(m.scheduled_at) : null
              const isNext = m.status === 'next'
              return (
                <div key={m.id}
                  className={`flex items-center gap-5 p-4 rounded-xl transition ${isNext ? 'ring-1 ring-emerald-500/40' : ''}`}
                  style={{ background: '#1e293b', border: `1px solid ${isNext ? '#065f46' : '#334155'}` }}>
                  {/* Data */}
                  <div className="text-center min-w-[52px]">
                    <p className="text-2xl font-semibold text-white leading-none">
                      {d ? d.getDate().toString().padStart(2,'0') : '—'}
                    </p>
                    <p className="text-xs text-slate-500 uppercase mt-0.5">
                      {d ? d.toLocaleDateString('pt-BR', { month: 'short' }) : ''}
                    </p>
                  </div>
                  <div className="w-px h-10 bg-slate-700"/>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{m.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {d ? d.toLocaleDateString('pt-BR', { weekday: 'long' }) : ''} · {d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''} – {d ? new Date(d.getTime() + 5400000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  {meetBadge(m.status)}
                  {m.meet_link && m.status !== 'completed' && (
                    <a href={m.meet_link} target="_blank" rel="noreferrer"
                       className="text-xs px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap"
                       style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)' }}>
                      Entrar
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════
             ABA METAS
        ══════════════════════════════ */}
        {tab === 'Metas' && (
          <div className="fade-up">
            {goals.length === 0 ? (
              <div className="rounded-xl p-10 text-center" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                <p className="text-sm text-slate-500">Plano de metas ainda não definido.</p>
                <p className="text-xs text-slate-600 mt-1">Será criado junto com o Dr. Filipe na sessão 1.</p>
              </div>
            ) : (
              <div className="relative pl-2">
                {/* Linha vertical */}
                <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-800"/>
                <div className="space-y-1">
                  {goals.map((g, i) => (
                    <div key={g.id} className="flex gap-4 pb-6 relative">
                      <div className="flex-shrink-0 relative z-10">{goalDot(g.status)}</div>
                      <div className={`flex-1 rounded-xl p-4 ${g.status === 'current' ? 'ring-1 ring-emerald-500/30' : ''}`}
                           style={{ background: '#1e293b', border: '1px solid #334155' }}>
                        <p className="text-xs text-slate-500 mb-1">{g.period}</p>
                        <p className={`text-sm font-medium ${g.status === 'pending' ? 'text-slate-400' : 'text-white'}`}>{g.title}</p>
                        {g.detail && <p className="text-xs text-slate-500 mt-1">{g.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
