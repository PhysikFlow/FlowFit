-- FlowFit: assets públicos da identidade do professor.
-- A imagem é pública para que o app do aluno possa renderizá-la sem depender
-- de uma sessão do professor. Escrita e remoção continuam restritas à pasta
-- cujo primeiro segmento é o auth.uid() do próprio professor.

begin;

alter table public.brand_theme
  add column if not exists logo_path text,
  add column if not exists photo_path text,
  add column if not exists logo_frame_enabled boolean not null default true;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'flowfit-brand-assets',
  'flowfit-brand-assets',
  true,
  2097152,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "flowfit_brand_assets_select_own" on storage.objects;
drop policy if exists "flowfit_brand_assets_insert_own" on storage.objects;
drop policy if exists "flowfit_brand_assets_update_own" on storage.objects;
drop policy if exists "flowfit_brand_assets_delete_own" on storage.objects;

create policy "flowfit_brand_assets_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'flowfit-brand-assets'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and (select public.can_operate_as_coach())
  );

create policy "flowfit_brand_assets_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'flowfit-brand-assets'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and (select public.can_operate_as_coach())
  );

create policy "flowfit_brand_assets_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'flowfit-brand-assets'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and (select public.can_operate_as_coach())
  )
  with check (
    bucket_id = 'flowfit-brand-assets'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and (select public.can_operate_as_coach())
  );

create policy "flowfit_brand_assets_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'flowfit-brand-assets'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and (select public.can_operate_as_coach())
  );

commit;
