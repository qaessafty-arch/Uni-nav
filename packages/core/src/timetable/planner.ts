import type { CampusBundle, ClockTime, Room, RoomType } from "../model/types";
import { isClosureActive } from "../navigation/closures";
import { occurrencesOn } from "./schedule";
import { toMinutes, zonedNow } from "./time";

// ───────────────────────── Free rooms ─────────────────────────

export interface FreeRoom {
  room: Room;
  /** Start of the next class in this room today, or null if nothing else is scheduled today. */
  freeUntil: ClockTime | null;
  /** Minutes until `freeUntil`, or null when free for the rest of the day. */
  minutesFree: number | null;
  /** A class that would have been here now was cancelled. */
  freedByCancellation: boolean;
}

export interface FreeRoomsOptions {
  types?: readonly RoomType[];
  /** Only rooms free for at least this many minutes. Default 30. */
  minMinutes?: number;
  /** Only rooms in these buildings (see freeRoomScope). */
  buildingIds?: ReadonlySet<string>;
}

export const STUDY_ROOM_TYPES: readonly RoomType[] = ["lecture_hall", "classroom"];

/**
 * Teaching rooms with no class at `now`, according to the published timetable
 * (schedule changes and cancellations applied, active room closures excluded).
 * This is timetable data only: a room can still be in use for something that
 * was never scheduled, so callers must present it as "free in the timetable".
 */
export function freeRoomsAt(bundle: CampusBundle, now: Date, opts: FreeRoomsOptions = {}): FreeRoom[] {
  const types = new Set(opts.types ?? STUDY_ROOM_TYPES);
  const minMinutes = opts.minMinutes ?? 30;
  const z = zonedNow(now, bundle.university.settings.timezone);
  // All bookings (anonymised for students), not just the viewer's own lectures.
  const occ = bundle.roomOccupancy ?? { entries: bundle.timetable, changes: bundle.scheduleChanges };
  const today = occurrencesOn(z.date, occ.entries, occ.changes);
  const closedRooms = new Set((bundle.closures ?? []).filter((c) => c.targetType === "room" && isClosureActive(c, now)).map((c) => c.targetId));

  const out: FreeRoom[] = [];
  for (const room of bundle.rooms) {
    if (!types.has(room.type) || closedRooms.has(room.id)) continue;
    if (opts.buildingIds && !opts.buildingIds.has(room.buildingId)) continue;
    const here = today.filter((o) => o.roomId === room.id);
    const covering = (o: (typeof here)[number]) => toMinutes(o.startTime) <= z.minutes && z.minutes < toMinutes(o.endTime);
    if (here.some((o) => !o.cancelled && covering(o))) continue;
    const next = here.filter((o) => !o.cancelled && toMinutes(o.startTime) > z.minutes).sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    const minutesFree = next ? toMinutes(next.startTime) - z.minutes : null;
    if (minutesFree != null && minutesFree < minMinutes) continue;
    out.push({ room, freeUntil: next?.startTime ?? null, minutesFree, freedByCancellation: here.some((o) => o.cancelled && covering(o)) });
  }
  // Longest free first; "rest of the day" counts as longest.
  return out.sort((a, b) => (b.minutesFree ?? 1e9) - (a.minutesFree ?? 1e9) || a.room.code.localeCompare(b.room.code, undefined, { numeric: true }));
}

// ───────────────────────── Leave-by advice ─────────────────────────

export type LeaveStatus = "relax" | "leave_soon" | "leave_now" | "late";

export interface LeaveAdvice {
  status: LeaveStatus;
  /** Seconds until the student should set off (negative = already past). */
  leaveInSeconds: number;
  walkSeconds: number;
}

/**
 * When to set off for a class: start time minus estimated walk minus a buffer
 * (default 2 min to find a seat). Walk times are estimates, so the buffer is
 * deliberately not zero.
 */
export function leaveAdvice(secondsUntilStart: number, walkSeconds: number, bufferSeconds = 120): LeaveAdvice {
  const leaveInSeconds = Math.round(secondsUntilStart - walkSeconds - bufferSeconds);
  let status: LeaveStatus;
  if (secondsUntilStart < walkSeconds) status = "late";
  else if (leaveInSeconds <= 60) status = "leave_now";
  else if (leaveInSeconds <= 15 * 60) status = "leave_soon";
  else status = "relax";
  return { status, leaveInSeconds, walkSeconds: Math.round(walkSeconds) };
}

export interface FreeRoomScope {
  buildingIds: Set<string>;
  /** Building(s) of the student's major (department of their chosen group). */
  majorBuildingIds: string[];
  /** Building the person is in now (from their QR scan / chosen location). */
  hereBuildingId: string | null;
}

/**
 * Free rooms are offered to the students of the major that owns a building,
 * and to whoever is inside that building — not campus-wide. A student's major
 * comes from the timetable group they picked (department → its building, plus
 * buildings where that department has rooms); a visitor's from where they are.
 */
export function freeRoomScope(bundle: CampusBundle, groupId: string | null | undefined, startNodeId: string | null | undefined): FreeRoomScope {
  const majorBuildingIds = new Set<string>();
  const dept = bundle.departments.find((d) => d.id === bundle.groups.find((g) => g.id === groupId)?.departmentId);
  if (dept?.buildingId) majorBuildingIds.add(dept.buildingId);
  if (dept) for (const r of bundle.rooms) if (r.departmentId === dept.id) majorBuildingIds.add(r.buildingId);
  const node = startNodeId ? bundle.navNodes.find((n) => n.id === startNodeId) : undefined;
  const hereBuildingId = node ? bundle.floors.find((f) => f.id === node.floorId)?.buildingId ?? null : null;
  const buildingIds = new Set(majorBuildingIds);
  if (hereBuildingId) buildingIds.add(hereBuildingId);
  return { buildingIds, majorBuildingIds: [...majorBuildingIds], hereBuildingId };
}
