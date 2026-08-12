-- Diagnostico somente leitura para confirmar as correcoes de auth/admin.
-- Retorna um unico JSON. Pode ser executado antes ou depois da migration.

with function_state as (
  select
    to_regprocedure('public.ensure_own_profile(text,text)') as ensure_profile_oid,
    to_regprocedure('public.admin_update_coach(uuid,text,text,timestamptz,text,text)') as admin_update_oid
),
target_user as (
  select
    u.id,
    u.email,
    u.last_sign_in_at,
    p.role,
    p.coach_status,
    p.coach_status_note,
    p.updated_at as profile_updated_at
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where lower(u.email) = 'frismarcomputer@gmail.com'
  limit 1
),
auth_inventory as (
  select
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.deleted_at,
    u.banned_until,
    coalesce(u.raw_app_meta_data ->> 'provider', '') as primary_provider,
    coalesce(u.raw_user_meta_data ->> 'flowfit_requested_role', '') as requested_role,
    p.role as profile_role,
    p.coach_status,
    p.created_at as profile_created_at,
    exists (
      select 1 from public.platform_admins pa where pa.user_id = u.id
    ) as in_platform_admins,
    (
      select count(*)
      from public.students s
      where lower(trim(coalesce(s.email, ''))) = lower(trim(coalesce(u.email, '')))
    ) as student_rows_by_email,
    (
      select count(*)
      from public.students s
      where s.student_user_id = u.id
    ) as linked_student_rows,
    case
      when p.user_id is null then 'profile-missing'
      when p.role = 'coach' and p.coach_status = 'pending' then 'coach-pending'
      else 'ok'
    end as diagnosis,
    coalesce((
      select jsonb_agg(i.provider order by i.provider)
      from auth.identities i
      where i.user_id = u.id
    ), '[]'::jsonb) as providers
  from auth.users u
  left join public.profiles p on p.user_id = u.id
)
select jsonb_pretty(jsonb_build_object(
  'checked_at', now(),
  'functions', jsonb_build_object(
    'ensure_own_profile_exists', fs.ensure_profile_oid is not null,
    'admin_update_coach_exists', fs.admin_update_oid is not null,
    'admin_update_ambiguity_fixed', case
      when fs.admin_update_oid is null then false
      else pg_get_functiondef(fs.admin_update_oid) like '%on conflict on constraint coach_admin_settings_pkey%'
    end
  ),
  'frismar', coalesce((
    select to_jsonb(tu) from target_user tu
  ), 'null'::jsonb),
  'profile_counts', (
    select jsonb_build_object(
      'admin', count(*) filter (where p.role = 'admin'),
      'coach', count(*) filter (where p.role = 'coach'),
      'student', count(*) filter (where p.role = 'student'),
      'coach_pending', count(*) filter (where p.role = 'coach' and p.coach_status = 'pending')
    )
    from public.profiles p
  ),
  'auth_inventory', coalesce((
    select jsonb_agg(to_jsonb(ai) order by ai.created_at desc)
    from auth_inventory ai
  ), '[]'::jsonb),
  'orphan_auth_users', jsonb_build_object(
    'count', (select count(*) from auth_inventory ai where ai.profile_role is null),
    'users', coalesce((
      select jsonb_agg(to_jsonb(ai) order by ai.created_at desc)
      from auth_inventory ai
      where ai.profile_role is null
    ), '[]'::jsonb)
  )
)) as flowfit_auth_admin_verification
from function_state fs;
