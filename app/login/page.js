'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { LOGO_B64 } from '../../lib/logo'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router  = useRouter()
  const supabase = createClientComponentClient()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('E-mail ou senha incorretos. Tente novamente.')
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    router.push(profile?.role === 'admin' ? '/admin' : '/portal')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
         style={{ background: '#0a1e38' }}>
      <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:.08,pointerEvents:'none' }} viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="150" x2="800" y2="400" stroke="#c9932a" strokeWidth="1"/>
        <line x1="0" y1="350" x2="600" y2="0" stroke="#c9932a" strokeWidth="1"/>
        <line x1="200" y1="600" x2="800" y2="200" stroke="#c9932a" strokeWidth="1"/>
        <line x1="400" y1="0" x2="700" y2="600" stroke="#c9932a" strokeWidth="0.6"/>
        <line x1="0" y1="500" x2="800" y2="100" stroke="#c9932a" strokeWidth="0.6"/>
      </svg>
      <div className="w-full max-w-md fade-up" style={{ zIndex:1 }}>
        <div className="rounded-2xl p-8" style={{ background:'#112d54', border:'1px solid rgba(201,147,42,.25)' }}>
          <div className="text-center mb-8">
            <img src={LOGO_B64} alt="Filipe Abdalla" style={{ height:90, margin:'0 auto 12px', filter:'brightness(0) invert(1)' }}/>
            <p style={{ fontSize:11, color:'#c9932a', letterSpacing:'1.5px', textTransform:'uppercase', marginTop:4 }}>Portal de Mentoria · Gestão e Carreira</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label style={{ display:'block', fontSize:11, color:'rgba(255,255,255,.5)', marginBottom:6, letterSpacing:'1px', textTransform:'uppercase' }}>E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition"
                style={{ background:'#0a1e38', border:'1px solid rgba(201,147,42,.25)' }}
                onFocus={e => e.target.style.borderColor = '#c9932a'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,147,42,.25)'}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, color:'rgba(255,255,255,.5)', marginBottom:6, letterSpacing:'1px', textTransform:'uppercase' }}>Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition"
                style={{ background:'#0a1e38', border:'1px solid rgba(201,147,42,.25)' }}
                onFocus={e => e.target.style.borderColor = '#c9932a'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,147,42,.25)'}/>
            </div>
            {error && (
              <div style={{ fontSize:13, color:'#f87171', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'10px 14px' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              style={{ background:'#c9932a', color:'#0a1e38', letterSpacing:'.5px' }}
              onMouseEnter={e => !loading && (e.target.style.background = '#b07d22')}
              onMouseLeave={e => e.target.style.background = '#c9932a'}>
              {loading ? 'Entrando...' : 'Entrar no Portal'}
            </button>
          </form>
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,.25)', marginTop:20 }}>
          Acesso exclusivo para mentorados · Problemas? Fale com a Paola
        </p>
      </div>
    </div>
  )
                                            }