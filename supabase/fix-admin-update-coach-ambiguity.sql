-- FlowFit: corrige a atualizacao administrativa de personals.
--
-- Migration incremental e idempotente. Nao altera nenhum dado existente.
-- O nome coach_id tambem e uma coluna de retorno da funcao PL/pgSQL; usar o
-- nome da constraint remove a ambiguidade do antigo ON CONFLICT (coach_id).

begin;

create or replace function public.admin_update_coach(
  p_coach_id uuid,
  p_status text,
  p_plan text,
  p_access_expires_at timestamptz,
  p_admin_notes text,
  p_status_note text default ''
)
returns table (
  coach_id uuid,
  status text,
  plan text,
  access_expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_plan text := coalesce(nullif(trim(coalesce(p_plan, '')), ''), 'Plano piloto');
  v_admin_notes text := trim(coalesce(p_admin_notes, ''));
  v_status_note text := trim(coalesce(p_status_note, ''));
  v_previous_status text;
  v_previous_expiry timestamptz;
  v_previous_status_note text;
  v_previous_plan text;
  v_previous_admin_notes text;
  v_previous jsonb;
  v_new jsonb;
  v_action text := 'Dados administrativos atualizados';
  v_now timestamptz := now();
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo nao autorizado.' using errcode = 'P0001';
  end if;

  if v_status not in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled') then
    raise exception 'Status de personal invalido.' using errcode = '22023';
  end if;
  if char_length(v_plan) > 80 then
    raise exception 'O plano deve ter no maximo 80 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_admin_notes) > 5000 then
    raise exception 'As observacoes devem ter no maximo 5.000 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_status_note) > 500 then
    raise exception 'A mensagem ao personal deve ter no maximo 500 caracteres.' using errcode = '22023';
  end if;

  select
    p.coach_status,
    p.coach_trial_ends_at,
    p.coach_status_note,
    coalesce(cas.plan, 'Plano piloto'),
    coalesce(cas.notes, '')
  into
    v_previous_status,
    v_previous_expiry,
    v_previous_status_note,
    v_previous_plan,
    v_previous_admin_notes
  from public.profiles p
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where p.user_id = p_coach_id
    and public.has_coach_capability(p.user_id)
  for update of p;

  if not found then
    raise exception 'Personal nao encontrado.' using errcode = 'P0002';
  end if;

  v_previous := jsonb_build_object(
    'status', v_previous_status,
    'plan', v_previous_plan,
    'access_expires_at', v_previous_expiry,
    'status_note', v_previous_status_note,
    'admin_notes', v_previous_admin_notes
  );
  v_new := jsonb_build_object(
    'status', v_status,
    'plan', v_plan,
    'access_expires_at', p_access_expires_at,
    'status_note', v_status_note,
    'admin_notes', v_admin_notes
  );

  update public.profiles
  set coach_status = v_status,
      coach_trial_ends_at = p_access_expires_at,
      coach_status_note = v_status_note,
      updated_at = v_now
  where user_id = p_coach_id;

  insert into public.coach_admin_settings (coach_id, plan, notes, updated_at, updated_by)
  values (p_coach_id, v_plan, v_admin_notes, v_now, auth.uid())
  on conflict on constraint coach_admin_settings_pkey do update
    set plan = excluded.plan,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  if v_previous is distinct from v_new then
    v_action := case
      when v_previous_status = 'pending' and v_status = 'trial' then 'Personal aprovado para teste'
      when v_status = 'active' and v_previous_status <> 'active' then 'Acesso ativado'
      when v_status = 'suspended' and v_previous_status <> 'suspended' then 'Acesso suspenso'
      when v_status = 'cancelled' and v_previous_status <> 'cancelled' then 'Conta cancelada'
      when v_status = 'past_due' and v_previous_status <> 'past_due' then 'Pagamento marcado como atrasado'
      else v_action
    end;

    insert into public.coach_admin_history (
      coach_id, admin_user_id, action, previous_values, new_values
    ) values (
      p_coach_id, auth.uid(), v_action, v_previous, v_new
    );
  end if;

  return query
  select p.user_id, p.coach_status, cas.plan, p.coach_trial_ends_at,
         greatest(p.updated_at, cas.updated_at)
  from public.profiles p
  join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where p.user_id = p_coach_id;
end;
$$;

revoke all on function public.admin_update_coach(uuid, text, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_coach(uuid, text, text, timestamptz, text, text)
  to authenticated;

commit;

select
  'fix-admin-update-coach-ambiguity-ok' as migration,
  pg_get_functiondef(
    'public.admin_update_coach(uuid,text,text,timestamptz,text,text)'::regprocedure
  ) like '%on conflict on constraint coach_admin_settings_pkey%' as fixed;
