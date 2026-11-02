import { z } from "zod";

/**
 * Validation schemas shared by admin forms, importers and API routes.
 * The database re-validates with constraints; these give early, localized feedback.
 */

const uuidish = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "invalid_id");
const optionalId = uuidish.nullish();
const text = (max: number) => z.string().trim().max(max);

export const localizedTextSchema = z.object({
  en: text(300).min(1, "required"),
  ckb: text(300).optional(),
  ar: text(300).optional(),
});

export const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalid_time");
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "invalid_date");
export const weekdaySchema = z.number().int().min(0).max(6);
export const localeSchema = z.enum(["en", "ckb", "ar"]);
export const dataStatusSchema = z.enum(["verified", "demo", "unverified"]);

export const universitySettingsSchema = z.object({
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "invalid_timezone"),
  weekendDays: z.array(weekdaySchema).max(6),
  defaultLocale: localeSchema,
  enabledLocales: z.array(localeSchema).min(1),
  timetableVisibility: z.enum(["public", "members"]),
  walkingSpeedMps: z.number().min(0.3).max(3),
  accessibleWalkingSpeedMps: z.number().min(0.2).max(3),
  stairsSecondsPerFloor: z.number().min(0).max(600),
  elevatorSecondsPerFloor: z.number().min(0).max(600),
});

export const universitySchema = z.object({
  id: uuidish,
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/, "invalid_slug"),
  name: localizedTextSchema,
  shortName: text(40).min(1),
  dataStatus: dataStatusSchema,
  published: z.boolean(),
  branding: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color").optional(),
    logoUrl: z.string().url().nullish(),
    productName: text(40).optional(),
  }),
  settings: universitySettingsSchema,
});

export const campusSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  name: localizedTextSchema,
  description: localizedTextSchema.nullish(),
  overviewWidth: z.number().positive().optional(),
  overviewHeight: z.number().positive().optional(),
  overviewImageUrl: z
    .string()
    .max(3_000_000)
    .refine((s) => /^https?:\/\//.test(s) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s), "invalid_image_url")
    .nullish(),
});

const rectSchema = z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() });

export const buildingSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  campusId: uuidish,
  code: text(20).min(1, "required"),
  name: localizedTextSchema,
  description: localizedTextSchema.nullish(),
  overview: rectSchema.nullish(),
  dataStatus: dataStatusSchema,
});

export const floorSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  buildingId: uuidish,
  level: z.number().int().min(-10).max(200),
  name: localizedTextSchema,
  width: z.number().positive().max(100000),
  height: z.number().positive().max(100000),
  metersPerUnit: z.number().positive().max(100),
  planAssetUrl: z.string().url().nullish(),
});

export const roomTypeSchema = z.enum([
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
]);

export const roomSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  buildingId: uuidish,
  floorId: uuidish,
  code: text(30).min(1, "required"),
  name: localizedTextSchema,
  type: roomTypeSchema,
  departmentId: optionalId,
  capacity: z.number().int().min(0).max(100000).nullish(),
  entranceNodeId: optionalId,
  accessible: z.boolean(),
  dataStatus: dataStatusSchema,
});

export const shapeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rect"), x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
  z.object({ type: z.literal("polygon"), points: z.array(z.tuple([z.number(), z.number()])).min(3).max(500) }),
]);

export const mapElementSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  floorId: uuidish,
  kind: z.enum(["room", "corridor", "stairs", "elevator", "entrance", "emergency_exit", "toilet", "wall", "outdoor", "building"]),
  shape: shapeSchema,
  label: localizedTextSchema.nullish(),
  roomId: optionalId,
});

export const navNodeSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  floorId: uuidish,
  x: z.number(),
  y: z.number(),
  kind: z.enum(["corridor", "room_entrance", "stairs", "elevator", "building_entrance", "checkpoint", "outdoor"]),
  label: localizedTextSchema.nullish(),
  verticalGroup: text(60).nullish(),
});

export const navEdgeSchema = z
  .object({
    id: uuidish,
    universityId: uuidish,
    fromNodeId: uuidish,
    toNodeId: uuidish,
    kind: z.enum(["corridor", "door", "stairs", "elevator", "ramp", "outdoor"]),
    distanceM: z.number().min(0).max(100000).nullish(),
    accessible: z.boolean(),
    bidirectional: z.boolean(),
    blocked: z.boolean(),
    restriction: text(60).nullish(),
  })
  .refine((e) => e.fromNodeId !== e.toNodeId, { message: "self_loop", path: ["toNodeId"] });

export const qrCheckpointSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  token: z.string().regex(/^[A-Za-z0-9]{16,64}$/, "invalid_token"),
  nodeId: uuidish,
  label: localizedTextSchema,
  status: z.enum(["active", "disabled"]),
  expiresAt: z.string().datetime({ offset: true }).nullish(),
});

export const departmentSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  code: text(20).min(1, "required"),
  name: localizedTextSchema,
  college: localizedTextSchema.nullish(),
  buildingId: optionalId,
});

export const officeHourSchema = z
  .object({ day: weekdaySchema, start: clockTimeSchema, end: clockTimeSchema })
  .refine((o) => o.start < o.end, { message: "end_before_start", path: ["end"] });

export const lecturerSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  departmentId: optionalId,
  fullName: localizedTextSchema,
  title: localizedTextSchema.nullish(),
  officeRoomId: optionalId,
  officeHours: z.array(officeHourSchema).max(50),
  publicEmail: z.string().email("invalid_email").nullish(),
  photoUrl: z.string().url().nullish(),
  availability: z
    .object({
      status: z.enum(["available", "away", "on_leave"]),
      note: localizedTextSchema.nullish(),
      updatedAt: z.string(),
    })
    .nullish(),
  dataStatus: dataStatusSchema,
});

export const courseSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  departmentId: optionalId,
  code: text(30).min(1, "required"),
  name: localizedTextSchema,
  description: localizedTextSchema.nullish(),
  credits: z.number().min(0).max(60).nullish(),
});

export const studentGroupSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  departmentId: optionalId,
  code: text(30).min(1, "required"),
  name: localizedTextSchema,
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "invalid_academic_year"),
  stage: z.number().int().min(1).max(10).nullish(),
});

export const semesterSchema = z
  .object({
    id: uuidish,
    universityId: uuidish,
    academicYear: z.string().regex(/^\d{4}-\d{4}$/, "invalid_academic_year"),
    name: localizedTextSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((s) => s.startDate <= s.endDate, { message: "end_before_start", path: ["endDate"] });

export const timetableEntrySchema = z
  .object({
    id: uuidish,
    universityId: uuidish,
    semesterId: optionalId,
    courseId: uuidish,
    lecturerId: optionalId,
    roomId: optionalId,
    groupId: optionalId,
    kind: z.enum(["lecture", "lab", "tutorial", "exam"]).nullish(),
    recurrence: z.enum(["weekly", "once"]),
    day: weekdaySchema,
    startTime: clockTimeSchema,
    endTime: clockTimeSchema,
    validFrom: isoDateSchema,
    validTo: isoDateSchema,
    status: z.enum(["scheduled", "cancelled"]),
  })
  .refine((e) => e.startTime < e.endTime, { message: "end_before_start", path: ["endTime"] })
  .refine((e) => e.validFrom <= e.validTo, { message: "end_before_start", path: ["validTo"] });

export const scheduleChangeSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  entryId: uuidish,
  date: isoDateSchema,
  type: z.enum(["cancelled", "room_change", "time_change", "lecturer_change"]),
  newRoomId: optionalId,
  newLecturerId: optionalId,
  newStartTime: clockTimeSchema.nullish(),
  newEndTime: clockTimeSchema.nullish(),
  note: localizedTextSchema.nullish(),
});

export const announcementSchema = z.object({
  id: uuidish,
  universityId: uuidish,
  title: localizedTextSchema,
  body: z.object({ en: text(5000).min(1), ckb: text(5000).optional(), ar: text(5000).optional() }),
  publishedAt: z.string(),
  expiresAt: z.string().nullish(),
  priority: z.enum(["normal", "important"]),
});

export const entitySchemas = {
  universities: universitySchema,
  campuses: campusSchema,
  buildings: buildingSchema,
  floors: floorSchema,
  rooms: roomSchema,
  map_elements: mapElementSchema,
  navigation_nodes: navNodeSchema,
  navigation_edges: navEdgeSchema,
  qr_checkpoints: qrCheckpointSchema,
  departments: departmentSchema,
  lecturers: lecturerSchema,
  courses: courseSchema,
  student_groups: studentGroupSchema,
  semesters: semesterSchema,
  timetable_entries: timetableEntrySchema,
  schedule_changes: scheduleChangeSchema,
  announcements: announcementSchema,
} as const;

export type EntityTable = keyof typeof entitySchemas;
