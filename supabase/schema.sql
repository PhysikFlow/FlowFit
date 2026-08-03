-- ============================================================================
-- Supabase: schema piloto do FlowFit
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
--
-- O piloto ainda nao tem login. Por isso, as policies permitem apenas o tenant
-- demo (`coach-demo`) usando a anon key. Antes de producao, troque essas
-- policies por auth.uid()/claims de app_metadata mapeando personal -> coach_id.
-- ============================================================================

create table if not exists public.brand_theme (
  coach_id   text primary key,          -- tenant: um personal = uma marca
  brand_name text not null default 'FlowFit',
  tagline    text not null default 'Seu treino, no seu ritmo',
  accent     text not null default '#7667ff',
  mode       text not null default 'dark',
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id          text primary key,
  coach_id    text not null default 'coach-demo',
  student_key text not null,
  name        text not null,
  initials    text not null default 'AL',
  goal        text not null default 'Hipertrofia',
  status      text not null default 'Ativo',
  plan        text not null default 'Novo',
  workout     text not null default 'Sem treino atribuido',
  adherence   integer not null default 0 check (adherence >= 0 and adherence <= 100),
  next_action text not null default 'Criar primeiro treino',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (coach_id, student_key)
);

create table if not exists public.workout_plans (
  id                text primary key,
  coach_id          text not null default 'coach-demo',
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
  coach_id     text not null default 'coach-demo',
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

create index if not exists students_coach_student_key_idx
  on public.students (coach_id, student_key);

create index if not exists workout_plans_coach_student_updated_idx
  on public.workout_plans (coach_id, student_key, updated_at desc);

create index if not exists workout_exercises_workout_position_idx
  on public.workout_exercises (workout_id, position);

-- Permissoes para o papel anon (cliente de navegador usando a anon key).
-- Em projetos novos, confirme tambem nas configuracoes da Data API se as
-- tabelas publicas estao expostas.
grant usage on schema public to anon;
grant select, insert, update on public.brand_theme to anon;
grant select, insert, update, delete on public.students to anon;
grant select, insert, update, delete on public.workout_plans to anon;
grant select, insert, update, delete on public.workout_exercises to anon;

-- RLS: isolar dados por tenant desde a primeira API.
alter table public.brand_theme enable row level security;
alter table public.students enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_exercises enable row level security;

-- Piloto: apenas o tenant demo (coach-demo) e acessivel enquanto nao existe
-- autenticacao. Quando o login chegar, trocar por policies baseadas em
-- auth.uid()/auth.jwt() mapeando personal -> coach_id.
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

create policy "brand_theme_select_demo"
  on public.brand_theme for select
  to anon
  using (coach_id = 'coach-demo');

create policy "brand_theme_insert_demo"
  on public.brand_theme for insert
  to anon
  with check (coach_id = 'coach-demo');

create policy "brand_theme_update_demo"
  on public.brand_theme for update
  to anon
  using (coach_id = 'coach-demo')
  with check (coach_id = 'coach-demo');

create policy "students_select_demo"
  on public.students for select
  to anon
  using (coach_id = 'coach-demo');

create policy "students_insert_demo"
  on public.students for insert
  to anon
  with check (coach_id = 'coach-demo');

create policy "students_update_demo"
  on public.students for update
  to anon
  using (coach_id = 'coach-demo')
  with check (coach_id = 'coach-demo');

create policy "students_delete_demo"
  on public.students for delete
  to anon
  using (coach_id = 'coach-demo');

create policy "workout_plans_select_demo"
  on public.workout_plans for select
  to anon
  using (coach_id = 'coach-demo');

create policy "workout_plans_insert_demo"
  on public.workout_plans for insert
  to anon
  with check (coach_id = 'coach-demo');

create policy "workout_plans_update_demo"
  on public.workout_plans for update
  to anon
  using (coach_id = 'coach-demo')
  with check (coach_id = 'coach-demo');

create policy "workout_plans_delete_demo"
  on public.workout_plans for delete
  to anon
  using (coach_id = 'coach-demo');

create policy "workout_exercises_select_demo"
  on public.workout_exercises for select
  to anon
  using (coach_id = 'coach-demo');

create policy "workout_exercises_insert_demo"
  on public.workout_exercises for insert
  to anon
  with check (coach_id = 'coach-demo');

create policy "workout_exercises_update_demo"
  on public.workout_exercises for update
  to anon
  using (coach_id = 'coach-demo')
  with check (coach_id = 'coach-demo');

create policy "workout_exercises_delete_demo"
  on public.workout_exercises for delete
  to anon
  using (coach_id = 'coach-demo');

-- Linha inicial do tenant demo.
insert into public.brand_theme (coach_id, brand_name, tagline, accent, mode)
values ('coach-demo', 'FlowFit', 'Seu treino, no seu ritmo', '#7667ff', 'dark')
on conflict (coach_id) do nothing;
