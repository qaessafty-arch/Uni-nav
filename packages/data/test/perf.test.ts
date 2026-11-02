import { describe, expect, it } from "vitest";
import { buildGraph, findRoute, planRouteToRoom } from "@campusnav/core";
import { demoBundle } from "../src";
import { demoCheckpoints, did } from "../src/demo/dataset";
import { gridGraph } from "./grid";

/** Guards the < 200 ms routing target. Timings are printed so the performance report uses measured numbers. */
describe("routing performance", () => {
  it("demo building route well under 200 ms", () => {
    const bundle = demoBundle();
    planRouteToRoom(bundle, demoCheckpoints[0]!.nodeId, did("eng-room-204")); // warm graph cache
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) planRouteToRoom(bundle, demoCheckpoints[0]!.nodeId, did("eng-room-204"));
    const avg = (performance.now() - t0) / 100;
    console.log(`[perf] demo route avg ${avg.toFixed(3)} ms`);
    expect(avg).toBeLessThan(200);
  });
  it("14,400-node synthetic graph under 200 ms", () => {
    const g = gridGraph(60, 60, 4);
    const graph = buildGraph(g.nodes, g.edges, g.floors);
    const t0 = performance.now();
    const r = findRoute(graph, g.first, g.last);
    const ms = performance.now() - t0;
    console.log(`[perf] synthetic ${g.nodes.length} nodes / ${g.edges.length} edges: ${ms.toFixed(1)} ms`);
    expect(r.ok).toBe(true);
    expect(ms).toBeLessThan(200);
  });
});
