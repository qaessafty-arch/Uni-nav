-- Users, memberships, roles/permissions and the authorization functions used by RLS.

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text check (display_name is null or length(display_name) <= 120),
  is_platform_owner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index user_profiles_email_uniq on public.user_profiles (lower(email));
create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();

create table public.roles (
  role public.app_role primary key,
  rank integer not null unique,
  description text not null
);

create table public.permissions (
  code text primary key,
  description text not null
);

create table public.role_permissions (
  role public.app_role not null references public.roles(role) on delete cascade,
  permission text not null references public.permissions(code) on delete cascade,
  primary key (role, permission)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  role public.app_role not null check (role <> 'platform_owner'),
  department_id uuid,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, university_id),
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete set null (department_id),
  check (role <> 'department_admin' or department_id is not null)
);
create index memberships_univ_idx on public.memberships (university_id);
create trigger memberships_updated_at before update on public.memberships for each row execute function public.set_updated_at();

-- Seed roles & permissions (mirrors packages/core/src/auth/permissions.ts; a test checks they match)
insert into public.roles (role, rank, description) values
  ('platform_owner', 100, 'NULL-TECH platform-level management'),
  ('university_owner', 80, 'Owns one university tenant'),
  ('university_admin', 60, 'Manages university data'),
  ('department_admin', 40, 'Manages an assigned department'),
  ('lecturer', 20, 'Manages own lecturer profile'),
  ('student', 10, 'Authorized student features'),
  ('visitor', 0, 'Public campus information');

insert into public.permissions (code, description) values
  ('university.create', 'Create universities'), ('university.update', 'Edit university profile'),
  ('university.settings', 'Edit tenant settings'), ('campus.manage', 'Manage campuses'),
  ('building.manage', 'Manage buildings'), ('floor.manage', 'Manage floors'), ('room.manage', 'Manage rooms'),
  ('map.edit', 'Edit maps and navigation graph'), ('department.manage', 'Manage departments'),
  ('lecturer.manage', 'Manage lecturers'), ('lecturer.self_update', 'Update own lecturer profile'),
  ('course.manage', 'Manage courses'), ('group.manage', 'Manage student groups'),
  ('timetable.manage', 'Manage all timetables'), ('timetable.department_manage', 'Manage department timetables'),
  ('checkpoint.manage', 'Manage QR checkpoints'), ('announcement.manage', 'Manage announcements'),
  ('member.invite', 'Invite members'), ('member.manage', 'Manage owners and members'),
  ('audit.read', 'Read audit logs'), ('data.import', 'Import data'), ('data.export', 'Export data'),
  ('public.read', 'Read public data'), ('student.personal', 'Personal student features');

with admin_set(p) as (values ('university.update'),('campus.manage'),('building.manage'),('floor.manage'),('room.manage'),('map.edit'),
  ('department.manage'),('lecturer.manage'),('course.manage'),('group.manage'),('timetable.manage'),('timetable.department_manage'),
  ('checkpoint.manage'),('announcement.manage'),('member.invite'),('audit.read'),('data.import'),('data.export'),('public.read'),('student.personal'))
insert into public.role_permissions (role, permission)
  select 'platform_owner'::public.app_role, p from admin_set
  union all select 'platform_owner', p from (values ('university.create'),('university.settings'),('member.manage')) v(p)
  union all select 'university_owner', p from admin_set
  union all select 'university_owner', p from (values ('university.settings'),('member.manage')) v(p)
  union all select 'university_admin', p from admin_set
  union all select 'department_admin', p from (values ('room.manage'),('lecturer.manage'),('course.manage'),('group.manage'),
     ('timetable.department_manage'),('data.export'),('public.read'),('student.personal')) v(p)
  union all select 'lecturer', p from (values ('lecturer.self_update'),('public.read'),('student.personal')) v(p)
  union all select 'student', p from (values ('public.read'),('student.personal')) v(p)
  union all select 'visitor', 'public.read';

-- ─── Authorization functions ────────────────────────────────────────────────
-- SECURITY DEFINER with a pinned search_path so RLS policies can consult
-- memberships without recursive policy evaluation. They only ever read.

create or replace function public.is_platform_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_platform_owner from public.user_profiles where id = auth.uid()), false)
$$;

create or replace function public.is_member(p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_platform_owner()
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.university_id = p_university)
$$;

create or replace function public.role_rank_in(p_university uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public.is_platform_owner() then 100 else
    coalesce((select max(r.rank) from public.memberships m join public.roles r on r.role = m.role
              where m.user_id = auth.uid() and m.university_id = p_university), -1) end
$$;

create or replace function public.has_permission(p_university uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_platform_owner()
      or exists (
        select 1 from public.memberships m
        join public.role_permissions rp on rp.role = m.role
        where m.user_id = auth.uid() and m.university_id = p_university and rp.permission = p_permission
      )
$$;

-- Write check with department scoping: university-wide permission, or a
-- department admin acting on a row in their own department.
create or replace function public.can_write(p_university uuid, p_permission text, p_department uuid default null) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select
    case
      when public.is_platform_owner() then true
      when exists (
        select 1 from public.memberships m join public.role_permissions rp on rp.role = m.role
        where m.user_id = auth.uid() and m.university_id = p_university and rp.permission = p_permission
          and m.role <> 'department_admin'
      ) then true
      when p_department is not null and exists (
        select 1 from public.memberships m join public.role_permissions rp on rp.role = m.role
        where m.user_id = auth.uid() and m.university_id = p_university and m.role = 'department_admin'
          and m.department_id = p_department
          and rp.permission = p_permission
      ) then true
      else false
    end
$$;

create or replace function public.is_university_public(p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.universities u where u.id = p_university and u.published and u.deleted_at is null)
$$;

create or replace function public.can_read_university(p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_university_public(p_university) or public.is_member(p_university)
$$;

create or replace function public.can_read_timetable(p_university uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_member(p_university)
      or exists (select 1 from public.universities u
                 where u.id = p_university and u.published and u.deleted_at is null
                   and coalesce(u.settings->>'timetableVisibility', 'members') = 'public')
$$;

-- Mirrors core canAssignRole(): never grant at or above your own rank; only
-- owners (or platform owners) can create owners; platform_owner is never granted here.
create or replace function public.can_assign_role(p_university uuid, p_target public.app_role) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_rank integer := public.role_rank_in(p_university);
  v_target integer;
begin
  if p_target = 'platform_owner' then return false; end if;
  if not public.has_permission(p_university, 'member.invite') then return false; end if;
  select rank into v_target from public.roles where role = p_target;
  if p_target = 'university_owner' then return v_rank >= 80; end if;
  return v_rank > v_target;
end $$;

-- Auto-create a profile when an auth user is created.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Prevent users from promoting themselves to platform owner.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if; -- service role / SQL console
  if new.is_platform_owner is distinct from old.is_platform_owner and not public.is_platform_owner() then
    raise exception 'not allowed to change platform ownership' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and not public.is_platform_owner() then
    raise exception 'email is managed by authentication' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger user_profiles_guard before update on public.user_profiles for each row execute function public.guard_profile_update();

-- Personal (per-user) data ------------------------------------------------------
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  locale text check (locale in ('en', 'ckb', 'ar')),
  theme text check (theme in ('dark', 'light', 'system')),
  student_group_id uuid,
  accessible_routes boolean not null default false,
  keep_history boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

create table public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  room_id uuid,
  node_id uuid,
  label text check (label is null or length(label) <= 120),
  created_at timestamptz not null default now(),
  check (room_id is not null or node_id is not null),
  foreign key (room_id, university_id) references public.rooms(id, university_id) on delete cascade,
  foreign key (node_id, university_id) references public.navigation_nodes(id, university_id) on delete cascade
);
create index saved_locations_user_idx on public.saved_locations (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete cascade,
  title jsonb not null check (public.is_localized(title)),
  body jsonb,
  link text check (link is null or link ~ '^/[^/]'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Push tokens for Expo notifications (one row per device).
create table public.push_tokens (
  token text primary key check (length(token) <= 255),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
