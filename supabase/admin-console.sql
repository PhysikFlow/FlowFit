-- ============================================================================
-- FlowFit: painel administrativo de personals (migração incremental)
--
-- Pode ser executada mais de uma vez. Não apaga nem altera o status de contas
-- existentes. Novos perfis de personal passam a iniciar como "pending".
-- ============================================================================

begin;

alter table public.profiles
  alter column coach_status set default 'pending';

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.coach_admin_settings (
  coach_id uuid primary key references public.profiles(user_id) on delete cascade,
  plan text not null default 'Plano piloto',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint coach_admin_settings_plan_length check (char_length(plan) between 1 and 80),
  constraint coach_admin_settings_notes_length check (char_length(notes) <= 5000)
);

create table if not exists public.coach_admin_history (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(user_id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint coach_admin_history_action_length check (char_length(action) between 1 and 80)
);

create index if not exists coach_admin_history_coach_created_idx
  on public.coach_admin_history (coach_id, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.platform_admins pa
       where pa.user_id = auth.uid()
     );
$$;

alter table public.platform_admins enable row level security;
alter table public.coach_admin_settings enable row level security;
alter table public.coach_admin_history enable row level security;

drop policy if exists "platform_admins_select_admin" on public.platform_admins;
create policy "platform_admins_select_admin"
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "coach_admin_settings_select_admin" on public.coach_admin_settings;
create policy "coach_admin_settings_select_admin"
  on public.coach_admin_settings for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "coach_admin_history_select_admin" on public.coach_admin_history;
create policy "coach_admin_history_select_admin"
  on public.coach_admin_history for select
  to authenticated
  using (public.is_platform_admin());

-- O perfil próprio só pode ser criado como pending. A ativação ocorre pelas
-- funções administrativas abaixo, nunca por update direto do frontend.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and role = 'coach'
    and coach_status = 'pending'
  );

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
  where p.role = 'coach';
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
  where p.role = 'coach'
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
    and p.role = 'coach'
  group by p.user_id, p.name, u.email, p.contact_email, p.created_at,
           u.last_sign_in_at, cas.plan, p.coach_trial_ends_at,
           p.coach_status, p.coach_status_note, cas.notes, p.headline,
           p.city, p.phone, p.whatsapp, p.cref, p.updated_at, cas.updated_at;
end;
$$;

create or replace function public.admin_list_coach_history(p_coach_id uuid)
returns table (
  id uuid,
  action text,
  actor_email text,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz
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
    h.id,
    h.action,
    coalesce(u.email, 'Administrador removido')::text,
    h.previous_values,
    h.new_values,
    h.created_at
  from public.coach_admin_history h
  left join auth.users u on u.id = h.admin_user_id
  where h.coach_id = p_coach_id
  order by h.created_at desc
  limit 100;
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
    and p.role = 'coach'
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

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.coach_admin_settings from anon, authenticated;
revoke all on public.coach_admin_history from anon, authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.coach_admin_settings to authenticated;
grant select on public.coach_admin_history to authenticated;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.admin_get_overview() from public;
revoke all on function public.admin_list_coaches(text, text) from public;
revoke all on function public.admin_get_coach(uuid) from public;
revoke all on function public.admin_list_coach_history(uuid) from public;
revoke all on function public.admin_update_coach(uuid, text, text, timestamptz, text, text) from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_list_coaches(text, text) to authenticated;
grant execute on function public.admin_get_coach(uuid) to authenticated;
grant execute on function public.admin_list_coach_history(uuid) to authenticated;
grant execute on function public.admin_update_coach(uuid, text, text, timestamptz, text, text) to authenticated;

commit;

-- Depois da migração, defina o primeiro administrador manualmente no SQL Editor:
-- insert into public.platform_admins (user_id, created_by)
-- select id, id from auth.users where lower(email) = lower('seu@email.com')
-- on conflict (user_id) do nothing;
