-- FlowFit - alinhar a administração de personals à hierarquia de papéis.
-- Migration aditiva/idempotente. Não altera role e não remove dados.

begin;

-- profiles.role guarda o maior papel da identidade. No modelo atual, admin
-- também pode operar como personal; esta função representa essa capacidade
-- sem rebaixar o papel principal para coach.
create or replace function public.has_coach_capability(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_user_id
      and p.role in ('coach', 'admin')
  );
$$;

create or replace function public.admin_get_overview()
returns table (
  total bigint,
  pending bigint,
  trial bigint,
  active bigint,
  past_due bigint,
  suspended bigint,
  cancelled bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where p.coach_status = 'pending')::bigint,
    count(*) filter (where p.coach_status = 'trial')::bigint,
    count(*) filter (where p.coach_status = 'active')::bigint,
    count(*) filter (where p.coach_status = 'past_due')::bigint,
    count(*) filter (where p.coach_status = 'suspended')::bigint,
    count(*) filter (where p.coach_status = 'cancelled')::bigint
  from public.profiles p
  where public.has_coach_capability(p.user_id);
end;
$$;

create or replace function public.admin_list_coaches(
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
  access_expires_at timestamptz,
  status text,
  status_note text,
  admin_notes text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_search text := lower(trim(coalesce(p_search, '')));
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  if v_status is not null and v_status not in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled') then
    raise exception 'Status de personal inválido.' using errcode = '22023';
  end if;

  return query
  select
    p.user_id,
    p.name,
    coalesce(nullif(u.email, ''), nullif(p.contact_email, ''), 'Sem email')::text,
    p.created_at,
    count(s.id)::bigint,
    coalesce(cas.plan, 'Plano piloto')::text,
    p.coach_trial_ends_at,
    p.coach_status,
    p.coach_status_note,
    coalesce(cas.notes, '')::text,
    greatest(p.updated_at, coalesce(cas.updated_at, p.updated_at))
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.students s on s.coach_id = p.user_id::text
  left join public.coach_admin_settings cas on cas.coach_id = p.user_id
  where public.has_coach_capability(p.user_id)
    and (v_status is null or p.coach_status = v_status)
    and (
      v_search = ''
      or lower(p.name) like '%' || v_search || '%'
      or lower(coalesce(u.email, p.contact_email, '')) like '%' || v_search || '%'
    )
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           cas.plan, p.coach_trial_ends_at, p.coach_status,
           p.coach_status_note, cas.notes, p.updated_at, cas.updated_at
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_get_coach(p_coach_id uuid)
returns table (
  coach_id uuid,
  name text,
  email text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  student_count bigint,
  plan text,
  access_expires_at timestamptz,
  status text,
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
set search_path = pg_catalog, public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
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
    p.coach_trial_ends_at,
    p.coach_status,
    p.coach_status_note,
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
  where p.user_id = p_coach_id
    and public.has_coach_capability(p.user_id)
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           u.last_sign_in_at, cas.plan, p.coach_trial_ends_at,
           p.coach_status, p.coach_status_note, cas.notes, p.headline,
           p.city, p.phone, p.whatsapp, p.cref, p.updated_at, cas.updated_at;
end;
$$;

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
    raise exception 'Acesso administrativo não autorizado.' using errcode = 'P0001';
  end if;

  if v_status not in ('pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled') then
    raise exception 'Status de personal inválido.' using errcode = '22023';
  end if;
  if char_length(v_plan) > 80 then
    raise exception 'O plano deve ter no máximo 80 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_admin_notes) > 5000 then
    raise exception 'As observações devem ter no máximo 5.000 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_status_note) > 500 then
    raise exception 'A mensagem ao personal deve ter no máximo 500 caracteres.' using errcode = '22023';
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
    raise exception 'Personal não encontrado.' using errcode = 'P0002';
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
  on conflict (coach_id) do update
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

-- A função auxiliar só deve ser usada pelas RPCs security definer acima.
revoke all on function public.has_coach_capability(uuid) from public, anon, authenticated;

-- Mantém explícitas as permissões já existentes das RPCs substituídas.
revoke all on function public.admin_get_overview() from public, anon, authenticated;
revoke all on function public.admin_list_coaches(text, text) from public, anon, authenticated;
revoke all on function public.admin_get_coach(uuid) from public, anon, authenticated;
revoke all on function public.admin_update_coach(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;

grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_list_coaches(text, text) to authenticated;
grant execute on function public.admin_get_coach(uuid) to authenticated;
grant execute on function public.admin_update_coach(uuid, text, text, timestamptz, text, text) to authenticated;

commit;

-- Verificação: admins continuam role=admin e passam a aparecer nas RPCs.
select p.user_id, u.email, p.role, p.coach_status
from public.profiles p
join auth.users u on u.id = p.user_id
where p.role in ('coach', 'admin')
order by p.created_at desc;
