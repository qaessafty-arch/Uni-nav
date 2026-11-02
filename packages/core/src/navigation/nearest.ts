import type { CampusBundle, Room, RoomType } from "../model/types";
import { edgeUsable, normalizeOptions, type NavGraph, type RouteOptions } from "./graph";
import { MinHeap } from "./heap";

/** Walking distance (metres) from `startId` to every reachable node (single-source Dijkstra). */
export function distancesFrom(graph: NavGraph, startId: string, options?: RouteOptions): Map<string, number> {
  const dist = new Map<string, number>();
  if (!graph.nodes.has(startId)) return dist;
  const opts = normalizeOptions(options);
  const settled = new Set<string>();
  const heap = new MinHeap<string>();
  dist.set(startId, 0);
  heap.push(startId, 0);
  while (heap.size > 0) {
    const id = heap.pop()!;
    if (settled.has(id)) continue;
    settled.add(id);
    const d = dist.get(id)!;
    for (const ge of graph.adjacency.get(id) ?? []) {
      if (settled.has(ge.to) || !edgeUsable(ge.edge, opts)) continue;
      const nd = d + ge.distanceM;
      if (nd < (dist.get(ge.to) ?? Infinity)) {
        dist.set(ge.to, nd);
        heap.push(ge.to, nd);
      }
    }
  }
  return dist;
}

export interface NearbyRoom {
  room: Room;
  /** Physical walking distance in metres along the navigation graph. */
  distanceM: number;
}

/**
 * Rooms of the given types ordered by real walking distance from `startId`
 * (not straight-line), honouring the same options as routing. Rooms without a
 * reachable entrance are omitted.
 */
export function nearestRooms(bundle: CampusBundle, graph: NavGraph, startId: string, types: readonly RoomType[], options?: RouteOptions, limit = 10): NearbyRoom[] {
  const dist = distancesFrom(graph, startId, options);
  const wanted = new Set(types);
  const out: NearbyRoom[] = [];
  for (const room of bundle.rooms) {
    if (!wanted.has(room.type) || !room.entranceNodeId) continue;
    const d = dist.get(room.entranceNodeId);
    if (d != null) out.push({ room, distanceM: d });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM || a.room.code.localeCompare(b.room.code, undefined, { numeric: true })).slice(0, limit);
}
