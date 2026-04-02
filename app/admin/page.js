'use client'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { SESSION_DATA, getInitials, formatDate, formatDateTime } from '../../lib/supabase'

export default function AdminPage() {
  const supabase = createClientComponentClient()
  const router   = useRouter()

  const [mentees,  setMentees]  = useState([])
  const [selected, setSelected] = useState(null)
  const [sessions, setSessions] = useState([])
  const [meetings, setMeetings] = useState([])
  const [goals,    setGoals]    = useState([])
  const [files,    setFiles]    = useState([])
  const [tab,      setTab]      = useState('Sessões')
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [driveUrl, setDriveUrl]  = useState('')

  /* Modal de nova reunião */
  const [meetModal, setMeetModal] = useState(false)
  const [meetForm, setMeetForm]   = useState({ title: '', scheduled_at: '', meet_link: '', session_id: '' })

  /* ── Verificar se é admin ── */
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof?.role !== 'admin') return router.push('/portal')
      await loadMentees()
      setLoading(false)
    }
    init()
  }, [])

  async function saveDriveUrl() {
    if (!selected) return
    setSaving(true)
    await supabase.from('profiles').update({ drive_folder_url: driveUrl }).eq('id', selected.id)
    setSaving(false)
    alert('Link do Drive salvo!')
  }

  async function loadMentees() {
    const { data } = await supabase
      .from('profiles')
      .select('*, sessions(count)')
      .eq('role', 'mentee')
      .order('full_name')
    setMentees(data || [])
  }

  async function selectMentee(m) {
    setSelected(m)
    setDriveUrl(m.drive_folder_url || '')
    setDriveUrl(m.drive_folder_url || '')
    setTab('Sessões')
    const [{ data: sess }, { data: meet }, { data: gols }, { data: fils }] = await Promise.all([
      supabase.from('sessions').select('*').eq('mentee_id', m.id).order('session_number'),
      supabase.from('meetings').select('*').eq('mentee_id', m.id).order('scheduled_at'),
      supabase.from('goals').select('*').eq('mentee_id', m.id).order('sort_order'),
      supabase.from('files').select('*').eq('mentee_id', m.id).order('created_at', { ascending: false }),
    ])
    setSessions(sess || [])
    setMeetings(meet || [])
    setGoals(gols || [])
    setFiles(fils || [])
  }

  /* ── Alterar status da sessão ── */
  async function updateSessionStatus(sessionNumber, status) {
    setSaving(true)
    const existing = sessions.find(s => s.session_number === sessionNumber)
    if (existing) {
      await supabase.from('sessions').update({ status }).eq('id', existing.id)
    } else {
      const sd = SESSION_DATA.find(s => s.number === sessionNumber)
      await supabase.from('sessions').insert({
        mentee_id: selected.id, session_number: sessionNumber,
        title: sd.title, description: sd.desc, status
      })
    }
    const { data } = await supabase.from('sessions').select('*').eq('mentee_id', selected.id).order('session_number')
    setSessions(data || [])
    setSaving(false)
  }

  /* ── Salvar tarefa ── */
  async function saveHomework(sessionNumber, homework) {
    const existing = sessions.find(s => s.session_number === sessionNumber)
    if (existing) await supabase.from('sessions').update({ homework }).eq('id', existing.id)
    const { data } = await supabase.from('sessions').select('*').eq('mentee_id', selected.id).order('session_number')
    setSessions(data || [])
  }

  /* ── Criar reunião ── */
  async function createMeeting() {
    if (!meetForm.title || !meetForm.scheduled_at) return
    await supabase.from('meetings').insert({ ...meetForm, mentee_id: selected.id, status: 'scheduled' })
    const { data } = await supabase.from('meetings').select('*').eq('mentee_id', selected.id).order('scheduled_at')
    setMeetings(data || [])
    setMeetModal(false)
    setMeetForm({ title: '', scheduled_at: '', meet_link: '', session_id: '' })
  }

  /* ── Adicionar meta ── */
  const [goalForm, setGoalForm] = useState({ period: '', title: '', detail: '', status: 'pending' })
  const [addGoal, setAddGoal]   = useState(false)

  async function createGoal() {
    if (!goalForm.title) return
    await supabase.from('goals').insert({ ...goalForm, mentee_id: selected.id, sort_order: goals.length + 1 })
    const { data } = await supabase.from('goals').select('*').eq('mentee_id', selected.id).order('sort_order')
    setGoals(data || [])
    setAddGoal(false)
    setGoalForm({ period: '', title: '', detail: '', status: 'pending' })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <p className="text-slate-500 animate-pulse text-sm">Carregando painel...</p>
    </div>
  )

  const completedFor = (m) => m.sessions?.[0]?.count || 0

  /* ─────────────────────────────────
     LAYOUT: Sidebar + Conteúdo
  ───────────────────────────────── */
  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>
      {/* ─ SIDEBAR MENTORADOS ─ */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'rgba(16,185,129,.15)' }}>
              <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4z" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,.2)"/><path d="M16 9v7l5 3" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-sm font-semibold text-white">Painel Admin</span>
          </div>
          <p className="text-xs text-slate-500">Gestão de Mentorados</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs text-slate-600 px-2 py-1 font-medium">Mentorados ativos ({mentees.length})</p>
          {mentees.map(m => (
            <button key={m.id} onClick={() => selectMentee(m)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${selected?.id === m.id ? 'bg-emerald-900/30 border border-emerald-800/40' : 'hover:bg-slate-800'}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 text-emerald-400"
                   style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)' }}>
                {getInitials(m.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{m.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{m.city || m.email}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full text-xs text-slate-500 hover:text-white py-2 transition">
            Sair
          </button>
        </div>
      </aside>

      {/* ─ CONTEÚDO PRINCIPAL ─ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <p className="text-white font-medium">Selecione um mentorado</p>
            <p className="text-sm text-slate-500 mt-1">Escolha na lista ao lado para ver e editar o portal</p>
            {/* Métricas gerais */}
            <div className="grid grid-cols-3 gap-4 mt-10 w-full max-w-lg">
              {(() => {
                const totalSess = mentees.reduce((a, m) => a + (m.sessions?.[0]?.count || 0), 0)
                const taxaMedia = mentees.length ? Math.round(mentees.reduce((a, m) => a + ((m.sessions?.[0]?.count || 0) / 8 * 100), 0) / mentees.length) : 0
                const cards = [
                  { label: 'Mentorados ativos', value: mentees.length },
                  { label: 'Total de sessões', value: totalSess },
                  { label: 'Taxa média', value: taxaMedia + '%' },
                ]
                return cards.map(card => (
                  <div key={card.label} className="rounded-xl p-4 text-center" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                    <p className="text-2xl font-semibold text-white">{card.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{card.label}</p>
                  </div>
                ))
              })()}
            </div>
          </div>
        ) : (
          <>
            {/* Header do mentorado */}
            <div className="flex items-center gap-4 p-5 border-b border-slate-800">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-400"
                   style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)' }}>
                {getInitials(selected.full_name)}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">{selected.full_name}</h2>
                <p className="text-xs text-slate-500">{selected.email} · Início: {formatDate(selected.start_date)}</p>
              </div>
              {/* Campo Google Drive */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#1e293b', border: '1px solid rgba(201,147,42,.4)' }}>
                <span style={{ fontSize:11, color:'rgba(201,147,42,.8)', fontWeight:600, whiteSpace:'nowrap' }}>Drive</span>
                <input
                  value={driveUrl}
                  onChange={e => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  style={{ width:280, fontSize:12, padding:'2px 8px', borderRadius:6, background:'#0f172a', border:'1px solid rgba(201,147,42,.25)', color:'#fff', outline:'none', fontFamily:'inherit' }}
                />
                <button
                  onClick={saveDriveUrl}
                  disabled={saving}
                  style={{ fontSize:11, padding:'4px 12px', borderRadius:6, background:'#c9932a', color:'#0a1e38', border:'none', cursor:'pointer', fontWeight:700, fontFamily:'inherit', opacity:saving?0.6:1, whiteSpace:'nowrap' }}>
                  {saving ? '...' : 'Salvar'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Progresso */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                  <div className="w-16 h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(sessions.filter(s=>s.status==='completed').length/8)*100}%` }}/>
                  </div>
                  <span className="text-slate-400">{sessions.filter(s=>s.status==='completed').length}/8</span>
                </div>
                {saving && <span className="text-xs text-slate-500 animate-pulse">Salvando...</span>}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-slate-800 px-5">
              {['Sessões', 'Reuniões', 'Metas', 'Arquivos'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`py-3 px-4 text-sm transition border-b-2 ${tab === t ? 'text-emerald-400 border-emerald-500' : 'text-slate-500 border-transparent hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">

              {/* ── SESSÕES (admin) ── */}
              {tab === 'Sessões' && SESSION_DATA.map(sd => {
                const sess = sessions.find(s => s.session_number === sd.number)
                const status = sess?.status || 'pending'
                return (
                  <div key={sd.number} className="rounded-xl p-4" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                    <div className="flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        status==='completed'?'bg-emerald-900/50 text-emerald-400':status==='current'?'bg-sky-500 text-white':'bg-slate-800 text-slate-500'}`}>
                        {sd.number}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{sd.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 mb-3">{sd.desc}</p>
                        {/* Status selector */}
                        <div className="flex gap-2 flex-wrap">
                          {['pending','current','completed'].map(s => (
                            <button key={s} onClick={() => updateSessionStatus(sd.number, s)}
                              className={`text-xs px-3 py-1 rounded-full transition border ${status===s
                                ? s==='completed'?'bg-emerald-900/40 text-emerald-400 border-emerald-700'
                                  :s==='current'?'bg-sky-900/40 text-sky-400 border-sky-700'
                                  :'bg-slate-700 text-slate-300 border-slate-600'
                                : 'text-slate-600 border-slate-700 hover:text-slate-400'}`}>
                              {s==='pending'?'Aguardando':s==='current'?'Em andamento':'Concluída'}
                            </button>
                          ))}
                        </div>
                        {/* Tarefa */}
                        <div className="mt-3">
                          <p className="text-xs text-slate-600 mb-1">Tarefa para o mentorado</p>
                          <div className="flex gap-2">
                            <input
                              defaultValue={sess?.homework || ''}
                              id={`hw-${sd.number}`}
                              placeholder="Ex: Calcular ticket médio atual..."
                              className="flex-1 text-xs px-3 py-1.5 rounded-lg text-slate-300 outline-none placeholder-slate-700"
                              style={{ background: '#0f172a', border: '1px solid #334155' }}
                            />
                            <button onClick={() => saveHomework(sd.number, document.getElementById(`hw-${sd.number}`).value)}
                              className="text-xs px-3 py-1.5 rounded-lg transition"
                              style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px solid rgba(16,185,129,.3)' }}>
                              Salvar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* ── REUNIÕES (admin) ── */}
              {tab === 'Reuniões' && (
                <>
                  <button onClick={() => setMeetModal(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition"
                    style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px dashed rgba(16,185,129,.4)' }}>
                    + Adicionar reunião
                  </button>

                  {meetings.length === 0 ? (
                    <p className="text-sm text-slate-600 text-center py-6">Nenhuma reunião agendada.</p>
                  ) : meetings.map(m => {
                    const d = m.scheduled_at ? new Date(m.scheduled_at) : null
                    return (
                      <div key={m.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                        <div className="text-center min-w-[44px]">
                          <p className="text-xl font-semibold text-white">{d?.getDate().toString().padStart(2,'0') || '—'}</p>
                          <p className="text-xs text-slate-500">{d?.toLocaleDateString('pt-BR',{month:'short'}) || ''}</p>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{m.title}</p>
                          <p className="text-xs text-slate-500">{d?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) || ''}</p>
                          {m.meet_link && <a href={m.meet_link} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 mt-1 block">Link do Meet →</a>}
                        </div>
                        <select
                          value={m.status}
                          onChange={async e => {
                            await supabase.from('meetings').update({status:e.target.value}).eq('id',m.id)
                            const {data} = await supabase.from('meetings').select('*').eq('mentee_id',selected.id).order('scheduled_at')
                            setMeetings(data||[])
                          }}
                          className="text-xs px-2 py-1 rounded-lg outline-none text-slate-300"
                          style={{ background: '#0f172a', border: '1px solid #334155' }}>
                          <option value="scheduled">Agendada</option>
                          <option value="next">Próxima</option>
                          <option value="completed">Concluída</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                      </div>
                    )
                  })}
                </>
              )}

              {/* ── METAS (admin) ── */}
              {tab === 'Metas' && (
                <>
                  <button onClick={() => setAddGoal(true)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition"
                    style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', border: '1px dashed rgba(16,185,129,.4)' }}>
                    + Adicionar meta
                  </button>

                  {addGoal && (
                    <div className="rounded-xl p-4 space-y-3" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                      <div className="grid grid-cols-2 gap-3">
                        <input placeholder="Período (ex: Abr 2026)" value={goalForm.period} onChange={e=>setGoalForm(p=>({...p,period:e.target.value}))} className="text-sm px-3 py-2 rounded-lg text-white outline-none placeholder-slate-600" style={{background:'#0f172a',border:'1px solid #334155'}}/>
                        <select value={goalForm.status} onChange={e=>setGoalForm(p=>({...p,status:e.target.value}))} className="text-sm px-3 py-2 rounded-lg text-slate-300 outline-none" style={{background:'#0f172a',border:'1px solid #334155'}}>
                          <option value="pending">Aguardando</option>
                          <option value="current">Em andamento</option>
                          <option value="completed">Concluída</option>
                        </select>
                      </div>
                      <input placeholder="Título da meta" value={goalForm.title} onChange={e=>setGoalForm(p=>({...p,title:e.target.value}))} className="w-full text-sm px-3 py-2 rounded-lg text-white outline-none placeholder-slate-600" style={{background:'#0f172a',border:'1px solid #334155'}}/>
                      <input placeholder="Descrição (opcional)" value={goalForm.detail} onChange={e=>setGoalForm(p=>({...p,detail:e.target.value}))} className="w-full text-sm px-3 py-2 rounded-lg text-white outline-none placeholder-slate-600" style={{background:'#0f172a',border:'1px solid #334155'}}/>
                      <div className="flex gap-2">
                        <button onClick={createGoal} className="text-xs px-4 py-2 rounded-lg font-medium" style={{background:'#10b981',color:'#fff'}}>Salvar meta</button>
                        <button onClick={()=>setAddGoal(false)} className="text-xs px-4 py-2 rounded-lg text-slate-400 hover:text-white">Cancelar</button>
                      </div>
                    </div>
                  )}

                  {goals.map(g => (
                    <div key={g.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                      <div>
                        <p className="text-xs text-slate-500">{g.period}</p>
                        <p className="text-sm font-medium text-white mt-0.5">{g.title}</p>
                        {g.detail && <p className="text-xs text-slate-500 mt-0.5">{g.detail}</p>}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── ARQUIVOS (admin) ── */}
              {tab === 'Arquivos' && (
                files.length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-8">Nenhum arquivo enviado ainda.</p>
                ) : files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#1e293b', border: '1px solid #334155' }}>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {f.name.split('.').pop().toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{f.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(f.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* ─ MODAL NOVA REUNIÃO ─ */}
      {meetModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: '#1e293b', border: '1px solid #334155' }}>
            <h3 className="text-base font-semibold text-white">Nova Reunião</h3>
            <div className="space-y-3">
              <input placeholder="Título (ex: Sessão 4 — Conteúdo)" value={meetForm.title} onChange={e=>setMeetForm(p=>({...p,title:e.target.value}))} className="w-full text-sm px-3 py-2.5 rounded-lg text-white outline-none placeholder-slate-600" style={{background:'#0f172a',border:'1px solid #334155'}}/>
              <input type="datetime-local" value={meetForm.scheduled_at} onChange={e=>setMeetForm(p=>({...p,scheduled_at:e.target.value}))} className="w-full text-sm px-3 py-2.5 rounded-lg text-white outline-none" style={{background:'#0f172a',border:'1px solid #334155'}}/>
              <input placeholder="Link do Google Meet (opcional)" value={meetForm.meet_link} onChange={e=>setMeetForm(p=>({...p,meet_link:e.target.value}))} className="w-full text-sm px-3 py-2.5 rounded-lg text-white outline-none placeholder-slate-600" style={{background:'#0f172a',border:'1px solid #334155'}}/>
              <select value={meetForm.session_id} onChange={e=>setMeetForm(p=>({...p,session_id:e.target.value}))} className="w-full text-sm px-3 py-2.5 rounded-lg text-slate-300 outline-none" style={{background:'#0f172a',border:'1px solid #334155'}}>
                <option value="">Vincular a uma sessão (opcional)</option>
                {sessions.map(s=><option key={s.id} value={s.id}>Sessão {s.session_number}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={createMeeting} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{background:'#10b981',color:'#fff'}}>Criar reunião</button>
              <button onClick={()=>setMeetModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white transition" style={{border:'1px solid #334155'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
