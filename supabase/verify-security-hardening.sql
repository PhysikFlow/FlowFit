-- FlowFit: verificacao somente leitura do hardening de funcoes e RLS.
-- Retorna um unico JSON para facilitar a copia do SQL Editor.

with expected_policies(policyname) as (
  values
    ('brand_theme_select_authenticated'),
    ('students_select_authenticated_owner'),
    ('workout_plans_select_authenticated_owner'),
    ('workout_exercises_select_authenticated_owner'),
    ('workout_sessions_select_authenticated_owner'),
    ('workout_set_logs_select_authenticated_owner'),
    ('workout_feedback_select_authenticated_owner')
), policy_state as (
  select
    e.policyname,
    p.tablename,
    p.qual,
    p.policyname is not null as policy_exists,
    coalesce(p.qual ilike '%can_operate_as_coach%', false) as coach_status_guard
  from expected_policies e
  left join pg_policies p
    on p.schemaname = 'public'
   and p.policyname = e.policyname
), flowfit_definers as (
  select p.oid, p.oid::regprocedure::text as signature, p.proconfig, p.proacl, p.proowner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname in (
      'ensure_own_profile', 'current_profile_role', 'has_role_at_least',
      'can_operate_as_coach', 'validate_student_invite', 'claim_student_access',
      'claim_student_invite', 'publish_student_workout', 'renew_student_invite',
      'is_platform_admin', 'has_coach_capability', 'admin_get_overview',
      'admin_list_coaches', 'admin_get_coach', 'admin_list_coach_history',
      'admin_update_coach', 'sync_workout_session'
    )
), public_executable_definers as (
  select distinct f.signature
  from flowfit_definers f
  cross join lateral aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a
  where a.grantee = 0
    and a.privilege_type = 'EXECUTE'
)
select jsonb_build_object(
  'checked_at', now(),
  'schema_privileges', jsonb_build_object(
    'anon_create', has_schema_privilege('anon', 'public', 'create'),
    'authenticated_create', has_schema_privilege('authenticated', 'public', 'create')
  ),
  'security_definer', jsonb_build_object(
    'count', (select count(*) from flowfit_definers),
    'without_hardened_search_path', (
      select coalesce(jsonb_agg(signature order by signature), '[]'::jsonb)
      from flowfit_definers
      where not coalesce(proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']
    ),
    'executable_by_public', (
      select coalesce(jsonb_agg(signature order by signature), '[]'::jsonb)
      from public_executable_definers
    )
  ),
  'coach_read_policies', (
    select jsonb_object_agg(
      policyname,
      jsonb_build_object(
        'table', tablename,
        'exists', policy_exists,
        'coach_status_guard', coach_status_guard
      )
      order by policyname
    )
    from policy_state
  ),
  'ok',
    not has_schema_privilege('anon', 'public', 'create')
    and not has_schema_privilege('authenticated', 'public', 'create')
    and not exists (
      select 1 from flowfit_definers
      where not coalesce(proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']
    )
    and not exists (select 1 from public_executable_definers)
    and not exists (select 1 from policy_state where not policy_exists or not coach_status_guard)
) as result;
