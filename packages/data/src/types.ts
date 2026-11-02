import type { CampusBundle, CheckpointResolution, EntityTable, Role, UniversitySummary } from "@campusnav/core";

/** Read-side data access used by the student web app and mobile app. */
export interface CampusDataSource {
  readonly kind: "demo" | "supabase";
  listUniversities(): Promise<UniversitySummary[]>;
  getBundle(universityId: string): Promise<CampusBundle>;
  /** Validates an opaque checkpoint token against the backend. */
  resolveCheckpoint(token: string, activeUniversityId?: string): Promise<CheckpointResolution>;
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
}
