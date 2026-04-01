'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { SESSION_DATA, getInitials, formatDate } from '../../lib/supabase'
import { LOGO_B64 } from '../../lib/logo'

const Icon = {
  sessions: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>,
  files:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  goals:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  logout:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  upload:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  check:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  wpp:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
}

const TABS = ['Sessoes', 'Arquivos', 'Calendario', 'Metas']
const TAB_LABELS = { 'Sessoes': 'Sessões', 'Arquivos': 'Arquivos', 'Calendario': 'Calendário', 'Metas': 'Metas' }

const GOLD = '#c9932a'
const GOLD2 = '#e8b04a'
const NAVY = '#0a1e38'
const NAVY2 = '#112d54'
const BORDER_GOLD = 'rgba(201,147,42,.25)'

export default function PortalPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [files, setFiles] = useState([])
  const [meetings, setMeetings] = useState([])
  const [goals, setGoals] = useState([])
  const [tab, setTab] = useState('Sessoes')
  const [loading, setLoading] = useState(true)
  const [openSess, setOpenSess] = useState(null)
  const [noteText, setNoteText] = useState({})
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

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

  async function saveNote(sessionId) {
    await supabase.from('sessions').update({ notes: noteText[sessionId] }).eq('id', sessionId)
    alert('Anotacao salva!')
  }

  const handleUpload = useCallback(async (file) => {
    if (!file || !profile) return
    setUploading(true)
    const path = profile.id + '/' + Date.now() + '-' + file.name
    const { error: upErr } = await supabase.storage.from('mentee-files').upload(path, file)
    if (upErr) { alert('Erro no upload.'); setUploading(false); return }
    await supabase.from('files').insert({ mentee_id: profile.id, name: file.name, size: file.size, type: file.type, storage_path: path, uploaded_by: profile.id })
    const { data: fils } = await supabase.from('files').select('*').eq('mentee_id', profile.id).order('created_at', { ascending: false })
    setFiles(fils || [])
    setUploading(false)
  }, [profile])

  async function downloadFile(f) {
    const { data } = await supabase.storage.from('mentee-files').createSignedUrl(f.storage_path, 60)
    if (data && data.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const completedCount = sessions.filter(s => s.status === 'completed').length
  const progressPct = sessions.length ? Math.round((completedCount / 8) * 100) : 0

  function formatBytes(bytes) {
    bytes = bytes || 0
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background: NAVY }}>
      <div style={{ color: GOLD2, fontSize:13 }} className="animate-pulse">Carregando portal...</div>
    </div>
  )

  const cardStyle = { background: NAVY2, border: '1px solid ' + BORDER_GOLD, borderRadius:12 }
  const badgeGold = { background:'rgba(201,147,42,.15)', color: GOLD2, border:'1px solid rgba(201,147,42,.35)', fontSize:11, padding:'3px 10px', borderRadius:99 }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background: NAVY }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', background:'#071526', borderBottom:'1px solid rgba(201,147,42,.2)' }}>
        <img src={LOGO_B64} alt="Filipe Abdalla" style={{ height:36, filter:'brightness(0) invert(1)' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {profile && profile.drive_folder_url && (
            <a href={profile.drive_folder_url} target="_blank" rel="noreferrer"
               style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.15)', color:'rgba(255,255,255,.7)', textDecoration:'none' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
              Minha pasta
            </a>
          )}
          <a href="https://wa.me/5521999999999" target="_blank" rel="noreferrer"
             style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, padding:'6px 12px', borderRadius:8, background:'rgba(201,147,42,.12)', border:'1px solid rgba(201,147,42,.3)', color: GOLD2, textDecoration:'none' }}>
            {Icon.wpp} Falar com a Paola
          </a>
          <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, padding:'6px 8px', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,.4)' }}>
            {Icon.logout} Sair
          </button>
        </div>
      </header>

      <main style={{ flex:1, maxWidth:900, width:'100%', margin:'0 auto', padding:'32px 16px', display:'flex', flexDirection:'column', gap:20 }}>
        <div style={{ ...cardStyle, padding:24, display:'flex', alignItems:'center', gap:20, position:'relative', overflow:'hidden' }}>
          <svg style={{ position:'absolute', right:0, top:0, bottom:0, width:200, opacity:.1, pointerEvents:'none' }} viewBox="0 0 200 100">
            <line x1="200" y1="0" x2="60" y2="100" stroke={GOLD} strokeWidth="1"/>
            <line x1="200" y1="30" x2="100" y2="100" stroke={GOLD} strokeWidth="1"/>
          </svg>
          {profile && profile.photo_url ? (
            <img src={profile.photo_url} alt={profile.full_name} style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(201,147,42,.5)', flexShrink:0, zIndex:1 }}/>
          ) : (
            <div style={{ width:64, height:64, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:500, flexShrink:0, zIndex:1, background:'rgba(201,147,42,.12)', border:'2px solid rgba(201,147,42,.4)', color: GOLD2 }}>
              {getInitials(profile && profile.full_name)}
            </div>
          )}
          <div style={{ flex:1, zIndex:1 }}>
            <h1 style={{ fontSize:20, fontWeight:500, color:'#fff', margin:0 }}>{profile && profile.full_name}</h1>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.5)', margin:'2px 0 12px' }}>
              {profile && profile.specialty && profile.specialty + ' · '}
              {profile && profile.city && profile.city + ' · '}
              Inicio: {formatDate(profile && profile.start_date)}
            </p>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1, height:4, borderRadius:99, background:'rgba(255,255,255,.1)', overflow:'hidden', maxWidth:200 }}>
                <div style={{ height:'100%', borderRadius:99, background: GOLD, width: progressPct + '%' }}/>
              </div>
              <span style={{ fontSize:12, color:'rgba(255,255,255,.5)' }}>{completedCount} de 8 sessoes</span>
              <span style={badgeGold}>Em andamento</span>
            </div>
          </div>
          <div style={{ textAlign:'right', zIndex:1 }}>
            <p style={{ fontSize:22, fontWeight:500, color: GOLD2, margin:0 }}>R$ {Number(profile && profile.investment || 0).toLocaleString('pt-BR')}</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.35)', margin:'2px 0 0', letterSpacing:'.5px' }}>INVESTIMENTO</p>
          </div>
        </div>

        <div style={{ display:'flex', gap:4, padding:4, borderRadius:12, background:'#071526', border:'1px solid rgba(201,147,42,.2)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ display:'flex', alignItems:'center', gap:6, flex:1, justifyContent:'center', padding:'8px', fontSize:13, borderRadius:8, border:'none', cursor:'pointer', fontWeight:500, transition:'all .15s', background: tab===t ? GOLD : 'none', color: tab===t ? NAVY : 'rgba(255,255,255,.45)' }}>
              {t === 'Sessoes' && Icon.sessions}
              {t === 'Arquivos' && Icon.files}
              {t === 'Calendario' && Icon.calendar}
              {t === 'Metas' && Icon.goals}
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'Sessoes' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {SESSION_DATA.map(sd => {
              const sess = sessions.find(s => s.session_number === sd.number)
              const status = sess ? sess.status : 'pending'
              const isOpen = openSess === sd.number
              const numStyle = status === 'completed' ? { background:'rgba(201,147,42,.15)', color: GOLD2, border:'1px solid rgba(201,147,42,.4)' }
                : status === 'current' ? { background: GOLD, color: NAVY }
                : { background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.4)', border:'1px solid rgba(255,255,255,.1)' }
              return (
                <div key={sd.number} style={{ ...cardStyle, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', cursor:'pointer' }} onClick={() => setOpenSess(isOpen ? null : sd.number)}>
                    <div style={{ width:34, height:34, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:500, flexShrink:0, ...numStyle }}>
                      {status === 'completed' ? Icon.check : sd.number}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:14, fontWeight:500, color: status === 'pending' ? 'rgba(255,255,255,.5)' : '#fff', margin:0 }}>{sd.title}</p>
                      <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:'2px 0 0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sd.desc}</p>
                    </div>
                    <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, flexShrink:0, ...(status === 'completed' ? { background:'rgba(201,147,42,.12)', color: GOLD2, border:'1px solid rgba(201,147,42,.3)' } : status === 'current' ? { background: GOLD, color: NAVY } : { background:'rgba(255,255,255,.05)', color:'rgba(255,255,255,.4)', border:'1px solid rgba(255,255,255,.1)' }) }}>
                      {status === 'completed' ? 'Concluida' : status === 'current' ? 'Em andamento' : 'Aguardando'}
                    </span>
                  </div>
                  {isOpen && (
                    <div style={{ padding:'14px 16px', borderTop:'1px solid rgba(255,255,255,.06)' }}>
                      {sess && sess.homework && (
                        <div style={{ borderRadius:8, padding:'10px 12px', marginBottom:12, background:'#071526', borderLeft:'3px solid ' + GOLD }}>
                          <p style={{ fontSize:12, fontWeight:500, color: GOLD2, margin:'0 0 4px' }}>Tarefa da sessao</p>
                          <p style={{ fontSize:13, color:'rgba(255,255,255,.7)', margin:0 }}>{sess.homework}</p>
                        </div>
                      )}
                      {sess ? (
                        <>
                          <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:'0 0 6px' }}>Anotacoes</p>
                          <textarea value={noteText[sess.id] || ''} onChange={e => setNoteText(p => ({ ...p, [sess.id]: e.target.value }))}
                            placeholder="Adicione suas anotacoes desta sessao..." rows={3}
                            style={{ width:'100%', fontSize:13, color:'rgba(255,255,255,.8)', borderRadius:8, padding:'10px 12px', resize:'none', outline:'none', fontFamily:'inherit', background:'#071526', border:'1px solid rgba(201,147,42,.2)', boxSizing:'border-box' }}/>
                          <button onClick={() => saveNote(sess.id)} style={{ marginTop:8, fontSize:12, padding:'6px 14px', borderRadius:8, border:'1px solid rgba(201,147,42,.3)', background:'rgba(201,147,42,.12)', color: GOLD2, cursor:'pointer', fontFamily:'inherit' }}>
                            Salvar anotacao
                          </button>
                        </>
                      ) : (
                        <p style={{ fontSize:12, color:'rgba(255,255,255,.3)' }}>Esta sessao ainda nao foi iniciada.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'Arquivos' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div onClick={() => fileRef.current && fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
              style={{ border: '2px dashed ' + (dragOver ? GOLD : 'rgba(201,147,42,.3)'), borderRadius:12, padding:40, textAlign:'center', cursor:'pointer', background: dragOver ? 'rgba(201,147,42,.05)' : NAVY2 }}>
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={e => handleUpload(e.target.files[0])}/>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:12, color:'rgba(255,255,255,.4)' }}>{Icon.upload}</div>
              {uploading ? <p style={{ fontSize:13, color: GOLD2 }} className="animate-pulse">Enviando arquivo...</p> : (
                <>
                  <p style={{ fontSize:14, fontWeight:500, color:'rgba(255,255,255,.8)', margin:0 }}>Arraste um arquivo ou clique para enviar</p>
                  <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:4 }}>PDF, DOCX, XLSX, MP4 - max. 50 MB</p>
                </>
              )}
            </div>
            {files.length === 0 ? <p style={{ fontSize:13, color:'rgba(255,255,255,.3)', textAlign:'center' }}>Nenhum arquivo enviado ainda.</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {files.map(f => (
                  <div key={f.id} onClick={() => downloadFile(f)} style={{ ...cardStyle, display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer' }}>
                    <span style={{ fontSize:10, fontWeight:600, padding:'3px 6px', borderRadius:4, background:'rgba(201,147,42,.15)', color: GOLD2 }}>{(f.name || '').split('.').pop().toUpperCase()}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, color:'rgba(255,255,255,.85)', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</p>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,.4)', margin:'2px 0 0' }}>{formatBytes(f.size)} - {formatDate(f.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Calendario' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {meetings.length === 0 ? (
              <div style={{ ...cardStyle, padding:40, textAlign:'center' }}>
                <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:0 }}>Nenhuma reuniao agendada.</p>
                <p style={{ fontSize:12, color:'rgba(255,255,255,.25)', marginTop:4 }}>O Dr. Filipe vai adicionar os encontros em breve.</p>
              </div>
            ) : meetings.map(m => {
              const d = m.scheduled_at ? new Date(m.scheduled_at) : null
              return (
                <div key={m.id} style={{ ...cardStyle, display:'flex', alignItems:'center', gap:20, padding:'14px 20px' }}>
                  <div style={{ textAlign:'center', minWidth:52 }}>
                    <p style={{ fontSize:24, fontWeight:500, color:'#fff', margin:0, lineHeight:1 }}>{d ? d.getDate().toString().padStart(2,'0') : '-'}</p>
                    <p style={{ fontSize:11, color:'rgba(255,255,255,.4)', margin:'2px 0 0', textTransform:'uppercase' }}>{d ? d.toLocaleDateString('pt-BR', { month:'short' }) : ''}</p>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14, fontWeight:500, color:'#fff', margin:0 }}>{m.title}</p>
                    <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:'2px 0 0' }}>{d ? d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''}</p>
                  </div>
                  <span style={{ ...badgeGold, fontSize:11 }}>{m.status === 'next' ? 'Proxima' : m.status === 'completed' ? 'Concluida' : 'Agendada'}</span>
                  {m.meet_link && m.status !== 'completed' && (
                    <a href={m.meet_link} target="_blank" rel="noreferrer" style={{ fontSize:12, padding:'5px 12px', borderRadius:8, background:'rgba(201,147,42,.12)', border:'1px solid rgba(201,147,42,.3)', color: GOLD2, textDecoration:'none' }}>Entrar</a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'Metas' && (
          <div>
            {goals.length === 0 ? (
              <div style={{ ...cardStyle, padding:40, textAlign:'center' }}>
                <p style={{ fontSize:14, color:'rgba(255,255,255,.4)', margin:0 }}>Plano de metas ainda nao definido.</p>
              </div>
            ) : (
              <div style={{ position:'relative', paddingLeft:8 }}>
                <div style={{ position:'absolute', left:24, top:16, bottom:16, width:1, background:'rgba(201,147,42,.15)' }}/>
                {goals.map(g => (
                  <div key={g.id} style={{ display:'flex', gap:16, paddingBottom:20 }}>
                    <div style={{ flexShrink:0, width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1, background: g.status === 'completed' ? 'rgba(201,147,42,.15)' : g.status === 'current' ? GOLD : 'rgba(255,255,255,.05)', border: g.status === 'pending' ? '1px solid rgba(255,255,255,.1)' : 'none', color: g.status === 'completed' ? GOLD2 : g.status === 'current' ? NAVY : 'rgba(255,255,255,.3)' }}>
                      {g.status === 'completed' ? Icon.check : g.status === 'current' ? <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }}/> : <div style={{ width:8, height:8, borderRadius:'50%', background:'rgba(255,255,255,.3)' }}/>}
                    </div>
                    <div style={{ flex:1, ...cardStyle, padding:'12px 16px' }}>
                      <p style={{ fontSize:11, color:'rgba(255,255,255,.4)', margin:'0 0 2px' }}>{g.period}</p>
                      <p style={{ fontSize:14, fontWeight:500, color: g.status === 'pending' ? 'rgba(255,255,255,.5)' : '#fff', margin:0 }}>{g.title}</p>
                      {g.detail && <p style={{ fontSize:12, color:'rgba(255,255,255,.4)', margin:'4px 0 0' }}>{g.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
    }
