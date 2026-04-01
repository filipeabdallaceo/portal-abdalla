# Portal Mentoria — Dr. Filipe Abdalla
## Guia de Deploy em 15 Minutos (sem programação)

---

## ETAPA 1 — Criar conta no Supabase (banco de dados)

1. Acesse https://supabase.com
2. Clique em **"Start your project"** e entre com sua conta Google
3. Clique em **"New project"**
4. Preencha:
   - **Name:** portal-abdalla
   - **Database Password:** crie uma senha forte e **anote ela**
   - **Region:** South America (São Paulo)
5. Clique em **Create new project** e aguarde ~2 minutos

---

## ETAPA 2 — Criar o banco de dados

1. No painel do Supabase, clique em **"SQL Editor"** (ícone de código no menu lateral)
2. Clique em **"New query"**
3. Abra o arquivo `supabase/schema.sql` deste projeto
4. Copie **todo o conteúdo** e cole no editor do Supabase
5. Clique em **"Run"** (botão verde)
6. Deve aparecer "Success" — se der erro, me avise

---

## ETAPA 3 — Pegar as chaves do Supabase

1. No menu lateral do Supabase, vá em **Settings → API**
2. Copie os dois valores:
   - **Project URL** (começa com https://)
   - **anon public key** (texto longo)
3. Guarde esses valores — vamos precisar em breve

---

## ETAPA 4 — Fazer deploy no Vercel

1. Acesse https://vercel.com e entre com sua conta Google
2. Clique em **"Add New Project"**
3. Na tela seguinte, clique em **"Import Git Repository"**
   > Se não tiver GitHub, clique em **"Deploy from folder"** e arraste a pasta `portal-abdalla`
4. Clique em **Continue**
5. Antes de fazer o deploy, clique em **"Environment Variables"** e adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` → cole a Project URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → cole a anon key do Supabase
6. Clique em **"Deploy"** e aguarde ~3 minutos
7. O Vercel vai gerar um link tipo: `portal-abdalla.vercel.app`

---

## ETAPA 5 — Criar usuário Admin (você)

1. No Supabase, vá em **Authentication → Users**
2. Clique em **"Add user"** → **"Create new user"**
3. Preencha com seu e-mail e uma senha
4. Clique em **Create**
5. Agora vá em **SQL Editor** e rode este comando (substituindo o e-mail pelo seu):
```sql
UPDATE public.profiles
SET role = 'admin', full_name = 'Dr. Filipe Abdalla'
WHERE email = 'ceo@filipeabdalla.com';
```

---

## ETAPA 6 — Criar usuário para cada mentorado

Para cada um dos 4 mentorados:

1. No Supabase → **Authentication → Users → Add user**
2. Use o e-mail do mentorado e crie uma senha temporária
3. Depois de criar, rode este SQL para completar o perfil:

```sql
UPDATE public.profiles
SET
  full_name = 'Nome do Mentorado',
  specialty = 'Fisioterapeuta Empreendedora',
  city = 'São Paulo, SP',
  start_date = '2026-02-01',
  investment = 7000
WHERE email = 'email@domentorado.com';
```

4. Envie para o mentorado:
   - Link do portal: `seu-portal.vercel.app`
   - E-mail de acesso
   - Senha temporária

---

## ETAPA 7 — Apontar o domínio filipeabdalla.com (opcional)

1. No Vercel → seu projeto → **Settings → Domains**
2. Adicione: `portal.filipeabdalla.com`
3. O Vercel vai mostrar dois valores DNS (tipo CNAME)
4. Acesse o Google Domains / Google Workspace
5. Em **DNS → Custom records**, adicione os valores que o Vercel indicou
6. Aguarde até 1 hora para propagar

---

## Como usar o portal (dia a dia)

**Você (admin):**
- Acesse `portal.filipeabdalla.com` com seu e-mail/senha
- Vai abrir o **Painel Admin**
- Selecione um mentorado → edite sessões, adicione reuniões e metas

**O mentorado:**
- Acessa com o e-mail e senha que você criou para ele
- Vê somente os próprios dados
- Pode fazer upload de arquivos e salvar anotações

---

## Suporte

Se tiver qualquer dúvida em qualquer etapa, volte ao chat com Claude e descreva exatamente onde travou. Basta colar a mensagem de erro que a gente resolve.
