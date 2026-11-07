-- Building identity on maps and lists (icon, colour, logo) and weekly opening hours.
alter table public.buildings
  add column icon text check (icon is null or icon ~ '^[a-z_]{1,32}$'),
  add column color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text check (logo_url is null or (logo_url ~ '^https?://' and length(logo_url) <= 2048)),
  add column hours jsonb check (hours is null or jsonb_typeof(hours) = 'object');

comment on column public.buildings.icon is 'Key of the shared building icon set (e.g. library, engineering).';
comment on column public.buildings.logo_url is 'Public URL of the building/faculty logo (brand-images bucket). Only logos the university may publish.';
comment on column public.buildings.hours is 'Weekly opening hours {"0":[["08:00","20:00"]],...} in university-local time; day 0 = Sunday.';

-- Storage bucket for building and university logos: brand-images/<university_id>/<file>.
-- Images are re-encoded to PNG/WebP in the browser before upload; SVG is not accepted.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('brand-images', 'brand-images', true, 1048576, array['image/png', 'image/webp', 'image/jpeg'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$create policy brand_images_read on storage.objects for select using (bucket_id = 'brand-images')$p$;
    execute $p$create policy brand_images_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'brand-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and (public.can_write(((storage.foldername(name))[1])::uuid, 'building.manage')
             or public.can_write(((storage.foldername(name))[1])::uuid, 'university.update'))
        and lower(storage.extension(name)) in ('png', 'webp', 'jpg', 'jpeg'))$p$;
    execute $p$create policy brand_images_delete on storage.objects for delete to authenticated
      using (bucket_id = 'brand-images'
        and (public.can_write(((storage.foldername(name))[1])::uuid, 'building.manage')
             or public.can_write(((storage.foldername(name))[1])::uuid, 'university.update')))$p$;
  end if;
end $$;
