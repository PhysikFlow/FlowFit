-- Vencimento automatico de personals com um dia civil de carencia.
-- Regra: acesso normal em D, carencia em D+1 e bloqueio em D+2,
-- sempre segundo America/Sao_Paulo.

begin;

create schema if not exists flowfit_private;
revoke all on schema flowfit_private from public, anon, authenticated;

alter table public.coach_admin_settings
  add column if not exists access_expires_on date;

insert into public.coach_admin_settings (coach_id, access_expires_on)
select
  p.user_id,
  (p.coach_trial_ends_at at time zone 'America/Sao_Paulo')::date
from public.profiles p
where p.coach_trial_ends_at is not null
  and public.has_coach_capability(p.user_id)
on conflict on constraint coach_admin_settings_pkey do update
set access_expires_on = coalesce(
  public.coach_admin_settings.access_expires_on,
  excluded.access_expires_on
);

create or replace function flowfit_private.coach_access_state(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns table (
  configured_status text,
  effective_status text,
  allowed boolean,
  is_admin boolean,
  access_expires_on date,
  grace_on date,
  blocked_on date,
  next_transition_at timestamptz,
  status_note text
)
language sql
stable
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
  with account as (
    select
      p.role,
      p.coach_status,
      p.coach_status_note,
      cas.access_expires_on,
      (p_at at time zone 'America/Sao_Paulo')::date as local_today
    from public.profiles p
    left join public.coach_admin_settings cas on cas.coach_id = p.user_id
    where p.user_id = p_user_id
  ), calculated as (
    select
      a.*,
      case
        when a.role = 'admin' then 'admin'
        when a.role <> 'coach' then 'wrong_role'
        when a.coach_status in ('pending', 'suspended', 'cancelled') then a.coach_status
        when a.access_expires_on is null then a.coach_status
        when a.local_today <= a.access_expires_on then a.coach_status
        when a.local_today = a.access_expires_on + 1 then 'grace'
        else 'expired'
      end as effective_status
    from account a
  )
  select
    c.coach_status,
    c.effective_status,
    case
      when c.role = 'admin' then true
      when c.role <> 'coach' then false
      else c.effective_status in ('trial', 'active', 'past_due', 'grace')
    end,
    c.role = 'admin',
    c.access_expires_on,
    case when c.access_expires_on is null then null else c.access_expires_on + 1 end,
    case when c.access_expires_on is null then null else c.access_expires_on + 2 end,
    case
      when c.role <> 'admin'
       and c.coach_status not in ('pending', 'suspended', 'cancelled')
       and c.access_expires_on is not null
       and c.local_today <= c.access_expires_on
        then ((c.access_expires_on + 1)::timestamp at time zone 'America/Sao_Paulo')
      when c.role <> 'admin'
       and c.coach_status not in ('pending', 'suspended', 'cancelled')
       and c.access_expires_on is not null
       and c.local_today = c.access_expires_on + 1
        then ((c.access_expires_on + 2)::timestamp at time zone 'America/Sao_Paulo')
      else null
    end,
    c.coach_status_note
  from calculated c;
$$;

revoke all on function flowfit_private.coach_access_state(uuid, timestamptz)
  from public, anon, authenticated;

create or replace function public.can_operate_as_coach()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
  select coalesce((
    select access.allowed
    from flowfit_private.coach_access_state(auth.uid(), now()) access
  ), false);
$$;

revoke all on function public.can_operate_as_coach() from public, anon, authenticated;
grant execute on function public.can_operate_as_coach() to authenticated;

create or replace function public.get_own_coach_access()
returns table (
  configured_status text,
  effective_status text,
  allowed boolean,
  is_admin boolean,
  access_expires_on date,
  grace_on date,
  blocked_on date,
  next_transition_at timestamptz,
  status_note text
)
language sql
stable
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
  select *
  from flowfit_private.coach_access_state(auth.uid(), now());
$$;

revoke all on function public.get_own_coach_access() from public, anon, authenticated;
grant execute on function public.get_own_coach_access() to authenticated;

drop function if exists public.admin_get_overview();
create function public.admin_get_overview()
returns table (
  total bigint,
  pending bigint,
  trial bigint,
  active bigint,
  past_due bigint,
  grace bigint,
  expired bigint,
  suspended bigint,
  cancelled bigint,
  admin bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo nao autorizado.' using errcode = 'P0001';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where access.effective_status = 'pending')::bigint,
    count(*) filter (where access.effective_status = 'trial')::bigint,
    count(*) filter (where access.effective_status = 'active')::bigint,
    count(*) filter (where access.effective_status = 'past_due')::bigint,
    count(*) filter (where access.effective_status = 'grace')::bigint,
    count(*) filter (where access.effective_status = 'expired')::bigint,
    count(*) filter (where access.effective_status = 'suspended')::bigint,
    count(*) filter (where access.effective_status = 'cancelled')::bigint,
    count(*) filter (where access.effective_status = 'admin')::bigint
  from public.profiles p
  cross join lateral flowfit_private.coach_access_state(p.user_id, now()) access
  where public.has_coach_capability(p.user_id);
end;
$$;

drop function if exists public.admin_list_coaches(text, text);
create function public.admin_list_coaches(
  p_search text default null,
  p_status text default null
)
returns table (
  coach_id uuid,
  name text,
  email text,
  registered_at timestamptz,
  student_count bigint,
  plan text,
  access_expires_on date,
  grace_on date,
  blocked_on date,
  configured_status text,
  effective_status text,
  status_note text,
  admin_notes text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
declare
  v_search text := lower(trim(coalesce(p_search, '')));
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo nao autorizado.' using errcode = 'P0001';
  end if;
  if v_status is not null and v_status not in (
    'pending', 'trial', 'active', 'past_due', 'grace', 'expired',
    'suspended', 'cancelled', 'admin'
  ) then
    raise exception 'Status de personal invalido.' using errcode = '22023';
  end if;

  return query
  select
    p.user_id,
    p.name,
    coalesce(nullif(u.email, ''), nullif(p.contact_email, ''), 'Sem email')::text,
    p.created_at,
    count(s.id)::bigint,
    coalesce(cas.plan, 'Plano piloto')::text,
    access.access_expires_on,
    access.grace_on,
    access.blocked_on,
    access.configured_status,
    access.effective_status,
    access.status_note,
    coalesce(cas.notes, '')::text,
    greatest(p.updated_at, coalesce(cas.updated_at, p.updated_at))
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.students s on s.coach_id = p.user_id::text
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  cross join lateral flowfit_private.coach_access_state(p.user_id, now()) access
  where public.has_coach_capability(p.user_id)
    and (v_status is null or access.effective_status = v_status)
    and (
      v_search = ''
      or lower(p.name) like '%' || v_search || '%'
      or lower(coalesce(u.email, p.contact_email, '')) like '%' || v_search || '%'
    )
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           cas.plan, cas.notes, cas.updated_at, p.updated_at,
           access.access_expires_on, access.grace_on, access.blocked_on,
           access.configured_status, access.effective_status, access.status_note
  order by p.created_at desc;
end;
$$;

drop function if exists public.admin_get_coach(uuid);
create function public.admin_get_coach(p_coach_id uuid)
returns table (
  coach_id uuid,
  name text,
  email text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  student_count bigint,
  plan text,
  access_expires_on date,
  grace_on date,
  blocked_on date,
  configured_status text,
  effective_status text,
  status_note text,
  admin_notes text,
  headline text,
  city text,
  contact_email text,
  phone text,
  whatsapp text,
  cref text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo nao autorizado.' using errcode = 'P0001';
  end if;

  return query
  select
    p.user_id,
    p.name,
    coalesce(nullif(u.email, ''), nullif(p.contact_email, ''), 'Sem email')::text,
    p.created_at,
    u.last_sign_in_at,
    count(s.id)::bigint,
    coalesce(cas.plan, 'Plano piloto')::text,
    access.access_expires_on,
    access.grace_on,
    access.blocked_on,
    access.configured_status,
    access.effective_status,
    access.status_note,
    coalesce(cas.notes, '')::text,
    p.headline,
    p.city,
    p.contact_email,
    p.phone,
    p.whatsapp,
    p.cref,
    greatest(p.updated_at, coalesce(cas.updated_at, p.updated_at))
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.students s on s.coach_id = p.user_id::text
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  cross join lateral flowfit_private.coach_access_state(p.user_id, now()) access
  where p.user_id = p_coach_id
    and public.has_coach_capability(p.user_id)
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           u.last_sign_in_at, cas.plan, cas.notes, cas.updated_at,
           access.access_expires_on, access.grace_on, access.blocked_on,
           access.configured_status, access.effective_status, access.status_note,
           p.headline, p.city, p.phone, p.whatsapp, p.cref, p.updated_at;
end;
$$;

drop function if exists public.admin_update_coach(uuid, text, text, timestamptz, text, text);
drop function if exists public.admin_update_coach(uuid, text, text, date, text, text);
create function public.admin_update_coach(
  p_coach_id uuid,
  p_status text,
  p_plan text,
  p_access_expires_on date,
  p_admin_notes text,
  p_status_note text default ''
)
returns table (
  coach_id uuid,
  configured_status text,
  effective_status text,
  plan text,
  access_expires_on date,
  grace_on date,
  blocked_on date,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, flowfit_private
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_plan text := coalesce(nullif(trim(coalesce(p_plan, '')), ''), 'Plano piloto');
  v_admin_notes text := trim(coalesce(p_admin_notes, ''));
  v_status_note text := trim(coalesce(p_status_note, ''));
  v_previous_status text;
  v_previous_expiry date;
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
    cas.access_expires_on,
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
    'access_expires_on', v_previous_expiry,
    'status_note', v_previous_status_note,
    'admin_notes', v_previous_admin_notes
  );
  v_new := jsonb_build_object(
    'status', v_status,
    'plan', v_plan,
    'access_expires_on', p_access_expires_on,
    'status_note', v_status_note,
    'admin_notes', v_admin_notes
  );

  update public.profiles
  set coach_status = v_status,
      coach_status_note = v_status_note,
      updated_at = v_now
  where user_id = p_coach_id;

  insert into public.coach_admin_settings (
    coach_id, plan, notes, access_expires_on, updated_at, updated_by
  ) values (
    p_coach_id, v_plan, v_admin_notes, p_access_expires_on, v_now, auth.uid()
  )
  on conflict on constraint coach_admin_settings_pkey do update
    set plan = excluded.plan,
        notes = excluded.notes,
        access_expires_on = excluded.access_expires_on,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  if v_previous is distinct from v_new then
    v_action := case
      when v_previous_status = 'pending' and v_status = 'trial' then 'Personal aprovado para teste'
      when v_status = 'active' and v_previous_status <> 'active' then 'Acesso ativado'
      when v_status = 'suspended' and v_previous_status <> 'suspended' then 'Acesso suspenso'
      when v_status = 'cancelled' and v_previous_status <> 'cancelled' then 'Conta cancelada'
      when p_access_expires_on is distinct from v_previous_expiry then 'Vencimento do acesso atualizado'
      else v_action
    end;

    insert into public.coach_admin_history (
      coach_id, admin_user_id, action, previous_values, new_values
    ) values (
      p_coach_id, auth.uid(), v_action, v_previous, v_new
    );
  end if;

  return query
  select
    p.user_id,
    access.configured_status,
    access.effective_status,
    cas.plan,
    access.access_expires_on,
    access.grace_on,
    access.blocked_on,
    greatest(p.updated_at, cas.updated_at)
  from public.profiles p
  join public.coach_admin_settings cas on cas.coach_id = p.user_id
  cross join lateral flowfit_private.coach_access_state(p.user_id, v_now) access
  where p.user_id = p_coach_id;
end;
$$;

revoke all on function public.admin_get_overview() from public, anon, authenticated;
revoke all on function public.admin_list_coaches(text, text) from public, anon, authenticated;
revoke all on function public.admin_get_coach(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_coach(uuid, text, text, date, text, text)
  from public, anon, authenticated;

grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_list_coaches(text, text) to authenticated;
grant execute on function public.admin_get_coach(uuid) to authenticated;
grant execute on function public.admin_update_coach(uuid, text, text, date, text, text)
  to authenticated;

commit;
