# Development progress log

Updated as work completes. Status legend: ✅ done & tested · 🟡 done, not runtime-verified · ⬜ not started.

## 2026-11-02 — initial build

Stage 1 — Repository inspection: the repository was empty; a pnpm + Turborepo monorepo was established.

| Stage | Item | Status |
|---|---|---|
| 2 Architecture | Architecture, data flow, API design, roles, navigation algorithm, module boundaries, roadmap docs | ✅ |
| 3 Foundation | Monorepo, shared packages (core, data, i18n, tokens, map-web) | ✅ |
| | Design tokens + component library (web + native) | ✅ |
| | Database migrations, RLS, auth functions, audit, storage policies | ✅ (31 DB tests) |
| | Localisation en / ckb / ar with RTL and Sorani formatting fallbacks | ✅ |
| | Environment configuration and safe local fallbacks (demo data, admin sandbox) | ✅ |
| 4 Core | University/campus/building/floor/room structure | ✅ |
| | Interactive SVG maps (zoom, pan, pinch, keyboard) | ✅ |
| | Navigation graph + A* routing + instructions + estimates | ✅ (unit + e2e) |
| | QR checkpoints (generation, resolution, printing, rate limiting) | ✅ |
| | Lecturer directory | ✅ |
| | Timetable (display, changes, conflicts, CSV import/export) | ✅ |
| | Student web interface (18 screens incl. splash, onboarding, offline) | ✅ |
| | Admin interface (19 screens incl. map editor) | ✅ (sandbox mode) |
| 5 Mobile | Expo app: navigation, QR camera, offline cache, local reminders, deep links, RTL | 🟡 type-checked and bundled; not run on device |
| | Push notification infrastructure (token + table) | 🟡 sender not implemented |
| 6 Testing | 124 automated tests, all passing | ✅ |
| 7 Deployment prep | Deployment, env vars, DB setup, admin onboarding, mobile builds, backups, security checklist, testing + performance reports, launch checklist, CI workflow | ✅ docs; nothing deployed |

### Issues found and fixed during the build
- Time parsing in CSV import treated `:` as a separator after search normalisation → dedicated digit normaliser (caught by tests).
- Consecutive elevator legs produced one step per floor → merged into a single "take the elevator to Floor N" step.
- Map auto-fit zoomed to maximum on single points → capped fit zoom at 3×.
- Arabic-script text broke apart under monospace letter-spacing → letter-spacing disabled in RTL.
- Chromium lacks Sorani ICU data (dates showed in English) → manual Sorani date/number formatting fallback.
- Audit log table missed its SELECT grant (created after the bulk grant) → explicit grant (caught by DB tests).
- Platform-owner guard trigger blocked the service role → guard skips when there is no JWT subject.
- Open-redirect edge case `/\host` in the post-scan `then` parameter → strict same-site regex + e2e test.
- Admin sandbox reachable in a production build without Supabase → now requires explicit `NEXT_PUBLIC_ALLOW_SANDBOX=true`.
- Initial JS bundle carried both the demo dataset and supabase-js → lazy-loaded per mode.

### Next steps
See [ROADMAP.md](ROADMAP.md) › Next.
