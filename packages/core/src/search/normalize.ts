/**
 * Unicode-safe normalization for multilingual search (English, Kurdish Sorani, Arabic).
 *
 * - NFKC + case folding
 * - Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits → ASCII
 * - Strip Arabic diacritics (harakat), tatweel, zero-width joiners
 * - Unify letter variants that users type interchangeably:
 *     أ إ آ ٱ → ا,  ي ى → ی,  ك → ک,  ة → ه,  ۀ → ه
 *   Sorani-specific letters (ە ڕ ڵ ۆ ێ ڤ گ چ پ ژ) are preserved because they are distinct.
 */
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
const TATWEEL_ZW = /[ـ​-‏‪-‮⁦-⁩﻿]/g;

const MAP: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ٱ": "ا",
  "ي": "ی",
  "ى": "ی",
  "ك": "ک",
  "ة": "ه",
  "ۀ": "ه",
  "ؤ": "و",
};

export function normalizeSearch(input: string): string {
  let s = input.normalize("NFKC").toLowerCase();
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(DIACRITICS, "").replace(TATWEEL_ZW, "");
  s = s.replace(/[أإآٱيىكةۀؤ]/g, (c) => MAP[c] ?? c);
  // Collapse punctuation/separators to single spaces
  s = s.replace(/[\s\-_.,،؛:;/\\|()[\]{}"'`]+/g, " ").trim();
  return s;
}

/** Remove common prefixes so "Dr. Ahmed" matches "ahmed" and "Room 204" matches "204". */
const STOP = new Set(["dr", "prof", "mr", "mrs", "ms", "room", "د", "دکتۆر", "دکتور", "پ", "ژووری", "ژوور", "قاعة", "غرفة", "the", "al"]);
export function tokens(input: string): string[] {
  return normalizeSearch(input)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}
