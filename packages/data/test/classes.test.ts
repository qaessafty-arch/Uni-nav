import { describe, expect, it } from "vitest";
import { bundleForAccess, materialsBySection, postableGroups, unseenMaterials, uploadTargets, VISITOR, type CampusBundle } from "@campusnav/core";
import { DemoClassTools, DemoDataSource, DEMO_REP_EMAIL, DEMO_REP_GROUP, demoBundle, materialProblem, DEMO_UNIVERSITY_ID } from "../src";
import { did } from "../src/demo/dataset";
import type { SyncKV } from "../src/demo/student";

const CS = did("demo-dept-cs");
const CE = did("demo-dept-ce");
const CS101 = did("course-DEMO-CS101");
const CS201 = did("course-DEMO-CS201");
const memKV = (): SyncKV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const withClasses = (email: string | null): CampusBundle => new DemoClassTools(null).apply(demoBundle(new Date("2026-10-30T00:00:00Z")), email);

describe("materials follow the timetable rule", () => {
  it("visitors get no materials, no class posts and no class roles", () => {
    const v = bundleForAccess({ ...withClasses(DEMO_REP_EMAIL), announcements: [...demoBundle().announcements, { ...demoBundle().announcements[0]!, id: "p", groupId: DEMO_REP_GROUP }] }, VISITOR);
    expect(v.materials).toEqual([]);
    expect(v.classRoles).toBeNull();
    expect(v.announcements.every((a) => !a.groupId)).toBe(true);
  });
  it("students see materials of their own classes' courses only", () => {
    const b = withClasses("cs1@students.demo.example");
    const cs1 = bundleForAccess(b, { kind: "student", departmentId: CS, year: 1 });
    expect(cs1.materials!.length).toBe(2);
    const ce1 = bundleForAccess(b, { kind: "student", departmentId: CE, year: 1 });
    expect(ce1.materials).toEqual([]);
    const cs2 = bundleForAccess(b, { kind: "student", departmentId: CS, year: 2 });
    expect(cs2.materials).toEqual([]); // CS101 is a stage-1 course
  });
  it("groups by section, newest first", () => {
    const s = materialsBySection(withClasses(null).materials!);
    expect(s.map((x) => x.section)).toEqual(["Week 2 – Variables", "Week 1 – Introduction"]);
  });
});

describe("who may upload and post", () => {
  it("the demo rep may upload to their class's courses, for their class only", () => {
    const b = bundleForAccess(withClasses(DEMO_REP_EMAIL), { kind: "student", departmentId: CS, year: 1 });
    expect(uploadTargets(b, CS101)).toEqual({ allClasses: false, groupIds: [DEMO_REP_GROUP] });
    expect(uploadTargets(b, CS201)).toBeNull();
    expect(postableGroups(b)).toEqual([DEMO_REP_GROUP]);
  });
  it("other students may not, and a course can switch rep uploads off", () => {
    const b = bundleForAccess(withClasses("cs2@students.demo.example"), { kind: "student", departmentId: CS, year: 2 });
    expect(uploadTargets(b, CS201)).toBeNull();
    expect(postableGroups(b)).toEqual([]);
    const rep = withClasses(DEMO_REP_EMAIL);
    const locked = { ...rep, courses: rep.courses.map((c) => (c.id === CS101 ? { ...c, repsCanUpload: false } : c)) };
    expect(uploadTargets(locked, CS101)).toBeNull();
  });
  it("a linked lecturer may upload for all their classes", () => {
    const b = { ...withClasses(null), classRoles: { userId: "u", repGroupIds: [], lecturerId: did("lect-a") } };
    expect(uploadTargets(b, CS101)?.allClasses).toBe(true);
    expect(uploadTargets(b, did("course-DEMO-CE110"))).toBeNull(); // taught by lecturer C
  });
});

describe("material checks", () => {
  const base = { courseId: CS101, groupId: null, title: "Week 1" };
  it("requires a title and a file or http(s) link of an allowed type and size", () => {
    expect(materialProblem({ ...base, title: " " })).toBe("title");
    expect(materialProblem(base)).toBe("file_or_link");
    expect(materialProblem({ ...base, url: "javascript:alert(1)" })).toBe("link");
    expect(materialProblem({ ...base, url: "https://example.org/x" })).toBeNull();
    expect(materialProblem({ ...base, file: new Blob(["x"]), fileName: "virus.exe" })).toBe("file_type");
    expect(materialProblem({ ...base, file: { size: 21 * 1024 * 1024 } as Blob, fileName: "big.pdf" })).toBe("file_size");
    expect(materialProblem({ ...base, file: new Blob(["%PDF"]), fileName: "notes.PDF" })).toBeNull();
  });
});

describe("demo class tools", () => {
  it("adds, opens and removes materials and class posts on this device only", async () => {
    const kv = memKV();
    kv.setItem("campusnav.student.v1", JSON.stringify({ universityId: DEMO_UNIVERSITY_ID, email: DEMO_REP_EMAIL, status: "verified", departmentId: CS, year: 1 }));
    const src = new DemoDataSource(undefined, kv);
    const m = await src.classes.addMaterial(DEMO_UNIVERSITY_ID, { courseId: CS101, groupId: DEMO_REP_GROUP, title: "Lab 3", file: new Blob(["%PDF-1.4"], { type: "application/pdf" }), fileName: "lab3.pdf" });
    expect(m.kind).toBe("file");
    expect(await src.classes.openMaterial(m)).toMatch(/^data:application\/pdf;base64,/);
    await src.classes.postToClass(DEMO_UNIVERSITY_ID, DEMO_REP_GROUP, "Quiz", "Thursday");
    const b = await src.getBundle(DEMO_UNIVERSITY_ID);
    expect(b.materials!.some((x) => x.id === m.id)).toBe(true);
    expect(b.announcements.some((a) => a.groupId === DEMO_REP_GROUP && a.title.en === "Quiz")).toBe(true);
    expect(b.classRoles?.repGroupIds).toEqual([DEMO_REP_GROUP]);
    await src.classes.removeMaterial(m);
    expect((await src.getBundle(DEMO_UNIVERSITY_ID)).materials!.some((x) => x.id === m.id)).toBe(false);
    await expect(src.classes.addMaterial(DEMO_UNIVERSITY_ID, { courseId: CS101, groupId: null, title: "Big", file: { size: 2_000_000 } as Blob, fileName: "big.pdf" })).rejects.toThrow(/demo_size/);
  });
});

describe("new-material badges", () => {
  const mk = (id: string, courseId: string, createdAt: string) => ({ id, universityId: DEMO_UNIVERSITY_ID, courseId, title: id, kind: "link" as const, url: "https://example.org", createdAt });
  const now = new Date("2026-11-07T12:00:00Z");
  const items = [mk("old", CS101, "2026-10-01T00:00:00Z"), mk("a", CS101, "2026-11-05T00:00:00Z"), mk("b", CS101, "2026-11-07T10:00:00Z"), mk("c", CS201, "2026-11-06T00:00:00Z")];
  it("counts items after the last visit to that course, within 14 days", () => {
    expect(unseenMaterials(items, () => null, now).map((m) => m.id)).toEqual(["b", "c", "a"]); // "old" is outside the window
    expect(unseenMaterials(items, (c) => (c === CS101 ? "2026-11-06T00:00:00Z" : null), now).map((m) => m.id)).toEqual(["b", "c"]);
    expect(unseenMaterials(items, () => "2026-11-08T00:00:00Z", now)).toEqual([]);
  });
});
