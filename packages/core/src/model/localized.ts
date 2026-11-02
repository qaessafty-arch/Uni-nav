import type { Locale, LocalizedText } from "./types";

/** Pick the best text for a locale, falling back to Sorani↔Arabic, then English. */
export function lt(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const direct = text[locale];
  if (direct && direct.trim()) return direct;
  return text.en;
}

/** True if the text has a real translation for the locale (not a fallback). */
export function hasTranslation(text: LocalizedText | null | undefined, locale: Locale): boolean {
  return !!text?.[locale]?.trim();
}

export function allTranslations(text: LocalizedText | null | undefined): string[] {
  if (!text) return [];
  return [text.en, text.ckb, text.ar].filter((s): s is string => !!s && !!s.trim());
}
