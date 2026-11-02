import type { Floor, NavEdge, NavNode } from "@campusnav/core";

/** Synthetic multi-floor grid graph for performance testing. */
export function gridGraph(w: number, h: number, levels: number) {
  const floors: Floor[] = [];
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  const id = (l: number, x: number, y: number) => `n${l}_${x}_${y}`;
  for (let l = 0; l < levels; l++) {
    floors.push({ id: `f${l}`, universityId: "u", buildingId: "b", level: l, name: { en: `${l}` }, width: w * 10, height: h * 10, metersPerUnit: 0.5 });
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h; y++) {
        nodes.push({ id: id(l, x, y), universityId: "u", floorId: `f${l}`, x: x * 10, y: y * 10, kind: "corridor" });
        const mk = (b: string, kind: NavEdge["kind"] = "corridor", distanceM: number | null = null) =>
          edges.push({ id: `${id(l, x, y)}-${b}`, universityId: "u", fromNodeId: id(l, x, y), toNodeId: b, kind, distanceM, accessible: true, bidirectional: true, blocked: false });
        if (x + 1 < w) mk(id(l, x + 1, y));
        if (y + 1 < h) mk(id(l, x, y + 1));
        if (l + 1 < levels && x % 15 === 0 && y % 15 === 0) mk(id(l + 1, x, y), "stairs", 12);
      }
  }
  return { floors, nodes, edges, first: id(0, 0, 0), last: id(levels - 1, w - 1, h - 1) };
}
