import { describe, expect, it } from "vitest";
import { buildSearchIndex, executeIntent, planRouteToRoom, RuleBasedIntentParser, search, validateMap, buildGraph, findRoute } from "@campusnav/core";
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
    const a = executeIntent(p.parse("Where is the Demo Cafeteria?"), bundle);
    expect(a.kind).toBe("results");
    expect(executeIntent(p.parse("Where is the swimming pool?"), bundle).kind).toBe("not_found");
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
