import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateCheckpoint,
  parseCheckpointPayload,
  problemReportInputSchema,
  type CampusBundle,
  type ProblemReportInput,
  type ProblemStatus,
  type CheckpointResolution,
  type EntityTable,
  type Role,
  type University,
  type UniversitySummary,
} from "@campusnav/core";
import type { AdminDataSource, AdminSession, AuditEntry, CampusDataSource, MembershipRow } from "../types";
import { domainToRow, rowToDomain } from "../mapping";

export interface SupabaseConfig {
  url: string;
  /** Public anon key ONLY. Never pass a service-role key to client code. */
  anonKey: string;
  storage?: { getItem(k: string): string | null | Promise<string | null>; setItem(k: string, v: string): void | Promise<void>; removeItem(k: string): void | Promise<void> };
  persistSession?: boolean;
}

export function createSupabase(cfg: SupabaseConfig): SupabaseClient {
  if (/service_role/.test(atobSafe(cfg.anonKey.split(".")[1] ?? ""))) {
    throw new Error("Refusing to use a service-role key in a client. Use the anon key.");
  }
  return createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: cfg.persistSession ?? true, autoRefreshToken: true, storage: cfg.storage as never, detectSessionInUrl: false },
  });
}

function atobSafe(s: string): string {
  try {
    return typeof atob === "function" ? atob(s.replace(/-/g, "+").replace(/_/g, "/")) : "";
  } catch {
    return "";
  }
}

const SOFT_DELETE_TABLES = new Set<EntityTable>([
  "campuses",
  "buildings",
  "floors",
  "rooms",
  "departments",
  "lecturers",
  "courses",
  "student_groups",
  "timetable_entries",
  "announcements",
  "qr_checkpoints",
]);

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const err = new Error(res.error.message) as Error & { code?: string };
    err.code = res.error.code;
    throw err;
  }
  return res.data as T;
}

export class SupabaseDataSource implements CampusDataSource {
  readonly kind = "supabase" as const;
  constructor(readonly client: SupabaseClient) {}

  async listUniversities(): Promise<UniversitySummary[]> {
    const rows = check(await this.client.from("universities").select("id,slug,name,short_name,data_status,branding").is("deleted_at", null).order("slug"));
    return rows.map((r) => rowToDomain<UniversitySummary>(r));
  }

  private async all(table: string, universityId: string, select = "*"): Promise<Record<string, unknown>[]> {
    let q = this.client.from(table).select(select).eq("university_id", universityId);
    if (SOFT_DELETE_TABLES.has(table as EntityTable)) q = q.is("deleted_at", null);
    return check(await q.limit(10000)) as unknown as Record<string, unknown>[];
  }

  async getBundle(universityId: string): Promise<CampusBundle> {
    const uni = check(await this.client.from("universities").select("*").eq("id", universityId).single());
    const tables = [
      "campuses",
      "buildings",
      "floors",
      "rooms",
      "map_elements",
      "navigation_nodes",
      "navigation_edges",
      "departments",
      "lecturers",
      "courses",
      "student_groups",
      "semesters",
      "timetable_entries",
      "schedule_changes",
      "announcements",
    ] as const;
    const nowIso = new Date().toISOString();
    const [checkpoints, closures, ...results] = await Promise.all([
      this.all("public_checkpoints", universityId, "id,node_id,label"),
      check(await this.client.from("closures").select("*").eq("university_id", universityId).or(`ends_at.is.null,ends_at.gt.${nowIso}`).limit(2000)) as unknown as Promise<Record<string, unknown>[]>,
      ...tables.map((t) => this.all(t, universityId)),
    ]);
    const m = <T>(rows: Record<string, unknown>[]) => rows.map((r) => rowToDomain<T>(r));
    const [campuses, buildings, floors, rooms, mapElements, navNodes, navEdges, departments, lecturers, courses, groups, semesters, timetable, scheduleChanges, announcements] =
      results as Record<string, unknown>[][];
    const now = Date.now();
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: "supabase",
      university: rowToDomain<University>(uni as unknown as Record<string, unknown>),
      campuses: m(campuses!),
      buildings: m(buildings!),
      floors: m(floors!),
      rooms: m(rooms!),
      mapElements: m(mapElements!),
      navNodes: m(navNodes!),
      navEdges: m(navEdges!),
      checkpoints: m(checkpoints!),
      departments: m(departments!),
      lecturers: m(lecturers!),
      courses: m(courses!),
      groups: m(groups!),
      semesters: m(semesters!),
      timetable: m(timetable!),
      scheduleChanges: m(scheduleChanges!),
      announcements: m<CampusBundle["announcements"][number]>(announcements!).filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now),
      closures: m(closures as Record<string, unknown>[]),
    };
  }

  async submitReport(input: ProblemReportInput): Promise<{ status: "sent"; id: string }> {
    const v = problemReportInputSchema.parse(input);
    const id = check(
      await this.client.rpc("submit_problem_report", {
        p_university: v.universityId,
        p_category: v.category,
        p_message: v.message,
        p_room: v.roomId ?? null,
        p_node: v.nodeId ?? null,
        p_from: v.routeFromNodeId ?? null,
        p_to: v.routeToNodeId ?? null,
      }),
    ) as unknown as string;
    return { status: "sent", id };
  }

  async resolveCheckpoint(raw: string, activeUniversityId?: string): Promise<CheckpointResolution> {
    const parsed = parseCheckpointPayload(raw);
    if (!parsed.ok) return { status: "unknown" };
    const res = await this.client.rpc("resolve_checkpoint", { p_token: parsed.token });
    if (res.error) {
      if (/rate/i.test(res.error.message)) return { status: "rate_limited" };
      return { status: "network_error" };
    }
    const row = (Array.isArray(res.data) ? res.data[0] : res.data) as Record<string, unknown> | undefined;
    if (!row) return { status: "unknown" };
    return evaluateCheckpoint(
      {
        id: row.id as string,
        universityId: row.university_id as string,
        nodeId: row.node_id as string,
        label: row.label as never,
        status: row.status as "active" | "disabled",
        expiresAt: (row.expires_at as string | null) ?? null,
      },
      new Date(),
      activeUniversityId,
    );
  }
}

export class SupabaseAdminSource implements AdminDataSource {
  readonly kind = "supabase" as const;
  constructor(readonly client: SupabaseClient) {}

  async session(): Promise<AdminSession | null> {
    const { data } = await this.client.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const [profile, memberships] = await Promise.all([
      this.client.from("user_profiles").select("is_platform_owner").eq("id", user.id).maybeSingle(),
      this.client.from("memberships").select("university_id,role,department_id").eq("user_id", user.id),
    ]);
    return {
      userId: user.id,
      email: user.email ?? null,
      isPlatformOwner: !!(profile.data as { is_platform_owner?: boolean } | null)?.is_platform_owner,
      memberships: ((memberships.data ?? []) as Record<string, unknown>[]).map((r) => ({
        universityId: r.university_id as string,
        role: r.role as Role,
        departmentId: (r.department_id as string | null) ?? null,
      })),
    };
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  async listUniversities(): Promise<UniversitySummary[]> {
    return new SupabaseDataSource(this.client).listUniversities();
  }

  async list<T>(table: EntityTable, universityId: string): Promise<T[]> {
    let q = this.client.from(table).select("*");
    q = table === "universities" ? q.eq("id", universityId) : q.eq("university_id", universityId);
    if (SOFT_DELETE_TABLES.has(table)) q = q.is("deleted_at", null);
    const rows = check(await q.limit(10000)) as Record<string, unknown>[];
    // problem_reports expose their submission time (created_at is otherwise treated as DB-only).
    if (table === "problem_reports") return rows.map((r) => ({ ...rowToDomain<Record<string, unknown>>(r), createdAt: r.created_at }) as T);
    return rows.map((r) => rowToDomain<T>(r));
  }

  async updateReport(id: string, status: ProblemStatus, adminNote: string | null): Promise<void> {
    check(await this.client.from("problem_reports").update({ status, admin_note: adminNote }).eq("id", id));
  }

  async upsert<T extends { id: string }>(table: EntityTable, row: T): Promise<T> {
    const data = check(await this.client.from(table).upsert(domainToRow(row as Record<string, unknown>)).select().single());
    return rowToDomain<T>(data as unknown as Record<string, unknown>);
  }

  async upsertMany<T extends { id: string }>(table: EntityTable, rows: T[]): Promise<number> {
    if (!rows.length) return 0;
    check(await this.client.from(table).upsert(rows.map((r) => domainToRow(r as Record<string, unknown>))));
    return rows.length;
  }

  async remove(table: EntityTable, id: string): Promise<void> {
    if (SOFT_DELETE_TABLES.has(table)) check(await this.client.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id));
    else check(await this.client.from(table).delete().eq("id", id));
  }

  async auditLog(universityId: string, limit = 200): Promise<AuditEntry[]> {
    const rows = check(await this.client.from("audit_logs").select("*").eq("university_id", universityId).order("changed_at", { ascending: false }).limit(limit));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<AuditEntry>(r));
  }

  async listMembers(universityId: string): Promise<MembershipRow[]> {
    const rows = check(await this.client.rpc("admin_list_members", { p_university_id: universityId }));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<MembershipRow>(r));
  }

  async setMemberRole(universityId: string, email: string, role: Role, departmentId?: string | null): Promise<MembershipRow> {
    const row = check(
      await this.client.rpc("admin_set_member_role", { p_university_id: universityId, p_email: email, p_role: role, p_department_id: departmentId ?? null }),
    );
    return rowToDomain<MembershipRow>((Array.isArray(row) ? row[0] : row) as Record<string, unknown>);
  }

  async removeMember(membershipId: string): Promise<void> {
    check(await this.client.from("memberships").delete().eq("id", membershipId));
  }

  async uploadCampusImage(universityId: string, campusId: string, file: Blob, contentType: "image/jpeg" | "image/png" | "image/webp"): Promise<string> {
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${universityId}/${campusId}-${Date.now()}.${ext}`;
    check(await this.client.storage.from("campus-images").upload(path, file, { contentType, upsert: false }));
    return this.client.storage.from("campus-images").getPublicUrl(path).data.publicUrl;
  }

  async uploadFloorPlan(universityId: string, floorId: string, file: File | Blob, contentType: string): Promise<string> {
    const path = `${universityId}/${floorId}-${Date.now()}.svg`;
    check(await this.client.storage.from("floor-plans").upload(path, file, { contentType, upsert: false }));
    return this.client.storage.from("floor-plans").getPublicUrl(path).data.publicUrl;
  }
}
