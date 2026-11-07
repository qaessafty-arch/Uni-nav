"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { lt, startCandidates, type CampusBundle, type NavNode } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { lookup, type Lookup } from "@/lib/lookup";
import { Button, ButtonLink } from "./ui";
import { Icon } from "./Icon";
import { I } from "./icons";

export function nodeName(n: NavNode, l: Lookup, loc: Parameters<typeof lt>[1]): string {
  const room = l.roomByEntrance.get(n.id);
  if (room) return `${room.code} · ${lt(room.name, loc)}`;
  return lt(n.label, loc) || `${lt(l.floors.get(n.floorId)?.name, loc)}`;
}

/** "Where are you now?" — scan a QR sign or choose a known place. */
export function StartPicker({ bundle, onPick, returnTo, compact }: { bundle: CampusBundle; onPick: (nodeId: string) => void; returnTo: string; compact?: boolean }) {
  const { t, prefs } = useApp();
  const l = lookup(bundle);
  const loc = prefs.locale;
  const [value, setValue] = useState("");
  const groups = useMemo(() => {
    const byBuilding = new Map<string, NavNode[]>();
    for (const n of startCandidates(bundle)) {
      const key = l.floors.get(n.floorId)?.buildingId ?? "";
      byBuilding.set(key, [...(byBuilding.get(key) ?? []), n]);
    }
    return [...byBuilding.entries()].map(([bid, nodes]) => ({
      building: l.buildings.get(bid),
      nodes: nodes.sort((a, z) => (l.floors.get(a.floorId)?.level ?? 0) - (l.floors.get(z.floorId)?.level ?? 0) || nodeName(a, l, loc).localeCompare(nodeName(z, l, loc), undefined, { numeric: true })),
    }));
  }, [bundle, l, loc]);

  return (
    <div className={compact ? "" : "cn-panel p-5 md:p-6"}>
      {compact ? null : (
        <>
          <h2 className="text-xl font-semibold">{t("navigate.chooseStart")}</h2>
          <p className="text-muted text-sm mt-1">{t("navigate.chooseStartHint")}</p>
        </>
      )}
      <ButtonLink href={`/scan?then=${encodeURIComponent(returnTo)}`} variant="primary" className={compact ? "w-full" : "mt-4"}>
        <Icon d={I.scan} /> {t("navigate.scanToStart")}
      </ButtonLink>
      <form
        className="mt-4 flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onPick(value);
        }}
      >
        <label className="sr-only" htmlFor={compact ? "start-select-dialog" : "start-select"}>
          {t("navigate.pickStart")}
        </label>
        <select id={compact ? "start-select-dialog" : "start-select"} value={value} onChange={(e) => setValue(e.target.value)} className="cn-input min-h-11 flex-1 px-3">
          <option value="">{t("navigate.pickStart")}</option>
          {groups.map((g) => (
            <optgroup key={g.building?.id ?? "x"} label={lt(g.building?.name, loc)}>
              {g.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {lt(l.floors.get(n.floorId)?.name, loc)} — {nodeName(n, l, loc)}
                  {l.checkpointNodeIds.has(n.id) ? " (QR)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button type="submit" disabled={!value}>
          {t("common.confirm")}
        </Button>
      </form>
    </div>
  );
}

/** Modal used by the location bar in the app shell. */
export function LocationDialog({ bundle, open, onClose }: { bundle: CampusBundle; open: boolean; onClose: () => void }) {
  const { t, prefs, start, setStart } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("a,select,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const l = lookup(bundle);
  const node = start ? l.nodes.get(start.nodeId) : undefined;
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
  return (
    <>
      <div className="cn-overlay" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="loc-title" className="cn-dialog">
        <div className="cn-panel-head">
          <h2 id="loc-title" className="font-semibold">
            {t("shell.location")}
          </h2>
          <button className="p-2 text-muted hover:text-fg" onClick={onClose} aria-label={t("common.close")}>
            <Icon d={I.close} />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          {node ? (
            <div className="cn-locbar !cursor-default">
              <span className="cn-dot bg-accent cn-pulse" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{t("map.youAreHere")}</span>
                <span className="block font-medium truncate">{nodeName(node, l, prefs.locale)}</span>
              </span>
              <Button className="!min-h-9" onClick={() => setStart(null)}>
                {t("common.delete")}
              </Button>
            </div>
          ) : null}
          <StartPicker
            compact
            bundle={bundle}
            returnTo={here}
            onPick={(nodeId) => {
              setStart({ nodeId, source: "manual", at: new Date().toISOString() });
              onClose();
            }}
          />
        </div>
      </div>
    </>
  );
}
