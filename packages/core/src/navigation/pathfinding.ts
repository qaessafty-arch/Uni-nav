import type { NavEdge, NavNode } from "../model/types";
import { edgeUsable, normalizeOptions, planarDistanceM, type NavGraph, type RouteOptions } from "./graph";
import { MinHeap } from "./heap";

export interface RouteLeg {
  edge: NavEdge;
  from: NavNode;
  to: NavNode;
  distanceM: number;
}

export interface Route {
  nodes: NavNode[];
  legs: RouteLeg[];
  distanceM: number;
  /** Floor ids in visiting order (consecutive duplicates removed). */
  floorSequence: string[];
}

export type RouteError =
  | { code: "UNKNOWN_START"; nodeId: string }
  | { code: "UNKNOWN_DESTINATION"; nodeId: string }
  | { code: "UNREACHABLE" };

export type RouteResult = { ok: true; route: Route } | { ok: false; error: RouteError };

/**
 * A* shortest path. The heuristic is straight-line distance when both nodes
 * share a floor (admissible: corridors cannot be shorter than a straight line)
 * and 0 otherwise, which degrades gracefully to Dijkstra across floors/buildings.
 */
export function findRoute(graph: NavGraph, startId: string, goalId: string, options?: RouteOptions): RouteResult {
  const start = graph.nodes.get(startId);
  if (!start) return { ok: false, error: { code: "UNKNOWN_START", nodeId: startId } };
  const goal = graph.nodes.get(goalId);
  if (!goal) return { ok: false, error: { code: "UNKNOWN_DESTINATION", nodeId: goalId } };

  if (startId === goalId) {
    return { ok: true, route: { nodes: [start], legs: [], distanceM: 0, floorSequence: [start.floorId] } };
  }

  const opts = normalizeOptions(options);
  const h = (id: string): number => {
    const n = graph.nodes.get(id)!;
    return planarDistanceM(n, goal, graph.floors) ?? 0;
  };

  const gScore = new Map<string, number>([[startId, 0]]);
  const came = new Map<string, { prev: string; edge: NavEdge; distanceM: number }>();
  const closed = new Set<string>();
  const open = new MinHeap<string>();
  open.push(startId, h(startId));

  while (open.size > 0) {
    const current = open.pop()!;
    if (current === goalId) break;
    if (closed.has(current)) continue;
    closed.add(current);
    const gCur = gScore.get(current)!;

    for (const ge of graph.adjacency.get(current) ?? []) {
      if (closed.has(ge.to) || !edgeUsable(ge.edge, opts)) continue;
      const penalty = opts.kindPenaltyM[ge.edge.kind] ?? 0;
      // Factors are clamped to ≥ 1 so the straight-line heuristic stays admissible.
      const factor = Math.max(1, opts.kindCostFactor[ge.edge.kind] ?? 1);
      const tentative = gCur + ge.distanceM * factor + penalty;
      if (tentative < (gScore.get(ge.to) ?? Infinity)) {
        gScore.set(ge.to, tentative);
        came.set(ge.to, { prev: current, edge: ge.edge, distanceM: ge.distanceM });
        open.push(ge.to, tentative + h(ge.to));
      }
    }
  }

  if (!came.has(goalId)) return { ok: false, error: { code: "UNREACHABLE" } };

  const legs: RouteLeg[] = [];
  let cursor = goalId;
  while (cursor !== startId) {
    const step = came.get(cursor)!;
    legs.push({ edge: step.edge, from: graph.nodes.get(step.prev)!, to: graph.nodes.get(cursor)!, distanceM: step.distanceM });
    cursor = step.prev;
  }
  legs.reverse();
  const nodes = [start, ...legs.map((l) => l.to)];
  const floorSequence: string[] = [];
  for (const n of nodes) if (floorSequence[floorSequence.length - 1] !== n.floorId) floorSequence.push(n.floorId);
  const distanceM = legs.reduce((s, l) => s + l.distanceM, 0);
  return { ok: true, route: { nodes, legs, distanceM, floorSequence } };
}

/** Node ids reachable from `startId` under the given options (BFS). */
export function reachableFrom(graph: NavGraph, startId: string, options?: RouteOptions): Set<string> {
  const opts = normalizeOptions(options);
  const seen = new Set<string>();
  if (!graph.nodes.has(startId)) return seen;
  const queue = [startId];
  seen.add(startId);
  while (queue.length) {
    const id = queue.shift()!;
    for (const ge of graph.adjacency.get(id) ?? []) {
      if (!seen.has(ge.to) && edgeUsable(ge.edge, opts)) {
        seen.add(ge.to);
        queue.push(ge.to);
      }
    }
  }
  return seen;
}
