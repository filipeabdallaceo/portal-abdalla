'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { SESSION_DATA, getInitials, formatDate } from '../../lib/supabase'
import { LOGO_B64 } from '../../lib/logo'

const GOLD = '#c9932a'
const GOLD2 = '#e8b04a'
const NAVY = '#0a1e38'
const NAVY2 = '#112d54'
const BDR = 'rgba(201,147,42,.25)'
const TABS = ['Sessoes','Arquivos','Calendario','Metas']
const TLABELS = {'Sessoes':'Sessões','Arquivos':'Arquivos','Calendario':'Calendário','Metas':'Metas'}

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
      const n = {}
      ;(sess || []).forEach(s => { n[s.id] = s.notes || '' })
      setNoteText(n)
      setLoading(false)
    }
    load()
  }, [])

  async function saveNote(id) {
    await supabase.from('sessions').update({ notes: noteText[id] }).eq('id', id)
    alert('Anotação salva!')
  }

  const handleUpload = useCallback(async (file) => {
    if (!file || !profile) return
    setUploading(true)
    const path = profile.id + '/' + Date.now() + '-' + file.name
    const { error: e } = await supabase.storage.from('mentee-files').upload(path, file)
    if (e) { alert('Erro no upload.'); setUploading(false); return }
    await supabase.from('files').insert({ mentee_id: profile.id, name: file.name, size: file.size, type: file.type, storage_path: path, uploaded_by: profile.id })
    const { data: f2 } = await supabase.from('files').select('*').eq('mentee_id', profile.id).order('created_at', { ascending: false })
    setFiles(f2 || [])
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

  const done = sessions.filter(s => s.status === 'completed').length
  const pct = sessions.length ? Math.round((done / 8) * 100) : 0

  function fmtB(b) {
    b = b || 0
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY }}>
      <p style={{ color: GOLD2, fontSize: 14 }}>Carregando portal...</p>
    </div>
  )

  const card = { background: NAVY2, border: '1px solid ' + BDR, borderRadius: 12 }
  const badge = { background: 'rgba(201,147,42,.15)', color: GOLD2, border: '1px solid rgba(201,147,42,.35)', fontSize: 11, padding: '3px 10px', borderRadius: 99 }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: NAVY }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#071526', borderBottom: '1px solid rgba(201,147,42,.2)' }}>
        <img src={LOGO_B64} alt="Filipe Abdalla" style={{ height: 36, filter: 'brightness(0) invert(1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {profile && profile.drive_folder_url && (
            <a href={profile.drive_folder_url} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.7)', textDecoration: 'none' }}>
              Minha pasta
            </a>
          )}
          <a href="https://wa.me/5521999999999" target="_blank" rel="noreferrer"
            style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, background: 'rgba(201,147,42,.12)', border: '1px solid rgba(201,147,42,.3)', color: GOLD2, textDecoration: 'none' }}>
            Falar com a Paola
          </a>
          <button onClick={handleLogout}
            style={{ fontSize: 12, padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)' }}>
            Sair
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 900, width: '100%', margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ ...card, padding: 24, display: 'flex', alignItems: 'center', gap: 20, overflow: 'hidden', position: 'relative' }}>
          {profile && profile.photo_url
            ? <img src={profile.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,147,42,.5)', flexShrink: 0 }} />
            : <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 500, flexShrink: 0, background: 'rgba(201,147,42,.12)', border: '2px solid rgba(201,147,42,.4)', color: GOLD2 }}>{getInitials(profile && profile.full_name)}</div>
          }
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: 0 }}>{profile && profile.full_name}</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', margin: '2px 0 12px' }}>
              {profile && profile.specialty && profile.specialty + ' · '}
              {profile && profile.city && profile.city + ' · '}
              Início: {formatDate(profile && profile.start_date)}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.1)', overflow: 'hidden', maxWidth: 200 }}>
                <div style={{ height: '100%', borderRadius: 99, background: GOLD, width: pct + '%' }} />
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{done} de 8 sessões</span>
              <span style={badge}>Em andamento</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 22, fontWeight: 500, color: GOLD2, margin: 0 }}>R$ {Number(profile && profile.investment || 0).toLocaleString('pt-BR')}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '2px 0 0' }}>INVESTIMENTO</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#071526', border: '1px solid rgba(201,147,42,.2)' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px', fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 500, background: tab === t ? GOLD : 'none', color: tab === t ? NAVY : 'rgba(255,255,255,.45)' }}>
              {TLABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'Sessoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SESSION_DATA.map(sd => {
              const sess = sessions.find(s => s.session_number === sd.number)
              const st = sess ? sess.status : 'pending'
              const isOpen = openSess === sd.number
              const ns = st === 'completed'
                ? { background: 'rgba(201,147,42,.15)', color: GOLD2, border: '1px solid rgba(201,147,42,.4)' }
                : st === 'current' ? { background: GOLD, color: NAVY }
                : { background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.1)' }
              return (
                <div key={sd.number} style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}
                    onClick={() => setOpenSess(isOpen ? null : sd.number)}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0, ...ns }}>
                      {sd.number}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: st === 'pending' ? 'rgba(255,255,255,.5)' : '#fff', margin: 0 }}>{sd.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sd.desc}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, flexShrink: 0, ...(st === 'completed' ? { background: 'rgba(201,147,42,.12)', color: GOLD2, border: '1px solid rgba(201,147,42,.3)' } : st === 'current' ? { background: GOLD, color: NAVY } : { background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.1)' }) }}>
                      {st === 'completed' ? 'Concluída' : st === 'current' ? 'Em andamento' : 'Aguardando'}
                    </span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                      {sess && sess.homework && (
                        <div style={{ borderRadius: 8, padding: '10px 12px', marginBottom: 12, background: '#071526', borderLeft: '3px solid ' + GOLD }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: GOLD2, margin: '0 0 4px' }}>Tarefa da sessão</p>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', margin: 0 }}>{sess.homework}</p>
                        </div>
                      )}
                      {sess ? (
                        <>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '0 0 6px' }}>Anotações</p>
                          <textarea value={noteText[sess.id] || ''} onChange={e => setNoteText(p => ({ ...p, [sess.id]: e.target.value }))}
                            placeholder="Adicione suas anotações desta sessão..." rows={3}
                            style={{ width: '100%', fontSize: 13, color: 'rgba(255,255,255,.8)', borderRadius: 8, padding: '10px 12px', resize: 'none', outline: 'none', fontFamily: 'inherit', background: '#071526', border: '1px solid rgba(201,147,42,.2)', boxSizing: 'border-box' }} />
                          <button onClick={() => saveNote(sess.id)}
                            style={{ marginTop: 8, fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(201,147,42,.3)', background: 'rgba(201,147,42,.12)', color: GOLD2, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Salvar anotação
                          </button>
                        </>
                      ) : (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Esta sessão ainda não foi iniciada.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'Arquivos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div onClick={() => fileRef.current && fileRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
              style={{ border: '2px dashed ' + (dragOver ? GOLD : 'rgba(201,147,42,.3)'), borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: NAVY2 }}>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
              {uploading
                ? <p style={{ fontSize: 13, color: GOLD2 }}>Enviando arquivo...</p>
                : <>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.8)', margin: 0 }}>Arraste ou clique para enviar</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 4 }}>PDF, DOCX, XLSX, MP4</p>
                </>
              }
            </div>
            {files.length === 0
              ? <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>Nenhum arquivo enviado ainda.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map(f => (
                    <div key={f.id} onClick={() => downloadFile(f)}
                      style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 6px', borderRadius: 4, background: 'rgba(201,147,42,.15)', color: GOLD2 }}>{(f.name || '').split('.').pop().toUpperCase()}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '2px 0 0' }}>{fmtB(f.size)} · {formatDate(f.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {tab === 'Calendario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meetings.length === 0
              ? <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', margin: 0 }}>Nenhuma reunião agendada ainda.</p></div>
              : meetings.map(m => {
                const d = m.scheduled_at ? new Date(m.scheduled_at) : null
                return (
                  <div key={m.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 20, padding: '14px 20px' }}>
                    <div style={{ textAlign: 'center', minWidth: 52 }}>
                      <p style={{ fontSize: 24, fontWeight: 500, color: '#fff', margin: 0, lineHeight: 1 }}>{d ? d.getDate().toString().padStart(2, '0') : '-'}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '2px 0 0', textTransform: 'uppercase' }}>{d ? d.toLocaleDateString('pt-BR', { month: 'short' }) : ''}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: '#fff', margin: 0 }}>{m.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '2px 0 0' }}>{d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </div>
                    <span style={badge}>{m.status === 'next' ? 'Próxima' : m.status === 'completed' ? 'Concluída' : 'Agendada'}</span>
                    {m.meet_link && m.status !== 'completed' && (
                      <a href={m.meet_link} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, background: 'rgba(201,147,42,.12)', border: '1px solid rgba(201,147,42,.3)', color: GOLD2, textDecoration: 'none' }}>
                        Entrar
                      </a>
                    )}
                  </div>
                )
              })
            }
          </div>
        )}

        {tab === 'Metas' && (
          <div>
            {goals.length === 0
              ? <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', margin: 0 }}>Plano de metas ainda não definido.</p></div>
              : (
                <div style={{ position: 'relative', paddingLeft: 8 }}>
                  <div style={{ position: 'absolute', left: 24, top: 16, bottom: 16, width: 1, background: 'rgba(201,147,42,.15)' }} />
                  {goals.map(g => (
                    <div key={g.id} style={{ display: 'flex', gap: 16, paddingBottom: 20 }}>
                      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, background: g.status === 'completed' ? 'rgba(201,147,42,.15)' : g.status === 'current' ? GOLD : 'rgba(255,255,255,.05)', color: g.status === 'completed' ? GOLD2 : g.status === 'current' ? NAVY : 'rgba(255,255,255,.3)', border: g.status === 'pending' ? '1px solid rgba(255,255,255,.1)' : 'none' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.status === 'completed' ? GOLD2 : g.status === 'current' ? '#fff' : 'rgba(255,255,255,.3)' }} />
                      </div>
                      <div style={{ flex: 1, ...card, padding: '12px 16px' }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '0 0 2px' }}>{g.period}</p>
                        <p style={{ fontSize: 14, fontWeight: 500, color: g.status === 'pending' ? 'rgba(255,255,255,.5)' : '#fff', margin: 0 }}>{g.title}</p>
                        {g.detail && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '4px 0 0' }}>{g.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

      </main>
    </div>
  )
}
