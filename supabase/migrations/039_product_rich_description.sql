-- 039: descrição rica (Markdown restrito) e fotos de produto enviadas pelo admin.
-- Compatível com versões antigas: description continua existindo (resumo).

alter table public.products
  add column if not exists description_md text;

alter table public.products
  drop constraint if exists products_description_md_len;
alter table public.products
  add constraint products_description_md_len
  check (description_md is null or char_length(description_md) <= 20000);

comment on column public.products.description_md is
  'Descrição completa em Markdown restrito (## seções, listas, **negrito**, tabelas, ![legenda](url do bucket product-images)). Sem HTML. Ver docs/api-contract.md';

-- Bucket público de fotos de produto (já existe em produção; idempotente).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.current_user_role() = 'admin'::public.user_role);

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.current_user_role() = 'admin'::public.user_role)
  with check (bucket_id = 'product-images' and public.current_user_role() = 'admin'::public.user_role);

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.current_user_role() = 'admin'::public.user_role);
