import type { Locale, RouteStep, LocalizedText, Floor } from "@campusnav/core";
import { lt } from "@campusnav/core";
import { ar } from "./locales/ar";
import { ckb } from "./locales/ckb";
import { en, type MessageKey } from "./locales/en";

export type { MessageKey };
export const messages: Record<Locale, Record<MessageKey, string>> = { en, ckb, ar };

export const RTL_LOCALES: readonly Locale[] = ["ckb", "ar"];
export function dir(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "ckb" || v === "ar";
}

/** BCP-47 tag for Intl. Sorani is "ckb"; Intl falls back gracefully where ICU lacks data. */
export function intlTag(locale: Locale): string {
  return locale === "ckb" ? "ckb-IQ" : locale === "ar" ? "ar-IQ" : "en-GB";
}

export type Params = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const template = messages[locale][key] ?? messages.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] != null ? formatParam(locale, params[k]!) : `{${k}}`));
}

function formatParam(locale: Locale, v: string | number): string {
  return typeof v === "number" ? formatNumber(locale, v) : v;
}

/**
 * Some runtimes (notably Chromium's reduced ICU and Hermes) lack Sorani locale
 * data and silently fall back to English. Detect that and format manually.
 */
const ICU_HAS_CKB = (() => {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(["ckb"]).length > 0 && Intl.NumberFormat.supportedLocalesOf(["ckb"]).length > 0;
  } catch {
    return false;
  }
})();
const CKB_MONTHS = ["کانوونی دووەم", "شوبات", "ئازار", "نیسان", "ئایار", "حوزەیران", "تەمموز", "ئاب", "ئەیلوول", "تشرینی یەکەم", "تشرینی دووەم", "کانوونی یەکەم"];
const toArabicIndic = (s: string) => s.replace(/[0-9]/g, (d) => String.fromCharCode(0x0660 + Number(d)));

export function formatNumber(locale: Locale, n: number, opts?: Intl.NumberFormatOptions): string {
  if (locale === "ckb" && !ICU_HAS_CKB) return toArabicIndic(new Intl.NumberFormat("en", { ...opts, useGrouping: false }).format(n));
  try {
    return new Intl.NumberFormat(intlTag(locale), opts).format(n);
  } catch {
    return new Intl.NumberFormat("en", opts).format(n);
  }
}

/** Format a university-local wall-clock time "HH:MM" without shifting zones. */
export function formatClock(locale: Locale, hhmm: string): string {
  if (locale === "ckb" && !ICU_HAS_CKB) return toArabicIndic(hhmm);
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  try {
    return new Intl.DateTimeFormat(intlTag(locale), { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hourCycle: "h23" }).format(d);
  } catch {
    return hhmm;
  }
}

/** Format a calendar date "YYYY-MM-DD". */
export function formatDate(locale: Locale, iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (locale === "ckb" && !ICU_HAS_CKB) {
    const parts: string[] = [];
    if (opts.weekday) parts.push(messages.ckb[`day.${d.getUTCDay()}` as MessageKey]);
    const dm = [opts.day ? `${toArabicIndic(String(d.getUTCDate()))}ی` : "", opts.month ? CKB_MONTHS[d.getUTCMonth()] : "", opts.year ? toArabicIndic(String(d.getUTCFullYear())) : ""].filter(Boolean).join(" ");
    if (dm) parts.push(dm);
    return parts.join("، ");
  }
  try {
    return new Intl.DateTimeFormat(intlTag(locale), { ...opts, timeZone: "UTC" }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/** Format an instant in the university's time zone. */
export function formatInstant(locale: Locale, isoInstant: string, timeZone: string): string {
  if (locale === "ckb" && !ICU_HAS_CKB) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(isoInstant)).map((p) => [p.type, p.value]));
    return `${formatDate("ckb", `${parts.year}-${parts.month}-${parts.day}`, { day: "numeric", month: "long", year: "numeric" })} ${toArabicIndic(`${parts.hour}:${parts.minute}`)}`;
  }
  try {
    return new Intl.DateTimeFormat(intlTag(locale), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(isoInstant));
  } catch {
    return isoInstant;
  }
}

export function formatDistance(locale: Locale, meters: number): string {
  const rounded = meters < 10 ? Math.round(meters) : Math.round(meters / 5) * 5;
  return translate(locale, "common.meters", { n: rounded });
}

export function formatDuration(locale: Locale, seconds: number): string {
  return translate(locale, "common.minutes", { n: Math.max(1, Math.round(seconds / 60)) });
}

export function formatCountdownText(locale: Locale, seconds: number): string {
  const s = Math.max(0, seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${formatNumber(locale, d)}${locale === "en" ? "d" : locale === "ar" ? " يوم" : " ڕۆژ"}`);
  if (h) parts.push(`${formatNumber(locale, h)}${locale === "en" ? "h" : locale === "ar" ? " س" : " ک"}`);
  if (!d) parts.push(`${formatNumber(locale, m)}${locale === "en" ? "m" : locale === "ar" ? " د" : " خ"}`);
  return parts.join(" ");
}

/** Render a navigation step as a sentence in the given locale. */
export function describeStep(locale: Locale, step: RouteStep, floors: Map<string, Floor>, fallbackLandmark?: LocalizedText | null): string {
  const landmark = lt(step.landmark ?? fallbackLandmark ?? null, locale) || translate(locale, "map.destination");
  const floor = step.toFloorId ? lt(floors.get(step.toFloorId)?.name, locale) : "";
  const distance = formatDistance(locale, step.distanceM);
  if (step.kind === "straight" && step.landmark) return translate(locale, "step.straightTo", { distance, landmark });
  return translate(locale, `step.${step.kind}` as MessageKey, { distance, landmark, floor });
}
