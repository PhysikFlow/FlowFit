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
-- - profiles.role guarda o maior papel da identidade: admin > coach > student
-- - profiles.coach_status controla se o personal pode operar o painel
-- - "coach" é o valor interno usado para o papel de professor/personal
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
  coach_status text not null default 'pending',
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
  instructions text not null default '',
  media_url    text not null default '' check (media_url = '' or media_url ~* '^https://'),
  media_type   text not null default 'none' check (media_type in ('none', 'image', 'video', 'youtube', 'external')),
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
  set_number     integer check (set_number is null or set_number > 0),
  set_kind       text not null default 'working',
  completed_at   timestamptz,
  workout_exercise_id text,
  discomfort     text not null default 'none' check (discomfort in ('none', 'mild', 'pain')),
  discomfort_note text not null default '',
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
  add column if not exists coach_status text not null default 'pending',
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

alter table public.workout_exercises
  add column if not exists instructions text not null default '',
  add column if not exists media_url text not null default '',
  add column if not exists media_type text not null default 'none';

alter table public.workout_set_logs
  add column if not exists set_number integer,
  add column if not exists set_kind text not null default 'working',
  add column if not exists completed_at timestamptz,
  add column if not exists workout_exercise_id text,
  add column if not exists discomfort text not null default 'none',
  add column if not exists discomfort_note text not null default '';

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

  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_set_logs_set_number_check'
      and conrelid = 'public.workout_set_logs'::regclass
  ) then
    alter table public.workout_set_logs
      add constraint workout_set_logs_set_number_check
      check (set_number is null or set_number > 0);
  end if;
end
$$;

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

drop index if exists public.students_coach_email_unique_idx;
create unique index students_coach_email_unique_idx
  on public.students (coach_id, lower(trim(email)))
  where email is not null and trim(email) <> '';

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

drop index if exists public.workout_set_logs_session_exercise_set_idx;
create unique index if not exists workout_set_logs_session_item_set_idx
  on public.workout_set_logs (session_id, workout_exercise_id, set_number)
  where set_number is not null and workout_exercise_id is not null;

create index if not exists workout_feedback_session_idx
  on public.workout_feedback (session_id);

-- Hierarquia de acesso:
-- admin > coach/professor > student/aluno.
-- A role salva em profiles representa o maior acesso daquela identidade.
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

  if v_student.invite_status = 'revoked' then
    return query select false, true, 'revoked'::text;
    return;
  end if;

  if v_student.invite_status = 'pending' and v_student.invite_expires_at <= now() then
    return query select false, true, 'expired'::text;
    return;
  end if;

  if p_email is not null
     and trim(coalesce(v_student.email, '')) <> ''
     and lower(trim(p_email)) <> lower(trim(v_student.email)) then
    return query select false, false, 'email-mismatch'::text;
    return;
  end if;

  return query select true, true,
    case when v_student.invite_status = 'accepted' then 'accepted' else 'valid' end::text;
end;
$$;

-- Acesso atomico: email previamente cadastrado dispensa link. O token continua
-- sendo a autorizacao para cadastros em que o personal nao conhece o email.
create or replace function public.claim_student_access(p_token text default null)
returns table (student_id text, coach_id text, access_method text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_token_student public.students%rowtype;
  v_profile_role text;
  v_access_count integer := 0;
begin
  if v_user_id is null or v_user_email = '' then
    raise exception 'student_access_requires_authenticated_email';
  end if;

  select p.role into v_profile_role
    from public.profiles p
   where p.user_id = v_user_id;

  -- Uma conta com papel maior (coach/admin) tambem pode usar a area do aluno,
  -- mas o acesso aos dados continua exigindo vinculo por convite/email abaixo.
  if v_profile_role is not null and public.role_rank(v_profile_role) < public.role_rank('student') then
    raise exception 'account_has_different_role';
  end if;

  if trim(coalesce(p_token, '')) <> '' then
    select s.*
      into v_token_student
      from public.students s
     where s.invite_token::text = trim(p_token)
     for update;

    if not found then
      raise exception 'invite_not_found';
    end if;

    if v_token_student.invite_status = 'revoked' then
      raise exception 'invite_revoked';
    end if;

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

  -- Um unico login vincula todos os cadastros pendentes do mesmo email,
  -- inclusive quando eles pertencem a personais diferentes.
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

  insert into public.profiles (user_id, role, name, updated_at)
  select v_user_id, 'student', s.name, now()
    from public.students s
   where s.student_user_id = v_user_id
   order by s.updated_at desc
   limit 1
  on conflict (user_id) do nothing;

  return query
  select s.id,
         s.coach_id,
         case when trim(coalesce(p_token, '')) <> '' and s.id = v_token_student.id then 'invite' else 'email' end
    from public.students s
   where s.student_user_id = v_user_id
   order by s.updated_at desc;
end;
$$;

-- Compatibilidade por uma versao com PWAs que ainda chamam a RPC antiga.
create or replace function public.claim_student_invite(p_token text)
returns table (student_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform * from public.claim_student_access(p_token);
  return query
  select s.id
    from public.students s
   where s.invite_token::text = trim(coalesce(p_token, ''))
     and s.student_user_id = auth.uid()
   limit 1;
end;
$$;

-- Publicacao transacional: plano, exercicios e resumo do aluno confirmam juntos.
create or replace function public.publish_student_workout(p_workout jsonb, p_exercises jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_coach_id text := auth.uid()::text;
  v_workout_id text := trim(coalesce(p_workout ->> 'id', ''));
  v_student_id text := trim(coalesce(p_workout ->> 'student_id', ''));
  v_exercise jsonb;
  v_count integer := 0;
  v_result jsonb;
begin
  if v_user_id is null or not public.can_operate_as_coach() then
    raise exception 'coach_access_blocked';
  end if;

  if v_workout_id = '' or v_student_id = '' then
    raise exception 'workout_id_and_student_required';
  end if;

  if not exists (
    select 1 from public.students s
     where s.id = v_student_id and s.coach_id = v_coach_id
  ) then
    raise exception 'student_not_found_for_coach';
  end if;

  if exists (
    select 1 from public.workout_plans wp
     where wp.id = v_workout_id and wp.coach_id <> v_coach_id
  ) then
    raise exception 'workout_owned_by_another_coach';
  end if;

  if jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) = 0 then
    raise exception 'workout_requires_exercises';
  end if;

  insert into public.workout_plans (
    id, coach_id, student_id, student_key, owner, code, title, focus,
    estimated_minutes, last_done_label, source, status, starts_at,
    published_at, version, updated_at
  ) values (
    v_workout_id,
    v_coach_id,
    v_student_id,
    trim(coalesce(p_workout ->> 'student_key', 'aluno')),
    trim(coalesce(p_workout ->> 'owner', 'Aluno')),
    trim(coalesce(p_workout ->> 'code', 'A')),
    trim(coalesce(p_workout ->> 'title', 'Novo treino')),
    trim(coalesce(p_workout ->> 'focus', 'Prescricao personalizada')),
    greatest(1, coalesce((p_workout ->> 'estimated_minutes')::integer, 45)),
    trim(coalesce(p_workout ->> 'last_done_label', 'novo')),
    trim(coalesce(p_workout ->> 'source', 'professor')),
    'published',
    coalesce((p_workout ->> 'starts_at')::timestamptz, now()),
    coalesce((p_workout ->> 'published_at')::timestamptz, now()),
    greatest(1, coalesce((p_workout ->> 'version')::integer, 1)),
    now()
  )
  on conflict (id) do update set
    student_id = excluded.student_id,
    student_key = excluded.student_key,
    owner = excluded.owner,
    code = excluded.code,
    title = excluded.title,
    focus = excluded.focus,
    estimated_minutes = excluded.estimated_minutes,
    last_done_label = excluded.last_done_label,
    source = excluded.source,
    status = 'published',
    starts_at = excluded.starts_at,
    published_at = excluded.published_at,
    version = excluded.version,
    updated_at = now();

  delete from public.workout_exercises
   where workout_id = v_workout_id and coach_id = v_coach_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    insert into public.workout_exercises (
      id, workout_id, coach_id, position, name, target, prescription,
      load, rest, tempo, rir, notes, instructions, media_url, updated_at
    ) values (
      trim(coalesce(v_exercise ->> 'id', v_workout_id || '-ex-' || v_count::text)),
      v_workout_id,
      v_coach_id,
      v_count,
      trim(coalesce(v_exercise ->> 'name', 'Exercicio')),
      trim(coalesce(v_exercise ->> 'target', 'Personalizado')),
      trim(coalesce(v_exercise ->> 'prescription', '3 x 10')),
      trim(coalesce(v_exercise ->> 'load', '0 kg')),
      trim(coalesce(v_exercise ->> 'rest', '60s')),
      trim(coalesce(v_exercise ->> 'tempo', '2-0-2')),
      trim(coalesce(v_exercise ->> 'rir', '2')),
      trim(coalesce(v_exercise ->> 'notes', 'Criado no painel do professor.')),
      trim(coalesce(v_exercise ->> 'instructions', '')),
      trim(coalesce(v_exercise ->> 'media_url', '')),
      now()
    );
    v_count := v_count + 1;
  end loop;

  update public.students
     set workout = 'Treino ' || trim(coalesce(p_workout ->> 'code', 'A')) || ' - ' || trim(coalesce(p_workout ->> 'title', 'Novo treino')),
         next_action = 'Ver treino publicado',
         updated_at = now()
   where id = v_student_id and coach_id = v_coach_id;

  select jsonb_build_object(
    'workout_id', wp.id,
    'student_id', wp.student_id,
    'status', wp.status,
    'version', wp.version,
    'exercise_count', v_count,
    'updated_at', wp.updated_at
  ) into v_result
    from public.workout_plans wp
   where wp.id = v_workout_id and wp.coach_id = v_coach_id;

  return v_result;
end;
$$;

-- Um personal pode renovar um convite pendente/revogado; convite aceito nao
-- troca de dono e deve usar Google ou link magico pelo email ja vinculado.
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

  if not public.can_operate_as_coach() then
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

revoke all on function public.role_rank(text) from public, anon, authenticated;
revoke all on function public.current_profile_role() from public, anon, authenticated;
revoke all on function public.has_role_at_least(text) from public, anon, authenticated;
revoke all on function public.can_operate_as_coach() from public, anon, authenticated;
revoke all on function public.validate_student_invite(text, text) from public, anon, authenticated;
revoke all on function public.claim_student_access(text) from public, anon, authenticated;
revoke all on function public.claim_student_invite(text) from public, anon, authenticated;
revoke all on function public.publish_student_workout(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.renew_student_invite(text) from public, anon, authenticated;
grant execute on function public.role_rank(text) to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.has_role_at_least(text) to authenticated;
grant execute on function public.can_operate_as_coach() to authenticated;
grant execute on function public.validate_student_invite(text, text) to anon, authenticated;
grant execute on function public.claim_student_access(text) to authenticated;
grant execute on function public.claim_student_invite(text) to authenticated;
grant execute on function public.publish_student_workout(jsonb, jsonb) to authenticated;
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
drop policy if exists "profiles_select_own_or_linked_coach" on public.profiles;
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

create policy "profiles_select_own_or_linked_coach"
  on public.profiles for select
  to authenticated
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

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and role = 'coach'
    and coach_status = 'pending'
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
    and public.can_operate_as_coach()
  );

create policy "brand_theme_update_coach"
  on public.brand_theme for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  )
  with check (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
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
    and public.can_operate_as_coach()
  );

create policy "students_update_coach"
  on public.students for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  )
  with check (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  );

create policy "students_delete_coach"
  on public.students for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
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
    and public.can_operate_as_coach()
  );

create policy "workout_plans_update_coach"
  on public.workout_plans for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  )
  with check (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  );

create policy "workout_plans_delete_coach"
  on public.workout_plans for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
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
    and public.can_operate_as_coach()
  );

create policy "workout_exercises_update_coach"
  on public.workout_exercises for update
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  )
  with check (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
  );

create policy "workout_exercises_delete_coach"
  on public.workout_exercises for delete
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    and public.can_operate_as_coach()
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
      and public.can_operate_as_coach()
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
      and public.can_operate_as_coach()
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
    and public.can_operate_as_coach()
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
      and public.can_operate_as_coach()
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
      and public.can_operate_as_coach()
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
    and public.can_operate_as_coach()
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
      and public.can_operate_as_coach()
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
      and public.can_operate_as_coach()
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
    and public.can_operate_as_coach()
  );

-- ============================================================================
-- FlowFit: painel administrativo de personals (migração incremental)
--
-- Pode ser executada mais de uma vez. Não apaga nem altera o status de contas
-- existentes. Novos perfis de personal passam a iniciar como "pending".
-- ============================================================================

begin;

alter table public.profiles
  alter column coach_status set default 'pending';

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.coach_admin_settings (
  coach_id uuid primary key references public.profiles(user_id) on delete cascade,
  plan text not null default 'Plano piloto',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint coach_admin_settings_plan_length check (char_length(plan) between 1 and 80),
  constraint coach_admin_settings_notes_length check (char_length(notes) <= 5000)
);

create table if not exists public.coach_admin_history (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(user_id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint coach_admin_history_action_length check (char_length(action) between 1 and 80)
);

create index if not exists coach_admin_history_coach_created_idx
  on public.coach_admin_history (coach_id, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and (
       exists (
         select 1
         from public.platform_admins pa
         where pa.user_id = auth.uid()
       )
       or exists (
         select 1
         from public.profiles p
         where p.user_id = auth.uid()
           and p.role = 'admin'
       )
     );
$$;

alter table public.platform_admins enable row level security;
alter table public.coach_admin_settings enable row level security;
alter table public.coach_admin_history enable row level security;

drop policy if exists "platform_admins_select_admin" on public.platform_admins;
create policy "platform_admins_select_admin"
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "coach_admin_settings_select_admin" on public.coach_admin_settings;
create policy "coach_admin_settings_select_admin"
  on public.coach_admin_settings for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "coach_admin_history_select_admin" on public.coach_admin_history;
create policy "coach_admin_history_select_admin"
  on public.coach_admin_history for select
  to authenticated
  using (public.is_platform_admin());

-- O perfil próprio só pode ser criado como pending. A ativação ocorre pelas
-- funções administrativas abaixo, nunca por update direto do frontend.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and role = 'coach'
    and coach_status = 'pending'
  );

-- profiles.role guarda o maior papel da identidade. Logo, "ser personal" não
-- pode ser inferido apenas por role = 'coach': todo admin também possui a
-- capacidade de operar um tenant de personal no modelo atual.
create or replace function public.has_coach_capability(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_user_id
      and p.role in ('coach', 'admin')
  );
$$;

create or replace function public.admin_get_overview()
returns table (
  total bigint,
  pending bigint,
  trial bigint,
  active bigint,
  past_due bigint,
  suspended bigint,
  cancelled bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where p.coach_status = 'pending')::bigint,
    count(*) filter (where p.coach_status = 'trial')::bigint,
    count(*) filter (where p.coach_status = 'active')::bigint,
    count(*) filter (where p.coach_status = 'past_due')::bigint,
    count(*) filter (where p.coach_status = 'suspended')::bigint,
    count(*) filter (where p.coach_status = 'cancelled')::bigint
  from public.profiles p
  where public.has_coach_capability(p.user_id);
end;
$$;

create or replace function public.admin_list_coaches(
  p_search text default null,
  p_status text default null
)
returns table (
  coach_id uuid,
  name text,
  email text,
  registered_at timestamptz,
  student_count bigint,
  plan text,
  access_expires_at timestamptz,
  status text,
  status_note text,
  admin_notes text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_search text := lower(trim(coalesce(p_search, '')));
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  if v_status is not null and v_status not in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled') then
    raise exception 'Status de personal inválido.' using errcode = '22023';
  end if;

  return query
  select
    p.user_id,
    p.name,
    coalesce(nullif(u.email, ''), nullif(p.contact_email, ''), 'Sem email')::text,
    p.created_at,
    count(s.id)::bigint,
    coalesce(cas.plan, 'Plano piloto')::text,
    p.coach_trial_ends_at,
    p.coach_status,
    p.coach_status_note,
    coalesce(cas.notes, '')::text,
    greatest(p.updated_at, coalesce(cas.updated_at, p.updated_at))
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.students s on s.coach_id = p.user_id::text
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where public.has_coach_capability(p.user_id)
    and (v_status is null or p.coach_status = v_status)
    and (
      v_search = ''
      or lower(p.name) like '%' || v_search || '%'
      or lower(coalesce(u.email, p.contact_email, '')) like '%' || v_search || '%'
    )
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           cas.plan, p.coach_trial_ends_at, p.coach_status,
           p.coach_status_note, cas.notes, p.updated_at, cas.updated_at
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_get_coach(p_coach_id uuid)
returns table (
  coach_id uuid,
  name text,
  email text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  student_count bigint,
  plan text,
  access_expires_at timestamptz,
  status text,
  status_note text,
  admin_notes text,
  headline text,
  city text,
  contact_email text,
  phone text,
  whatsapp text,
  cref text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  return query
  select
    p.user_id,
    p.name,
    coalesce(nullif(u.email, ''), nullif(p.contact_email, ''), 'Sem email')::text,
    p.created_at,
    u.last_sign_in_at,
    count(s.id)::bigint,
    coalesce(cas.plan, 'Plano piloto')::text,
    p.coach_trial_ends_at,
    p.coach_status,
    p.coach_status_note,
    coalesce(cas.notes, '')::text,
    p.headline,
    p.city,
    p.contact_email,
    p.phone,
    p.whatsapp,
    p.cref,
    greatest(p.updated_at, coalesce(cas.updated_at, p.updated_at))
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.students s on s.coach_id = p.user_id::text
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where p.user_id = p_coach_id
    and public.has_coach_capability(p.user_id)
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           u.last_sign_in_at, cas.plan, p.coach_trial_ends_at,
           p.coach_status, p.coach_status_note, cas.notes, p.headline,
           p.city, p.phone, p.whatsapp, p.cref, p.updated_at, cas.updated_at;
end;
$$;

create or replace function public.admin_list_coach_history(p_coach_id uuid)
returns table (
  id uuid,
  action text,
  actor_email text,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  return query
  select
    h.id,
    h.action,
    coalesce(u.email, 'Administrador removido')::text,
    h.previous_values,
    h.new_values,
    h.created_at
  from public.coach_admin_history h
  left join auth.users u on u.id = h.admin_user_id
  where h.coach_id = p_coach_id
  order by h.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_update_coach(
  p_coach_id uuid,
  p_status text,
  p_plan text,
  p_access_expires_at timestamptz,
  p_admin_notes text,
  p_status_note text default ''
)
returns table (
  coach_id uuid,
  status text,
  plan text,
  access_expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_plan text := coalesce(nullif(trim(coalesce(p_plan, '')), ''), 'Plano piloto');
  v_admin_notes text := trim(coalesce(p_admin_notes, ''));
  v_status_note text := trim(coalesce(p_status_note, ''));
  v_previous_status text;
  v_previous_expiry timestamptz;
  v_previous_status_note text;
  v_previous_plan text;
  v_previous_admin_notes text;
  v_previous jsonb;
  v_new jsonb;
  v_action text := 'Dados administrativos atualizados';
  v_now timestamptz := now();
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  if v_status not in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled') then
    raise exception 'Status de personal inválido.' using errcode = '22023';
  end if;
  if char_length(v_plan) > 80 then
    raise exception 'O plano deve ter no máximo 80 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_admin_notes) > 5000 then
    raise exception 'As observações devem ter no máximo 5.000 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_status_note) > 500 then
    raise exception 'A mensagem ao personal deve ter no máximo 500 caracteres.' using errcode = '22023';
  end if;

  select
    p.coach_status,
    p.coach_trial_ends_at,
    p.coach_status_note,
    coalesce(cas.plan, 'Plano piloto'),
    coalesce(cas.notes, '')
  into
    v_previous_status,
    v_previous_expiry,
    v_previous_status_note,
    v_previous_plan,
    v_previous_admin_notes
  from public.profiles p
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where p.user_id = p_coach_id
    and public.has_coach_capability(p.user_id)
  for update of p;

  if not found then
    raise exception 'Personal não encontrado.' using errcode = 'P0002';
  end if;

  v_previous := jsonb_build_object(
    'status', v_previous_status,
    'plan', v_previous_plan,
    'access_expires_at', v_previous_expiry,
    'status_note', v_previous_status_note,
    'admin_notes', v_previous_admin_notes
  );
  v_new := jsonb_build_object(
    'status', v_status,
    'plan', v_plan,
    'access_expires_at', p_access_expires_at,
    'status_note', v_status_note,
    'admin_notes', v_admin_notes
  );

  update public.profiles
  set coach_status = v_status,
      coach_trial_ends_at = p_access_expires_at,
      coach_status_note = v_status_note,
      updated_at = v_now
  where user_id = p_coach_id;

  insert into public.coach_admin_settings (coach_id, plan, notes, updated_at, updated_by)
  values (p_coach_id, v_plan, v_admin_notes, v_now, auth.uid())
  on conflict (coach_id) do update
    set plan = excluded.plan,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  if v_previous is distinct from v_new then
    v_action := case
      when v_previous_status = 'pending' and v_status = 'trial' then 'Personal aprovado para teste'
      when v_status = 'active' and v_previous_status <> 'active' then 'Acesso ativado'
      when v_status = 'suspended' and v_previous_status <> 'suspended' then 'Acesso suspenso'
      when v_status = 'cancelled' and v_previous_status <> 'cancelled' then 'Conta cancelada'
      when v_status = 'past_due' and v_previous_status <> 'past_due' then 'Pagamento marcado como atrasado'
      else v_action
    end;

    insert into public.coach_admin_history (
      coach_id, admin_user_id, action, previous_values, new_values
    ) values (
      p_coach_id, auth.uid(), v_action, v_previous, v_new
    );
  end if;

  return query
  select p.user_id, p.coach_status, cas.plan, p.coach_trial_ends_at,
         greatest(p.updated_at, cas.updated_at)
  from public.profiles p
  join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where p.user_id = p_coach_id;
end;
$$;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.coach_admin_settings from anon, authenticated;
revoke all on public.coach_admin_history from anon, authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.coach_admin_settings to authenticated;
grant select on public.coach_admin_history to authenticated;

revoke all on function public.is_platform_admin() from public, anon, authenticated;
revoke all on function public.has_coach_capability(uuid) from public, anon, authenticated;
revoke all on function public.admin_get_overview() from public, anon, authenticated;
revoke all on function public.admin_list_coaches(text, text) from public, anon, authenticated;
revoke all on function public.admin_get_coach(uuid) from public, anon, authenticated;
revoke all on function public.admin_list_coach_history(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_coach(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_list_coaches(text, text) to authenticated;
grant execute on function public.admin_get_coach(uuid) to authenticated;
grant execute on function public.admin_list_coach_history(uuid) to authenticated;
grant execute on function public.admin_update_coach(uuid, text, text, timestamptz, text, text) to authenticated;

-- Primeiro administrador da instalação. A conta precisa existir em
-- Authentication > Users antes da execução deste schema.
do $flowfit_admin_bootstrap$
declare
  v_admin_id uuid;
begin
  select u.id
    into v_admin_id
  from auth.users u
  where lower(u.email) = lower('recursaocausaexaustao@gmail.com')
  order by u.created_at
  limit 1;

  if v_admin_id is null then
    raise exception 'A conta recursaocausaexaustao@gmail.com ainda não existe em Authentication > Users.'
      using hint = 'Entre ou crie essa conta primeiro e execute o SQL novamente.';
  end if;

  insert into public.profiles (user_id, role, name, headline, coach_status, updated_at)
  select
    u.id,
    'admin',
    coalesce(nullif(split_part(u.email, '@', 1), ''), 'Administrador'),
    'Administrador da plataforma',
    'active',
    now()
  from auth.users u
  where u.id = v_admin_id
  on conflict (user_id) do update
    set role = 'admin',
        updated_at = now();

  insert into public.platform_admins (user_id, created_by)
  values (v_admin_id, v_admin_id)
  on conflict (user_id) do nothing;
end;
$flowfit_admin_bootstrap$;

commit;

-- Confirmação exibida ao final no SQL Editor.
select
  u.email as admin_email,
  pa.created_at as admin_since
from public.platform_admins pa
join auth.users u on u.id = pa.user_id
where lower(u.email) = lower('recursaocausaexaustao@gmail.com');

-- FlowFit - modo de treino focado e registro individual por serie.
-- Migracao aditiva/idempotente: preserva exercicios e sessoes existentes.

begin;

alter table public.workout_exercises
  add column if not exists instructions text not null default '',
  add column if not exists media_url text not null default '',
  add column if not exists media_type text not null default 'none';

alter table public.workout_set_logs
  add column if not exists set_number integer,
  add column if not exists set_kind text not null default 'working',
  add column if not exists completed_at timestamptz,
  add column if not exists workout_exercise_id text,
  add column if not exists discomfort text not null default 'none',
  add column if not exists discomfort_note text not null default '';

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

  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_set_logs_set_number_check'
      and conrelid = 'public.workout_set_logs'::regclass
  ) then
    alter table public.workout_set_logs
      add constraint workout_set_logs_set_number_check
      check (set_number is null or set_number > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_exercises_media_type_check'
      and conrelid = 'public.workout_exercises'::regclass
  ) then
    alter table public.workout_exercises
      add constraint workout_exercises_media_type_check
      check (media_type in ('none', 'image', 'video', 'youtube', 'external'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'workout_set_logs_discomfort_check'
      and conrelid = 'public.workout_set_logs'::regclass
  ) then
    alter table public.workout_set_logs
      add constraint workout_set_logs_discomfort_check
      check (discomfort in ('none', 'mild', 'pain'));
  end if;
end
$$;

drop index if exists public.workout_set_logs_session_exercise_set_idx;
create unique index if not exists workout_set_logs_session_item_set_idx
  on public.workout_set_logs (session_id, workout_exercise_id, set_number)
  where set_number is not null and workout_exercise_id is not null;

create or replace function public.publish_student_workout(
  p_workout jsonb,
  p_exercises jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_coach_id text := auth.uid()::text;
  v_workout_id text := trim(coalesce(p_workout ->> 'id', ''));
  v_student_id text := trim(coalesce(p_workout ->> 'student_id', ''));
  v_exercise jsonb;
  v_count integer := 0;
  v_media_url text;
  v_media_type text;
  v_result jsonb;
begin
  if v_user_id is null or not public.can_operate_as_coach() then
    raise exception 'coach_access_blocked';
  end if;

  if v_workout_id = '' or v_student_id = '' then
    raise exception 'workout_id_and_student_required';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id = v_student_id and s.coach_id = v_coach_id
  ) then
    raise exception 'student_not_found_for_coach';
  end if;

  if exists (
    select 1 from public.workout_plans wp
    where wp.id = v_workout_id and wp.coach_id <> v_coach_id
  ) then
    raise exception 'workout_owned_by_another_coach';
  end if;

  if jsonb_typeof(coalesce(p_exercises, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) = 0 then
    raise exception 'workout_requires_exercises';
  end if;

  insert into public.workout_plans (
    id, coach_id, student_id, student_key, owner, code, title, focus,
    estimated_minutes, last_done_label, source, status, starts_at,
    published_at, version, updated_at
  ) values (
    v_workout_id,
    v_coach_id,
    v_student_id,
    trim(coalesce(p_workout ->> 'student_key', 'aluno')),
    trim(coalesce(p_workout ->> 'owner', 'Aluno')),
    trim(coalesce(p_workout ->> 'code', 'A')),
    trim(coalesce(p_workout ->> 'title', 'Novo treino')),
    trim(coalesce(p_workout ->> 'focus', 'Prescricao personalizada')),
    greatest(1, coalesce((p_workout ->> 'estimated_minutes')::integer, 45)),
    trim(coalesce(p_workout ->> 'last_done_label', 'novo')),
    trim(coalesce(p_workout ->> 'source', 'professor')),
    'published',
    coalesce((p_workout ->> 'starts_at')::timestamptz, now()),
    coalesce((p_workout ->> 'published_at')::timestamptz, now()),
    greatest(1, coalesce((p_workout ->> 'version')::integer, 1)),
    now()
  )
  on conflict (id) do update set
    student_id = excluded.student_id,
    student_key = excluded.student_key,
    owner = excluded.owner,
    code = excluded.code,
    title = excluded.title,
    focus = excluded.focus,
    estimated_minutes = excluded.estimated_minutes,
    last_done_label = excluded.last_done_label,
    source = excluded.source,
    status = 'published',
    starts_at = excluded.starts_at,
    published_at = excluded.published_at,
    version = excluded.version,
    updated_at = now();

  delete from public.workout_exercises
  where workout_id = v_workout_id and coach_id = v_coach_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    v_media_url := trim(coalesce(v_exercise ->> 'media_url', ''));
    v_media_type := lower(trim(coalesce(v_exercise ->> 'media_type', case when v_media_url = '' then 'none' else 'external' end)));
    if v_media_url <> '' and v_media_url !~* '^https://' then
      raise exception 'exercise_media_url_requires_https';
    end if;
    if v_media_type not in ('none', 'image', 'video', 'youtube', 'external') then
      raise exception 'exercise_media_type_invalid';
    end if;

    insert into public.workout_exercises (
      id, workout_id, coach_id, position, name, target, prescription,
      load, rest, tempo, rir, notes, instructions, media_url, media_type, updated_at
    ) values (
      trim(coalesce(v_exercise ->> 'id', v_workout_id || '-ex-' || v_count::text)),
      v_workout_id,
      v_coach_id,
      v_count,
      trim(coalesce(v_exercise ->> 'name', 'Exercicio')),
      trim(coalesce(v_exercise ->> 'target', 'Personalizado')),
      trim(coalesce(v_exercise ->> 'prescription', '3 x 10')),
      trim(coalesce(v_exercise ->> 'load', '0 kg')),
      trim(coalesce(v_exercise ->> 'rest', '60s')),
      trim(coalesce(v_exercise ->> 'tempo', '2-0-2')),
      trim(coalesce(v_exercise ->> 'rir', '2')),
      trim(coalesce(v_exercise ->> 'notes', 'Criado no painel do professor.')),
      trim(coalesce(v_exercise ->> 'instructions', '')),
      v_media_url,
      v_media_type,
      now()
    );
    v_count := v_count + 1;
  end loop;

  update public.students
  set workout = 'Treino ' || trim(coalesce(p_workout ->> 'code', 'A')) || ' - ' || trim(coalesce(p_workout ->> 'title', 'Novo treino')),
      next_action = 'Ver treino publicado',
      updated_at = now()
  where id = v_student_id and coach_id = v_coach_id;

  select jsonb_build_object(
    'workout_id', wp.id,
    'student_id', wp.student_id,
    'status', wp.status,
    'version', wp.version,
    'exercise_count', v_count,
    'updated_at', wp.updated_at
  ) into v_result
  from public.workout_plans wp
  where wp.id = v_workout_id and wp.coach_id = v_coach_id;

  return v_result;
end;
$$;

revoke all on function public.publish_student_workout(jsonb, jsonb) from public, anon;
grant execute on function public.publish_student_workout(jsonb, jsonb) to authenticated, service_role;

-- Finaliza uma sessão em uma única transação. Séries individuais são a fonte
-- da verdade; totais da sessão são recalculados no servidor em cada reenvio.
create or replace function public.sync_workout_session(
  p_session jsonb,
  p_set_logs jsonb,
  p_feedback jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id text := trim(coalesce(p_session ->> 'id', ''));
  v_student_id text := trim(coalesce(p_session ->> 'student_id', ''));
  v_coach_id text := trim(coalesce(p_session ->> 'coach_id', ''));
  v_workout_id text := trim(coalesce(p_session ->> 'workout_id', ''));
  v_total_sets integer := greatest(0, coalesce(nullif(p_session ->> 'total_sets', '')::integer, 0));
  v_completed_sets integer := 0;
  v_volume numeric := 0;
  v_log jsonb;
  v_set_number integer;
  v_load numeric;
  v_reps integer;
  v_log_id text;
  v_workout_exercise_id text;
  v_discomfort text;
  v_feedback_id text;
  v_effort text;
  v_pain text;
  v_status text;
begin
  if v_user_id is null then raise exception 'student_auth_required'; end if;
  if v_session_id = '' or v_student_id = '' or v_coach_id = '' then
    raise exception 'session_student_and_coach_required';
  end if;
  if jsonb_typeof(coalesce(p_set_logs, '[]'::jsonb)) <> 'array' then
    raise exception 'set_logs_must_be_array';
  end if;
  if not exists (
    select 1 from public.students s
    where s.id = v_student_id
      and s.coach_id = v_coach_id
      and s.student_user_id = v_user_id
  ) then
    raise exception 'student_session_access_denied';
  end if;
  if exists (
    select 1 from public.workout_sessions ws
    where ws.id = v_session_id
      and (ws.student_id is distinct from v_student_id or ws.coach_id <> v_coach_id)
  ) then
    raise exception 'session_owned_by_another_student';
  end if;
  if v_workout_id <> '' and not exists (
    select 1 from public.workout_plans wp
    where wp.id = v_workout_id
      and wp.student_id = v_student_id
      and wp.coach_id = v_coach_id
  ) then
    raise exception 'workout_not_available_for_student';
  end if;

  insert into public.workout_sessions (
    id, coach_id, student_id, student_key, student_email, workout_id,
    workout_code, workout_title, workout_version, status, total_sets,
    completed_sets, volume_kg, duration_seconds, started_at, finished_at,
    created_at, updated_at
  ) values (
    v_session_id, v_coach_id, v_student_id,
    trim(coalesce(p_session ->> 'student_key', 'aluno')),
    nullif(trim(coalesce(p_session ->> 'student_email', '')), ''),
    nullif(v_workout_id, ''), trim(coalesce(p_session ->> 'workout_code', 'A')),
    trim(coalesce(p_session ->> 'workout_title', 'Treino')),
    greatest(1, coalesce(nullif(p_session ->> 'workout_version', '')::integer, 1)),
    'partial', v_total_sets, 0, 0,
    greatest(0, coalesce(nullif(p_session ->> 'duration_seconds', '')::integer, 0)),
    coalesce(nullif(p_session ->> 'started_at', '')::timestamptz, now()),
    coalesce(nullif(p_session ->> 'finished_at', '')::timestamptz, now()),
    now(), now()
  )
  on conflict (id) do update set
    workout_id = excluded.workout_id,
    workout_code = excluded.workout_code,
    workout_title = excluded.workout_title,
    workout_version = excluded.workout_version,
    total_sets = excluded.total_sets,
    duration_seconds = excluded.duration_seconds,
    started_at = excluded.started_at,
    finished_at = excluded.finished_at,
    updated_at = now();

  -- Ao reenviar a mesma sessao, substitui somente os logs dessa sessao.
  -- Isso remove eventuais agregados legados para que as series individuais
  -- sejam a unica fonte da verdade, sem duplicar volume ou contagem.
  delete from public.workout_set_logs where session_id = v_session_id;

  for v_log in select value from jsonb_array_elements(coalesce(p_set_logs, '[]'::jsonb))
  loop
    v_set_number := greatest(1, coalesce(nullif(v_log ->> 'set_number', '')::integer, 1));
    v_load := greatest(0, coalesce(nullif(v_log ->> 'load_kg', '')::numeric, 0));
    v_reps := greatest(0, coalesce(nullif(v_log ->> 'reps', '')::integer, 0));
    v_log_id := trim(coalesce(v_log ->> 'id', ''));
    v_workout_exercise_id := trim(coalesce(v_log ->> 'workout_exercise_id', v_log ->> 'exercise_id', ''));
    v_discomfort := lower(trim(coalesce(v_log ->> 'discomfort', 'none')));
    if v_log_id = '' or v_workout_exercise_id = '' or v_reps < 1 then
      raise exception 'invalid_individual_set_log';
    end if;
    if v_discomfort not in ('none', 'mild', 'pain') then
      raise exception 'invalid_set_discomfort';
    end if;
    if exists (
      select 1 from public.workout_set_logs wsl
      where wsl.id = v_log_id and wsl.session_id <> v_session_id
    ) then
      raise exception 'set_log_owned_by_another_session';
    end if;

    insert into public.workout_set_logs (
      id, session_id, coach_id, workout_id, exercise_id, workout_exercise_id,
      position, exercise_name, target, prescription, planned_sets,
      completed_sets, load_kg, reps, volume_kg, rir, notes, set_number,
      set_kind, completed_at, discomfort, discomfort_note, created_at
    ) values (
      v_log_id, v_session_id, v_coach_id, nullif(v_workout_id, ''),
      nullif(trim(coalesce(v_log ->> 'exercise_id', '')), ''), v_workout_exercise_id,
      greatest(0, coalesce(nullif(v_log ->> 'position', '')::integer, 0)),
      trim(coalesce(v_log ->> 'exercise_name', 'Exercício')),
      trim(coalesce(v_log ->> 'target', 'Personalizado')),
      trim(coalesce(v_log ->> 'prescription', '')),
      greatest(0, coalesce(nullif(v_log ->> 'planned_sets', '')::integer, 0)),
      1, v_load, v_reps, v_load * v_reps,
      trim(coalesce(v_log ->> 'rir', '')),
      trim(coalesce(v_log ->> 'notes', '')),
      v_set_number, trim(coalesce(v_log ->> 'set_kind', 'working')),
      coalesce(nullif(v_log ->> 'completed_at', '')::timestamptz, now()),
      v_discomfort, trim(coalesce(v_log ->> 'discomfort_note', '')), now()
    )
    on conflict (id) do update set
      load_kg = excluded.load_kg, reps = excluded.reps,
      volume_kg = excluded.volume_kg, completed_at = excluded.completed_at,
      discomfort = excluded.discomfort, discomfort_note = excluded.discomfort_note;

    v_completed_sets := v_completed_sets + 1;
    v_volume := v_volume + (v_load * v_reps);
  end loop;

  if v_completed_sets = 0 then raise exception 'session_requires_completed_set'; end if;
  v_status := case when v_total_sets > 0 and v_completed_sets >= v_total_sets then 'completed' else 'partial' end;
  update public.workout_sessions
  set status = v_status, completed_sets = v_completed_sets,
      volume_kg = v_volume, updated_at = now()
  where id = v_session_id;

  v_feedback_id := trim(coalesce(p_feedback ->> 'id', v_session_id || '-feedback'));
  v_effort := lower(trim(coalesce(p_feedback ->> 'effort', 'ok')));
  v_pain := lower(trim(coalesce(p_feedback ->> 'pain', 'none')));
  if v_effort not in ('easy', 'ok', 'hard') or v_pain not in ('none', 'mild', 'pain') then
    raise exception 'invalid_workout_feedback';
  end if;
  if exists (
    select 1 from public.workout_feedback wf
    where wf.id = v_feedback_id and wf.session_id <> v_session_id
  ) then
    raise exception 'feedback_owned_by_another_session';
  end if;

  insert into public.workout_feedback (id, session_id, coach_id, student_id, effort, pain, note, created_at)
  values (
    v_feedback_id,
    v_session_id, v_coach_id, v_student_id,
    v_effort,
    v_pain,
    trim(coalesce(p_feedback ->> 'note', '')), now()
  )
  on conflict (id) do update set
    effort = excluded.effort, pain = excluded.pain, note = excluded.note;

  return jsonb_build_object(
    'session_id', v_session_id, 'status', v_status,
    'completed_sets', v_completed_sets, 'volume_kg', v_volume,
    'synced_at', now()
  );
end;
$$;

revoke all on function public.sync_workout_session(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_workout_session(jsonb, jsonb, jsonb) to authenticated, service_role;

commit;
