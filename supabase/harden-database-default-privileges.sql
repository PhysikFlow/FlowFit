-- FlowFit: endurecimento dos privilegios padrao do schema exposto.
--
-- Migration incremental e idempotente. Nao altera dados, sessoes ou policies.
-- Deve ser executada pelo mesmo owner que cria as funcoes (SQL Editor: postgres).

begin;

-- Usuarios da Data API precisam de USAGE, nunca de CREATE no schema exposto.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- PostgreSQL concede EXECUTE de novas funcoes a PUBLIC por padrao. Exija grants
-- explicitos para toda funcao criada futuramente pelo owner que roda este SQL.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- Endurece as funcoes FlowFit que ja existem no banco. O teste de existencia
-- permite rodar esta migration em instalacoes parciais sem recriar funcoes.
do $flowfit_harden_functions$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.ensure_own_profile(text,text)',
    'public.current_profile_role()',
    'public.has_role_at_least(text)',
    'public.can_operate_as_coach()',
    'public.validate_student_invite(text,text)',
    'public.claim_student_access(text)',
    'public.claim_student_invite(text)',
    'public.publish_student_workout(jsonb,jsonb)',
    'public.renew_student_invite(text)',
    'public.is_platform_admin()',
    'public.has_coach_capability(uuid)',
    'public.admin_get_overview()',
    'public.admin_list_coaches(text,text)',
    'public.admin_get_coach(uuid)',
    'public.admin_list_coach_history(uuid)',
    'public.admin_update_coach(uuid,text,text,timestamptz,text,text)',
    'public.sync_workout_session(jsonb,jsonb,jsonb)'
  ]
  loop
    if to_regprocedure(v_signature) is not null then
      execute format('alter function %s set search_path to pg_catalog, public', v_signature);
    end if;
  end loop;
end;
$flowfit_harden_functions$;

commit;

select jsonb_build_object(
  'migration', 'harden-database-default-privileges-ok',
  'anon_create', has_schema_privilege('anon', 'public', 'create'),
  'authenticated_create', has_schema_privilege('authenticated', 'public', 'create'),
  'flowfit_definers_without_hardened_search_path', (
    select coalesce(jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text), '[]'::jsonb)
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
       and not coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']
  ),
  'checked_at', now()
) as result;
