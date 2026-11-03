"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { lt, planRoute, relevantClosures, routeOptionsFor, ROUTE_PREFERENCES, type PlanResult, type RoutePreference } from "@campusnav/core";
import { describeStep, formatDistance, formatDuration, formatNumber } from "@campusnav/i18n";
import { FloorMap, routeSegmentsForFloor } from "@campusnav/map-web";
import { Gate } from "@/components/Gate";
import { mapLabels } from "@/components/MapLabels";
import { Badge, Button, ButtonLink, ErrorState, Notice, cx } from "@/components/ui";
import { StartPicker, nodeName } from "@/components/LocationPicker";
import { Icon } from "@/components/Icon";
import { I } from "@/components/icons";
import { RouteView3D } from "@/components/RouteView3D";
import { ShareButton } from "@/components/ShareButton";
import { webglAvailable } from "@/lib/three/support";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

type Target = { kind: "room"; id: string } | { kind: "node"; id: string };

function parseTarget(to: string | null): Target | null {
  if (!to) return null;
  if (to.startsWith("node:")) return { kind: "node", id: to.slice(5) };
  return { kind: "room", id: to };
}

const PREF_KEY: Record<RoutePreference, "navigate.prefShortest" | "navigate.prefFewerStairs" | "navigate.prefStepFree"> = {
  shortest: "navigate.prefShortest",
  fewer_stairs: "navigate.prefFewerStairs",
  step_free: "navigate.prefStepFree",
};

function PreferencePicker({ value, onChange }: { value: RoutePreference; onChange: (p: RoutePreference) => void }) {
  const { t } = useApp();
  return (
    <div>
      <div className="label-caps mb-2" id="pref-label">
        {t("navigate.preference")}
      </div>
      <div className="cn-segment" role="radiogroup" aria-labelledby="pref-label">
        {ROUTE_PREFERENCES.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={value === p} onClick={() => onChange(p)}>
            {t(PREF_KEY[p])}
          </button>
        ))}
      </div>
    </div>
  );
}

function errorText(res: Extract<PlanResult, { ok: false }>, accessible: boolean, t: ReturnType<typeof useApp>["t"]): string {
  switch (res.error.code) {
    case "UNREACHABLE":
      return accessible ? t("navigate.unreachableAccessible") : t("navigate.unreachable");
    case "UNKNOWN_START":
      return t("navigate.unknownStart");
    case "UNKNOWN_DESTINATION":
    case "ROOM_NOT_FOUND":
      return t("navigate.unknownDestination");
    case "ROOM_HAS_NO_ENTRANCE":
      return t("navigate.noEntrance");
  }
}

function NavigateInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { t, prefs, start, setStart, addHistory, reload } = useApp();
  const target = parseTarget(params.get("to"));
  const fromOverride = params.get("from");
  const [pref, setPref] = useState<RoutePreference>(prefs.accessible ? "step_free" : "shortest");
  const accessible = pref === "step_free";
  const [stepIdx, setStepIdx] = useState(0);
  const [view3d, setView3d] = useState(false);
  const [no3d, setNo3d] = useState(false);
  useEffect(() => setNo3d(!webglAvailable()), []);
  const [arrived, setArrived] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);
  const startId = fromOverride ?? start?.nodeId ?? null;
  const returnTo = `/navigate?${params.toString()}`;

  useEffect(() => {
    setStepIdx(0);
    setArrived(false);
  }, [startId, pref, recalcKey, params]);

  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        if (!target) return <ErrorState title={t("navigate.unknownDestination")} />;
        const room = target.kind === "room" ? l.rooms.get(target.id) : undefined;
        const destNodeId = target.kind === "room" ? room?.entranceNodeId : target.id;
        const destNode = destNodeId ? l.nodes.get(destNodeId) : undefined;
        const destName = room ? `${room.code} · ${lt(room.name, loc)}` : destNode ? nodeName(destNode, l, loc) : "";

        if (target.kind === "room" && !room) return <ErrorState title={t("navigate.unknownDestination")} />;
        if (!destNodeId) return <ErrorState title={t("navigate.noEntrance")} body={destName} />;

        const header = (
          <div className="mb-5">
            <div className="label-caps">{t("navigate.to")}</div>
            <h1 className="cn-display cn-display-lg mt-1">{destName}</h1>
            {room ? (
              <p className="text-muted text-sm">
                {lt(l.buildings.get(room.buildingId)?.name, loc)} · {lt(l.floors.get(room.floorId)?.name, loc)}
              </p>
            ) : null}
          </div>
        );

        if (!startId) {
          return (
            <div className="max-w-2xl">
              {header}
              <StartPicker bundle={bundle} returnTo={returnTo} onPick={(nodeId) => setStart({ nodeId, source: "manual", at: new Date().toISOString() })} />
            </div>
          );
        }

        const now = new Date();
        const res = planRoute(bundle, startId, destNodeId, routeOptionsFor(pref), now);
        const activeClosures = relevantClosures(bundle, now).active.filter((c) => c.targetType !== "room");
        if (!res.ok) {
          return (
            <div className="max-w-2xl space-y-4">
              {header}
              <ErrorState title={errorText(res, accessible, t)} />
              <PreferencePicker value={pref} onChange={setPref} />
              <div className="flex gap-2">
                <Button onClick={() => setStart(null)}>{t("navigate.changeStart")}</Button>
                <Button onClick={() => { reload(); setRecalcKey((k) => k + 1); }}>{t("navigate.recalculate")}</Button>
              </div>
            </div>
          );
        }

        const { plan } = res;
        const steps = plan.steps;
        const step = steps[Math.min(stepIdx, steps.length - 1)]!;
        const viewFloorId = step.toFloorId && step.kind !== "start" ? step.toFloorId : step.floorId;
        const viewFloor = l.floors.get(viewFloorId)!;
        const startNode = l.nodes.get(startId)!;
        const routeFloors = plan.route.floorSequence;

        if (arrived) {
          return (
            <div className="max-w-xl mx-auto text-center py-10">
              <div className="mx-auto size-20 bg-accent text-accent-fg grid place-items-center text-4xl font-black" aria-hidden>
                ✓
              </div>
              <h1 className="cn-display cn-display-xl mt-8">{t("navigate.arrived")}</h1>
              <p className="text-muted mt-2">{t("navigate.arrivedAt", { place: destName })}</p>
              <div className="mt-8 flex justify-center gap-2">
                {room ? <ButtonLink href={`/rooms/${room.id}`}>{t("common.room")}</ButtonLink> : null}
                <ButtonLink href="/" variant="primary">
                  {t("nav.home")}
                </ButtonLink>
              </div>
            </div>
          );
        }

        return (
          <div>
            {header}
            <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
              <div className="space-y-3 order-1">
                <div role="tablist" aria-label={t("map.floors")} className="cn-scroll-x">
                  {routeFloors.map((fid, i) => {
                    const f = l.floors.get(fid);
                    const firstStep = steps.findIndex((s) => (s.toFloorId && s.kind !== "start" ? s.toFloorId : s.floorId) === fid);
                    return (
                      <button
                        key={`${fid}-${i}`}
                        role="tab"
                        aria-selected={fid === viewFloorId}
                        onClick={() => setStepIdx(Math.max(0, firstStep))}
                        aria-current={fid === viewFloorId ? "true" : undefined}
                        className="cn-chip !min-h-9"
                      >
                        {l.buildings.get(f?.buildingId ?? "")?.code} · {lt(f?.name, loc)}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="cn-segment !p-1" role="radiogroup" aria-label={t("explore.viewMode")}>
                    <button type="button" role="radio" aria-checked={!view3d} onClick={() => setView3d(false)} className="!min-h-8 !px-3 mono">{t("explore.view2d")}</button>
                    <button type="button" role="radio" aria-checked={view3d} disabled={no3d} onClick={() => setView3d(true)} className="!min-h-8 !px-3 mono">{t("explore.view3d")}</button>
                  </div>
                  {view3d ? <span className="text-xs text-muted truncate">{t("explore.routeIn3d", { building: lt(l.buildings.get(viewFloor.buildingId)?.name, loc) })}</span> : no3d ? <span className="text-xs text-muted">{t("explore.no3d")}</span> : null}
                </div>
                {view3d && !no3d ? (
                  <div className="relative cn-mapframe border border-line" style={{ height: "min(58vh, 560px)" }}>
                    <RouteView3D bundle={bundle} route={plan.route} buildingId={viewFloor.buildingId} onUnavailable={() => { setNo3d(true); setView3d(false); }} />
                  </div>
                ) : (
                <FloorMap
                  floor={viewFloor}
                  elements={bundle.mapElements.filter((e) => e.floorId === viewFloor.id)}
                  rooms={bundle.rooms.filter((r) => r.floorId === viewFloor.id)}
                  locale={loc}
                  labels={mapLabels(t)}
                  selectedRoomId={room && room.floorId === viewFloor.id ? room.id : null}
                  routeSegments={routeSegmentsForFloor(plan.route, viewFloor.id)}
                  startNode={startNode.floorId === viewFloor.id ? startNode : null}
                  destinationNode={destNode && destNode.floorId === viewFloor.id ? destNode : null}
                  focusNode={stepIdx > 0 ? l.nodes.get(step.nodeId) ?? null : null}
                  height="min(58vh, 560px)"
                />
                )}
                {bundle.university.dataStatus === "demo" ? <Notice tone="warn">{t("map.planDemo")}</Notice> : null}
              </div>

              <div className="order-2 space-y-4">
                <div className="cn-panel grid grid-cols-2 overflow-hidden">
                  <div className="p-4 border-e border-line">
                    <div className="label-caps">{t("navigate.distance")}</div>
                    <div className="cn-figure text-3xl md:text-4xl mt-2">{formatDistance(loc, plan.route.distanceM)}</div>
                  </div>
                  <div className="p-4">
                    <div className="label-caps flex items-center gap-2">
                      {t("navigate.time")} <Badge>{t("data.estimate")}</Badge>
                    </div>
                    <div className="cn-figure text-3xl md:text-4xl mt-2">≈ {formatDuration(loc, plan.estimate.seconds)}</div>
                  </div>
                  <p className="col-span-2 border-t border-line px-4 py-2 text-xs text-muted">{t("navigate.timeNote", { speed: formatNumber(loc, plan.estimate.assumptions.speedMps) })}</p>
                </div>

                <div className="text-sm text-muted flex items-center justify-between gap-2">
                  <span>
                    <span className="label-caps me-2">{t("navigate.from")}</span>
                    {nodeName(startNode, l, loc)}
                  </span>
                  <button className="underline min-h-11" onClick={() => (fromOverride ? router.replace(`/navigate?to=${params.get("to")}`) : setStart(null))}>
                    {t("navigate.changeStart")}
                  </button>
                </div>
                <PreferencePicker value={pref} onChange={setPref} />
                {activeClosures.length ? <Notice tone="warn">{t("navigate.avoidingClosures", { n: activeClosures.length })}</Notice> : null}
                <div>
                  <div className="flex justify-between text-xs text-muted mb-1.5">
                    <span>{t("navigate.progress", { n: Math.min(stepIdx, steps.length - 1) + 1, total: steps.length })}</span>
                    <span className="mono">{Math.round(((Math.min(stepIdx, steps.length - 1) + 1) / steps.length) * 100)}%</span>
                  </div>
                  <div className="cn-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={Math.min(stepIdx, steps.length - 1) + 1} aria-label={t("navigate.steps")}>
                    <span style={{ width: `${((Math.min(stepIdx, steps.length - 1) + 1) / steps.length) * 100}%` }} />
                  </div>
                </div>

                <ol className="cn-panel overflow-hidden max-h-[42vh] overflow-y-auto" aria-label={t("navigate.steps")}>
                  {steps.map((s, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setStepIdx(i)}
                        aria-current={i === stepIdx ? "step" : undefined}
                        className={cx("w-full text-start flex gap-3 px-4 py-3 border-b border-line last:border-0 min-h-12", i === stepIdx ? "bg-accent-soft" : "hover:bg-surface")}
                      >
                        <span className={cx("mono text-xs mt-0.5 w-6 shrink-0", i === stepIdx ? "text-accent" : "text-faint")}>{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-sm">{describeStep(loc, s, l.floors, destNode?.label)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="flex gap-2 cn-actionbar -mx-4 px-4 py-3 md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-0 md:backdrop-blur-none">
                  <Button onClick={() => setStepIdx(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0} aria-label={t("navigate.prev")}>
                    <span className="rtl:rotate-180">←</span>
                  </Button>
                  {stepIdx < steps.length - 1 ? (
                    <Button variant="primary" className="flex-1" onClick={() => setStepIdx(stepIdx + 1)}>
                      {t("navigate.next")}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => {
                        setArrived(true);
                        if (room) addHistory({ to: room.id, from: startId });
                      }}
                    >
                      {t("navigate.markArrived")}
                    </Button>
                  )}
                  <Button onClick={() => { reload(); setRecalcKey((k) => k + 1); }}>{t("navigate.recalculate")}</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <ShareButton path={`/navigate?to=${encodeURIComponent(params.get("to") ?? "")}&from=${encodeURIComponent(startId)}`} />
                  <ButtonLink href={`/scan?then=${encodeURIComponent(returnTo)}`}>
                    <Icon d={I.scan} className="size-4" /> {t("nav.scan")}
                  </ButtonLink>
                  <Link className="text-muted underline ms-auto" href={`/report?category=wrong_directions&from=${encodeURIComponent(startId)}&to=${encodeURIComponent(destNodeId)}`}>
                    {t("report.link")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </Gate>
  );
}

export default function NavigatePage() {
  return (
    <Suspense>
      <NavigateInner />
    </Suspense>
  );
}
