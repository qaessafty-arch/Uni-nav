import type { CampusBundle, NavNode } from "../model/types";
import { buildGraph, edgeUsable, normalizeOptions, type NavGraph, type RouteOptions } from "./graph";

/**
 * Campus data health check: walks the real navigation graph the router uses and
 * reports what would break a student's route before a student finds it. Pure
 * function over a bundle, so it runs the same in the admin dashboard, in tests
 * and in CI.
 */

export type AuditSeverity = "error" | "warning" | "info";
export type AuditCode =
  | "BUILDING_NO_ENTRANCE"
  | "BUILDING_NOT_ON_MAP"
  | "FLOOR_NO_PLAN"
  | "FLOOR_UNREACHABLE"
  | "ROOM_NO_ENTRANCE"
  | "ROOM_UNREACHABLE"
  | "ROOM_TRAP"
  | "ROOM_STEP_FREE_MISMATCH"
  | "EDGE_REJECTED"
  | "EDGE_ONE_WAY"
  | "NODE_ISOLATED"
  | "CHECKPOINT_DANGLING"
  | "CHECKPOINT_UNREACHABLE";

export const AUDIT_SEVERITY: Record<AuditCode, AuditSeverity> = {
  BUILDING_NO_ENTRANCE: "error",
  ROOM_NO_ENTRANCE: "error",
  ROOM_UNREACHABLE: "error",
  ROOM_TRAP: "error",
  FLOOR_UNREACHABLE: "error",
  CHECKPOINT_DANGLING: "error",
  CHECKPOINT_UNREACHABLE: "warning",
  EDGE_REJECTED: "warning",
  ROOM_STEP_FREE_MISMATCH: "warning",
  NODE_ISOLATED: "warning",
  FLOOR_NO_PLAN: "warning",
  EDGE_ONE_WAY: "info",
  BUILDING_NOT_ON_MAP: "info",
};

export interface AuditIssue {
  code: AuditCode;
  severity: AuditSeverity;
  /** id of the room / floor / building / edge / node / checkpoint concerned */
  targetId: string;
  buildingId: string | null;
  floorId: string | null;
  /** Extra machine-readable detail (e.g. rejection reason). */
  detail?: string;
}

export interface AuditStats {
  rooms: number;
  roomsReachable: number;
  roomsStepFree: number;
  buildings: number;
  floors: number;
  floorsWithPlan: number;
  nodes: number;
  edges: number;
  checkpoints: number;
  /** 0–100: share of rooms a student can actually be routed to, minus penalties for errors. */
  score: number;
}

export interface AuditReport {
  issues: AuditIssue[];
  stats: AuditStats;
}

/** Nodes reachable from `sources` (forward), or that can reach them (reverse = true). */
function reach(graph: NavGraph, sources: string[], opts: RouteOptions, reverse: boolean): Set<string> {
  const o = normalizeOptions(opts);
  let adj = graph.adjacency;
  if (reverse) {
    adj = new Map([...graph.nodes.keys()].map((k) => [k, []]));
    for (const [from, list] of graph.adjacency) for (const ge of list) adj.get(ge.to)!.push({ ...ge, to: from });
  }
  const seen = new Set<string>(sources.filter((s) => graph.nodes.has(s)));
  const queue = [...seen];
  while (queue.length) {
    const id = queue.pop()!;
    for (const ge of adj.get(id) ?? []) {
      if (seen.has(ge.to) || !edgeUsable(ge.edge, o)) continue;
      seen.add(ge.to);
      queue.push(ge.to);
    }
  }
  return seen;
}

export function auditCampus(bundle: CampusBundle): AuditReport {
  const issues: AuditIssue[] = [];
  const graph = buildGraph(bundle.navNodes, bundle.navEdges, bundle.floors);
  const floorById = new Map(bundle.floors.map((f) => [f.id, f]));
  const buildingOfNode = (n: NavNode | undefined) => (n ? floorById.get(n.floorId)?.buildingId ?? null : null);
  const push = (code: AuditCode, targetId: string, buildingId: string | null, floorId: string | null, detail?: string) =>
    issues.push({ code, severity: AUDIT_SEVERITY[code], targetId, buildingId, floorId, detail });

  // Anchors: where a person can arrive from outside.
  const anchors = bundle.navNodes.filter((n) => n.kind === "building_entrance" || n.kind === "outdoor").map((n) => n.id);
  const anyway = reach(graph, anchors, {}, false);
  const back = reach(graph, anchors, {}, true);
  const stepFree = reach(graph, anchors, { accessibleOnly: true }, false);

  const campusHasGeo = bundle.campuses.some((c) => !!c.geo);
  const buildingsWithEntrance = new Set(bundle.navNodes.filter((n) => n.kind === "building_entrance").map((n) => buildingOfNode(n)));
  for (const b of bundle.buildings) {
    const hasFloors = bundle.floors.some((f) => f.buildingId === b.id);
    if (hasFloors && !buildingsWithEntrance.has(b.id)) push("BUILDING_NO_ENTRANCE", b.id, b.id, null);
    if (campusHasGeo ? !b.geo : !b.overview) push("BUILDING_NOT_ON_MAP", b.id, b.id, null);
  }

  const nodesByFloor = new Map<string, NavNode[]>();
  for (const n of bundle.navNodes) nodesByFloor.set(n.floorId, [...(nodesByFloor.get(n.floorId) ?? []), n]);
  const floorsWithPlan = new Set(bundle.mapElements.map((e) => e.floorId));
  for (const f of bundle.floors) {
    if (!floorsWithPlan.has(f.id)) push("FLOOR_NO_PLAN", f.id, f.buildingId, f.id);
    const ns = nodesByFloor.get(f.id) ?? [];
    if (ns.length && buildingsWithEntrance.has(f.buildingId) && !ns.some((n) => anyway.has(n.id))) push("FLOOR_UNREACHABLE", f.id, f.buildingId, f.id);
  }

  let roomsReachable = 0;
  let roomsStepFree = 0;
  const unreachableFloors = new Set(issues.filter((i) => i.code === "FLOOR_UNREACHABLE").map((i) => i.targetId));
  for (const r of bundle.rooms) {
    const node = r.entranceNodeId ? graph.nodes.get(r.entranceNodeId) : undefined;
    if (!node) {
      push("ROOM_NO_ENTRANCE", r.id, r.buildingId, r.floorId);
      continue;
    }
    const inReach = anyway.has(node.id);
    if (inReach) roomsReachable++;
    if (stepFree.has(node.id)) roomsStepFree++;
    // Don't repeat one issue per room when the whole building/floor is already flagged.
    const covered = !buildingsWithEntrance.has(r.buildingId) || unreachableFloors.has(r.floorId);
    if (!inReach && !covered) push("ROOM_UNREACHABLE", r.id, r.buildingId, r.floorId);
    else if (inReach && !back.has(node.id)) push("ROOM_TRAP", r.id, r.buildingId, r.floorId);
    if (inReach && r.accessible && !stepFree.has(node.id)) push("ROOM_STEP_FREE_MISMATCH", r.id, r.buildingId, r.floorId);
  }

  for (const { edge, reason } of graph.rejectedEdges) {
    const n = graph.nodes.get(edge.fromNodeId) ?? graph.nodes.get(edge.toNodeId);
    push("EDGE_REJECTED", edge.id, buildingOfNode(n), n?.floorId ?? null, reason);
  }
  const pairs = new Set(bundle.navEdges.map((e) => `${e.fromNodeId}>${e.toNodeId}`));
  for (const e of bundle.navEdges) {
    if (!e.bidirectional && !pairs.has(`${e.toNodeId}>${e.fromNodeId}`)) {
      const n = graph.nodes.get(e.fromNodeId);
      push("EDGE_ONE_WAY", e.id, buildingOfNode(n), n?.floorId ?? null);
    }
  }
  const degree = new Map<string, number>();
  for (const e of bundle.navEdges) {
    degree.set(e.fromNodeId, (degree.get(e.fromNodeId) ?? 0) + 1);
    degree.set(e.toNodeId, (degree.get(e.toNodeId) ?? 0) + 1);
  }
  for (const n of bundle.navNodes) if (!degree.get(n.id)) push("NODE_ISOLATED", n.id, buildingOfNode(n), n.floorId);

  for (const c of bundle.checkpoints) {
    const n = graph.nodes.get(c.nodeId);
    if (!n) push("CHECKPOINT_DANGLING", c.id, null, null);
    else if (!anyway.has(n.id) && !back.has(n.id)) push("CHECKPOINT_UNREACHABLE", c.id, buildingOfNode(n), n.floorId);
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const rooms = bundle.rooms.length;
  const base = rooms ? (roomsReachable / rooms) * 100 : 0;
  const score = Math.max(0, Math.min(100, Math.round(base - Math.min(30, errors * 2))));
  const order: Record<AuditSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code));

  return {
    issues,
    stats: {
      rooms,
      roomsReachable,
      roomsStepFree,
      buildings: bundle.buildings.length,
      floors: bundle.floors.length,
      floorsWithPlan: bundle.floors.filter((f) => floorsWithPlan.has(f.id)).length,
      nodes: bundle.navNodes.length,
      edges: bundle.navEdges.length,
      checkpoints: bundle.checkpoints.length,
      score,
    },
  };
}
