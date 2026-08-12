-- FlowFit: aplica o status do personal tambem nas leituras diretas da Data API.
--
-- Migration incremental e idempotente. Nao altera dados nem sessoes. Um coach
-- pending/suspended/cancelled perde leitura remota na proxima requisicao; o
-- acesso proprio ao profile continua para que o app consiga exibir o motivo.

begin;

drop policy if exists "brand_theme_select_authenticated" on public.brand_theme;
create policy "brand_theme_select_authenticated"
  on public.brand_theme for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or exists (
      select 1 from public.students s
       where s.coach_id = brand_theme.coach_id
         and s.student_user_id = (select auth.uid())
    )
  );

drop policy if exists "students_select_authenticated_owner" on public.students;
create policy "students_select_authenticated_owner"
  on public.students for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or student_user_id = (select auth.uid())
  );

drop policy if exists "workout_plans_select_authenticated_owner" on public.workout_plans;
create policy "workout_plans_select_authenticated_owner"
  on public.workout_plans for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or exists (
      select 1 from public.students s
       where s.id = workout_plans.student_id
         and s.coach_id = workout_plans.coach_id
         and s.student_user_id = (select auth.uid())
    )
  );

drop policy if exists "workout_exercises_select_authenticated_owner" on public.workout_exercises;
create policy "workout_exercises_select_authenticated_owner"
  on public.workout_exercises for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or exists (
      select 1
        from public.workout_plans wp
        join public.students s on s.id = wp.student_id and s.coach_id = wp.coach_id
       where wp.id = workout_exercises.workout_id
         and wp.coach_id = workout_exercises.coach_id
         and s.student_user_id = (select auth.uid())
    )
  );

drop policy if exists "workout_sessions_select_authenticated_owner" on public.workout_sessions;
create policy "workout_sessions_select_authenticated_owner"
  on public.workout_sessions for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or exists (
      select 1 from public.students s
       where s.id = workout_sessions.student_id
         and s.coach_id = workout_sessions.coach_id
         and s.student_user_id = (select auth.uid())
    )
  );

drop policy if exists "workout_set_logs_select_authenticated_owner" on public.workout_set_logs;
create policy "workout_set_logs_select_authenticated_owner"
  on public.workout_set_logs for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or exists (
      select 1
        from public.workout_sessions ws
        join public.students s on s.id = ws.student_id and s.coach_id = ws.coach_id
       where ws.id = workout_set_logs.session_id
         and ws.coach_id = workout_set_logs.coach_id
         and s.student_user_id = (select auth.uid())
    )
  );

drop policy if exists "workout_feedback_select_authenticated_owner" on public.workout_feedback;
create policy "workout_feedback_select_authenticated_owner"
  on public.workout_feedback for select to authenticated
  using (
    (
      coach_id = (select auth.uid())::text
      and (select public.can_operate_as_coach())
    )
    or exists (
      select 1
        from public.workout_sessions ws
        join public.students s on s.id = ws.student_id and s.coach_id = ws.coach_id
       where ws.id = workout_feedback.session_id
         and ws.coach_id = workout_feedback.coach_id
         and s.student_user_id = (select auth.uid())
    )
  );

commit;

select jsonb_build_object(
  'migration', 'enforce-coach-read-status-ok',
  'policies_updated', 7,
  'checked_at', now()
) as result;
