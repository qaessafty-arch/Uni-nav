import type { ClockTime, OpeningHours, UniversitySettings, HomeFeature, Weekday } from "../model/types";
import { addDays, toMinutes, weekdayOf, zonedNow } from "./time";

export type OpenStatus =
  | { open: true; closesAt: ClockTime; closingSoon: boolean }
  | { open: false; opensAt: ClockTime | null; opensDay: Weekday | null; opensToday: boolean };

const day = (d: Weekday, h: OpeningHours) => [...(h[String(d) as keyof OpeningHours] ?? [])].sort((a, b) => a[0].localeCompare(b[0]));

/**
 * Whether a building is open at `now` (university time zone), when it closes,
 * or when it next opens (looking a week ahead). Null when no hours are
 * published — the UI must then say nothing rather than guess.
 */
export function openStatus(hours: OpeningHours | null | undefined, now: Date, timeZone: string, soonMinutes = 30): OpenStatus | null {
  if (!hours || !Object.values(hours).some((v) => v && v.length)) return null;
  const z = zonedNow(now, timeZone);
  const today = weekdayOf(z.date);
  for (const [a, b] of day(today, hours)) {
    if (toMinutes(a) <= z.minutes && z.minutes < toMinutes(b)) return { open: true, closesAt: b, closingSoon: toMinutes(b) - z.minutes <= soonMinutes };
  }
  const later = day(today, hours).find(([a]) => toMinutes(a) > z.minutes);
  if (later) return { open: false, opensAt: later[0], opensDay: today, opensToday: true };
  for (let i = 1; i <= 7; i++) {
    const d = weekdayOf(addDays(z.date, i));
    const first = day(d, hours)[0];
    if (first) return { open: false, opensAt: first[0], opensDay: d, opensToday: false };
  }
  return { open: false, opensAt: null, opensDay: null, opensToday: false };
}

/** Home features are on unless the university switched them off. */
export function featureOn(settings: Pick<UniversitySettings, "features">, f: HomeFeature): boolean {
  return settings.features?.[f] !== false;
}

// ───────────────────────── Colour contrast (WCAG 2.x) ─────────────────────────

function lum(hex: string): number {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

/** Contrast ratio between two "#RRGGBB" colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** True when white text/icons on `hex` meet WCAG AA for normal text (4.5:1). */
export const readableWithWhite = (hex: string) => /^#[0-9a-fA-F]{6}$/.test(hex) && contrastRatio(hex, "#FFFFFF") >= 4.5;
