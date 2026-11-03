import type { ClockTime, ISODate } from "../model/types";
import { addDays, toMinutes, zonedNow, zonedToInstant } from "./time";

/**
 * Offline prayer-time calculation from the sun's position (standard
 * astronomical formulas: solar declination and equation of time, then the hour
 * angle at which the sun reaches each twilight / shadow condition).
 *
 * Results depend on the convention a mosque follows, so the university picks
 * the method and Asr school; the app always labels times as calculated.
 */

export type PrayerName = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export const PRAYERS: readonly Exclude<PrayerName, "sunrise">[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export type PrayerMethod = "mwl" | "egypt" | "karachi" | "umm_al_qura" | "isna";
export const PRAYER_METHODS: readonly PrayerMethod[] = ["mwl", "egypt", "karachi", "umm_al_qura", "isna"];

/** Fajr / Isha sun depression angles; Umm al-Qura uses a fixed Isha delay after Maghrib. */
const METHOD_PARAMS: Record<PrayerMethod, { fajr: number; isha: number | { minutesAfterMaghrib: number } }> = {
  mwl: { fajr: 18, isha: 17 }, // Muslim World League
  egypt: { fajr: 19.5, isha: 17.5 }, // Egyptian General Authority of Survey
  karachi: { fajr: 18, isha: 18 }, // University of Islamic Sciences, Karachi
  umm_al_qura: { fajr: 18.5, isha: { minutesAfterMaghrib: 90 } },
  isna: { fajr: 15, isha: 15 }, // Islamic Society of North America
};

export interface PrayerOptions {
  method?: PrayerMethod;
  /** "standard" = shadow factor 1 (Shafi'i, Maliki, Hanbali); "hanafi" = factor 2. */
  asr?: "standard" | "hanafi";
  /** Minutes added after sunset for Maghrib (precaution). */
  maghribOffsetMin?: number;
}

export interface PrayerSettings extends PrayerOptions {
  enabled?: boolean;
}

/** Kurdistan defaults: most Kurdish Muslims follow the Shafi'i school (Asr factor 1). */
export const DEFAULT_PRAYER: Required<PrayerOptions> = { method: "mwl", asr: "standard", maghribOffsetMin: 0 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => a - b * Math.floor(a / b);

function julian(date: ISODate): number {
  let [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/** Declination (deg) and equation of time (hours) for a Julian day. */
function sun(jd: number): { decl: number; eqt: number } {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  const eqt = q / 15 - RA;
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))));
  return { decl, eqt: eqt - 24 * Math.round(eqt / 24) };
}

/**
 * Prayer times on `date` at a location, as local clock times in `timeZone`.
 * Returns null for a time that does not occur (extreme latitudes).
 */
export function prayerTimes(date: ISODate, lat: number, lng: number, timeZone: string, options: PrayerOptions = {}): Record<PrayerName, ClockTime | null> {
  // Unset settings arrive as explicit undefined/null: keep the defaults for those.
  const o: Required<PrayerOptions> = {
    method: options.method && options.method in METHOD_PARAMS ? options.method : DEFAULT_PRAYER.method,
    asr: options.asr ?? DEFAULT_PRAYER.asr,
    maghribOffsetMin: options.maghribOffsetMin ?? DEFAULT_PRAYER.maghribOffsetMin,
  };
  const p = METHOD_PARAMS[o.method];
  const jd = julian(date) - lng / (15 * 24);
  // UTC offset of the zone on that date (hours), from the zone database.
  const noonUtc = zonedToInstant(date, "12:00", timeZone);
  const tz = 12 - (noonUtc.getUTCHours() + noonUtc.getUTCMinutes() / 60);

  const midDay = (t: number) => fix(12 - sun(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, before: boolean): number | null => {
    const { decl } = sun(jd + t);
    const c = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    if (c < -1 || c > 1) return null;
    const h = deg(Math.acos(c)) / 15;
    return midDay(t) + (before ? -h : h);
  };
  const asrTime = (factor: number, t: number) => {
    const { decl } = sun(jd + t);
    const angle = -deg(Math.atan(1 / (factor + Math.tan(rad(Math.abs(lat - decl))))));
    return angleTime(angle, t, false);
  };

  // Two passes: first with rough guesses, then refined at each event's own time.
  let g = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let pass = 0; pass < 2; pass++) {
    const t = (h: number | null) => (h ?? 12) / 24;
    g = {
      fajr: angleTime(p.fajr, t(g.fajr), true) ?? NaN,
      sunrise: angleTime(0.833, t(g.sunrise), true) ?? NaN,
      dhuhr: midDay(t(g.dhuhr)),
      asr: asrTime(o.asr === "hanafi" ? 2 : 1, t(g.asr)) ?? NaN,
      sunset: angleTime(0.833, t(g.sunset), false) ?? NaN,
      isha: typeof p.isha === "number" ? angleTime(p.isha, t(g.isha), false) ?? NaN : NaN,
    };
  }
  const local = (h: number) => (Number.isFinite(h) ? h + tz - lng / 15 : NaN);
  const clock = (h: number): ClockTime | null => {
    if (!Number.isFinite(h)) return null;
    const m = Math.round(fix(h, 24) * 60) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const maghrib = local(g.sunset) + o.maghribOffsetMin / 60;
  const isha = typeof p.isha === "number" ? local(g.isha) : maghrib + p.isha.minutesAfterMaghrib / 60;
  return {
    fajr: clock(local(g.fajr)),
    sunrise: clock(local(g.sunrise)),
    dhuhr: clock(local(g.dhuhr)),
    asr: clock(local(g.asr)),
    maghrib: clock(maghrib),
    isha: clock(isha),
  };
}

export interface NextPrayer {
  name: Exclude<PrayerName, "sunrise">;
  date: ISODate;
  time: ClockTime;
  secondsUntil: number;
}

/** The next of the five prayers after `now` (looks into tomorrow after Isha). */
export function nextPrayer(now: Date, lat: number, lng: number, timeZone: string, options: PrayerOptions = {}): NextPrayer | null {
  const z = zonedNow(now, timeZone);
  for (const date of [z.date, addDays(z.date, 1)]) {
    const times = prayerTimes(date, lat, lng, timeZone, options);
    for (const name of PRAYERS) {
      const time = times[name];
      if (!time) continue;
      if (date === z.date && toMinutes(time) <= z.minutes) continue;
      return { name, date, time, secondsUntil: Math.round((zonedToInstant(date, time, timeZone).getTime() - now.getTime()) / 1000) };
    }
  }
  return null;
}

// ───────────────────────── Hijri calendar / Ramadan ─────────────────────────

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Hijri date via the Umm al-Qura calendar built into Intl. Local moon-sighting
 * announcements in Kurdistan can differ by a day, so treat this as approximate.
 */
export function hijriDate(now: Date, timeZone: string): HijriDate | null {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value.replace(/\D/g, ""));
    const r = { year: get("year"), month: get("month"), day: get("day") };
    return r.year && r.month && r.day ? r : null;
  } catch {
    return null;
  }
}

export const isRamadan = (h: HijriDate | null) => h?.month === 9;
