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

export function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}
