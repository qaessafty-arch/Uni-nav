import { describe, expect, it } from "vitest";
import {
  can, canAssignRole, checkSvg, evaluateCheckpoint, generateCheckpointToken, normalizeSearch, parseCheckpointPayload, parseCsv,
  previewTimetableImport, roleIn, toCsv, validateMap, RuleBasedIntentParser, universitySettingsSchema, timetableEntrySchema, lecturerSchema,
} from "../src";
import { e, floor, n, sample } from "./fixtures";

describe("QR checkpoint payloads", () => {
  it("accepts web URLs, app deep links and printed codes", () => {
    expect(parseCheckpointPayload("https://nav.example.edu/q/DEMOengMainEntrance01")).toEqual({ ok: true, token: "DEMOengMainEntrance01" });
    expect(parseCheckpointPayload("campusnav://q/DEMOengMainEntrance01")).toEqual({ ok: true, token: "DEMOengMainEntrance01" });
    expect(parseCheckpointPayload("  DEMOengMainEntrance01 ")).toEqual({ ok: true, token: "DEMOengMainEntrance01" });
  });
  it("rejects arbitrary or malicious payloads", () => {
    for (const bad of ["", "hello", "javascript:alert(1)", "https://x.com/q/../../admin", "https://x.com/q/short", "campusnav://admin/grant", "https://x.com/q/abc<script>defghijklmnop", "a".repeat(600)]) {
      expect(parseCheckpointPayload(bad).ok).toBe(false);
    }
    expect(parseCheckpointPayload("https://evil.com/q/DEMOengMainEntrance01", ["nav.example.edu"]).ok).toBe(false);
  });
  it("evaluates disabled, expired, unknown and cross-tenant checkpoints", () => {
    const rec = { id: "c", universityId: "u1", nodeId: "n", label: { en: "x" }, status: "active" as const, expiresAt: null };
    const now = new Date("2026-11-01T00:00:00Z");
    expect(evaluateCheckpoint(null, now).status).toBe("unknown");
    expect(evaluateCheckpoint({ ...rec, status: "disabled" }, now).status).toBe("disabled");
    expect(evaluateCheckpoint({ ...rec, expiresAt: "2026-01-01T00:00:00Z" }, now).status).toBe("expired");
    expect(evaluateCheckpoint(rec, now, "u2").status).toBe("wrong_university");
    expect(evaluateCheckpoint(rec, now, "u1").status).toBe("ok");
  });
  it("generates unbiased random tokens of the right shape", () => {
    const toks = new Set(Array.from({ length: 200 }, () => generateCheckpointToken()));
    expect(toks.size).toBe(200);
    for (const t of toks) expect(parseCheckpointPayload(t).ok).toBe(true);
  });
});

describe("search normalization", () => {
  it("folds digits, alef/ya/kaf variants and diacritics", () => {
    expect(normalizeSearch("ژووری ٢٠٤")).toBe("ژووری 204");
    expect(normalizeSearch("۲۰۴")).toBe("204");
    expect(normalizeSearch("أحمد")).toBe(normalizeSearch("احمد"));
    expect(normalizeSearch("علي")).toBe(normalizeSearch("علی"));
    expect(normalizeSearch("كتاب")).toBe(normalizeSearch("کتاب"));
    expect(normalizeSearch("مُحَمَّد")).toBe("محمد");
    expect(normalizeSearch("Room-204")).toBe("room 204");
  });
  it("keeps Sorani-specific letters distinct", () => {
    expect(normalizeSearch("ڕێگا")).toContain("ڕ");
    expect(normalizeSearch("ڵ")).toBe("ڵ");
  });
});

describe("map validation", () => {
  it("accepts a valid sample graph", () => {
    const { floors, nodes, edges } = sample();
    const issues = validateMap({ floors, nodes: undefined as never, navNodes: nodes, navEdges: edges, rooms: [], mapElements: [] } as never);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
  it("reports duplicate ids, unconnected rooms, missing ids, bad checkpoints and disconnected floors", () => {
    const floors = [floor("F0", 0), floor("F1", 1)];
    const navNodes = [n("a", "F0", 0, 0), n("b", "F0", 10, 0), n("island", "F0", 50, 50), n("up", "F1", 0, 0, "stairs")];
    const navEdges = [e("ab", "a", "b"), e("ab", "b", "a"), e("dangling", "a", "ghost")];
    const room = (id: string, code: string, entranceNodeId: string | null) => ({
      id, universityId: "u", buildingId: "b1", floorId: "F0", code, name: { en: id }, type: "classroom" as const, entranceNodeId, accessible: true, dataStatus: "demo" as const,
    });
    const rooms = [room("r1", "101", "b"), room("r2", "", "island"), room("r3", "101", null)];
    const issues = validateMap({ floors, navNodes, navEdges, rooms, mapElements: [{ id: "el", universityId: "u", floorId: "F0", kind: "room", shape: { type: "rect", x: 0, y: 0, w: 5, h: 5 }, roomId: "missing" }], checkpoints: [{ id: "cp", nodeId: "nowhere" }] });
    const codes = new Set(issues.map((i) => i.code));
    for (const c of ["DUPLICATE_ID", "EDGE_UNKNOWN_NODE", "ROOM_MISSING_CODE", "ROOM_UNREACHABLE", "ROOM_NO_ENTRANCE", "DUPLICATE_ROOM_CODE", "ELEMENT_ROOM_UNKNOWN", "CHECKPOINT_UNKNOWN_NODE", "FLOOR_NOT_CONNECTED", "VERTICAL_NODE_NO_LINK", "NODE_ISOLATED"]) {
      expect(codes, c).toContain(c);
    }
  });
});

describe("CSV", () => {
  it("parses quotes, escaped quotes, CRLF, BOM and semicolons", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("neutralises formula injection on export", () => {
    expect(toCsv([["=HYPERLINK(1)", "ok"]])).toBe("'=HYPERLINK(1),ok");
  });
});

describe("timetable import", () => {
  const ctx = {
    universityId: "u",
    courses: [{ id: "c1", universityId: "u", code: "CS101", name: { en: "Prog" } }],
    groups: [{ id: "g1", universityId: "u", code: "G1", name: { en: "G1" }, academicYear: "2026-2027" }],
    lecturers: [
      { id: "l1", universityId: "u", fullName: { en: "Lecturer One" }, officeHours: [], dataStatus: "demo" as const },
      { id: "l2", universityId: "u", fullName: { en: "Twin" }, officeHours: [], dataStatus: "demo" as const },
      { id: "l3", universityId: "u", fullName: { en: "Twin" }, officeHours: [], dataStatus: "demo" as const },
    ],
    buildings: [{ id: "b1", universityId: "u", campusId: "c", code: "ENG", name: { en: "Eng" }, dataStatus: "demo" as const }],
    rooms: [{ id: "r1", universityId: "u", buildingId: "b1", floorId: "f", code: "204", name: { en: "204" }, type: "classroom" as const, accessible: true, dataStatus: "demo" as const }],
    existing: [],
    newId: (() => { let i = 0; return () => `new${i++}`; })(),
  };
  const header = "course_code,group_code,lecturer,building_code,room_code,day,start_time,end_time,valid_from,valid_to";
  it("accepts valid rows including localized day names and DD/MM/YYYY dates", () => {
    const rows = parseCsv(`${header}\nCS101,G1,Lecturer One,ENG,٢٠٤,یەکشەممە,8:30,10:00,20/09/2026,2027-01-21`);
    const p = previewTimetableImport(rows, ctx);
    expect(p.errors).toEqual([]);
    expect(p.entries[0]).toMatchObject({ courseId: "c1", roomId: "r1", day: 0, startTime: "08:30", validFrom: "2026-09-20" });
  });
  it("reports every invalid field with row numbers", () => {
    const rows = parseCsv(`${header}\nNOPE,G9,Twin,ENG,999,Funday,25:00,10:00,2026-02-30,2026-01-01`);
    const codes = previewTimetableImport(rows, ctx).errors.map((x) => x.code).sort();
    expect(codes).toEqual(["ambiguous_lecturer", "invalid_date", "invalid_day", "invalid_time", "unknown_course", "unknown_group", "unknown_room"].sort());
  });
  it("flags missing columns, duplicates and conflicts instead of silently accepting", () => {
    expect(previewTimetableImport([["course_code"]], ctx).errors[0]!.code).toBe("missing_column");
    const rows = parseCsv(`${header}\nCS101,G1,Lecturer One,ENG,204,Sun,08:30,10:00,2026-09-20,2027-01-21\nCS101,G1,Lecturer One,ENG,204,Sun,08:30,10:00,2026-09-20,2027-01-21\nCS101,,,ENG,204,Sun,09:00,09:45,2026-09-20,2027-01-21`);
    const p = previewTimetableImport(rows, ctx);
    expect(p.errors.map((x) => x.code)).toEqual(["duplicate_row"]);
    expect(p.conflicts.map((c) => c.kind)).toEqual(["room"]);
  });
});

describe("permissions", () => {
  it("matches the role matrix", () => {
    expect(can("student", "room.manage")).toBe(false);
    expect(can("university_admin", "room.manage")).toBe(true);
    expect(can(null, "public.read")).toBe(true);
    expect(can("department_admin", "member.invite")).toBe(false);
  });
  it("prevents role escalation", () => {
    expect(canAssignRole("university_admin", "university_owner")).toBe(false);
    expect(canAssignRole("university_admin", "university_admin")).toBe(false);
    expect(canAssignRole("university_admin", "department_admin")).toBe(true);
    expect(canAssignRole("university_owner", "platform_owner")).toBe(false);
    expect(canAssignRole("student", "visitor")).toBe(false);
  });
  it("resolves effective role per university only", () => {
    const ms = [{ universityId: "u1", role: "student" as const }, { universityId: "u1", role: "lecturer" as const }, { universityId: "u2", role: "university_owner" as const }];
    expect(roleIn(ms, "u1")).toBe("lecturer");
    expect(roleIn(ms, "u3")).toBeNull();
  });
});

describe("SVG upload safety", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><rect x="0" y="0" width="10" height="10"/></svg>';
  it("accepts plain SVG and reads its size", () => {
    expect(checkSvg(ok)).toMatchObject({ ok: true, width: 1000, height: 600 });
  });
  it("rejects scripts, handlers, external references and entities", () => {
    const bad = [
      '<svg><script>alert(1)</script></svg>',
      '<svg><rect onload="alert(1)"/></svg>',
      '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
      '<svg><image href="https://evil.example/x.png"/></svg>',
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
      '<svg><foreignObject><div/></foreignObject></svg>',
      '<svg><style>@import url(https://evil)</style></svg>',
      "<html></html>",
    ];
    for (const b of bad) expect(checkSvg(b).ok, b).toBe(false);
  });
});

describe("schemas", () => {
  it("validate time zones, times and emails", () => {
    expect(universitySettingsSchema.safeParse({ timezone: "Not/AZone", weekendDays: [5], defaultLocale: "en", enabledLocales: ["en"], timetableVisibility: "public", walkingSpeedMps: 1.2, accessibleWalkingSpeedMps: 0.8, stairsSecondsPerFloor: 20, elevatorSecondsPerFloor: 40 }).success).toBe(false);
    expect(timetableEntrySchema.safeParse({ id: "e", universityId: "u", courseId: "c", recurrence: "weekly", day: 1, startTime: "10:00", endTime: "09:00", validFrom: "2026-01-01", validTo: "2026-02-01", status: "scheduled" }).success).toBe(false);
    expect(lecturerSchema.safeParse({ id: "l", universityId: "u", fullName: { en: "x" }, officeHours: [], publicEmail: "not-an-email", dataStatus: "demo" }).success).toBe(false);
  });
  it("rejects ids with injection characters", () => {
    expect(lecturerSchema.safeParse({ id: "x'; drop table--", universityId: "u", fullName: { en: "x" }, officeHours: [], dataStatus: "demo" }).success).toBe(false);
  });
});

describe("assistant intent parsing", () => {
  const p = new RuleBasedIntentParser();
  it("understands English, Sorani and Arabic questions", () => {
    expect(p.parse("Where is my next lecture?")).toEqual({ type: "next_lecture" });
    expect(p.parse("Where is Dr. Ahmed's office?")).toEqual({ type: "find_lecturer", query: "Ahmed" });
    expect(p.parse("How do I reach Room 204?")).toEqual({ type: "navigate", query: "Room 204?" });
    expect(p.parse("ژووری ٢٠٤ لە کوێیە؟").type).toBe("find_place");
    expect(p.parse("أين المكتبة؟")).toEqual({ type: "find_place", query: "المكتبة" });
  });
});
