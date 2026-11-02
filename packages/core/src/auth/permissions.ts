/**
 * Role/permission model. This is the *specification* used by UIs to hide
 * actions a user cannot perform. Enforcement lives in Postgres RLS
 * (supabase/migrations/*_rls.sql), which mirrors this matrix. Never rely on
 * these checks alone.
 */

export type Role =
  | "platform_owner"
  | "university_owner"
  | "university_admin"
  | "department_admin"
  | "lecturer"
  | "student"
  | "visitor";

export const ROLES: readonly Role[] = [
  "platform_owner",
  "university_owner",
  "university_admin",
  "department_admin",
  "lecturer",
  "student",
  "visitor",
];

/** Higher rank = more privilege. Used to prevent granting roles above your own. */
export const ROLE_RANK: Record<Role, number> = {
  platform_owner: 100,
  university_owner: 80,
  university_admin: 60,
  department_admin: 40,
  lecturer: 20,
  student: 10,
  visitor: 0,
};

export type Permission =
  | "university.create"
  | "university.update"
  | "university.settings"
  | "campus.manage"
  | "building.manage"
  | "floor.manage"
  | "room.manage"
  | "map.edit"
  | "department.manage"
  | "lecturer.manage"
  | "lecturer.self_update"
  | "course.manage"
  | "group.manage"
  | "timetable.manage"
  | "timetable.department_manage"
  | "checkpoint.manage"
  | "announcement.manage"
  | "member.invite"
  | "member.manage"
  | "audit.read"
  | "data.import"
  | "data.export"
  | "public.read"
  | "student.personal";

const ADMIN_SET: Permission[] = [
  "university.update",
  "campus.manage",
  "building.manage",
  "floor.manage",
  "room.manage",
  "map.edit",
  "department.manage",
  "lecturer.manage",
  "course.manage",
  "group.manage",
  "timetable.manage",
  "timetable.department_manage",
  "checkpoint.manage",
  "announcement.manage",
  "member.invite",
  "audit.read",
  "data.import",
  "data.export",
  "public.read",
  "student.personal",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_owner: ["university.create", "university.settings", "member.manage", ...ADMIN_SET],
  university_owner: ["university.settings", "member.manage", ...ADMIN_SET],
  university_admin: ADMIN_SET,
  department_admin: [
    "room.manage",
    "lecturer.manage",
    "course.manage",
    "group.manage",
    "timetable.department_manage",
    "announcement.manage",
    "data.export",
    "public.read",
    "student.personal",
  ],
  lecturer: ["lecturer.self_update", "public.read", "student.personal"],
  student: ["public.read", "student.personal"],
  visitor: ["public.read"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return permission === "public.read";
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Whether `actor` may assign `target` role to someone (never above own rank; only owners manage owners). */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (target === "platform_owner") return actor === "platform_owner";
  if (!can(actor, "member.invite")) return false;
  if (target === "university_owner") return actor === "platform_owner" || actor === "university_owner";
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

export interface Membership {
  universityId: string;
  role: Role;
  departmentId?: string | null;
}

/** Effective role in a university for a user with possibly many memberships. */
export function roleIn(memberships: Membership[], universityId: string, isPlatformOwner = false): Role | null {
  if (isPlatformOwner) return "platform_owner";
  let best: Role | null = null;
  for (const m of memberships) {
    if (m.universityId !== universityId) continue;
    if (!best || ROLE_RANK[m.role] > ROLE_RANK[best]) best = m.role;
  }
  return best;
}
