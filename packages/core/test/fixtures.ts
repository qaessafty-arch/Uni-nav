import type { Floor, NavEdge, NavNode } from "../src";

export const U = "u1";
export const floor = (id: string, level: number, buildingId = "b1"): Floor => ({
  id, universityId: U, buildingId, level, name: { en: `Floor ${level}` }, width: 100, height: 100, metersPerUnit: 1,
});
export const n = (id: string, floorId: string, x: number, y: number, kind: NavNode["kind"] = "corridor"): NavNode => ({
  id, universityId: U, floorId, x, y, kind, label: { en: id },
});
export const e = (id: string, a: string, b: string, kind: NavEdge["kind"] = "corridor", extra: Partial<NavEdge> = {}): NavEdge => ({
  id, universityId: U, fromNodeId: a, toNodeId: b, kind, accessible: kind !== "stairs", bidirectional: true, blocked: false, ...extra,
});

/**
 * Two floors in building b1, one floor in b2.
 *
 *  F0:  A(0,0) — B(10,0) — C(10,10)      S0 stairs at (0,10) linked to A; L0 lift at (20,0) linked to B
 *  F1:  S1(0,10) — D(10,10) — L1(20,0)
 *  G0 (building b2): X(0,0) — Y(10,0); X linked outdoor to C (50 m)
 */
export function sample() {
  const floors = [floor("F0", 0), floor("F1", 1), floor("G0", 0, "b2")];
  const nodes = [
    n("A", "F0", 0, 0, "building_entrance"), n("B", "F0", 10, 0), n("C", "F0", 10, 10, "building_entrance"),
    n("S0", "F0", 0, 10, "stairs"), n("L0", "F0", 20, 0, "elevator"),
    n("S1", "F1", 0, 10, "stairs"), n("D", "F1", 10, 10, "room_entrance"), n("L1", "F1", 20, 0, "elevator"),
    n("X", "G0", 0, 0, "building_entrance"), n("Y", "G0", 10, 0, "room_entrance"),
  ];
  const edges = [
    e("AB", "A", "B"), e("BC", "B", "C"), e("AS0", "A", "S0"), e("BL0", "B", "L0"),
    e("S0S1", "S0", "S1", "stairs", { distanceM: 6 }), e("L0L1", "L0", "L1", "elevator", { distanceM: 0 }),
    e("S1D", "S1", "D"), e("DL1", "D", "L1"),
    e("CX", "C", "X", "outdoor", { distanceM: 50 }), e("XY", "X", "Y"),
  ];
  return { floors, nodes, edges };
}
