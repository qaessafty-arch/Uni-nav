import type { CampusBundle, NavNode } from "../model/types";
import { buildGraph, type NavGraph, type RouteOptions } from "./graph";
import { buildInstructions, estimateWalkingTime, type RouteStep, type WalkingEstimate } from "./instructions";
import { findRoute, type Route, type RouteError } from "./pathfinding";
import { closedEdgeIds } from "./closures";

export * from "./graph";
export * from "./pathfinding";
export * from "./instructions";
export * from "./closures";
export * from "./nearest";
export { MinHeap } from "./heap";

export interface NavigationPlan {
  route: Route;
  steps: RouteStep[];
  estimate: WalkingEstimate;
}

export type PlanResult =
  | { ok: true; plan: NavigationPlan }
  | { ok: false; error: RouteError | { code: "ROOM_NOT_FOUND" } | { code: "ROOM_HAS_NO_ENTRANCE" } };

/** Graph cache keyed by bundle identity, so repeated route requests don't rebuild. */
const graphCache = new WeakMap<CampusBundle, NavGraph>();
export function graphForBundle(bundle: CampusBundle): NavGraph {
  let g = graphCache.get(bundle);
  if (!g) {
    g = buildGraph(bundle.navNodes, bundle.navEdges, bundle.floors);
    graphCache.set(bundle, g);
  }
  return g;
}

/** Route options with the bundle's active closures merged into `avoidEdgeIds`. */
export function withClosures(bundle: CampusBundle, options: RouteOptions = {}, at: Date = new Date()): RouteOptions {
  const closed = closedEdgeIds(bundle, at);
  if (!closed.size) return options;
  return { ...options, avoidEdgeIds: [...(options.avoidEdgeIds ?? []), ...closed] };
}

/**
 * Plan a route. Active closures in the bundle are always avoided; pass `at` to
 * plan for another moment (tests, "leave later").
 */
export function planRoute(bundle: CampusBundle, fromNodeId: string, toNodeId: string, options: RouteOptions = {}, at: Date = new Date()): PlanResult {
  const graph = graphForBundle(bundle);
  const res = findRoute(graph, fromNodeId, toNodeId, withClosures(bundle, options, at));
  if (!res.ok) return res;
  return {
    ok: true,
    plan: {
      route: res.route,
      steps: buildInstructions(res.route, graph.floors),
      estimate: estimateWalkingTime(res.route, bundle.university.settings, graph.floors, !!options.accessibleOnly),
    },
  };
}

export function planRouteToRoom(bundle: CampusBundle, fromNodeId: string, roomId: string, options: RouteOptions = {}, at: Date = new Date()): PlanResult {
  const room = bundle.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, error: { code: "ROOM_NOT_FOUND" } };
  if (!room.entranceNodeId) return { ok: false, error: { code: "ROOM_HAS_NO_ENTRANCE" } };
  return planRoute(bundle, fromNodeId, room.entranceNodeId, options, at);
}

/** Closest node on a floor to a map coordinate (e.g. where the user tapped "I am here"). */
export function nearestNode(nodes: NavNode[], floorId: string, x: number, y: number): NavNode | null {
  let best: NavNode | null = null;
  let bestD = Infinity;
  for (const n of nodes) {
    if (n.floorId !== floorId) continue;
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Nodes users may pick as a starting point: entrances, checkpoints, stairs, elevators, room doors. */
export function startCandidates(bundle: CampusBundle): NavNode[] {
  return bundle.navNodes.filter((n) => n.kind !== "corridor" && n.kind !== "outdoor");
}
