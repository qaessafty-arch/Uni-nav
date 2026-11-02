import type { CampusBundle, Locale } from "../model/types";
import { buildSearchIndex, search, type SearchResult } from "../search";

/**
 * AI campus assistant — provider-agnostic module boundary.
 *
 * The assistant NEVER answers from model knowledge. It turns a question into a
 * structured intent, executes that intent against the campus bundle (the source
 * of truth), and returns structured results with navigation actions.
 *
 * `RuleBasedIntentParser` works offline with no provider. An LLM-backed parser
 * can implement `IntentParser` later; its output is still only an intent, so it
 * cannot fabricate rooms, lecturers or routes, nor bypass backend authorization
 * (the bundle only contains data the user's session may read).
 */

export type AssistantIntent =
  | { type: "find_room"; query: string }
  | { type: "find_lecturer"; query: string }
  | { type: "find_place"; query: string }
  | { type: "next_lecture" }
  | { type: "timetable_day"; offsetDays: number }
  | { type: "navigate"; query: string }
  | { type: "unknown"; query: string };

export interface IntentParser {
  parse(question: string, locale: Locale): Promise<AssistantIntent> | AssistantIntent;
}

const PATTERNS: [RegExp, (m: RegExpExecArray) => AssistantIntent][] = [
  [/(next lecture|my next|وانەی داهاتوو|المحاضرة القادمة)/i, () => ({ type: "next_lecture" })],
  [/(tomorrow|سبەی|غدا|غداً)/i, () => ({ type: "timetable_day", offsetDays: 1 })],
  [/(today|ئەمڕۆ|اليوم)/i, () => ({ type: "timetable_day", offsetDays: 0 })],
  [/(?:how (?:do i|can i) (?:reach|get to|find)|navigate to|take me to|چۆن بگەمە|كيف أصل إلى|كيف اصل الى)\s+(.+)/i, (m) => ({ type: "navigate", query: m[1]! })],
  [/(?:where is|find)\s+(?:dr\.?|prof\.?|doctor)\s*(.+?)(?:'s office| office)?\??$/i, (m) => ({ type: "find_lecturer", query: m[1]! })],
  [/(?:where is|find|locate)\s+(?:room\s+)?(.+?)\??$/i, (m) => ({ type: "find_place", query: m[1]! })],
  [/(?:لە کوێیە|کوا)\s*(.+)|(.+)\s*(?:لە کوێیە)/i, (m) => ({ type: "find_place", query: (m[1] ?? m[2] ?? "").trim() })],
  [/(?:أين|اين)\s+(.+?)[؟?]?$/i, (m) => ({ type: "find_place", query: m[1]! })],
];

export class RuleBasedIntentParser implements IntentParser {
  parse(question: string): AssistantIntent {
    const q = question.trim();
    for (const [re, build] of PATTERNS) {
      const m = re.exec(q);
      if (m) return build(m);
    }
    return { type: "unknown", query: q };
  }
}

export type AssistantAnswer =
  | { kind: "results"; intent: AssistantIntent; results: SearchResult[] }
  | { kind: "clarify"; intent: AssistantIntent; options: SearchResult[] }
  | { kind: "timetable"; intent: AssistantIntent }
  | { kind: "not_found"; intent: AssistantIntent }
  | { kind: "unsupported"; intent: AssistantIntent };

export function executeIntent(intent: AssistantIntent, bundle: CampusBundle): AssistantAnswer {
  if (intent.type === "next_lecture" || intent.type === "timetable_day") return { kind: "timetable", intent };
  if (intent.type === "unknown") {
    const results = search(buildSearchIndex(bundle), intent.query, { limit: 5 });
    return results.length ? { kind: "results", intent, results } : { kind: "unsupported", intent };
  }
  const types: SearchResult["type"][] | undefined =
    intent.type === "find_lecturer" ? ["lecturer"] : intent.type === "find_room" ? ["room"] : undefined;
  const results = search(buildSearchIndex(bundle), intent.query, { limit: 5, types });
  if (!results.length) return { kind: "not_found", intent };
  const top = results[0]!;
  const second = results[1];
  if (second && second.score >= top.score * 0.9) return { kind: "clarify", intent, options: results };
  return { kind: "results", intent, results };
}
