import type { ClockTime, ISODate, ScheduleChange, TimetableEntry, Weekday } from "../model/types";
import { addDays, toMinutes, weekdayOf, zonedNow, zonedToInstant } from "./time";

/** A concrete lecture on a specific date with all changes applied. */
export interface Occurrence {
  entryId: string;
  date: ISODate;
  courseId: string;
  lecturerId: string | null;
  roomId: string | null;
  groupId: string | null;
  kind: TimetableEntry["kind"];
  startTime: ClockTime;
  endTime: ClockTime;
  cancelled: boolean;
  changes: ScheduleChange[];
  /** Original values before changes, for "moved from" display. */
  original: { roomId: string | null; lecturerId: string | null; startTime: ClockTime; endTime: ClockTime };
}

export function occursOn(entry: TimetableEntry, date: ISODate): boolean {
  if (date < entry.validFrom || date > entry.validTo) return false;
  if (entry.recurrence === "once") return date === entry.validFrom;
  return weekdayOf(date) === entry.day;
}

export function applyChanges(entry: TimetableEntry, date: ISODate, changes: ScheduleChange[]): Occurrence {
  const relevant = changes.filter((c) => c.entryId === entry.id && c.date === date);
  const occ: Occurrence = {
    entryId: entry.id,
    date,
    courseId: entry.courseId,
    lecturerId: entry.lecturerId ?? null,
    roomId: entry.roomId ?? null,
    groupId: entry.groupId ?? null,
    kind: entry.kind ?? null,
    startTime: entry.startTime,
    endTime: entry.endTime,
    cancelled: entry.status === "cancelled",
    changes: relevant,
    original: {
      roomId: entry.roomId ?? null,
      lecturerId: entry.lecturerId ?? null,
      startTime: entry.startTime,
      endTime: entry.endTime,
    },
  };
  for (const c of relevant) {
    switch (c.type) {
      case "cancelled":
        occ.cancelled = true;
        break;
      case "room_change":
        if (c.newRoomId) occ.roomId = c.newRoomId;
        break;
      case "lecturer_change":
        if (c.newLecturerId) occ.lecturerId = c.newLecturerId;
        break;
      case "time_change":
        if (c.newStartTime) occ.startTime = c.newStartTime;
        if (c.newEndTime) occ.endTime = c.newEndTime;
        break;
    }
  }
  return occ;
}

export interface OccurrenceFilter {
  groupId?: string | null;
  lecturerId?: string | null;
  roomId?: string | null;
  courseIds?: Set<string> | null;
}

function matches(o: Occurrence, f: OccurrenceFilter): boolean {
  if (f.groupId && o.groupId !== f.groupId) return false;
  if (f.lecturerId && o.lecturerId !== f.lecturerId) return false;
  if (f.roomId && o.roomId !== f.roomId) return false;
  if (f.courseIds && !f.courseIds.has(o.courseId)) return false;
  return true;
}

export function occurrencesOn(
  date: ISODate,
  entries: TimetableEntry[],
  changes: ScheduleChange[],
  filter: OccurrenceFilter = {},
): Occurrence[] {
  return entries
    .filter((e) => occursOn(e, date))
    .map((e) => applyChanges(e, date, changes))
    .filter((o) => matches(o, filter))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function occurrencesForDates(
  dates: ISODate[],
  entries: TimetableEntry[],
  changes: ScheduleChange[],
  filter: OccurrenceFilter = {},
): Map<ISODate, Occurrence[]> {
  return new Map(dates.map((d) => [d, occurrencesOn(d, entries, changes, filter)]));
}

export interface CurrentAndNext {
  current: Occurrence | null;
  next: Occurrence | null;
  /** Seconds until `next` starts (or `current` ends if no next). */
  secondsUntilNext: number | null;
  secondsUntilCurrentEnds: number | null;
}

/**
 * Current lecture and the next upcoming one, looking ahead up to `lookaheadDays`.
 * All comparisons happen in the university's time zone.
 */
export function currentAndNext(
  now: Date,
  timeZone: string,
  entries: TimetableEntry[],
  changes: ScheduleChange[],
  filter: OccurrenceFilter = {},
  lookaheadDays = 7,
): CurrentAndNext {
  const z = zonedNow(now, timeZone);
  let current: Occurrence | null = null;
  let next: Occurrence | null = null;

  for (let i = 0; i <= lookaheadDays && !next; i++) {
    const date = addDays(z.date, i);
    for (const o of occurrencesOn(date, entries, changes, filter)) {
      if (o.cancelled) continue;
      if (i === 0) {
        const s = toMinutes(o.startTime);
        const e = toMinutes(o.endTime);
        if (s <= z.minutes && z.minutes < e) {
          if (!current) current = o;
          continue;
        }
        if (s <= z.minutes) continue;
      }
      next = o;
      break;
    }
  }
  const secs = (o: Occurrence | null, which: "start" | "end") =>
    o ? Math.round((zonedToInstant(o.date, which === "start" ? o.startTime : o.endTime, timeZone).getTime() - now.getTime()) / 1000) : null;
  return { current, next, secondsUntilNext: secs(next, "start"), secondsUntilCurrentEnds: secs(current, "end") };
}

export function formatCountdown(seconds: number): { days: number; hours: number; minutes: number } {
  const s = Math.max(0, seconds);
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60) };
}

// ───────────────────────── Conflict detection ─────────────────────────

export type ConflictKind = "room" | "lecturer" | "group";

export interface Conflict {
  kind: ConflictKind;
  resourceId: string;
  a: string; // entry id
  b: string; // entry id
  day: Weekday;
  /** First overlapping date in both entries' ranges. */
  firstDate: ISODate;
}

function timesOverlap(a: TimetableEntry, b: TimetableEntry): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

/** First date both entries actually occur on, or null. */
function firstCommonDate(a: TimetableEntry, b: TimetableEntry): ISODate | null {
  const from = a.validFrom > b.validFrom ? a.validFrom : b.validFrom;
  const to = a.validTo < b.validTo ? a.validTo : b.validTo;
  if (from > to) return null;
  if (a.recurrence === "once" || b.recurrence === "once") {
    const d = a.recurrence === "once" ? a.validFrom : b.validFrom;
    return occursOn(a, d) && occursOn(b, d) ? d : null;
  }
  if (a.day !== b.day) return null;
  const offset = (a.day - weekdayOf(from) + 7) % 7;
  const d = addDays(from, offset);
  return d <= to ? d : null;
}

/**
 * Detect overlapping bookings of the same room, lecturer or student group.
 * Cancelled entries are ignored. O(n log n) bucketing by day then pairwise per resource.
 */
export function detectConflicts(entries: TimetableEntry[]): Conflict[] {
  const active = entries.filter((e) => e.status !== "cancelled");
  const conflicts: Conflict[] = [];
  const keys: [ConflictKind, (e: TimetableEntry) => string | null | undefined][] = [
    ["room", (e) => e.roomId],
    ["lecturer", (e) => e.lecturerId],
    ["group", (e) => e.groupId],
  ];
  for (const [kind, key] of keys) {
    const buckets = new Map<string, TimetableEntry[]>();
    for (const e of active) {
      const k = key(e);
      if (!k) continue;
      const list = buckets.get(k) ?? [];
      list.push(e);
      buckets.set(k, list);
    }
    for (const [resourceId, list] of buckets) {
      list.sort((x, y) => x.startTime.localeCompare(y.startTime));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const b = list[j]!;
          if (b.startTime >= a.endTime) break; // sorted by start: no later entry can overlap a
          if (!timesOverlap(a, b)) continue;
          const d = firstCommonDate(a, b);
          if (d) conflicts.push({ kind, resourceId, a: a.id, b: b.id, day: weekdayOf(d), firstDate: d });
        }
      }
    }
  }
  return conflicts;
}

/** Conflicts introduced by `candidate` against existing entries (for edit forms / imports). */
export function conflictsWith(candidate: TimetableEntry, existing: TimetableEntry[]): Conflict[] {
  return detectConflicts([...existing.filter((e) => e.id !== candidate.id), candidate]).filter(
    (c) => c.a === candidate.id || c.b === candidate.id,
  );
}
