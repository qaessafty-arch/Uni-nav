import { describe, expect, it } from "vitest";
import { bundleForAccess, canSeeRoom, emailInDomains, groupsForStudent, programYears, VISITOR } from "@campusnav/core";
import { demoBundle, demoRoster, DemoStudentAuth, DEMO_VERIFY_CODE } from "../src";
import { did } from "../src/demo/dataset";

const bundle = demoBundle(new Date("2026-10-30T00:00:00Z"));
const CS = did("demo-dept-cs");

describe("visitors: buildings and public places only", () => {
  const v = bundleForAccess(bundle, VISITOR);
  it("drops classrooms, lecture halls and labs, and every timetable", () => {
    expect(v.rooms.length).toBeGreaterThan(0);
    expect(v.rooms.every((r) => !["lecture_hall", "classroom", "laboratory", "storage"].includes(r.type))).toBe(true);
    expect(v.rooms.some((r) => r.type === "toilet")).toBe(true);
    expect(v.timetable).toEqual([]);
    expect(v.scheduleChanges).toEqual([]);
    expect(v.groups).toEqual([]);
    expect(v.buildings).toEqual(bundle.buildings); // all buildings still on the map
  });
  it("keeps floor outlines but removes the names of hidden rooms", () => {
    const hidden = new Set(bundle.rooms.filter((r) => !canSeeRoom(r, VISITOR)).map((r) => r.id));
    const linked = bundle.mapElements.filter((e) => e.roomId && hidden.has(e.roomId));
    expect(linked.length).toBeGreaterThan(0);
    expect(v.mapElements.length).toBe(bundle.mapElements.length);
    expect(v.mapElements.some((e) => e.roomId && hidden.has(e.roomId))).toBe(false);
  });
  it("is idempotent", () => {
    expect(bundleForAccess(v, VISITOR).rooms.length).toBe(v.rooms.length);
  });
});

describe("students: own major and year only", () => {
  it("a Computing year-2 student sees all rooms but only Computing stage 2 lectures", () => {
    const s = bundleForAccess(bundle, { kind: "student", departmentId: CS, year: 2 });
    expect(s.rooms.length).toBe(bundle.rooms.length);
    expect(s.groups.map((g) => g.code)).toEqual(["DEMO-CS-Y2-A"]);
    expect(s.timetable.length).toBeGreaterThan(0);
    expect(s.timetable.every((t) => t.groupId === did("group-DEMO-CS-Y2-A"))).toBe(true);
    expect(s.scheduleChanges).toEqual([]); // both demo changes are on stage 1
  });
  it("bachelor programmes have 4 years and every year has a group", () => {
    for (const d of bundle.departments) {
      expect(programYears(d)).toBe(4);
      for (const year of [1, 2, 3, 4]) expect(groupsForStudent(bundle.groups, { kind: "student", departmentId: d.id, year }).length).toBeGreaterThan(0);
    }
  });
  it("staff see everything", () => {
    expect(bundleForAccess(bundle, { kind: "staff" })).toBe(bundle);
  });
});

describe("student email domains", () => {
  it("accepts the domain and its subdomains, rejects others", () => {
    expect(emailInDomains("a.b@su.edu.krd", ["su.edu.krd"])).toBe(true);
    expect(emailInDomains("a@student.su.edu.krd", ["su.edu.krd"])).toBe(true);
    expect(emailInDomains("a@gmail.com", ["su.edu.krd"])).toBe(false);
    expect(emailInDomains("a@evil-su.edu.krd", ["su.edu.krd"])).toBe(false);
    expect(emailInDomains("nope", ["su.edu.krd"])).toBe(false);
  });
});

describe("demo verification flow", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  };
  const U = bundle.university.id;
  it("verifies a roster address with the code and reports major and year", async () => {
    const auth = new DemoStudentAuth(mem());
    const entry = demoRoster.find((r) => r.email.startsWith("cs3@"))!;
    expect(await auth.start(U, "someone@gmail.com")).toMatchObject({ status: "domain_not_allowed" });
    expect(await auth.start(U, entry.email)).toEqual({ status: "demo", code: DEMO_VERIFY_CODE });
    expect(await auth.confirm(U, entry.email, "000000")).toEqual({ status: "invalid_code" });
    expect(await auth.confirm(U, entry.email, DEMO_VERIFY_CODE)).toEqual({ status: "verified", departmentId: CS, year: 3 });
    expect((await auth.status(U)).access).toEqual({ kind: "student", departmentId: CS, year: 3 });
    await auth.signOut();
    expect((await auth.status(U)).access).toEqual(VISITOR);
  });
  it("an address not on the roster can only request, and stays a visitor while pending", async () => {
    const auth = new DemoStudentAuth(mem());
    const email = "new.student@students.demo.example";
    await auth.start(U, email);
    expect(await auth.confirm(U, email, DEMO_VERIFY_CODE)).toEqual({ status: "not_on_roster" });
    expect(await auth.request(U, CS, 1)).toEqual({ status: "pending", departmentId: CS, year: 1 });
    const st = await auth.status(U);
    expect(st.access).toEqual(VISITOR);
    expect(st.pending).toEqual({ departmentId: CS, year: 1 });
  });
});

import { freeRoomsAt } from "@campusnav/core";

describe("free rooms for a student still count other majors' classes", () => {
  it("room 107 is busy at 10:30 for CS stage 2, so a CS stage-1 student sees it free only until then", () => {
    const s = bundleForAccess(bundle, { kind: "student", departmentId: CS, year: 1 });
    expect(s.timetable.some((t) => t.roomId === did("eng-room-107"))).toBe(false); // not their class
    const r107 = freeRoomsAt(s, new Date("2026-11-01T06:00:00Z"), { minMinutes: 0 }).find((f) => f.room.code === "107")!;
    expect(r107.freeUntil).toBe("10:30");
    // ...and the occupancy they hold says nothing about whose class it is
    expect(s.roomOccupancy!.entries.every((e) => e.courseId === "" && !e.groupId && !e.lecturerId)).toBe(true);
  });
});
