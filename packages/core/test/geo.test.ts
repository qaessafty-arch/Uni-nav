import { describe, expect, it } from "vitest";
import { buildGraph, findRoute, haversineM, polylineLengthM, routeOutdoorGeometry, suggestWalkway, walkwaysFromOverpass, type LngLat } from "../src";
import { e, floor, n } from "./fixtures";

// Synthetic walkway network (NOT real OpenStreetMap data) near 36.14 N, 44.02 E:
// an L-shaped footpath around a lawn, plus a shortcut with steps.
const A: LngLat = [44.0200, 36.1400];
const corner: LngLat = [44.0200, 36.1410];
const B: LngLat = [44.0215, 36.1410];
const ways = [
  { points: [A, [44.0200, 36.1405] as LngLat, corner] },
  { points: [corner, [44.0207, 36.1410] as LngLat, B] },
  { points: [A, B], steps: true }, // diagonal staircase shortcut
];

describe("real-world distances", () => {
  it("measures metres on the ground", () => {
    expect(haversineM([44, 36], [44, 37])).toBeGreaterThan(111_000);
    expect(haversineM([44, 36], [44, 37])).toBeLessThan(111_400);
    expect(polylineLengthM([A, corner, B])).toBeCloseTo(haversineM(A, corner) + haversineM(corner, B), 6);
  });
});

describe("walkway suggestions (route along real paths)", () => {
  it("follows the paths, not a straight line, and can avoid steps", () => {
    const any = suggestWalkway(ways, A, B)!;
    expect(any.usesSteps).toBe(true); // the diagonal is shorter
    const stepFree = suggestWalkway(ways, A, B, { stepFree: true })!;
    expect(stepFree.usesSteps).toBe(false);
    expect(stepFree.path).toContainEqual(corner);
    expect(stepFree.lengthM).toBeGreaterThan(any.lengthM);
    expect(stepFree.lengthM).toBeCloseTo(polylineLengthM([A, corner, B]), 3);
  });

  it("joins buildings to the nearest path and reports the gap", () => {
    const nearA: LngLat = [44.01995, 36.14]; // ~4.5 m west of A
    const s = suggestWalkway(ways, nearA, B, { stepFree: true })!;
    expect(s.path[0]).toEqual(nearA);
    expect(s.gapStartM).toBeGreaterThan(3);
    expect(s.gapStartM).toBeLessThan(6);
    expect(suggestWalkway(ways, [44.1, 36.2], B)).toBeNull(); // far from any path
  });

  it("reads walkable ways from an Overpass response and drops private/motorway ones", () => {
    const json = {
      elements: [
        { type: "way", tags: { highway: "footway" }, geometry: [{ lat: 36.14, lon: 44.02 }, { lat: 36.141, lon: 44.02 }] },
        { type: "way", tags: { highway: "steps" }, geometry: [{ lat: 36.14, lon: 44.02 }, { lat: 36.1405, lon: 44.021 }] },
        { type: "way", tags: { highway: "service", access: "private" }, geometry: [{ lat: 36.14, lon: 44.02 }, { lat: 36.15, lon: 44.03 }] },
        { type: "way", tags: { highway: "motorway" }, geometry: [{ lat: 36.14, lon: 44.02 }, { lat: 36.15, lon: 44.03 }] },
        { type: "node", lat: 1, lon: 2 },
      ],
    };
    const w = walkwaysFromOverpass(json);
    expect(w).toHaveLength(2);
    expect(w[0]!.points[0]).toEqual([44.02, 36.14]);
    expect(w[1]!.steps).toBe(true);
  });
});

describe("routing between buildings on real paths", () => {
  // Two buildings, one floor each; the outdoor edge carries a real-world path and no typed length.
  const floors = [floor("F1", 0, "b1"), floor("F2", 0, "b2")];
  const nodes = [n("in1", "F1", 0, 0), n("e1", "F1", 10, 0, "building_entrance"), n("e2", "F2", 0, 0, "building_entrance"), n("in2", "F2", 10, 0)];
  const path: LngLat[] = [A, corner, B];
  const edges = [e("a", "in1", "e1"), e("out", "e1", "e2", "outdoor", { geometry: path }), e("b", "e2", "in2")];

  it("measures the outdoor leg along its real path", () => {
    const g = buildGraph(nodes, edges, floors);
    expect(g.rejectedEdges).toHaveLength(0);
    const r = findRoute(g, "in1", "in2");
    if (!r.ok) throw new Error("no route");
    expect(r.route.distanceM).toBeCloseTo(10 + polylineLengthM(path) + 10, 3);
  });

  it("draws the outdoor part in walking order, reversed when walked backwards", () => {
    const g = buildGraph(nodes, edges, floors);
    const fwd = findRoute(g, "in1", "in2");
    const back = findRoute(g, "in2", "in1");
    if (!fwd.ok || !back.ok) throw new Error("no route");
    expect(routeOutdoorGeometry(fwd.route.legs).parts).toEqual([path]);
    expect(routeOutdoorGeometry(back.route.legs).parts).toEqual([[...path].reverse()]);
    const noGeo = buildGraph(nodes, edges.map((x) => (x.id === "out" ? { ...x, geometry: null, distanceM: 120 } : x)), floors);
    const r = findRoute(noGeo, "in1", "in2");
    if (!r.ok) throw new Error("no route");
    expect(routeOutdoorGeometry(r.route.legs)).toEqual({ parts: [], missing: 1 });
  });
});

import { buildingHeightM, outlineFromGeoJSON, STOREY_HEIGHT_M } from "../src";

describe("3D real map helpers", () => {
  it("estimates height from above-ground floors, or uses the staff-entered height", () => {
    expect(buildingHeightM(null, [0, 1, 2])).toBeCloseTo(3 * STOREY_HEIGHT_M + 1);
    expect(buildingHeightM(null, [-1, 0])).toBeCloseTo(STOREY_HEIGHT_M + 1); // basements don't add height
    expect(buildingHeightM({ heightM: 22 }, [0])).toBe(22);
    expect(buildingHeightM(null, [])).toBeCloseTo(STOREY_HEIGHT_M + 1);
  });
  it("takes a clicked map building's outer ring as an outline", () => {
    const sq = [[44, 36], [44.001, 36], [44.001, 36.001], [44, 36.001], [44, 36]];
    expect(outlineFromGeoJSON({ type: "Polygon", coordinates: [sq, [[44.0002, 36.0002], [44.0003, 36.0002], [44.0003, 36.0003], [44.0002, 36.0002]]] })).toEqual([[44, 36], [44.001, 36], [44.001, 36.001], [44, 36.001]]);
    const small = [[45, 36], [45.0001, 36], [45.0001, 36.0001], [45, 36]];
    expect(outlineFromGeoJSON({ type: "MultiPolygon", coordinates: [[small], [sq]] })).toHaveLength(4); // the largest part wins
    expect(outlineFromGeoJSON({ type: "LineString", coordinates: sq })).toBeNull();
    expect(outlineFromGeoJSON({ type: "Polygon", coordinates: [[[44, 36], [44.1, 36], [44, 36]]] })).toBeNull();
  });
});

import { pickOutlineAt, pointInRing, sameOutline } from "../src";

describe("picking a building from the base map", () => {
  const poly = (x: number, y: number, w: number, h: number) => ({ type: "Polygon", coordinates: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]] });
  const big = poly(44.0, 36.0, 0.01, 0.01); // whole-site shape
  const a = poly(44.002, 36.002, 0.001, 0.001);
  const b = poly(44.006, 36.006, 0.001, 0.001);
  it("takes the smallest shape that contains the click, so a big overlapping shape can't swallow every click", () => {
    expect(pickOutlineAt([big, a, b], [44.0025, 36.0025])![0]).toEqual([44.002, 36.002]);
    expect(pickOutlineAt([big, a, b], [44.0065, 36.0065])![0]).toEqual([44.006, 36.006]);
    expect(pickOutlineAt([big, a, b], [44.009, 36.009])![0]).toEqual([44.0, 36.0]); // only the big one contains it
    expect(pickOutlineAt([], [44, 36])).toBeNull();
  });
  it("point-in-polygon and outline equality", () => {
    expect(pointInRing([0.5, 0.5], [[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(true);
    expect(pointInRing([1.5, 0.5], [[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
    expect(sameOutline([[0, 0], [1, 0], [1, 1]], [[1, 1], [0, 0], [1, 0]])).toBe(true);
    expect(sameOutline([[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [2, 1]])).toBe(false);
  });
});

describe("a campus block mapped as one multi-part building", () => {
  it("picks the part under the pointer, not the largest part", () => {
    const part = (x: number, y: number, w: number, h: number) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
    const block = { type: "MultiPolygon", coordinates: [part(44.0, 36.0, 0.004, 0.0005), part(44.0, 36.002, 0.001, 0.001), part(44.003, 36.002, 0.0008, 0.0008)] };
    expect(pickOutlineAt([block], [44.0005, 36.0025])![0]).toEqual([44.0, 36.002]);
    expect(pickOutlineAt([block], [44.0034, 36.0024])![0]).toEqual([44.003, 36.002]);
    expect(pickOutlineAt([block], [44.002, 36.0002])![0]).toEqual([44.0, 36.0]); // the long one, only when pointing at it
  });
});
