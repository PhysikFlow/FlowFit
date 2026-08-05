-- ============================================================================
-- Supabase: schema autenticado do FlowFit
--
-- Uso:
-- 1) Rode este arquivo no SQL Editor do projeto Supabase.
-- 2) Em Authentication > URL Configuration, configure:
--    - Site URL: URL do GitHub Pages
--    - Redirect URLs: URL do GitHub Pages e subpastas appAluno/appProfessor
--
-- Arquitetura:
-- - profiles.role = 'admin', 'coach' ou 'student'
-- - profiles.coach_status controla se o personal pode operar o painel
-- - professor/personal grava dados com coach_id = auth.uid()::text
-- - aluno ativa acesso somente por token de convite e grava students.student_user_id
-- - tabelas publicas ficam com RLS habilitado; anon nao acessa dados reais
-- ============================================================================

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null,
  name       text not null,
  headline   text not null default 'Personal trainer',
  bio        text not null default '',
  city       text not null default '',
  contact_email text not null default '',
  phone      text not null default '',
  whatsapp   text not null default '',
  cref       text not null default '',
  coach_status text not null default 'trial',
  coach_trial_ends_at timestamptz,
  coach_status_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'coach', 'student')),
  constraint profiles_coach_status_check check (coach_status in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled'))
);

create table if not exists public.brand_theme (
  coach_id   text primary key,
  brand_name text not null default 'FlowFit',
  tagline    text not null default 'Seu treino, no seu ritmo',
  accent     text not null default '#7667ff',
  mode       text not null default 'dark',
  background_color text not null default '#090b10',
  surface_color    text not null default '#151922',
  text_color       text not null default '#f7f7fa',
  font_preset      text not null default 'system',
  radius_preset    text not null default 'soft',
  background_style text not null default 'aurora',
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id              text primary key,
  coach_id        text not null,
  student_key     text not null,
  student_user_id uuid references auth.users(id) on delete set null,
  email           text,
  name            text not null,
  initials        text not null default 'AL',
  goal            text not null default 'Hipertrofia',
  status          text not null default 'Ativo',
  plan            text not null default 'Novo',
  workout         text not null default 'Sem treino atribuido',
  adherence       integer not null default 0 check (adherence >= 0 and adherence <= 100),
  next_action     text not null default 'Criar primeiro treino',
  invite_token    uuid not null default gen_random_uuid(),
  invite_status   text not null default 'pending',
  invite_expires_at timestamptz not null default (now() + interval '30 days'),
  invite_claimed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint students_invite_status_check check (invite_status in ('pending', 'accepted', 'revoked'))
);

create table if not exists public.workout_plans (
  id                text primary key,
  coach_id          text not null,
  student_id        text references public.students(id) on delete set null,
  student_key       text not null,
  owner             text not null,
  code              text not null default 'A',
  title             text not null,
  focus             text not null default 'Prescricao personalizada',
  estimated_minutes integer not null default 45 check (estimated_minutes > 0),
  last_done_label   text not null default 'novo',
  source            text not null default 'professor',
  status            text not null default 'published',
  starts_at         timestamptz not null default now(),
  published_at      timestamptz not null default now(),
  version           integer not null default 1 check (version > 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id           text primary key,
  workout_id   text not null references public.workout_plans(id) on delete cascade,
  coach_id     text not null,
  position     integer not null default 0 check (position >= 0),
  name         text not null,
  target       text not null default 'Personalizado',
  prescription text not null,
  load         text not null default '0 kg',
  rest         text not null default '60s',
  tempo        text not null default '2-0-2',
  rir          text not null default '2',
  notes        text not null default 'Criado no painel do professor.',
  updated_at   timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id               text primary key,
  coach_id         text not null,
  student_id       text references public.students(id) on delete set null,
  student_key      text not null,
  student_email    text,
  workout_id       text references public.workout_plans(id) on delete set null,
  workout_code     text not null default 'A',
  workout_title    text not null,
  workout_version  integer not null default 1 check (workout_version > 0),
  status           text not null default 'completed',
  total_sets       integer not null default 0 check (total_sets >= 0),
  completed_sets   integer not null default 0 check (completed_sets >= 0),
  volume_kg        numeric not null default 0 check (volume_kg >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.workout_set_logs (
  id             text primary key,
  session_id     text not null references public.workout_sessions(id) on delete cascade,
  coach_id       text not null,
  workout_id     text,
  exercise_id    text,
  position       integer not null default 0 check (position >= 0),
  exercise_name  text not null,
  target         text not null default 'Personalizado',
  prescription   text not null default '',
  planned_sets   integer not null default 0 check (planned_sets >= 0),
  completed_sets integer not null default 0 check (completed_sets >= 0),
  load_kg        numeric not null default 0 check (load_kg >= 0),
  reps           integer not null default 0 check (reps >= 0),
  volume_kg      numeric not null default 0 check (volume_kg >= 0),
  rir            text not null default '',
  notes          text not null default '',
  created_at     timestamptz not null default now()
);

create table if not exists public.workout_feedback (
  id          text primary key,
  session_id  text not null references public.workout_sessions(id) on delete cascade,
  coach_id    text not null,
  student_id  text references public.students(id) on delete set null,
  effort      text not null default 'ok',
  pain        text not null default 'none',
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- Migração segura para bancos que já tinham o schema piloto antigo.
alter table public.profiles
  add column if not exists headline text not null default 'Personal trainer',
  add column if not exists bio text not null default '',
  add column if not exists city text not null default '',
  add column if not exists contact_email text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists cref text not null default '',
  add column if not exists coach_status text not null default 'trial',
  add column if not exists coach_trial_ends_at timestamptz,
  add column if not exists coach_status_note text not null default '';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'coach', 'student'));

alter table public.profiles
  drop constraint if exists profiles_coach_status_check;

alter table public.profiles
  add constraint profiles_coach_status_check check (coach_status in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled'));

alter table public.brand_theme
  add column if not exists background_color text not null default '#090b10',
  add column if not exists surface_color text not null default '#151922',
  add column if not exists text_color text not null default '#f7f7fa',
  add column if not exists font_preset text not null default 'system',
  add column if not exists radius_preset text not null default 'soft',
  add column if not exists background_style text not null default 'aurora';

alter table public.students
  add column if not exists student_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text,
  add column if not exists invite_token uuid not null default gen_random_uuid(),
  add column if not exists invite_status text not null default 'pending',
  add column if not exists invite_expires_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists invite_claimed_at timestamptz;

alter table public.students
  drop constraint if exists students_invite_status_check;

alter table public.students
  add constraint students_invite_status_check check (invite_status in ('pending', 'accepted', 'revoked'));

alter table public.workout_plans
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists published_at timestamptz not null default now(),
  add column if not exists version integer not null default 1;

alter table public.workout_plans
  drop constraint if exists workout_plans_version_check;

alter table public.workout_plans
  add constraint workout_plans_version_check check (version > 0);

alter table public.students alter column coach_id drop default;
alter table public.workout_plans alter column coach_id drop default;
alter table public.workout_exercises alter column coach_id drop default;
alter table public.workout_sessions alter column coach_id drop default;
alter table public.workout_set_logs alter column coach_id drop default;
alter table public.workout_feedback alter column coach_id drop default;

alter table public.students
  drop constraint if exists students_coach_id_student_key_key;

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists profiles_coach_status_idx
  on public.profiles (coach_status);

create index if not exists students_coach_student_key_idx
  on public.students (coach_id, student_key);

create index if not exists students_email_idx
  on public.students (lower(email));

create unique index if not exists students_coach_email_unique_idx
  on public.students (coach_id, lower(email))
  where email is not null;

create index if not exists students_student_user_id_idx
  on public.students (student_user_id);

create unique index if not exists students_invite_token_unique_idx
  on public.students (invite_token);

create index if not exists workout_plans_coach_student_updated_idx
  on public.workout_plans (coach_id, student_key, updated_at desc);

create index if not exists workout_plans_student_starts_idx
  on public.workout_plans (student_id, starts_at desc, updated_at desc);

create index if not exists workout_plans_student_id_idx
  on public.workout_plans (student_id);

create index if not exists workout_exercises_workout_position_idx
  on public.workout_exercises (workout_id, position);

create index if not exists workout_sessions_coach_student_finished_idx
  on public.workout_sessions (coach_id, student_id, finished_at desc);

create index if not exists workout_sessions_student_finished_idx
  on public.workout_sessions (student_id, finished_at desc);

create index if not exists workout_sessions_workout_finished_idx
  on public.workout_sessions (workout_id, finished_at desc);

create index if not exists workout_set_logs_session_position_idx
  on public.workout_set_logs (session_id, position);

create index if not exists workout_feedback_session_idx
  on public.workout_feedback (session_id);

-- O token pode ser validado antes do cadastro sem expor os dados do aluno.
create or replace function public.validate_student_invite(p_token text, p_email text default null)
returns table (valid boolean, email_matches boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student public.students%rowtype;
begin
  select s.*
    into v_student
    from public.students s
   where s.invite_token::text = trim(coalesce(p_token, ''))
   limit 1;

  if not found then
    return query select false, false, 'not-found'::text;
    return;
  end if;

  if v_student.invite_status <> 'pending' then
    return query select false, true, v_student.invite_status::text;
    return;
  end if;

  if v_student.invite_expires_at <= now() then
    return query select false, true, 'expired'::text;
    return;
  end if;

  if p_email is not null and lower(trim(p_email)) <> lower(trim(coalesce(v_student.email, ''))) then
    return query select false, false, 'email-mismatch'::text;
    return;
  end if;

  return query select true, true, 'valid'::text;
end;
$$;

-- Claim atomico: valida convite, fixa o aluno no auth.uid e cria o papel student.
create or replace function public.claim_student_invite(p_token text)
returns table (student_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_student public.students%rowtype;
  v_profile_role text;
begin
  if v_user_id is null or v_user_email = '' then
    raise exception 'invite_requires_authenticated_email';
  end if;

  select s.*
    into v_student
    from public.students s
   where s.invite_token::text = trim(coalesce(p_token, ''))
   for update;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_student.invite_status = 'revoked' then
    raise exception 'invite_revoked';
  end if;

  if v_student.invite_status = 'pending' and v_student.invite_expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  if v_student.student_user_id is not null and v_student.student_user_id <> v_user_id then
    raise exception 'invite_already_claimed';
  end if;

  if v_student.student_user_id is null
     and lower(trim(coalesce(v_student.email, ''))) <> v_user_email then
    raise exception 'invite_email_mismatch';
  end if;

  select p.role into v_profile_role
    from public.profiles p
   where p.user_id = v_user_id;

  if v_profile_role is not null and v_profile_role <> 'student' then
    raise exception 'account_has_different_role';
  end if;

  insert into public.profiles (user_id, role, name, updated_at)
  values (v_user_id, 'student', v_student.name, now())
  on conflict (user_id) do nothing;

  update public.students
     set student_user_id = v_user_id,
         invite_status = 'accepted',
         invite_claimed_at = coalesce(invite_claimed_at, now()),
         updated_at = now()
   where id = v_student.id;

  return query select v_student.id;
end;
$$;

-- Um personal pode renovar um convite pendente/revogado; convite aceito nao
-- troca de dono e deve usar login/recuperacao de senha.
create or replace function public.renew_student_invite(p_student_id text)
returns table (
  student_id text,
  invite_token uuid,
  invite_status text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_student public.students%rowtype;
begin
  if v_user_id is null then
    raise exception 'invite_renew_requires_authentication';
  end if;

  select s.*
    into v_student
    from public.students s
   where s.id = p_student_id
     and s.coach_id = v_user_id::text
   for update;

  if not found then
    raise exception 'student_not_found_for_coach';
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.user_id = v_user_id
       and p.role = 'coach'
       and p.coach_status in ('trial', 'active', 'past_due')
  ) then
    raise exception 'coach_access_blocked';
  end if;

  if v_student.invite_status <> 'accepted' then
    update public.students
       set invite_token = gen_random_uuid(),
           invite_status = 'pending',
           invite_expires_at = now() + interval '30 days',
           invite_claimed_at = null,
           updated_at = now()
     where id = v_student.id
     returning * into v_student;
  end if;

  return query
  select v_student.id, v_student.invite_token, v_student.invite_status, v_student.invite_expires_at;
end;
$$;

revoke all on function public.validate_student_invite(text, text) from public;
revoke all on function public.claim_student_invite(text) from public;
revoke all on function public.renew_student_invite(text) from public;
grant execute on function public.validate_student_invite(text, text) to anon, authenticated;
grant execute on function public.claim_student_invite(text) to authenticated;
grant execute on function public.renew_student_invite(text) to authenticated;

-- Data API: acesso anonimo nao le dados reais. Auth API continua funcionando.
revoke all on public.profiles from anon;
revoke all on public.brand_theme from anon;
revoke all on public.students from anon;
revoke all on public.workout_plans from anon;
revoke all on public.workout_exercises from anon;
revoke all on public.workout_sessions from anon;
revoke all on public.workout_set_logs from anon;
revoke all on public.workout_feedback from anon;

revoke update on public.profiles from authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (name, headline, bio, city, contact_email, phone, whatsapp, cref, updated_at) on public.profiles to authenticated;
grant select, insert, update on public.brand_theme to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.workout_plans to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_set_logs to authenticated;
grant select, insert, update, delete on public.workout_feedback to authenticated;

alter table public.profiles enable row level security;
alter table public.brand_theme enable row level security;
alter table public.students enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_set_logs enable row level security;
alter table public.workout_feedback enable row level security;

-- Remove policies do piloto anon/demo e recria policies autenticadas.
drop policy if exists "brand_theme_select_demo" on public.brand_theme;
drop policy if exists "brand_theme_insert_demo" on public.brand_theme;
drop policy if exists "brand_theme_update_demo" on public.brand_theme;
drop policy if exists "students_select_demo" on public.students;
drop policy if exists "students_insert_demo" on public.students;
drop policy if exists "students_update_demo" on public.students;
drop policy if exists "students_delete_demo" on public.students;
drop policy if exists "workout_plans_select_demo" on public.workout_plans;
drop policy if exists "workout_plans_insert_demo" on public.workout_plans;
drop policy if exists "workout_plans_update_demo" on public.workout_plans;
drop policy if exists "workout_plans_delete_demo" on public.workout_plans;
drop policy if exists "workout_exercises_select_demo" on public.workout_exercises;
drop policy if exists "workout_exercises_insert_demo" on public.workout_exercises;
drop policy if exists "workout_exercises_update_demo" on public.workout_exercises;
drop policy if exists "workout_exercises_delete_demo" on public.workout_exercises;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "brand_theme_select_authenticated" on public.brand_theme;
drop policy if exists "brand_theme_insert_coach" on public.brand_theme;
drop policy if exists "brand_theme_update_coach" on public.brand_theme;
drop policy if exists "students_select_authenticated_owner" on public.students;
drop policy if exists "students_insert_coach" on public.students;
drop policy if exists "students_update_coach" on public.students;
drop policy if exists "students_claim_self_by_email" on public.students;
drop policy if exists "students_delete_coach" on public.students;
drop policy if exists "workout_plans_select_authenticated_owner" on public.workout_plans;
drop policy if exists "workout_plans_insert_coach" on public.workout_plans;
drop policy if exists "workout_plans_update_coach" on public.workout_plans;
drop policy if exists "workout_plans_delete_coach" on public.workout_plans;
drop policy if exists "workout_exercises_select_authenticated_owner" on public.workout_exercises;
drop policy if exists "workout_exercises_insert_coach" on public.workout_exercises;
drop policy if exists "workout_exercises_update_coach" on public.workout_exercises;
drop policy if exists "workout_exercises_delete_coach" on public.workout_exercises;
drop policy if exists "workout_sessions_select_authenticated_owner" on public.workout_sessions;
drop policy if exists "workout_sessions_insert_student" on public.workout_sessions;
drop policy if exists "workout_sessions_update_owner" on public.workout_sessions;
drop policy if exists "workout_sessions_delete_coach" on public.workout_sessions;
drop policy if exists "workout_set_logs_select_authenticated_owner" on public.workout_set_logs;
drop policy if exists "workout_set_logs_insert_student" on public.workout_set_logs;
drop policy if exists "workout_set_logs_update_owner" on public.workout_set_logs;
drop policy if exists "workout_set_logs_delete_coach" on public.workout_set_logs;
drop policy if exists "workout_feedback_select_authenticated_owner" on public.workout_feedback;
drop policy if exists "workout_feedback_insert_student" on public.workout_feedback;
drop policy if exists "workout_feedback_update_owner" on public.workout_feedback;
drop policy if exists "workout_feedback_delete_coach" on public.workout_feedback;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and role = 'coach'
    and coach_status = 'trial'
  );

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "brand_theme_select_authenticated"
  on public.brand_theme for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or exists (
      select 1
      from public.students s
      where s.coach_id = brand_theme.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "brand_theme_insert_coach"
  on public.brand_theme for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "brand_theme_update_coach"
  on public.brand_theme for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  )
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "students_select_authenticated_owner"
  on public.students for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or student_user_id = (select auth.uid())
  );

create policy "students_insert_coach"
  on public.students for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "students_update_coach"
  on public.students for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  )
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "students_delete_coach"
  on public.students for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_plans_select_authenticated_owner"
  on public.workout_plans for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or exists (
      select 1
      from public.students s
      where s.id = workout_plans.student_id
        and s.coach_id = workout_plans.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_plans_insert_coach"
  on public.workout_plans for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_plans_update_coach"
  on public.workout_plans for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  )
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_plans_delete_coach"
  on public.workout_plans for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_exercises_select_authenticated_owner"
  on public.workout_exercises for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or exists (
      select 1
      from public.workout_plans wp
      join public.students s
        on s.id = wp.student_id
       and s.coach_id = wp.coach_id
      where wp.id = workout_exercises.workout_id
        and wp.coach_id = workout_exercises.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_exercises_insert_coach"
  on public.workout_exercises for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_exercises_update_coach"
  on public.workout_exercises for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  )
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_exercises_delete_coach"
  on public.workout_exercises for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_sessions_select_authenticated_owner"
  on public.workout_sessions for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or exists (
      select 1
      from public.students s
      where s.id = workout_sessions.student_id
        and s.coach_id = workout_sessions.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_sessions_insert_student"
  on public.workout_sessions for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = workout_sessions.student_id
        and s.coach_id = workout_sessions.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_sessions_update_owner"
  on public.workout_sessions for update
  to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'coach'
          and p.coach_status in ('trial', 'active', 'past_due')
      )
    )
    or exists (
      select 1
      from public.students s
      where s.id = workout_sessions.student_id
        and s.coach_id = workout_sessions.coach_id
        and s.student_user_id = (select auth.uid())
    )
  )
  with check (
    (
      coach_id = (select auth.uid())::text
      and exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'coach'
          and p.coach_status in ('trial', 'active', 'past_due')
      )
    )
    or exists (
      select 1
      from public.students s
      where s.id = workout_sessions.student_id
        and s.coach_id = workout_sessions.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_sessions_delete_coach"
  on public.workout_sessions for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_set_logs_select_authenticated_owner"
  on public.workout_set_logs for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_set_logs.session_id
        and ws.coach_id = workout_set_logs.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_set_logs_insert_student"
  on public.workout_set_logs for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_set_logs.session_id
        and ws.coach_id = workout_set_logs.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_set_logs_update_owner"
  on public.workout_set_logs for update
  to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'coach'
          and p.coach_status in ('trial', 'active', 'past_due')
      )
    )
    or exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_set_logs.session_id
        and ws.coach_id = workout_set_logs.coach_id
        and s.student_user_id = (select auth.uid())
    )
  )
  with check (
    (
      coach_id = (select auth.uid())::text
      and exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'coach'
          and p.coach_status in ('trial', 'active', 'past_due')
      )
    )
    or exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_set_logs.session_id
        and ws.coach_id = workout_set_logs.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_set_logs_delete_coach"
  on public.workout_set_logs for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );

create policy "workout_feedback_select_authenticated_owner"
  on public.workout_feedback for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_feedback.session_id
        and ws.coach_id = workout_feedback.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_feedback_insert_student"
  on public.workout_feedback for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_feedback.session_id
        and ws.coach_id = workout_feedback.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_feedback_update_owner"
  on public.workout_feedback for update
  to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'coach'
          and p.coach_status in ('trial', 'active', 'past_due')
      )
    )
    or exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_feedback.session_id
        and ws.coach_id = workout_feedback.coach_id
        and s.student_user_id = (select auth.uid())
    )
  )
  with check (
    (
      coach_id = (select auth.uid())::text
      and exists (
        select 1 from public.profiles p
        where p.user_id = (select auth.uid())
          and p.role = 'coach'
          and p.coach_status in ('trial', 'active', 'past_due')
      )
    )
    or exists (
      select 1
      from public.workout_sessions ws
      join public.students s
        on s.id = ws.student_id
       and s.coach_id = ws.coach_id
      where ws.id = workout_feedback.session_id
        and ws.coach_id = workout_feedback.coach_id
        and s.student_user_id = (select auth.uid())
    )
  );

create policy "workout_feedback_delete_coach"
  on public.workout_feedback for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.role = 'coach'
        and p.coach_status in ('trial', 'active', 'past_due')
    )
  );
