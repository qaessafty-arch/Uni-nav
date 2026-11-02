"use client";
import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { lt, search, type CampusBundle, type SearchIndex, type SearchResult } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { Badge } from "./ui";

export function resultHref(r: SearchResult): string {
  switch (r.type) {
    case "room":
      return `/rooms/${r.id}`;
    case "lecturer":
      return `/lecturers/${r.id}`;
    case "building":
      return `/buildings/${r.id}`;
    case "course":
      return `/courses/${r.id}`;
    case "department":
      return `/lecturers?dept=${r.id}`;
  }
}

export function useResultText(bundle: CampusBundle) {
  const { prefs, t } = useApp();
  const l = lookup(bundle);
  return (r: SearchResult): { title: string; subtitle: string } => {
    const loc = prefs.locale;
    switch (r.type) {
      case "room": {
        const b = l.buildings.get(r.item.buildingId);
        const f = l.floors.get(r.item.floorId);
        return { title: `${r.item.code} · ${lt(r.item.name, loc)}`, subtitle: [lt(b?.name, loc), lt(f?.name, loc)].filter(Boolean).join(" · ") };
      }
      case "lecturer":
        return { title: lt(r.item.fullName, loc), subtitle: lt(r.item.departmentId ? l.departments.get(r.item.departmentId)?.name : null, loc) };
      case "building":
        return { title: lt(r.item.name, loc), subtitle: r.item.code };
      case "department":
        return { title: lt(r.item.name, loc), subtitle: lt(r.item.college, loc) };
      case "course":
        return { title: `${r.item.code} · ${lt(r.item.name, loc)}`, subtitle: t("search.type.course") };
    }
  };
}

export function SearchBox({ bundle, index, autoFocus, initial = "" }: { bundle: CampusBundle; index: SearchIndex; autoFocus?: boolean; initial?: string }) {
  const { t } = useApp();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => (q.trim() ? search(index, q, { limit: 8 }) : []), [index, q]);
  const text = useResultText(bundle);

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const r = results[active];
          if (r) router.push(resultHref(r));
          else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q)}`);
        }}
      >
        <label className="sr-only" htmlFor={`${listId}-input`}>
          {t("common.search")}
        </label>
        <div className="cn-input flex items-center !px-0">
          <svg viewBox="0 0 24 24" className="size-5 ms-3 text-muted shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="10" cy="10" r="6" />
            <path d="M15 15l5 5" />
          </svg>
          <input
            id={`${listId}-input`}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={autoFocus}
            value={q}
            maxLength={120}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
            }}
            placeholder={t("home.searchPlaceholder")}
            className="w-full bg-transparent px-3 h-14 text-lg outline-none placeholder:text-faint"
          />
        </div>
      </form>
      {q.trim() ? (
        <ul id={listId} role="listbox" className="cn-card !bg-raised !p-0 absolute z-20 inset-x-0 mt-2 max-h-[60vh] overflow-auto shadow-2xl">
          {results.length === 0 ? (
            <li className="p-4 text-muted text-sm">{t("search.noResults", { q })}</li>
          ) : (
            results.map((r, i) => {
              const { title, subtitle } = text(r);
              return (
                <li key={`${r.type}-${r.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => router.push(resultHref(r))}
                    className={`w-full text-start flex items-center gap-3 px-4 py-3 min-h-14 border-b border-line ${i === active ? "bg-sunken" : ""}`}
                  >
                    <Badge>{t(`search.type.${r.type}`)}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{title}</span>
                      {subtitle ? <span className="block truncate text-sm text-muted">{subtitle}</span> : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
