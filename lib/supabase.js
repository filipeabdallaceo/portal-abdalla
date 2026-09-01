'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const createClient = () => createClientComponentClient()

export const SESSION_DATA = [
  { number: 1, title: 'Raio-X de Autoridade',              desc: 'Diagnóstico de gargalos e teto de faturamento atual' },
  { number: 2, title: 'Modelo de Atendimento de Elite',    desc: 'Estruturar planos de tratamento e aumentar retenção' },
  { number: 3, title: 'Psicologia da Venda Clínica',       desc: 'Fechamento de alto valor e redução de objeções' },
  { number: 4, title: 'Estratégia de Conteúdo e Demanda',  desc: 'Transformar ciência em autoridade digital' },
  { number: 5, title: 'Gestão de Liderança e Equipe',      desc: 'Treinar e delegar — clínica sem dependência do dono' },
  { number: 6, title: 'Indicadores e Tomada de Decisão',   desc: 'KPIs para decidir onde investir ou cortar' },
  { number: 7, title: 'Blindagem de Negócio',              desc: 'Governança, riscos sindicais e segurança administrativa' },
  { number: 8, title: 'O Próximo Nível',                   desc: 'Plano de carreira para os 12 meses seguintes' },
]

export const TOTAL_SESSIONS = SESSION_DATA.length

export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  const initials = parts.slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return initials || '?'
}

// Converte o valor vindo do banco em Date.
// Colunas do tipo `date` chegam como 'YYYY-MM-DD'; se passarmos direto para
// new Date() o JS interpreta como meia-noite UTC e no Brasil vira o dia anterior.
export function parseDate(value) {
  if (!value) return null
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function formatDate(value) {
  const d = parseDate(value)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(value) {
  const d = parseDate(value)
  if (!d) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatWeekday(value) {
  const d = parseDate(value)
  if (!d) return ''
  const w = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  return w.charAt(0).toUpperCase() + w.slice(1)
}

export function formatDateTime(value) {
  const d = parseDate(value)
  if (!d) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

// Nome seguro para o Storage do Supabase (sem acentos, espaços ou símbolos).
// O nome original continua salvo na tabela `files`.
export function safeStorageName(name) {
  const clean = String(name || 'arquivo')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+/, '')
  return (clean || 'arquivo').slice(-120)
}
