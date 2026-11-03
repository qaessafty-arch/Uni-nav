import type { Floor, NavEdge, NavEdgeKind, NavNode } from "../model/types";

export interface GraphEdge {
  edge: NavEdge;
  to: string;
  distanceM: number;
}

export interface NavGraph {
  nodes: Map<string, NavNode>;
  floors: Map<string, Floor>;
  adjacency: Map<string, GraphEdge[]>;
  /** Edges that could not be used (dangling ends, unknown distance). */
  rejectedEdges: { edge: NavEdge; reason: "unknown_node" | "unknown_distance" | "self_loop" }[];
}

/** Euclidean distance in metres between two nodes on the same floor, or null. */
export function planarDistanceM(a: NavNode, b: NavNode, floors: Map<string, Floor>): number | null {
  if (a.floorId !== b.floorId) return null;
  const floor = floors.get(a.floorId);
  if (!floor) return null;
  return Math.hypot(a.x - b.x, a.y - b.y) * floor.metersPerUnit;
}

/**
 * Build an adjacency list. Edge lengths come from `distanceM` when supplied,
 * otherwise from node coordinates × floor scale. Cross-floor edges without an
 * explicit distance are rejected rather than guessed.
 */
export function buildGraph(nodes: NavNode[], edges: NavEdge[], floors: Floor[]): NavGraph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const floorMap = new Map(floors.map((f) => [f.id, f]));
  const adjacency = new Map<string, GraphEdge[]>();
  const rejectedEdges: NavGraph["rejectedEdges"] = [];
  for (const n of nodes) adjacency.set(n.id, []);

  for (const edge of edges) {
    const from = nodeMap.get(edge.fromNodeId);
    const to = nodeMap.get(edge.toNodeId);
    if (!from || !to) {
      rejectedEdges.push({ edge, reason: "unknown_node" });
      continue;
    }
    if (from.id === to.id) {
      rejectedEdges.push({ edge, reason: "self_loop" });
      continue;
    }
    const distanceM = edge.distanceM ?? planarDistanceM(from, to, floorMap);
    if (distanceM == null || !Number.isFinite(distanceM) || distanceM < 0) {
      rejectedEdges.push({ edge, reason: "unknown_distance" });
      continue;
    }
    adjacency.get(from.id)!.push({ edge, to: to.id, distanceM });
    if (edge.bidirectional) adjacency.get(to.id)!.push({ edge, to: from.id, distanceM });
  }
  return { nodes: nodeMap, floors: floorMap, adjacency, rejectedEdges };
}

export interface RouteOptions {
  /** Only use edges marked accessible (no stairs etc.). */
  accessibleOnly?: boolean;
  /** Additional edges to treat as blocked (e.g. user-reported). */
  avoidEdgeIds?: Iterable<string>;
  avoidEdgeKinds?: Iterable<NavEdgeKind>;
  /** Restriction labels the user is allowed to pass (e.g. "staff_only"). */
  allowedRestrictions?: Iterable<string>;
  /**
   * Extra cost (metres-equivalent) per edge kind, used only for choosing the
   * route — reported distances stay physical.
   */
  kindPenaltyM?: Partial<Record<NavEdgeKind, number>>;
  /**
   * Cost multiplier per edge kind (≥ 1), e.g. outdoor × 4 to prefer indoor
   * routes in summer heat. Only affects the choice of route.
   */
  kindCostFactor?: Partial<Record<NavEdgeKind, number>>;
}

export function edgeUsable(e: NavEdge, opts: NormalizedOptions): boolean {
  if (e.blocked) return false;
  if (opts.avoidEdgeIds.has(e.id)) return false;
  if (opts.avoidEdgeKinds.has(e.kind)) return false;
  if (opts.accessibleOnly && !e.accessible) return false;
  if (e.restriction && !opts.allowedRestrictions.has(e.restriction)) return false;
  return true;
}

export interface NormalizedOptions {
  accessibleOnly: boolean;
  avoidEdgeIds: Set<string>;
  avoidEdgeKinds: Set<NavEdgeKind>;
  allowedRestrictions: Set<string>;
  kindPenaltyM: Partial<Record<NavEdgeKind, number>>;
  kindCostFactor: Partial<Record<NavEdgeKind, number>>;
}

export function normalizeOptions(o: RouteOptions = {}): NormalizedOptions {
  return {
    accessibleOnly: !!o.accessibleOnly,
    avoidEdgeIds: new Set(o.avoidEdgeIds ?? []),
    avoidEdgeKinds: new Set(o.avoidEdgeKinds ?? []),
    allowedRestrictions: new Set(o.allowedRestrictions ?? []),
    kindPenaltyM: o.kindPenaltyM ?? {},
    kindCostFactor: o.kindCostFactor ?? {},
  };
}
