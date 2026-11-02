-- Campus overview background picture (aerial photo / official campus plan).
-- Building footprints are drawn over it in the admin "Campus map" editor.

alter table public.campuses
  add column overview_image_url text
  check (overview_image_url is null or (overview_image_url ~ '^https?://' and length(overview_image_url) <= 2048));

comment on column public.campuses.overview_image_url is
  'Public URL of the campus overview picture (campus-images bucket). Upload only images the university may publish.';

-- Storage bucket (Supabase only): campus-images/<university_id>/<file>
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('campus-images', 'campus-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$create policy campus_images_read on storage.objects for select using (bucket_id = 'campus-images')$p$;
    execute $p$create policy campus_images_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'campus-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and public.can_write(((storage.foldername(name))[1])::uuid, 'campus.manage')
        and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp'))$p$;
    execute $p$create policy campus_images_delete on storage.objects for delete to authenticated
      using (bucket_id = 'campus-images' and public.can_write(((storage.foldername(name))[1])::uuid, 'campus.manage'))$p$;
  end if;
end $$;
