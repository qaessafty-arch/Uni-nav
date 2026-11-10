import { describe, expect, it } from "vitest";
import { auditCampus, bundleForAccess, freeRoomsAt, leaveAdvice, lecturersAvailableAt, todaySummary, type CampusBundle } from "@campusnav/core";
import { demoBundle } from "../src";
import { did } from "../src/demo/dataset";

// Sunday 1 Nov 2026, 09:00 in Erbil (UTC+3).
const SUN_0900 = new Date("2026-11-01T06:00:00Z");
const bundle = demoBundle(new Date("2026-10-30T00:00:00Z"));
const clone = (): CampusBundle => structuredClone(bundle);
const room = (b: CampusBundle, code: string, building = "eng") => b.rooms.find((r) => r.id === did(`${building}-room-${code}`))!;

describe("free rooms (timetable based)", () => {
  it("excludes rooms with a class right now and reports when each free room is next booked", () => {
    const free = freeRoomsAt(bundle, SUN_0900, { minMinutes: 0 });
    const codes = free.map((f) => f.room.code);
    expect(codes).not.toContain("204"); // DEMO-CS101 08:30–10:00
    expect(codes).not.toContain("G01"); // DEMO-CE110 08:30–10:00
    const r107 = free.find((f) => f.room.code === "107")!;
    expect(r107.freeUntil).toBe("10:30");
    expect(r107.minutesFree).toBe(90);
    expect(free.every((f) => ["lecture_hall", "classroom"].includes(f.room.type))).toBe(true);
  });

  it("respects the minimum free time and sorts longest-free first", () => {
    const free = freeRoomsAt(bundle, SUN_0900, { minMinutes: 120 });
    expect(free.some((f) => f.room.code === "107")).toBe(false);
    expect(free[0]!.minutesFree).toBeNull(); // free for the rest of the day comes first
  });

  it("treats a cancelled class as free and excludes rooms closed right now", () => {
    const b = clone();
    const entry = b.timetable.find((t) => t.roomId === room(b, "204").id && t.day === 0)!;
    b.scheduleChanges.push({ id: "x", universityId: entry.universityId, entryId: entry.id, date: "2026-11-01", type: "cancelled" });
    const freed = freeRoomsAt(b, SUN_0900, { minMinutes: 0 }).find((f) => f.room.code === "204");
    expect(freed?.freedByCancellation).toBe(true);

    b.closures = [{ id: "c", universityId: entry.universityId, targetType: "room", targetId: room(b, "204").id, reason: { en: "x" }, startsAt: "2026-10-01T00:00:00Z" }];
    expect(freeRoomsAt(b, SUN_0900, { minMinutes: 0 }).some((f) => f.room.code === "204")).toBe(false);
  });
});

describe("leave-by advice", () => {
  it("subtracts the walk and a buffer from the time to class", () => {
    expect(leaveAdvice(30 * 60, 5 * 60)).toMatchObject({ status: "relax", leaveInSeconds: 23 * 60 });
    expect(leaveAdvice(12 * 60, 4 * 60).status).toBe("leave_soon");
    expect(leaveAdvice(6 * 60, 4 * 60).status).toBe("leave_now");
    expect(leaveAdvice(3 * 60, 4 * 60).status).toBe("late");
  });
});

describe("campus data health audit", () => {
  it("finds no errors in the demo campus and every room is reachable", () => {
    const { issues, stats } = auditCampus(bundle);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(stats.roomsReachable).toBe(stats.rooms);
    expect(stats.score).toBe(100);
  });

  it("flags a room whose only corridor link is removed", () => {
    const b = clone();
    const r = room(b, "204");
    b.navEdges = b.navEdges.filter((e) => e.fromNodeId !== r.entranceNodeId && e.toNodeId !== r.entranceNodeId);
    const { issues, stats } = auditCampus(b);
    expect(issues).toContainEqual(expect.objectContaining({ code: "ROOM_UNREACHABLE", targetId: r.id }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "NODE_ISOLATED", targetId: r.entranceNodeId }));
    expect(stats.score).toBeLessThan(100);
  });

  it("flags a one-way trap: you can get in but never back out", () => {
    const b = clone();
    const r = room(b, "204");
    b.navEdges = b.navEdges.map((e) =>
      e.toNodeId === r.entranceNodeId ? { ...e, bidirectional: false } : e.fromNodeId === r.entranceNodeId ? { ...e, fromNodeId: e.toNodeId, toNodeId: e.fromNodeId, bidirectional: false } : e,
    );
    expect(auditCampus(b).issues).toContainEqual(expect.objectContaining({ code: "ROOM_TRAP", targetId: r.id }));
  });

  it("flags a room marked step-free that only stairs reach", () => {
    const b = clone();
    // Upper-floor room whose floor is reached by stairs and elevator: break the elevators.
    const upper = b.rooms.find((r) => r.accessible && b.floors.find((f) => f.id === r.floorId)!.level > 0)!;
    b.navEdges = b.navEdges.map((e) => (e.kind === "elevator" ? { ...e, blocked: true } : e));
    expect(auditCampus(b).issues).toContainEqual(expect.objectContaining({ code: "ROOM_STEP_FREE_MISMATCH", targetId: upper.id }));
  });

  it("flags rooms without entrances and checkpoints pointing at deleted nodes", () => {
    const b = clone();
    const r = room(b, "207");
    r.entranceNodeId = null;
    b.checkpoints.push({ id: "ghost", nodeId: "missing-node", label: { en: "x" } });
    const codes = auditCampus(b).issues.map((i) => i.code);
    expect(codes).toContain("ROOM_NO_ENTRANCE");
    expect(codes).toContain("CHECKPOINT_DANGLING");
  });
});

import { planRouteToRoom, routeOptionsFor, nearestRooms, graphForBundle, outdoorMeters } from "@campusnav/core";

describe("between buildings: library and cafeteria are their own buildings", () => {
  const b = demoBundle(new Date("2026-10-30T00:00:00Z"));
  const id = (code: string, building: string) => b.rooms.find((r) => r.id === did(`${building}-room-${code}`))!;
  const lab = id("S001", "sci");
  const reading = id("L001", "lib");

  it("routes from a science lab to the library reading hall across the campus", () => {
    const r = planRouteToRoom(b, lab.entranceNodeId!, reading.id, routeOptionsFor("shortest"));
    if (!r.ok) throw new Error(r.error.code);
    expect(outdoorMeters(r.plan.route.legs)).toBe(60); // the stepped shortcut
    expect(r.plan.steps.some((s) => s.kind === "enter_building")).toBe(true);
  });

  it("step-free avoids the stepped shortcut and goes round via Engineering", () => {
    const r = planRouteToRoom(b, lab.entranceNodeId!, reading.id, routeOptionsFor("step_free"));
    if (!r.ok) throw new Error(r.error.code);
    expect(outdoorMeters(r.plan.route.legs)).toBe(85 + 140);
    expect(r.plan.route.legs.every((l) => l.edge.accessible)).toBe(true);
  });

  it("nearest cafeteria from Engineering is in the cafeteria building", () => {
    const eng204 = id("204", "eng");
    const [first] = nearestRooms(b, graphForBundle(b), eng204.entranceNodeId!, ["cafeteria"]);
    expect(first!.room.buildingId).toBe(b.buildings.find((x) => x.code === "DEMO-CAF")!.id);
    expect(b.rooms.filter((r) => r.type === "cafeteria" || r.type === "library").every((r) => ["DEMO-CAF", "DEMO-LIB"].includes(b.buildings.find((x) => x.id === r.buildingId)!.code))).toBe(true);
  });
});

import { freeRoomScope } from "@campusnav/core";

describe("free rooms are scoped to your major's building and the building you're in", () => {
  const b = demoBundle(new Date("2026-10-30T00:00:00Z"));
  const eng = did("demo-building-eng");
  const sci = did("demo-building-sci");
  const lib = did("demo-building-lib");
  const sciEntrance = b.checkpoints.find((c) => c.id === did("cp-sci-main"))!.nodeId;
  const libEntrance = b.checkpoints.find((c) => c.id === did("cp-lib-main"))!.nodeId;

  it("a Computing student sees Engineering rooms only", () => {
    const s = freeRoomScope(b, did("group-DEMO-CS-Y1-A"), null);
    expect([...s.buildingIds]).toEqual([eng]);
    const rooms = freeRoomsAt(b, SUN_0900, { minMinutes: 0, buildingIds: s.buildingIds });
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => r.room.buildingId === eng)).toBe(true);
  });

  it("a Computing student standing in Science also sees Science rooms", () => {
    const s = freeRoomScope(b, did("group-DEMO-CS-Y1-A"), sciEntrance);
    expect(s.buildingIds).toEqual(new Set([eng, sci]));
    expect(s.hereBuildingId).toBe(sci);
  });

  it("a visitor (no major) sees only the building they are in, and nothing before that", () => {
    expect(freeRoomScope(b, null, null).buildingIds.size).toBe(0);
    expect([...freeRoomScope(b, null, sciEntrance).buildingIds]).toEqual([sci]);
    // The library has no teaching rooms, so a visitor there gets none.
    expect(freeRoomsAt(b, SUN_0900, { minMinutes: 0, buildingIds: freeRoomScope(b, null, libEntrance).buildingIds })).toEqual([]);
    expect(lib).toBeTruthy();
  });
});

describe("today at a glance", () => {
  const CS1 = did("group-DEMO-CS-Y1-A");
  it("lists the student's classes today and counts what is left", () => {
    const t = todaySummary(bundle, SUN_0900, CS1);
    expect(t.date).toBe("2026-11-01");
    expect(t.classes.map((c) => c.startTime)).toEqual(["08:30", "10:30"]);
    expect(t.remaining).toBe(2); // the 08:30 class is still running at 09:00
    expect(todaySummary(bundle, new Date("2026-11-01T08:00:00Z"), CS1).remaining).toBe(1); // 11:00
  });
  it("falls back to the student's own class when none was picked", () => {
    const mine = bundleForAccess(bundle, { kind: "student", departmentId: did("demo-dept-cs"), year: 1 });
    expect(todaySummary(mine, SUN_0900, null).groupId).toBe(CS1);
    expect(todaySummary(mine, SUN_0900, "not-a-group").groupId).toBe(CS1);
    expect(todaySummary(bundleForAccess(bundle, { kind: "visitor" }), SUN_0900).classes).toEqual([]);
  });
  it("counts changed classes and finds lecturers in office hours", () => {
    // Demo change: the CS101 08:30 lecture moves room on Sunday 8 Nov.
    expect(todaySummary(bundle, new Date("2026-11-08T06:00:00Z"), CS1).changed).toBe(1);
    // Lecturer A: Sundays 10:00–12:00.
    const at = (iso: string) => lecturersAvailableAt(bundle, new Date(iso)).map((l) => l.id);
    expect(at("2026-11-01T07:30:00Z")).toContain(did("lect-a"));
    expect(at("2026-11-01T06:00:00Z")).not.toContain(did("lect-a"));
  });
});
