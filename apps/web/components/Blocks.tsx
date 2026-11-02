"use client";
import type { ReactNode } from "react";
import { lt, relevantClosures, type CampusBundle, type Closure, type RoomType } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { nodeName } from "./LocationPicker";
import { I } from "./icons";
import { Badge, cx } from "./ui";

/** Facility shortcuts, in order of how often students ask for them. */
export const FACILITIES: { type: RoomType; icon: string }[] = [
  { type: "toilet", icon: I.toilet },
  { type: "prayer_room", icon: I.prayer },
  { type: "cafeteria", icon: I.cafe },
  { type: "library", icon: I.library },
  { type: "laboratory", icon: I.lab },
  { type: "lecture_hall", icon: I.hall },
  { type: "office", icon: I.office },
];

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("cn-panel", className)}>
      <div className="cn-panel-head">
        <h2 className="font-semibold text-[15px]">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function closureTarget(bundle: CampusBundle, c: Closure, loc: Parameters<typeof lt>[1]): string {
  const l = lookup(bundle);
  if (c.targetType === "room") {
    const r = l.rooms.get(c.targetId);
    return r ? `${r.code} · ${lt(r.name, loc)}` : "";
  }
  if (c.targetType === "node") {
    const n = l.nodes.get(c.targetId);
    return n ? nodeName(n, l, loc) : "";
  }
  const e = bundle.navEdges.find((x) => x.id === c.targetId);
  const n = e ? l.nodes.get(e.fromNodeId) : undefined;
  return n ? `${lt(l.buildings.get(l.floors.get(n.floorId)?.buildingId ?? "")?.name, loc)} · ${lt(l.floors.get(n.floorId)?.name, loc)}` : "";
}

export function ClosureList({ bundle, now, compact }: { bundle: CampusBundle; now: Date; compact?: boolean }) {
  const { t, prefs } = useApp();
  const loc = prefs.locale;
  const { active, upcoming } = relevantClosures(bundle, now);
  const all = [...active.map((c) => ({ c, on: true })), ...upcoming.map((c) => ({ c, on: false }))];
  if (!all.length) return compact ? null : <p className="text-sm text-muted">{t("notifications.empty")}</p>;
  return (
    <ul className="space-y-3">
      {all.map(({ c, on }) => (
        <li key={c.id} className={cx("border-s-2 ps-3", on ? "border-danger" : "border-warn")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={on ? "danger" : "warn"}>{on ? t("closure.active") : t("closure.upcoming")}</Badge>
            <span className="text-xs text-muted">{on ? (c.endsAt ? t("closure.until", { date: formatDate(loc, c.endsAt) }) : "") : t("closure.from", { date: formatDate(loc, c.startsAt) })}</span>
          </div>
          <p className="text-sm font-medium mt-1">{lt(c.reason, loc)}</p>
          <p className="text-xs text-muted">{closureTarget(bundle, c, loc)}</p>
        </li>
      ))}
    </ul>
  );
}

