-- FlowFit: provisionamento persistente de profiles apos qualquer login.
--
-- Migration incremental e idempotente. Nao apaga contas ou cadastros.
-- Rode o arquivo inteiro no SQL Editor depois de update-student-access.sql.

begin;

create or replace function public.ensure_own_profile(
  p_requested_role text,
  p_name text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_role text := lower(trim(coalesce(p_requested_role, '')));
  v_email text;
  v_metadata jsonb;
  v_name text;
  v_profile public.profiles%rowtype;
begin
  if v_user_id is null then
    raise exception 'profile_requires_authenticated_user';
  end if;

  -- Admin nunca e criado por uma chamada do navegador.
  if v_requested_role not in ('student', 'coach') then
    raise exception 'profile_role_not_allowed';
  end if;

  if v_requested_role = 'student' and not exists (
    select 1
      from public.students s
     where s.student_user_id = v_user_id
  ) then
    raise exception 'student_access_not_authorized';
  end if;

  select lower(trim(coalesce(u.email, ''))), coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_metadata
    from auth.users u
   where u.id = v_user_id;

  if not found then
    raise exception 'authenticated_user_not_found';
  end if;

  v_name := coalesce(
    nullif(trim(coalesce(p_name, '')), ''),
    nullif(trim(coalesce(v_metadata ->> 'display_name', '')), ''),
    nullif(trim(coalesce(v_metadata ->> 'full_name', '')), ''),
    nullif(trim(coalesce(v_metadata ->> 'name', '')), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Usuario'
  );

  -- O upsert resolve callbacks/abas concorrentes. Uma identidade preserva seu
  -- maior papel; student -> coach e permitido, mas sempre nasce pending.
  insert into public.profiles as current_profile (
    user_id,
    role,
    name,
    coach_status,
    updated_at
  )
  values (
    v_user_id,
    v_requested_role,
    v_name,
    'pending',
    now()
  )
  on conflict (user_id) do update
    set role = case
          when public.role_rank(excluded.role) > public.role_rank(current_profile.role)
            then excluded.role
          else current_profile.role
        end,
        coach_status = case
          when current_profile.role = 'student' and excluded.role = 'coach'
            then 'pending'
          else current_profile.coach_status
        end,
        name = case
          when trim(coalesce(current_profile.name, '')) = '' then excluded.name
          else current_profile.name
        end,
        updated_at = case
          when public.role_rank(excluded.role) > public.role_rank(current_profile.role)
            or trim(coalesce(current_profile.name, '')) = ''
            then now()
          else current_profile.updated_at
        end
  returning * into v_profile;

  return v_profile;
end;
$$;

-- Mantem o gate do aluno: o profile so e provisionado depois que um vinculo
-- valido por token/email foi confirmado dentro da mesma transacao.
create or replace function public.claim_student_access(p_token text default null)
returns table (student_id text, coach_id text, access_method text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_token_student public.students%rowtype;
  v_profile_role text;
  v_profile_name text;
  v_access_count integer := 0;
begin
  if v_user_id is null or v_user_email = '' then
    raise exception 'student_access_requires_authenticated_email';
  end if;

  select p.role into v_profile_role
    from public.profiles p
   where p.user_id = v_user_id;

  if v_profile_role is not null and public.role_rank(v_profile_role) < public.role_rank('student') then
    raise exception 'account_has_different_role';
  end if;

  if trim(coalesce(p_token, '')) <> '' then
    select s.* into v_token_student
      from public.students s
     where s.invite_token::text = trim(p_token)
     for update;

    if not found then raise exception 'invite_not_found'; end if;
    if v_token_student.invite_status = 'revoked' then raise exception 'invite_revoked'; end if;
    if v_token_student.invite_status = 'pending' and v_token_student.invite_expires_at <= now() then
      raise exception 'invite_expired';
    end if;
    if v_token_student.student_user_id is not null and v_token_student.student_user_id <> v_user_id then
      raise exception 'invite_already_claimed';
    end if;
    if trim(coalesce(v_token_student.email, '')) <> ''
       and lower(trim(v_token_student.email)) <> v_user_email then
      raise exception 'invite_email_mismatch';
    end if;

    update public.students
       set email = case when trim(coalesce(email, '')) = '' then v_user_email else lower(trim(email)) end,
           student_user_id = v_user_id,
           invite_status = 'accepted',
           invite_claimed_at = coalesce(invite_claimed_at, now()),
           updated_at = now()
     where id = v_token_student.id;
  end if;

  update public.students
     set student_user_id = v_user_id,
         invite_status = 'accepted',
         invite_claimed_at = coalesce(invite_claimed_at, now()),
         updated_at = now()
   where lower(trim(coalesce(email, ''))) = v_user_email
     and (student_user_id is null or student_user_id = v_user_id);

  select count(*) into v_access_count
    from public.students s
   where s.student_user_id = v_user_id;

  if v_access_count = 0 then
    raise exception 'student_access_not_authorized';
  end if;

  select s.name into v_profile_name
    from public.students s
   where s.student_user_id = v_user_id
   order by s.updated_at desc
   limit 1;

  perform public.ensure_own_profile('student', v_profile_name);

  return query
  select s.id,
         s.coach_id,
         case when trim(coalesce(p_token, '')) <> '' and s.id = v_token_student.id then 'invite' else 'email' end
    from public.students s
   where s.student_user_id = v_user_id
   order by s.updated_at desc;
end;
$$;

revoke all on function public.ensure_own_profile(text, text) from public, anon, authenticated;
revoke all on function public.claim_student_access(text) from public, anon, authenticated;
grant execute on function public.ensure_own_profile(text, text) to authenticated;
grant execute on function public.claim_student_access(text) to authenticated;

commit;

select
  'provision-auth-profiles-ok' as migration,
  count(*) filter (where p.user_id is null) as auth_users_still_without_profile,
  count(*) filter (where p.role = 'student') as student_profiles,
  count(*) filter (where p.role = 'coach') as coach_profiles,
  count(*) filter (where p.role = 'admin') as admin_profiles
from auth.users u
left join public.profiles p on p.user_id = u.id;
