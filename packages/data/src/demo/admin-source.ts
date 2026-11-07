import { canAssignRole, type CampusBundle, type EntityTable, type ProblemStatus, type Role, type UniversitySummary } from "@campusnav/core";
import type { AdminDataSource, AdminSession, AuditEntry, EnrollmentRow, MembershipRow, RosterInput, RosterRow } from "../types";
import { demoBundle, demoCheckpoints, did, DEMO_UNIVERSITY_ID } from "./dataset";

/**
 * LOCAL SANDBOX admin data source.
 *
 * Runs entirely in the browser over a copy of the demo dataset persisted in a
 * key-value store (localStorage). It performs NO network calls and has no real
 * authentication — it exists so the dashboard can be explored and tested
 * without Supabase credentials. Production uses SupabaseAdminSource, where
 * every operation is authorised by Postgres RLS.
 */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const SANDBOX_KEY = "campusnav.sandbox.v1";

interface SandboxState {
  tables: Partial<Record<EntityTable, Record<string, unknown>[]>>;
  audit: AuditEntry[];
  members: MembershipRow[];
  signedIn: boolean;
}

const TABLE_FROM_BUNDLE: [EntityTable, (b: CampusBundle) => unknown[]][] = [
  ["universities", (b) => [b.university]],
  ["campuses", (b) => b.campuses],
  ["buildings", (b) => b.buildings],
  ["floors", (b) => b.floors],
  ["rooms", (b) => b.rooms],
  ["map_elements", (b) => b.mapElements],
  ["navigation_nodes", (b) => b.navNodes],
  ["navigation_edges", (b) => b.navEdges],
  ["departments", (b) => b.departments],
  ["lecturers", (b) => b.lecturers],
  ["courses", (b) => b.courses],
  ["student_groups", (b) => b.groups],
  ["semesters", (b) => b.semesters],
  ["timetable_entries", (b) => b.timetable],
  ["schedule_changes", (b) => b.scheduleChanges],
  ["announcements", (b) => b.announcements],
  ["closures", (b) => b.closures ?? []],
];

/** Fictional example reports so the triage screen has something to show. */
function demoReports(): Record<string, unknown>[] {
  const now = Date.now();
  return [
    { id: "demo-report-1", universityId: DEMO_UNIVERSITY_ID, category: "blocked_path", message: "Demo report: the corridor door next to room 204 was locked at 9am.", roomId: did("eng-room-204"), nodeId: null, routeFromNodeId: null, routeToNodeId: null, status: "open", adminNote: null, createdAt: new Date(now - 3_600_000).toISOString() },
    { id: "demo-report-2", universityId: DEMO_UNIVERSITY_ID, category: "wrong_info", message: "Demo report: the lab sign says S101 but the app calls it Optics Lab.", roomId: did("sci-room-S101"), nodeId: null, routeFromNodeId: null, routeToNodeId: null, status: "in_progress", adminNote: "Checking with the department", createdAt: new Date(now - 86_400_000).toISOString() },
  ];
}

function initialState(): SandboxState {
  const b = demoBundle();
  const tables: SandboxState["tables"] = {};
  for (const [t, get] of TABLE_FROM_BUNDLE) tables[t] = structuredClone(get(b)) as Record<string, unknown>[];
  tables.qr_checkpoints = structuredClone(demoCheckpoints) as unknown as Record<string, unknown>[];
  tables.problem_reports = demoReports();
  return {
    tables,
    audit: [],
    members: [{ id: "sandbox-owner", userId: "sandbox-user", email: "sandbox@localhost", universityId: DEMO_UNIVERSITY_ID, role: "university_owner" }],
    signedIn: false,
  };
}

export class SandboxAdminSource implements AdminDataSource {
  readonly kind = "demo" as const;
  private state: SandboxState;

  constructor(private readonly kv: KV) {
    const raw = kv.getItem(SANDBOX_KEY);
    let parsed: SandboxState | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as SandboxState) : null;
    } catch {
      parsed = null;
    }
    this.state = parsed ?? initialState();
    // Sandboxes saved by older versions lack the newer tables: add them without touching edits.
    if (!this.state.tables.closures) this.state.tables.closures = structuredClone(demoBundle().closures ?? []) as unknown as Record<string, unknown>[];
    if (!this.state.tables.problem_reports) this.state.tables.problem_reports = demoReports();
  }

  private save() {
    this.kv.setItem(SANDBOX_KEY, JSON.stringify(this.state));
  }

  reset() {
    this.state = { ...initialState(), signedIn: this.state.signedIn };
    this.save();
  }

  private log(action: AuditEntry["action"], table: string, id: string, diff: Record<string, unknown> | null) {
    this.state.audit.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      universityId: DEMO_UNIVERSITY_ID,
      actorId: "sandbox-user",
      actorEmail: "sandbox@localhost",
      action,
      tableName: table,
      recordId: id,
      changedAt: new Date().toISOString(),
      diff,
    });
    this.state.audit = this.state.audit.slice(0, 500);
  }

  async session(): Promise<AdminSession | null> {
    if (!this.state.signedIn) return null;
    return {
      userId: "sandbox-user",
      email: "sandbox@localhost",
      isPlatformOwner: false,
      memberships: [{ universityId: DEMO_UNIVERSITY_ID, role: "university_owner" }],
    };
  }

  async signIn() {
    this.state.signedIn = true;
    this.save();
    return { ok: true as const };
  }

  async signOut() {
    this.state.signedIn = false;
    this.save();
  }

  async listUniversities(): Promise<UniversitySummary[]> {
    const u = this.state.tables.universities?.[0] as unknown as UniversitySummary;
    return u ? [{ id: u.id, slug: u.slug, name: u.name, shortName: u.shortName, dataStatus: u.dataStatus, branding: u.branding }] : [];
  }

  async list<T>(table: EntityTable, universityId: string): Promise<T[]> {
    const rows = this.state.tables[table] ?? [];
    return structuredClone(rows.filter((r) => (table === "universities" ? r.id : r.universityId) === universityId)) as T[];
  }

  async upsert<T extends { id: string }>(table: EntityTable, row: T): Promise<T> {
    const rows = (this.state.tables[table] ??= []);
    const i = rows.findIndex((r) => r.id === row.id);
    const before = i >= 0 ? rows[i] : null;
    if (i >= 0) rows[i] = structuredClone(row) as unknown as Record<string, unknown>;
    else rows.push(structuredClone(row) as unknown as Record<string, unknown>);
    this.log(before ? "update" : "insert", table, row.id, before ? { before, after: row } : { after: row });
    this.save();
    return row;
  }

  async upsertMany<T extends { id: string }>(table: EntityTable, rows: T[]): Promise<number> {
    for (const r of rows) {
      const list = (this.state.tables[table] ??= []);
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = structuredClone(r) as unknown as Record<string, unknown>;
      else list.push(structuredClone(r) as unknown as Record<string, unknown>);
    }
    this.log("insert", table, `${rows.length} rows`, { count: rows.length });
    this.save();
    return rows.length;
  }

  async remove(table: EntityTable, id: string): Promise<void> {
    const rows = this.state.tables[table] ?? [];
    const i = rows.findIndex((r) => r.id === id);
    if (i >= 0) {
      const [before] = rows.splice(i, 1);
      this.log("delete", table, id, { before });
      this.save();
    }
  }

  async updateReport(id: string, status: ProblemStatus, adminNote: string | null): Promise<void> {
    const rows = (this.state.tables.problem_reports ??= []);
    const r = rows.find((x) => x.id === id);
    if (!r) throw new Error("NOT_FOUND");
    const before = { status: r.status, adminNote: r.adminNote };
    r.status = status;
    r.adminNote = adminNote;
    this.log("update", "problem_reports", id, { before, after: { status, adminNote } });
    this.save();
  }

  async auditLog(): Promise<AuditEntry[]> {
    return structuredClone(this.state.audit);
  }

  async listMembers(): Promise<MembershipRow[]> {
    return structuredClone(this.state.members);
  }

  async setMemberRole(universityId: string, email: string, role: Role, departmentId?: string | null): Promise<MembershipRow> {
    if (!canAssignRole("university_owner", role)) throw new Error("FORBIDDEN_ROLE");
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("INVALID_EMAIL");
    const existing = this.state.members.find((m) => m.email === email && m.universityId === universityId);
    const row: MembershipRow = existing
      ? { ...existing, role, departmentId: departmentId ?? null }
      : { id: `m-${Date.now()}`, userId: `sandbox-${email}`, email, universityId, role, departmentId: departmentId ?? null };
    this.state.members = [...this.state.members.filter((m) => m.id !== row.id), row];
    this.log(existing ? "update" : "insert", "memberships", row.id, { role });
    this.save();
    return row;
  }

  // Sandbox: no accounts exist, so there are no enrollments to review; the roster is kept locally.
  async listEnrollments(): Promise<EnrollmentRow[]> {
    return [];
  }

  async reviewEnrollment(): Promise<void> {
    throw new Error("No student accounts in the local sandbox.");
  }

  private get roster(): RosterRow[] {
    return ((this.state as unknown as { roster?: RosterRow[] }).roster ??= []);
  }

  async listRoster(universityId: string): Promise<RosterRow[]> {
    return this.roster.filter((r) => r.universityId === universityId).sort((a, b) => a.email.localeCompare(b.email));
  }

  async importRoster(universityId: string, rows: RosterInput[]): Promise<number> {
    for (const r of rows) {
      const email = r.email.trim().toLowerCase();
      const hit = this.roster.find((x) => x.universityId === universityId && x.email === email);
      if (hit) Object.assign(hit, { departmentId: r.departmentId, year: r.year, studentNumber: r.studentNumber ?? null });
      else this.roster.push({ id: `roster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, universityId, email, departmentId: r.departmentId, year: r.year, studentNumber: r.studentNumber ?? null });
    }
    this.log("insert", "student_roster", "import", { rows: rows.length });
    this.save();
    return rows.length;
  }

  async removeRoster(id: string): Promise<void> {
    const list = this.roster;
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list.splice(i, 1);
    this.log("delete", "student_roster", id, null);
    this.save();
  }

  async removeMember(id: string): Promise<void> {
    this.state.members = this.state.members.filter((m) => m.id !== id);
    this.log("delete", "memberships", id, null);
    this.save();
  }

  async uploadBrandImage(_u: string, _n: string, file: Blob, contentType: "image/png" | "image/webp"): Promise<string> {
    // Sandbox: logos are tiny (≤ 256 px), kept as data URLs in local storage.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 250_000) throw new Error("IMAGE_TOO_LARGE_FOR_SANDBOX");
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${contentType};base64,${btoa(bin)}`;
  }

  async uploadCampusImage(_u: string, _c: string, file: Blob, contentType: "image/jpeg" | "image/png" | "image/webp"): Promise<string> {
    // Sandbox: keep the (already downscaled) image as a data URL in local storage.
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 1_500_000) throw new Error("IMAGE_TOO_LARGE_FOR_SANDBOX");
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${contentType};base64,${btoa(bin)}`;
  }

  async uploadFloorPlan(_u: string, _f: string, file: File | Blob): Promise<string> {
    // Sandbox: store as data URL (size-limited by caller).
    const text = await file.text();
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }

  /** Current sandbox content as a bundle (lets the student app preview sandbox edits). */
  toBundle(): CampusBundle {
    const t = this.state.tables;
    const get = <T>(k: EntityTable) => (t[k] ?? []) as unknown as T[];
    const base = demoBundle();
    return {
      ...base,
      university: (get<CampusBundle["university"]>("universities")[0] ?? base.university),
      campuses: get("campuses"),
      buildings: get("buildings"),
      floors: get("floors"),
      rooms: get("rooms"),
      mapElements: get("map_elements"),
      navNodes: get("navigation_nodes"),
      navEdges: get("navigation_edges"),
      checkpoints: get<CampusBundle["checkpoints"][number] & { status: string }>("qr_checkpoints")
        .filter((c) => c.status === "active")
        .map(({ id, nodeId, label }) => ({ id, nodeId, label })),
      departments: get("departments"),
      lecturers: get("lecturers"),
      courses: get("courses"),
      groups: get("student_groups"),
      semesters: get("semesters"),
      timetable: get("timetable_entries"),
      scheduleChanges: get("schedule_changes"),
      announcements: get("announcements"),
      closures: get("closures"),
    };
  }
}
