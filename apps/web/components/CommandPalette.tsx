"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { search, type CampusBundle, type SearchIndex } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { resultHref, useResultText } from "./SearchBox";
import { Badge } from "./ui";
import { Icon } from "./Icon";
import { I } from "./icons";
import type { MessageKey } from "@campusnav/i18n";

export interface PageLink {
  href: string;
  key: MessageKey;
  icon: string;
}

/** Global search (Ctrl/⌘+K or "/"): campus data results first, then app pages. */
export function CommandPalette({ open, onClose, bundle, index, pages }: { open: boolean; onClose: () => void; bundle: CampusBundle | null; index: SearchIndex | null; pages: PageLink[] }) {
  const { t } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const text = useResultText(bundle ?? ({ rooms: [], buildings: [], floors: [], navNodes: [], lecturers: [], courses: [], departments: [], groups: [], checkpoints: [] } as unknown as CampusBundle));

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo(() => {
    const data = index && q.trim() ? search(index, q, { limit: 8 }) : [];
    const needle = q.trim().toLowerCase();
    const pageHits = pages.filter((p) => !needle || t(p.key).toLowerCase().includes(needle));
    return [
      ...data.map((r) => ({ kind: "data" as const, href: resultHref(r), r })),
      ...pageHits.map((p) => ({ kind: "page" as const, href: p.href, p })),
    ];
  }, [index, q, pages, t]);

  if (!open) return null;
  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <>
      <div className="cn-overlay" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={t("common.search")} className="cn-dialog">
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Icon d={I.search} className="text-muted" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            aria-label={t("shell.searchHint")}
            placeholder={t("shell.searchHint")}
            className="flex-1 bg-transparent min-h-14 outline-none text-base"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const it = items[active];
                if (it) go(it.href);
                else if (q.trim()) go(`/search?q=${encodeURIComponent(q)}`);
              } else if (e.key === "Escape") onClose();
            }}
          />
          <span className="cn-kbd">Esc</span>
        </div>
        <ul id={listId} role="listbox" aria-label={t("palette.results")} className="overflow-y-auto py-2">
          {items.length === 0 ? <li className="px-4 py-6 text-center text-muted text-sm">{t("palette.empty")}</li> : null}
          {items.map((it, i) => {
            const first = i === 0 || items[i - 1]!.kind !== it.kind;
            const head = first ? <li role="presentation" className="side-label cn-side-label !px-4 pt-2">{it.kind === "data" ? t("palette.results") : t("palette.pages")}</li> : null;
            if (it.kind === "data") {
              const { title, subtitle } = text(it.r);
              return (
                <FragmentRow key={`d-${it.r.type}-${it.r.id}`} head={head}>
                  <li id={`${listId}-${i}`} role="option" aria-selected={i === active} className="cn-option cursor-pointer" onMouseEnter={() => setActive(i)} onClick={() => go(it.href)}>
                    <Badge className="shrink-0">{t(`search.type.${it.r.type}`)}</Badge>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium truncate">{title}</span>
                      {subtitle ? <span className="block text-xs text-muted truncate">{subtitle}</span> : null}
                    </span>
                  </li>
                </FragmentRow>
              );
            }
            return (
              <FragmentRow key={`p-${it.p.href}`} head={head}>
                <li id={`${listId}-${i}`} role="option" aria-selected={i === active} className="cn-option cursor-pointer" onMouseEnter={() => setActive(i)} onClick={() => go(it.href)}>
                  <Icon d={it.p.icon} className="text-muted" />
                  <span className="flex-1">{t(it.p.key)}</span>
                </li>
              </FragmentRow>
            );
          })}
        </ul>
        <div className="border-t border-line px-4 py-2 text-xs text-faint mono">{t("palette.hint")}</div>
      </div>
    </>
  );
}

function FragmentRow({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {head}
      {children}
    </>
  );
}
