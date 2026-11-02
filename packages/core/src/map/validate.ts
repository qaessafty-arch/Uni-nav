import type { Floor, MapElement, NavEdge, NavNode, QrCheckpoint, Room, Shape } from "../model/types";
import { buildGraph, reachableFrom } from "../navigation";

export type MapIssueCode =
  | "DUPLICATE_ID"
  | "DUPLICATE_ROOM_CODE"
  | "ROOM_MISSING_CODE"
  | "ROOM_NO_ENTRANCE"
  | "ROOM_ENTRANCE_UNKNOWN"
  | "ROOM_ENTRANCE_WRONG_FLOOR"
  | "ROOM_UNREACHABLE"
  | "ROOM_NO_MAP_ELEMENT"
  | "ELEMENT_ROOM_UNKNOWN"
  | "ELEMENT_OUT_OF_BOUNDS"
  | "EDGE_UNKNOWN_NODE"
  | "EDGE_SELF_LOOP"
  | "EDGE_UNKNOWN_DISTANCE"
  | "NODE_ISOLATED"
  | "NODE_OUT_OF_BOUNDS"
  | "FLOOR_NOT_CONNECTED"
  | "VERTICAL_NODE_NO_LINK"
  | "CHECKPOINT_UNKNOWN_NODE"
  | "CHECKPOINT_UNREACHABLE";

export interface MapIssue {
  severity: "error" | "warning";
  code: MapIssueCode;
  refId: string;
  floorId?: string;
  detail?: string;
}

export interface MapValidationInput {
  floors: Floor[];
  rooms: Room[];
  mapElements: MapElement[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
  checkpoints?: Pick<QrCheckpoint, "id" | "nodeId">[];
}

function shapeBounds(s: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
  if (s.type === "rect") return { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h };
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Validate the map asset + navigation graph of one or more floors.
 * Used by the admin map editor before saving and by CI on seed data.
 */
export function validateMap(input: MapValidationInput): MapIssue[] {
  const issues: MapIssue[] = [];
  const floorMap = new Map(input.floors.map((f) => [f.id, f]));
  const nodeMap = new Map(input.navNodes.map((n) => [n.id, n]));

  // Duplicate ids across all map collections
  const seen = new Map<string, string>();
  const collections: [string, { id: string }[]][] = [
    ["room", input.rooms],
    ["element", input.mapElements],
    ["node", input.navNodes],
    ["edge", input.navEdges],
  ];
  for (const [label, list] of collections) {
    const local = new Set<string>();
    for (const item of list) {
      if (local.has(item.id)) issues.push({ severity: "error", code: "DUPLICATE_ID", refId: item.id, detail: label });
      local.add(item.id);
      const prev = seen.get(item.id);
      if (prev && prev !== label) issues.push({ severity: "error", code: "DUPLICATE_ID", refId: item.id, detail: `${prev}/${label}` });
      seen.set(item.id, label);
    }
  }

  // Edges
  for (const e of input.navEdges) {
    if (!nodeMap.has(e.fromNodeId) || !nodeMap.has(e.toNodeId)) issues.push({ severity: "error", code: "EDGE_UNKNOWN_NODE", refId: e.id });
    else if (e.fromNodeId === e.toNodeId) issues.push({ severity: "error", code: "EDGE_SELF_LOOP", refId: e.id });
    else {
      const a = nodeMap.get(e.fromNodeId)!;
      const b = nodeMap.get(e.toNodeId)!;
      if (a.floorId !== b.floorId && e.distanceM == null) issues.push({ severity: "error", code: "EDGE_UNKNOWN_DISTANCE", refId: e.id });
    }
  }

  // Node degrees and bounds
  const degree = new Map<string, number>();
  for (const e of input.navEdges) {
    degree.set(e.fromNodeId, (degree.get(e.fromNodeId) ?? 0) + 1);
    degree.set(e.toNodeId, (degree.get(e.toNodeId) ?? 0) + 1);
  }
  for (const n of input.navNodes) {
    if (!degree.get(n.id)) issues.push({ severity: "warning", code: "NODE_ISOLATED", refId: n.id, floorId: n.floorId });
    const f = floorMap.get(n.floorId);
    if (f && (n.x < 0 || n.y < 0 || n.x > f.width || n.y > f.height))
      issues.push({ severity: "warning", code: "NODE_OUT_OF_BOUNDS", refId: n.id, floorId: n.floorId });
    if ((n.kind === "stairs" || n.kind === "elevator") && input.floors.length > 1) {
      const hasVertical = input.navEdges.some((e) => {
        if (e.fromNodeId !== n.id && e.toNodeId !== n.id) return false;
        const other = nodeMap.get(e.fromNodeId === n.id ? e.toNodeId : e.fromNodeId);
        return !!other && other.floorId !== n.floorId;
      });
      if (!hasVertical) issues.push({ severity: "warning", code: "VERTICAL_NODE_NO_LINK", refId: n.id, floorId: n.floorId });
    }
  }

  // Elements
  const roomIds = new Set(input.rooms.map((r) => r.id));
  const elementRoomIds = new Set<string>();
  for (const el of input.mapElements) {
    if (el.roomId) {
      elementRoomIds.add(el.roomId);
      if (!roomIds.has(el.roomId)) issues.push({ severity: "error", code: "ELEMENT_ROOM_UNKNOWN", refId: el.id, floorId: el.floorId });
    }
    const f = floorMap.get(el.floorId);
    if (f) {
      const b = shapeBounds(el.shape);
      if (b.minX < 0 || b.minY < 0 || b.maxX > f.width || b.maxY > f.height)
        issues.push({ severity: "warning", code: "ELEMENT_OUT_OF_BOUNDS", refId: el.id, floorId: el.floorId });
    }
  }

  // Rooms
  const graph = buildGraph(input.navNodes, input.navEdges, input.floors);
  const codeSeen = new Map<string, string>();
  // Reachability anchor: the largest connected component (by node count).
  const anchor = largestComponent(graph, input.navNodes);
  for (const r of input.rooms) {
    if (!r.code?.trim()) issues.push({ severity: "error", code: "ROOM_MISSING_CODE", refId: r.id, floorId: r.floorId });
    const codeKey = `${r.buildingId}::${r.code.trim().toLowerCase()}`;
    if (r.code && codeSeen.has(codeKey)) issues.push({ severity: "error", code: "DUPLICATE_ROOM_CODE", refId: r.id, floorId: r.floorId, detail: r.code });
    codeSeen.set(codeKey, r.id);
    if (!elementRoomIds.has(r.id) && input.mapElements.some((e) => e.floorId === r.floorId))
      issues.push({ severity: "warning", code: "ROOM_NO_MAP_ELEMENT", refId: r.id, floorId: r.floorId });
    if (!r.entranceNodeId) {
      issues.push({ severity: "error", code: "ROOM_NO_ENTRANCE", refId: r.id, floorId: r.floorId });
      continue;
    }
    const entrance = nodeMap.get(r.entranceNodeId);
    if (!entrance) {
      issues.push({ severity: "error", code: "ROOM_ENTRANCE_UNKNOWN", refId: r.id, floorId: r.floorId });
      continue;
    }
    if (entrance.floorId !== r.floorId) issues.push({ severity: "error", code: "ROOM_ENTRANCE_WRONG_FLOOR", refId: r.id, floorId: r.floorId });
    if (anchor && !anchor.has(entrance.id)) issues.push({ severity: "error", code: "ROOM_UNREACHABLE", refId: r.id, floorId: r.floorId });
  }

  // Floors connected to the main component
  if (anchor && input.floors.length > 1) {
    for (const f of input.floors) {
      const floorNodes = input.navNodes.filter((n) => n.floorId === f.id);
      if (floorNodes.length && !floorNodes.some((n) => anchor.has(n.id)))
        issues.push({ severity: "error", code: "FLOOR_NOT_CONNECTED", refId: f.id, floorId: f.id });
    }
  }

  // Checkpoints
  for (const c of input.checkpoints ?? []) {
    const n = nodeMap.get(c.nodeId);
    if (!n) issues.push({ severity: "error", code: "CHECKPOINT_UNKNOWN_NODE", refId: c.id });
    else if (anchor && !anchor.has(n.id)) issues.push({ severity: "error", code: "CHECKPOINT_UNREACHABLE", refId: c.id, floorId: n.floorId });
  }

  return issues;
}

function largestComponent(graph: ReturnType<typeof buildGraph>, nodes: NavNode[]): Set<string> | null {
  // Treat the graph as undirected for component detection.
  const undirected = new Map<string, Set<string>>();
  for (const n of nodes) undirected.set(n.id, new Set());
  for (const [from, list] of graph.adjacency) {
    for (const ge of list) {
      if (ge.edge.blocked) continue;
      undirected.get(from)?.add(ge.to);
      undirected.get(ge.to)?.add(from);
    }
  }
  const visited = new Set<string>();
  let best: Set<string> | null = null;
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const comp = new Set<string>([n.id]);
    const stack = [n.id];
    visited.add(n.id);
    while (stack.length) {
      const id = stack.pop()!;
      for (const nb of undirected.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          comp.add(nb);
          stack.push(nb);
        }
      }
    }
    if (!best || comp.size > best.size) best = comp;
  }
  return best;
}

export { reachableFrom };
