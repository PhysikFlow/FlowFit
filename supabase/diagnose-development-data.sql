-- Consulta somente leitura para descobrir de onde vieram dados apos a limpeza.
-- Rode o arquivo inteiro no mesmo projeto Supabase usado pelo app.

select now() as checked_at, current_database() as database_name;

select 'auth.users' as source, count(*) as rows from auth.users
union all
select 'public.profiles', count(*) from public.profiles
union all
select 'public.students', count(*) from public.students
union all
select 'public.brand_theme', count(*) from public.brand_theme
union all
select 'public.workout_plans', count(*) from public.workout_plans
union all
select 'public.workout_sessions', count(*) from public.workout_sessions
order by source;

select
  u.email,
  p.user_id,
  p.role,
  p.coach_status,
  p.created_at,
  p.updated_at
from public.profiles p
left join auth.users u on u.id = p.user_id
order by p.created_at desc;

select
  s.id,
  s.coach_id,
  s.email,
  s.name,
  s.student_user_id,
  s.invite_status,
  s.created_at,
  s.updated_at
from public.students s
order by s.created_at desc;

select
  b.coach_id,
  b.brand_name,
  b.accent,
  b.updated_at
from public.brand_theme b
order by b.updated_at desc;

-- Acessos ainda nao vinculados, convites que exigem atencao e duplicidades.
select
  count(*) filter (where student_user_id is null) as students_without_user,
  count(*) filter (where invite_status = 'pending') as pending_invites,
  count(*) filter (where invite_status = 'pending' and invite_expires_at <= now()) as expired_invites
from public.students;

select
  coach_id,
  lower(trim(email)) as normalized_email,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as student_ids
from public.students
where trim(coalesce(email, '')) <> ''
group by coach_id, lower(trim(email))
having count(*) > 1
order by duplicate_count desc, coach_id;

-- Planos incompletos ou ligados a um cadastro inconsistente.
select
  wp.id as workout_id,
  wp.coach_id,
  wp.student_id,
  wp.status,
  count(we.id) as exercise_count,
  case
    when s.id is null then 'student-missing'
    when s.coach_id <> wp.coach_id then 'coach-mismatch'
    when count(we.id) = 0 then 'without-exercises'
    else 'ok'
  end as diagnosis
from public.workout_plans wp
left join public.students s on s.id = wp.student_id
left join public.workout_exercises we on we.workout_id = wp.id
group by wp.id, wp.coach_id, wp.student_id, wp.status, s.id, s.coach_id
having s.id is null or s.coach_id <> wp.coach_id or count(we.id) = 0
order by wp.updated_at desc;

select
  coach_id,
  brand_name,
  accent,
  mode,
  updated_at as last_theme_update
from public.brand_theme
order by updated_at desc;

-- Administração de personals. As consultas abaixo funcionam depois de
-- supabase/admin-console.sql e ajudam a conferir o primeiro acesso.
select
  p.coach_status,
  count(*) as coach_count
from public.profiles p
where p.role = 'coach'
group by p.coach_status
order by p.coach_status;

select
  u.email as admin_email,
  pa.user_id,
  pa.created_at
from public.platform_admins pa
join auth.users u on u.id = pa.user_id
order by pa.created_at;

select
  p.user_id as coach_id,
  p.name,
  u.email,
  p.coach_status,
  coalesce(cas.plan, 'Plano piloto') as plan,
  p.coach_trial_ends_at as access_expires_at,
  cas.updated_at as last_admin_update
from public.profiles p
join auth.users u on u.id = p.user_id
left join public.coach_admin_settings cas on cas.coach_id = p.user_id
where p.role = 'coach'
order by p.created_at desc;
