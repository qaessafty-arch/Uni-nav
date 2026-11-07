import type { CampusBundle, CourseMaterial, Department, Room, RoomType, ScheduleChange, StudentGroup, TimetableEntry } from "../model/types";

/**
 * Who is looking, and therefore what they may see.
 *
 *  - visitor: anyone, no account. Outdoor map, buildings, and the PUBLIC places
 *    indoors (offices, library, cafeteria, toilets, prayer rooms, services).
 *    No classrooms, lecture halls or labs, no timetables, no free rooms.
 *  - student: verified for one major (department) and year (stage). Everything
 *    a visitor sees, plus all rooms, plus the timetable of their own major and
 *    year only.
 *  - staff: university members (lecturers and administrators): everything.
 *
 * This is the client-side shape of the rule. With a real backend the database
 * enforces it (row-level security), so a visitor's device never receives
 * classroom or timetable rows in the first place; this filter keeps demo mode
 * and cached data consistent with it.
 */
export type Access =
  | { kind: "visitor" }
  | { kind: "student"; departmentId: string; year: number }
  | { kind: "staff" };

export const VISITOR: Access = { kind: "visitor" };

/** Rooms anyone may find and navigate to. Teaching rooms and storage are not public. */
export const PUBLIC_ROOM_TYPES: readonly RoomType[] = ["office", "library", "cafeteria", "toilet", "prayer_room", "service", "other"];

export function isPublicRoomType(type: RoomType): boolean {
  return PUBLIC_ROOM_TYPES.includes(type);
}

export function canSeeRoom(room: Pick<Room, "type">, access: Access): boolean {
  return access.kind !== "visitor" || isPublicRoomType(room.type);
}

export const DEFAULT_PROGRAM_YEARS = 4;

export function programYears(dept: Pick<Department, "programYears"> | undefined | null): number {
  const n = dept?.programYears;
  return typeof n === "number" && n >= 1 && n <= 7 ? n : DEFAULT_PROGRAM_YEARS;
}

/** The student's own sections: groups of their major and year. */
export function groupsForStudent(groups: readonly StudentGroup[], access: Access): StudentGroup[] {
  if (access.kind === "staff") return [...groups];
  if (access.kind !== "student") return [];
  return groups.filter((g) => g.departmentId === access.departmentId && g.stage === access.year);
}

export function canSeeTimetable(access: Access): boolean {
  return access.kind !== "visitor";
}

/** Whether an email belongs to one of the university's student domains (exact domain or a subdomain). */
export function emailInDomains(email: string, domains: readonly string[] | null | undefined): boolean {
  if (!domains || domains.length === 0) return true;
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 1) return false;
  const host = email.trim().toLowerCase().slice(at + 1);
  return domains.some((d) => {
    const dd = d.trim().toLowerCase().replace(/^@/, "");
    return host === dd || host.endsWith(`.${dd}`);
  });
}

/** Room bookings with everything personal removed: only room, day and times remain. */
export function anonymizeOccupancy(entries: readonly TimetableEntry[], changes: readonly ScheduleChange[]): { entries: TimetableEntry[]; changes: ScheduleChange[] } {
  const relevant = new Set<string>();
  const out = entries
    .filter((e) => e.roomId || changes.some((c) => c.entryId === e.id && c.newRoomId))
    .map((e) => {
      relevant.add(e.id);
      return { id: e.id, universityId: e.universityId, courseId: "", roomId: e.roomId ?? null, recurrence: e.recurrence, day: e.day, startTime: e.startTime, endTime: e.endTime, validFrom: e.validFrom, validTo: e.validTo, status: e.status };
    });
  const ch = changes
    .filter((c) => relevant.has(c.entryId) && c.type !== "lecturer_change")
    .map((c) => ({ id: c.id, universityId: c.universityId, entryId: c.entryId, date: c.date, type: c.type, newRoomId: c.newRoomId ?? null, newStartTime: c.newStartTime ?? null, newEndTime: c.newEndTime ?? null }));
  return { entries: out, changes: ch };
}

/** Strip what this audience may not see. Idempotent. */
export function bundleForAccess(bundle: CampusBundle, access: Access): CampusBundle {
  if (access.kind === "staff") return bundle;
  if (access.kind === "visitor") {
    const rooms = bundle.rooms.filter((r) => isPublicRoomType(r.type));
    const visible = new Set(rooms.map((r) => r.id));
    return {
      ...bundle,
      rooms,
      // Keep the outline so floor plans still draw, but drop the name and link of hidden rooms.
      mapElements: bundle.mapElements.map((e) => (e.roomId && !visible.has(e.roomId) ? { ...e, roomId: null, label: null } : e)),
      lecturers: bundle.lecturers.map((l) => (l.officeRoomId && !visible.has(l.officeRoomId) ? { ...l, officeRoomId: null } : l)),
      groups: [],
      timetable: [],
      scheduleChanges: [],
      roomOccupancy: null,
      announcements: bundle.announcements.filter((a) => !a.groupId),
      materials: [],
      classRoles: null,
    };
  }
  const groups = groupsForStudent(bundle.groups, access);
  const ids = new Set(groups.map((g) => g.id));
  const timetable = bundle.timetable.filter((t) => t.groupId != null && ids.has(t.groupId));
  const entryIds = new Set(timetable.map((t) => t.id));
  // Free rooms need every booking; keep them, anonymised, before narrowing the timetable.
  const roomOccupancy = bundle.roomOccupancy ?? anonymizeOccupancy(bundle.timetable, bundle.scheduleChanges);
  // Materials and class posts follow the same rule: the student's own classes only.
  const courseIds = new Set(timetable.map((t) => t.courseId));
  const materials = (bundle.materials ?? []).filter((m) => (m.groupId ? ids.has(m.groupId) : courseIds.has(m.courseId)));
  const announcements = bundle.announcements.filter((a) => !a.groupId || ids.has(a.groupId));
  return { ...bundle, groups, timetable, scheduleChanges: bundle.scheduleChanges.filter((c) => entryIds.has(c.entryId)), roomOccupancy, materials, announcements };
}

/**
 * Whether the signed-in person may upload materials to a course, and for which class.
 * Mirrors public.can_upload_material(): linked lecturer of the course (any class, or all),
 * or a rep of a class that takes the course when the course allows rep uploads.
 * Returns null when they may not upload; the database checks again.
 */
export function uploadTargets(bundle: CampusBundle, courseId: string): { allClasses: boolean; groupIds: string[] } | null {
  const roles = bundle.classRoles;
  if (!roles) return null;
  const entries = bundle.timetable.filter((t) => t.courseId === courseId && t.status !== "cancelled");
  if (roles.lecturerId && entries.some((t) => t.lecturerId === roles.lecturerId)) {
    return { allClasses: true, groupIds: [...new Set(entries.filter((t) => t.lecturerId === roles.lecturerId && t.groupId).map((t) => t.groupId!))] };
  }
  const course = bundle.courses.find((c) => c.id === courseId);
  if (course?.repsCanUpload === false) return null;
  const groupIds = [...new Set(entries.map((t) => t.groupId).filter((g): g is string => !!g && roles.repGroupIds.includes(g)))];
  return groupIds.length ? { allClasses: false, groupIds } : null;
}

/** Classes the person may post announcements to (rep groups, or groups their lecturer profile teaches). */
export function postableGroups(bundle: CampusBundle): string[] {
  const roles = bundle.classRoles;
  if (!roles) return [];
  const taught = roles.lecturerId ? bundle.timetable.filter((t) => t.lecturerId === roles.lecturerId && t.groupId).map((t) => t.groupId!) : [];
  return [...new Set([...roles.repGroupIds, ...taught])];
}

/** Group materials by section (newest first inside each section; sections by their newest item). */
export function materialsBySection(items: readonly CourseMaterial[]): { section: string | null; items: CourseMaterial[] }[] {
  const map = new Map<string | null, CourseMaterial[]>();
  for (const m of [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const k = m.section?.trim() || null;
    map.set(k, [...(map.get(k) ?? []), m]);
  }
  return [...map.entries()].map(([section, items]) => ({ section, items }));
}

/**
 * Materials a student has not seen yet: added after they last opened that course's page,
 * and within the last `windowDays` (so a first visit doesn't show the whole term as new).
 */
export function unseenMaterials(items: readonly CourseMaterial[], seenOf: (courseId: string) => string | null | undefined, now: Date, windowDays = 14): CourseMaterial[] {
  const floor = new Date(now.getTime() - windowDays * 86_400_000).toISOString();
  return items
    .filter((m) => {
      const seen = seenOf(m.courseId) || "";
      return m.createdAt > floor && m.createdAt > seen;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
