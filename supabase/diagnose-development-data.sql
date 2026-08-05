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
