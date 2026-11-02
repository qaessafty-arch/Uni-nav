# Database

PostgreSQL 16 on Supabase. Migrations in `supabase/migrations/` (apply in filename order):

| File | Contents |
|---|---|
| `…0100_core_schema.sql` | Tenant tables, constraints, indexes, `updated_at` triggers |
| `…0200_auth_and_access.sql` | `user_profiles`, `roles`, `permissions`, `role_permissions`, `memberships`, authorization functions, personal tables |
| `…0300_rls_policies.sql` | RLS on every table, public checkpoint view, `resolve_checkpoint`, member RPCs, `create_university`, grants |
| `…0400_audit_and_storage.sql` | `audit_logs`, audit trigger on admin tables, `floor-plans` storage bucket + policies |

`supabase/seed.sql` is **generated** from `packages/data/src/demo/dataset.ts` (`pnpm db:seed:generate`); CI fails if it drifts. It contains only fictional demo data.

## Tables

Tenant data (all with `university_id`, UUID keys, `created_at`/`updated_at`; soft delete via `deleted_at` where marked †):

| Table | Notes |
|---|---|
| `universities` | `slug`, localized `name`, `data_status` (verified/demo/unverified), `published`, `branding`, `settings` (timezone, weekendDays, locales, timetableVisibility, walking assumptions) † |
| `campuses` † | Overview canvas size |
| `buildings` † | `code` unique per university (case-insensitive), campus footprint |
| `floors` † | `level` unique per building, canvas `width/height`, `meters_per_unit`, `plan_asset_url` |
| `rooms` † | `code` unique per building, `type`, department, capacity, `entrance_node_id`, `accessible`, `data_status` |
| `map_assets` | Uploaded SVG metadata (`image/svg+xml`, ≤ 2 MB) |
| `map_elements` | Shapes (`rect` / `polygon` JSON) linked to floors and optionally rooms |
| `navigation_nodes` | Floor coordinates, kind, label, `vertical_group` |
| `navigation_edges` | kind, `distance_m`, accessible, bidirectional, blocked, restriction; no self loops |
| `qr_checkpoints` † | Unique random `token` (format-checked), node, label, status, expiry |
| `departments` †, `lecturers` †, `lecturer_offices`, `courses` †, `student_groups` †, `semesters` | Academic structure; lecturer `user_id` enables self-service |
| `timetable_entries` † | weekly/once, `day`, `HH:MM` local times (checked), date range, status |
| `schedule_changes` | Per-occurrence cancel/room/time/lecturer change, with type-specific checks |
| `announcements` † | Localized title/body, publish/expiry, priority |

Users & access: `user_profiles` (1:1 with `auth.users`, `is_platform_owner`), `memberships` (user × university → role, department for department admins), `roles`, `permissions`, `role_permissions`, `audit_logs`.

Personal: `user_preferences`, `saved_locations`, `notifications`, `push_tokens` — readable/writable only by their owner.

Localized text is JSONB `{ "en": "...", "ckb": "...", "ar": "..." }` with English required (`is_localized()` check).

### Integrity

- **Composite tenant foreign keys** on every parent/child relation, e.g. `rooms(floor_id, university_id) → floors(id, university_id)`. A row cannot reference another tenant's data even with a service-role bug. Nullable references use `ON DELETE SET NULL (column)` so `university_id` is never nulled.
- Check constraints for time formats, date ranges, capacity, scale, email shape, token format, enum-like text columns.
- Partial unique indexes ignore soft-deleted rows.
- Indexes on all foreign keys used for lookups (`floor_id`, `from_node_id`, `to_node_id`, `(university_id, day)`, etc.).

Spatial extensions (PostGIS) are intentionally **not** used: floor-local coordinates plus a graph are sufficient for indoor routing; PostGIS becomes justified only for outdoor geo-referencing (roadmap).

## Roles and permissions

| Role | Rank | Scope |
|---|---|---|
| `platform_owner` | 100 | All universities (flag on `user_profiles`, never granted via memberships) |
| `university_owner` | 80 | One university, including settings and owners |
| `university_admin` | 60 | All university data, invites below own rank |
| `department_admin` | 40 | Rooms, lecturers, courses, groups, timetable **of their department** |
| `lecturer` | 20 | Own office hours / availability |
| `student` | 10 | Personal features |
| `visitor` | 0 | Public data |

The matrix lives in `role_permissions` and in `packages/core/src/auth/permissions.ts`; a DB test asserts they are identical. See `apps/admin → Roles & permissions` for the rendered matrix.

## Authorization functions (used by RLS)

All `SECURITY DEFINER`, `STABLE`, `search_path` pinned, read-only:

- `is_platform_owner()`, `is_member(u)`, `role_rank_in(u)`, `has_permission(u, perm)`
- `can_write(u, perm, department?)` — university-wide permission, or department admin acting within their department
- `is_university_public(u)`, `can_read_university(u)` (published or member), `can_read_timetable(u)` (members, or public if the tenant allows)
- `can_assign_role(u, role)` — never platform_owner; owners only by owners; otherwise strictly below own rank

## RLS summary

| Data | Read | Write |
|---|---|---|
| Campus structure, maps, academic data, announcements | Published tenant (non-deleted) or members; writers also see deleted | `can_write` with the matching permission (department-scoped where applicable) |
| Timetable, schedule changes | `can_read_timetable` | `timetable.manage`, or `timetable.department_manage` for the course's department |
| QR checkpoints (tokens) | `checkpoint.manage` only | same |
| `public_checkpoints` view | Active, unexpired, readable tenant; **no token column** | — |
| Universities | Published or member | `university.update`; settings/publication/slug/data status additionally need `university.settings` (trigger) |
| Profiles | Self (platform owner: all); cannot set `is_platform_owner` (trigger) | Self |
| Memberships | Self, or `member.invite` in that tenant | Only via `admin_set_member_role`; delete only roles you could assign, never yourself |
| Audit logs | `audit.read` in that tenant | Nobody (trigger only; no grants) |
| Personal tables | Owner | Owner |

Lecturer self-service: a lecturer linked by `lecturers.user_id` may update their own row, but a trigger rejects changes to anything except `office_hours` and `availability`.

## Audit log

`audit_trigger()` (security definer) writes actor (`auth.uid()`), action, table, record id and a diff (changed columns for updates) for all admin-managed tables and memberships. Checkpoint tokens are redacted.

## Running the policy tests locally

```bash
# any Postgres ≥ 15 you can create databases in
export TEST_DATABASE_ADMIN_URL=postgresql://postgres@localhost:5432/postgres
pnpm test:db
```

The harness creates a fresh database, installs a minimal stand-in for Supabase's `auth` schema and `anon`/`authenticated` roles (`supabase/tests/sql/00_supabase_stub.sql`), applies all migrations and the seed, then executes SQL as those roles with JWT claims — the same mechanism PostgREST uses.
