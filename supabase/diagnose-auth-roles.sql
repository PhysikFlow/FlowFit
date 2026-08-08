-- FlowFit: diagnostico somente leitura de autenticacao, roles e vinculos.
-- Rode no SQL Editor do projeto Supabase usado pelo app antes de qualquer
-- limpeza manual. Este arquivo nao altera nem apaga dados.

select now() as checked_at, current_database() as database_name;

with role_rank as (
  select *
  from (values
    ('admin'::text, 3),
    ('coach'::text, 2),
    ('student'::text, 1)
  ) as roles(role, rank)
)
select
  p.role,
  rr.rank as hierarchy_rank,
  count(*) as profile_count
from public.profiles p
left join role_rank rr on rr.role = p.role
group by p.role, rr.rank
order by rr.rank desc nulls last, p.role;

-- Identidades autenticadas sem profile: conseguem autenticar, mas as areas do
-- produto nao conseguem decidir permissao de forma confiavel.
select
  u.id as user_id,
  u.email,
  u.created_at,
  u.last_sign_in_at
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
order by u.created_at desc;

-- Profiles orfaos nao deveriam existir por causa do FK, mas esta consulta ajuda
-- a detectar bancos antigos/importacoes manuais problemáticas.
select
  p.user_id,
  p.role,
  p.name,
  p.created_at
from public.profiles p
left join auth.users u on u.id = p.user_id
where u.id is null
order by p.created_at desc;

-- Admins reconhecidos pela allowlist antiga, pelo profile.role ou por ambos.
with admin_candidates as (
  select user_id from public.platform_admins
  union
  select user_id from public.profiles where role = 'admin'
)
select
  coalesce(u.email, '(usuario removido)') as email,
  ac.user_id,
  case when pa.user_id is not null then true else false end as in_platform_admins,
  p.role as profile_role,
  case
    when pa.user_id is not null and p.role = 'admin' then 'ok'
    when pa.user_id is not null and coalesce(p.role, '') <> 'admin' then 'platform-admin-without-admin-role'
    when pa.user_id is null and p.role = 'admin' then 'admin-role-without-platform-admin-row'
    else 'unknown'
  end as diagnosis
from admin_candidates ac
left join public.platform_admins pa on pa.user_id = ac.user_id
left join public.profiles p on p.user_id = ac.user_id
left join auth.users u on u.id = ac.user_id
order by diagnosis, email;

-- Emails duplicados em auth.users nao deveriam ocorrer, mas vale conferir em
-- projetos que ja passaram por importacao/manual setup.
select
  lower(trim(email)) as normalized_email,
  count(*) as auth_user_count,
  array_agg(id order by created_at) as user_ids
from auth.users
where trim(coalesce(email, '')) <> ''
group by lower(trim(email))
having count(*) > 1
order by auth_user_count desc, normalized_email;

-- Mesmo email de aluno em personais diferentes e esperado; no novo fluxo a
-- mesma identidade pode receber varios vinculos. Esta consulta mostra isso.
select
  lower(trim(s.email)) as student_email,
  count(distinct s.coach_id) as coach_count,
  count(*) as student_rows,
  array_agg(s.id order by s.created_at) as student_ids
from public.students s
where trim(coalesce(s.email, '')) <> ''
group by lower(trim(s.email))
having count(distinct s.coach_id) > 1
order by coach_count desc, student_email;

-- Duplicidade dentro do mesmo personal: isso normalmente deve ser corrigido
-- antes de producao para evitar convite/treino ambíguo.
select
  s.coach_id,
  lower(trim(s.email)) as student_email,
  count(*) as duplicate_count,
  array_agg(s.id order by s.created_at) as student_ids
from public.students s
where trim(coalesce(s.email, '')) <> ''
group by s.coach_id, lower(trim(s.email))
having count(*) > 1
order by duplicate_count desc, s.coach_id, student_email;

-- Alunos vinculados a um auth.users cujo profile esta ausente ou invalido.
select
  s.id as student_id,
  s.name as student_name,
  s.email as student_email,
  s.coach_id,
  s.student_user_id,
  u.email as auth_email,
  p.role as profile_role,
  case
    when u.id is null then 'auth-user-missing'
    when p.user_id is null then 'profile-missing'
    when p.role not in ('admin', 'coach', 'student') then 'invalid-profile-role'
    else 'ok'
  end as diagnosis
from public.students s
left join auth.users u on u.id = s.student_user_id
left join public.profiles p on p.user_id = s.student_user_id
where s.student_user_id is not null
order by diagnosis desc, s.updated_at desc;

-- Policies atuais nas tabelas de produto, para conferir se RLS esta ativo e
-- quais regras serao usadas pela Data API.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'platform_admins',
    'coach_admin_settings',
    'coach_admin_history',
    'students',
    'brand_theme',
    'workout_plans',
    'workout_exercises',
    'workout_sessions',
    'workout_set_logs',
    'workout_feedback'
  )
order by tablename, policyname;
