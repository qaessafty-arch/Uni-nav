# Architecture

## Goals that shaped it

1. The core job — find a room or lecturer and walk there — must work on low-end Android phones on unreliable campus Wi-Fi.
2. One codebase serves many universities, with tenant isolation enforced by the database rather than by app code.
3. Nothing is invented: rooms, lecturers, distances and times come from data that someone entered; estimates are labelled as estimates.
4. Optional modules (AI assistant, push, AR, IoT) attach at defined boundaries without rewrites.

## System overview

```
                ┌────────────────────┐   ┌───────────────────┐   ┌────────────────────┐
                │ apps/web (PWA)     │   │ apps/admin        │   │ apps/mobile (Expo) │
                │ students/visitors  │   │ university staff  │   │ Android / iOS      │
                └─────────┬──────────┘   └────────┬──────────┘   └─────────┬──────────┘
                          │  @campusnav/core · data · i18n · tokens (shared TypeScript)
                          ▼                       ▼                         ▼
                ┌───────────────────────────────────────────────────────────────────┐
                │ Supabase: PostgreSQL 16 + Row Level Security + Auth + Storage     │
                │ RPCs: resolve_checkpoint, admin_set_member_role, create_university │
                │ Edge function: invite-member (service role, server-side only)      │
                └───────────────────────────────────────────────────────────────────┘
```

Without Supabase credentials every client falls back to a local alternative (demo dataset / browser sandbox) so the product can be developed and evaluated with zero external configuration.

## Module boundaries

| Package | Responsibility | Depends on |
|---|---|---|
| `core` | Pure domain logic: types, zod schemas, graph routing, instructions, walking estimates, timetable resolution & conflicts, time zones, QR payload parsing, CSV import validation, map validation, SVG upload checks, search normalisation, permission matrix, assistant intent boundary | `zod` only |
| `data` | Talking to backends: `CampusDataSource` (read), `AdminDataSource` (write), Supabase + demo + sandbox implementations, offline bundle cache, demo dataset, seed generator | `core`, `supabase-js` |
| `i18n` | Messages (en/ckb/ar), RTL, number/date/time formatting with Sorani fallbacks, navigation step sentences | `core` |
| `tokens` | Colours, spacing, type, radii, motion for web (CSS vars) and RN (objects) | — |
| `map-web` | React DOM SVG floor map (zoom/pan/pinch/keyboard) | `core` |

Apps own only UI and platform glue (storage, camera, notifications, routing).

## Data flow: the campus bundle

Clients read a university as one **`CampusBundle`** (buildings, floors, rooms, map elements, navigation graph, public checkpoint locations, departments, lecturers, courses, groups, semesters, timetable, schedule changes, announcements).

- One request set per university (≈15 parallel selects under the caller's RLS).
- Cached with a timestamp (`localStorage` on web, AsyncStorage on mobile). On start the cached copy renders immediately, then a network refresh replaces it. If the network fails, the cached copy stays and the UI shows *“Showing campus data saved on …; room changes may be out of date.”*
- Routing and search run locally on the bundle: no server round trip per route, works offline.
- Checkpoint **tokens are never in the bundle**; only checkpoint locations for drawing.

Bundle size for the demo university: ~100 KB JSON. A large university (≈5,000 rooms) is estimated at a few MB; at that scale the bundle should be split per campus — see roadmap.

## API design

There is no bespoke REST server; the API is PostgREST (via supabase-js) constrained by RLS, plus a few RPCs and one Next.js route:

| Endpoint | Caller | Purpose |
|---|---|---|
| `GET /rest/v1/<table>?university_id=eq.<id>` | anon / authenticated | Read tenant data (RLS filters) |
| `POST/PATCH/DELETE /rest/v1/<table>` | authenticated staff | Writes; RLS `can_write()` decides |
| `rpc/resolve_checkpoint(p_token)` | anon / authenticated | Validate a QR token → node + status, no token echo |
| `rpc/admin_list_members(p_university)` | staff with `member.invite` | Members with emails |
| `rpc/admin_set_member_role(...)` | staff | Assign roles with anti-escalation rules |
| `rpc/create_university(...)` | platform owner | Tenant onboarding |
| `GET /api/checkpoint/:token` (web) | anyone | Rate-limited proxy for checkpoint resolution |
| `functions/v1/invite-member` | staff | Invite by email (service role stays server-side) |

## Navigation engine

Indoor space is a graph:

- **Nodes**: corridor junctions, room entrances, stairs, elevators, building entrances, checkpoints, outdoor points. Each has floor-local coordinates.
- **Edges**: corridor, door, stairs, elevator, ramp, outdoor; with `distanceM` (optional for same-floor edges), `accessible`, `bidirectional`, `blocked`, `restriction`.

**Distances.** Same-floor edges without an explicit length use `euclidean(map units) × floor.metersPerUnit`. Cross-floor and cross-building edges **must** carry a measured `distanceM`; the graph builder rejects them otherwise (`unknown_distance`) instead of guessing. Floors without a calibrated scale should not be published.

**Search.** A* with a straight-line heuristic when the current node and goal share a floor and 0 otherwise. Since walking paths can't be shorter than the straight line, the heuristic is admissible and A* returns optimal routes; across floors it degrades to Dijkstra. Binary heap, lazy deletion. Options: accessible-only, avoid edge ids/kinds, allowed restrictions (e.g. staff-only shortcuts excluded for students), per-kind penalties that affect choice but not reported distance.

**Instructions.** Consecutive legs are merged into “walk N m”; heading changes of 25–50° become “bear left/right”, 50–155° turns, >155° turn-around; vertical legs become “take the stairs/elevator to Floor X” (consecutive rides merged); building changes become “walk N m outside to …”. Steps are data (`kind`, distance, floor, landmark) rendered by `i18n.describeStep` in each language.

**Walking time** = Σ(distance / configured speed) + floors × configured seconds per floor (stairs vs. elevator), with separate accessible speed. Always shown with an **Estimate** badge and the assumptions.

**Performance.** Measured: 0.10 ms average for the demo 3-floor route; 28.9 ms for a synthetic 14,400-node / 28,368-edge graph (see PERFORMANCE.md). Graphs are cached per bundle.

**Validation** (`validateMap`) runs in the admin editor and the test suite: duplicate ids, duplicate room codes, missing codes, rooms without/unknown/wrong-floor entrances, unreachable rooms (outside the main connected component), dangling edges, cross-floor edges without distance, isolated nodes, stairs/elevators without a floor link, disconnected floors, checkpoints on missing/unreachable nodes, out-of-bounds shapes.

## 3D explorer (student web)

- **Map-first home** (`apps/web/components/Explorer.tsx`): campus map fills the screen; search, details and actions live in a side panel (desktop) or bottom sheet (phone). State is in the URL (`?b=building&f=floor&r=room&in=1&v=3d|2d`).
- **Rendering** uses plain `three` (0.186.1) with its bundled OrbitControls — no React renderer. `lib/three/viewer.ts` owns the canvas, camera, picking, DOM labels with collision avoidance and **on-demand rendering** (frames only when something changes). `lib/three/scenes.ts` turns the CampusBundle into geometry. Routing never depends on 3D.
- **Campus model:** building footprints from the campus map (`buildings.overview`), height = number of floors × a fixed schematic storey height. **Building model:** each floor's map elements extruded (rooms as low "cutaway" boxes, stairs/elevators taller), floors stacked or separated ("exploded"), room picking, checkpoints, and — on `/navigate` — the route drawn through the exact graph nodes returned by `planRoute`.
- **Honesty:** the 3D view is labelled "Schematic 3D generated from the map data"; demo/unverified status, "not placed on the campus map" and "floor plan unavailable" are shown from the data. No geometry is invented: unplaced buildings are listed but not drawn; floors without map elements show only a slab.
- **Performance/fallback:** three.js is a lazy chunk (`next/dynamic`, ~594 KB uncompressed) loaded only when a 3D view is shown; phones and Data Saver default to 2D. Detailed interiors are built only for the building being explored. No real-time shadows. If WebGL is missing or the context is lost, the explorer switches to the SVG 2D maps (`?no3d=1` forces this for testing).

## Real map and scaling

- **Real map:** campuses can have `geo` (centre, zoom) and buildings a `geo.footprint` (WGS84 outline). The student map uses MapLibre GL with OpenStreetMap-based vector tiles (default OpenFreeMap "positron"; override with `NEXT_PUBLIC_MAP_STYLE_URL`). Staff trace outlines in Admin → Real map. Arabic/Kurdish map labels use the self-hosted RTL text plugin (`public/vendor`). Buildings without an outline are listed, never guessed. Indoors still uses floor plans (2D/3D).
- **Scaling:** `GET /api/bundle/:universityId` serves the public campus bundle with `Cache-Control: s-maxage=300, stale-while-revalidate=3600` and an ETag, so a CDN answers repeat requests and the database sees about one query set per university per cache window. The client prefers it and falls back to direct Supabase queries. Routing and search run on the device.

## QR checkpoint positioning

Indoor GPS is unreliable, so position comes from scanning signs:

1. Admin creates a checkpoint on a navigation node; the server stores a random 24-char token (≈140 bits, rejection-sampled).
2. The printed QR encodes `https://<student-app>/q/<token>` so a stock camera opens the web app; the native app also accepts `campusnav://q/<token>` and universal links.
3. Clients parse strictly (`^[A-Za-z0-9]{16,64}$`, known URL shapes only, optional host allow-list) and **always** resolve through the backend (`resolve_checkpoint`), which returns status — unknown, disabled, expired, other university — so the UI can explain.
4. A checkpoint only sets the user's starting node. It grants nothing.

## Timetable

Entries are weekly (day + date range) or one-off, in **university-local wall-clock time**; the university's IANA time zone (default `Asia/Baghdad`) is applied for “now/next” and countdowns via `Intl`. Weekend days and week start are tenant settings (Fri+Sat by default → week starts Sunday). Per-date `schedule_changes` (cancel, room, time, lecturer) overlay occurrences without editing the weekly pattern. Conflict detection buckets by room/lecturer/group, checks time overlap and finds the first common date (handles once-vs-weekly and partial date-range overlap). The admin UI and the CSV importer refuse to save conflicts unless an admin explicitly confirms after reviewing them.

## Multi-university design

- `universities` is the tenant root; every tenant table has `university_id`.
- Composite foreign keys `(child.parent_id, child.university_id) → parent(id, university_id)` make cross-tenant references impossible at the storage layer.
- RLS uses membership-derived functions (`can_read_university`, `can_write`, `has_permission`); a client-supplied tenant id is only a filter, never a credential.
- Tenant settings (time zone, weekend, locales, timetable visibility, walking assumptions, branding) live in `universities.settings/branding` and are editable by owners in the admin app.

## AI assistant boundary (optional module)

`core/assistant` separates *understanding* from *answering*:

- `IntentParser.parse(question) → AssistantIntent` (find room / lecturer / place, next lecture, timetable day, navigate, unknown).
- `executeIntent(intent, bundle)` answers **only** from the campus bundle, returning structured results, a clarification set when ambiguous, or *not found*.

The shipped `RuleBasedIntentParser` works offline in English, Sorani and Arabic without any provider. An LLM-backed parser can implement the same interface; because it only produces an intent, it cannot fabricate rooms or routes, and because the bundle contains only what the user's session may read, it cannot bypass authorisation.

## Future modules — where they plug in

| Module | Extension point |
|---|---|
| Library / cafeteria / services / events / lost & found | New tenant tables + bundle sections; reuse `announcements` patterns and RLS template |
| Room / lab booking | `bookings` table with exclusion constraint on `(room_id, tstzrange)`; conflict logic already in `core/timetable` |
| Live occupancy / IoT | Separate `room_status` table fed by an edge function with device auth; only displayed when a source exists |
| Indoor positioning (BLE, Wi-Fi RTT) | Produce a start node like QR does — routing is positioning-agnostic |
| Voice navigation | `describeStep` already yields per-language sentences → TTS |
| AR / 3D | Node coordinates + floor levels + `verticalGroup` give a 2.5D model |
| Push for schedule changes | `push_tokens` table + Expo push from a DB webhook / edge function |
