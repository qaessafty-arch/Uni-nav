import type { Building, Course, Lecturer, Room, StudentGroup, TimetableEntry, Weekday } from "../model/types";
import { timetableEntrySchema } from "../model/schemas";
import { normalizeSearch } from "../search/normalize";
import { detectConflicts, type Conflict } from "../timetable/schedule";

export const TIMETABLE_COLUMNS = [
  "course_code",
  "group_code",
  "lecturer",
  "building_code",
  "room_code",
  "day",
  "start_time",
  "end_time",
  "valid_from",
  "valid_to",
  "kind",
  "recurrence",
] as const;

export const REQUIRED_COLUMNS = ["course_code", "day", "start_time", "end_time", "valid_from", "valid_to"] as const;

export type ImportErrorCode =
  | "missing_column"
  | "required"
  | "unknown_course"
  | "unknown_group"
  | "unknown_lecturer"
  | "ambiguous_lecturer"
  | "unknown_building"
  | "unknown_room"
  | "invalid_day"
  | "invalid_time"
  | "invalid_date"
  | "end_before_start"
  | "invalid_kind"
  | "invalid_recurrence"
  | "duplicate_row";

export interface ImportError {
  /** 1-based row number in the source file (header = row 1). */
  row: number;
  column: string;
  code: ImportErrorCode;
  value?: string;
}

export interface ImportPreview {
  entries: (TimetableEntry & { sourceRow: number })[];
  errors: ImportError[];
  /** Conflicts among imported rows and against existing entries. Import must be blocked while non-empty unless explicitly reviewed. */
  conflicts: Conflict[];
  totalRows: number;
}

export interface ImportContext {
  universityId: string;
  courses: Course[];
  groups: StudentGroup[];
  lecturers: Lecturer[];
  buildings: Building[];
  rooms: Room[];
  existing: TimetableEntry[];
  newId: () => string;
}

const DAY_NAMES: Record<string, Weekday> = {};
const dayAliases: [Weekday, string[]][] = [
  [0, ["0", "sun", "sunday", "یەکشەممە", "يه کشه ممه", "الأحد", "الاحد", "احد"]],
  [1, ["1", "mon", "monday", "دووشەممە", "الاثنين", "الإثنين", "اثنين"]],
  [2, ["2", "tue", "tuesday", "سێشەممە", "الثلاثاء", "ثلاثاء"]],
  [3, ["3", "wed", "wednesday", "چوارشەممە", "الأربعاء", "الاربعاء", "اربعاء"]],
  [4, ["4", "thu", "thursday", "پێنجشەممە", "الخميس", "خميس"]],
  [5, ["5", "fri", "friday", "هەینی", "الجمعة", "جمعة"]],
  [6, ["6", "sat", "saturday", "شەممە", "السبت", "سبت"]],
];
for (const [d, names] of dayAliases) for (const n of names) DAY_NAMES[normalizeSearch(n)] = d;

export function parseDay(v: string): Weekday | null {
  return DAY_NAMES[normalizeSearch(v)] ?? null;
}

function normTime(v: string): string | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(asciiDigits(v).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function asciiDigits(v: string): string {
  return v.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function normDate(v: string): string | null {
  const s = asciiDigits(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // DD/MM/YYYY (regional convention)
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Validate and resolve a parsed CSV (first row = header) into timetable entries.
 * Nothing is written: callers show the preview and ask for confirmation.
 */
export function previewTimetableImport(rows: string[][], ctx: ImportContext): ImportPreview {
  const errors: ImportError[] = [];
  const entries: ImportPreview["entries"] = [];
  if (rows.length === 0) return { entries, errors: [{ row: 1, column: "*", code: "required" }], conflicts: [], totalRows: 0 };

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  for (const col of REQUIRED_COLUMNS) if (!header.includes(col)) errors.push({ row: 1, column: col, code: "missing_column" });
  if (errors.length) return { entries, errors, conflicts: [], totalRows: rows.length - 1 };
  const idx = (c: string) => header.indexOf(c);
  const get = (r: string[], c: string) => (idx(c) >= 0 ? (r[idx(c)] ?? "").trim() : "");

  const courseByCode = new Map(ctx.courses.map((c) => [normalizeSearch(c.code), c]));
  const groupByCode = new Map(ctx.groups.map((g) => [normalizeSearch(g.code), g]));
  const buildingByCode = new Map(ctx.buildings.map((b) => [normalizeSearch(b.code), b]));
  const roomKey = (bId: string, code: string) => `${bId}::${normalizeSearch(code)}`;
  const roomByKey = new Map(ctx.rooms.map((r) => [roomKey(r.buildingId, r.code), r]));
  const lecturerIndex = new Map<string, Lecturer[]>();
  for (const l of ctx.lecturers) {
    for (const name of [l.id, l.publicEmail ?? "", l.fullName.en, l.fullName.ckb ?? "", l.fullName.ar ?? ""]) {
      if (!name) continue;
      const k = normalizeSearch(name);
      const list = lecturerIndex.get(k) ?? [];
      if (!list.includes(l)) list.push(l);
      lecturerIndex.set(k, list);
    }
  }

  const seenRows = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const rowNo = i + 1;
    const rowErrors: ImportError[] = [];
    const err = (column: string, code: ImportErrorCode, value?: string) => rowErrors.push({ row: rowNo, column, code, value });

    for (const col of REQUIRED_COLUMNS) if (!get(r, col)) err(col, "required");

    const courseCode = get(r, "course_code");
    const course = courseCode ? courseByCode.get(normalizeSearch(courseCode)) : undefined;
    if (courseCode && !course) err("course_code", "unknown_course", courseCode);

    const groupCode = get(r, "group_code");
    const group = groupCode ? groupByCode.get(normalizeSearch(groupCode)) : undefined;
    if (groupCode && !group) err("group_code", "unknown_group", groupCode);

    const lecturerRaw = get(r, "lecturer");
    let lecturer: Lecturer | undefined;
    if (lecturerRaw) {
      const matches = lecturerIndex.get(normalizeSearch(lecturerRaw)) ?? [];
      if (matches.length === 0) err("lecturer", "unknown_lecturer", lecturerRaw);
      else if (matches.length > 1) err("lecturer", "ambiguous_lecturer", lecturerRaw);
      else lecturer = matches[0];
    }

    const bCode = get(r, "building_code");
    const rCode = get(r, "room_code");
    let room: Room | undefined;
    if (bCode || rCode) {
      const building = bCode ? buildingByCode.get(normalizeSearch(bCode)) : undefined;
      if (!building) err("building_code", bCode ? "unknown_building" : "required", bCode);
      else if (!rCode) err("room_code", "required");
      else {
        room = roomByKey.get(roomKey(building.id, rCode));
        if (!room) err("room_code", "unknown_room", rCode);
      }
    }

    const dayRaw = get(r, "day");
    const day = dayRaw ? parseDay(dayRaw) : null;
    if (dayRaw && day == null) err("day", "invalid_day", dayRaw);
    const start = get(r, "start_time") ? normTime(get(r, "start_time")) : null;
    if (get(r, "start_time") && !start) err("start_time", "invalid_time", get(r, "start_time"));
    const end = get(r, "end_time") ? normTime(get(r, "end_time")) : null;
    if (get(r, "end_time") && !end) err("end_time", "invalid_time", get(r, "end_time"));
    if (start && end && start >= end) err("end_time", "end_before_start");
    const from = get(r, "valid_from") ? normDate(get(r, "valid_from")) : null;
    if (get(r, "valid_from") && !from) err("valid_from", "invalid_date", get(r, "valid_from"));
    const to = get(r, "valid_to") ? normDate(get(r, "valid_to")) : null;
    if (get(r, "valid_to") && !to) err("valid_to", "invalid_date", get(r, "valid_to"));
    if (from && to && from > to) err("valid_to", "end_before_start");
    const kind = (get(r, "kind") || "lecture").toLowerCase();
    if (!["lecture", "lab", "tutorial", "exam"].includes(kind)) err("kind", "invalid_kind", kind);
    const recurrence = (get(r, "recurrence") || "weekly").toLowerCase();
    if (!["weekly", "once"].includes(recurrence)) err("recurrence", "invalid_recurrence", recurrence);

    const dupKey = [course?.id, group?.id, lecturer?.id, room?.id, day, start, end, from, to].join("|");
    if (rowErrors.length === 0 && seenRows.has(dupKey)) err("*", "duplicate_row");
    seenRows.add(dupKey);

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }
    const entry: TimetableEntry = {
      id: ctx.newId(),
      universityId: ctx.universityId,
      semesterId: null,
      courseId: course!.id,
      lecturerId: lecturer?.id ?? null,
      roomId: room?.id ?? null,
      groupId: group?.id ?? null,
      kind: kind as TimetableEntry["kind"],
      recurrence: recurrence as TimetableEntry["recurrence"],
      day: day!,
      startTime: start!,
      endTime: end!,
      validFrom: from!,
      validTo: to!,
      status: "scheduled",
    };
    const parsed = timetableEntrySchema.safeParse(entry);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push({ row: rowNo, column: String(issue.path[0] ?? "*"), code: "required" });
      continue;
    }
    entries.push({ ...entry, sourceRow: rowNo });
  }

  const importedIds = new Set(entries.map((e) => e.id));
  const conflicts = detectConflicts([...ctx.existing, ...entries]).filter((c) => importedIds.has(c.a) || importedIds.has(c.b));
  return { entries, errors, conflicts, totalRows: rows.length - 1 };
}

export function timetableTemplateCsv(): string {
  return [
    TIMETABLE_COLUMNS.join(","),
    "DEMO-CS101,DEMO-CS-Y1-A,Demo Lecturer A,DEMO-ENG,101,Sun,08:30,10:00,2026-09-20,2027-01-15,lecture,weekly",
  ].join("\r\n");
}
