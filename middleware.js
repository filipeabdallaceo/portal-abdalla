import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/portal', req.url))
  }
  return res
}

export const config = {
  // Ignora assets estáticos (ex.: /logo.png) — sem isso a logo da tela de
  // login era redirecionada para /login e não carregava.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
