"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { distancesFrom, freeRoomsAt, graphForBundle, lt, routeOptionsFor, withClosures, type CampusBundle } from "@campusnav/core";
import { formatClock, formatDistance, formatDuration } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { nodeName } from "@/components/LocationPicker";
import { Icon } from "@/components/Icon";
import { I } from "@/components/icons";
import { Badge, ButtonLink, EmptyState, Notice, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

const MIN_OPTIONS = [30, 60, 120] as const;

function FreeRooms({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, start } = useApp();
  const loc = prefs.locale;
  const l = lookup(bundle);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [minMinutes, setMin] = useState<number>(30);
  const startNode = start ? l.nodes.get(start.nodeId) : undefined;
  const [sort, setSort] = useState<"longest" | "nearest">("longest");

  const dist = useMemo(
    () => (startNode ? distancesFrom(graphForBundle(bundle), startNode.id, withClosures(bundle, routeOptionsFor(prefs.accessible ? "step_free" : "shortest"), now)) : null),
    [bundle, startNode, prefs.accessible, now],
  );
  const free = freeRoomsAt(bundle, now, { minMinutes });
  const rows = free.map((f) => ({ ...f, distanceM: f.room.entranceNodeId && dist ? dist.get(f.room.entranceNodeId) ?? null : null }));
  if (sort === "nearest" && dist) rows.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));

  if (!bundle.timetable.length) return <EmptyState title={t("free.noTimetable")} />;

  return (
    <div>
      <p className="text-muted max-w-2xl -mt-2 mb-4">{t("free.subtitle")}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label={t("free.minFree")}>
        <span className="text-sm text-muted">{t("free.minFree")}</span>
        {MIN_OPTIONS.map((m) => (
          <button key={m} type="button" className="cn-chip !min-h-9" aria-pressed={minMinutes === m} onClick={() => setMin(m)}>
            {formatDuration(loc, m * 60)}
          </button>
        ))}
        {dist ? (
          <span className="ms-auto flex gap-1.5" role="group">
            <button type="button" className="cn-chip !min-h-9" aria-pressed={sort === "longest"} onClick={() => setSort("longest")}>{t("free.sortLongest")}</button>
            <button type="button" className="cn-chip !min-h-9" aria-pressed={sort === "nearest"} onClick={() => setSort("nearest")}>{t("free.sortNearest")}</button>
          </span>
        ) : null}
      </div>
      {startNode ? (
        <p className="text-sm text-muted mb-3 flex items-center gap-2">
          <span className="cn-dot bg-accent" aria-hidden /> {t("home.startingFrom", { place: nodeName(startNode, l, loc) })}
        </p>
      ) : null}
      <div className="mb-4"><Notice tone="info">{t("free.caveat")}</Notice></div>
      {rows.length === 0 ? (
        <EmptyState title={t("free.none")} />
      ) : (
        <ul className="cn-panel overflow-hidden" aria-label={t("free.title")} data-testid="free-rooms">
          {rows.map(({ room, freeUntil, minutesFree, freedByCancellation, distanceM }) => {
            const f = l.floors.get(room.floorId);
            const b = l.buildings.get(room.buildingId);
            return (
              <li key={room.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                <div className="w-24 shrink-0">
                  <span className={`block text-xs font-semibold ${minutesFree == null || minutesFree >= 120 ? "text-accent" : "text-fg"}`}>
                    {freeUntil ? t("free.until", { time: formatClock(loc, freeUntil) }) : t("free.restOfDay")}
                  </span>
                  {minutesFree != null ? <span className="block text-xs text-faint">{formatDuration(loc, minutesFree * 60)}</span> : null}
                </div>
                <Link href={`/rooms/${room.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block font-medium truncate">
                    {room.code} · {lt(room.name, loc)}
                  </span>
                  <span className="block text-xs text-muted truncate">
                    {b?.code} · {lt(f?.name, loc)}
                    {room.capacity ? ` · ${t("common.capacity", { n: room.capacity })}` : ""}
                    {distanceM != null ? ` · ${t("nearby.walk", { distance: formatDistance(loc, distanceM) })}` : ""}
                  </span>
                  {freedByCancellation ? <Badge tone="warn">{t("free.cancelled")}</Badge> : null}
                </Link>
                {room.entranceNodeId ? (
                  <ButtonLink href={`/navigate?to=${room.id}`} className="!min-h-9 shrink-0" aria-label={`${t("common.navigate")} ${room.code}`}>
                    <Icon d={I.route} className="size-4" /> <span className="max-sm:hidden">{t("common.navigate")}</span>
                  </ButtonLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function FreeRoomsPage() {
  const { t } = useApp();
  return (
    <div>
      <PageTitle eyebrow={t("nav.freeRooms")}>{t("free.title")}</PageTitle>
      <Gate>{(bundle) => <FreeRooms bundle={bundle} />}</Gate>
    </div>
  );
}
