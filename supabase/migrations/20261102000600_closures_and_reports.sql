-- Temporary closures (routes avoid them) and user problem reports.

-- ─── Closures ──────────────────────────────────────────────────────────────
create table public.closures (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  target_type text not null check (target_type in ('edge', 'node', 'room')),
  target_id uuid not null,
  reason jsonb not null check (public.is_localized(reason)),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index closures_univ_idx on public.closures (university_id, starts_at);

-- The target must exist in the same university (polymorphic reference, checked by trigger).
create or replace function public.check_closure_target() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare ok boolean;
begin
  if new.target_type = 'edge' then
    select exists (select 1 from public.navigation_edges where id = new.target_id and university_id = new.university_id) into ok;
  elsif new.target_type = 'node' then
    select exists (select 1 from public.navigation_nodes where id = new.target_id and university_id = new.university_id) into ok;
  else
    select exists (select 1 from public.rooms where id = new.target_id and university_id = new.university_id) into ok;
  end if;
  if not ok then
    raise exception 'closure target not found in this university' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger closures_target_check before insert or update on public.closures for each row execute function public.check_closure_target();
create trigger closures_updated_at before update on public.closures for each row execute function public.set_updated_at();

alter table public.closures enable row level security;
alter table public.closures force row level security;
create policy closures_select on public.closures for select
  using (public.can_read_university(university_id) or public.can_write(university_id, 'map.edit'));
create policy closures_insert on public.closures for insert with check (public.can_write(university_id, 'map.edit'));
create policy closures_update on public.closures for update
  using (public.can_write(university_id, 'map.edit')) with check (public.can_write(university_id, 'map.edit'));
create policy closures_delete on public.closures for delete using (public.can_write(university_id, 'map.edit'));
grant select on public.closures to anon, authenticated;
grant insert, update, delete on public.closures to authenticated;
create trigger closures_audit after insert or update or delete on public.closures for each row execute function public.audit_trigger();

-- ─── Problem reports ───────────────────────────────────────────────────────
insert into public.permissions (code, description) values ('report.manage', 'Review user problem reports')
  on conflict (code) do nothing;
insert into public.role_permissions (role, permission) values
  ('platform_owner', 'report.manage'), ('university_owner', 'report.manage'),
  ('university_admin', 'report.manage'), ('department_admin', 'report.manage')
  on conflict do nothing;

create table public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  category text not null check (category in ('wrong_location', 'blocked_path', 'wrong_directions', 'wrong_info', 'accessibility', 'other')),
  message text not null check (char_length(btrim(message)) between 5 and 1000),
  room_id uuid,
  node_id uuid,
  route_from_node_id uuid,
  route_to_node_id uuid,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  -- No personal data: reporter identity is deliberately not stored.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (room_id, university_id) references public.rooms(id, university_id) on delete set null (room_id),
  foreign key (node_id, university_id) references public.navigation_nodes(id, university_id) on delete set null (node_id),
  foreign key (route_from_node_id, university_id) references public.navigation_nodes(id, university_id) on delete set null (route_from_node_id),
  foreign key (route_to_node_id, university_id) references public.navigation_nodes(id, university_id) on delete set null (route_to_node_id)
);
create index problem_reports_univ_idx on public.problem_reports (university_id, status, created_at desc);
create trigger problem_reports_updated_at before update on public.problem_reports for each row execute function public.set_updated_at();

alter table public.problem_reports enable row level security;
alter table public.problem_reports force row level security;
-- Only staff with report.manage can read or triage. Nobody inserts directly: use submit_problem_report().
create policy problem_reports_select on public.problem_reports for select using (public.has_permission(university_id, 'report.manage'));
create policy problem_reports_update on public.problem_reports for update
  using (public.has_permission(university_id, 'report.manage')) with check (public.has_permission(university_id, 'report.manage'));
create policy problem_reports_delete on public.problem_reports for delete using (public.has_permission(university_id, 'report.manage'));
grant select, update, delete on public.problem_reports to authenticated;

-- Staff may only change status/admin_note, never the reported content.
create or replace function public.guard_problem_report_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;
  if (to_jsonb(new) - array['status','admin_note','updated_at']) is distinct from (to_jsonb(old) - array['status','admin_note','updated_at']) then
    raise exception 'only status and admin note can be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger problem_reports_guard before update on public.problem_reports for each row execute function public.guard_problem_report_update();
create trigger problem_reports_audit after insert or update or delete on public.problem_reports for each row execute function public.audit_trigger();

-- Anyone (including anonymous visitors) can submit a report for a university they can read.
-- Light abuse control: at most 30 open reports per university per 10 minutes.
create or replace function public.submit_problem_report(
  p_university uuid, p_category text, p_message text,
  p_room uuid default null, p_node uuid default null, p_from uuid default null, p_to uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public.can_read_university(p_university) then
    raise exception 'university not found' using errcode = '42501';
  end if;
  if (select count(*) from public.problem_reports
      where university_id = p_university and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'too many reports, try again later' using errcode = '54000';
  end if;
  insert into public.problem_reports (university_id, category, message, room_id, node_id, route_from_node_id, route_to_node_id)
  values (p_university, p_category, btrim(p_message), p_room, p_node, p_from, p_to)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.submit_problem_report(uuid, text, text, uuid, uuid, uuid, uuid) from public;
grant execute on function public.submit_problem_report(uuid, text, text, uuid, uuid, uuid, uuid) to anon, authenticated;
