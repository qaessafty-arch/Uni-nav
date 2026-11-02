# Performance report

All numbers were measured in the development container on 2026-11-02. They are lab measurements, not field data from campus networks or real low-end phones.

## Targets vs. measurements

| Target | Measurement | Status |
|---|---|---|
| Navigation calculation < 200 ms for building-sized graphs | **0.10 ms** average (demo 3-floor route, 100 runs, warm graph); **28.9 ms** for a synthetic 4-floor 14,400-node / 28,368-edge graph | ✅ Met with large margin |
| Main web experience usable within 3 s on a reasonable mobile connection | **1.9–2.0 s** cold load on "slow 4G" (150 ms RTT, 1.6 Mbps, 4× CPU slowdown); **2.3–3.3 s** cold on "fast 3G" (562 ms RTT, 1.44 Mbps) | ✅ on slow 4G; ⚠️ room page slightly over on fast 3G |
| Repeat visits | **0.23–0.31 s** to usable (warm cache, both profiles) | ✅ |
| No unauthorized cross-tenant access | 31 DB policy tests | ✅ (tested) |
| No broken primary navigation flows | 22 e2e tests | ✅ (tested in demo mode) |

"Usable" = the search box (home) or page heading (room) rendered after hydration, measured by `scripts/measure-web-perf.mjs` with Chrome DevTools Protocol network + CPU throttling on a 390×844 mobile viewport.

### Web load detail (production build, demo mode)

| Profile | Page | Cache | Usable (ms) | Transferred (KB) | DCL (ms) | LCP (ms) |
|---|---|---|---|---|---|---|
| slow-4g | / | cold | 2043 | 279 | 588 | 2048 |
| slow-4g | / | warm | 288 | 0 | 68 | 288 |
| slow-4g | /rooms/:id | cold | 1894 | 278 | 626 | 1860 |
| slow-4g | /rooms/:id | warm | 297 | 0 | 79 | 268 |
| fast-3g | / | cold | 2338 | 182 | 1421 | 2332 |
| fast-3g | / | warm | 232 | 0 | 45 | 224 |
| fast-3g | /rooms/:id | cold | 3314 | 285 | 1434 | 2324 |
| fast-3g | /rooms/:id | warm | 268 | 0 | 61 | 240 |

Reproduce: `pnpm --filter @campusnav/web build && pnpm --filter @campusnav/web start`, then `pnpm perf:web`.

## Optimisations applied (and their measured effect)

- **Lazy data sources**: the demo dataset and supabase-js are dynamically imported, so each deployment ships only the one it uses. Cold slow-4G load went from 2156 → 2043 ms (home) and 2250 → 1894 ms (room); transfer from ~335 KB → ~279 KB.
- **Fonts self-hosted** with `unicode-range`: Noto Sans Arabic (Sorani/Arabic) is downloaded only when Arabic-script text is on screen; English users never fetch it.
- **One bundle request + local routing/search**: no per-route or per-keystroke network calls; works offline.
- **Cache-first startup**: the last campus bundle renders immediately, then refreshes in the background.
- **Service worker**: hashed static assets cache-first; navigations network-first with cached fallback.
- **Graph cache** per bundle (WeakMap) so repeated route requests don't rebuild the graph.
- **No map or 3D libraries**: floor maps are plain SVG; no animation libraries.

## Mobile

Android Hermes bundle: 4.4 MB (includes React Native, expo-router, the demo dataset and fonts). Only three font files are bundled (two Noto Sans Arabic weights and IBM Plex Mono). Not yet profiled on a device.

## Known performance work remaining

- Measure on real low-end Android hardware over campus Wi-Fi.
- Split the campus bundle per campus/building for very large universities (bundle grows linearly with rooms + nodes).
- Nonce-based CSP would allow removing inline bootstrap scripts; consider React Server Components for static pages to reduce client JS further.
