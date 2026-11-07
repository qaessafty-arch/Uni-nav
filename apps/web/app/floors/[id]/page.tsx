"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { lt } from "@campusnav/core";
import { FloorMap } from "@campusnav/map-web";
import { Gate } from "@/components/Gate";
import { Badge, ButtonLink, ErrorState, Notice, cx } from "@/components/ui";
import { mapLabels } from "@/components/MapLabels";
import { GenderBadge } from "@/components/GenderBadge";
import { useApp } from "@/lib/store";
import { floorsOf, lookup } from "@/lib/lookup";

function FloorInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { t, prefs, start } = useApp();
  const [selected, setSelected] = useState<string | null>(params.get("room"));

  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        const floor = l.floors.get(id);
        if (!floor) return <ErrorState title={t("error.notFound")} />;
        const building = l.buildings.get(floor.buildingId);
        const siblings = floorsOf(bundle, floor.buildingId);
        const room = selected ? l.rooms.get(selected) : undefined;
        const startNode = start ? l.nodes.get(start.nodeId) : undefined;
        const cps = bundle.checkpoints.map((c) => l.nodes.get(c.nodeId)).filter((n): n is NonNullable<typeof n> => !!n && n.floorId === floor.id);
        return (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Link href={`/buildings/${building?.id}`} className="label-caps hover:text-fg">
                  {building?.code} · {lt(building?.name, loc)}
                </Link>
                <h1 className="cn-display cn-display-lg mt-1">{lt(floor.name, loc)}</h1>
              </div>
              <div role="tablist" aria-label={t("map.floors")} className="cn-seg">
                {siblings
                  .slice()
                  .reverse()
                  .map((f) => (
                    <button
                      key={f.id}
                      role="tab"
                      aria-selected={f.id === floor.id}
                      onClick={() => router.replace(`/floors/${f.id}`)}
                      className="min-w-11 min-h-11 px-3 mono text-sm hover:text-fg"
                      title={lt(f.name, loc)}
                    >
                      {f.level === 0 ? "G" : f.level}
                    </button>
                  ))}
              </div>
            </div>
            {bundle.university.dataStatus === "demo" ? <Notice tone="warn">{t("map.planDemo")}</Notice> : null}
            <FloorMap
              floor={floor}
              elements={bundle.mapElements.filter((e) => e.floorId === floor.id)}
              rooms={bundle.rooms.filter((r) => r.floorId === floor.id)}
              locale={loc}
              labels={mapLabels(t)}
              selectedRoomId={selected}
              onRoomSelect={setSelected}
              startNode={startNode?.floorId === floor.id ? startNode : null}
              destinationNode={room?.entranceNodeId ? l.nodes.get(room.entranceNodeId) ?? null : null}
              checkpointNodes={cps}
              height="62vh"
            />
            <div aria-live="polite" className="cn-card p-4 min-h-20">
              {room ? (
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="mono text-lg font-semibold">{room.code}</span>
                      <Badge>{t(`roomType.${room.type}`)}</Badge>
                      <GenderBadge room={room} />
                    </div>
                    <p className="text-muted text-sm">{lt(room.name, loc)}</p>
                  </div>
                  <div className="flex gap-2">
                    <ButtonLink href={`/rooms/${room.id}`}>{t("common.room")}</ButtonLink>
                    <ButtonLink href={`/navigate?to=${room.id}`} variant="primary">
                      {t("common.navigate")}
                    </ButtonLink>
                  </div>
                </div>
              ) : (
                <p className="text-muted text-sm">{t("map.selectRoom")}</p>
              )}
            </div>
            <MapLegend />
          </div>
        );
      }}
    </Gate>
  );
}

function MapLegend() {
  const { t } = useApp();
  const items: [string, string][] = [
    ["var(--cn-map-stairs)", t("map.stairs")],
    ["var(--cn-map-elevator)", t("map.elevator")],
    ["var(--cn-accent-soft)", t("map.entrance")],
    ["var(--cn-map-toilet)", t("map.toilet")],
    ["color-mix(in srgb, var(--cn-danger) 30%, transparent)", t("map.emergencyExit")],
  ];
  return (
    <details className="text-sm">
      <summary className="label-caps cursor-pointer">{t("map.legend")}</summary>
      <ul className="flex flex-wrap gap-4 mt-2">
        {items.map(([c, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="size-4 border border-line-strong" style={{ background: c }} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-4 border-2 border-info grid place-items-center">
            <span className="size-1.5 bg-info" />
          </span>
          {t("map.checkpoint")}
        </li>
      </ul>
    </details>
  );
}

export default function FloorPage() {
  return (
    <Suspense>
      <FloorInner />
    </Suspense>
  );
}
