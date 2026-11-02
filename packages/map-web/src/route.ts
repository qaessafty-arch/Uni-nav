import type { NavNode, Route } from "@campusnav/core";

/** Split a multi-floor route into contiguous polylines on one floor. */
export function routeSegmentsForFloor(route: Route | null | undefined, floorId: string): NavNode[][] {
  if (!route) return [];
  const segments: NavNode[][] = [];
  let current: NavNode[] = [];
  for (const n of route.nodes) {
    if (n.floorId === floorId) current.push(n);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}
