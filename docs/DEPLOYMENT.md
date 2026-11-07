# Deployment

> Nothing in this repository has been deployed. These are the steps to do so.

## Components

| Component | Where | Notes |
|---|---|---|
| Database, auth, storage, edge functions | Supabase | Migrations in `supabase/migrations` |
| Student web app (`apps/web`) | Vercel (or any Node 20+ host) | Next.js; `/api/checkpoint` route needs a server runtime |
| Admin dashboard (`apps/admin`) | Vercel, separate project + domain | Keep on a separate subdomain, e.g. `admin.nav.example.edu` |
| Mobile apps | Expo EAS → Play Store / App Store | See [MOBILE.md](MOBILE.md) |

## Environment variables

| Variable | App | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web, admin | for real data | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web, admin | for real data | **Anon** key. Never the service-role key. |
| `NEXT_PUBLIC_SITE_URL` | web | recommended | Public base URL of the student app |
| `NEXT_PUBLIC_STUDENT_APP_URL` | admin | yes | Base URL encoded in printed QR codes (`<url>/q/<token>`) — must be the production student domain before printing signs |
| `NEXT_PUBLIC_ALLOW_SANDBOX` | admin | no | `true` only for demo/test builds; never in production |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | for real data | Same values as web |
| `EXPO_PUBLIC_SITE_URL` | mobile | recommended | Student web URL |
| `CAMPUSNAV_LINK_HOST` | mobile (build) | optional | Domain for Android App Links / iOS Universal Links |
| `EAS_PROJECT_ID` | mobile (build) | for push | From `eas init` |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `INVITE_REDIRECT_URL`, `ADMIN_ORIGIN` | edge function secrets | for invites | Set with `supabase secrets set`; never in any app env |
| `TEST_DATABASE_ADMIN_URL` | CI | for `test:db` | Postgres URL with createdb rights |

Templates: `apps/web/.env.example`, `apps/admin/.env.example`, `apps/mobile/.env.example`.

## 1. Database (Supabase)

```bash
npm i -g supabase            # or use npx supabase
supabase login
supabase link --project-ref <ref>
supabase db push             # applies supabase/migrations/*
```

- Do **not** run `seed.sql` in production. For a demo/staging project: `psql "$DB_URL" -f supabase/seed.sql`.
- Auth settings (dashboard): enable email confirmations, set site URL to the admin domain, add both domains to redirect URLs, enable leaked-password protection.
- Storage: the migration creates the `floor-plans` bucket (SVG only, 2 MB). See SECURITY.md about its public-read nature.

Local development alternative: `supabase start` uses `supabase/config.toml` and loads the demo seed automatically.

## 2. First platform owner and university onboarding

1. Sign up the NULL-TECH operator account (Supabase Auth → Users → Invite, or the sign-in page with sign-ups enabled).
2. In the SQL editor:
   ```sql
   update public.user_profiles set is_platform_owner = true where email = 'operator@null-tech.example';
   ```
3. Create the university (no code changes):
   ```sql
   select public.create_university('sue', '{"en":"Salahaddin University","ckb":"…","ar":"…"}', 'SUE', 'owner@university.example', 'Asia/Baghdad');
   ```
   The owner must have an account first (or invite them with the `invite-member` function and re-run the assignment from Admin → Users).
4. The owner signs into the admin dashboard, sets **University** (branding: product name "SUE NAV", logo with permission) and **Settings** (time zone, weekend days, languages, timetable visibility, walking assumptions), then invites administrators from **Users**.
5. Keep the university **unpublished** until data is verified; publish from Settings.

## Importing verified university data

Only import information the university has confirmed. Mark records `verified` only when confirmed; otherwise leave `unverified`.

1. **Structure**: Campuses → Buildings → Floors (calibrate `metres per unit` by measuring a known corridor on the official plan).
2. **Maps**: Map editor → upload the official SVG plan per floor → draw rooms/corridors (or trace over the plan) → add navigation nodes and connections → link stairs/elevators across floors with **measured** lengths → assign room entrances → **Validate** until no errors.
3. **Academic data**: Departments, Lecturers (public fields only), Courses, Student groups, Semesters.
4. **Timetable**: Timetable → download template → fill from the registrar's export (Excel: *Save As → CSV UTF-8*) → upload → fix every reported row → review conflicts → confirm.
5. **QR checkpoints**: create at entrances, stairs, elevators and junctions → print the sheet (after `NEXT_PUBLIC_STUDENT_APP_URL` points to production) → install signs → test each with a phone.
6. Bulk moves between environments: Import/export → JSON bundle.

## 3. Web and admin on Vercel

For each app create a Vercel project with:

- Root directory: `apps/web` (or `apps/admin`)
- Install command: `pnpm install --frozen-lockfile` (Vercel detects the pnpm workspace)
- Build command: `pnpm build`
- Environment variables from the table above

Custom domains: e.g. `nav.example.edu` (web) and `admin.nav.example.edu` (admin). Headers (CSP, frame denial, permissions policy) are defined in each app's `next.config.ts`.

If the student and admin apps are deployed on different domains (recommended), the local-sandbox overlay feature is irrelevant — both read from Supabase.

## 4. Backups and recovery

- Enable Supabase **Point-in-Time Recovery** (paid tiers) or at minimum daily backups.
- Weekly logical backup to separate storage: `pg_dump --no-owner --format=custom "$DB_URL" > campusnav-$(date +%F).dump` (automate via a scheduled CI job with the connection string in secrets).
- Per-university export from Admin → Import/export (JSON) before major data changes.
- Floor-plan SVGs: keep the university's originals; the bucket can be re-populated from them.
- Test a restore into a staging project at least once per semester.

## 5. Production launch checklist

- [ ] All items in [SECURITY.md › checklist](SECURITY.md#security-checklist-production)
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:e2e` green on the release commit
- [ ] Staging environment with production-like data reviewed by university staff
- [ ] University data verified and marked `verified`; demo data absent from production
- [ ] Every room intended for students has an entrance and passes map validation
- [ ] Floor scales calibrated; vertical connections measured
- [ ] QR signs installed and each scanned on Android and iPhone
- [ ] Translations reviewed by native Sorani and Arabic speakers
- [ ] Time zone and weekend settings confirmed by the registrar
- [ ] Performance check on a low-end Android phone on campus Wi-Fi (`pnpm perf:web` as a lab baseline)
- [ ] Support contact and data-correction process published
- [ ] Monitoring: Supabase logs/alerts, Vercel error tracking enabled
- [ ] Mobile apps tested on physical devices, store listings and privacy labels complete
