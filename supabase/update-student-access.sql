-- FlowFit: migracao incremental de acesso unificado, publicacao atomica e
-- leitura do personal vinculado. Nao apaga nem recria dados existentes.
-- Rode este arquivo inteiro no SQL Editor do mesmo projeto usado pelo app.

alter table public.workout_exercises
  add column if not exists instructions text not null default '',
  add column if not exists media_url text not null default '',
  add column if not exists media_type text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_exercises_media_url_https_check'
      and conrelid = 'public.workout_exercises'::regclass
  ) then
    alter table public.workout_exercises
      add constraint workout_exercises_media_url_https_check
      check (media_url = '' or media_url ~* '^https://');
  end if;

  alter table public.workout_exercises
    drop constraint if exists workout_exercises_media_type_check;
  alter table public.workout_exercises
    add constraint workout_exercises_media_type_check
    check (media_type in ('none', 'image', 'gif', 'video', 'youtube', 'external'));
end
$$;

drop index if exists public.students_coach_email_unique_idx;
create unique index students_coach_email_unique_idx
  on public.students (coach_id, lower(trim(email)))
  where email is not null and trim(email) <> '';

create or replace function public.role_rank(p_role text)
returns integer
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case lower(trim(coalesce(p_role, '')))
    when 'admin' then 3
    when 'coach' then 2
    when 'student' then 1
    else 0
  end;
$$;

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
  if v_user_id is null then raise exception 'profile_requires_authenticated_user'; end if;
  if v_requested_role not in ('student', 'coach') then raise exception 'profile_role_not_allowed'; end if;
  if v_requested_role = 'student' and not exists (
    select 1 from public.students s where s.student_user_id = v_user_id
  ) then
    raise exception 'student_access_not_authorized';
  end if;

  select lower(trim(coalesce(u.email, ''))), coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_email, v_metadata
    from auth.users u
   where u.id = v_user_id;
  if not found then raise exception 'authenticated_user_not_found'; end if;

  v_name := coalesce(
    nullif(trim(coalesce(p_name, '')), ''),
    nullif(trim(coalesce(v_metadata ->> 'display_name', '')), ''),
    nullif(trim(coalesce(v_metadata ->> 'full_name', '')), ''),
    nullif(trim(coalesce(v_metadata ->> 'name', '')), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Usuario'
  );

  insert into public.profiles as current_profile (user_id, role, name, coach_status, updated_at)
  values (v_user_id, v_requested_role, v_name, 'pending', now())
  on conflict (user_id) do update
    set role = case
          when public.role_rank(excluded.role) > public.role_rank(current_profile.role) then excluded.role
          else current_profile.role
        end,
        coach_status = case
          when current_profile.role = 'student' and excluded.role = 'coach' then 'pending'
          else current_profile.coach_status
        end,
        name = case
          when trim(coalesce(current_profile.name, '')) = '' then excluded.name
          else current_profile.name
        end,
        updated_at = case
          when public.role_rank(excluded.role) > public.role_rank(current_profile.role)
            or trim(coalesce(current_profile.name, '')) = '' then now()
          else current_profile.updated_at
        end
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role_at_least(p_required_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and public.role_rank(public.current_profile_role()) >= public.role_rank(p_required_role)
     and public.role_rank(p_required_role) > 0;
$$;

create or replace function public.can_operate_as_coach()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.profiles p
       where p.user_id = auth.uid()
         and (
           p.role = 'admin'
           or (
             p.role = 'coach'
             and p.coach_status in ('trial', 'active', 'past_due')
           )
         )
     );
$$;

create or replace function public.validate_student_invite(p_token text, p_email text default null)
returns table (valid boolean, email_matches boolean, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_student public.students%rowtype;
begin
  select s.* into v_student
    from public.students s
   where s.invite_token::text = trim(coalesce(p_token, ''))
   limit 1;

  if not found then return query select false, false, 'not-found'::text; return; end if;
  if v_student.invite_status = 'revoked' then return query select false, true, 'revoked'::text; return; end if;
  if v_student.invite_status = 'pending' and v_student.invite_expires_at <= now() then return query select false, true, 'expired'::text; return; end if;
  if p_email is not null
     and trim(coalesce(v_student.email, '')) <> ''
     and lower(trim(p_email)) <> lower(trim(v_student.email)) then
    return query select false, false, 'email-mismatch'::text; return;
  end if;
  return query select true, true,
    case when v_student.invite_status = 'accepted' then 'accepted' else 'valid' end::text;
end;
$$;

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
  if v_user_id is null or v_user_email = '' then raise exception 'student_access_requires_authenticated_email'; end if;

  select p.role into v_profile_role from public.profiles p where p.user_id = v_user_id;
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
    if v_token_student.invite_status = 'pending' and v_token_student.invite_expires_at <= now() then raise exception 'invite_expired'; end if;
    if v_token_student.student_user_id is not null and v_token_student.student_user_id <> v_user_id then raise exception 'invite_already_claimed'; end if;
    if trim(coalesce(v_token_student.email, '')) <> '' and lower(trim(v_token_student.email)) <> v_user_email then
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

  select count(*) into v_access_count from public.students s where s.student_user_id = v_user_id;
  if v_access_count = 0 then raise exception 'student_access_not_authorized'; end if;

  select s.name into v_profile_name
    from public.students s
   where s.student_user_id = v_user_id
   order by s.updated_at desc
   limit 1;

  perform public.ensure_own_profile('student', v_profile_name);

  return query
  select s.id, s.coach_id,
         case when trim(coalesce(p_token, '')) <> '' and s.id = v_token_student.id then 'invite' else 'email' end
    from public.students s
   where s.student_user_id = v_user_id
   order by s.updated_at desc;
end;
$$;

create or replace function public.claim_student_invite(p_token text)
returns table (student_id text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform * from public.claim_student_access(p_token);
  return query
  select s.id from public.students s
   where s.invite_token::text = trim(coalesce(p_token, ''))
     and s.student_user_id = auth.uid()
   limit 1;
end;
$$;

create or replace function public.publish_student_workout(p_workout jsonb, p_exercises jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_coach_id text := auth.uid()::text;
  v_workout_id text := trim(coalesce(p_workout ->> 'id', ''));
  v_student_id text := trim(coalesce(p_workout ->> 'student_id', ''));
  v_exercise jsonb;
  v_media_url text;
  v_media_type text;
  v_count integer := 0;
  v_result jsonb;
begin
  if v_user_id is null or not public.can_operate_as_coach() then raise exception 'coach_access_blocked'; end if;
  if v_workout_id = '' or v_student_id = '' then raise exception 'workout_id_and_student_required'; end if;
  if not exists (select 1 from public.students s where s.id = v_student_id and s.coach_id = v_coach_id) then
    raise exception 'student_not_found_for_coach';
  end if;
  if exists (select 1 from public.workout_plans wp where wp.id = v_workout_id and wp.coach_id <> v_coach_id) then
    raise exception 'workout_owned_by_another_coach';
  end if;
  if jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) = 0 then
    raise exception 'workout_requires_exercises';
  end if;

  insert into public.workout_plans (
    id, coach_id, student_id, student_key, owner, code, title, focus, estimated_minutes,
    last_done_label, source, status, starts_at, published_at, version, updated_at
  ) values (
    v_workout_id, v_coach_id, v_student_id,
    trim(coalesce(p_workout ->> 'student_key', 'aluno')),
    trim(coalesce(p_workout ->> 'owner', 'Aluno')),
    trim(coalesce(p_workout ->> 'code', 'A')),
    trim(coalesce(p_workout ->> 'title', 'Novo treino')),
    trim(coalesce(p_workout ->> 'focus', 'Prescricao personalizada')),
    greatest(1, coalesce((p_workout ->> 'estimated_minutes')::integer, 45)),
    trim(coalesce(p_workout ->> 'last_done_label', 'novo')),
    trim(coalesce(p_workout ->> 'source', 'professor')),
    'published', coalesce((p_workout ->> 'starts_at')::timestamptz, now()),
    coalesce((p_workout ->> 'published_at')::timestamptz, now()),
    greatest(1, coalesce((p_workout ->> 'version')::integer, 1)), now()
  ) on conflict (id) do update set
    student_id = excluded.student_id, student_key = excluded.student_key, owner = excluded.owner,
    code = excluded.code, title = excluded.title, focus = excluded.focus,
    estimated_minutes = excluded.estimated_minutes, last_done_label = excluded.last_done_label,
    source = excluded.source, status = 'published', starts_at = excluded.starts_at,
    published_at = excluded.published_at, version = excluded.version, updated_at = now();

  delete from public.workout_exercises where workout_id = v_workout_id and coach_id = v_coach_id;
  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    v_media_url := trim(coalesce(v_exercise ->> 'media_url', ''));
    v_media_type := lower(trim(coalesce(v_exercise ->> 'media_type', case when v_media_url = '' then 'none' else 'external' end)));
    if v_media_url <> '' and v_media_url !~* '^https://' then
      raise exception 'exercise_media_url_requires_https';
    end if;
    if v_media_type not in ('none', 'image', 'gif', 'video', 'youtube', 'external') then
      raise exception 'exercise_media_type_invalid';
    end if;

    insert into public.workout_exercises (
      id, workout_id, coach_id, position, name, target, prescription, load, rest, tempo, rir, notes, instructions, media_url, media_type, updated_at
    ) values (
      trim(coalesce(v_exercise ->> 'id', v_workout_id || '-ex-' || v_count::text)),
      v_workout_id, v_coach_id, v_count,
      trim(coalesce(v_exercise ->> 'name', 'Exercicio')),
      trim(coalesce(v_exercise ->> 'target', 'Personalizado')),
      trim(coalesce(v_exercise ->> 'prescription', '3 x 10')),
      trim(coalesce(v_exercise ->> 'load', '0 kg')),
      trim(coalesce(v_exercise ->> 'rest', '60s')),
      trim(coalesce(v_exercise ->> 'tempo', '2-0-2')),
      trim(coalesce(v_exercise ->> 'rir', '2')),
      trim(coalesce(v_exercise ->> 'notes', 'Criado no painel do professor.')),
      trim(coalesce(v_exercise ->> 'instructions', '')),
      v_media_url, v_media_type, now()
    );
    v_count := v_count + 1;
  end loop;

  update public.students
     set workout = 'Treino ' || trim(coalesce(p_workout ->> 'code', 'A')) || ' - ' || trim(coalesce(p_workout ->> 'title', 'Novo treino')),
         next_action = 'Ver treino publicado', updated_at = now()
   where id = v_student_id and coach_id = v_coach_id;

  select jsonb_build_object(
    'workout_id', wp.id, 'student_id', wp.student_id, 'status', wp.status,
    'version', wp.version, 'exercise_count', v_count, 'updated_at', wp.updated_at
  ) into v_result from public.workout_plans wp
   where wp.id = v_workout_id and wp.coach_id = v_coach_id;
  return v_result;
end;
$$;

revoke all on function public.role_rank(text) from public, anon, authenticated;
revoke all on function public.ensure_own_profile(text, text) from public, anon, authenticated;
revoke all on function public.current_profile_role() from public, anon, authenticated;
revoke all on function public.has_role_at_least(text) from public, anon, authenticated;
revoke all on function public.can_operate_as_coach() from public, anon, authenticated;
revoke all on function public.validate_student_invite(text, text) from public, anon, authenticated;
revoke all on function public.claim_student_access(text) from public, anon, authenticated;
revoke all on function public.claim_student_invite(text) from public, anon, authenticated;
revoke all on function public.publish_student_workout(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.role_rank(text) to authenticated;
grant execute on function public.ensure_own_profile(text, text) to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.has_role_at_least(text) to authenticated;
grant execute on function public.can_operate_as_coach() to authenticated;
grant execute on function public.validate_student_invite(text, text) to anon, authenticated;
grant execute on function public.claim_student_access(text) to authenticated;
grant execute on function public.claim_student_invite(text) to authenticated;
grant execute on function public.publish_student_workout(jsonb, jsonb) to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_own_or_linked_coach" on public.profiles;
create policy "profiles_select_own_or_linked_coach"
  on public.profiles for select to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      role in ('coach', 'admin')
      and exists (
        select 1 from public.students s
         where s.coach_id = profiles.user_id::text
           and s.student_user_id = (select auth.uid())
      )
    )
  );

select
  'update-student-access-ok' as migration,
  count(*) filter (where student_user_id is not null) as linked_students,
  count(*) filter (where student_user_id is null) as unlinked_students
from public.students;
