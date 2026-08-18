-- Reforça que somente professores com acesso permitido podem alterar assets.
-- A migration separada existe porque a criação inicial do bucket já foi
-- aplicada no remoto antes desta autorização adicional.

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
