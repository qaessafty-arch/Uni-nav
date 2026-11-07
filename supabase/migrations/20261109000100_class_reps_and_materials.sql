-- Class representatives, lecture materials and class announcements.
--
-- * A class rep is a verified student appointed for one student group (class).
--   Reps can post announcements to their class and upload lecture materials for
--   the courses their class takes (unless the course turns rep uploads off).
-- * Lecturers linked to a login (lecturers.user_id) can do the same for the
--   groups/courses they teach.
-- * Materials are visible only to staff and to verified students of the class's
--   major and year (same rule as timetables). Files live in a PRIVATE bucket and
--   are opened through short-lived signed URLs.

-- ─── Class reps ───────────────────────────────────────────────────────────
create table public.group_reps (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  group_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  appointed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id),
  foreign key (group_id, university_id) references public.student_groups(id, university_id) on delete cascade
);
create index group_reps_user_idx on public.group_reps (user_id, university_id);
alter table public.group_reps enable row level security;
alter table public.group_reps force row level security;
revoke all on public.group_reps from anon;
revoke insert, update, delete on public.group_reps from authenticated;
grant select on public.group_reps to authenticated;
create trigger group_reps_audit after insert or update or delete on public.group_reps for each row execute function public.audit_trigger();

create or replace function public.group_department(p_group uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select department_id from public.student_groups where id = p_group
$$;

create policy group_reps_select on public.group_reps for select using (
  user_id = (select auth.uid()) or public.can_write(university_id, 'group.manage', public.group_department(group_id))
);

-- The caller is an appointed rep of the group AND still a verified student of its major/year.
create or replace function public.is_group_rep(p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.group_reps r
    join public.student_groups g on g.id = r.group_id and g.deleted_at is null
    join public.student_enrollments e on e.user_id = r.user_id and e.university_id = r.university_id
    where r.group_id = p_group and r.user_id = auth.uid()
      and e.status = 'verified' and e.department_id = g.department_id and e.year = g.stage
  )
$$;

-- Linked lecturer who teaches this course (optionally to this group).
create or replace function public.is_course_lecturer(p_course uuid, p_group uuid default null) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.lecturers l
    join public.timetable_entries t on t.lecturer_id = l.id and t.deleted_at is null
    where l.user_id = auth.uid() and l.deleted_at is null
      and (p_course is null or t.course_id = p_course)
      and (p_group is null or t.group_id = p_group)
  )
$$;

create or replace function public.appoint_group_rep(p_group uuid, p_user uuid)
returns setof public.group_reps
language plpgsql security definer set search_path = public, pg_temp as $$
declare g public.student_groups; v_email text;
begin
  select * into g from public.student_groups where id = p_group and deleted_at is null;
  if g.id is null then raise exception 'group not found'; end if;
  if not public.can_write(g.university_id, 'group.manage', g.department_id) then
    raise exception 'permission required: group.manage' using errcode = '42501';
  end if;
  select e.email into v_email from public.student_enrollments e
    where e.user_id = p_user and e.university_id = g.university_id and e.status = 'verified'
      and e.department_id = g.department_id and e.year = g.stage;
  if v_email is null then
    raise exception 'not_verified_for_group: the student must be verified for this major and year';
  end if;
  return query
    insert into public.group_reps (university_id, group_id, user_id, email, appointed_by)
    values (g.university_id, g.id, p_user, v_email, auth.uid())
    on conflict (group_id, user_id) do update set email = excluded.email
    returning *;
end $$;

create or replace function public.remove_group_rep(p_rep uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.group_reps;
begin
  select * into r from public.group_reps where id = p_rep;
  if r.id is null then return; end if;
  if not public.can_write(r.university_id, 'group.manage', public.group_department(r.group_id)) then
    raise exception 'permission required: group.manage' using errcode = '42501';
  end if;
  delete from public.group_reps where id = p_rep;
end $$;

revoke execute on function public.appoint_group_rep(uuid, uuid), public.remove_group_rep(uuid) from public, anon;
grant execute on function public.appoint_group_rep(uuid, uuid), public.remove_group_rep(uuid) to authenticated;

-- ─── Course switch: may reps upload? ──────────────────────────────────────
alter table public.courses add column reps_can_upload boolean not null default true;

-- ─── Lecture materials ────────────────────────────────────────────────────
create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  course_id uuid not null,
  group_id uuid, -- null = every class taking the course
  section text check (section is null or length(section) between 1 and 120),
  title text not null check (length(title) between 1 and 200),
  kind text not null check (kind in ('file', 'link')),
  storage_path text check (storage_path is null or storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|pptx|docx|png|jpg|jpeg)$'),
  url text check (url is null or url ~* '^https?://'),
  mime text,
  size_bytes integer check (size_bytes is null or size_bytes between 0 and 20971520),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (course_id, university_id) references public.courses(id, university_id) on delete cascade,
  foreign key (group_id, university_id) references public.student_groups(id, university_id) on delete cascade,
  check ((kind = 'file' and storage_path is not null and url is null) or (kind = 'link' and url is not null and storage_path is null)),
  check (storage_path is null or split_part(storage_path, '/', 1) = university_id::text and split_part(storage_path, '/', 2) = course_id::text)
);
create index course_materials_course_idx on public.course_materials (university_id, course_id, created_at desc);
create unique index course_materials_path_uniq on public.course_materials (storage_path) where storage_path is not null;
create trigger course_materials_updated_at before update on public.course_materials for each row execute function public.set_updated_at();
create trigger course_materials_audit after insert or update or delete on public.course_materials for each row execute function public.audit_trigger();
alter table public.course_materials enable row level security;
alter table public.course_materials force row level security;
revoke all on public.course_materials from anon;
grant select, insert, update, delete on public.course_materials to authenticated;

-- Who may read a course's materials (optionally for one class).
create or replace function public.can_read_course(p_university uuid, p_course uuid, p_group uuid default null) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_staff(p_university)
      or case when p_group is not null then
           public.can_read_group_timetable(p_university, p_group)
         else exists (
           select 1 from public.timetable_entries t
           where t.university_id = p_university and t.course_id = p_course and t.deleted_at is null
             and t.group_id is not null and public.can_read_group_timetable(p_university, t.group_id))
         end
$$;

-- Upload to the course at all (used by storage, before the row exists).
create or replace function public.can_upload_to_course(p_university uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_write(p_university, 'course.manage', public.course_department(p_course))
      or public.is_course_lecturer(p_course)
      or (coalesce((select c.reps_can_upload from public.courses c where c.id = p_course and c.university_id = p_university), false)
          and exists (select 1 from public.group_reps r
                      join public.timetable_entries t on t.group_id = r.group_id and t.course_id = p_course and t.deleted_at is null
                      where r.user_id = auth.uid() and r.university_id = p_university and public.is_group_rep(r.group_id)))
$$;

-- Upload a material row for a given class (reps must name their own class).
create or replace function public.can_upload_material(p_university uuid, p_course uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_write(p_university, 'course.manage', public.course_department(p_course))
      or public.is_course_lecturer(p_course, p_group)
      or (p_group is not null
          and coalesce((select c.reps_can_upload from public.courses c where c.id = p_course and c.university_id = p_university), false)
          and public.is_group_rep(p_group)
          and exists (select 1 from public.timetable_entries t
                      where t.group_id = p_group and t.course_id = p_course and t.deleted_at is null))
$$;

create or replace function public.can_manage_course_materials(p_university uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_write(p_university, 'course.manage', public.course_department(p_course)) or public.is_course_lecturer(p_course)
$$;

create or replace function public.stamp_material_uploader() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then new.uploaded_by := auth.uid(); end if;
  return new;
end $$;
create trigger course_materials_stamp before insert on public.course_materials for each row execute function public.stamp_material_uploader();

create policy course_materials_select on public.course_materials for select using (
  (deleted_at is null and public.can_read_course(university_id, course_id, group_id))
  or public.can_manage_course_materials(university_id, course_id)
);
create policy course_materials_insert on public.course_materials for insert
  with check (public.can_upload_material(university_id, course_id, group_id));
create policy course_materials_update on public.course_materials for update
  using (public.can_manage_course_materials(university_id, course_id)
         or (uploaded_by = (select auth.uid()) and public.can_upload_material(university_id, course_id, group_id)))
  with check (public.can_manage_course_materials(university_id, course_id)
         or (uploaded_by = (select auth.uid()) and public.can_upload_material(university_id, course_id, group_id)));
create policy course_materials_delete on public.course_materials for delete
  using (public.can_manage_course_materials(university_id, course_id)
         or (uploaded_by = (select auth.uid()) and public.can_upload_material(university_id, course_id, group_id)));

-- ─── Class announcements ─────────────────────────────────────────────────
alter table public.announcements add column group_id uuid;
alter table public.announcements add column author_id uuid references auth.users(id) on delete set null;
alter table public.announcements add constraint announcements_group_fk
  foreign key (group_id, university_id) references public.student_groups(id, university_id) on delete cascade;
create index announcements_group_idx on public.announcements (group_id, published_at desc) where group_id is not null;

create or replace function public.can_post_to_group(p_university uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.can_write(p_university, 'announcement.manage')
      or public.is_course_lecturer(null, p_group)
      or public.is_group_rep(p_group)
$$;

create or replace function public.stamp_announcement_author() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null then new.author_id := auth.uid(); end if;
  return new;
end $$;
create trigger announcements_stamp before insert on public.announcements for each row execute function public.stamp_announcement_author();

drop policy announcements_select on public.announcements;
drop policy announcements_insert on public.announcements;
drop policy announcements_update on public.announcements;
drop policy announcements_delete on public.announcements;
create policy announcements_select on public.announcements for select using (
  (deleted_at is null and public.can_read_university(university_id)
     and (group_id is null or public.can_read_group_timetable(university_id, group_id)))
  or public.can_write(university_id, 'announcement.manage')
);
create policy announcements_insert on public.announcements for insert with check (
  public.can_write(university_id, 'announcement.manage')
  or (group_id is not null and public.can_post_to_group(university_id, group_id))
);
create policy announcements_update on public.announcements for update
  using (public.can_write(university_id, 'announcement.manage')
         or (group_id is not null and author_id = (select auth.uid()) and public.can_post_to_group(university_id, group_id)))
  with check (public.can_write(university_id, 'announcement.manage')
         or (group_id is not null and author_id = (select auth.uid()) and public.can_post_to_group(university_id, group_id)));
create policy announcements_delete on public.announcements for delete using (
  public.can_write(university_id, 'announcement.manage')
  or (group_id is not null and author_id = (select auth.uid()) and public.can_post_to_group(university_id, group_id))
);

-- Trigger functions are never called through the API.
revoke execute on function public.stamp_material_uploader(), public.stamp_announcement_author() from public, anon, authenticated;

-- ─── Storage: private bucket course-materials/<university>/<course>/<uuid>.<ext> ───
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('course-materials', 'course-materials', false, 20971520, array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png', 'image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

    -- Read only when the caller may read the material row that points at this file.
    execute $p$create policy course_materials_read on storage.objects for select to authenticated
      using (bucket_id = 'course-materials' and exists (
        select 1 from public.course_materials m
        where m.storage_path = storage.objects.name and m.deleted_at is null
          and (public.can_read_course(m.university_id, m.course_id, m.group_id)
               or public.can_manage_course_materials(m.university_id, m.course_id))))$p$;
    execute $p$create policy course_materials_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'course-materials'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
        and lower(storage.extension(name)) in ('pdf', 'pptx', 'docx', 'png', 'jpg', 'jpeg')
        and public.can_upload_to_course(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid))$p$;
    execute $p$create policy course_materials_remove on storage.objects for delete to authenticated
      using (bucket_id = 'course-materials'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
        and (public.can_manage_course_materials(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
             or (owner = auth.uid() and public.can_upload_to_course(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid))))$p$;
  end if;
end $$;
