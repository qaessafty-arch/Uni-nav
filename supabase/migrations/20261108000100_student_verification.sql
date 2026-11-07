-- Audience-based visibility and student verification.
--
--  * Visitors (no account): outdoor map, buildings and PUBLIC indoor places only
--    (offices, library, cafeteria, toilets, prayer rooms, services). No teaching
--    rooms, no timetables.
--  * Students: verified for one department (major) and stage (year). They see
--    all rooms and the timetable of their own major and year only.
--  * Staff (lecturers, administrators): everything, as before.
--
-- Verification: a student signs in with their university email (one-time code
-- or link, so the address is proven). If the registration office's roster lists
-- that address, the enrollment is verified automatically; otherwise the student
-- requests a major/year and a department admin approves it.

-- ─── Departments: programme length ─────────────────────────────────────────
alter table public.departments
  add column program_years integer not null default 4 check (program_years between 1 and 7);

-- ─── Helpers ──────────────────────────────────────────────────────────────
create or replace function public.is_public_room_type(p_type text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select p_type in ('office', 'library', 'cafeteria', 'toilet', 'prayer_room', 'service', 'other')
$$;

-- Staff = a membership with a role above student/visitor (or platform owner).
create or replace function public.is_staff(p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_platform_owner()
      or exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.university_id = p_university
                   and m.role not in ('student', 'visitor'))
$$;

insert into public.permissions (code, description) values ('student.verify', 'Verify students and manage the student roster')
  on conflict (code) do nothing;
insert into public.role_permissions (role, permission) values
  ('platform_owner', 'student.verify'), ('university_owner', 'student.verify'),
  ('university_admin', 'student.verify'), ('department_admin', 'student.verify')
  on conflict do nothing;

-- ─── Roster (from the registration office) ────────────────────────────────
create table public.student_roster (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  department_id uuid not null,
  year integer not null check (year between 1 and 7),
  student_number text check (student_number is null or length(student_number) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, email),
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete cascade
);
create index student_roster_dept_idx on public.student_roster (department_id, university_id);
create trigger student_roster_updated_at before update on public.student_roster for each row execute function public.set_updated_at();
alter table public.student_roster enable row level security;
alter table public.student_roster force row level security;
create policy student_roster_select on public.student_roster for select using (public.can_write(university_id, 'student.verify', department_id));
create policy student_roster_insert on public.student_roster for insert with check (public.can_write(university_id, 'student.verify', department_id));
create policy student_roster_update on public.student_roster for update
  using (public.can_write(university_id, 'student.verify', department_id)) with check (public.can_write(university_id, 'student.verify', department_id));
create policy student_roster_delete on public.student_roster for delete using (public.can_write(university_id, 'student.verify', department_id));
revoke all on public.student_roster from anon;
grant select, insert, update, delete on public.student_roster to authenticated;
create trigger student_roster_audit after insert or update or delete on public.student_roster for each row execute function public.audit_trigger();

-- ─── Enrollments (one per student per university) ─────────────────────────
create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  email text not null,
  department_id uuid not null,
  year integer not null check (year between 1 and 7),
  student_number text check (student_number is null or length(student_number) between 1 and 40),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'revoked')),
  method text not null check (method in ('roster', 'review')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, university_id),
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete cascade
);
create index student_enrollments_review_idx on public.student_enrollments (university_id, status, department_id);
create trigger student_enrollments_updated_at before update on public.student_enrollments for each row execute function public.set_updated_at();
alter table public.student_enrollments enable row level security;
alter table public.student_enrollments force row level security;
create policy student_enrollments_select on public.student_enrollments for select
  using (user_id = (select auth.uid()) or public.can_write(university_id, 'student.verify', department_id));
-- No direct writes: students go through the RPCs below, staff through admin_review_enrollment.
revoke all on public.student_enrollments from anon;
revoke insert, update, delete on public.student_enrollments from authenticated;
grant select on public.student_enrollments to authenticated;
create trigger student_enrollments_audit after insert or update or delete on public.student_enrollments for each row execute function public.audit_trigger();

create or replace function public.is_verified_student(p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.student_enrollments e
                 where e.user_id = auth.uid() and e.university_id = p_university and e.status = 'verified')
$$;

-- Timetable of a group is visible to staff and to verified students of that group's major and stage.
create or replace function public.can_read_group_timetable(p_university uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_staff(p_university)
      or exists (
        select 1 from public.student_enrollments e
        join public.student_groups g on g.id = p_group and g.university_id = e.university_id
        where e.user_id = auth.uid() and e.university_id = p_university and e.status = 'verified'
          and g.department_id = e.department_id and g.stage = e.year and g.deleted_at is null
      )
$$;

create or replace function public.can_read_entry(p_entry uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.timetable_entries t
                 where t.id = p_entry and t.deleted_at is null and t.group_id is not null
                   and public.can_read_group_timetable(t.university_id, t.group_id))
$$;

-- ─── Visibility policies ──────────────────────────────────────────────────
-- Rooms: visitors see public places only.
drop policy rooms_select on public.rooms;
create policy rooms_select on public.rooms for select using (
  (deleted_at is null and public.can_read_university(university_id)
     and (public.is_public_room_type(type) or public.is_staff(university_id) or public.is_verified_student(university_id)))
  or public.can_write(university_id, 'room.manage', department_id)
);

-- Map shapes linked to a hidden room are hidden with it (the subquery is itself subject to rooms RLS).
drop policy map_elements_select on public.map_elements;
create policy map_elements_select on public.map_elements for select using (
  (public.can_read_university(university_id)
     and (room_id is null or exists (select 1 from public.rooms r where r.id = room_id)))
  or public.can_write(university_id, 'map.edit')
);

-- Timetable: own major and stage only (or staff / timetable managers).
drop policy timetable_select on public.timetable_entries;
create policy timetable_select on public.timetable_entries for select using (
  (deleted_at is null and group_id is not null and public.can_read_group_timetable(university_id, group_id))
  or public.can_write(university_id, 'timetable.manage')
  or public.can_write(university_id, 'timetable.department_manage', public.course_department(course_id))
);

drop policy schedule_changes_select on public.schedule_changes;
create policy schedule_changes_select on public.schedule_changes for select using (
  public.can_read_entry(entry_id)
  or public.can_write(university_id, 'timetable.manage')
  or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id))
);

-- schedule_changes_write was "for all" and also granted select; narrow it to writes.
drop policy schedule_changes_write on public.schedule_changes;
create policy schedule_changes_insert on public.schedule_changes for insert with check (
  public.can_write(university_id, 'timetable.manage') or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id)));
create policy schedule_changes_update on public.schedule_changes for update
  using (public.can_write(university_id, 'timetable.manage') or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id)))
  with check (public.can_write(university_id, 'timetable.manage') or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id)));
create policy schedule_changes_delete on public.schedule_changes for delete using (
  public.can_write(university_id, 'timetable.manage') or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id)));

-- ─── Student RPCs ─────────────────────────────────────────────────────────
-- The caller's proven email: only a confirmed address counts.
create or replace function public.current_confirmed_email() returns text
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create or replace function public.email_allowed_for(p_university uuid, p_email text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_array_length(u.settings->'studentEmailDomains'), 0) = 0
      or exists (select 1 from jsonb_array_elements_text(u.settings->'studentEmailDomains') d
                 where split_part(p_email, '@', 2) = lower(d) or split_part(p_email, '@', 2) like '%.' || lower(d))
  from public.universities u where u.id = p_university
$$;

-- Verify from the roster. Returns the enrollment, or nothing if the address is not on the roster.
create or replace function public.claim_student_enrollment(p_university uuid)
returns setof public.student_enrollments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := public.current_confirmed_email();
  r public.student_roster;
begin
  if auth.uid() is null or v_email is null then
    raise exception 'sign in with a confirmed email first' using errcode = '42501';
  end if;
  if not public.can_read_university(p_university) then
    raise exception 'university not found' using errcode = '42501';
  end if;
  if not coalesce(public.email_allowed_for(p_university, v_email), false) then
    raise exception 'email_domain_not_allowed' using errcode = '42501';
  end if;
  select * into r from public.student_roster where university_id = p_university and email = v_email;
  if not found then
    return query select * from public.student_enrollments where user_id = auth.uid() and university_id = p_university;
    return;
  end if;
  return query
    insert into public.student_enrollments (user_id, university_id, email, department_id, year, student_number, status, method, reviewed_at)
    values (auth.uid(), p_university, v_email, r.department_id, r.year, r.student_number, 'verified', 'roster', now())
    on conflict (user_id, university_id) do update
      set department_id = excluded.department_id, year = excluded.year, student_number = excluded.student_number,
          status = 'verified', method = 'roster', email = excluded.email, reviewed_at = now(), reviewed_by = null
      where public.student_enrollments.status <> 'revoked'
    returning *;
end $$;

-- Not on the roster: ask a department admin to approve major and year.
create or replace function public.request_student_enrollment(p_university uuid, p_department uuid, p_year integer, p_student_number text default null)
returns setof public.student_enrollments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text := public.current_confirmed_email();
  v_years integer;
begin
  if auth.uid() is null or v_email is null then
    raise exception 'sign in with a confirmed email first' using errcode = '42501';
  end if;
  if not public.can_read_university(p_university) then
    raise exception 'university not found' using errcode = '42501';
  end if;
  if not coalesce(public.email_allowed_for(p_university, v_email), false) then
    raise exception 'email_domain_not_allowed' using errcode = '42501';
  end if;
  select program_years into v_years from public.departments where id = p_department and university_id = p_university and deleted_at is null;
  if v_years is null then raise exception 'unknown department' using errcode = '22023'; end if;
  if p_year is null or p_year < 1 or p_year > v_years then raise exception 'invalid year' using errcode = '22023'; end if;
  if p_student_number is not null and length(btrim(p_student_number)) not between 1 and 40 then raise exception 'invalid student number' using errcode = '22023'; end if;
  -- A roster match wins over a self-declared request.
  if exists (select 1 from public.student_roster where university_id = p_university and email = v_email) then
    return query select * from public.claim_student_enrollment(p_university);
    return;
  end if;
  return query
    insert into public.student_enrollments (user_id, university_id, email, department_id, year, student_number, status, method)
    values (auth.uid(), p_university, v_email, p_department, p_year, nullif(btrim(p_student_number), ''), 'pending', 'review')
    on conflict (user_id, university_id) do update
      set department_id = excluded.department_id, year = excluded.year, student_number = excluded.student_number,
          status = 'pending', method = 'review', reviewed_at = null, reviewed_by = null
      where public.student_enrollments.status in ('pending', 'rejected')
    returning *;
end $$;

create or replace function public.admin_review_enrollment(p_enrollment uuid, p_status text)
returns setof public.student_enrollments
language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.student_enrollments;
begin
  if p_status not in ('verified', 'rejected', 'revoked') then raise exception 'invalid status' using errcode = '22023'; end if;
  select * into e from public.student_enrollments where id = p_enrollment;
  if not found or not public.can_write(e.university_id, 'student.verify', e.department_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    update public.student_enrollments set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_enrollment returning *;
end $$;

revoke execute on function public.claim_student_enrollment(uuid), public.request_student_enrollment(uuid, uuid, integer, text),
  public.admin_review_enrollment(uuid, text), public.current_confirmed_email(), public.email_allowed_for(uuid, text) from public, anon;
grant execute on function public.claim_student_enrollment(uuid), public.request_student_enrollment(uuid, uuid, integer, text),
  public.admin_review_enrollment(uuid, text) to authenticated;
-- Used inside policies, so the calling roles need them.
grant execute on function public.is_staff(uuid), public.is_verified_student(uuid), public.can_read_group_timetable(uuid, uuid),
  public.can_read_entry(uuid), public.is_public_room_type(text) to anon, authenticated;

-- ─── Room occupancy for free rooms ────────────────────────────────────────
-- Students may not read other majors' timetables, but "is this room free?"
-- needs every booking. This returns bookings with nothing personal in them:
-- room, day and times only (no course, group, lecturer or notes).
create or replace function public.room_occupancy(p_university uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (public.is_staff(p_university) or public.is_verified_student(p_university)) then
    return jsonb_build_object('entries', '[]'::jsonb, 'changes', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'room_id', t.room_id, 'recurrence', t.recurrence, 'day', t.day,
        'start_time', t.start_time, 'end_time', t.end_time,
        'valid_from', t.valid_from, 'valid_to', t.valid_to, 'status', t.status))
      from public.timetable_entries t
      where t.university_id = p_university and t.deleted_at is null
        and (t.room_id is not null or exists (select 1 from public.schedule_changes c where c.entry_id = t.id and c.new_room_id is not null))
    ), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'entry_id', c.entry_id, 'date', c.date, 'type', c.type, 'new_room_id', c.new_room_id,
        'new_start_time', c.new_start_time, 'new_end_time', c.new_end_time))
      from public.schedule_changes c
      where c.university_id = p_university and c.type <> 'lecturer_change'
    ), '[]'::jsonb));
end $$;
revoke execute on function public.room_occupancy(uuid) from public, anon;
grant execute on function public.room_occupancy(uuid) to authenticated;
