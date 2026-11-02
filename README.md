# CAMPUS NAV

**A NULL-TECH product.** Smart campus navigation: *find my lecture, find my lecturer, and navigate there.*

First deployment target: **SUL NAV — Salahaddin University**. The platform itself is university-independent: every university is a tenant with its own branding, campuses, maps, timetable, languages and administrators.

> **Data honesty.** This repository ships only a clearly labelled, entirely fictional **Demo University** dataset. It contains no official Salahaddin University information. Real data must be entered or imported by authorised university staff (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#importing-verified-university-data)).

## What's in the box

| Part | Path | Stack | Status |
|---|---|---|---|
| Student & visitor web app (PWA) | `apps/web` | Next.js 16, React 19, Tailwind 4 | Built, e2e-tested in demo mode |
| Admin dashboard | `apps/admin` | Next.js 16 | Built, e2e-tested in local-sandbox mode |
| Android + iOS app | `apps/mobile` | Expo SDK 58, React Native 0.88, expo-router | Type-checks and bundles; **not yet run on a physical device** |
| Navigation engine, timetable, QR, search, import, permissions | `packages/core` | TypeScript, zod | 50 unit tests |
| Data access (demo, Supabase, offline cache) | `packages/data` | supabase-js | 16 integration tests |
| Localisation (English, Kurdish Sorani, Arabic) | `packages/i18n` | Intl + fallbacks | 5 tests |
| Design tokens | `packages/tokens` | TS + CSS variables | — |
| Web floor-map component | `packages/map-web` | React + SVG | covered by e2e |
| Database | `supabase/` | PostgreSQL 16, RLS, triggers | 31 policy tests on real Postgres |
| End-to-end tests | `tests/e2e` | Playwright | 21 tests |

See [docs/TESTING.md](docs/TESTING.md) for the actual test results and what is *not* covered.

## Quick start (no credentials needed)

Requirements: Node ≥ 20.11, pnpm 10.

```bash
pnpm install
pnpm dev:web      # student app  → http://localhost:3000  (demo data)
pnpm dev:admin    # admin        → http://localhost:3001  (local sandbox, browser-only)
pnpm dev:mobile   # Expo dev server; open in Expo Go / a dev build
```

Without Supabase environment variables:
- the **web** and **mobile** apps run on the bundled fictional demo dataset;
- the **admin** dashboard runs as a **local sandbox**: data lives in your browser's localStorage, there is no real authentication and nothing is sent anywhere. It exists for evaluation and testing only.

Try it: search “Room 204”, open it, press **Navigate**, pick “main entrance” as the start (or open `http://localhost:3000/q/DEMOengMainEntrance01` to simulate scanning a QR checkpoint), toggle **Accessible route**.

## All commands

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspaces |
| `pnpm dev` | Run web + admin (+ Expo) dev servers in parallel |
| `pnpm dev:web` / `dev:admin` / `dev:mobile` | Run one app |
| `pnpm build` | Production build of every buildable package |
| `pnpm typecheck` | TypeScript across all 10 packages/apps |
| `pnpm test` | Unit + integration tests (core, data, i18n) |
| `pnpm test:db` | RLS/tenant-isolation tests — needs a Postgres ≥ 15 (`TEST_DATABASE_ADMIN_URL`) |
| `pnpm test:e2e` | Playwright e2e — build web and admin first |
| `pnpm db:seed:generate` | Regenerate `supabase/seed.sql` from the demo dataset |
| `pnpm perf:web` | Measure web load times under throttled mobile networks (server must be running) |
| `pnpm icons` | Regenerate PWA + app icons and splash |
| `pnpm --filter @campusnav/mobile export:check` | Verify the native JS bundle builds |

## Connecting a real backend

1. Create a Supabase project, apply `supabase/migrations/*` (`supabase db push`), optionally load `supabase/seed.sql` into a **non-production** project.
2. Copy `apps/*/.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and `EXPO_PUBLIC_…` for mobile). **Only the anon key ever goes to clients.**
3. Make the first platform owner (SQL editor): `update public.user_profiles set is_platform_owner = true where email = 'you@…';`
4. Create the university with `select public.create_university('sul', '{"en":"…"}', 'SUL', 'owner@…', 'Asia/Baghdad');` — no code changes.

Full instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Mobile builds: [docs/MOBILE.md](docs/MOBILE.md)

## Documentation

- [Architecture, API design, navigation algorithm](docs/ARCHITECTURE.md)
- [Database schema, roles & RLS](docs/DATABASE.md)
- [Security review & checklist](docs/SECURITY.md)
- [Design system](docs/DESIGN.md)
- [Deployment, environment variables, backups, launch checklist](docs/DEPLOYMENT.md)
- [Mobile build instructions](docs/MOBILE.md)
- [Testing report](docs/TESTING.md) · [Performance report](docs/PERFORMANCE.md)
- [Known limitations & roadmap](docs/ROADMAP.md)
- [Development progress log](docs/PROGRESS.md)

## Repository layout

```
apps/
  web/        Next.js student & visitor PWA
  admin/      Next.js administrative dashboard (separate app, noindex)
  mobile/     Expo React Native app (Android + iOS)
packages/
  core/       Domain model, A* routing, instructions, timetable, QR, search, CSV import, permissions, AI-assistant boundary
  data/       Data sources (demo / Supabase / admin sandbox), offline cache, demo dataset, seed generator
  i18n/       en / ckb / ar messages, RTL, locale-safe formatting
  tokens/     Design tokens (TS + CSS)
  map-web/    Interactive SVG floor map for React DOM
supabase/
  migrations/ Schema, auth & access functions, RLS policies, audit & storage
  functions/  invite-member edge function
  seed.sql    Generated demo seed
  tests/      Database policy tests (run against real Postgres)
tests/e2e/    Playwright end-to-end tests
scripts/      Icon generation, performance measurement
docs/         Documentation
```

© NULL-TECH. All demo content is fictional.
