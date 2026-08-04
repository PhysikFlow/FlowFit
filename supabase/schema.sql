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
-- - profiles.role = 'coach' ou 'student'
-- - professor/personal grava dados com coach_id = auth.uid()::text
-- - aluno acessa dados pelo email autenticado que o professor cadastrou
-- - tabelas publicas ficam com RLS habilitado; anon nao acessa dados reais
-- ============================================================================

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('coach', 'student')),
  name       text not null,
  headline   text not null default 'Personal trainer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
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

-- Migração segura para bancos que já tinham o schema piloto antigo.
alter table public.profiles
  add column if not exists headline text not null default 'Personal trainer';

alter table public.brand_theme
  add column if not exists background_color text not null default '#090b10',
  add column if not exists surface_color text not null default '#151922',
  add column if not exists text_color text not null default '#f7f7fa',
  add column if not exists font_preset text not null default 'system',
  add column if not exists radius_preset text not null default 'soft',
  add column if not exists background_style text not null default 'aurora';

alter table public.students
  add column if not exists student_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text;

alter table public.students alter column coach_id drop default;
alter table public.workout_plans alter column coach_id drop default;
alter table public.workout_exercises alter column coach_id drop default;

alter table public.students
  drop constraint if exists students_coach_id_student_key_key;

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists students_coach_student_key_idx
  on public.students (coach_id, student_key);

create index if not exists students_email_idx
  on public.students (lower(email));

create unique index if not exists students_coach_email_unique_idx
  on public.students (coach_id, lower(email))
  where email is not null;

create index if not exists students_student_user_id_idx
  on public.students (student_user_id);

create index if not exists workout_plans_coach_student_updated_idx
  on public.workout_plans (coach_id, student_key, updated_at desc);

create index if not exists workout_plans_student_id_idx
  on public.workout_plans (student_id);

create index if not exists workout_exercises_workout_position_idx
  on public.workout_exercises (workout_id, position);

-- Data API: acesso anonimo nao le dados reais. Auth API continua funcionando.
revoke all on public.profiles from anon;
revoke all on public.brand_theme from anon;
revoke all on public.students from anon;
revoke all on public.workout_plans from anon;
revoke all on public.workout_exercises from anon;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.brand_theme to authenticated;
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.workout_plans to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;

alter table public.profiles enable row level security;
alter table public.brand_theme enable row level security;
alter table public.students enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_exercises enable row level security;

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
drop policy if exists "students_delete_coach" on public.students;
drop policy if exists "workout_plans_select_authenticated_owner" on public.workout_plans;
drop policy if exists "workout_plans_insert_coach" on public.workout_plans;
drop policy if exists "workout_plans_update_coach" on public.workout_plans;
drop policy if exists "workout_plans_delete_coach" on public.workout_plans;
drop policy if exists "workout_exercises_select_authenticated_owner" on public.workout_exercises;
drop policy if exists "workout_exercises_insert_coach" on public.workout_exercises;
drop policy if exists "workout_exercises_update_coach" on public.workout_exercises;
drop policy if exists "workout_exercises_delete_coach" on public.workout_exercises;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

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
        and (
          s.student_user_id = (select auth.uid())
          or lower(s.email) = lower((select auth.jwt() ->> 'email'))
        )
    )
  );

create policy "brand_theme_insert_coach"
  on public.brand_theme for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'coach'
    )
  );

create policy "brand_theme_update_coach"
  on public.brand_theme for update
  to authenticated
  using (coach_id = (select auth.uid())::text)
  with check (coach_id = (select auth.uid())::text);

create policy "students_select_authenticated_owner"
  on public.students for select
  to authenticated
  using (
    coach_id = (select auth.uid())::text
    or student_user_id = (select auth.uid())
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );

create policy "students_insert_coach"
  on public.students for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'coach'
    )
  );

create policy "students_update_coach"
  on public.students for update
  to authenticated
  using (coach_id = (select auth.uid())::text)
  with check (coach_id = (select auth.uid())::text);

create policy "students_delete_coach"
  on public.students for delete
  to authenticated
  using (coach_id = (select auth.uid())::text);

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
        and (
          s.student_user_id = (select auth.uid())
          or lower(s.email) = lower((select auth.jwt() ->> 'email'))
        )
    )
  );

create policy "workout_plans_insert_coach"
  on public.workout_plans for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'coach'
    )
  );

create policy "workout_plans_update_coach"
  on public.workout_plans for update
  to authenticated
  using (coach_id = (select auth.uid())::text)
  with check (coach_id = (select auth.uid())::text);

create policy "workout_plans_delete_coach"
  on public.workout_plans for delete
  to authenticated
  using (coach_id = (select auth.uid())::text);

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
        and (
          s.student_user_id = (select auth.uid())
          or lower(s.email) = lower((select auth.jwt() ->> 'email'))
        )
    )
  );

create policy "workout_exercises_insert_coach"
  on public.workout_exercises for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role = 'coach'
    )
  );

create policy "workout_exercises_update_coach"
  on public.workout_exercises for update
  to authenticated
  using (coach_id = (select auth.uid())::text)
  with check (coach_id = (select auth.uid())::text);

create policy "workout_exercises_delete_coach"
  on public.workout_exercises for delete
  to authenticated
  using (coach_id = (select auth.uid())::text);
