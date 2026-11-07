# UNIVERSITY NAVIGATION — REQUIREMENTS & READINESS AUDIT

**Project:** NULL-TECH CAMPUS NAV (first intended deployment: "SUE NAV", Salahaddin University – Erbil)
**Repository:** `qaessafty-arch/Uni-nav`, branch `ccr-c29fe201-j9n0yn`, commit `f7561bd`
**Audit date:** 2026-11-02
**Method:** read the source, schema, tests, CI workflow and docs; ran the demo navigation engine in a throw-away probe (deleted afterwards). **No source code was changed.**

### How to read the status labels

| Label | Meaning |
|---|---|
| **Verified** | Code exists *and* an automated test or a run in this audit exercised it |
| **Implemented, unverified** | Code exists, type-checks and builds, but was never run in the environment that matters (real device, live Supabase, real campus) |
| **Partial** | Some of the capability exists; important parts are missing |
| **Simulated / demo** | Works only on fictional demo data or in the local admin sandbox |
| **Missing** | No code for it |
| **Unknown** | Can't be decided from the code; needs information from you or the university |

---

## 1. Executive summary

CAMPUS NAV is a well-structured, well-tested **software foundation** for indoor campus navigation. It has a graph-based A* router, QR-checkpoint positioning, a trilingual (English / Sorani / Arabic, with RTL) student web app and Expo mobile app, an admin dashboard, and a multi-tenant Supabase/Postgres backend with row-level security. 124+ automated tests pass in the development container. CI passed on the one run recorded for this branch (an earlier commit).

It is **not yet a real university navigation system**:

1. **It holds no real campus data.** All buildings, rooms, routes, lecturers and timetables are labelled fictional demo data: 2 buildings, 5 floors, 52 rooms, 106 nav nodes, 109 edges and 6 checkpoints. Nothing about Salahaddin University has been entered or verified.
2. **It has no geographic layer.** No latitude/longitude, no coordinate reference system, no map tiles and no outdoor path network. Each floor is its own local drawing canvas. The campus overview is an uploaded picture with rectangles on it. Between buildings, the router knows only a single hand-typed distance per connection (85 m in the demo).
3. **It can't tell where the user is.** The position comes only from scanning a QR sign or choosing a start point from a list. GPS is deliberately disabled. There is no live tracking, no automatic step progress, no off-route detection and no automatic rerouting. The user taps "Next" through the steps.
4. **It has never run against live services.** The Supabase backend (auth, storage, PostgREST from the apps), the invite edge function and the mobile app on a real phone are all unexecuted. The public Vercel deployments run in demo/sandbox mode.
5. **Routing accuracy is unproven.** It depends entirely on data quality: per-floor scale calibration, measured stair and elevator lengths, and correct doors and corridors. No field test has been done. **No accuracy claim can be made today.**

**Bottom line:** the architecture suits a university pilot. The blockers are **data, positioning and real-world validation**, not code volume. The next step is a scoped pilot (one building, then the campus) with authorised university data. Visual or AI features should wait.

---

## 2. Existing project overview

| Area | What exists (evidence) |
|---|---|
| Monorepo | pnpm 10 + Turborepo (`package.json`, `turbo.json`, `pnpm-workspace.yaml`) |
| Student web app (PWA) | `apps/web` — Next.js 16, 26 route files: home, search, map, buildings, floors, rooms, navigate, scan, timetable, lecturers, courses, assistant, notifications, settings, onboarding, offline, `/q/[token]`, `/api/checkpoint/[token]` |
| Admin dashboard | `apps/admin` — Next.js 16, 25 route files: campuses, campus-map, buildings, floors, rooms, map-editor, checkpoints (+ print), timetable, schedule changes, departments, lecturers, courses, groups, semesters, announcements, users, roles, audit, import/export, university settings |
| Mobile app | `apps/mobile` — Expo SDK 58 / React Native 0.88, expo-router, 16 route files |
| Shared logic | `packages/core` (model, zod schemas, navigation, map validation, search, timetable, QR, assistant, permissions, CSV import), `packages/data` (demo / Supabase / sandbox data sources, cache), `packages/i18n`, `packages/tokens`, `packages/map-web` |
| Backend | `supabase/` — 5 SQL migrations, seed (demo only), `invite-member` edge function, `config.toml` |
| Tests | Unit/integration (`packages/*/test`), DB/RLS (`supabase/tests`), Playwright e2e (`tests/e2e`) |
| Docs | `docs/` ARCHITECTURE, DATABASE, DEPLOYMENT, DESIGN, MOBILE, PERFORMANCE, PROGRESS, ROADMAP, SECURITY, TESTING |
| CI | `.github/workflows/ci.yml`: typecheck, unit tests, seed drift check, DB tests on Postgres 16, web/admin build, e2e, Expo Android bundle export |

---

## 3. Verified technology stack

| Layer | Technology | Evidence | Status |
|---|---|---|---|
| Language | TypeScript 5.9.3 | root `package.json` | Verified (typecheck green) |
| Web | Next.js 16.4.3, React 19.3, Tailwind 4 | `apps/web/package.json` | Verified (build + e2e) |
| Mobile | Expo SDK 58, RN 0.88.1, expo-router, AsyncStorage, expo-camera | `apps/mobile` | Implemented, unverified (bundles; never run on a device) |
| Validation | zod 4 | `packages/core/src/model/schemas.ts` | Verified |
| Database | PostgreSQL 16 via Supabase; RLS, security-definer functions, audit triggers, storage buckets | `supabase/migrations/*` | SQL layer verified on plain Postgres (32 tests); **live Supabase unverified** |
| Auth | Supabase Auth (email), staff roles in DB | migrations `…200_auth_and_access.sql` | Unverified against a live project |
| Maps | Hand-rolled SVG (`packages/map-web`, `apps/mobile/src/FloorMap.tsx`) | — | Verified in e2e (demo) |
| Map provider / GIS | **None** (no Mapbox, Google, Leaflet, MapLibre, OSM, PostGIS) | grep for `lat`, `lng`, `geolocation`, `PostGIS` found nothing | Missing |
| Positioning | QR checkpoints + manual start picker | `core/src/qr`, `apps/web/app/navigate` | Verified (demo) |
| Offline | Service worker (`apps/web/public/sw.js`), bundle cache in localStorage / AsyncStorage | `packages/data/src/cache.ts` | Web verified in e2e; mobile unverified |
| Hosting | Vercel (2 projects), demo/sandbox mode, Vercel SSO-protected | Vercel deployments | Deployed as a **preview/demo**, not production |
| Testing | vitest 4, Playwright 1.63 | — | Verified |
| Third-party services in use | Vercel, (Supabase planned), GitHub Actions | — | No analytics, no map APIs, no AI APIs |

---

## 4. Current system architecture

```
            ┌────────────────────────────── Clients ──────────────────────────────┐
            │  Student web PWA (Next.js)     Mobile (Expo)      Admin (Next.js)   │
            │        │                          │                   │             │
            │   @campusnav/core: A* routing, instructions, search, timetable,     │
            │   QR parsing, map validation, rule-based assistant (all ON DEVICE)  │
            │        │                          │                   │             │
            │   @campusnav/data: DataSource = Demo | Supabase | Sandbox(admin)    │
            └────────┼──────────────────────────┼───────────────────┼─────────────┘
                     │ one "CampusBundle" per university (whole campus, JSON)
                     ▼
            Supabase (PostgREST + RLS)  ── storage: floor-plans, campus-images (public read)
            rpc: resolve_checkpoint, admin_* ; edge fn: invite-member
            /api/checkpoint/:token (web, rate-limited proxy, 30 req/min/IP in memory)
```

Key design facts:

- **Offline-first "bundle" model.** The client downloads all the data for one university in one request (`CampusBundle` in `core/src/model/types.ts`), caches it, and does routing and search locally. This is good for weak campus networks. It doesn't scale indefinitely, because the bundle grows linearly with rooms and nodes and is stored in `localStorage` (about 5 MB browser limit).
- **Coordinate model.** Every node and shape has `x, y` in **floor-local map units**. `Floor.metersPerUnit` converts them to metres. There is no shared building frame, campus frame or geographic frame.
- **Multi-tenant isolation.** Composite foreign keys `(id, university_id)` plus RLS functions (`can_read_university`, `can_write`, `has_permission`). This is tested.

---

## 5. Implemented features and their status

| Feature | Status | Notes / evidence |
|---|---|---|
| University / campus / building / floor / room hierarchy | Verified (demo) | CRUD in admin sandbox; e2e |
| Indoor floor maps (SVG, zoom/pan/pinch/keyboard) | Verified (demo) | Rectangles/polygons drawn in admin; uploaded SVG plans are sanitised (e2e rejects `<script>`) |
| Map editor (draw areas, nodes, edges; validate; save) | Verified (sandbox) | Draws **rectangles only**; polygons render but can't be drawn (`docs/ROADMAP.md`) |
| Map/graph validation (`validateMap`) | Verified | 19 issue codes; demo data → 0 issues (probe) |
| Campus overview: uploaded picture + building footprints | Verified (sandbox) | **Not geo-referenced**; picture stretched to canvas (`preserveAspectRatio="none"`) |
| A* routing, accessible-only mode, restricted edges, blocked edges | Verified (unit tests, demo) | See §6 |
| Turn-by-turn text instructions (3 languages) | Verified (unit + e2e) | Derived from node geometry |
| Walking-time estimate | Verified (unit) | Labelled "Estimate"; speeds are configurable assumptions (demo 1.2 m/s; 20 s/floor stairs, 45 s/floor elevator) |
| QR checkpoint positioning | Verified (demo + e2e) | Opaque random token; server resolution; rate-limited |
| Manual start selection | Verified | Drop-down of entrances, checkpoints, stairs, elevators, room doors |
| "Tap on map: I am here" | **Partial** | `nearestNode()` exists in core but no app calls it |
| GPS / outdoor blue dot | **Missing (deliberately disabled)** | `Permissions-Policy: geolocation=()` in both web apps; mobile blocks location |
| Live position tracking, off-route detection, auto reroute | **Missing** | Steps advance by tapping; "Recalculate" is manual |
| Outdoor routing between buildings | **Partial / simulated** | One `outdoor` edge per connection with a typed distance; no path geometry; no outdoor map drawing |
| Search (rooms, lecturers, buildings, departments, courses; 3 languages) | Verified (demo) | Token AND matching, exact > prefix > substring; Arabic/Sorani normalisation |
| Timetable, schedule changes, conflicts, CSV import | Verified (demo) | `.xlsx` not supported |
| Lecturer directory / office navigation | Verified (demo) | Availability only shown if set by an authorised source |
| Rule-based assistant (3 languages, answers only from bundle) | Verified (unit) | No LLM; cannot invent places |
| Offline mode | Web verified; mobile unverified | Last bundle + cached pages; offline page |
| Local reminders | Web: only while tab open; mobile unverified | |
| Push notifications for schedule changes | **Partial** | Token table exists; **sender not implemented** |
| Student sign-in / sync | **Missing (schema only)** | Tables exist; no UI |
| Admin roles, invite, audit log | SQL verified; live unverified | `invite-member` edge function never executed |
| Emergency / evacuation guidance | **Missing** | Emergency exits are only drawn on the map; no evacuation routing or alerts |
| Report-a-problem (wrong room / blocked route) | **Missing** | No user feedback channel found |
| Admin UI localisation | **Missing** | Admin text is English-only (data entry is trilingual) |

---

## 6. Navigation system analysis

**Algorithm** (`packages/core/src/navigation/pathfinding.ts`): A* with a binary heap and lazy deletion. The heuristic is the straight-line distance when the node shares the goal's floor, and 0 otherwise (Dijkstra-like). Options: `accessibleOnly`, `avoidEdgeIds`, `avoidEdgeKinds`, `allowedRestrictions`, `kindPenaltyM`. Measured speed in a lab: 0.10 ms on the demo; 28.9 ms on a synthetic 14,400-node graph (`docs/PERFORMANCE.md`). **Speed is not a concern.**

**Edge lengths** (`graph.ts`): same-floor edges use `distanceM` if given, otherwise Euclidean distance × `floor.metersPerUnit`. Cross-floor edges without a `distanceM` are **rejected rather than guessed**. That is a good safety property.

**Findings**

| # | Finding | Evidence | Impact |
|---|---|---|---|
| N1 | Routes are chosen by **distance only**. The per-floor time costs (stairs 20 s, elevator 45 s) feed the time estimate but not the route choice. `kindPenaltyM` exists but **no app passes it**. | grep: `kindPenaltyM` used only in core and tests | Routes can be "shortest" but not "fastest", e.g. a long elevator wait vs. one flight of stairs. Depends on real data. |
| N2 | Demo elevator edges have `distanceM: 0`. In the probe the router still picked stairs, because the elevator is far from the entrance (route 75.5 m, est. 83 s). | `dataset.ts` L313–314; probe | With real data, zero-length vertical edges can bias choices. Needs a policy for vertical-edge cost. |
| N3 | The A* "optimal" claim in `ARCHITECTURE.md` rests on an **unenforced assumption**: a route that leaves a floor and comes back is never shorter than the straight line on that floor. If floors of one building are drawn in different frames or scales, or vertical edges are under-measured, routes may be sub-optimal (never invalid). | heuristic in `pathfinding.ts` | Low severity. Add a validation rule: floors of one building share the same frame and scale. |
| N4 | **Scale calibration is the single biggest accuracy factor.** New floors default to `metersPerUnit: 0.05` (`apps/admin/lib/entities.tsx:106`). An admin who forgets to calibrate gets plausible-looking but wrong distances, and nothing in the validator flags this. | `entities.tsx` | High for accuracy. Add an "uncalibrated" state and a two-point calibration tool. |
| N5 | Outdoor routing is a **single edge between two building entrances** with a typed distance. There is no outdoor network: paths, gates, crossings, slopes, covered walkways. | `dataset.ts` L320 | Campus-scale routing is not really modelled yet. |
| N6 | Position = **QR scan or manual pick**. There is no GPS, no "tap where you are" and no tracking. Progress through steps is manual. | `navigate/page.tsx`, Permissions-Policy | Works indoors without infrastructure, but the user experience depends on sign density. Outdoors it's weak. |
| N7 | No live rerouting. "Recalculate" re-runs the route from the **same start**; the user must rescan to change the start. | `navigate/page.tsx` | Expected for QR-based positioning; must be explained in the UI. |
| N8 | Restricted edges are always avoided in student apps (no `allowedRestrictions` passed). Staff have no way to use staff-only routes. | grep | Fine for students; a staff/role-aware mode is missing. |
| N9 | Blocked edges are a static database flag (`blocked`). There are no temporary closures with start/end times and no reason shown to users. | schema `core_schema.sql` L140 | Construction and exam closures can't be scheduled. |
| N10 | Accessibility: `accessibleOnly` uses a boolean per edge. There's no distinction between ramp gradient, door width, step-free with assistance, elevator out of service. | `types.ts` | Accessibility depends on survey quality; the model is coarse. |
| N11 | No emergency/evacuation mode. | grep | Emergency exits are visual only. Evacuation guidance has liability implications and needs university approval. |

**What can be said today:** the router is correct on the test graphs (16 navigation unit tests, e2e flows). **Nothing can be said about real-world route accuracy**, because no real campus has been mapped or walked.

---

## 7. Map and location data analysis

| Question | Answer from code | Status |
|---|---|---|
| Real university data present? | No. Every record is `dataStatus: "demo"` and labelled in the UI. | Missing |
| Coordinate reference system | None. Floor-local units only; `metersPerUnit` per floor. | Missing |
| Building geolocation / campus boundary | None. Building footprint = rectangle on a picture canvas. | Missing |
| Entrances / exits | `building_entrance` nodes; `emergency_exit` map elements (visual) | Model exists, no real data |
| Floors and room numbering | `Floor.level` (0 = ground, negative = basement), `Room.code` unique per building (validated) | Model exists; real numbering scheme unknown |
| Stairs / elevators | Nodes + `verticalGroup`; vertical edges need a measured `distanceM` | Model exists |
| Restricted areas | Free-text `restriction` label per edge | Partial (no time windows, no area polygons) |
| Map formats accepted | SVG floor plan upload (sanitised); campus picture PNG/JPEG/WebP | No DWG/DXF/IFC/GeoJSON/IMDF import |
| Data quality controls | `validateMap` (19 checks), `dataStatus` verified/demo/unverified, audit log | Good foundation; no calibration or field-verification workflow |

**Assumption flagged:** floor plans from the university, if they exist, may be in DWG/PDF. The tool currently needs a hand-drawn graph over an SVG. For a large campus, that manual effort is the dominant cost.

---

## 8. UI/UX and accessibility analysis

**Strengths (evidence):** three visual styles with no behaviour difference; full RTL and Sorani/Arabic typography handling; 44–48 px touch targets on mobile; keyboard-operable SVG maps (role, tabIndex, Enter); `aria-current` on steps; estimates clearly labelled; demo data labelled everywhere; offline page.

**Gaps and risks:**

- **Navigation UX depends on manual step advance.** That's fine indoors with landmarks, but users must be taught it.
- **No automated accessibility audit** (axe) and **no screen-reader testing** (TalkBack/VoiceOver). The roadmap lists this as not done.
- **Translations need native-speaker review**, especially safety strings (`docs/SECURITY.md` residual risk 8).
- The admin dashboard is English-only. That may block non-English-speaking data-entry staff.
- **Map legibility on low-end phones** is not measured.
- Visual design is adequate. **Per the audit rules, no visual work should come before data and positioning.**

---

## 9. Security and privacy assessment

**Verified controls:** RLS tenant isolation (32 DB tests), composite tenant foreign keys, anti-escalation on role assignment (DB + e2e), audit triggers, strict QR token parsing, open-redirect guard, sanitised SVG upload, security headers and Permissions-Policy (e2e), no secrets in repo, service-role key only server-side, no analytics or tracking, history off by default.

**Open risks** (from `docs/SECURITY.md` plus this audit):

| Risk | Severity | Note |
|---|---|---|
| Live Supabase never exercised (auth flows, storage policies, edge function) | High | Policies are tested on Postgres only |
| Admin tokens in `localStorage` (supabase-js default) | Medium | XSS would expose them → httpOnly cookie sessions |
| CSP allows `'unsafe-inline'` scripts | Medium | Move to nonce-based CSP |
| Floor-plan and campus-image buckets are **public-read** | Medium | Security-sensitive plans (labs, server rooms, restricted areas) could be exposed. **The university must decide what is publishable.** |
| Rate limiter is in-memory, per instance, and trusts `X-Forwarded-For` | Low–Medium | OK on Vercel; use platform firewall/shared store at scale |
| Admin sandbox enabled on the public preview (`NEXT_PUBLIC_ALLOW_SANDBOX=true`) | Low (demo only) | Must be **unset** for production |
| Lecturer personal data (photos, emails, office hours) | Medium (legal) | Needs a consent/approval process from the university |
| Dependency audit / Dependabot not enabled | Low | |
| Data residency (Iraq/KRG policy) | Unknown | Supabase region choice depends on university policy |

---

## 10. Performance and reliability assessment

- **Routing:** fast enough by a wide margin (lab numbers above).
- **Web load (lab, throttled):** 1.9–2.0 s cold on slow 4G; 2.3–3.3 s cold on fast 3G (room page slightly over the 3 s target); about 0.3 s warm. **Not measured on real phones or campus Wi-Fi.**
- **Bundle growth:** the bundle grows linearly with rooms + nodes and lives in `localStorage` (about 5 MB). A full university (thousands of rooms, tens of thousands of nodes, timetable) may exceed it. **Unmeasured — must be tested with real data volumes.**
- **Reliability:** cache-first startup with background refresh; the last bundle is used offline with its timestamp shown. **No error monitoring** (no Sentry or similar) and **no uptime monitoring**.
- **CI:** one workflow run is recorded for this branch (passed, on an earlier commit). The latest commits have local test runs only.
- **Mobile:** 4.4 MB Hermes bundle; never profiled on a device.

---

## 11. Critical problems and technical risks

| # | Problem | Severity |
|---|---|---|
| C1 | No authorised real campus data. Without it, the product can't be used at all. | **Blocker** |
| C2 | No geographic reference or outdoor network. Campus-wide routing is not credible. | **Blocker for campus-scale use** (not for single-building indoor) |
| C3 | Never run against live Supabase or on real phones | **Blocker for production** |
| C4 | Scale calibration is unenforced (default 0.05 m/unit) | High (silent distance errors) |
| C5 | Positioning only by QR or manual pick. Success depends on sign density and placement that hasn't been planned. | High |
| C6 | No field validation of routes, instructions or time estimates | High |
| C7 | No user error-reporting loop and no data-maintenance process | High (data decays after launch) |
| C8 | Public-read storage for plans | Medium (security policy decision) |
| C9 | Bundle size limits for a full university | Medium (unmeasured) |
| C10 | No monitoring or alerting in production | Medium |
| C11 | Manual graph drawing effort for a whole campus | Medium (cost/time) |

---

## 12. Missing features and capabilities

Ordered by importance for real use, not novelty:

1. Geo-referencing (campus CRS, building outlines, entrances in lat/lng) and an **outdoor path network**.
2. A two-point **floor-plan scale calibration** tool and an "uncalibrated" validation error.
3. **Report a problem** (wrong room, blocked path, wrong instruction) for users, plus an admin triage queue.
4. **Temporary closures** (time-windowed blocked edges with a reason) and elevator out-of-service status.
5. Outdoor GPS start / "you are near X" (optional, outdoors only) and "tap on map to set start".
6. Route cost by **time** (vertical penalties, configurable) as well as distance.
7. Field-verification workflow: mark each room/edge as verified with the date and person (extending the existing `dataStatus`).
8. Bulk import from university sources (room lists CSV, timetable from the student information system, CAD/GeoJSON plans).
9. Staff/role-aware routing (allowed restrictions per role).
10. Live Supabase deployment, monitoring, backups.
11. Admin UI in Sorani/Arabic.
12. Push sender for schedule changes; student sign-in (optional).
13. Emergency information mode — **only with university safety-office approval**.

---

## QUESTIONS THAT MUST BE ANSWERED BEFORE IMPROVEMENT

Only questions the code **cannot** answer are listed. *Essential* means work can't be planned without the answer.

### A. Project ownership and objectives

| # | Question | Why it matters | Essential? | Decision that depends on it | Source |
|---|---|---|---|---|---|
| A1 | Do you have (or will you seek) **official permission from Salahaddin University** to build and publish SUE NAV with its data? | Without authorisation no real data can be entered or published | **Essential** | Whether we pilot with SUE or a generic demo | You |
| A2 | What is the **first pilot scope**: one building, one college, or the whole campus? Which campus (SUE has several sites)? | Determines whether outdoor/geo work is needed now | **Essential** | Phase 2 scope; whether C2 is a blocker | You (+ university) |
| A3 | Is there a **target date** (e.g. start of a semester)? | Drives prioritisation | **Essential** | Roadmap cut-line | You |
| A4 | Is this a product for **many universities** (multi-tenant SaaS) or SUE first and only? | Multi-tenant cost is already paid; affects onboarding work | Optional | Whether to invest in tenant onboarding tooling | You |

### B. University and campus information

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| B1 | Do official **floor plans** exist, and in what format (DWG/DXF, PDF, paper, GIS, BIM/IFC)? | The biggest cost driver of mapping | **Essential** | Manual tracing vs. CAD/GIS import pipeline | University |
| B2 | Is there an official **building code + room numbering scheme**, and official names in en/ckb/ar? | Search and signage must match what people say and read | **Essential** | Data model fields, search synonyms | University |
| B3 | Which areas are **restricted** (labs, admin, women-only areas, staff zones) and at what **hours**? | Routes must not send people through closed areas | **Essential** | Time-windowed restrictions feature | University |
| B4 | Are there **gates** with opening hours, and are vehicles/pedestrians separated? | Outdoor routing correctness | Essential if campus-wide | Outdoor network model | University |

### C. Existing implementation

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| C1 | Will you create the **Supabase project** (region, plan) now, or stay in demo mode until data is ready? | Live backend is unverified | **Essential** | When Phase 1 hardening starts | You |
| C2 | Is a **native app store release** required for the pilot, or is the PWA enough? | Device testing and store review cost | **Essential** | Whether mobile is in Phase 1 or later | You |

### D. Navigation accuracy

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| D1 | What **accuracy is "good enough"** for you: correct room door, correct floor + stairwell, or distance within some tolerance? | Defines pass/fail for field tests | **Essential** | Acceptance criteria in §16 | You |
| D2 | Should routes prefer **shortest distance or fastest time** (e.g. avoid elevators at peak times)? | Finding N1 | Optional | Cost function design | You |

### E. Mapping and positioning

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| E1 | Is **outdoor GPS "blue dot"** required, or is QR/manual start acceptable for the pilot? | GPS needs geo-referencing and a map provider; QR needs signs | **Essential** | Map stack (MapLibre + tiles) and Phase 2 scope | You |
| E2 | May we **install QR signs** in corridors, stairwells and entrances? Who prints and mounts them? | Positioning depends on it | **Essential** | Sign plan, density | University |
| E3 | Is there **budget/interest in BLE beacons or Wi-Fi positioning** later? | Hardware cost; Wi-Fi infrastructure ownership | Optional | Phase 4 positioning | You + university IT |

### F. Database and infrastructure

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| F1 | Is there a **data-residency or hosting policy** (must data stay in Iraq/KRG, on university servers)? | Supabase cloud vs. self-hosting | **Essential** | Hosting architecture | University |
| F2 | Can the **timetable/room data come from the student information system** (export format, frequency)? | Manual timetable entry won't scale | Essential if timetables are in scope | Import pipeline | University |

### G. User roles and permissions

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| G1 | **Who will maintain data** after launch (faculty admins, a central office, you)? | Data decay is the long-term failure mode | **Essential** | Role design, admin UI language, training | You + university |
| G2 | Does the university have **single sign-on** (Microsoft 365 / Google Workspace) staff should use? | Auth setup for admins (and optionally students) | Optional | Supabase auth provider | University |

### H. UI/UX and accessibility

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| H1 | Are there **wheelchair users / disability services** on campus who can test accessible routes? | Accessible routing can't be validated without them | **Essential** for accessible-route claims | Accessibility test plan | University |
| H2 | Which language should be the **default** (Sorani vs English vs Arabic)? | First-run experience | Optional | Tenant settings | You |

### I. AI functionality

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| I1 | Is an **LLM-based assistant** actually needed, given the offline rule-based one works in all 3 languages? | Avoid unnecessary AI cost and privacy exposure | Optional | Whether Phase 4 includes an LLM | You |

### J. Offline support

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| J1 | How reliable is **campus Wi-Fi / mobile data** inside buildings (basements, labs)? | Offline-first is already the design; affects bundle size and update strategy | Optional | Bundle splitting priority | University / your field test |

### K. Security and privacy

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| K1 | Which **plans and room types may be public** (e.g. hide server rooms, labs with hazardous materials, women-only areas)? | Storage buckets are public-read | **Essential** | Private bucket vs. curated public plans | University (security office) |
| K2 | May **lecturer names, photos, offices and office hours** be published? Is consent required? | Personal data | **Essential** if lecturer finder is in scope | Lecturer feature scope | University |

### L. Deployment and maintenance

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| L1 | Which **domain** (e.g. a `su.edu.krd` subdomain) and who owns DNS? | Trust, QR URLs printed on signs can't change later | **Essential** before printing QR signs | Domain/QR base URL | University IT |

### M. Budget and technology limitations

| # | Question | Why | Essential? | Decision | Source |
|---|---|---|---|---|---|
| M1 | Monthly **budget ceiling** for hosting, map tiles, SMS/email, app store accounts? | Choosing free/self-hosted vs paid services | **Essential** | Tool choices in §18 | You |
| M2 | How many **people/hours** are available for mapping fieldwork? | Mapping is labour-heavy | **Essential** | Pilot scope and timeline | You + university |

---

## 13. Information required from me (the project owner)

The **essential** questions above for you: A1, A2, A3, C1, C2, D1, E1, G1, M1, M2. (Optional: A4, D2, E3, H2, I1.)

## 14. Information required from the university

B1, B2, B3, B4, E2, F1, F2, G1, G2, H1, K1, K2, L1, plus official approval (A1).

## 15. Required real-world campus data — collection checklist

**Campus level**
- [ ] Campus boundary (polygon, lat/lng), official name in en/ckb/ar
- [ ] Gates: location, opening hours, pedestrian/vehicle, accessible?
- [ ] Outdoor walkable paths: centre-lines, steps, ramps, slopes, covered walkways, crossings
- [ ] Building outlines (lat/lng) and official codes/names in 3 languages
- [ ] Building entrances (lat/lng + which floor they open onto), accessible entrances marked, opening hours
- [ ] Parking, bus stops, prayer areas, cafeterias, ATMs, clinics, security office (optional points of interest)

**Building level (each building)**
- [ ] Floor list with official level names (e.g. "Ground", "Basement 1")
- [ ] Floor plan per floor (original format + export), with **two measured reference distances** for scale
- [ ] Stairwells (which floors each serves), elevators (floors served, accessible, usual status), ramps
- [ ] Measured vertical travel lengths or an agreed policy (e.g. stairs = N m per floor)
- [ ] Corridors and doors that are locked, one-way, staff-only or time-restricted
- [ ] Emergency exits and assembly points (only if the safety office approves showing them)
- [ ] Photo of each entrance and stairwell (helps landmark-based instructions)

**Room level**
- [ ] Official room code, name (3 languages), type, department, capacity
- [ ] Door location(s) — which corridor the door opens onto
- [ ] Accessibility (step-free? door width if known)
- [ ] Public/hidden flag (security-sensitive rooms)

**People and schedule (if in scope)**
- [ ] Departments/colleges and their buildings
- [ ] Lecturers: approved public fields only, consent record, office room, office hours
- [ ] Timetable export format and update frequency; semester dates; weekend days; time zone confirmation

**Positioning**
- [ ] Planned QR sign locations (each mapped to a nav node), mounting permission, sign ID list
- [ ] Domain for QR URLs fixed before printing

**Governance**
- [ ] Named data owner per building/college; update procedure; review cycle

---

## 16. Recommended testing and validation procedures

No accuracy claim may be published until these produce recorded evidence.

### 16.1 Campus mapping verification
1. Import or trace each floor; set scale with **two independent measured distances**. Accept if the second measurement matches the plan within an agreed tolerance (agreed with you, see D1).
2. Run `validateMap`; **zero errors** required before publishing a floor.
3. **Walk-through audit:** a surveyor walks every corridor with the app and checks each room door and stair/elevator link. Mark it `verified` with date and name.
4. Two-person rule: the person who maps doesn't verify.

### 16.2 Route accuracy testing
1. Pick a stratified sample of origin–destination pairs: same floor, multi-floor, cross-building, accessible-only. Choose the size with you; cover every building and every vertical connector at least once.
2. For each pair: follow the instructions on foot without other help. Record success (arrived at the correct door), wrong turns, instruction ambiguity, measured distance (pedometer/wheel) vs. app distance, and actual time vs. estimate.
3. Acceptance: agreed in advance (D1). Report results as measured, including failures.

### 16.3 Location accuracy testing
- **QR:** for every sign, scan it and confirm the app shows the correct floor and position, and that the sign's physical location matches its node. Test expired and disabled tokens.
- **GPS (if added):** at fixed surveyed outdoor points, record reported positions over several sessions, devices and times. Report the observed error distribution. Never show a blue dot indoors.

### 16.4 Destination search validation
- Build a test list of real queries collected from students and staff in 3 languages, including colloquial names, transliterations, typos, Arabic vs Persian letter variants, Kurdish/Arabic digits.
- Measure "correct result in top 3". Add synonyms for failures.

### 16.5 Indoor navigation testing
- Every stairwell and elevator on every floor; basements; buildings with split levels; doors that look alike; dead ends.

### 16.6 GPS and network failure testing
- Airplane mode after the first load (web and mobile): search, route, maps and the timetable must work; the "data as of" timestamp is visible.
- Slow or captive-portal Wi-Fi; corrupted or missing cache; backend down (stale bundle shown, clear error).
- Denied camera permission (manual code entry works).

### 16.7 Accessibility route testing
- With wheelchair users (H1): every accessible route physically walked or rolled. Elevators out of service → app must say "no accessible route" rather than offering stairs.
- Screen readers: TalkBack and VoiceOver through search → navigate → arrive in all 3 languages. axe automated scan in CI.

### 16.8 Offline functionality testing
- Mobile on real Android (low-end) and iOS devices: install, first load, offline relaunch, update after data change.

### 16.9 Performance benchmarks
- Measure (don't assume) on a real low-end Android over campus Wi-Fi: cold load, bundle download size and time, route time, memory. Re-measure with the **full real dataset** to check the localStorage limit.

### 16.10 Incorrect location / route reporting system (to build)
- "Report a problem" on room, route and step screens → category, optional photo/comment, auto-attached route/node IDs, no personal data required.
- Admin triage queue with status; can temporarily block an edge with a reason and an expiry.

### 16.11 Data maintenance process
- Named owner per building; change requests via the admin with an audit log (already exists).
- Re-verification each semester and after any construction.
- Dashboard of stale data (`verified` older than N months, open reports).

---

## 17. Potential architecture improvements

| Improvement | Why | Notes |
|---|---|---|
| **Geo-referencing layer** | Needed for outdoor routing, GPS and real maps | Store a per-building (or per-floor) affine transform from local units → WGS84 (lat/lng); keep local coordinates for drawing. PostGIS optional. |
| **Outdoor network as nodes/edges** | Replace single "85 m" edges | An outdoor pseudo-floor per campus in a projected CRS, or real lat/lng nodes; reuse the existing router unchanged. |
| **Time-based cost** | Fastest vs shortest | Use the existing `kindPenaltyM` (already supported) from tenant settings. |
| **Time-windowed closures** | Construction, exam halls, gates | New `closures` table (edge/area, from–to, reason); merged into `avoidEdgeIds` at route time. |
| **Bundle splitting** | Large universities; localStorage limit | Per-campus/building bundles in IndexedDB (web) instead of localStorage. |
| **Import pipelines** | Mapping effort | DXF/GeoJSON/IMDF import → map elements; room CSV; timetable from the student information system. |
| **Server sessions for admin** | XSS token exposure | `@supabase/ssr` httpOnly cookies + nonce CSP. |
| **Observability** | No monitoring today | Error tracking + uptime checks + Supabase logs/alerts. |
| **Private storage for sensitive plans** | Public-read buckets | Signed URLs, or publish only curated "public" plans. |

---

## 18. Recommended tools, technologies, APIs and services

Only where a gap exists. Choose after the budget answer (M1).

| Need | Recommended | Why / alternative |
|---|---|---|
| Base map tiles (outdoor) | **MapLibre GL** (open source) with **OpenStreetMap**-based tiles (self-hosted PMTiles, or a low-cost provider) | No vendor lock-in; works offline with PMTiles. Alternatives: Mapbox, Google Maps (cost, terms). |
| Campus GIS editing | **QGIS** (free) or **JOSM** for tracing outlines and paths from imagery | Export GeoJSON for import |
| Indoor data standard (optional) | **IMDF** (Apple Indoor Mapping Data Format) or OSM Simple Indoor Tagging as import/export formats | Interoperability; not required for the pilot |
| CAD conversion | DXF export from AutoCAD → GeoJSON (GDAL/ogr2ogr) | Only if plans exist in DWG |
| Spatial DB (optional) | **PostGIS** extension on Supabase | Only once lat/lng data exists |
| Outdoor position | Browser Geolocation / `expo-location`, outdoors only, with accuracy circle | Turn off indoors; clear permission text |
| Indoor positioning (later, optional) | BLE beacons or Wi-Fi RTT as an extra "start node" provider | Hardware and maintenance cost; the QR design already supports a pluggable start |
| Error monitoring | Sentry (has a free tier) or self-hosted GlitchTip | |
| Accessibility testing | axe-core in Playwright; manual TalkBack/VoiceOver | |
| Dependency hygiene | Dependabot or Renovate | Already recommended in SECURITY.md |
| AI | **Not needed for the pilot.** Keep the rule-based assistant; consider an LLM parser only after real search logs show it would help | Avoid unnecessary AI |

---

## 19. Prioritized improvement roadmap

Effort scale (rough, single experienced developer, **excluding** fieldwork time): **S** ≤ 3 days · **M** 1–2 weeks · **L** 3–6 weeks · **XL** > 6 weeks. These are planning estimates, not quotes.

### Phase 1 — Critical issues and reliability

| Improvement | Problem | Proposed solution | Benefit | Required info/data | Complexity | Priority | Depends on | Effort |
|---|---|---|---|---|---|---|---|---|
| 1.1 Live backend | Supabase never exercised (C3) | Create staging project; apply migrations; run DB tests + e2e against it; test edge function, storage, auth | Proves the backend works | C1, F1 | Medium | P0 | — | M |
| 1.2 Scale calibration guard | Silent distance errors (N4) | Two-point calibration tool; "uncalibrated" floors fail validation and can't be published | Correct distances | Measured reference distances | Low | P0 | — | S |
| 1.3 Report-a-problem | No feedback loop (C7) | User report form + admin queue | Data errors found quickly | — | Medium | P0 | 1.1 | M |
| 1.4 Time-windowed closures | Static `blocked` only (N9) | Closures table with reason + expiry, shown to users | Safe routing during works/exams | B3 | Medium | P1 | 1.1 | M |
| 1.5 Production hardening | Token storage, CSP, sandbox flag, public buckets (§9) | httpOnly sessions, nonce CSP, unset sandbox, private/curated plans | Security | K1 | Medium | P1 | 1.1 | M |
| 1.6 Monitoring | None (C10) | Error tracking, uptime, DB alerts | Detect outages | M1 | Low | P1 | 1.1 | S |
| 1.7 Device testing | Mobile never run (C3) | Android/iOS devices: camera, deep links, offline, notifications | Mobile confidence | C2 | Medium | P1 (if mobile in pilot) | — | M |

### Phase 2 — Map and navigation accuracy

| Improvement | Problem | Proposed solution | Benefit | Required info/data | Complexity | Priority | Depends on | Effort |
|---|---|---|---|---|---|---|---|---|
| 2.1 Pilot building data | No real data (C1) | Map one authorised building end-to-end; verify on foot | First real evidence | A1, A2, B1, B2, §15 | Medium (fieldwork-heavy) | P0 | 1.2 | M + fieldwork |
| 2.2 QR sign plan | Positioning depends on signs (C5) | Place signs at entrances, stairwells, corridor junctions; print with final domain | Usable start points | E2, L1 | Low | P0 | 2.1 | S + fieldwork |
| 2.3 Field validation | Accuracy unproven (C6) | Run §16.1–16.7; publish the results | Evidence-based claims | D1, H1 | Medium | P0 | 2.1, 2.2 | M |
| 2.4 Geo-referencing | No lat/lng (C2) | Per-building transform to WGS84; campus boundary; building outlines | Basis for outdoor maps/GPS | Campus GIS data | Medium | P1 (P0 if campus-wide pilot) | — | M |
| 2.5 Outdoor network | Single-edge outdoor routing (N5) | Outdoor nodes/edges with gates, steps, ramps | Real cross-building routes | B4, outdoor path survey | Medium–High | P1 | 2.4 | L |
| 2.6 Time-aware routing | Distance-only choice (N1, N2) | Tenant-configurable vertical penalties via `kindPenaltyM`; policy for elevator edge cost | Better route choice | D2 | Low | P2 | — | S |
| 2.7 Polygon drawing + import | Rectangles-only editor; manual effort (C11) | Polygon tool; DXF/GeoJSON import | Faster, more faithful mapping | B1 | Medium–High | P1 | — | L |
| 2.8 Search synonyms | Real names/colloquialisms unknown | Synonym table per tenant; test list (§16.4) | Users find places | Collected queries | Low | P1 | 2.1 | S |

### Phase 3 — Architecture and performance

| Improvement | Problem | Proposed solution | Benefit | Required info/data | Complexity | Priority | Depends on | Effort |
|---|---|---|---|---|---|---|---|---|
| 3.1 Bundle splitting + IndexedDB | localStorage limit (C9) | Per-campus/building bundles; IndexedDB storage; incremental updates | Scales to full university | Real data volume | Medium | P1 (after measuring) | 2.1 | M |
| 3.2 Real-device performance | Lab-only numbers | Measure on low-end Android over campus Wi-Fi | Real performance evidence | — | Low | P1 | 2.1 | S |
| 3.3 Timetable import from student information system | Manual entry won't scale | Scheduled import job | Fresh schedules | F2 | Medium | P2 | 1.1 | M |
| 3.4 Admin UI localisation | English-only admin | Translate admin in ckb/ar | Staff can maintain data | G1 | Low–Medium | P2 | — | M |
| 3.5 Staff role-aware routing | Restrictions always avoided (N8) | Pass allowed restrictions based on signed-in role | Staff shortcuts | G2 | Low | P3 | Student/staff sign-in | S |

### Phase 4 — Advanced features and AI (only after Phase 2 evidence)

| Improvement | Problem | Proposed solution | Benefit | Required info/data | Complexity | Priority | Depends on | Effort |
|---|---|---|---|---|---|---|---|---|
| 4.1 Outdoor GPS start | No position outdoors | Geolocation outdoors only, snap to nearest outdoor node, accuracy circle | Easier outdoor start | E1 | Medium | P2 | 2.4, 2.5 | M |
| 4.2 Tap "I am here" | `nearestNode` unused | Long-press on floor map sets start | Faster start without QR | — | Low | P2 | — | S |
| 4.3 Indoor positioning (BLE/Wi-Fi) | QR needs active scanning | Beacons as an extra start provider | Fewer scans | E3, budget | High | P3 | 2.3 | XL |
| 4.4 Push for schedule changes | Sender missing | DB webhook → edge function → Expo Push | Timely notices | C2 | Medium | P3 | 1.1, 1.7 | M |
| 4.5 LLM assistant | Probably unnecessary | Only if search logs show unmet natural-language needs; keep "answers only from bundle" | Possibly better Q&A | I1, logs | Medium | P4 | 2.8 | M |
| 4.6 Emergency information | Exits visual only | Static evacuation info **approved by the safety office**; no automated evacuation routing without formal sign-off | Safety info | University approval | Medium (legal) | P3 | 2.3 | M |

### Phase 5 — University deployment and real-world validation

| Improvement | Problem | Proposed solution | Benefit | Required info/data | Complexity | Priority | Depends on | Effort |
|---|---|---|---|---|---|---|---|---|
| 5.1 Pilot launch (one building/college) | No real users yet | Soft launch with selected students and staff; collect reports | Real feedback | A3, G1 | Medium | P0 (of phase) | Phases 1–2 | M |
| 5.2 Data governance | Data decay | Named owners, semester re-verification, stale-data dashboard | Long-term accuracy | G1 | Low | P0 (of phase) | 1.3 | S |
| 5.3 Campus roll-out | Single building only | Repeat 2.1–2.3 per building | Full coverage | M2 | Fieldwork-heavy | P1 | 5.1 | XL (mostly fieldwork) |
| 5.4 Production domain, store release, privacy notices | Not production | University domain, store listings, privacy policy in 3 languages | Official service | L1, K2 | Medium | P1 | 1.5 | M |

---

## 20. Final readiness assessment for real-world university deployment

| Dimension | Readiness | Reason |
|---|---|---|
| Software architecture | **Good** | Clean modular design, positioning-agnostic router, offline-first, tenant isolation |
| Code quality and tests | **Good (demo scope)** | 124+ automated tests passing; CI passed on its only recorded run (an earlier commit) |
| Real campus data | **Not ready** | None entered; requires authorisation and fieldwork |
| Map / geographic layer | **Not ready** for campus-wide use | No CRS, no outdoor network; indoor-only is feasible |
| Positioning | **Partially ready** | QR works in demo; sign plan and field test missing; no GPS |
| Navigation accuracy | **Unknown** | No field evidence; calibration not enforced |
| Backend / production ops | **Not ready** | Live Supabase, monitoring, hardening pending |
| Mobile app | **Not ready** | Never run on a device |
| Accessibility | **Partially ready** | Good foundations; no assistive-technology or wheelchair-route testing |
| Security & privacy | **Partially ready** | Strong DB controls; open items in §9; university policy decisions needed |

**Overall: ready for a supervised single-building indoor pilot once Phase 1 items 1.1–1.3 and Phase 2 items 2.1–2.3 are done. Not ready for campus-wide or production use.** No statement about navigation accuracy should be made publicly until §16 tests are completed and their results recorded.

---

## Appendix A — Concise deliverables

### A.1 Executive summary (short)
Solid, tested software foundation for indoor campus navigation (A* routing, QR start points, 3 languages, offline, secure multi-tenant backend). Not yet usable at a real university: no real data, no geographic/outdoor layer, no live position, never run against live Supabase or real phones, and no field validation of accuracy. The next step is an authorised one-building pilot with calibrated plans, QR signs and on-foot route testing. Fancy UI and AI come later.

### A.2 Prioritized critical improvements
1. Obtain university authorisation and pilot scope (A1, A2).
2. Stand up and test a live Supabase staging backend (1.1).
3. Enforce floor-plan scale calibration (1.2).
4. Map and verify one real building on foot (2.1) with a QR sign plan (2.2).
5. Field-validate routes, search and accessibility, and record results (2.3).
6. Add report-a-problem and time-windowed closures (1.3, 1.4).
7. Production hardening and monitoring (1.5, 1.6).
8. Geo-reference the campus and build the outdoor path network if the pilot is campus-wide (2.4, 2.5).

### A.3 Questions for me
A1 permission · A2 pilot scope/campus · A3 target date · C1 Supabase now? · C2 app store needed? · D1 accuracy acceptance · E1 GPS needed? · G1 who maintains data · M1 budget ceiling · M2 fieldwork people/hours.

### A.4 Questions for university administration
Official approval and data owner · floor-plan formats (B1) · building codes/room numbering and official names in 3 languages (B2) · restricted areas and hours (B3) · gates (B4) · permission to mount QR signs (E2) · data-residency policy (F1) · student information system timetable export (F2) · who maintains data, SSO (G1, G2) · disability-services testers (H1) · which plans and rooms may be public (K1) · lecturer data consent (K2) · official domain (L1) · emergency/evacuation information policy.

### A.5 Campus data checklist
See §15.

### A.6 Recommended next-step plan
1. **This week:** answer A1, A2, D1, E1, M1; send the university the §14 questions.
2. **Weeks 1–2:** Supabase staging (1.1), calibration guard (1.2), report-a-problem (1.3).
3. **Weeks 2–4 (with university data):** map one building (2.1), place QR signs (2.2).
4. **Weeks 4–6:** field validation (2.3) with recorded results; fix data; decide go/no-go for a supervised pilot (5.1).
5. **After the pilot:** geo-referencing and outdoor network (2.4, 2.5) if campus-wide routing is wanted; then bundle splitting (3.1) and further roll-out.

The week numbers are a planning sketch. They depend on the answers above and on fieldwork capacity.
