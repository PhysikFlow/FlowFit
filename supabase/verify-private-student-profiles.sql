-- Execute depois de 20260822143000_flowfit_private_student_profiles.sql.
-- Este arquivo somente valida catálogo e permissões; não altera dados.

do $$
declare
  v_bucket_public boolean;
begin
  if to_regclass('public.student_profiles') is null then
    raise exception 'student_profiles_missing';
  end if;

  select b.public
    into v_bucket_public
    from storage.buckets b
   where b.id = 'flowfit-student-avatars';

  if v_bucket_public is null then
    raise exception 'student_avatar_bucket_missing';
  end if;
  if v_bucket_public then
    raise exception 'student_avatar_bucket_must_be_private';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.student_profiles'::regclass) then
    raise exception 'student_profiles_rls_disabled';
  end if;
  if has_table_privilege('anon', 'public.student_profiles', 'select') then
    raise exception 'anon_must_not_read_student_profiles';
  end if;
end;
$$;

select
  'private-student-profiles-ok' as verification,
  (select count(*) from public.student_profiles) as profile_rows,
  (select public = false from storage.buckets where id = 'flowfit-student-avatars') as bucket_is_private,
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'student_profiles'
  ) as profile_policy_count_ok,
  (
    select count(*) = 4
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'flowfit_student_avatars_%'
  ) as storage_policy_count_ok;
