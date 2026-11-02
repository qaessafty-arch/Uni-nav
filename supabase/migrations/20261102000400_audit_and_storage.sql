-- Audit logging and storage policies.

create table public.audit_logs (
  id bigint generated always as identity primary key,
  university_id uuid references public.universities(id) on delete set null,
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text,
  diff jsonb,
  changed_at timestamptz not null default now()
);
create index audit_logs_univ_idx on public.audit_logs (university_id, changed_at desc);
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create policy audit_select on public.audit_logs for select
  using (university_id is not null and public.has_permission(university_id, 'audit.read'));
-- No insert/update/delete policies: rows are written only by the trigger below.
grant select on public.audit_logs to authenticated;
revoke insert, update, delete on public.audit_logs from authenticated, anon;

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_diff jsonb;
  v_univ uuid;
begin
  v_univ := case when tg_table_name = 'universities' then (v_row->>'id')::uuid else (v_row->>'university_id')::uuid end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('from', v_old->k, 'to', v_new->k))
      into v_diff
      from jsonb_object_keys(v_new) k
      where k not in ('updated_at') and v_new->k is distinct from v_old->k;
    if v_diff is null then return new; end if;
  else
    v_diff := v_row - array['token'];
  end if;
  -- Never store checkpoint tokens in audit history.
  if tg_table_name = 'qr_checkpoints' and v_diff ? 'token' then
    v_diff := jsonb_set(v_diff, '{token}', '"[redacted]"'::jsonb);
  end if;
  insert into public.audit_logs (university_id, actor_id, action, table_name, record_id, diff)
  values (v_univ, auth.uid(), lower(tg_op), tg_table_name, v_row->>'id', v_diff);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['universities','campuses','buildings','floors','departments','navigation_nodes','navigation_edges','rooms',
    'map_assets','map_elements','qr_checkpoints','lecturers','courses','student_groups','semesters','timetable_entries','schedule_changes',
    'announcements','memberships']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- Storage (Supabase only). Floor plans live at floor-plans/<university_id>/<file>.svg
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('floor-plans', 'floor-plans', true, 2097152, array['image/svg+xml'])
    on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    execute $p$create policy floor_plans_read on storage.objects for select using (bucket_id = 'floor-plans')$p$;
    execute $p$create policy floor_plans_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'floor-plans'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and public.can_write(((storage.foldername(name))[1])::uuid, 'map.edit')
        and lower(storage.extension(name)) = 'svg')$p$;
    execute $p$create policy floor_plans_delete on storage.objects for delete to authenticated
      using (bucket_id = 'floor-plans' and public.can_write(((storage.foldername(name))[1])::uuid, 'map.edit'))$p$;
  end if;
end $$;
