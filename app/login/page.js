'use client'
import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    router.push(profile?.role === 'admin' ? '/admin' : '/portal')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'linear-gradient(135deg,#0f172a 60%,#0d2b1f)' }}>
      <div className="w-full max-w-md fade-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C9.4 4 4 9.4 4 16s5.4 12 12 12 12-5.4 12-12S22.6 4 16 4z" fill="rgba(16,185,129,.2)" stroke="#10b981" strokeWidth="1.5"/>
              <path d="M16 9v7l5 3" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Portal Mentoria</h1>
          <p className="text-slate-400 text-sm mt-1">Dr. Filipe Abdalla · Gestão & Carreira</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: '#1e293b', border: '1px solid #334155' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">E-mail</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition"
                style={{ background: '#0f172a', border: '1px solid #334155' }}
                onFocus={e => e.target.style.borderColor = '#10b981'}
                onBlur={e => e.target.style.borderColor = '#334155'}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Senha</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 outline-none transition"
                style={{ background: '#0f172a', border: '1px solid #334155' }}
                onFocus={e => e.target.style.borderColor = '#10b981'}
                onBlur={e => e.target.style.borderColor = '#334155'}
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              style={{ background: '#10b981', color: '#fff' }}
              onMouseEnter={e => !loading && (e.target.style.background = '#059669')}
              onMouseLeave={e => e.target.style.background = '#10b981'}
            >
              {loading ? 'Entrando...' : 'Entrar no Portal'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Acesso exclusivo para mentorados · Problemas? fale com a Paola
        </p>
      </div>
    </div>
  )
}
