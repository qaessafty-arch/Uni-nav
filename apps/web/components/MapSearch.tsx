"use client";
import { useId, useMemo, useState } from "react";
import { search, type CampusBundle, type SearchIndex, type SearchResult } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { useResultText } from "./SearchBox";
import { Badge } from "./ui";
import { Icon } from "./Icon";
import { I } from "./icons";

/** Highlights the matched part of a result title (case-insensitive, first match). */
function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  const i = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent text-accent font-semibold">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

/** Search box that selects results in place (the map focuses them) instead of leaving the page. */
export function MapSearch({ bundle, index, onPick }: { bundle: CampusBundle; index: SearchIndex; onPick: (r: SearchResult) => void }) {
  const { t } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const results = useMemo(() => (q.trim() ? search(index, q, { limit: 8 }) : []), [index, q]);
  const text = useResultText(bundle);
  const pick = (r: SearchResult) => {
    onPick(r);
    setOpen(false);
    setQ("");
  };
  return (
    <div className="relative">
      <div className="cn-input flex items-center !px-0 !min-h-12">
        <Icon d={I.search} className="ms-3 text-muted" />
        <label className="sr-only" htmlFor={`${id}-in`}>
          {t("common.search")}
        </label>
        <input
          id={`${id}-in`}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t("home.searchPlaceholder")}
          className="flex-1 bg-transparent min-h-12 px-3 outline-none min-w-0"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (results[active]) pick(results[active]!);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        {q ? (
          <button type="button" className="p-2.5 text-muted hover:text-fg" aria-label={t("common.close")} onClick={() => setQ("")}>
            <Icon d={I.close} className="size-4" />
          </button>
        ) : null}
      </div>
      {open && q.trim() ? (
        <ul id={`${id}-list`} role="listbox" aria-label={t("palette.results")} className="absolute z-30 mt-1 w-full cn-panel overflow-hidden py-1 max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? <li className="px-4 py-3 text-sm text-muted">{t("palette.empty")}</li> : null}
          {results.map((r, i) => {
            const { title, subtitle } = text(r);
            return (
              <li
                key={`${r.type}-${r.id}`}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                className="cn-option cursor-pointer !min-h-12"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
              >
                <Badge className="shrink-0">{t(`search.type.${r.type}`)}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium truncate">
                    <Highlight text={title} q={q} />
                  </span>
                  {subtitle ? <span className="block text-xs text-muted truncate">{subtitle}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
