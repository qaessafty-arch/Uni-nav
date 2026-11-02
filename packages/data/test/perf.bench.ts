import { bench, describe } from "vitest";
import { buildGraph, findRoute, planRouteToRoom } from "@campusnav/core";
import { demoBundle } from "../src";
import { demoCheckpoints, did } from "../src/demo/dataset";
import { gridGraph } from "./grid";

const bundle = demoBundle();
const big = gridGraph(60, 60, 4); // 14,400 nodes — far larger than a typical building
const bigGraph = buildGraph(big.nodes, big.edges, big.floors);

describe("routing", () => {
  bench("demo: entrance → Room 204 (3 floors)", () => {
    planRouteToRoom(bundle, demoCheckpoints[0]!.nodeId, did("eng-room-204"));
  });
  bench("synthetic 14.4k-node graph corner → corner", () => {
    findRoute(bigGraph, big.first, big.last);
  });
});
