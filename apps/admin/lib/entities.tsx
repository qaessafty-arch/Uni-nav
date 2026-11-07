"use client";
import { BuildingMark } from "@/components/BuildingIdentity";
import {
  announcementSchema,
  buildingSchema,
  campusSchema,
  courseSchema,
  departmentSchema,
  floorSchema,
  lecturerSchema,
  lt,
  ROOM_TYPES,
  roomSchema,
  scheduleChangeSchema,
  semesterSchema,
  studentGroupSchema,
  type Announcement,
  type Building,
  type Campus,
  type Course,
  type Department,
  type Floor,
  type Lecturer,
  type LocalizedText,
  type Room,
  type ScheduleChange,
  type Semester,
  type StudentGroup,
} from "@campusnav/core";
import type { EntityConfig } from "@/components/EntityPage";
import { L, StatusBadge } from "@/components/EntityPage";
import { Badge, Code } from "@/components/ui";

const name = (r: Record<string, unknown>) => lt(r.name as LocalizedText, "en");
const status = { key: "dataStatus", label: "Data status", type: "select" as const, options: [{ value: "unverified", label: "Unverified" }, { value: "verified", label: "Verified (confirmed by the university)" }, { value: "demo", label: "Demo (fictional)" }] };

export const campusConfig: EntityConfig<Campus> = {
  table: "campuses",
  title: "Campuses",
  singular: "Campus",
  permission: "campus.manage",
  schema: campusSchema,
  fields: [
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "description", label: "Description", type: "localized", multiline: true },
    { key: "overviewWidth", label: "Overview map width (units)", type: "number" },
    { key: "overviewHeight", label: "Overview map height (units)", type: "number" },
  ],
  intro: "Add the campus picture and place buildings on it from Campus map.",
  columns: [
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Overview", render: (r) => (r.overviewWidth ? `${r.overviewWidth} × ${r.overviewHeight}` : "—") },
    { label: "Picture", render: (r) => (r.overviewImageUrl ? <Badge tone="accent">yes</Badge> : <Badge>none</Badge>) },
  ],
  searchText: (r) => `${r.name.en} ${r.name.ckb ?? ""} ${r.name.ar ?? ""}`,
  defaults: () => ({ name: { en: "" }, overviewWidth: 1000, overviewHeight: 700 }),
};

export const buildingConfig: EntityConfig<Building> = {
  table: "buildings",
  title: "Buildings",
  singular: "Building",
  permission: "building.manage",
  schema: buildingSchema,
  fields: [
    { key: "campusId", label: "Campus *", type: "relation", table: "campuses", display: name },
    { key: "code", label: "Code", type: "text", required: true, hint: "Short unique code, e.g. ENG" },
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "description", label: "Description", type: "localized", multiline: true },
    { key: "icon", label: "Logo, icon and colour", type: "identity" },
    { key: "hours", label: "Opening hours", type: "hours" },
    { key: "overview", label: "Location on campus map", type: "rect" },
    status,
  ],
  columns: [
    { label: "", render: (r) => <BuildingMark b={r} size={32} /> },
    { label: "Code", render: (r) => <Code>{r.code}</Code> },
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Campus", render: (r, rel) => <L v={rel("campuses", r.campusId)?.name} /> },
    { label: "Hours", render: (r) => (r.hours && Object.keys(r.hours).length ? `${Object.keys(r.hours).length} days` : "—") },
    { label: "Status", render: (r) => <StatusBadge status={r.dataStatus} /> },
  ],
  searchText: (r) => `${r.code} ${r.name.en} ${r.name.ckb ?? ""} ${r.name.ar ?? ""}`,
  defaults: () => ({ name: { en: "" }, code: "", dataStatus: "unverified", overview: null, icon: "building", color: "#1D4ED8", logoUrl: null, hours: null }),
  sort: (a, b) => a.code.localeCompare(b.code),
};

export const floorConfig: EntityConfig<Floor> = {
  table: "floors",
  title: "Floors",
  singular: "Floor",
  permission: "floor.manage",
  schema: floorSchema,
  intro: "Floor canvas size is in map units; metres per unit converts map distances into real walking distances. Use the Map editor to draw rooms and corridors.",
  fields: [
    { key: "buildingId", label: "Building *", type: "relation", table: "buildings", display: (r) => `${r.code} — ${name(r)}` },
    { key: "level", label: "Level (0 = ground, negative = basement)", type: "number" },
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "width", label: "Canvas width (units)", type: "number" },
    { key: "height", label: "Canvas height (units)", type: "number" },
    { key: "metersPerUnit", label: "Metres per unit", type: "number", step: 0.001, hint: "Measure a known corridor length on the official plan to calibrate. Never guess." },
  ],
  columns: [
    { label: "Building", render: (r, rel) => <Code>{String(rel("buildings", r.buildingId)?.code ?? "?")}</Code> },
    { label: "Level", render: (r) => <span className="mono">{r.level}</span> },
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Canvas", render: (r) => `${r.width} × ${r.height} @ ${r.metersPerUnit} m/u` },
    { label: "Plan", render: (r) => (r.planAssetUrl ? <Badge tone="accent">SVG</Badge> : <Badge>none</Badge>) },
  ],
  searchText: (r) => `${r.level} ${r.name.en}`,
  defaults: () => ({ name: { en: "" }, level: 0, width: 1000, height: 600, metersPerUnit: 0.05, planAssetUrl: null }),
  sort: (a, b) => a.buildingId.localeCompare(b.buildingId) || a.level - b.level,
};

export const roomConfig: EntityConfig<Room> = {
  table: "rooms",
  title: "Rooms",
  singular: "Room",
  permission: "room.manage",
  schema: roomSchema,
  intro: "Room boundaries and entrances are drawn in the Map editor. A room without an entrance node cannot be navigated to.",
  fields: [
    { key: "buildingId", label: "Building *", type: "relation", table: "buildings", display: (r) => `${r.code} — ${name(r)}` },
    { key: "floorId", label: "Floor *", type: "relation", table: "floors", display: (r) => `Level ${r.level} — ${name(r)}`, filter: (r, f) => r.buildingId === f.buildingId },
    { key: "code", label: "Room number / code", type: "text", required: true },
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "type", label: "Type", type: "select", options: ROOM_TYPES.map((t) => ({ value: t, label: t.replace("_", " ") })) },
    { key: "departmentId", label: "Department", type: "relation", table: "departments", display: name, nullable: true },
    { key: "capacity", label: "Capacity", type: "number" },
    { key: "entranceNodeId", label: "Entrance node", type: "relation", table: "navigation_nodes", nullable: true, display: (r) => `${(r.kind as string).replace("_", " ")} @ ${Math.round(r.x as number)},${Math.round(r.y as number)} ${lt(r.label as LocalizedText, "en")}`, filter: (r, f) => r.floorId === f.floorId && (r.kind === "room_entrance" || r.kind === "corridor") },
    { key: "accessible", label: "Step-free access", type: "boolean" },
    status,
  ],
  columns: [
    { label: "Code", render: (r) => <Code>{r.code}</Code> },
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Building / floor", render: (r, rel) => <span className="mono text-xs">{String(rel("buildings", r.buildingId)?.code ?? "?")} · L{String(rel("floors", r.floorId)?.level ?? "?")}</span> },
    { label: "Type", render: (r) => r.type.replace("_", " ") },
    { label: "Routing", render: (r) => (r.entranceNodeId ? <Badge tone="accent">entrance</Badge> : <Badge tone="danger">no entrance</Badge>) },
    { label: "Status", render: (r) => <StatusBadge status={r.dataStatus} /> },
  ],
  searchText: (r) => `${r.code} ${r.name.en} ${r.name.ckb ?? ""} ${r.name.ar ?? ""} ${r.type}`,
  defaults: () => ({ name: { en: "" }, code: "", type: "classroom", accessible: true, dataStatus: "unverified", entranceNodeId: null, departmentId: null, capacity: null }),
  sort: (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }),
};

export const departmentConfig: EntityConfig<Department> = {
  table: "departments",
  title: "Departments",
  singular: "Department",
  permission: "department.manage",
  schema: departmentSchema,
  fields: [
    { key: "code", label: "Code", type: "text", required: true },
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "college", label: "College / faculty", type: "localized" },
    { key: "buildingId", label: "Main building", type: "relation", table: "buildings", display: (r) => `${r.code} — ${name(r)}`, nullable: true },
    { key: "programYears", label: "Programme length (years)", type: "number", hint: "Bachelor = 4 by default; students can be years 1 to this." },
  ],
  columns: [
    { label: "Code", render: (r) => <Code>{r.code}</Code> },
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "College", render: (r) => <L v={r.college} /> },
    { label: "Years", render: (r) => <span className="mono">{r.programYears ?? 4}</span> },
  ],
  searchText: (r) => `${r.code} ${r.name.en} ${r.name.ckb ?? ""} ${r.name.ar ?? ""}`,
  defaults: () => ({ name: { en: "" }, code: "", college: null, buildingId: null, programYears: 4 }),
};

export const lecturerConfig: EntityConfig<Lecturer> = {
  table: "lecturers",
  title: "Lecturers",
  singular: "Lecturer",
  permission: "lecturer.manage",
  schema: lecturerSchema,
  intro: "Only publish contact details and photos the lecturer has approved for public display. Never enter private phone numbers or personal email addresses.",
  fields: [
    { key: "fullName", label: "Full name", type: "localized", required: true },
    { key: "title", label: "Academic title", type: "localized" },
    { key: "departmentId", label: "Department", type: "relation", table: "departments", display: name, nullable: true },
    { key: "officeRoomId", label: "Office room", type: "relation", table: "rooms", display: (r) => `${r.code} — ${name(r)}`, nullable: true, filter: (r) => r.type === "office" || true },
    { key: "officeHours", label: "Office hours", type: "officeHours" },
    { key: "publicEmail", label: "Public contact email", type: "email" },
    { key: "photoUrl", label: "Photo URL (authorised only)", type: "url" },
    status,
  ],
  columns: [
    { label: "Name", render: (r) => <L v={r.fullName} /> },
    { label: "Department", render: (r, rel) => <L v={rel("departments", r.departmentId)?.name} /> },
    { label: "Office", render: (r, rel) => (r.officeRoomId ? <Code>{String(rel("rooms", r.officeRoomId)?.code ?? "?")}</Code> : <Badge tone="warn">none</Badge>) },
    { label: "Hours", render: (r) => r.officeHours.length },
    { label: "Status", render: (r) => <StatusBadge status={r.dataStatus} /> },
  ],
  searchText: (r) => `${r.fullName.en} ${r.fullName.ckb ?? ""} ${r.fullName.ar ?? ""} ${r.publicEmail ?? ""}`,
  defaults: () => ({ fullName: { en: "" }, officeHours: [], dataStatus: "unverified", departmentId: null, officeRoomId: null, publicEmail: null, photoUrl: null, availability: null, title: null }),
  sort: (a, b) => a.fullName.en.localeCompare(b.fullName.en),
};

export const courseConfig: EntityConfig<Course> = {
  table: "courses",
  title: "Courses",
  singular: "Course",
  permission: "course.manage",
  schema: courseSchema,
  fields: [
    { key: "code", label: "Code", type: "text", required: true },
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "departmentId", label: "Department", type: "relation", table: "departments", display: name, nullable: true },
    { key: "credits", label: "Credits", type: "number", step: 0.5 },
    { key: "repsCanUpload", label: "Class reps may upload lecture materials", type: "boolean" },
    { key: "description", label: "Description", type: "localized", multiline: true },
  ],
  columns: [
    { label: "Code", render: (r) => <Code>{r.code}</Code> },
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Department", render: (r, rel) => <L v={rel("departments", r.departmentId)?.name} /> },
    { label: "Credits", render: (r) => r.credits ?? "—" },
  ],
  searchText: (r) => `${r.code} ${r.name.en} ${r.name.ckb ?? ""} ${r.name.ar ?? ""}`,
  defaults: () => ({ name: { en: "" }, code: "", departmentId: null, credits: null, description: null, repsCanUpload: true }),
  sort: (a, b) => a.code.localeCompare(b.code),
};

export const groupConfig: EntityConfig<StudentGroup> = {
  table: "student_groups",
  title: "Student groups",
  singular: "Group",
  permission: "group.manage",
  schema: studentGroupSchema,
  fields: [
    { key: "code", label: "Code", type: "text", required: true },
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "departmentId", label: "Department", type: "relation", table: "departments", display: name, nullable: true },
    { key: "academicYear", label: "Academic year (e.g. 2026-2027)", type: "text", required: true },
    { key: "stage", label: "Stage / year", type: "number" },
  ],
  columns: [
    { label: "Code", render: (r) => <Code>{r.code}</Code> },
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Year", render: (r) => r.academicYear },
    { label: "Stage", render: (r) => r.stage ?? "—" },
  ],
  searchText: (r) => `${r.code} ${r.name.en}`,
  defaults: () => ({ name: { en: "" }, code: "", academicYear: "2026-2027", stage: 1, departmentId: null }),
  sort: (a, b) => a.code.localeCompare(b.code),
};

export const semesterConfig: EntityConfig<Semester> = {
  table: "semesters",
  title: "Semesters",
  singular: "Semester",
  permission: "timetable.manage",
  schema: semesterSchema,
  fields: [
    { key: "name", label: "Name", type: "localized", required: true },
    { key: "academicYear", label: "Academic year", type: "text", required: true },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
  ],
  columns: [
    { label: "Name", render: (r) => <L v={r.name} /> },
    { label: "Year", render: (r) => r.academicYear },
    { label: "Dates", render: (r) => <span className="mono text-xs">{r.startDate} → {r.endDate}</span> },
  ],
  searchText: (r) => `${r.name.en} ${r.academicYear}`,
  defaults: () => ({ name: { en: "" }, academicYear: "2026-2027" }),
};

export const announcementConfig: EntityConfig<Announcement> = {
  table: "announcements",
  title: "Announcements",
  singular: "Announcement",
  permission: "announcement.manage",
  schema: announcementSchema,
  fields: [
    { key: "title", label: "Title", type: "localized", required: true },
    { key: "body", label: "Body", type: "localized", required: true, multiline: true },
    { key: "priority", label: "Priority", type: "select", options: [{ value: "normal", label: "Normal" }, { value: "important", label: "Important" }] },
    { key: "groupId", label: "Only for class (leave empty for everyone)", type: "relation", table: "student_groups", display: (r) => `${r.code} — ${name(r)}`, nullable: true },
    { key: "publishedAt", label: "Publish at", type: "datetime" },
    { key: "expiresAt", label: "Expires at", type: "datetime" },
  ],
  columns: [
    { label: "Title", render: (r) => <L v={r.title} /> },
    { label: "Priority", render: (r) => (r.priority === "important" ? <Badge tone="warn">important</Badge> : "normal") },
    { label: "Audience", render: (r, rel) => (r.groupId ? <Badge tone="accent">{String(rel("student_groups", r.groupId)?.code ?? "class")}</Badge> : "everyone") },
    { label: "Published", render: (r) => <span className="mono text-xs">{r.publishedAt.slice(0, 16).replace("T", " ")}</span> },
    { label: "Expires", render: (r) => <span className="mono text-xs">{r.expiresAt ? r.expiresAt.slice(0, 16).replace("T", " ") : "—"}</span> },
  ],
  searchText: (r) => `${r.title.en} ${r.body.en}`,
  defaults: () => ({ title: { en: "" }, body: { en: "" }, priority: "normal", publishedAt: new Date().toISOString(), expiresAt: null, groupId: null }),
  sort: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
};

export const scheduleChangeConfig: EntityConfig<ScheduleChange> = {
  table: "schedule_changes",
  title: "Schedule changes",
  singular: "Schedule change",
  permission: "timetable.department_manage",
  schema: scheduleChangeSchema,
  intro: "Publish a one-off change to a single lecture occurrence (cancellation, room, time or lecturer change). Students see it on that date in their timetable and notifications.",
  fields: [
    { key: "entryId", label: "Timetable entry *", type: "relation", table: "timetable_entries", display: (r) => `Day ${r.day} ${r.startTime}–${r.endTime} · ${String(r.courseId).slice(0, 8)}` },
    { key: "date", label: "Occurrence date", type: "date" },
    { key: "type", label: "Change type", type: "select", options: [{ value: "cancelled", label: "Cancelled" }, { value: "room_change", label: "Room change" }, { value: "time_change", label: "Time change" }, { value: "lecturer_change", label: "Lecturer change" }] },
    { key: "newRoomId", label: "New room", type: "relation", table: "rooms", display: (r) => `${r.code} — ${name(r)}`, nullable: true },
    { key: "newLecturerId", label: "New lecturer", type: "relation", table: "lecturers", display: (r) => lt(r.fullName as LocalizedText, "en"), nullable: true },
    { key: "newStartTime", label: "New start", type: "time" },
    { key: "newEndTime", label: "New end", type: "time" },
    { key: "note", label: "Note to students", type: "localized" },
  ],
  columns: [
    { label: "Date", render: (r) => <span className="mono">{r.date}</span> },
    { label: "Type", render: (r) => <Badge tone={r.type === "cancelled" ? "danger" : "warn"}>{r.type.replace("_", " ")}</Badge> },
    { label: "Details", render: (r, rel) => (r.newRoomId ? `→ ${String(rel("rooms", r.newRoomId)?.code ?? "?")}` : r.newStartTime ? `${r.newStartTime}–${r.newEndTime}` : r.newLecturerId ? <L v={rel("lecturers", r.newLecturerId)?.fullName} /> : "—") },
    { label: "Note", render: (r) => <L v={r.note} /> },
  ],
  searchText: (r) => `${r.date} ${r.type} ${r.note?.en ?? ""}`,
  defaults: () => ({ type: "cancelled", date: new Date().toISOString().slice(0, 10), newRoomId: null, newLecturerId: null, newStartTime: null, newEndTime: null, note: null }),
  sort: (a, b) => b.date.localeCompare(a.date),
  beforeSave: (r) => {
    if (r.type === "room_change" && !r.newRoomId) return "Choose the new room.";
    if (r.type === "lecturer_change" && !r.newLecturerId) return "Choose the new lecturer.";
    if (r.type === "time_change" && (!r.newStartTime || !r.newEndTime || r.newStartTime >= r.newEndTime)) return "Enter a valid new start and end time.";
    return null;
  },
};
