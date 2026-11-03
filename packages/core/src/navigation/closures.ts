import type { CampusBundle, Closure, NavEdge, NavEdgeKind } from "../model/types";
import type { RouteOptions } from "./graph";

/** True when the closure is in force at `at`. */
export function isClosureActive(c: Closure, at: Date): boolean {
  const t = at.getTime();
  return Date.parse(c.startsAt) <= t && (!c.endsAt || Date.parse(c.endsAt) > t);
}

/** Closures in force now, plus ones starting within `upcomingDays`, sorted by start. */
export function relevantClosures(bundle: Pick<CampusBundle, "closures">, at: Date, upcomingDays = 14): { active: Closure[]; upcoming: Closure[] } {
  const horizon = at.getTime() + upcomingDays * 86_400_000;
  const all = [...(bundle.closures ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return {
    active: all.filter((c) => isClosureActive(c, at)),
    upcoming: all.filter((c) => Date.parse(c.startsAt) > at.getTime() && Date.parse(c.startsAt) <= horizon),
  };
}

/** Edge ids that routing must avoid because of closures active at `at`. */
export function closedEdgeIds(bundle: Pick<CampusBundle, "closures" | "navEdges">, at: Date): Set<string> {
  const out = new Set<string>();
  const active = (bundle.closures ?? []).filter((c) => isClosureActive(c, at));
  if (!active.length) return out;
  const closedNodes = new Set(active.filter((c) => c.targetType === "node").map((c) => c.targetId));
  for (const c of active) if (c.targetType === "edge") out.add(c.targetId);
  if (closedNodes.size) {
    for (const e of bundle.navEdges) if (closedNodes.has(e.fromNodeId) || closedNodes.has(e.toNodeId)) out.add(e.id);
  }
  return out;
}

/** Closures that affect a route (edges used, or nodes passed through). */
export function closuresOnRoute(bundle: Pick<CampusBundle, "closures">, edges: NavEdge[], at: Date): Closure[] {
  const edgeIds = new Set(edges.map((e) => e.id));
  const nodeIds = new Set(edges.flatMap((e) => [e.fromNodeId, e.toNodeId]));
  return (bundle.closures ?? []).filter(
    (c) => isClosureActive(c, at) && ((c.targetType === "edge" && edgeIds.has(c.targetId)) || (c.targetType === "node" && nodeIds.has(c.targetId))),
  );
}

/**
 * Route preference presets shown to users.
 * - shortest: physical distance only
 * - fewer_stairs: stairs cost an extra 40 m-equivalent per flight, so a nearby elevator/ramp wins (distances stay physical)
 * - step_free: only accessible edges (no stairs)
 * - indoor_first: outdoor paths count ×4, so a slightly longer indoor route wins in summer heat
 */
export type RoutePreference = "shortest" | "fewer_stairs" | "step_free" | "indoor_first";
export const ROUTE_PREFERENCES: readonly RoutePreference[] = ["shortest", "fewer_stairs", "step_free", "indoor_first"];

export function routeOptionsFor(pref: RoutePreference): RouteOptions {
  if (pref === "step_free") return { accessibleOnly: true };
  if (pref === "indoor_first") return { kindCostFactor: { outdoor: 4 } satisfies Partial<Record<NavEdgeKind, number>> };
  if (pref === "fewer_stairs") return { kindPenaltyM: { stairs: 40 } satisfies Partial<Record<NavEdgeKind, number>> };
  return {};
}

/** Metres of a route walked outdoors (sun / rain exposure). */
export function outdoorMeters(legs: { edge: NavEdge; distanceM: number }[]): number {
  return legs.reduce((s, l) => s + (l.edge.kind === "outdoor" ? l.distanceM : 0), 0);
}

export type HeatLevel = "none" | "hot" | "extreme";
/** "hot" from the university's threshold (default 38 °C feels-like), "extreme" 7 °C above it. */
export function heatLevel(apparentC: number | null | undefined, thresholdC = 38): HeatLevel {
  if (apparentC == null || !Number.isFinite(apparentC)) return "none";
  if (apparentC >= thresholdC + 7) return "extreme";
  return apparentC >= thresholdC ? "hot" : "none";
}
