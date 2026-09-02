'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import {
  SESSION_DATA, TOTAL_SESSIONS, getInitials, formatDate, formatTime, formatWeekday, parseDate, safeStorageName,
} from '../../lib/supabase'
import { LOGO_B64 } from '../../lib/logo'

const GOLD = '#c9932a'
const GOLD2 = '#e8b04a'
const NAVY = '#0a1e38'
const NAVY2 = '#112d54'
const NAVY3 = '#071526'
const BDR = 'rgba(201,147,42,.25)'
const WHATSAPP_PAOLA = 'https://wa.me/5567992076011'
const MAX_UPLOAD_MB = 50

const TABS = [
  { key: 'sessoes', label: 'Sessões' },
  { key: 'arquivos', label: 'Arquivos' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'metas', label: 'Metas' },
]

const card = { background: NAVY2, border: '1px solid ' + BDR, borderRadius: 12 }
const goldBtn = { fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(201,147,42,.3)', background: 'rgba(201,147,42,.12)', color: GOLD2, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }
const pill = {
  gold:  { background: 'rgba(201,147,42,.12)', color: GOLD2, border: '1px solid rgba(201,147,42,.3)' },
  solid: { background: GOLD, color: NAVY, border: '1px solid ' + GOLD },
  muted: { background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.4)', border: '1px solid rgba(255,255,255,.1)' },
  red:   { background: 'rgba(239,68,68,.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.3)' },
}
const pillBase = { fontSize: 11, padding: '3px 10px', borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap' }

function Pill({ tone = 'muted', children }) {
  return <span style={{ ...pillBase, ...pill[tone] }}>{children}</span>
}

function fmtBytes(b) {
  b = Number(b) || 0
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}

// Reunião já aconteceu? (status final ou horário passado há mais de 2h)
function isPastMeeting(m, now) {
  if (m.status === 'completed' || m.status === 'cancelled') return true
  const d = parseDate(m.scheduled_at)
  return d ? d.getTime() < now - 2 * 60 * 60 * 1000 : false
}

function meetingLabel(m, past) {
  if (m.status === 'cancelled') return { text: 'Cancelada', tone: 'red' }
  if (m.status === 'completed') return { text: 'Concluída', tone: 'gold' }
  if (past) return { text: 'Realizada', tone: 'muted' }
  if (m.status === 'next') return { text: 'Próxima', tone: 'solid' }
  return { text: 'Agendada', tone: 'gold' }
}

export default function PortalPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [files, setFiles] = useState([])
  const [meetings, setMeetings] = useState([])
  const [goals, setGoals] = useState([])
  const [tab, setTab] = useState('sessoes')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [openSess, setOpenSess] = useState(null)
  const [noteText, setNoteText] = useState({})
  const [savedNotes, setSavedNotes] = useState({})
  const [noteStatus, setNoteStatus] = useState({})
  const [uploading, setUploading] = useState(false)
  const [fileMsg, setFileMsg] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.replace('/login')

        const { data: prof, error: profErr } = await supabase
          .from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (profErr) throw profErr
        if (prof && prof.role === 'admin') return router.replace('/admin')
        if (cancelled) return
        if (!prof) {
          setProfile({ id: user.id, full_name: user.email || 'Mentorado', email: user.email })
          setLoadError('Seu perfil ainda não foi configurado. Fale com a Paola para liberar seus dados.')
          setLoading(false)
          return
        }

        const [sessRes, filsRes, meetRes, golsRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('mentee_id', user.id).order('session_number'),
          supabase.from('files').select('*').eq('mentee_id', user.id).order('created_at', { ascending: false }),
          supabase.from('meetings').select('*').eq('mentee_id', user.id).order('scheduled_at'),
          supabase.from('goals').select('*').eq('mentee_id', user.id).order('sort_order'),
        ])
        if (cancelled) return
        const sess = sessRes.data || []
        setProfile(prof)
        setSessions(sess)
        setFiles(filsRes.data || [])
        setMeetings(meetRes.data || [])
        setGoals(golsRes.data || [])

        const notes = {}
        sess.forEach(s => { notes[s.id] = s.notes || '' })
        setNoteText(notes)
        setSavedNotes(notes)

        // Abre automaticamente a sessão em andamento (ou a última concluída)
        const current = sess.find(s => s.status === 'current')
        const lastDone = [...sess].reverse().find(s => s.status === 'completed')
        setOpenSess((current || lastDone || {}).session_number || null)
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setLoadError('Não foi possível carregar seus dados. Atualize a página ou fale com a Paola.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  /* ── Anotações ── */
  async function saveNote(id) {
    setNoteStatus(p => ({ ...p, [id]: 'saving' }))
    const text = noteText[id] || ''
    const { error } = await supabase.from('sessions').update({ notes: text }).eq('id', id)
    if (error) {
      setNoteStatus(p => ({ ...p, [id]: 'error' }))
      return
    }
    setSavedNotes(p => ({ ...p, [id]: text }))
    setNoteStatus(p => ({ ...p, [id]: 'saved' }))
    setTimeout(() => setNoteStatus(p => (p[id] === 'saved' ? { ...p, [id]: null } : p)), 2500)
  }

  /* ── Arquivos ── */
  async function reloadFiles(menteeId) {
    const { data } = await supabase.from('files').select('*').eq('mentee_id', menteeId).order('created_at', { ascending: false })
    setFiles(data || [])
  }

  const handleUpload = useCallback(async (file) => {
    if (!file || !profile || uploading) return
    setFileMsg(null)
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setFileMsg({ type: 'error', text: `O arquivo passa de ${MAX_UPLOAD_MB} MB. Envie pela sua pasta do Drive ou fale com a Paola.` })
      return
    }
    setUploading(true)
    const path = profile.id + '/' + Date.now() + '-' + safeStorageName(file.name)
    const { error: upErr } = await supabase.storage.from('mentee-files')
      .upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (upErr) {
      console.error(upErr)
      setFileMsg({ type: 'error', text: 'Não foi possível enviar o arquivo. Tente novamente ou fale com a Paola.' })
      setUploading(false)
      return
    }
    const { error: dbErr } = await supabase.from('files').insert({
      mentee_id: profile.id, name: file.name, size: file.size, type: file.type, storage_path: path, uploaded_by: profile.id,
    })
    if (dbErr) {
      console.error(dbErr)
      setFileMsg({ type: 'error', text: 'O arquivo subiu, mas não foi registrado. Fale com a Paola.' })
    } else {
      setFileMsg({ type: 'ok', text: `"${file.name}" enviado com sucesso.` })
    }
    await reloadFiles(profile.id)
    setUploading(false)
  }, [profile, uploading])

  async function downloadFile(f) {
    setFileMsg(null)
    const { data, error } = await supabase.storage.from('mentee-files')
      .createSignedUrl(f.storage_path, 300, { download: f.name })
    if (error || !data || !data.signedUrl) {
      setFileMsg({ type: 'error', text: 'Não foi possível baixar o arquivo. Tente novamente.' })
      return
    }
    // Com "download" o navegador baixa direto, sem abrir aba e sem bloqueio de pop-up
    window.location.href = data.signedUrl
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  /* ── Derivados ── */
  const done = sessions.filter(s => s.status === 'completed').length
  const currentSess = sessions.find(s => s.status === 'current')
  const pct = Math.round((done / TOTAL_SESSIONS) * 100)
  const programStatus = done >= TOTAL_SESSIONS ? 'Concluída' : (done === 0 && !currentSess) ? 'Início' : 'Em andamento'

  const now = Date.now()
  const upcoming = meetings.filter(m => !isPastMeeting(m, now))
    .sort((a, b) => (parseDate(a.scheduled_at) || 0) - (parseDate(b.scheduled_at) || 0))
  const past = meetings.filter(m => isPastMeeting(m, now))
    .sort((a, b) => (parseDate(b.scheduled_at) || 0) - (parseDate(a.scheduled_at) || 0))
  const nextMeeting = upcoming.find(m => m.status === 'next') || upcoming[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY }}>
      <p style={{ color: GOLD2, fontSize: 14 }}>Carregando portal...</p>
    </div>
  )

  const headerMeta = [profile && profile.specialty, profile && profile.city, profile && profile.start_date && ('Início: ' + formatDate(profile.start_date))]
    .filter(Boolean).join(' · ')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: NAVY }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 20px', background: NAVY3, borderBottom: '1px solid rgba(201,147,42,.2)' }}>
        <img src={LOGO_B64} alt="Filipe Abdalla" style={{ height: 36, filter: 'brightness(0) invert(1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {profile && profile.drive_folder_url && (
            <a href={profile.drive_folder_url} target="_blank" rel="noreferrer"
              style={{ ...goldBtn, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.7)' }}>
              Minha pasta
            </a>
          )}
          <a href={WHATSAPP_PAOLA} target="_blank" rel="noreferrer" style={goldBtn}>Falar com a Paola</a>
          <button onClick={handleLogout}
            style={{ fontSize: 12, padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', fontFamily: 'inherit' }}>
            Sair
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 900, width: '100%', margin: '0 auto', padding: '24px 16px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {loadError && (
          <div style={{ borderRadius: 10, padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', fontSize: 13, color: '#fca5a5' }}>
            {loadError} <a href={WHATSAPP_PAOLA} target="_blank" rel="noreferrer" style={{ color: GOLD2 }}>Abrir WhatsApp</a>
          </div>
        )}

        {/* ── Cabeçalho do mentorado ── */}
        <div className="flex flex-col sm:flex-row sm:items-center" style={{ ...card, padding: 22, gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
            {profile && profile.photo_url
              ? <img src={profile.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,147,42,.5)', flexShrink: 0 }} />
              : <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 500, flexShrink: 0, background: 'rgba(201,147,42,.12)', border: '2px solid rgba(201,147,42,.4)', color: GOLD2 }}>
                  {getInitials(profile && profile.full_name)}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 500, color: '#fff', margin: 0 }}>{profile && profile.full_name}</h1>
              {headerMeta && <p style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', margin: '2px 0 0' }}>{headerMeta}</p>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 120px', height: 4, borderRadius: 99, background: 'rgba(255,255,255,.1)', overflow: 'hidden', maxWidth: 200 }}>
                  <div style={{ height: '100%', borderRadius: 99, background: GOLD, width: pct + '%' }} />
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>{done} de {TOTAL_SESSIONS} sessões</span>
                <Pill tone={programStatus === 'Concluída' ? 'solid' : 'gold'}>{programStatus}</Pill>
              </div>
              {nextMeeting && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', margin: '10px 0 0' }}>
                  Próximo encontro: <span style={{ color: GOLD2 }}>{formatWeekday(nextMeeting.scheduled_at)}, {formatDate(nextMeeting.scheduled_at)} às {formatTime(nextMeeting.scheduled_at)}</span>
                  {nextMeeting.meet_link && <> · <a href={nextMeeting.meet_link} target="_blank" rel="noreferrer" style={{ color: GOLD2 }}>entrar na sala</a></>}
                </p>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right" style={{ flexShrink: 0 }}>
            <p style={{ fontSize: 22, fontWeight: 500, color: GOLD2, margin: 0 }}>R$ {Number(profile && profile.investment || 0).toLocaleString('pt-BR')}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', margin: '2px 0 0', letterSpacing: '.5px' }}>INVESTIMENTO</p>
          </div>
        </div>

        {/* ── Abas ── */}
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: NAVY3, border: '1px solid rgba(201,147,42,.2)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: '8px 4px', fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit', background: tab === t.key ? GOLD : 'none', color: tab === t.key ? NAVY : 'rgba(255,255,255,.45)' }}>
              {t.label}
              {t.key === 'arquivos' && files.length > 0 && <span style={{ opacity: .7 }}> ({files.length})</span>}
              {t.key === 'calendario' && upcoming.length > 0 && <span style={{ opacity: .7 }}> ({upcoming.length})</span>}
            </button>
          ))}
        </div>

        {/* ── SESSÕES ── */}
        {tab === 'sessoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SESSION_DATA.map(sd => {
              const sess = sessions.find(s => s.session_number === sd.number)
              const st = sess ? sess.status : 'pending'
              const isOpen = openSess === sd.number
              const tone = st === 'completed' ? 'gold' : st === 'current' ? 'solid' : 'muted'
              const status = noteStatus[sess && sess.id]
              const dirty = sess ? (noteText[sess.id] || '') !== (savedNotes[sess.id] || '') : false
              return (
                <div key={sd.number} style={{ ...card, overflow: 'hidden', borderColor: st === 'current' ? 'rgba(201,147,42,.6)' : BDR }}>
                  <button type="button" onClick={() => setOpenSess(isOpen ? null : sd.number)} aria-expanded={isOpen}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', fontFamily: 'inherit', color: 'inherit' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, flexShrink: 0, ...pill[tone] }}>
                      {sd.number}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: st === 'pending' ? 'rgba(255,255,255,.5)' : '#fff', margin: 0 }}>{sd.title}</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sess && sess.session_date ? formatDate(sess.session_date) + ' · ' : ''}{sd.desc}
                      </p>
                    </div>
                    <Pill tone={tone}>{st === 'completed' ? 'Concluída' : st === 'current' ? 'Em andamento' : 'Aguardando'}</Pill>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', margin: '0 0 12px' }}>{sd.desc}</p>
                      {sess && sess.homework && (
                        <div style={{ borderRadius: 8, padding: '10px 12px', marginBottom: 12, background: NAVY3, borderLeft: '3px solid ' + GOLD }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: GOLD2, margin: '0 0 4px' }}>Tarefa da sessão</p>
                          <p style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', margin: 0, whiteSpace: 'pre-wrap' }}>{sess.homework}</p>
                        </div>
                      )}
                      {sess ? (
                        <>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '0 0 6px' }}>Minhas anotações</p>
                          <textarea value={noteText[sess.id] || ''} onChange={e => setNoteText(p => ({ ...p, [sess.id]: e.target.value }))}
                            placeholder="Registre aqui seus insights, decisões e próximos passos desta sessão..." rows={4}
                            style={{ width: '100%', fontSize: 13, color: 'rgba(255,255,255,.85)', borderRadius: 8, padding: '10px 12px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', background: NAVY3, border: '1px solid rgba(201,147,42,.2)', boxSizing: 'border-box', lineHeight: 1.5 }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => saveNote(sess.id)} disabled={!dirty || status === 'saving'}
                              style={{ ...goldBtn, opacity: (!dirty || status === 'saving') ? .5 : 1, cursor: (!dirty || status === 'saving') ? 'default' : 'pointer' }}>
                              {status === 'saving' ? 'Salvando...' : 'Salvar anotação'}
                            </button>
                            {status === 'saved' && <span style={{ fontSize: 12, color: GOLD2 }}>Anotação salva ✓</span>}
                            {status === 'error' && <span style={{ fontSize: 12, color: '#fca5a5' }}>Não foi possível salvar. Tente novamente.</span>}
                            {!status && dirty && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Alterações não salvas</span>}
                          </div>
                        </>
                      ) : (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', margin: 0 }}>Esta sessão ainda não foi iniciada. As anotações ficam disponíveis quando ela começar.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── ARQUIVOS ── */}
        {tab === 'arquivos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div role="button" tabIndex={0}
              onClick={() => !uploading && fileRef.current && fileRef.current.click()}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); fileRef.current && fileRef.current.click() } }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files && e.dataTransfer.files[0]) }}
              style={{ border: '2px dashed ' + (dragOver ? GOLD : 'rgba(201,147,42,.3)'), borderRadius: 12, padding: '36px 20px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', background: NAVY2 }}>
              <input ref={fileRef} type="file" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; handleUpload(f) }} />
              {uploading
                ? <p style={{ fontSize: 13, color: GOLD2, margin: 0 }}>Enviando arquivo...</p>
                : <>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.8)', margin: 0 }}>Toque aqui ou arraste um arquivo para enviar</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '4px 0 0' }}>PDF, Word, Excel, imagens ou vídeos · até {MAX_UPLOAD_MB} MB</p>
                </>
              }
            </div>
            {fileMsg && (
              <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: 13, ...(fileMsg.type === 'error' ? pill.red : pill.gold) }}>
                {fileMsg.text}
              </div>
            )}
            {files.length === 0
              ? <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', textAlign: 'center', margin: '8px 0' }}>Nenhum arquivo enviado ainda. Envie planilhas, relatórios ou materiais para o Dr. Filipe avaliar.</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 6px', borderRadius: 4, background: 'rgba(201,147,42,.15)', color: GOLD2, flexShrink: 0 }}>
                        {((f.name || '').includes('.') ? f.name.split('.').pop() : 'ARQ').toUpperCase().slice(0, 5)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '2px 0 0' }}>
                          {fmtBytes(f.size)} · {formatDate(f.created_at)}{f.uploaded_by && profile && f.uploaded_by !== profile.id ? ' · enviado pela mentoria' : ''}
                        </p>
                      </div>
                      <button onClick={() => downloadFile(f)} style={goldBtn}>Baixar</button>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* ── CALENDÁRIO ── */}
        {tab === 'calendario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {meetings.length === 0 && (
              <div style={{ ...card, padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', margin: 0 }}>Nenhum encontro agendado ainda.</p>
              </div>
            )}
            {meetings.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '0 0 2px', letterSpacing: '.5px' }}>PRÓXIMOS ENCONTROS</p>
                {upcoming.length === 0 && (
                  <div style={{ ...card, padding: 24, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: 0 }}>Nenhum encontro futuro agendado. Combine o próximo com a Paola.</p>
                  </div>
                )}
                {upcoming.map(m => <MeetingCard key={m.id} m={m} past={false} />)}
                {past.length > 0 && (
                  <>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '16px 0 2px', letterSpacing: '.5px' }}>ENCONTROS ANTERIORES</p>
                    {past.map(m => <MeetingCard key={m.id} m={m} past={true} />)}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── METAS ── */}
        {tab === 'metas' && (
          <div>
            {goals.length === 0
              ? <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ fontSize: 14, color: 'rgba(255,255,255,.4)', margin: 0 }}>Seu plano de metas será definido junto com o Dr. Filipe nas primeiras sessões.</p></div>
              : (
                <div style={{ position: 'relative', paddingLeft: 8 }}>
                  <div style={{ position: 'absolute', left: 24, top: 16, bottom: 16, width: 1, background: 'rgba(201,147,42,.15)' }} />
                  {goals.map(g => {
                    const gs = g.status || 'pending'
                    return (
                      <div key={g.id} style={{ display: 'flex', gap: 16, paddingBottom: 20 }}>
                        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, background: gs === 'completed' ? 'rgba(201,147,42,.15)' : gs === 'current' ? GOLD : NAVY2, border: gs === 'pending' ? '1px solid rgba(255,255,255,.1)' : gs === 'completed' ? '1px solid rgba(201,147,42,.4)' : 'none' }}>
                          {gs === 'completed'
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD2} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                            : <div style={{ width: 8, height: 8, borderRadius: '50%', background: gs === 'current' ? NAVY : 'rgba(255,255,255,.3)' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, ...card, padding: '12px 16px', borderColor: gs === 'current' ? 'rgba(201,147,42,.6)' : BDR }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: 0 }}>{g.period}</p>
                            <Pill tone={gs === 'completed' ? 'gold' : gs === 'current' ? 'solid' : 'muted'}>
                              {gs === 'completed' ? 'Concluída' : gs === 'current' ? 'Em andamento' : 'Aguardando'}
                            </Pill>
                          </div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: gs === 'pending' ? 'rgba(255,255,255,.5)' : '#fff', margin: '4px 0 0' }}>{g.title}</p>
                          {g.detail && <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', margin: '6px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{g.detail}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}

      </main>
    </div>
  )
}

function MeetingCard({ m, past }) {
  const d = parseDate(m.scheduled_at)
  const label = meetingLabel(m, past)
  const canJoin = !past && m.meet_link && m.status !== 'cancelled'
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', flexWrap: 'wrap', opacity: past ? .7 : 1, borderColor: m.status === 'next' && !past ? 'rgba(201,147,42,.6)' : BDR }}>
      <div style={{ textAlign: 'center', minWidth: 48 }}>
        <p style={{ fontSize: 24, fontWeight: 500, color: '#fff', margin: 0, lineHeight: 1 }}>{d ? String(d.getDate()).padStart(2, '0') : '—'}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', margin: '2px 0 0', textTransform: 'uppercase' }}>{d ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : ''}</p>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#fff', margin: 0 }}>{m.title}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', margin: '2px 0 0' }}>
          {d ? `${formatWeekday(m.scheduled_at)} · ${formatTime(m.scheduled_at)}` : 'Data a confirmar'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Pill tone={label.tone}>{label.text}</Pill>
        {canJoin && (
          <a href={m.meet_link} target="_blank" rel="noreferrer" style={{ ...goldBtn, ...(m.status === 'next' ? pill.solid : {}) }}>Entrar na sala</a>
        )}
      </div>
    </div>
  )
}
