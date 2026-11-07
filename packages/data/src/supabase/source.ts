import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateCheckpoint,
  parseCheckpointPayload,
  problemReportInputSchema,
  type CampusBundle,
  type CourseMaterial,
  type ProblemReportInput,
  type ProblemStatus,
  type CheckpointResolution,
  type EntityTable,
  type Role,
  type University,
  type UniversitySummary,
} from "@campusnav/core";
import { emailInDomains, VISITOR, type Access } from "@campusnav/core";
import { MATERIAL_TYPES, materialProblem, type ClassTools, type GroupRepRow, type MaterialInput } from "../types";
import type { AdminDataSource, AdminSession, AuditEntry, CampusDataSource, EnrollmentRow, MembershipRow, RosterInput, RosterRow, StudentAuth, StudentStatus, VerifyConfirm, VerifyStart } from "../types";
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
  readonly student: StudentAuth;
  readonly classes: ClassTools;
  constructor(readonly client: SupabaseClient) {
    this.student = new SupabaseStudentAuth(client);
    this.classes = new SupabaseClassTools(client);
  }

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
      roomOccupancy: await this.occupancy(universityId),
      ...(await this.classData(universityId, m(lecturers!) as { id: string; userId?: string | null }[])),
    };
  }

  /** Materials and class roles; only signed-in people get any (anon has no access to materials). */
  private async classData(universityId: string, lecturers: { id: string; userId?: string | null }[]): Promise<Pick<CampusBundle, "materials" | "classRoles">> {
    const { data } = await this.client.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return { materials: [], classRoles: null };
    const [mats, reps] = await Promise.all([
      this.client.from("course_materials").select("*").eq("university_id", universityId).is("deleted_at", null).order("created_at", { ascending: false }).limit(5000),
      this.client.from("group_reps").select("group_id").eq("university_id", universityId).eq("user_id", uid),
    ]);
    return {
      materials: ((mats.data ?? []) as Record<string, unknown>[]).map((r) => rowToDomain<CourseMaterial>(r)),
      classRoles: {
        userId: uid,
        repGroupIds: ((reps.data ?? []) as { group_id: string }[]).map((r) => r.group_id),
        lecturerId: lecturers.find((l) => l.userId === uid)?.id ?? null,
      },
    };
  }

  /** Anonymised room bookings for free rooms; only signed-in students/staff get any. */
  private async occupancy(universityId: string): Promise<CampusBundle["roomOccupancy"]> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) return null;
    const res = await this.client.rpc("room_occupancy", { p_university: universityId });
    if (res.error || !res.data) return null;
    const raw = res.data as { entries: Record<string, unknown>[]; changes: Record<string, unknown>[] };
    return {
      entries: raw.entries.map((r) => ({ ...rowToDomain<CampusBundle["timetable"][number]>(r), universityId, courseId: "" })),
      changes: raw.changes.map((r) => ({ ...rowToDomain<CampusBundle["scheduleChanges"][number]>(r), universityId })),
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

const STAFF_ROLES = new Set(["platform_owner", "university_owner", "university_admin", "department_admin", "lecturer"]);

type EnrollmentDbRow = { status: string; department_id: string; year: number };

function enrollmentResult(row: EnrollmentDbRow | undefined): VerifyConfirm {
  if (!row) return { status: "not_on_roster" };
  if (row.status === "verified") return { status: "verified", departmentId: row.department_id, year: row.year };
  if (row.status === "pending") return { status: "pending", departmentId: row.department_id, year: row.year };
  return { status: "error", message: row.status };
}

/**
 * Student verification on Supabase Auth: the email is proven with a one-time
 * code (or the emailed link), then the database decides major and year from
 * the roster (claim_student_enrollment) or records a request for approval.
 * Row-level security uses the result; the client never decides access.
 */
export class SupabaseStudentAuth implements StudentAuth {
  constructor(private readonly client: SupabaseClient) {}

  async status(universityId: string): Promise<StudentStatus> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    if (!user) return { access: VISITOR };
    const email = user.email ?? null;
    const [mem, enr] = await Promise.all([
      this.client.from("memberships").select("role").eq("user_id", user.id).eq("university_id", universityId),
      this.client.from("student_enrollments").select("status,department_id,year").eq("user_id", user.id).eq("university_id", universityId).maybeSingle(),
    ]);
    const prof = await this.client.from("user_profiles").select("is_platform_owner").eq("id", user.id).maybeSingle();
    if (prof.data?.is_platform_owner || (mem.data ?? []).some((m: { role: string }) => STAFF_ROLES.has(m.role))) return { access: { kind: "staff" }, email };
    const e = enr.data as EnrollmentDbRow | null;
    if (e?.status === "verified") {
      const access: Access = { kind: "student", departmentId: e.department_id, year: e.year };
      return { access, email };
    }
    if (e?.status === "pending") return { access: VISITOR, email, pending: { departmentId: e.department_id, year: e.year } };
    return { access: VISITOR, email, rejected: e?.status === "rejected" || e?.status === "revoked" };
  }

  async start(universityId: string, email: string): Promise<VerifyStart> {
    const u = await this.client.from("universities").select("settings").eq("id", universityId).maybeSingle();
    const domains: string[] = (u.data?.settings as { studentEmailDomains?: string[] } | undefined)?.studentEmailDomains ?? [];
    if (!emailInDomains(email, domains)) return { status: "domain_not_allowed", domains };
    const redirect = typeof window !== "undefined" ? `${window.location.origin}/verify` : undefined;
    const { error } = await this.client.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: redirect } });
    if (error) return { status: "error", message: error.message };
    return { status: "code_sent" };
  }

  private async claim(universityId: string): Promise<VerifyConfirm> {
    const res = await this.client.rpc("claim_student_enrollment", { p_university: universityId });
    if (res.error) return { status: "error", message: res.error.message };
    return enrollmentResult((res.data as EnrollmentDbRow[] | null)?.[0]);
  }

  async confirm(universityId: string, email: string, code: string): Promise<VerifyConfirm> {
    const { error } = await this.client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    if (error) return { status: "invalid_code" };
    return this.claim(universityId);
  }

  async completeFromUrl(universityId: string, url: string): Promise<VerifyConfirm | null> {
    const u = new URL(url);
    const hash = new URLSearchParams(u.hash.replace(/^#/, ""));
    const code = u.searchParams.get("code");
    if (hash.get("access_token") && hash.get("refresh_token")) {
      const { error } = await this.client.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
      if (error) return { status: "invalid_code" };
    } else if (code) {
      const { error } = await this.client.auth.exchangeCodeForSession(code);
      if (error) return { status: "invalid_code" };
    } else return null;
    return this.claim(universityId);
  }

  async request(universityId: string, departmentId: string, year: number, studentNumber?: string | null): Promise<VerifyConfirm> {
    const res = await this.client.rpc("request_student_enrollment", { p_university: universityId, p_department: departmentId, p_year: year, p_student_number: studentNumber ?? null });
    if (res.error) return { status: "error", message: res.error.message };
    return enrollmentResult((res.data as EnrollmentDbRow[] | null)?.[0]);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}

/** Lecture materials and class announcements. The database checks every call (RLS + storage policies). */
export class SupabaseClassTools implements ClassTools {
  constructor(private readonly client: SupabaseClient) {}

  async addMaterial(universityId: string, input: MaterialInput): Promise<CourseMaterial> {
    const problem = materialProblem(input);
    if (problem) throw new Error(`material_${problem}`);
    let storagePath: string | null = null;
    let mime: string | null = null;
    if (input.file) {
      const ext = (input.fileName ?? "").toLowerCase().split(".").pop()!;
      mime = MATERIAL_TYPES[ext]!;
      storagePath = `${universityId}/${input.courseId}/${crypto.randomUUID()}.${ext}`;
      check(await this.client.storage.from("course-materials").upload(storagePath, input.file, { contentType: mime, upsert: false }));
    }
    const res = await this.client
      .from("course_materials")
      .insert({
        university_id: universityId,
        course_id: input.courseId,
        group_id: input.groupId,
        section: input.section?.trim() || null,
        title: input.title.trim(),
        kind: storagePath ? "file" : "link",
        storage_path: storagePath,
        url: storagePath ? null : input.url!.trim(),
        mime,
        size_bytes: input.file?.size ?? null,
      })
      .select()
      .single();
    if (res.error && storagePath) await this.client.storage.from("course-materials").remove([storagePath]); // don't leave orphans
    return rowToDomain<CourseMaterial>(check(res) as unknown as Record<string, unknown>);
  }

  async removeMaterial(material: CourseMaterial): Promise<void> {
    check(await this.client.from("course_materials").delete().eq("id", material.id));
    if (material.storagePath) await this.client.storage.from("course-materials").remove([material.storagePath]);
  }

  async openMaterial(material: CourseMaterial): Promise<string> {
    if (material.kind === "link") return material.url!;
    const res = await this.client.storage.from("course-materials").createSignedUrl(material.storagePath!, 300);
    if (res.error || !res.data) throw new Error(res.error?.message ?? "not_allowed");
    return res.data.signedUrl;
  }

  async postToClass(universityId: string, groupId: string, title: string, body: string): Promise<void> {
    if (!title.trim() || !body.trim()) throw new Error("announcement_empty");
    check(await this.client.from("announcements").insert({ university_id: universityId, group_id: groupId, title: { en: title.trim() }, body: { en: body.trim() }, priority: "normal" }));
  }

  async removeAnnouncement(id: string): Promise<void> {
    check(await this.client.from("announcements").delete().eq("id", id));
  }
}

export class SupabaseAdminSource implements AdminDataSource {
  readonly kind = "supabase" as const;
  readonly classes: ClassTools;
  constructor(readonly client: SupabaseClient) {
    this.classes = new SupabaseClassTools(client);
  }

  async listReps(universityId: string): Promise<GroupRepRow[]> {
    const rows = check(await this.client.from("group_reps").select("id,group_id,user_id,email,created_at").eq("university_id", universityId).order("created_at"));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<GroupRepRow>(r));
  }

  async appointRep(groupId: string, userId: string): Promise<void> {
    check(await this.client.rpc("appoint_group_rep", { p_group: groupId, p_user: userId }));
  }

  async removeRep(id: string): Promise<void> {
    check(await this.client.rpc("remove_group_rep", { p_rep: id }));
  }

  async listMaterials(universityId: string): Promise<CourseMaterial[]> {
    const rows = check(await this.client.from("course_materials").select("*").eq("university_id", universityId).is("deleted_at", null).order("created_at", { ascending: false }).limit(5000));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<CourseMaterial>(r));
  }

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

  async listEnrollments(universityId: string): Promise<EnrollmentRow[]> {
    const rows = check(await this.client.from("student_enrollments").select("*").eq("university_id", universityId).order("created_at", { ascending: false }).limit(5000));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<EnrollmentRow>(r));
  }

  async reviewEnrollment(id: string, status: "verified" | "rejected" | "revoked"): Promise<void> {
    check(await this.client.rpc("admin_review_enrollment", { p_enrollment: id, p_status: status }));
  }

  async listRoster(universityId: string): Promise<RosterRow[]> {
    const rows = check(await this.client.from("student_roster").select("*").eq("university_id", universityId).order("email").limit(50000));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<RosterRow>(r));
  }

  async importRoster(universityId: string, rows: RosterInput[]): Promise<number> {
    let n = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ university_id: universityId, email: r.email.trim().toLowerCase(), department_id: r.departmentId, year: r.year, student_number: r.studentNumber ?? null }));
      check(await this.client.from("student_roster").upsert(chunk, { onConflict: "university_id,email" }));
      n += chunk.length;
    }
    return n;
  }

  async removeRoster(id: string): Promise<void> {
    check(await this.client.from("student_roster").delete().eq("id", id));
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
    const rows = check(await this.client.rpc("admin_list_members", { p_university: universityId }));
    return (rows as Record<string, unknown>[]).map((r) => rowToDomain<MembershipRow>(r));
  }

  async setMemberRole(universityId: string, email: string, role: Role, departmentId?: string | null): Promise<MembershipRow> {
    const row = check(
      await this.client.rpc("admin_set_member_role", { p_university: universityId, p_email: email, p_role: role, p_department_id: departmentId ?? null }),
    );
    return rowToDomain<MembershipRow>((Array.isArray(row) ? row[0] : row) as Record<string, unknown>);
  }

  async removeMember(membershipId: string): Promise<void> {
    check(await this.client.from("memberships").delete().eq("id", membershipId));
  }

  async uploadBrandImage(universityId: string, name: string, file: Blob, contentType: "image/png" | "image/webp"): Promise<string> {
    const safe = name.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "logo";
    const path = `${universityId}/${safe}-${Date.now()}.${contentType === "image/png" ? "png" : "webp"}`;
    check(await this.client.storage.from("brand-images").upload(path, file, { contentType, upsert: false }));
    return this.client.storage.from("brand-images").getPublicUrl(path).data.publicUrl;
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
