/**
 * CAMPUS NAV domain model.
 *
 * Every tenant-owned record carries `universityId`. The backend enforces tenant
 * isolation (Postgres RLS); these types only describe shape.
 */

export type Locale = "en" | "ckb" | "ar";
export const LOCALES: readonly Locale[] = ["en", "ckb", "ar"] as const;

/** Text stored per language. English is required as the canonical fallback. */
export interface LocalizedText {
  en: string;
  ckb?: string;
  ar?: string;
}

export type ISODate = string; // YYYY-MM-DD (university-local calendar date)
export type ClockTime = string; // HH:MM (24h, university-local wall clock)

/** 0 = Sunday … 6 = Saturday (same as JS Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DataStatus = "verified" | "demo" | "unverified";

export interface UniversityBranding {
  primaryColor?: string;
  logoUrl?: string | null;
  productName?: string; // e.g. "SUL NAV"
}

export interface UniversitySettings {
  /** IANA zone, e.g. "Asia/Baghdad". Never assume UTC. */
  timezone: string;
  weekendDays: Weekday[];
  defaultLocale: Locale;
  enabledLocales: Locale[];
  /** Whether anonymous visitors can see timetables. */
  timetableVisibility: "public" | "members";
  /** Walking speed assumptions used for time estimates (metres / second). */
  walkingSpeedMps: number;
  accessibleWalkingSpeedMps: number;
  /** Seconds added per floor transition by stairs / elevator. */
  stairsSecondsPerFloor: number;
  elevatorSecondsPerFloor: number;
}

export interface University {
  id: string;
  slug: string;
  name: LocalizedText;
  shortName: string;
  dataStatus: DataStatus;
  published: boolean;
  branding: UniversityBranding;
  settings: UniversitySettings;
}

/** [longitude, latitude] in WGS84 (GeoJSON order). */
export type LngLat = [number, number];

/** Where a campus is on the real map. */
export interface CampusGeo {
  center: LngLat;
  zoom: number;
  bearing?: number;
  /** Where the location came from, e.g. "OpenStreetMap" or "University survey". */
  source?: string | null;
}

/** A building outline on the real map (closed ring, first point not repeated). */
export interface BuildingGeo {
  footprint: LngLat[];
}

export interface Campus {
  id: string;
  universityId: string;
  name: LocalizedText;
  description?: LocalizedText | null;
  /** Optional outdoor overview map (floor-like canvas) */
  overviewWidth?: number;
  overviewHeight?: number;
  /**
   * Optional background picture for the campus overview (aerial photo or official
   * campus plan). Stretched over the overview canvas; building footprints are drawn on top.
   */
  overviewImageUrl?: string | null;
  /** Real-world location; enables the real map. */
  geo?: CampusGeo | null;
}

export interface Building {
  id: string;
  universityId: string;
  campusId: string;
  code: string;
  name: LocalizedText;
  description?: LocalizedText | null;
  /** Footprint on the campus overview canvas */
  overview?: { x: number; y: number; w: number; h: number } | null;
  /** Outline on the real map (drawn by staff in the admin Campus map). */
  geo?: BuildingGeo | null;
  dataStatus: DataStatus;
}

export interface Floor {
  id: string;
  universityId: string;
  buildingId: string;
  /** 0 = ground floor, negative for basements. */
  level: number;
  name: LocalizedText;
  /** Floor-plan canvas size in map units. */
  width: number;
  height: number;
  /** How many metres one map unit represents. Required for real distances. */
  metersPerUnit: number;
  /** Optional uploaded SVG floor plan (storage URL), drawn underneath elements. */
  planAssetUrl?: string | null;
}

export type RoomType =
  | "lecture_hall"
  | "classroom"
  | "laboratory"
  | "office"
  | "library"
  | "cafeteria"
  | "toilet"
  | "prayer_room"
  | "service"
  | "storage"
  | "other";

export const ROOM_TYPES: readonly RoomType[] = [
  "lecture_hall",
  "classroom",
  "laboratory",
  "office",
  "library",
  "cafeteria",
  "toilet",
  "prayer_room",
  "service",
  "storage",
  "other",
];

export interface Room {
  id: string;
  universityId: string;
  buildingId: string;
  floorId: string;
  code: string; // e.g. "204"
  name: LocalizedText;
  type: RoomType;
  departmentId?: string | null;
  capacity?: number | null;
  /** Navigation node a route should end at. */
  entranceNodeId?: string | null;
  accessible: boolean;
  dataStatus: DataStatus;
}

export type Shape =
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "polygon"; points: [number, number][] };

export type MapElementKind =
  | "room"
  | "corridor"
  | "stairs"
  | "elevator"
  | "entrance"
  | "emergency_exit"
  | "toilet"
  | "wall"
  | "outdoor"
  | "building";

export interface MapElement {
  id: string;
  universityId: string;
  floorId: string;
  kind: MapElementKind;
  shape: Shape;
  label?: LocalizedText | null;
  roomId?: string | null;
}

export type NavNodeKind =
  | "corridor"
  | "room_entrance"
  | "stairs"
  | "elevator"
  | "building_entrance"
  | "checkpoint"
  | "outdoor";

export interface NavNode {
  id: string;
  universityId: string;
  floorId: string;
  x: number;
  y: number;
  kind: NavNodeKind;
  label?: LocalizedText | null;
  /** Nodes of kind stairs/elevator sharing a group id belong to one shaft/stairwell. */
  verticalGroup?: string | null;
}

export type NavEdgeKind = "corridor" | "door" | "stairs" | "elevator" | "ramp" | "outdoor";

export interface NavEdge {
  id: string;
  universityId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: NavEdgeKind;
  /**
   * Walking length in metres. If omitted, it is computed from node coordinates
   * and the floor scale (only possible for same-floor edges).
   */
  distanceM?: number | null;
  accessible: boolean;
  bidirectional: boolean;
  blocked: boolean;
  /** Free-form restriction label (e.g. "staff_only"); routes avoid restricted edges unless allowed. */
  restriction?: string | null;
}

export interface QrCheckpoint {
  id: string;
  universityId: string;
  /** Opaque random token printed in the QR. Contains no location or private data. */
  token: string;
  nodeId: string;
  label: LocalizedText;
  status: "active" | "disabled";
  expiresAt?: string | null; // ISO timestamp
}

export interface Department {
  id: string;
  universityId: string;
  code: string;
  name: LocalizedText;
  college?: LocalizedText | null;
  buildingId?: string | null;
}

export interface OfficeHour {
  day: Weekday;
  start: ClockTime;
  end: ClockTime;
}

export interface Lecturer {
  id: string;
  universityId: string;
  departmentId?: string | null;
  fullName: LocalizedText;
  title?: LocalizedText | null;
  officeRoomId?: string | null;
  officeHours: OfficeHour[];
  /** Only public, institution-approved contact info. */
  publicEmail?: string | null;
  photoUrl?: string | null;
  /** Availability is shown only if explicitly provided by an authorised source. */
  availability?: { status: "available" | "away" | "on_leave"; note?: LocalizedText | null; updatedAt: string } | null;
  dataStatus: DataStatus;
}

export interface Course {
  id: string;
  universityId: string;
  departmentId?: string | null;
  code: string;
  name: LocalizedText;
  description?: LocalizedText | null;
  credits?: number | null;
}

export interface StudentGroup {
  id: string;
  universityId: string;
  departmentId?: string | null;
  code: string;
  name: LocalizedText;
  academicYear: string; // e.g. "2026-2027"
  stage?: number | null;
}

export interface Semester {
  id: string;
  universityId: string;
  academicYear: string;
  name: LocalizedText;
  startDate: ISODate;
  endDate: ISODate;
}

export type TimetableStatus = "scheduled" | "cancelled";

export interface TimetableEntry {
  id: string;
  universityId: string;
  semesterId?: string | null;
  courseId: string;
  lecturerId?: string | null;
  roomId?: string | null;
  groupId?: string | null;
  kind?: "lecture" | "lab" | "tutorial" | "exam" | null;
  /** weekly: repeats on `day` within the date range. once: happens on `validFrom` only. */
  recurrence: "weekly" | "once";
  day: Weekday;
  startTime: ClockTime;
  endTime: ClockTime;
  validFrom: ISODate;
  validTo: ISODate;
  status: TimetableStatus;
}

export type ScheduleChangeType = "cancelled" | "room_change" | "time_change" | "lecturer_change";

export interface ScheduleChange {
  id: string;
  universityId: string;
  entryId: string;
  /** Occurrence date the change applies to. */
  date: ISODate;
  type: ScheduleChangeType;
  newRoomId?: string | null;
  newLecturerId?: string | null;
  newStartTime?: ClockTime | null;
  newEndTime?: ClockTime | null;
  note?: LocalizedText | null;
}

/**
 * A temporary closure set by staff (construction, exams, elevator out of service).
 * - edge: one corridor/stairs/elevator segment is closed
 * - node: everything touching that point is closed (e.g. an elevator shaft stop)
 * - room: the room itself is closed (navigation still works but users are warned)
 * Routes avoid active edge/node closures automatically.
 */
export interface Closure {
  id: string;
  universityId: string;
  targetType: "edge" | "node" | "room";
  targetId: string;
  reason: LocalizedText;
  startsAt: string; // ISO timestamp
  endsAt?: string | null; // ISO timestamp; null = until reopened
}

export type ProblemCategory = "wrong_location" | "blocked_path" | "wrong_directions" | "wrong_info" | "accessibility" | "other";
export const PROBLEM_CATEGORIES: readonly ProblemCategory[] = ["wrong_location", "blocked_path", "wrong_directions", "wrong_info", "accessibility", "other"];
export type ProblemStatus = "open" | "in_progress" | "resolved" | "rejected";

/** A user report about wrong campus data or a bad route. Contains no personal data. */
export interface ProblemReport {
  id: string;
  universityId: string;
  category: ProblemCategory;
  message: string;
  roomId?: string | null;
  nodeId?: string | null;
  routeFromNodeId?: string | null;
  routeToNodeId?: string | null;
  status: ProblemStatus;
  adminNote?: string | null;
  createdAt: string;
}

export interface ProblemReportInput {
  universityId: string;
  category: ProblemCategory;
  message: string;
  roomId?: string | null;
  nodeId?: string | null;
  routeFromNodeId?: string | null;
  routeToNodeId?: string | null;
}

export interface Announcement {
  id: string;
  universityId: string;
  title: LocalizedText;
  body: LocalizedText;
  publishedAt: string;
  expiresAt?: string | null;
  priority: "normal" | "important";
}

/**
 * Everything a client needs to render and navigate one university offline.
 * Fetched in one go and cached; `generatedAt` is shown in offline mode.
 */
export interface CampusBundle {
  schemaVersion: 1;
  generatedAt: string;
  source: "demo" | "supabase";
  university: University;
  campuses: Campus[];
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  mapElements: MapElement[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
  /** Checkpoint tokens are NOT included; only id/node/label so maps can draw them. */
  checkpoints: Pick<QrCheckpoint, "id" | "nodeId" | "label">[];
  departments: Department[];
  lecturers: Lecturer[];
  courses: Course[];
  groups: StudentGroup[];
  semesters: Semester[];
  timetable: TimetableEntry[];
  scheduleChanges: ScheduleChange[];
  announcements: Announcement[];
  /** Active and upcoming closures (optional for compatibility with older cached bundles). */
  closures?: Closure[];
}

export interface UniversitySummary {
  id: string;
  slug: string;
  name: LocalizedText;
  shortName: string;
  dataStatus: DataStatus;
  branding: UniversityBranding;
}
