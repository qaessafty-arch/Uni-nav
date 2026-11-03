import { describe, expect, it } from "vitest";
import { auditCampus, freeRoomsAt, leaveAdvice, type CampusBundle } from "@campusnav/core";
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
