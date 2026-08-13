-- Execute depois de automatic-coach-expiration.sql.
-- Retorna uma unica linha JSON e nao altera dados.

with function_state as (
  select
    to_regprocedure('flowfit_private.coach_access_state(uuid,timestamp with time zone)') as state_oid,
    to_regprocedure('public.get_own_coach_access()') as own_access_oid,
    to_regprocedure('public.can_operate_as_coach()') as can_operate_oid,
    to_regprocedure('public.admin_update_coach(uuid,text,text,date,text,text)') as update_date_oid,
    to_regprocedure('public.admin_update_coach(uuid,text,text,timestamp with time zone,text,text)') as update_legacy_oid
), candidate as (
  select p.user_id, cas.access_expires_on
  from public.profiles p
  join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where p.role = 'coach'
    and p.coach_status in ('trial', 'active')
    and cas.access_expires_on is not null
  order by p.created_at
  limit 1
), boundary_state as (
  select
    c.user_id,
    c.access_expires_on,
    before_end.effective_status as on_expiry_status,
    before_end.allowed as on_expiry_allowed,
    grace_start.effective_status as grace_start_status,
    grace_start.allowed as grace_start_allowed,
    grace_end.effective_status as grace_end_status,
    grace_end.allowed as grace_end_allowed,
    blocked.effective_status as blocked_status,
    blocked.allowed as blocked_allowed
  from candidate c
  cross join lateral flowfit_private.coach_access_state(
    c.user_id,
    ((c.access_expires_on + time '23:59:59') at time zone 'America/Sao_Paulo')
  ) before_end
  cross join lateral flowfit_private.coach_access_state(
    c.user_id,
    (((c.access_expires_on + 1) + time '00:00:00') at time zone 'America/Sao_Paulo')
  ) grace_start
  cross join lateral flowfit_private.coach_access_state(
    c.user_id,
    (((c.access_expires_on + 1) + time '23:59:59') at time zone 'America/Sao_Paulo')
  ) grace_end
  cross join lateral flowfit_private.coach_access_state(
    c.user_id,
    (((c.access_expires_on + 2) + time '00:00:00') at time zone 'America/Sao_Paulo')
  ) blocked
), privilege_state as (
  select
    has_schema_privilege('anon', 'flowfit_private', 'USAGE') as anon_private_usage,
    has_schema_privilege('authenticated', 'flowfit_private', 'USAGE') as authenticated_private_usage,
    has_function_privilege('authenticated', 'public.get_own_coach_access()', 'EXECUTE') as authenticated_own_access_execute,
    has_function_privilege('anon', 'public.get_own_coach_access()', 'EXECUTE') as anon_own_access_execute
), rls_state as (
  select count(*)::integer as coach_guarded_policies
  from pg_policies
  where schemaname = 'public'
    and coalesce(qual, '') ilike '%can_operate_as_coach%'
), column_state as (
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coach_admin_settings'
      and column_name = 'access_expires_on'
      and data_type = 'date'
  ) as access_expires_on_exists
)
select jsonb_build_object(
  'ok',
    cs.access_expires_on_exists
    and fs.state_oid is not null
    and fs.own_access_oid is not null
    and fs.can_operate_oid is not null
    and fs.update_date_oid is not null
    and fs.update_legacy_oid is null
    and not ps.anon_private_usage
    and not ps.authenticated_private_usage
    and ps.authenticated_own_access_execute
    and not ps.anon_own_access_execute
    and rs.coach_guarded_policies >= 7
    and (
      not exists (select 1 from boundary_state)
      or exists (
        select 1 from boundary_state b
        where b.on_expiry_allowed
          and b.grace_start_status = 'grace' and b.grace_start_allowed
          and b.grace_end_status = 'grace' and b.grace_end_allowed
          and b.blocked_status = 'expired' and not b.blocked_allowed
      )
    ),
  'checked_at', now(),
  'timezone', 'America/Sao_Paulo',
  'rule', 'D normal; D+1 grace; D+2 blocked',
  'column', jsonb_build_object(
    'access_expires_on_exists', cs.access_expires_on_exists,
    'legacy_column_retained', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'coach_trial_ends_at'
    )
  ),
  'functions', jsonb_build_object(
    'state_helper_exists', fs.state_oid is not null,
    'own_access_exists', fs.own_access_oid is not null,
    'can_operate_exists', fs.can_operate_oid is not null,
    'date_update_exists', fs.update_date_oid is not null,
    'legacy_update_removed', fs.update_legacy_oid is null
  ),
  'privileges', jsonb_build_object(
    'anon_private_usage', ps.anon_private_usage,
    'authenticated_private_usage', ps.authenticated_private_usage,
    'authenticated_own_access_execute', ps.authenticated_own_access_execute,
    'anon_own_access_execute', ps.anon_own_access_execute
  ),
  'rls', jsonb_build_object('coach_guarded_policies', rs.coach_guarded_policies),
  'boundary_test', coalesce(
    (select to_jsonb(b) from boundary_state b),
    jsonb_build_object(
      'available', false,
      'reason', 'Nenhum coach trial/active com vencimento foi encontrado para o teste deterministico.'
    )
  )
)
from function_state fs
cross join privilege_state ps
cross join rls_state rs
cross join column_state cs;
