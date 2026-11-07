import type { Access } from "@campusnav/core";
import type { CampusBundle, CourseMaterial, CheckpointResolution, EntityTable, ProblemReportInput, ProblemStatus, Role, UniversitySummary } from "@campusnav/core";

/** What the current person may see, plus their verification state. */
export interface StudentStatus {
  access: Access;
  email?: string | null;
  /** A request waiting for a department admin. */
  pending?: { departmentId: string; year: number } | null;
  rejected?: boolean;
}

export type VerifyStart =
  | { status: "code_sent" }
  | { status: "demo"; code: string }
  | { status: "domain_not_allowed"; domains: string[] }
  | { status: "error"; message: string };

export type VerifyConfirm =
  | { status: "verified"; departmentId: string; year: number }
  | { status: "pending"; departmentId: string; year: number }
  | { status: "not_on_roster" }
  | { status: "invalid_code" }
  | { status: "error"; message: string };

/**
 * Student verification: prove a university email (one-time code or link),
 * then get major and year from the roster, or request them for approval.
 * Visitors never need any of this.
 */
export interface StudentAuth {
  status(universityId: string): Promise<StudentStatus>;
  start(universityId: string, email: string): Promise<VerifyStart>;
  confirm(universityId: string, email: string, code: string): Promise<VerifyConfirm>;
  /** Finish a sign-in started from an emailed link (Supabase redirects back with tokens). */
  completeFromUrl?(universityId: string, url: string): Promise<VerifyConfirm | null>;
  request(universityId: string, departmentId: string, year: number, studentNumber?: string | null): Promise<VerifyConfirm>;
  signOut(): Promise<void>;
}

/** A file or link to add to a course page. */
export interface MaterialInput {
  courseId: string;
  /** Null = every class of the course (lecturers and staff only). */
  groupId: string | null;
  section?: string | null;
  title: string;
  /** Either a file (PDF, PPTX, DOCX, PNG, JPEG; max 20 MB) or an http(s) link. */
  file?: Blob | null;
  fileName?: string | null;
  url?: string | null;
}

export const MATERIAL_MAX_BYTES = 20 * 1024 * 1024;
export const MATERIAL_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Checks a material before sending it. Returns an error key or null. */
export function materialProblem(input: MaterialInput): "title" | "file_or_link" | "file_type" | "file_size" | "link" | null {
  if (!input.title.trim() || input.title.length > 200) return "title";
  if (input.file) {
    const ext = (input.fileName ?? "").toLowerCase().split(".").pop() ?? "";
    if (!MATERIAL_TYPES[ext]) return "file_type";
    if (input.file.size > MATERIAL_MAX_BYTES) return "file_size";
    return null;
  }
  if (input.url) return /^https?:\/\/\S+$/i.test(input.url.trim()) ? null : "link";
  return "file_or_link";
}

/**
 * Class tools: lecture materials and class announcements. The database decides
 * who may do what (reps of a class, linked lecturers, staff); these calls fail
 * with a permission error otherwise.
 */
export interface ClassTools {
  addMaterial(universityId: string, input: MaterialInput): Promise<CourseMaterial>;
  removeMaterial(material: CourseMaterial): Promise<void>;
  /** A URL to open the material (short-lived for private files). */
  openMaterial(material: CourseMaterial): Promise<string>;
  postToClass(universityId: string, groupId: string, title: string, body: string): Promise<void>;
  removeAnnouncement(id: string): Promise<void>;
}

/** Read-side data access used by the student web app and mobile app. */
export interface CampusDataSource {
  readonly kind: "demo" | "supabase";
  readonly student?: StudentAuth;
  readonly classes?: ClassTools;
  listUniversities(): Promise<UniversitySummary[]>;
  getBundle(universityId: string): Promise<CampusBundle>;
  /** Validates an opaque checkpoint token against the backend. */
  resolveCheckpoint(token: string, activeUniversityId?: string): Promise<CheckpointResolution>;
  /**
   * Send a problem report to the university's staff. "demo" means nothing was
   * sent (demo mode has no backend); the UI must say so honestly.
   */
  submitReport(input: ProblemReportInput): Promise<{ status: "sent"; id: string } | { status: "demo" }>;
}

export interface AuditEntry {
  id: string;
  universityId: string | null;
  actorId: string | null;
  actorEmail?: string | null;
  action: "insert" | "update" | "delete";
  tableName: string;
  recordId: string | null;
  changedAt: string;
  diff: Record<string, unknown> | null;
}

export interface MembershipRow {
  id: string;
  userId: string;
  email?: string | null;
  universityId: string;
  role: Role;
  departmentId?: string | null;
  createdAt?: string;
}

export interface AdminSession {
  userId: string;
  email: string | null;
  isPlatformOwner: boolean;
  memberships: { universityId: string; role: Role; departmentId?: string | null }[];
}

/** Write-side access for the admin dashboard. Every call is authorised server-side (RLS). */
export interface AdminDataSource {
  readonly kind: "demo" | "supabase";
  session(): Promise<AdminSession | null>;
  signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>;
  signOut(): Promise<void>;
  listUniversities(): Promise<UniversitySummary[]>;
  list<T = Record<string, unknown>>(table: EntityTable, universityId: string): Promise<T[]>;
  upsert<T extends { id: string }>(table: EntityTable, row: T): Promise<T>;
  upsertMany<T extends { id: string }>(table: EntityTable, rows: T[]): Promise<number>;
  /** Soft delete where supported. */
  remove(table: EntityTable, id: string): Promise<void>;
  auditLog(universityId: string, limit?: number): Promise<AuditEntry[]>;
  listMembers(universityId: string): Promise<MembershipRow[]>;
  setMemberRole(universityId: string, email: string, role: Role, departmentId?: string | null): Promise<MembershipRow>;
  removeMember(membershipId: string): Promise<void>;
  uploadFloorPlan(universityId: string, floorId: string, file: File | Blob, contentType: string): Promise<string>;
  /** Upload a campus background picture (PNG/JPEG/WebP, already resized client-side). Returns its URL. */
  /** Building/faculty or university logo; the caller re-encodes it to a small PNG/WebP first. */
  uploadBrandImage(universityId: string, name: string, file: Blob, contentType: "image/png" | "image/webp"): Promise<string>;
  uploadCampusImage(universityId: string, campusId: string, file: Blob, contentType: "image/jpeg" | "image/png" | "image/webp"): Promise<string>;
  /** Triage a user problem report (only status and the staff note can change). */
  updateReport(id: string, status: ProblemStatus, adminNote: string | null): Promise<void>;
  /** Student verification: requests to review and the registration office's roster. */
  listEnrollments(universityId: string): Promise<EnrollmentRow[]>;
  reviewEnrollment(id: string, status: "verified" | "rejected" | "revoked"): Promise<void>;
  listRoster(universityId: string): Promise<RosterRow[]>;
  /** Insert or update by email. Returns the number of rows written. */
  importRoster(universityId: string, rows: RosterInput[]): Promise<number>;
  removeRoster(id: string): Promise<void>;
  // Class reps and lecture materials
  readonly classes: ClassTools;
  listReps(universityId: string): Promise<GroupRepRow[]>;
  appointRep(groupId: string, userId: string): Promise<void>;
  removeRep(id: string): Promise<void>;
  listMaterials(universityId: string): Promise<CourseMaterial[]>;
}

export interface EnrollmentRow {
  id: string;
  userId: string;
  universityId: string;
  email: string;
  departmentId: string;
  year: number;
  studentNumber?: string | null;
  status: "pending" | "verified" | "rejected" | "revoked";
  method: "roster" | "review";
  createdAt?: string;
  reviewedAt?: string | null;
}

export interface RosterInput {
  email: string;
  departmentId: string;
  year: number;
  studentNumber?: string | null;
}

export interface RosterRow extends RosterInput {
  id: string;
  universityId: string;
}

export interface GroupRepRow {
  id: string;
  groupId: string;
  userId: string;
  email: string | null;
  createdAt: string;
}
