-- ============================================================
--  Portal Mentoria Abdalla — Schema Supabase
--  Execute este SQL no Supabase > SQL Editor
-- ============================================================

-- Habilita extensão UUID
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────
--  TABELA: profiles
--  Complementa auth.users com dados do mentorado
-- ─────────────────────────────────────
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  full_name     text not null,
  email         text,
  photo_url     text,
  specialty     text,
  city          text,
  whatsapp      text,
  start_date    date,
  investment    numeric(10,2) default 7000,
  payment_method text default 'à vista',
  drive_folder_url text,
  role          text not null default 'mentee' check (role in ('mentee','admin')),
  created_at    timestamptz default now()
);

-- Bancos criados antes da coluna existir: adiciona sem quebrar nada
alter table public.profiles add column if not exists drive_folder_url text;

-- ─────────────────────────────────────
--  TABELA: sessions
--  Os 8 encontros da mentoria por mentorado
-- ─────────────────────────────────────
create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  mentee_id      uuid references public.profiles(id) on delete cascade not null,
  session_number integer not null check (session_number between 1 and 8),
  title          text,
  description    text,
  status         text not null default 'pending' check (status in ('pending','current','completed')),
  session_date   date,
  notes          text,
  homework       text,
  created_at     timestamptz default now(),
  unique (mentee_id, session_number)
);

-- ─────────────────────────────────────
--  TABELA: meetings
--  Reuniões agendadas (com link do Meet)
-- ─────────────────────────────────────
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  mentee_id     uuid references public.profiles(id) on delete cascade not null,
  session_id    uuid references public.sessions(id) on delete set null,
  title         text not null,
  scheduled_at  timestamptz,
  meet_link     text,
  status        text not null default 'scheduled' check (status in ('scheduled','next','completed','cancelled')),
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────
--  TABELA: goals
--  Metas do plano de 12 meses
-- ─────────────────────────────────────
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  mentee_id  uuid references public.profiles(id) on delete cascade not null,
  period     text,
  title      text not null,
  detail     text,
  status     text not null default 'pending' check (status in ('pending','current','completed')),
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────
--  TABELA: files
--  Metadados dos arquivos (binário fica no Storage)
-- ─────────────────────────────────────
create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  mentee_id     uuid references public.profiles(id) on delete cascade not null,
  name          text not null,
  size          bigint default 0,
  type          text,
  storage_path  text not null,
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz default now()
);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--  Cada mentorado vê SOMENTE seus próprios dados.
--  Admin vê TUDO.
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.sessions  enable row level security;
alter table public.meetings  enable row level security;
alter table public.goals     enable row level security;
alter table public.files     enable row level security;

-- Função auxiliar: verifica se o usuário logado é admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles
create policy "Mentorado vê próprio perfil" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "Mentorado edita próprio perfil" on public.profiles
  for update using (auth.uid() = id or public.is_admin());
create policy "Admin insere perfis" on public.profiles
  for insert with check (public.is_admin() or auth.uid() = id);

-- sessions
create policy "Acesso sessions" on public.sessions
  for all using (mentee_id = auth.uid() or public.is_admin());

-- meetings
create policy "Acesso meetings" on public.meetings
  for all using (mentee_id = auth.uid() or public.is_admin());

-- goals
create policy "Acesso goals" on public.goals
  for all using (mentee_id = auth.uid() or public.is_admin());

-- files
create policy "Acesso files" on public.files
  for all using (mentee_id = auth.uid() or public.is_admin());

-- ============================================================
--  STORAGE: Bucket para arquivos dos mentorados
-- ============================================================
insert into storage.buckets (id, name, public)
values ('mentee-files', 'mentee-files', false)
on conflict do nothing;

create policy "Upload próprio arquivo" on storage.objects
  for insert with check (
    bucket_id = 'mentee-files' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "Download próprio arquivo" on storage.objects
  for select using (
    bucket_id = 'mentee-files' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- Excluir arquivo (mentorado apaga só o que está na própria pasta; admin apaga qualquer um)
drop policy if exists "Excluir próprio arquivo" on storage.objects;
create policy "Excluir próprio arquivo" on storage.objects
  for delete using (
    bucket_id = 'mentee-files' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- ============================================================
--  TRIGGER: Cria perfil automaticamente após signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
--  FUNÇÕES DE ADMIN: cadastrar mentorado e redefinir senha pelo painel
--  (conteúdo em supabase/migrations/20260902_admin_create_mentee.sql)
-- ============================================================
-- ============================================================
--  Funções de administração de mentorados
--  Permite que o ADMIN cadastre um mentorado (usuário + senha + perfil)
--  e redefina a senha de um mentorado direto pelo painel.
--  Só executa se quem chama for admin (public.is_admin()).
-- ============================================================

create or replace function public.admin_create_mentee(
  p_email            text,
  p_password         text,
  p_full_name        text,
  p_specialty        text    default null,
  p_city             text    default null,
  p_whatsapp         text    default null,
  p_start_date       date    default null,
  p_investment       numeric default 7000,
  p_drive_folder_url text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id    uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem cadastrar mentorados';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres';
  end if;
  if length(coalesce(trim(p_full_name), '')) < 2 then
    raise exception 'Informe o nome do mentorado';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Já existe um usuário com o e-mail %', v_email;
  end if;

  v_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
    is_sso_user, is_anonymous, email_change_confirm_status
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('email_verified', true, 'full_name', trim(p_full_name)),
    now(), now(),
    '', '', '', '', '',
    false, false, 0
  );

  insert into auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, 'email', v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );

  -- O trigger on_auth_user_created já cria o perfil; aqui completamos os dados
  insert into public.profiles (id, email, full_name, specialty, city, whatsapp, start_date, investment, drive_folder_url, role)
  values (v_id, v_email, trim(p_full_name), p_specialty, p_city, p_whatsapp, p_start_date, coalesce(p_investment, 7000), p_drive_folder_url, 'mentee')
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    specialty = excluded.specialty,
    city = excluded.city,
    whatsapp = excluded.whatsapp,
    start_date = excluded.start_date,
    investment = excluded.investment,
    drive_folder_url = excluded.drive_folder_url,
    role = 'mentee';

  return v_id;
end;
$$;

create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem redefinir senhas';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

revoke all on function public.admin_create_mentee(text, text, text, text, text, text, date, numeric, text) from public;
grant execute on function public.admin_create_mentee(text, text, text, text, text, text, date, numeric, text) to authenticated;
revoke all on function public.admin_set_password(uuid, text) from public;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
