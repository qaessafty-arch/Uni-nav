import { describe, expect, it } from "vitest";
import {
  conflictsWith, currentAndNext, detectConflicts, isWeekend, occurrencesOn, weekDates, weekStartFor, zonedNow, zonedToInstant,
  type ScheduleChange, type TimetableEntry,
} from "../src";

const base: TimetableEntry = {
  id: "e1", universityId: "u", courseId: "c1", lecturerId: "l1", roomId: "r1", groupId: "g1",
  recurrence: "weekly", day: 0, startTime: "08:30", endTime: "10:00", validFrom: "2026-09-20", validTo: "2027-01-21", status: "scheduled",
};
const entry = (p: Partial<TimetableEntry>): TimetableEntry => ({ ...base, ...p });

describe("time zones", () => {
  it("converts instants to Baghdad wall clock (UTC+3, no DST)", () => {
    const z = zonedNow(new Date("2026-11-01T05:30:00Z"), "Asia/Baghdad");
    expect(z).toMatchObject({ date: "2026-11-01", time: "08:30", weekday: 0 });
  });
  it("handles date rollover across midnight", () => {
    expect(zonedNow(new Date("2026-11-01T22:30:00Z"), "Asia/Baghdad").date).toBe("2026-11-02");
  });
  it("round-trips wall clock → instant, including DST zones", () => {
    expect(zonedToInstant("2026-11-01", "08:30", "Asia/Baghdad").toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(zonedToInstant("2026-07-01", "09:00", "Europe/Berlin").toISOString()).toBe("2026-07-01T07:00:00.000Z");
    expect(zonedToInstant("2026-01-01", "09:00", "Europe/Berlin").toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });
  it("supports configurable weekends and week start", () => {
    expect(isWeekend("2026-11-06", [5, 6])).toBe(true); // Friday
    expect(isWeekend("2026-11-08", [5, 6])).toBe(false); // Sunday
    expect(weekStartFor([5, 6])).toBe(0);
    expect(weekStartFor([0, 6])).toBe(1);
    expect(weekDates("2026-11-04", 0)[0]).toBe("2026-11-01");
  });
});

describe("schedule display", () => {
  it("shows weekly entries only on their weekday within the date range", () => {
    expect(occurrencesOn("2026-11-01", [base], [])).toHaveLength(1); // Sunday
    expect(occurrencesOn("2026-11-02", [base], [])).toHaveLength(0);
    expect(occurrencesOn("2027-02-07", [base], [])).toHaveLength(0); // after range
  });
  it("applies room, lecturer, time changes and cancellations for one date only", () => {
    const changes: ScheduleChange[] = [
      { id: "c1", universityId: "u", entryId: "e1", date: "2026-11-01", type: "room_change", newRoomId: "r9" },
      { id: "c2", universityId: "u", entryId: "e1", date: "2026-11-01", type: "lecturer_change", newLecturerId: "l9" },
      { id: "c3", universityId: "u", entryId: "e1", date: "2026-11-08", type: "cancelled" },
      { id: "c4", universityId: "u", entryId: "e1", date: "2026-11-15", type: "time_change", newStartTime: "11:00", newEndTime: "12:30" },
    ];
    const o1 = occurrencesOn("2026-11-01", [base], changes)[0]!;
    expect([o1.roomId, o1.lecturerId, o1.original.roomId]).toEqual(["r9", "l9", "r1"]);
    expect(occurrencesOn("2026-11-08", [base], changes)[0]!.cancelled).toBe(true);
    expect(occurrencesOn("2026-11-15", [base], changes)[0]!.startTime).toBe("11:00");
    expect(occurrencesOn("2026-11-22", [base], changes)[0]!.roomId).toBe("r1");
  });
  it("finds current and next lecture in the university time zone", () => {
    const entries = [base, entry({ id: "e2", startTime: "10:30", endTime: "12:00", roomId: "r2" })];
    // 06:00Z = 09:00 Baghdad on Sunday 2026-11-01
    const res = currentAndNext(new Date("2026-11-01T06:00:00Z"), "Asia/Baghdad", entries, []);
    expect(res.current?.entryId).toBe("e1");
    expect(res.next?.entryId).toBe("e2");
    expect(res.secondsUntilNext).toBe(90 * 60);
    expect(res.secondsUntilCurrentEnds).toBe(60 * 60);
  });
  it("skips cancelled occurrences and looks ahead to the next week", () => {
    const changes: ScheduleChange[] = [{ id: "c", universityId: "u", entryId: "e1", date: "2026-11-08", type: "cancelled" }];
    const res = currentAndNext(new Date("2026-11-01T08:00:00Z"), "Asia/Baghdad", [base], changes, {}, 14);
    expect(res.next?.date).toBe("2026-11-15");
  });
  it("filters by student group", () => {
    const entries = [base, entry({ id: "e2", groupId: "g2", startTime: "11:00", endTime: "12:00" })];
    expect(occurrencesOn("2026-11-01", entries, [], { groupId: "g2" }).map((o) => o.entryId)).toEqual(["e2"]);
  });
});

describe("conflict detection", () => {
  it("detects room, lecturer and group double-booking", () => {
    const entries = [base, entry({ id: "e2", startTime: "09:00", endTime: "11:00" })];
    const kinds = detectConflicts(entries).map((c) => c.kind).sort();
    expect(kinds).toEqual(["group", "lecturer", "room"]);
  });
  it("ignores back-to-back sessions, different days, cancelled entries and non-overlapping date ranges", () => {
    expect(detectConflicts([base, entry({ id: "e2", startTime: "10:00", endTime: "11:00" })])).toHaveLength(0);
    expect(detectConflicts([base, entry({ id: "e2", day: 1 })])).toHaveLength(0);
    expect(detectConflicts([base, entry({ id: "e2", status: "cancelled" })])).toHaveLength(0);
    expect(detectConflicts([base, entry({ id: "e2", validFrom: "2027-02-01", validTo: "2027-05-01" })])).toHaveLength(0);
  });
  it("detects one-off sessions clashing with weekly ones", () => {
    const once = entry({ id: "x", recurrence: "once", validFrom: "2026-11-01", validTo: "2026-11-01", lecturerId: "l2", groupId: "g2" });
    const c = detectConflicts([base, once]);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "room", firstDate: "2026-11-01" });
  });
  it("reports conflicts introduced by an edited entry", () => {
    const edited = entry({ id: "e2", roomId: "r1", lecturerId: "l2", groupId: "g2", startTime: "09:00", endTime: "09:30" });
    expect(conflictsWith(edited, [base]).map((c) => c.kind)).toEqual(["room"]);
  });
});
