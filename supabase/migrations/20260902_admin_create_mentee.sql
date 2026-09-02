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
