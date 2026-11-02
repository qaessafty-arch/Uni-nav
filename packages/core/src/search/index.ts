import { allTranslations } from "../model/localized";
import type { Building, CampusBundle, Course, Department, Lecturer, LocalizedText, Room } from "../model/types";
import { normalizeSearch, tokens } from "./normalize";

export { normalizeSearch, tokens };

export type SearchResult =
  | { type: "room"; id: string; score: number; item: Room }
  | { type: "lecturer"; id: string; score: number; item: Lecturer }
  | { type: "building"; id: string; score: number; item: Building }
  | { type: "department"; id: string; score: number; item: Department }
  | { type: "course"; id: string; score: number; item: Course };

interface Doc {
  type: SearchResult["type"];
  id: string;
  item: SearchResult["item"];
  /** Normalized searchable strings, most important first. */
  fields: string[];
}

function lt(t: LocalizedText | null | undefined): string[] {
  return allTranslations(t).map(normalizeSearch);
}

export interface SearchIndex {
  docs: Doc[];
}

export function buildSearchIndex(bundle: CampusBundle): SearchIndex {
  const buildingById = new Map(bundle.buildings.map((b) => [b.id, b]));
  const deptById = new Map(bundle.departments.map((d) => [d.id, d]));
  const docs: Doc[] = [];
  for (const r of bundle.rooms) {
    const b = buildingById.get(r.buildingId);
    docs.push({
      type: "room",
      id: r.id,
      item: r,
      fields: [
        normalizeSearch(r.code),
        b ? normalizeSearch(`${b.code} ${r.code}`) : "",
        ...lt(r.name),
        ...(r.departmentId ? lt(deptById.get(r.departmentId)?.name) : []),
        normalizeSearch(r.type.replace("_", " ")),
      ].filter(Boolean),
    });
  }
  for (const l of bundle.lecturers) {
    docs.push({
      type: "lecturer",
      id: l.id,
      item: l,
      fields: [...lt(l.fullName), ...(l.departmentId ? lt(deptById.get(l.departmentId)?.name) : [])],
    });
  }
  for (const b of bundle.buildings) docs.push({ type: "building", id: b.id, item: b, fields: [normalizeSearch(b.code), ...lt(b.name)] });
  for (const d of bundle.departments) docs.push({ type: "department", id: d.id, item: d, fields: [normalizeSearch(d.code), ...lt(d.name), ...lt(d.college)] });
  for (const c of bundle.courses) docs.push({ type: "course", id: c.id, item: c, fields: [normalizeSearch(c.code), ...lt(c.name)] });
  return { docs };
}

const TYPE_BOOST: Record<SearchResult["type"], number> = { room: 1.15, lecturer: 1.1, building: 1, department: 0.95, course: 0.9 };

/**
 * Token-based ranking: exact field match > prefix > substring. Every query token
 * must match something (AND semantics), so "204 eng" narrows rather than widens.
 */
export function search(index: SearchIndex, query: string, opts: { limit?: number; types?: SearchResult["type"][] } = {}): SearchResult[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const qTokens = tokens(query);
  const effective = qTokens.length ? qTokens : [q];
  const results: SearchResult[] = [];
  for (const doc of index.docs) {
    if (opts.types && !opts.types.includes(doc.type)) continue;
    let total = 0;
    let allMatched = true;
    for (const t of effective) {
      let best = 0;
      doc.fields.forEach((f, i) => {
        const weight = 1 / (1 + i * 0.15);
        let s = 0;
        if (f === t || f === q) s = 10;
        else if (f.startsWith(t)) s = 6;
        else if (f.split(" ").some((w) => w === t)) s = 7;
        else if (f.split(" ").some((w) => w.startsWith(t))) s = 5;
        else if (t.length >= 2 && f.includes(t)) s = 2;
        best = Math.max(best, s * weight);
      });
      if (best === 0) {
        allMatched = false;
        break;
      }
      total += best;
    }
    if (!allMatched) continue;
    results.push({ type: doc.type, id: doc.id, item: doc.item, score: total * TYPE_BOOST[doc.type] } as SearchResult);
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, opts.limit ?? 20);
}
