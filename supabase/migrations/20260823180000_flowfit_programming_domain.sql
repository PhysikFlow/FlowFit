begin;

create table if not exists public.exercise_definitions (
  id text primary key,
  coach_id text not null,
  name text not null,
  aliases text[] not null default '{}',
  muscles text[] not null default '{}',
  equipment text not null default '',
  instructions text not null default '',
  media_url text not null default '',
  media_type text not null default 'none',
  media_metadata jsonb not null default '{}'::jsonb,
  source text not null default 'custom' check (source in ('system', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (media_url = '' or media_url ~* '^https://'),
  check (jsonb_typeof(media_metadata) = 'object' and pg_column_size(media_metadata) <= 4096)
);

create table if not exists public.workout_templates (
  id text primary key,
  coach_id text not null,
  name text not null,
  objective text not null default '',
  level text not null default '',
  current_revision integer not null default 1 check (current_revision > 0),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 262144)
);

create table if not exists public.workout_template_revisions (
  id text primary key,
  template_id text not null references public.workout_templates(id) on delete cascade,
  coach_id text not null,
  revision integer not null check (revision > 0),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (template_id, revision),
  check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 262144)
);

create table if not exists public.program_templates (
  id text primary key,
  coach_id text not null,
  name text not null,
  objective text not null default '',
  level text not null default '',
  weeks integer not null default 1 check (weeks between 1 and 104),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 524288)
);

create table if not exists public.program_assignments (
  id text primary key,
  coach_id text not null,
  student_id text not null references public.students(id) on delete cascade,
  program_id text not null references public.program_templates(id) on delete restrict,
  program_revision integer not null default 1 check (program_revision > 0),
  starts_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_plans
  add column if not exists template_id text references public.workout_templates(id) on delete set null,
  add column if not exists program_assignment_id text references public.program_assignments(id) on delete set null,
  add column if not exists editorial_status text not null default 'published',
  add column if not exists schema_version integer not null default 1,
  add column if not exists level text not null default '';

alter table public.workout_plans drop constraint if exists workout_plans_editorial_status_check;
alter table public.workout_plans add constraint workout_plans_editorial_status_check
  check (editorial_status in ('draft', 'published', 'archived'));
alter table public.workout_plans drop constraint if exists workout_plans_schema_version_check;
alter table public.workout_plans add constraint workout_plans_schema_version_check check (schema_version in (1, 2));

alter table public.workout_exercises
  add column if not exists exercise_definition_id text references public.exercise_definitions(id) on delete set null,
  add column if not exists sets_count integer,
  add column if not exists reps_target text not null default '',
  add column if not exists rpe text not null default '',
  add column if not exists block_id text not null default '',
  add column if not exists block_type text not null default 'standard',
  add column if not exists block_label text not null default '',
  add column if not exists alternatives jsonb not null default '[]'::jsonb;

update public.workout_exercises
set sets_count = greatest(1, coalesce(nullif(substring(prescription from '^\s*([0-9]+)'), '')::integer, 3)),
    reps_target = coalesce(nullif(trim(substring(prescription from '[x×]\s*(.+)$')), ''), '10')
where sets_count is null or reps_target = '';

alter table public.workout_exercises alter column sets_count set default 3;
alter table public.workout_exercises alter column sets_count set not null;
alter table public.workout_exercises drop constraint if exists workout_exercises_sets_count_check;
alter table public.workout_exercises add constraint workout_exercises_sets_count_check check (sets_count > 0);
alter table public.workout_exercises drop constraint if exists workout_exercises_block_type_check;
alter table public.workout_exercises add constraint workout_exercises_block_type_check
  check (block_type in ('standard', 'warmup', 'superset', 'circuit', 'main', 'finisher'));
alter table public.workout_exercises drop constraint if exists workout_exercises_alternatives_check;
alter table public.workout_exercises add constraint workout_exercises_alternatives_check
  check (jsonb_typeof(alternatives) = 'array' and pg_column_size(alternatives) <= 16384);

create table if not exists public.workout_revisions (
  id text primary key,
  workout_id text not null references public.workout_plans(id) on delete cascade,
  coach_id text not null,
  student_id text not null references public.students(id) on delete cascade,
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (workout_id, revision),
  check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 524288)
);

alter table public.workout_plans
  add column if not exists current_revision_id text references public.workout_revisions(id) on delete set null;

alter table public.workout_sessions
  add column if not exists workout_revision_id text references public.workout_revisions(id) on delete set null,
  add column if not exists prescription_snapshot jsonb not null default '{}'::jsonb;

create index if not exists exercise_definitions_coach_name_idx on public.exercise_definitions (coach_id, lower(name));
create index if not exists workout_templates_coach_updated_idx on public.workout_templates (coach_id, updated_at desc);
create index if not exists program_templates_coach_updated_idx on public.program_templates (coach_id, updated_at desc);
create index if not exists program_assignments_student_status_idx on public.program_assignments (student_id, status, starts_at desc);
create index if not exists workout_revisions_workout_revision_idx on public.workout_revisions (workout_id, revision desc);

alter table public.exercise_definitions enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_revisions enable row level security;
alter table public.program_templates enable row level security;
alter table public.program_assignments enable row level security;
alter table public.workout_revisions enable row level security;

create policy "exercise_definitions_coach_all" on public.exercise_definitions for all to authenticated
  using (coach_id = auth.uid()::text and public.can_operate_as_coach())
  with check (coach_id = auth.uid()::text and public.can_operate_as_coach());
create policy "workout_templates_coach_all" on public.workout_templates for all to authenticated
  using (coach_id = auth.uid()::text and public.can_operate_as_coach())
  with check (coach_id = auth.uid()::text and public.can_operate_as_coach());
create policy "workout_template_revisions_coach_all" on public.workout_template_revisions for all to authenticated
  using (coach_id = auth.uid()::text and public.can_operate_as_coach())
  with check (coach_id = auth.uid()::text and public.can_operate_as_coach());
create policy "program_templates_coach_all" on public.program_templates for all to authenticated
  using (coach_id = auth.uid()::text and public.can_operate_as_coach())
  with check (coach_id = auth.uid()::text and public.can_operate_as_coach());
create policy "program_assignments_owner_select" on public.program_assignments for select to authenticated
  using (coach_id = auth.uid()::text or exists (
    select 1 from public.students s where s.id = program_assignments.student_id and s.student_user_id = auth.uid()
  ));
create policy "program_assignments_coach_write" on public.program_assignments for all to authenticated
  using (coach_id = auth.uid()::text and public.can_operate_as_coach())
  with check (coach_id = auth.uid()::text and public.can_operate_as_coach());
create policy "workout_revisions_owner_select" on public.workout_revisions for select to authenticated
  using (coach_id = auth.uid()::text or exists (
    select 1 from public.students s where s.id = workout_revisions.student_id and s.student_user_id = auth.uid()
  ));
create policy "workout_revisions_coach_insert" on public.workout_revisions for insert to authenticated
  with check (coach_id = auth.uid()::text and public.can_operate_as_coach());

grant select, insert, update, delete on public.exercise_definitions to authenticated;
grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.workout_template_revisions to authenticated;
grant select, insert, update, delete on public.program_templates to authenticated;
grant select, insert, update, delete on public.program_assignments to authenticated;
grant select, insert on public.workout_revisions to authenticated;

create or replace function public.publish_student_workout_v2(p_workout jsonb, p_exercises jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_workout jsonb := coalesce(p_workout, '{}'::jsonb);
  v_workout_id text := trim(coalesce(v_workout ->> 'id', ''));
  v_student_id text := trim(coalesce(v_workout ->> 'student_id', ''));
  v_requested_revision integer := greatest(1, coalesce((v_workout ->> 'version')::integer, 1));
  v_revision integer;
  v_revision_id text;
  v_result jsonb;
begin
  if auth.uid() is null or not public.can_operate_as_coach() then raise exception 'coach_access_blocked'; end if;
  perform pg_advisory_xact_lock(hashtext(v_workout_id));
  select greatest(v_requested_revision, coalesce(max(wr.revision), 0) + 1)
    into v_revision from public.workout_revisions wr where wr.workout_id = v_workout_id;
  v_workout := jsonb_set(v_workout, '{version}', to_jsonb(v_revision), true);
  v_workout := jsonb_set(v_workout, '{schema_version}', '2'::jsonb, true);
  v_result := public.publish_student_workout(v_workout, p_exercises);

  update public.workout_exercises we set
    exercise_definition_id = case when exists (
      select 1 from public.exercise_definitions ed
      where ed.id = nullif(ex.exercise ->> 'exercise_definition_id', '') and ed.coach_id = auth.uid()::text
    ) then nullif(ex.exercise ->> 'exercise_definition_id', '') else null end,
    sets_count = greatest(1, coalesce((ex.exercise ->> 'sets_count')::integer,
      nullif(substring(ex.exercise ->> 'prescription' from '^\s*([0-9]+)'), '')::integer, 3)),
    reps_target = coalesce(nullif(ex.exercise ->> 'reps_target', ''),
      nullif(trim(substring(ex.exercise ->> 'prescription' from '[x×]\s*(.+)$')), ''), '10'),
    rpe = coalesce(ex.exercise ->> 'rpe', ''),
    block_id = coalesce(ex.exercise ->> 'block_id', ''),
    block_type = case when ex.exercise ->> 'block_type' in ('standard','warmup','superset','circuit','main','finisher')
      then ex.exercise ->> 'block_type' else 'standard' end,
    block_label = coalesce(ex.exercise ->> 'block_label', ''),
    alternatives = case when jsonb_typeof(ex.exercise -> 'alternatives') = 'array' then ex.exercise -> 'alternatives' else '[]'::jsonb end
  from jsonb_array_elements(p_exercises) with ordinality as ex(exercise, position)
  where we.workout_id = v_workout_id
    and we.coach_id = auth.uid()::text
    and we.id = trim(coalesce(ex.exercise ->> 'id', v_workout_id || '-ex-' || (ex.position - 1)::text));

  v_revision_id := v_workout_id || '-revision-' || v_revision::text;
  insert into public.workout_revisions (id, workout_id, coach_id, student_id, revision, snapshot)
  values (v_revision_id, v_workout_id, auth.uid()::text, v_student_id, v_revision,
    jsonb_build_object('schemaVersion', 2, 'workout', v_workout, 'exercises', p_exercises))
  on conflict (workout_id, revision) do nothing;

  update public.workout_plans set
    current_revision_id = v_revision_id,
    template_id = case when exists (
      select 1 from public.workout_templates wt
      where wt.id = nullif(v_workout ->> 'template_id', '') and wt.coach_id = auth.uid()::text
    ) then nullif(v_workout ->> 'template_id', '') else null end,
    program_assignment_id = case when exists (
      select 1 from public.program_assignments pa
      where pa.id = nullif(v_workout ->> 'program_assignment_id', '') and pa.coach_id = auth.uid()::text
    ) then nullif(v_workout ->> 'program_assignment_id', '') else null end,
    editorial_status = 'published',
    schema_version = 2,
    level = coalesce(v_workout ->> 'level', ''),
    version = v_revision
  where id = v_workout_id and coach_id = auth.uid()::text;

  return v_result || jsonb_build_object('revision_id', v_revision_id, 'version', v_revision, 'schema_version', 2);
end;
$$;

revoke all on function public.publish_student_workout_v2(jsonb, jsonb) from public, anon;
grant execute on function public.publish_student_workout_v2(jsonb, jsonb) to authenticated, service_role;

create or replace function public.sync_workout_session_v2(p_session jsonb, p_set_logs jsonb, p_feedback jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
  v_session_id text := trim(coalesce(p_session ->> 'id', ''));
  v_revision_id text := nullif(trim(coalesce(p_session ->> 'workout_revision_id', '')), '');
  v_snapshot jsonb := coalesce(p_session -> 'prescription_snapshot', '{}'::jsonb);
begin
  v_result := public.sync_workout_session(p_session, p_set_logs, p_feedback);
  if jsonb_typeof(v_snapshot) <> 'object' or pg_column_size(v_snapshot) > 524288 then
    raise exception 'session_prescription_snapshot_invalid';
  end if;
  update public.workout_sessions ws set
    workout_revision_id = case when exists (
      select 1 from public.workout_revisions wr
      where wr.id = v_revision_id and wr.workout_id = ws.workout_id and wr.student_id = ws.student_id
    ) then v_revision_id else null end,
    prescription_snapshot = v_snapshot
  where ws.id = v_session_id;
  return v_result || jsonb_build_object('workout_revision_id', v_revision_id);
end;
$$;

revoke all on function public.sync_workout_session_v2(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_workout_session_v2(jsonb, jsonb, jsonb) to authenticated, service_role;

commit;
