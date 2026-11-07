import type { CampusBundle, CheckpointResolution, EntityTable, ProblemReportInput, ProblemStatus, Role, UniversitySummary } from "@campusnav/core";

/** Read-side data access used by the student web app and mobile app. */
export interface CampusDataSource {
  readonly kind: "demo" | "supabase";
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
}
