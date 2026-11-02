# Design system

Source of truth: `packages/tokens` (TypeScript for React Native, CSS variables in `tokens.css` for web, mapped into Tailwind 4 via `@theme` in each web app).

## Principles

- **Function first.** Every element either informs or acts. No decorative charts, fake statistics or placeholder copy.
- **Restrained brutalism.** Square corners (0–4 px), 1 px borders, grid backgrounds only for empty/brand surfaces, monospaced metadata, one accent.
- **Electric green is a signal, not a theme.** Used for the primary action, the active route, "you are here", and the current lecture. Never for large surfaces.
- **Trust is visible.** Demo data shows an amber **DEMO DATA** label; cached data shows its sync date; walking times carry an **Estimate** badge; unverified records are labelled.

## Colour (dark, default)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0B0C0D` | App background |
| `surface` / `surfaceRaised` / `surfaceSunken` | `#111315` / `#16191C` / `#1C2024` | Cards, menus, inputs |
| `border` / `borderStrong` | `#272C31` / `#353B42` | Dividers, controls |
| `text` / `textMuted` / `textFaint` | `#EDEDE8` / `#8C949C` / `#6B737C` | Off-white text hierarchy |
| `accent` / `accentText` / `accentSoft` | `#B7FF35` / `#0B0C0D` / `#1E2A08` | Primary actions, route, selection |
| `warning` / `danger` / `info` | `#FFB547` / `#FF5A5A` / `#6CB4FF` | Demo/changes, errors, checkpoints |
| Map tokens | `mapRoom`, `mapCorridor`, `mapStairs`, `mapElevator`, `mapToilet`, `mapSelected`, `mapRoute` | Floor plans |

A light theme with the same token names is provided (accent darkened to `#4F7A00` for contrast on off-white).

## Visual styles (UI-only)

Three selectable styles share the same components, colours and behaviour; they differ only in geometry, type and surface treatment. They are driven by `html[data-style]` and the shared stylesheet `packages/tokens/src/ui.css` (`cn-*` classes, in Tailwind's `components` layer so utilities still override).

| Style | Character |
|---|---|
| **Minimalism × Electric** (`minimal`) | 3 px radii, 1 px hairlines, Inter display headings, generous spacing, accent used only for actions and state |
| **Editorial × Electric** (`editorial`, default) | Instrument Serif oversized headings, rule-based layouts instead of boxes, numbered section annotations (`01 —`), mono uppercase controls |
| **Brutalism × Electric** (`brutal`) | 2–3 px black/white borders, hard offset shadows, uppercase heavy display type, grid background, solid accent highlights |

Selection: student web → Settings › Visual style (stored with the existing preferences); admin → sidebar selector (browser-local). A tiny inline script applies the saved style before first paint. The mobile app uses the shared tokens (new accent) but has no style selector yet.

## Typography

| Role | Font | Notes |
|---|---|---|
| Latin UI | Inter (variable) | Self-hosted via `@fontsource` (no third-party font requests) |
| Arabic script (Sorani, Arabic) | Noto Sans Arabic 400/600/700 | Covers Sorani letters ە ڕ ڵ ۆ ێ ڤ; loaded only when Arabic-script text appears (`unicode-range`) |
| Codes, metadata, labels | IBM Plex Mono | Room numbers, times, uppercase labels |
| Editorial display | Instrument Serif | Headings in the Editorial style only (Latin; Arabic script falls back to Noto Sans Arabic) |

In RTL, letter-spacing is forced to 0 (Arabic script is cursive) and monospace labels fall back to Noto Sans Arabic.

Scale (px): 12, 14, 16, 18, 22, 28, 36, 48. Line height 1.15 / 1.3 / 1.5 (1.7 for Arabic body text).

## Spacing, size, motion

- 4-pt spacing scale (`space[1..16]`).
- Minimum touch target 44 px (all buttons, rows, map controls).
- Motion 120/200/320 ms; only for state changes and the route dash animation; disabled under `prefers-reduced-motion`.

## Components

Web (`apps/*/components/ui.tsx`): Button / ButtonLink (primary, secondary, ghost, danger), Badge (neutral, accent, warn, danger, info), Section, Row, PageTitle, Notice, EmptyState, ErrorState, Spinner (loading), Toggle, Code. Mobile (`apps/mobile/src/ui.tsx`): equivalents with RTL-aware rows and text.

Map: `FloorMap` (web) and `NativeFloorMap` (mobile) — room fills by type, selected room in accent-soft with accent outline, dashed animated route, square checkpoint markers in info blue, accent triangle destination pin, pulsing "you are here".

States are designed for every async view: loading (status text + accent pulse), empty (dashed box with next action), error (danger border + retry), success (toast or accent card), offline (info banner with sync date).

## Icons

Inline 24-px stroke icons (1.75 px, square caps) defined in-place — no icon font, no extra dependency.

## Accessibility

Keyboard-operable map (rooms are focusable buttons with labels), skip link, `aria-current` navigation, live regions for search results/scan results/arrival, visible focus rings in accent, labelled form controls, colour never the only signal (badges carry text).
