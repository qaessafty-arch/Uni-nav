"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { graphForBundle, lt, nearestRooms, routeOptionsFor, withClosures, GENDERED_ROOM_TYPES, ROOM_TYPES, type RoomType } from "@campusnav/core";
import { GenderBadge } from "@/components/GenderBadge";
import { formatDistance } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { FACILITIES } from "@/components/Blocks";
import { StartPicker, nodeName } from "@/components/LocationPicker";
import { Icon } from "@/components/Icon";
import { I } from "@/components/icons";
import { Badge, ButtonLink, EmptyState, PageTitle } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

function NearbyInner() {
  const { t, prefs, setPrefs, start, setStart } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("type");
  const type: RoomType = (ROOM_TYPES as readonly string[]).includes(raw ?? "") ? (raw as RoomType) : "toilet";
  return (
    <Gate>
      {(bundle) => {
        const l = lookup(bundle);
        const loc = prefs.locale;
        const available = new Set(bundle.rooms.map((r) => r.type));
        const startNode = start ? l.nodes.get(start.nodeId) : undefined;
        const opts = withClosures(bundle, routeOptionsFor(prefs.accessible ? "step_free" : "shortest"));
        const gendered = GENDERED_ROOM_TYPES.includes(type) && bundle.rooms.some((r) => r.type === type && r.gender);
        const want = gendered ? prefs.facilityGender ?? null : null;
        // Shared rooms and rooms without a gender set always count; men's/women's only for that choice.
        const results = startNode
          ? nearestRooms(bundle, graphForBundle(bundle), startNode.id, [type], opts, 60).filter(({ room }) => !want || !room.gender || room.gender === "all" || room.gender === want).slice(0, 12)
          : [];
        return (
          <div>
            <PageTitle eyebrow={t("nav.nearby")}>{t("nearby.title")}</PageTitle>
            <div className="cn-scroll-x mb-5" role="group" aria-label={t("home.findNearest")}>
              {FACILITIES.filter((f) => available.has(f.type)).map((f) => (
                <button key={f.type} type="button" className="cn-chip" aria-pressed={f.type === type} onClick={() => router.replace(`/nearby?type=${f.type}`)}>
                  <Icon d={f.icon} className="size-4" />
                  {t(`roomType.${f.type}`)}
                </button>
              ))}
            </div>
            {gendered ? (
              <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label={t("nearby.forWho")} data-testid="gender-filter">
                <span className="text-sm text-muted">{t("nearby.forWho")}</span>
                {([null, "male", "female"] as const).map((g) => (
                  <button key={g ?? "any"} type="button" className="cn-chip !min-h-9" aria-pressed={want === g} onClick={() => setPrefs({ facilityGender: g })}>
                    {g ? t(`gender.${g}`) : t("nearby.anyGender")}
                  </button>
                ))}
              </div>
            ) : null}
            {!startNode ? (
              <div className="max-w-2xl space-y-4">
                <p className="text-muted">{t("nearby.needLocation")}</p>
                <StartPicker bundle={bundle} returnTo={`/nearby?type=${type}`} onPick={(nodeId) => setStart({ nodeId, source: "manual", at: new Date().toISOString() })} />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted mb-4 flex flex-wrap items-center gap-2">
                  <span className="cn-dot bg-accent" aria-hidden />
                  {t("home.startingFrom", { place: nodeName(startNode, l, loc) })}
                  {prefs.accessible ? <Badge tone="accent">{t("navigate.prefStepFree")}</Badge> : null}
                </p>
                <p className="text-xs text-faint mb-3">{t("nearby.subtitle")}</p>
                {results.length === 0 ? (
                  <EmptyState title={t("nearby.none")} />
                ) : (
                  <ol className="cn-panel overflow-hidden" aria-label={t("nearby.title")}>
                    {results.map(({ room, distanceM }, i) => {
                      const f = l.floors.get(room.floorId);
                      const b = l.buildings.get(room.buildingId);
                      return (
                        <li key={room.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
                          <span className="mono text-xs text-faint w-6">{String(i + 1).padStart(2, "0")}</span>
                          <Link href={`/rooms/${room.id}`} className="min-w-0 flex-1 hover:underline">
                            <span className="flex items-center gap-2 font-medium min-w-0">
                              <span className="truncate">{room.code} · {lt(room.name, loc)}</span>
                              <GenderBadge room={room} />
                            </span>
                            <span className="block text-xs text-muted truncate">
                              {b?.code} · {lt(f?.name, loc)} · {t("nearby.walk", { distance: formatDistance(loc, distanceM) })}
                            </span>
                          </Link>
                          <ButtonLink href={`/navigate?to=${room.id}`} variant={i === 0 ? "primary" : "secondary"} className="!min-h-9 shrink-0">
                            <Icon d={I.route} className="size-4" /> {t("common.navigate")}
                          </ButtonLink>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </>
            )}
          </div>
        );
      }}
    </Gate>
  );
}

export default function NearbyPage() {
  return (
    <Suspense>
      <NearbyInner />
    </Suspense>
  );
}
