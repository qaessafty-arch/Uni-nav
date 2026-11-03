import { describe, expect, it } from "vitest";
import { buildSearchIndex, executeIntent, planRouteToRoom, RuleBasedIntentParser, search, validateMap, buildGraph, findRoute, relevantClosures, closedEdgeIds, routeOptionsFor, nearestRooms, graphForBundle, problemReportInputSchema } from "@campusnav/core";
import { DemoDataSource, SandboxAdminSource, demoBundle, loadBundle, type AsyncKV } from "../src";
import { demoCheckpoints, did } from "../src/demo/dataset";

const bundle = demoBundle(new Date("2026-11-01T00:00:00Z"));
const memKV = (): AsyncKV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe("demo dataset", () => {
  it("is clearly labeled as demo data", () => {
    expect(bundle.university.dataStatus).toBe("demo");
    expect(bundle.rooms.every((r) => r.dataStatus === "demo" && r.name.en.startsWith("Demo"))).toBe(true);
    expect(bundle.lecturers.every((l) => l.fullName.en.startsWith("Demo"))).toBe(true);
    expect(bundle.buildings.every((b) => b.name.en.startsWith("Demo"))).toBe(true);
  });

  it("passes map validation with no errors", () => {
    const issues = validateMap({ ...bundle, checkpoints: demoCheckpoints });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("uses valid UUIDs for every id (Postgres uuid columns)", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const ids = [...bundle.rooms, ...bundle.navNodes, ...bundle.navEdges, ...bundle.mapElements, ...bundle.timetable].map((x) => x.id);
    expect(ids.every((id) => re.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every navigation edge is usable (no guessed distances)", () => {
    expect(buildGraph(bundle.navNodes, bundle.navEdges, bundle.floors).rejectedEdges).toEqual([]);
  });
});

describe("student flows on demo data", () => {
  const index = buildSearchIndex(bundle);

  it("searches 'Room 204' in English, Sorani and Arabic digits", () => {
    for (const q of ["Room 204", "204", "ژووری ٢٠٤", "غرفة ۲۰۴"]) {
      const top = search(index, q)[0];
      expect(top?.type, q).toBe("room");
      expect((top?.item as { code: string }).code, q).toBe("204");
    }
  });

  it("finds a lecturer by Sorani and Arabic name", () => {
    expect(search(index, "مامۆستای نموونە A", { types: ["lecturer"] })[0]?.id).toBe(did("lect-a"));
    expect(search(index, "المحاضر التجريبي B", { types: ["lecturer"] })[0]?.id).toBe(did("lect-b"));
  });

  it("navigates from the main-entrance checkpoint to Room 204 across floors", () => {
    const start = demoCheckpoints[0]!.nodeId;
    const res = planRouteToRoom(bundle, start, did("eng-room-204"));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.route.floorSequence.length).toBe(3);
    expect(res.plan.steps.at(-1)!.kind).toBe("arrive");
    expect(res.plan.estimate.seconds).toBeGreaterThan(0);
    const acc = planRouteToRoom(bundle, start, did("eng-room-204"), { accessibleOnly: true });
    expect(acc.ok && acc.plan.route.legs.some((l) => l.edge.kind === "elevator")).toBe(true);
    expect(acc.ok && acc.plan.route.legs.some((l) => l.edge.kind === "stairs")).toBe(false);
  });

  it("navigates between buildings", () => {
    const res = planRouteToRoom(bundle, did(`${did("eng-room-204")}-door`), did("sci-room-S101"));
    expect(res.ok && res.plan.route.legs.some((l) => l.edge.kind === "outdoor")).toBe(true);
  });

  it("never routes through the staff-only shortcut for students", () => {
    const res = planRouteToRoom(bundle, did(`${did("eng-room-110")}-door`), did("eng-room-204"));
    expect(res.ok && res.plan.route.legs.some((l) => l.edge.restriction)).toBe(false);
  });

  it("resolves demo QR checkpoints and rejects disabled/expired/unknown codes", async () => {
    const src = new DemoDataSource();
    expect((await src.resolveCheckpoint("https://nav.example/q/DEMOengMainEntrance01")).status).toBe("ok");
    expect((await src.resolveCheckpoint("DEMOdisabledCheckpoint")).status).toBe("disabled");
    expect((await src.resolveCheckpoint("DEMOexpiredCheckpoint1")).status).toBe("expired");
    expect((await src.resolveCheckpoint("ZZZZZZZZZZZZZZZZZZZZ")).status).toBe("unknown");
    expect((await src.resolveCheckpoint("DEMOengMainEntrance01", "another-university")).status).toBe("wrong_university");
  });

  it("does not leak checkpoint tokens in the public bundle", () => {
    expect(JSON.stringify(bundle)).not.toContain("DEMOengMainEntrance01");
  });

  it("assistant answers from campus data only", () => {
    const p = new RuleBasedIntentParser();
    const a = executeIntent(p.parse("Where is the Demo Main Cafeteria?"), bundle);
    expect(a.kind).toBe("results");
    expect(executeIntent(p.parse("Where is the swimming pool?"), bundle).kind).toBe("not_found");
    // Several cafeterias now exist (a whole building plus rooms), so a vague question asks which one.
    expect(executeIntent(p.parse("Where is the cafeteria?"), bundle).kind).toMatch(/clarify|results/);
  });
});

describe("offline cache", () => {
  it("falls back to the cached bundle when the network fails, and says so", async () => {
    const kv = memKV();
    const src = new DemoDataSource();
    const first = await loadBundle(src, kv, bundle.university.id);
    expect(first.origin).toBe("network");
    const failing = { ...src, kind: "demo" as const, getBundle: async () => { throw new Error("offline"); }, listUniversities: src.listUniversities, resolveCheckpoint: src.resolveCheckpoint };
    const second = await loadBundle(failing, kv, bundle.university.id);
    expect(second.origin).toBe("cache");
    await expect(loadBundle(failing, memKV(), bundle.university.id)).rejects.toThrow("offline");
  });
});

describe("admin sandbox", () => {
  it("creates a building, floor and room, records audit entries, and exposes them to the student bundle", async () => {
    const kv = memKV();
    const admin = new SandboxAdminSource(kv);
    await admin.signIn();
    const u = bundle.university.id;
    await admin.upsert("buildings", { id: "b-new", universityId: u, campusId: bundle.campuses[0]!.id, code: "DEMO-NEW", name: { en: "Demo New Building" }, dataStatus: "demo" });
    await admin.upsert("floors", { id: "f-new", universityId: u, buildingId: "b-new", level: 0, name: { en: "Demo G" }, width: 100, height: 100, metersPerUnit: 0.1 });
    await admin.upsert("rooms", { id: "r-new", universityId: u, buildingId: "b-new", floorId: "f-new", code: "N1", name: { en: "Demo N1" }, type: "classroom", accessible: true, dataStatus: "demo" });
    expect((await admin.list("rooms", u)).some((r: { id?: string }) => r.id === "r-new")).toBe(true);
    expect((await admin.auditLog()).length).toBe(3);
    const reopened = new SandboxAdminSource(kv);
    expect(reopened.toBundle().rooms.some((r) => r.id === "r-new")).toBe(true);
    await expect(admin.setMemberRole(u, "x@y.z", "platform_owner")).rejects.toThrow("FORBIDDEN_ROLE");
  });
});

describe("closures, route preferences and nearest facilities (demo data)", () => {
  const now = new Date("2026-11-02T08:00:00Z");
  const bundle = demoBundle(now);
  const start = did(`${did("sci-room-S004")}-door`);
  const goal = did("sci-room-S101");

  it("ships an upcoming (not yet active) demo closure", () => {
    const { active, upcoming } = relevantClosures(bundle, now);
    expect(active).toHaveLength(0);
    expect(upcoming).toHaveLength(1);
  });

  it("routes avoid an active edge closure and report nothing when it has ended", () => {
    const before = planRouteToRoom(bundle, start, goal, {}, now);
    expect(before.ok && before.plan.route.legs.some((l) => l.edge.kind === "stairs")).toBe(true);
    const during = new Date(now.getTime() + 3 * 86_400_000);
    const res = planRouteToRoom(bundle, start, goal, {}, during);
    expect(res.ok).toBe(true);
    expect(res.ok && res.plan.route.legs.some((l) => l.edge.kind === "stairs")).toBe(false);
    expect(res.ok && res.plan.route.legs.some((l) => l.edge.kind === "elevator")).toBe(true);
    const after = new Date(now.getTime() + 10 * 86_400_000);
    const back = planRouteToRoom(bundle, start, goal, {}, after);
    expect(back.ok && back.plan.route.legs.some((l) => l.edge.kind === "stairs")).toBe(true);
  });

  it("a node closure (elevator out of service) blocks every edge touching it", () => {
    const lift = bundle.navNodes.find((n) => n.kind === "elevator" && n.floorId === bundle.floors.find((f) => f.id === bundle.rooms.find((r) => r.id === goal)!.floorId)!.id)!;
    const b2 = { ...bundle, closures: [{ id: "c1", universityId: bundle.university.id, targetType: "node" as const, targetId: lift.id, reason: { en: "Out of service" }, startsAt: "2026-01-01T00:00:00Z", endsAt: null }] };
    const step = planRouteToRoom(b2, start, goal, { accessibleOnly: true }, now);
    expect(step.ok).toBe(false); // no step-free route without the elevator
    expect(closedEdgeIds(b2, now).size).toBeGreaterThan(0);
  });

  it("'fewer stairs' prefers the elevator; 'step-free' never uses stairs; distances stay physical", () => {
    const short = planRouteToRoom(bundle, start, goal, routeOptionsFor("shortest"), now);
    const fewer = planRouteToRoom(bundle, start, goal, routeOptionsFor("fewer_stairs"), now);
    const free = planRouteToRoom(bundle, start, goal, routeOptionsFor("step_free"), now);
    expect(short.ok && fewer.ok && free.ok).toBe(true);
    if (!short.ok || !fewer.ok || !free.ok) return;
    expect(fewer.plan.route.legs.some((l) => l.edge.kind === "stairs")).toBe(false);
    expect(free.plan.route.legs.some((l) => l.edge.kind === "stairs")).toBe(false);
    expect(fewer.plan.route.distanceM).toBeGreaterThanOrEqual(short.plan.route.distanceM);
  });

  it("finds the nearest toilets by walking distance, not straight line", () => {
    const graph = graphForBundle(bundle);
    const from = did(`${did("eng-room-204")}-door`);
    const near = nearestRooms(bundle, graph, from, ["toilet"], {}, 5);
    expect(near.length).toBeGreaterThan(1);
    for (let i = 1; i < near.length; i++) expect(near[i]!.distanceM).toBeGreaterThanOrEqual(near[i - 1]!.distanceM);
    // The closest toilet must be in the same building as the start (the other building is 85 m outdoors away).
    expect(near[0]!.room.buildingId).toBe(bundle.rooms.find((r) => r.id === did("eng-room-204"))!.buildingId);
    const route = planRouteToRoom(bundle, from, near[0]!.room.id, {}, now);
    expect(route.ok && Math.abs(route.plan.route.distanceM - near[0]!.distanceM)).toBeLessThan(1e-6);
  });

  it("validates problem reports: required text, length limit, known categories", () => {
    const base = { universityId: bundle.university.id, category: "blocked_path", message: "The corridor door near 204 is locked." };
    expect(problemReportInputSchema.safeParse(base).success).toBe(true);
    expect(problemReportInputSchema.safeParse({ ...base, message: "x" }).success).toBe(false);
    expect(problemReportInputSchema.safeParse({ ...base, message: "a".repeat(1001) }).success).toBe(false);
    expect(problemReportInputSchema.safeParse({ ...base, category: "spam" }).success).toBe(false);
  });
});
