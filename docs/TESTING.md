# Testing report

Results below are from actual runs in the development container (Linux, Node 22.23, PostgreSQL 16.15, Playwright 1.63 Chromium) on 2026-11-02.

| Suite | Command | Result |
|---|---|---|
| Core unit tests (routing, instructions, timetable, time zones, conflicts, QR, search, CSV, import, permissions, SVG checks, schemas, assistant) | `pnpm --filter @campusnav/core test` | **50 / 50 passed** |
| Data integration tests (demo dataset validity, student flows on demo data, offline cache, admin sandbox, routing performance guard) | `pnpm --filter @campusnav/data test` | **16 / 16 passed** |
| i18n tests (key completeness, placeholder parity, RTL, Sorani fallback formatting) | `pnpm --filter @campusnav/i18n test` | **5 / 5 passed** |
| Database policy tests on real PostgreSQL (RLS, tenant isolation, role escalation, QR RPC, audit, constraints) | `pnpm test:db` | **31 / 31 passed** |
| End-to-end (Playwright; web on Pixel 7 profile, admin + security on desktop) | `pnpm test:e2e` | **22 / 22 passed** |
| Typecheck (10 packages/apps incl. mobile) | `pnpm typecheck` | **passed** |
| Production builds | `next build` (web, admin) · `expo export --platform android` (mobile) | **passed** |

Total automated tests: **124**, all passing. No test is skipped or disabled.

## Coverage of the required scenarios

### Navigation
| Scenario | Test |
|---|---|
| Same-floor routes | core › finds the shortest same-floor route |
| Multi-floor routes | core › routes across floors via stairs; data › entrance → Room 204 across 3 floors |
| Building-to-building | core › routes between buildings; data › navigates between buildings |
| Unreachable destinations | core › returns unreachable for disconnected destinations |
| Accessible routing | core › accessible routing uses the elevator; e2e › accessible route avoids stairs |
| Blocked corridors | core › avoids blocked corridors and reports unreachable when no alternative |
| Invalid map data | core › rejects invalid map data instead of guessing; map validation tests |
| Restricted edges | core › one-way edges and restrictions; data › never routes through staff-only shortcut |
| Optimality | core › A* finds the optimal path where greedy would fail |
| QR checkpoint resolution | core › payload parsing/evaluation; data › demo resolution; DB › resolve_checkpoint; e2e › QR link, rejected codes |

### Timetable
| Scenario | Test |
|---|---|
| Correct schedule display | core › weekly entries only on their weekday within range; e2e › timetable for group |
| Time-zone handling | core › Baghdad wall clock, midnight rollover, DST round trip |
| Conflict detection | core › room/lecturer/group clashes, once-vs-weekly, edge cases; e2e › editor requires review |
| Room changes / lecturer changes | core › applies room, lecturer, time changes and cancellations for one date |
| Import validation | core › localized days, DD/MM/YYYY, every invalid field, duplicates, conflicts; e2e › CSV preview and import |

### Security
| Scenario | Test |
|---|---|
| Unauthorized admin access | DB › students/lecturers cannot manage campus data; anon cannot write |
| Cross-tenant access | DB › 5 isolation tests (read, write, move, reference, member RPC) |
| Invalid authentication | DB › anon role denied audit/memberships/profiles/tokens |
| Role escalation | DB › 6 tests; e2e › UI offers only lower roles |
| Malicious input | DB › SQL-injection strings to RPC; e2e › API input validation; core › schema id injection, QR payloads |
| Unsafe uploads | core › 8 malicious SVG payloads; e2e › rejected/accepted uploads |
| Database policy enforcement | entire `rls.test.ts`, plus role/permission parity with core |

### User experience (e2e)
Student searches for a room ✓ · navigates to a room ✓ · scans a QR checkpoint ✓ · finds a lecturer ✓ · views a timetable ✓ · switches to Arabic/Sorani with RTL ✓ · uses cached data offline ✓ · first-launch onboarding ✓ — Admin creates a building ✓ · creates a floor ✓ · adds a room ✓ · uploads a map ✓ · creates navigation routes in the map editor ✓ · publishes timetable changes (schedule change + CSV import) ✓ · creates and prints QR checkpoints ✓.

## What is NOT tested (honest gaps)

- **Against a live Supabase project**: the Supabase data sources, Auth sign-in, Storage uploads and the `invite-member` edge function have not been exercised end to end (no project/credentials were available). The SQL they rely on *is* tested on real Postgres with a stand-in `auth` schema.
- **Mobile on devices**: no simulator/emulator or physical device runs; camera scanning, notifications, deep links and gestures are untested at runtime. Only type-checking and bundling are verified.
- **Mobile automated tests**: none yet (Jest/Detox/Maestro planned).
- **Browsers other than Chromium**: Safari/Firefox not run; Safari lacks `BarcodeDetector`, so the jsQR fallback path is used there — untested.
- **Accessibility audit**: built with semantic controls and labels, but no axe/screen-reader audit has been run.
- **Load testing** of Supabase under many concurrent users.
- **Translations**: verified for completeness and placeholder parity, not for linguistic quality.

## Running everything

```bash
pnpm install
pnpm typecheck && pnpm test
TEST_DATABASE_ADMIN_URL=postgresql://postgres@localhost:5432/postgres pnpm test:db
pnpm --filter @campusnav/web build && NEXT_PUBLIC_ALLOW_SANDBOX=true pnpm --filter @campusnav/admin build
pnpm test:e2e
```

CI (`.github/workflows/ci.yml`) runs all of the above, including a Postgres 16 service for the policy tests, a check that `seed.sql` matches the demo dataset, and the mobile bundle export.
