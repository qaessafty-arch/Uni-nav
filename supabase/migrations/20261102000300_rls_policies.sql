-- Row Level Security. Enforced for every client (anon + authenticated).
-- The service role bypasses RLS and must never be shipped to clients.

-- Helpers resolving the department of rows whose department is indirect.
create or replace function public.course_department(p_course uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select department_id from public.courses where id = p_course
$$;

create or replace function public.entry_department(p_entry uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select c.department_id from public.timetable_entries t join public.courses c on c.id = t.course_id where t.id = p_entry
$$;

-- ─── Enable RLS everywhere ─────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['universities','campuses','buildings','floors','departments','navigation_nodes','navigation_edges','rooms',
    'map_assets','map_elements','qr_checkpoints','lecturers','lecturer_offices','courses','student_groups','semesters','timetable_entries',
    'schedule_changes','announcements','user_profiles','roles','permissions','role_permissions','memberships','user_preferences',
    'saved_locations','notifications','push_tokens']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ─── Universities ──────────────────────────────────────────────────────────
create policy universities_select on public.universities for select
  using ((deleted_at is null and (published or public.is_member(id))) or public.is_platform_owner());
create policy universities_insert on public.universities for insert with check (public.is_platform_owner());
create policy universities_update on public.universities for update
  using (public.has_permission(id, 'university.update')) with check (public.has_permission(id, 'university.update'));
create policy universities_delete on public.universities for delete using (public.is_platform_owner());

-- Changing tenant-level settings requires university.settings (owners), not just university.update.
create or replace function public.guard_university_settings() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if; -- service role / migrations
  if (new.settings is distinct from old.settings or new.published is distinct from old.published
      or new.slug is distinct from old.slug or new.deleted_at is distinct from old.deleted_at
      or new.data_status is distinct from old.data_status)
     and not public.has_permission(old.id, 'university.settings') then
    raise exception 'university.settings permission required' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger universities_guard before update on public.universities for each row execute function public.guard_university_settings();

-- ─── Generic public-read / permission-write tables ─────────────────────────
-- (table, permission, has deleted_at, department column expression or null)
do $$
declare
  rec record;
begin
  for rec in select * from (values
    ('campuses', 'campus.manage', true, null),
    ('buildings', 'building.manage', true, null),
    ('floors', 'floor.manage', true, null),
    ('departments', 'department.manage', true, null),
    ('navigation_nodes', 'map.edit', false, null),
    ('navigation_edges', 'map.edit', false, null),
    ('map_elements', 'map.edit', false, null),
    ('rooms', 'room.manage', true, 'department_id'),
    ('lecturers', 'lecturer.manage', true, 'department_id'),
    ('courses', 'course.manage', true, 'department_id'),
    ('student_groups', 'group.manage', true, 'department_id'),
    ('semesters', 'timetable.manage', false, null),
    ('announcements', 'announcement.manage', true, null),
    ('lecturer_offices', 'lecturer.manage', false, null)
  ) as v(tbl, perm, soft, dept)
  loop
    execute format(
      'create policy %1$s_select on public.%1$I for select using ((%2$s public.can_read_university(university_id)) or public.can_write(university_id, %3$L%4$s))',
      rec.tbl, case when rec.soft then 'deleted_at is null and' else '' end, rec.perm,
      case when rec.dept is not null then ', ' || rec.dept else '' end);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert with check (public.can_write(university_id, %2$L%3$s))',
      rec.tbl, rec.perm, case when rec.dept is not null then ', ' || rec.dept else '' end);
    execute format(
      'create policy %1$s_update on public.%1$I for update using (public.can_write(university_id, %2$L%3$s)) with check (public.can_write(university_id, %2$L%3$s))',
      rec.tbl, rec.perm, case when rec.dept is not null then ', ' || rec.dept else '' end);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete using (public.can_write(university_id, %2$L%3$s))',
      rec.tbl, rec.perm, case when rec.dept is not null then ', ' || rec.dept else '' end);
  end loop;
end $$;

-- Lecturers may update their own profile's office hours / availability only.
create policy lecturers_self_update on public.lecturers for update
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create or replace function public.guard_lecturer_self_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or public.can_write(old.university_id, 'lecturer.manage', old.department_id) then
    return new;
  end if;
  -- Self-service path: only these columns may change.
  if (to_jsonb(new) - array['office_hours','availability','updated_at']) is distinct from (to_jsonb(old) - array['office_hours','availability','updated_at']) then
    raise exception 'lecturers may only update office hours and availability' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger lecturers_self_guard before update on public.lecturers for each row execute function public.guard_lecturer_self_update();

-- ─── Map assets ────────────────────────────────────────────────────────────
create policy map_assets_select on public.map_assets for select using (public.can_read_university(university_id));
create policy map_assets_write on public.map_assets for all
  using (public.can_write(university_id, 'map.edit')) with check (public.can_write(university_id, 'map.edit'));

-- ─── Timetable ─────────────────────────────────────────────────────────────
create policy timetable_select on public.timetable_entries for select
  using ((deleted_at is null and public.can_read_timetable(university_id))
         or public.can_write(university_id, 'timetable.manage'));
create policy timetable_insert on public.timetable_entries for insert with check (
  public.can_write(university_id, 'timetable.manage')
  or public.can_write(university_id, 'timetable.department_manage', public.course_department(course_id)));
create policy timetable_update on public.timetable_entries for update
  using (public.can_write(university_id, 'timetable.manage')
         or public.can_write(university_id, 'timetable.department_manage', public.course_department(course_id)))
  with check (public.can_write(university_id, 'timetable.manage')
         or public.can_write(university_id, 'timetable.department_manage', public.course_department(course_id)));
create policy timetable_delete on public.timetable_entries for delete using (
  public.can_write(university_id, 'timetable.manage')
  or public.can_write(university_id, 'timetable.department_manage', public.course_department(course_id)));

create policy schedule_changes_select on public.schedule_changes for select using (public.can_read_timetable(university_id));
create policy schedule_changes_write on public.schedule_changes for all
  using (public.can_write(university_id, 'timetable.manage')
         or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id)))
  with check (public.can_write(university_id, 'timetable.manage')
         or public.can_write(university_id, 'timetable.department_manage', public.entry_department(entry_id)));

-- ─── QR checkpoints: tokens are admin-only; public access via view + RPC ───
create policy qr_select on public.qr_checkpoints for select using (public.can_write(university_id, 'checkpoint.manage'));
create policy qr_insert on public.qr_checkpoints for insert with check (public.can_write(university_id, 'checkpoint.manage'));
create policy qr_update on public.qr_checkpoints for update
  using (public.can_write(university_id, 'checkpoint.manage')) with check (public.can_write(university_id, 'checkpoint.manage'));
create policy qr_delete on public.qr_checkpoints for delete using (public.can_write(university_id, 'checkpoint.manage'));

-- Non-sensitive checkpoint data for drawing on maps (no tokens).
create view public.public_checkpoints with (security_barrier = true) as
  select c.id, c.university_id, c.node_id, c.label
  from public.qr_checkpoints c
  where c.status = 'active' and c.deleted_at is null
    and (c.expires_at is null or c.expires_at > now())
    and public.can_read_university(c.university_id);

create or replace function public.resolve_checkpoint(p_token text)
returns table (id uuid, university_id uuid, node_id uuid, label jsonb, status text, expires_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  -- Strict format check before touching the table; arbitrary input never reaches SQL text.
  if p_token is null or p_token !~ '^[A-Za-z0-9]{16,64}$' then
    return;
  end if;
  return query
    select c.id, c.university_id, c.node_id, c.label, c.status, c.expires_at
    from public.qr_checkpoints c
    where c.token = p_token and c.deleted_at is null and public.can_read_university(c.university_id);
end $$;

-- ─── Users, roles, memberships ─────────────────────────────────────────────
create policy profiles_select on public.user_profiles for select using (id = auth.uid() or public.is_platform_owner());
create policy profiles_update on public.user_profiles for update using (id = auth.uid() or public.is_platform_owner())
  with check (id = auth.uid() or public.is_platform_owner());

create policy roles_read on public.roles for select using (true);
create policy permissions_read on public.permissions for select using (true);
create policy role_permissions_read on public.role_permissions for select using (true);

create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.has_permission(university_id, 'member.invite'));
-- Inserts/updates go through admin_set_member_role(); deletes allowed only for roles you could assign.
create policy memberships_delete on public.memberships for delete
  using (public.can_assign_role(university_id, role) and user_id <> auth.uid());

create policy prefs_own on public.user_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_own on public.saved_locations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_read_university(university_id));
create policy notifications_own_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_own on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Member management RPCs ────────────────────────────────────────────────
create or replace function public.admin_list_members(p_university uuid)
returns table (id uuid, user_id uuid, email text, university_id uuid, role public.app_role, department_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.has_permission(p_university, 'member.invite') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.id, m.user_id, p.email, m.university_id, m.role, m.department_id, m.created_at
    from public.memberships m left join public.user_profiles p on p.id = m.user_id
    where m.university_id = p_university
    order by m.created_at;
end $$;

create or replace function public.admin_set_member_role(p_university uuid, p_email text, p_role public.app_role, p_department_id uuid default null)
returns setof public.memberships
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
  v_existing public.memberships;
begin
  if not public.can_assign_role(p_university, p_role) then
    raise exception 'forbidden: cannot assign role %', p_role using errcode = '42501';
  end if;
  select id into v_user from public.user_profiles where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0002', hint = 'The person must create an account first (or be invited via the invite-member edge function).';
  end if;
  if v_user = auth.uid() then
    raise exception 'forbidden: cannot change your own role' using errcode = '42501';
  end if;
  select * into v_existing from public.memberships where user_id = v_user and university_id = p_university;
  if found and not public.can_assign_role(p_university, v_existing.role) then
    raise exception 'forbidden: cannot modify a member with role %', v_existing.role using errcode = '42501';
  end if;
  return query
    insert into public.memberships (user_id, university_id, role, department_id, invited_by)
    values (v_user, p_university, p_role, p_department_id, auth.uid())
    on conflict (user_id, university_id) do update set role = excluded.role, department_id = excluded.department_id
    returning *;
end $$;

-- University onboarding without code changes (platform owners only).
create or replace function public.create_university(p_slug text, p_name jsonb, p_short_name text, p_owner_email text, p_timezone text default 'Asia/Baghdad')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_owner uuid;
begin
  if not public.is_platform_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform now() at time zone p_timezone; -- validates the zone name
  insert into public.universities (slug, name, short_name, data_status, published, settings)
  values (p_slug, p_name, p_short_name, 'unverified', false,
          jsonb_build_object('timezone', p_timezone, 'weekendDays', jsonb_build_array(5, 6), 'defaultLocale', 'en',
            'enabledLocales', jsonb_build_array('en', 'ckb', 'ar'), 'timetableVisibility', 'members',
            'walkingSpeedMps', 1.2, 'accessibleWalkingSpeedMps', 0.8, 'stairsSecondsPerFloor', 20, 'elevatorSecondsPerFloor', 45))
  returning id into v_id;
  select id into v_owner from public.user_profiles where lower(email) = lower(trim(p_owner_email));
  if v_owner is not null then
    insert into public.memberships (user_id, university_id, role, invited_by) values (v_owner, v_id, 'university_owner', auth.uid());
  end if;
  return v_id;
end $$;

-- ─── Grants (RLS still applies) ────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke insert, update, delete on public.roles, public.permissions, public.role_permissions from authenticated;
revoke insert, update on public.memberships from authenticated;
grant execute on function public.resolve_checkpoint(text) to anon, authenticated;
grant execute on function public.admin_list_members(uuid), public.admin_set_member_role(uuid, text, public.app_role, uuid),
  public.create_university(text, jsonb, text, text, text) to authenticated;
