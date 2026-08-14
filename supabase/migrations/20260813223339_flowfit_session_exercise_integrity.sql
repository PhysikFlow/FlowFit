-- FlowFit Fase 4: validação de exercícios recebidos na sincronização.
-- Migration aditiva. Não remove nem reescreve dados existentes.
--
-- A validação aceita:
--   * o id persistido em workout_exercises;
--   * o id sintético ...-occurrence-N usado quando o mesmo exercício aparece
--     mais de uma vez no snapshot do frontend;
--   * payloads legados agregados (sem set_number) cujo workout_exercise_id é
--     exatamente o exercise_id legado;
--   * sessões legadas sem workout_id, que não possuem catálogo para validar.
-- Séries individualizadas com workout_id exigem pertencimento ao treino.

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
  v_raw_set_number text;
  v_is_legacy_log boolean;
  v_load numeric;
  v_reps integer;
  v_log_id text;
  v_workout_exercise_id text;
  v_legacy_exercise_id text;
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
  if jsonb_array_length(coalesce(p_set_logs, '[]'::jsonb)) > 500 then
    raise exception 'session_too_many_set_logs';
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

  perform 1 from public.workout_sessions where id = v_session_id for update;
  delete from public.workout_set_logs where session_id = v_session_id;

  for v_log in select value from jsonb_array_elements(coalesce(p_set_logs, '[]'::jsonb))
  loop
    v_raw_set_number := nullif(trim(coalesce(v_log ->> 'set_number', '')), '');
    v_is_legacy_log := v_raw_set_number is null;
    v_set_number := greatest(1, coalesce(v_raw_set_number::integer, 1));
    v_load := greatest(0, coalesce(nullif(v_log ->> 'load_kg', '')::numeric, 0));
    v_reps := greatest(0, coalesce(nullif(v_log ->> 'reps', '')::integer, 0));
    v_log_id := trim(coalesce(v_log ->> 'id', ''));
    v_legacy_exercise_id := trim(coalesce(v_log ->> 'exercise_id', ''));
    v_workout_exercise_id := trim(coalesce(v_log ->> 'workout_exercise_id', v_legacy_exercise_id, ''));
    v_discomfort := lower(trim(coalesce(v_log ->> 'discomfort', 'none')));
    if v_log_id = '' or v_workout_exercise_id = '' or v_reps < 1 then
      raise exception 'invalid_individual_set_log';
    end if;

    -- New individual logs must reference an exercise in this exact workout.
    -- The occurrence suffix is generated locally when the same catalog id is
    -- repeated in a snapshot. Legacy aggregate logs remain compatible when
    -- they carry no set_number and preserve exercise_id as their source id.
    if v_workout_id <> '' and not exists (
      select 1
        from public.workout_exercises we
       where we.workout_id = v_workout_id
         and (
           we.id = v_workout_exercise_id
           or we.id = regexp_replace(v_workout_exercise_id, '-occurrence-[0-9]+$', '')
         )
    ) then
      if not (v_is_legacy_log and v_legacy_exercise_id <> '' and v_workout_exercise_id = v_legacy_exercise_id) then
        raise exception 'exercise_not_in_workout';
      end if;
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
      nullif(v_legacy_exercise_id, ''), v_workout_exercise_id,
      greatest(0, coalesce(nullif(v_log ->> 'position', '')::integer, 0)),
      trim(coalesce(v_log ->> 'exercise_name', 'Exercicio')),
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
      load_kg = excluded.load_kg,
      reps = excluded.reps,
      volume_kg = excluded.volume_kg,
      completed_at = excluded.completed_at,
      discomfort = excluded.discomfort,
      discomfort_note = excluded.discomfort_note;

    v_completed_sets := v_completed_sets + 1;
    v_volume := v_volume + (v_load * v_reps);
  end loop;

  if v_completed_sets = 0 then raise exception 'session_requires_completed_set'; end if;
  v_status := case when v_total_sets > 0 and v_completed_sets >= v_total_sets then 'completed' else 'partial' end;
  update public.workout_sessions
     set status = v_status,
         completed_sets = v_completed_sets,
         volume_kg = v_volume,
         updated_at = now()
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
    v_feedback_id, v_session_id, v_coach_id, v_student_id, v_effort, v_pain,
    trim(coalesce(p_feedback ->> 'note', '')), now()
  )
  on conflict (id) do update set
    effort = excluded.effort,
    pain = excluded.pain,
    note = excluded.note;

  return jsonb_build_object(
    'session_id', v_session_id,
    'status', v_status,
    'completed_sets', v_completed_sets,
    'volume_kg', v_volume,
    'synced_at', now()
  );
end;
$$;

revoke all on function public.sync_workout_session(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_workout_session(jsonb, jsonb, jsonb) to authenticated, service_role;
