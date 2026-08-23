begin;

alter table public.workout_exercises
  add column if not exists media_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_exercises_media_metadata_check'
      and conrelid = 'public.workout_exercises'::regclass
  ) then
    alter table public.workout_exercises
      add constraint workout_exercises_media_metadata_check
      check (
        jsonb_typeof(media_metadata) = 'object'
        and pg_column_size(media_metadata) <= 4096
      );
  end if;
end
$$;

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
  v_media_metadata jsonb;
  v_repdb_poses jsonb;
  v_repdb_poster_path text;
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
    v_media_metadata := coalesce(v_exercise -> 'media_metadata', '{}'::jsonb);

    if v_media_url <> '' and v_media_url !~* '^https://' then
      raise exception 'exercise_media_url_requires_https';
    end if;
    if v_media_type not in ('none', 'image', 'gif', 'video', 'youtube', 'external') then
      raise exception 'exercise_media_type_invalid';
    end if;
    if jsonb_typeof(v_media_metadata) <> 'object' or pg_column_size(v_media_metadata) > 4096 then
      raise exception 'exercise_media_metadata_invalid';
    end if;

    if v_media_metadata <> '{}'::jsonb then
      if v_media_metadata ->> 'provider' <> 'repdb'
         or v_media_metadata ->> 'version' <> '2026.8.0'
         or coalesce(v_media_metadata ->> 'exerciseId', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
         or jsonb_typeof(v_media_metadata -> 'poses') <> 'object' then
        raise exception 'exercise_repdb_metadata_invalid';
      end if;

      v_repdb_poses := v_media_metadata -> 'poses';
      if v_repdb_poses = '{}'::jsonb
         or exists (
           select 1 from jsonb_object_keys(v_repdb_poses) as pose(key)
           where pose.key not in ('start', 'peak', 'main')
         )
         or exists (
           select 1 from jsonb_each_text(v_repdb_poses) as pose(key, value)
           where pose.value !~ '^images/flat/[a-z0-9]+(-[a-z0-9]+)*-(start|peak|main)[.]webp$'
              or pose.value !~ (
                '^images/flat/'
                || (v_media_metadata ->> 'exerciseId')
                || '-(start|peak|main)[.]webp$'
              )
         ) then
        raise exception 'exercise_repdb_poses_invalid';
      end if;

      v_repdb_poster_path := coalesce(
        v_repdb_poses ->> 'peak',
        v_repdb_poses ->> 'main',
        v_repdb_poses ->> 'start'
      );
      if v_media_type <> 'image'
         or v_media_url <> ('https://cdn.jsdelivr.net/npm/@repdb/exercises@2026.8.0/' || v_repdb_poster_path) then
        raise exception 'exercise_repdb_media_mismatch';
      end if;
    end if;

    insert into public.workout_exercises (
      id, workout_id, coach_id, position, name, target, prescription,
      load, rest, tempo, rir, notes, instructions, media_url, media_type,
      media_metadata, updated_at
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
      v_media_metadata,
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

commit;
