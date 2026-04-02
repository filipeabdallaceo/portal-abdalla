'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { LOGO_B64 } from '../../lib/logo'

export default function LoginPage() {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('E-mail ou senha incorretos.'); setLoading(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    router.push(prof?.role === 'admin' ? '/admin' : '/portal')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0a1e38', position:'relative', overflow:'hidden' }}>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', opacity:.06 }} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
        <line x1="800" y1="0" x2="200" y2="600" stroke="#c9932a" strokeWidth="1"/>
        <line x1="800" y1="100" x2="350" y2="600" stroke="#c9932a" strokeWidth="1"/>
        <line x1="800" y1="250" x2="500" y2="600" stroke="#c9932a" strokeWidth="1"/>
        <line x1="0" y1="0" x2="600" y2="600" stroke="#c9932a" strokeWidth="0.5"/>
      </svg>
      <div style={{ width:'100%', maxWidth:400, padding:'0 24px', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <img src={LOGO_B64} alt="Filipe Abdalla" style={{ height:48, filter:'brightness(0) invert(1)', marginBottom:12 }}/>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0, letterSpacing:'.5px' }}>PORTAL MENTORIA · GESTÃO & CARREIRA</p>
        </div>
        <div style={{ background:'#112d54', borderRadius:16, padding:'36px 32px', border:'1px solid rgba(201,147,42,.2)', boxShadow:'0 24px 64px rgba(0,0,0,.4)' }}>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#fff', margin:'0 0 6px' }}>Bem-vindo</h2>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:'0 0 28px' }}>Acesso exclusivo para mentorados</p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'rgba(255,255,255,.5)', marginBottom:6, letterSpacing:'.5px' }}>E-MAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com"
                style={{ width:'100%', padding:'11px 14px', borderRadius:8, fontSize:14, color:'#fff', background:'rgba(255,255,255,.06)', border:'1px solid rgba(201,147,42,.2)', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:500, color:'rgba(255,255,255,.5)', marginBottom:6, letterSpacing:'.5px' }}>SENHA</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width:'100%', padding:'11px 14px', borderRadius:8, fontSize:14, color:'#fff', background:'rgba(255,255,255,.06)', border:'1px solid rgba(201,147,42,.2)', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}/>
            </div>
            {error && <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:8, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', fontSize:13, color:'#fca5a5' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'13px', borderRadius:8, fontSize:14, fontWeight:600, color:'#0a1e38', background:loading?'rgba(201,147,42,.5)':'#c9932a', border:'none', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', letterSpacing:'.3px' }}>
              {loading ? 'Entrando...' : 'Entrar no Portal'}
            </button>
          </form>
        </div>
        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'rgba(255,255,255,.25)' }}>
          Problemas? Fale com a <a href="https://wa.me/5567992076011" target="_blank" rel="noreferrer" style={{ color:'rgba(201,147,42,.6)' }}>Paola</a>
        </p>
      </div>
    </div>
  )
}