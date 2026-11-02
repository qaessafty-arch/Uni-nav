"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { lt, planRoute, startCandidates, type CampusBundle, type NavNode, type PlanResult } from "@campusnav/core";
import { describeStep, formatDistance, formatDuration, formatNumber } from "@campusnav/i18n";
import { FloorMap, routeSegmentsForFloor } from "@campusnav/map-web";
import { Gate } from "@/components/Gate";
import { mapLabels } from "@/components/MapLabels";
import { Badge, Button, ButtonLink, ErrorState, Notice, Toggle, cx } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup, type Lookup } from "@/lib/lookup";

type Target = { kind: "room"; id: string } | { kind: "node"; id: string };

function parseTarget(to: string | null): Target | null {
  if (!to) return null;
  if (to.startsWith("node:")) return { kind: "node", id: to.slice(5) };
  return { kind: "room", id: to };
}

function nodeName(n: NavNode, l: Lookup, loc: Parameters<typeof lt>[1]): string {
  const room = l.roomByEntrance.get(n.id);
  if (room) return `${room.code} · ${lt(room.name, loc)}`;
  return lt(n.label, loc) || `${lt(l.floors.get(n.floorId)?.name, loc)}`;
}

function StartPicker({ bundle, onPick, returnTo }: { bundle: CampusBundle; onPick: (nodeId: string) => void; returnTo: string }) {
  const { t, prefs } = useApp();
  const l = lookup(bundle);
  const loc = prefs.locale;
  const [value, setValue] = useState("");
  const groups = useMemo(() => {
    const cands = startCandidates(bundle);
    const byBuilding = new Map<string, NavNode[]>();
    for (const n of cands) {
      const f = l.floors.get(n.floorId);
      const key = f?.buildingId ?? "";
      byBuilding.set(key, [...(byBuilding.get(key) ?? []), n]);
    }
    return [...byBuilding.entries()].map(([bid, nodes]) => ({
      building: l.buildings.get(bid),
      nodes: nodes.sort((a, z) => (l.floors.get(a.floorId)?.level ?? 0) - (l.floors.get(z.floorId)?.level ?? 0) || nodeName(a, l, loc).localeCompare(nodeName(z, l, loc), undefined, { numeric: true })),
    }));
  }, [bundle, l, loc]);

  return (
    <div className="cn-card p-5 md:p-6">
      <h2 className="text-xl font-semibold">{t("navigate.chooseStart")}</h2>
      <p className="text-muted text-sm mt-1">{t("navigate.chooseStartHint")}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <ButtonLink href={`/scan?then=${encodeURIComponent(returnTo)}`} variant="primary">
          {t("navigate.scanToStart")}
        </ButtonLink>
      </div>
      <form
        className="mt-5 flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onPick(value);
        }}
      >
        <label className="sr-only" htmlFor="start-select">
          {t("navigate.pickStart")}
        </label>
        <select id="start-select" value={value} onChange={(e) => setValue(e.target.value)} className="min-h-11 flex-1 bg-bg border border-line-strong px-3">
          <option value="">{t("navigate.pickStart")}</option>
          {groups.map((g) => (
            <optgroup key={g.building?.id ?? "x"} label={lt(g.building?.name, loc)}>
              {g.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {lt(l.floors.get(n.floorId)?.name, loc)} — {nodeName(n, l, loc)}
                  {l.checkpointNodeIds.has(n.id) ? " ▣" : ""}
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
  const [accessible, setAccessible] = useState(prefs.accessible);
  const [stepIdx, setStepIdx] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);
  const startId = fromOverride ?? start?.nodeId ?? null;
  const returnTo = `/navigate?${params.toString()}`;

  useEffect(() => {
    setStepIdx(0);
    setArrived(false);
  }, [startId, accessible, recalcKey, params]);

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

        const res = planRoute(bundle, startId, destNodeId, { accessibleOnly: accessible });
        if (!res.ok) {
          return (
            <div className="max-w-2xl space-y-4">
              {header}
              <ErrorState title={errorText(res, accessible, t)} />
              <Toggle checked={accessible} onChange={setAccessible} label={t("navigate.accessible")} />
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
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
              <div className="space-y-3 order-1">
                <div role="tablist" aria-label={t("map.floors")} className="flex flex-wrap gap-1">
                  {routeFloors.map((fid, i) => {
                    const f = l.floors.get(fid);
                    const firstStep = steps.findIndex((s) => (s.toFloorId && s.kind !== "start" ? s.toFloorId : s.floorId) === fid);
                    return (
                      <button
                        key={`${fid}-${i}`}
                        role="tab"
                        aria-selected={fid === viewFloorId}
                        onClick={() => setStepIdx(Math.max(0, firstStep))}
                        className={cx("min-h-11 px-3 border text-sm", fid === viewFloorId ? "border-accent text-accent" : "border-line-strong text-muted")}
                      >
                        {l.buildings.get(f?.buildingId ?? "")?.code} · {lt(f?.name, loc)}
                      </button>
                    );
                  })}
                </div>
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
                {bundle.university.dataStatus === "demo" ? <Notice tone="warn">{t("map.planDemo")}</Notice> : null}
              </div>

              <div className="order-2 space-y-4">
                <div className="cn-card grid grid-cols-2 !p-0 overflow-hidden">
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
                <Toggle checked={accessible} onChange={setAccessible} label={t("navigate.accessible")} />

                <ol className="cn-card !p-0 overflow-hidden" aria-label={t("navigate.steps")}>
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
                <div className="flex gap-2">
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
                <p className="text-xs text-faint">
                  <Link className="underline" href={`/scan?then=${encodeURIComponent(returnTo)}`}>
                    {t("navigate.scanToStart")}
                  </Link>
                </p>
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
