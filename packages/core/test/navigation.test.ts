import { describe, expect, it } from "vitest";
import { buildGraph, buildInstructions, estimateWalkingTime, findRoute, nearestNode, turnAngle } from "../src";
import { e, floor, n, sample } from "./fixtures";

const settings = { walkingSpeedMps: 1, accessibleWalkingSpeedMps: 0.5, stairsSecondsPerFloor: 20, elevatorSecondsPerFloor: 40 };

describe("pathfinding", () => {
  it("finds the shortest same-floor route", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "A", "C");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.route.nodes.map((x) => x.id)).toEqual(["A", "B", "C"]);
    expect(r.route.distanceM).toBeCloseTo(20);
    expect(r.route.floorSequence).toEqual(["F0"]);
  });

  it("routes across floors via stairs when shortest", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "A", "D");
    expect(r.ok && r.route.nodes.map((x) => x.id)).toEqual(["A", "S0", "S1", "D"]);
    if (r.ok) expect(r.route.floorSequence).toEqual(["F0", "F1"]);
  });

  it("accessible routing avoids stairs and uses the elevator", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "A", "D", { accessibleOnly: true });
    expect(r.ok && r.route.nodes.map((x) => x.id)).toEqual(["A", "B", "L0", "L1", "D"]);
  });

  it("routes between buildings over outdoor connections", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "D", "Y");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.route.nodes.at(-1)!.id).toBe("Y");
    expect(r.route.floorSequence).toEqual(["F1", "F0", "G0"]);
    expect(r.route.distanceM).toBeCloseTo(14.142 + 0 + 10 + 10 + 50 + 10, 1); // elevator path is shorter
  });

  it("avoids blocked corridors and reports unreachable when no alternative exists", () => {
    const { floors, nodes, edges } = sample();
    const blocked = edges.map((x) => (x.id === "AS0" ? { ...x, blocked: true } : x));
    const g = buildGraph(nodes, blocked, floors);
    const r = findRoute(g, "A", "D");
    expect(r.ok && r.route.nodes.map((x) => x.id)).toEqual(["A", "B", "L0", "L1", "D"]);
    const r2 = findRoute(g, "A", "D", { avoidEdgeIds: ["L0L1"] });
    expect(r2).toEqual({ ok: false, error: { code: "UNREACHABLE" } });
  });

  it("returns unreachable for disconnected destinations", () => {
    const floors = [floor("F0", 0)];
    const g = buildGraph([n("a", "F0", 0, 0), n("b", "F0", 5, 5)], [], floors);
    expect(findRoute(g, "a", "b")).toEqual({ ok: false, error: { code: "UNREACHABLE" } });
  });

  it("handles unknown start/destination and same node", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    expect(findRoute(g, "nope", "A")).toEqual({ ok: false, error: { code: "UNKNOWN_START", nodeId: "nope" } });
    expect(findRoute(g, "A", "nope")).toEqual({ ok: false, error: { code: "UNKNOWN_DESTINATION", nodeId: "nope" } });
    const same = findRoute(g, "A", "A");
    expect(same.ok && same.route.distanceM).toBe(0);
  });

  it("respects one-way edges and restrictions", () => {
    const floors = [floor("F0", 0)];
    const nodes = [n("a", "F0", 0, 0), n("b", "F0", 10, 0), n("c", "F0", 20, 0)];
    const edges = [e("ab", "a", "b", "corridor", { bidirectional: false }), e("bc", "b", "c", "corridor", { restriction: "staff_only" })];
    const g = buildGraph(nodes, edges, floors);
    expect(findRoute(g, "b", "a").ok).toBe(false);
    expect(findRoute(g, "a", "c").ok).toBe(false);
    expect(findRoute(g, "a", "c", { allowedRestrictions: ["staff_only"] }).ok).toBe(true);
  });

  it("rejects invalid map data instead of guessing", () => {
    const floors = [floor("F0", 0), floor("F1", 1)];
    const nodes = [n("a", "F0", 0, 0), n("b", "F1", 0, 0)];
    const edges = [e("ab", "a", "b", "stairs"), e("ghost", "a", "zzz"), e("self", "a", "a")];
    const g = buildGraph(nodes, edges, floors);
    expect(g.rejectedEdges.map((r) => [r.edge.id, r.reason])).toEqual([
      ["ab", "unknown_distance"],
      ["ghost", "unknown_node"],
      ["self", "self_loop"],
    ]);
    expect(findRoute(g, "a", "b").ok).toBe(false);
  });

  it("finds the optimal path where greedy would fail (A* correctness)", () => {
    const floors = [floor("F0", 0)];
    // Direct-looking path s→m→t is long (m detour via edge distance), alternative via k is shorter.
    const nodes = [n("s", "F0", 0, 0), n("m", "F0", 5, 0), n("k", "F0", 5, 5), n("t", "F0", 10, 0)];
    const edges = [e("sm", "s", "m", "corridor", { distanceM: 30 }), e("mt", "m", "t"), e("sk", "s", "k"), e("kt", "k", "t")];
    const r = findRoute(buildGraph(nodes, edges, floors), "s", "t");
    expect(r.ok && r.route.nodes.map((x) => x.id)).toEqual(["s", "k", "t"]);
  });

  it("finds nearest node on a floor", () => {
    const { nodes } = sample();
    expect(nearestNode(nodes, "F0", 9, 1)?.id).toBe("B");
    expect(nearestNode(nodes, "nope", 0, 0)).toBeNull();
  });
});

describe("instructions", () => {
  it("produces start/turn/stairs/arrive steps", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "C", "D");
    if (!r.ok) throw new Error("no route");
    const steps = buildInstructions(r.route, g.floors).map((s) => s.kind);
    expect(steps[0]).toBe("start");
    expect(steps.at(-1)).toBe("arrive");
    expect(steps).toContain("elevator_up");
  });

  it("labels building transitions", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "A", "Y");
    if (!r.ok) throw new Error("no route");
    expect(buildInstructions(r.route, g.floors).map((s) => s.kind)).toContain("enter_building");
  });

  it("computes turn angles in screen coordinates", () => {
    // Heading east (0°) then north on screen (90°) is a left turn.
    expect(turnAngle(0, 90)).toBe(90);
    expect(turnAngle(170, -170)).toBe(20);
  });

  it("estimates walking time from configured assumptions only", () => {
    const { floors, nodes, edges } = sample();
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "A", "D");
    if (!r.ok) throw new Error("no route");
    const est = estimateWalkingTime(r.route, settings, g.floors);
    // A→S0 10 m, stairs 1 floor 20 s, S1→D 10 m at 1 m/s
    expect(est.seconds).toBe(40);
    expect(est.isEstimate).toBe(true);
  });
});

describe("instruction merging", () => {
  it("merges consecutive elevator rides into one step", () => {
    const floors = [floor("F0", 0), floor("F1", 1), floor("F2", 2)];
    const nodes = [n("a", "F0", 0, 0, "elevator"), n("b", "F1", 0, 0, "elevator"), n("c", "F2", 0, 0, "elevator"), n("d", "F2", 10, 0)];
    const edges = [e("ab", "a", "b", "elevator", { distanceM: 0 }), e("bc", "b", "c", "elevator", { distanceM: 0 }), e("cd", "c", "d")];
    const g = buildGraph(nodes, edges, floors);
    const r = findRoute(g, "a", "d");
    if (!r.ok) throw new Error("no route");
    const steps = buildInstructions(r.route, g.floors);
    const lifts = steps.filter((s) => s.kind === "elevator_up");
    expect(lifts).toHaveLength(1);
    expect(lifts[0]).toMatchObject({ toFloorId: "F2", floors: 2 });
  });
});
