-- CAMPUS NAV — core multi-tenant schema
-- Every tenant-owned table carries university_id. Child rows reference parents
-- through composite (id, university_id) foreign keys so a row can never point at
-- another university's data, even if application code is wrong.

create extension if not exists pgcrypto;

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type public.app_role as enum (
  'platform_owner', 'university_owner', 'university_admin', 'department_admin', 'lecturer', 'student', 'visitor'
);
create type public.data_status as enum ('verified', 'demo', 'unverified');

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.is_localized(j jsonb) returns boolean
language sql immutable as $$
  select j is not null and jsonb_typeof(j) = 'object' and coalesce(length(trim(j->>'en')), 0) > 0
$$;

-- ─── Tenancy root ───────────────────────────────────────────────────────────
create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name jsonb not null check (public.is_localized(name)),
  short_name text not null check (length(short_name) between 1 and 40),
  data_status public.data_status not null default 'unverified',
  published boolean not null default false,
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default jsonb_build_object(
    'timezone', 'Asia/Baghdad',
    'weekendDays', jsonb_build_array(5, 6),
    'defaultLocale', 'en',
    'enabledLocales', jsonb_build_array('en', 'ckb', 'ar'),
    'timetableVisibility', 'members',
    'walkingSpeedMps', 1.2,
    'accessibleWalkingSpeedMps', 0.8,
    'stairsSecondsPerFloor', 20,
    'elevatorSecondsPerFloor', 45
  ) check (settings ? 'timezone'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name jsonb not null check (public.is_localized(name)),
  description jsonb,
  overview_width double precision check (overview_width > 0),
  overview_height double precision check (overview_height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id)
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  campus_id uuid not null,
  code text not null check (length(code) between 1 and 20),
  name jsonb not null check (public.is_localized(name)),
  description jsonb,
  overview jsonb,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (campus_id, university_id) references public.campuses(id, university_id) on delete cascade
);
create unique index buildings_code_uniq on public.buildings (university_id, lower(code)) where deleted_at is null;

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  building_id uuid not null,
  level integer not null check (level between -10 and 200),
  name jsonb not null check (public.is_localized(name)),
  width double precision not null check (width > 0),
  height double precision not null check (height > 0),
  meters_per_unit double precision not null check (meters_per_unit > 0 and meters_per_unit <= 100),
  plan_asset_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (building_id, university_id) references public.buildings(id, university_id) on delete cascade
);
create unique index floors_level_uniq on public.floors (building_id, level) where deleted_at is null;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  code text not null check (length(code) between 1 and 20),
  name jsonb not null check (public.is_localized(name)),
  college jsonb,
  building_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (building_id, university_id) references public.buildings(id, university_id) on delete set null (building_id)
);
create unique index departments_code_uniq on public.departments (university_id, lower(code)) where deleted_at is null;

create table public.navigation_nodes (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  floor_id uuid not null,
  x double precision not null,
  y double precision not null,
  kind text not null check (kind in ('corridor', 'room_entrance', 'stairs', 'elevator', 'building_entrance', 'checkpoint', 'outdoor')),
  label jsonb,
  vertical_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, university_id),
  foreign key (floor_id, university_id) references public.floors(id, university_id) on delete cascade
);
create index navigation_nodes_floor_idx on public.navigation_nodes (floor_id);

create table public.navigation_edges (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  from_node_id uuid not null,
  to_node_id uuid not null,
  kind text not null check (kind in ('corridor', 'door', 'stairs', 'elevator', 'ramp', 'outdoor')),
  distance_m double precision check (distance_m >= 0),
  accessible boolean not null default true,
  bidirectional boolean not null default true,
  blocked boolean not null default false,
  restriction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_node_id <> to_node_id),
  foreign key (from_node_id, university_id) references public.navigation_nodes(id, university_id) on delete cascade,
  foreign key (to_node_id, university_id) references public.navigation_nodes(id, university_id) on delete cascade
);
create index navigation_edges_from_idx on public.navigation_edges (from_node_id);
create index navigation_edges_to_idx on public.navigation_edges (to_node_id);
create index navigation_edges_univ_idx on public.navigation_edges (university_id);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  building_id uuid not null,
  floor_id uuid not null,
  code text not null check (length(trim(code)) between 1 and 30),
  name jsonb not null check (public.is_localized(name)),
  type text not null check (type in ('lecture_hall', 'classroom', 'laboratory', 'office', 'library', 'cafeteria', 'toilet', 'prayer_room', 'service', 'storage', 'other')),
  department_id uuid,
  capacity integer check (capacity between 0 and 100000),
  entrance_node_id uuid,
  accessible boolean not null default true,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (building_id, university_id) references public.buildings(id, university_id) on delete cascade,
  foreign key (floor_id, university_id) references public.floors(id, university_id) on delete cascade,
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete set null (department_id),
  foreign key (entrance_node_id, university_id) references public.navigation_nodes(id, university_id) on delete set null (entrance_node_id)
);
create unique index rooms_code_uniq on public.rooms (building_id, lower(code)) where deleted_at is null;
create index rooms_floor_idx on public.rooms (floor_id);
create index rooms_univ_idx on public.rooms (university_id);

create table public.map_assets (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  floor_id uuid not null,
  storage_path text not null,
  content_type text not null check (content_type = 'image/svg+xml'),
  byte_size integer not null check (byte_size between 1 and 2097152),
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  foreign key (floor_id, university_id) references public.floors(id, university_id) on delete cascade
);

create table public.map_elements (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  floor_id uuid not null,
  kind text not null check (kind in ('room', 'corridor', 'stairs', 'elevator', 'entrance', 'emergency_exit', 'toilet', 'wall', 'outdoor', 'building')),
  shape jsonb not null check (shape->>'type' in ('rect', 'polygon')),
  label jsonb,
  room_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (floor_id, university_id) references public.floors(id, university_id) on delete cascade,
  foreign key (room_id, university_id) references public.rooms(id, university_id) on delete set null (room_id)
);
create index map_elements_floor_idx on public.map_elements (floor_id);

create table public.qr_checkpoints (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9]{16,64}$'),
  node_id uuid not null,
  label jsonb not null check (public.is_localized(label)),
  status text not null default 'active' check (status in ('active', 'disabled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (node_id, university_id) references public.navigation_nodes(id, university_id) on delete cascade
);

create table public.lecturers (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  department_id uuid,
  user_id uuid, -- links a lecturer profile to an auth user for self-service updates
  full_name jsonb not null check (public.is_localized(full_name)),
  title jsonb,
  office_room_id uuid,
  office_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(office_hours) = 'array'),
  public_email text check (public_email is null or public_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  photo_url text,
  availability jsonb,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete set null (department_id),
  foreign key (office_room_id, university_id) references public.rooms(id, university_id) on delete set null (office_room_id)
);
create index lecturers_univ_idx on public.lecturers (university_id);
create index lecturers_user_idx on public.lecturers (user_id) where user_id is not null;

-- lecturer_offices: additional offices beyond the primary office_room_id
create table public.lecturer_offices (
  lecturer_id uuid not null,
  room_id uuid not null,
  university_id uuid not null references public.universities(id) on delete cascade,
  primary key (lecturer_id, room_id),
  foreign key (lecturer_id, university_id) references public.lecturers(id, university_id) on delete cascade,
  foreign key (room_id, university_id) references public.rooms(id, university_id) on delete cascade
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  department_id uuid,
  code text not null check (length(code) between 1 and 30),
  name jsonb not null check (public.is_localized(name)),
  description jsonb,
  credits numeric check (credits between 0 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete set null (department_id)
);
create unique index courses_code_uniq on public.courses (university_id, lower(code)) where deleted_at is null;

create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  department_id uuid,
  code text not null check (length(code) between 1 and 30),
  name jsonb not null check (public.is_localized(name)),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  stage integer check (stage between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  foreign key (department_id, university_id) references public.departments(id, university_id) on delete set null (department_id)
);
create unique index student_groups_code_uniq on public.student_groups (university_id, lower(code), academic_year) where deleted_at is null;

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  name jsonb not null check (public.is_localized(name)),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, university_id),
  check (start_date <= end_date)
);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  semester_id uuid,
  course_id uuid not null,
  lecturer_id uuid,
  room_id uuid,
  group_id uuid,
  kind text check (kind in ('lecture', 'lab', 'tutorial', 'exam')),
  recurrence text not null default 'weekly' check (recurrence in ('weekly', 'once')),
  day smallint not null check (day between 0 and 6),
  -- University-local wall-clock times "HH:MM" (interpreted in universities.settings.timezone)
  start_time text not null check (start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time text not null check (end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  valid_from date not null,
  valid_to date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, university_id),
  check (start_time < end_time),
  check (valid_from <= valid_to),
  foreign key (semester_id, university_id) references public.semesters(id, university_id) on delete set null (semester_id),
  foreign key (course_id, university_id) references public.courses(id, university_id) on delete cascade,
  foreign key (lecturer_id, university_id) references public.lecturers(id, university_id) on delete set null (lecturer_id),
  foreign key (room_id, university_id) references public.rooms(id, university_id) on delete set null (room_id),
  foreign key (group_id, university_id) references public.student_groups(id, university_id) on delete set null (group_id)
);
create index timetable_univ_day_idx on public.timetable_entries (university_id, day);
create index timetable_room_idx on public.timetable_entries (room_id, day);
create index timetable_lecturer_idx on public.timetable_entries (lecturer_id, day);
create index timetable_group_idx on public.timetable_entries (group_id, day);

create table public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  entry_id uuid not null,
  date date not null,
  type text not null check (type in ('cancelled', 'room_change', 'time_change', 'lecturer_change')),
  new_room_id uuid,
  new_lecturer_id uuid,
  new_start_time text check (new_start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  new_end_time text check (new_end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  note jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (entry_id, university_id) references public.timetable_entries(id, university_id) on delete cascade,
  foreign key (new_room_id, university_id) references public.rooms(id, university_id) on delete set null (new_room_id),
  foreign key (new_lecturer_id, university_id) references public.lecturers(id, university_id) on delete set null (new_lecturer_id),
  check (type <> 'room_change' or new_room_id is not null),
  check (type <> 'lecturer_change' or new_lecturer_id is not null),
  check (type <> 'time_change' or (new_start_time is not null and new_end_time is not null and new_start_time < new_end_time))
);
create index schedule_changes_entry_idx on public.schedule_changes (entry_id, date);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  title jsonb not null check (public.is_localized(title)),
  body jsonb not null check (public.is_localized(body)),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  priority text not null default 'normal' check (priority in ('normal', 'important')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index announcements_univ_idx on public.announcements (university_id, published_at desc);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['universities','campuses','buildings','floors','departments','navigation_nodes','navigation_edges','rooms',
    'map_elements','qr_checkpoints','lecturers','courses','student_groups','semesters','timetable_entries','schedule_changes','announcements']
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

comment on table public.universities is 'Tenant root. settings.timezone is authoritative for all schedule times.';
comment on column public.timetable_entries.start_time is 'University-local wall clock HH:MM';
comment on column public.qr_checkpoints.token is 'Opaque random token printed in QR codes. Never exposed via public selects; resolved through resolve_checkpoint().';
