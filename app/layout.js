import './globals.css'

export const metadata = {
  title: 'Portal Mentoria — Dr. Filipe Abdalla',
  description: 'Área exclusiva para mentorados da Mentoria de Gestão & Carreira',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
