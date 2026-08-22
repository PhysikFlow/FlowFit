-- FlowFit: perfil editavel do aluno e avatares privados.
--
-- O cadastro administrativo continua em public.students. Esta tabela guarda
-- somente dados que pertencem a conta autenticada e que o aluno pode editar.
-- Personais vinculados recebem leitura apenas destes campos, nunca do profile
-- de autenticacao completo.

begin;

create table if not exists public.student_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  phone         text not null default '',
  avatar_path   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint student_profiles_display_name_length
    check (char_length(display_name) <= 80),
  constraint student_profiles_phone_length
    check (char_length(phone) <= 30),
  constraint student_profiles_avatar_path_own
    check (avatar_path is null or avatar_path = user_id::text || '/avatar.webp')
);

-- Cria perfis vazios para alunos que ja possuem uma conta vinculada. O nome
-- original nao e copiado: display_name vazio significa usar students.name.
insert into public.student_profiles (user_id)
select distinct s.student_user_id
from public.students s
where s.student_user_id is not null
on conflict (user_id) do nothing;

-- Usado pelas policies que validam o vínculo professor-aluno tanto na tabela
-- quanto no Storage. Evita varrer a lista inteira a cada signed URL.
create index if not exists students_coach_user_profile_idx
  on public.students (coach_id, student_user_id)
  where student_user_id is not null;

create or replace function public.touch_student_profile_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.display_name := trim(coalesce(new.display_name, ''));
  new.phone := trim(coalesce(new.phone, ''));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists student_profiles_touch_updated_at on public.student_profiles;
create trigger student_profiles_touch_updated_at
before insert or update on public.student_profiles
for each row execute function public.touch_student_profile_updated_at();

alter table public.student_profiles enable row level security;

revoke all on public.student_profiles from public, anon, authenticated;
grant select, insert, update on public.student_profiles to authenticated;

drop policy if exists "student_profiles_select_own_or_linked_coach" on public.student_profiles;
drop policy if exists "student_profiles_insert_own" on public.student_profiles;
drop policy if exists "student_profiles_update_own" on public.student_profiles;

create policy "student_profiles_select_own_or_linked_coach"
  on public.student_profiles for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.can_operate_as_coach())
      and exists (
        select 1
        from public.students s
        where s.student_user_id = student_profiles.user_id
          and s.coach_id = (select auth.uid())::text
      )
    )
  );

create policy "student_profiles_insert_own"
  on public.student_profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "student_profiles_update_own"
  on public.student_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'flowfit-student-avatars',
  'flowfit-student-avatars',
  false,
  1048576,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "flowfit_student_avatars_select_linked" on storage.objects;
drop policy if exists "flowfit_student_avatars_insert_own" on storage.objects;
drop policy if exists "flowfit_student_avatars_update_own" on storage.objects;
drop policy if exists "flowfit_student_avatars_delete_own" on storage.objects;

create policy "flowfit_student_avatars_select_linked"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'flowfit-student-avatars'
    and (
      name = (select auth.uid())::text || '/avatar.webp'
      or (
        (select public.can_operate_as_coach())
        and exists (
          select 1
          from public.students s
          where s.student_user_id::text = split_part(storage.objects.name, '/', 1)
            and s.coach_id = (select auth.uid())::text
        )
      )
    )
  );

create policy "flowfit_student_avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flowfit-student-avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
  );

create policy "flowfit_student_avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flowfit-student-avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
  )
  with check (
    bucket_id = 'flowfit-student-avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
  );

create policy "flowfit_student_avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flowfit-student-avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
  );

revoke all on function public.touch_student_profile_updated_at() from public, anon, authenticated;

commit;
