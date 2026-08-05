-- ============================================================================
-- FlowFit: limpeza TOTAL dos dados de desenvolvimento
--
-- ATENCAO: este arquivo apaga todos os usuarios do Supabase Auth e todos os
-- dados do app. Use somente no projeto de desenvolvimento, nunca em producao.
-- Depois da limpeza, rode supabase/schema.sql antes de iniciar os testes.
-- ============================================================================

begin;

truncate table
  public.workout_feedback,
  public.workout_set_logs,
  public.workout_sessions,
  public.workout_exercises,
  public.workout_plans,
  public.brand_theme,
  public.students,
  public.profiles
restart identity cascade;

-- No SQL Editor do Supabase, esta remocao tambem limpa as identidades ligadas
-- aos usuarios. Os perfis publicos ja foram limpos acima.
delete from auth.users;

do $$
begin
  if exists (select 1 from auth.users)
     or exists (select 1 from public.profiles)
     or exists (select 1 from public.students)
     or exists (select 1 from public.workout_plans)
     or exists (select 1 from public.workout_sessions) then
    raise exception 'A limpeza nao zerou todas as tabelas; a transacao sera revertida.';
  end if;
end;
$$;

commit;

-- Resultado esperado: todos os contadores abaixo devem ser zero.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.students) as students,
  (select count(*) from public.workout_plans) as workout_plans,
  (select count(*) from public.workout_sessions) as workout_sessions;
