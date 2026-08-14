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

  alter table public.workout_exercises
    drop constraint if exists workout_exercises_media_type_check;
  alter table public.workout_exercises
    add constraint workout_exercises_media_type_check
    check (media_type in ('none', 'image', 'gif', 'video', 'youtube', 'external'));

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
set search_path = pg_catalog, public
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
    if v_media_type not in ('none', 'image', 'gif', 'video', 'youtube', 'external') then
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
  set workout = trim(coalesce(p_workout ->> 'title', 'Novo treino')),
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
set search_path = pg_catalog, public
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
