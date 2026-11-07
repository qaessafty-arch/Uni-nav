import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { ROLE_PERMISSIONS, ROLE_RANK, type Role } from "@campusnav/core";
import { DEMO_UNIVERSITY_ID } from "@campusnav/data";
import { did } from "@campusnav/data/demo";
import { ADMIN_URL, DB_NAME } from "./global-setup";

/**
 * Database policy enforcement tests. These run real SQL as the `anon` and
 * `authenticated` roles with JWT claims set, exactly like PostgREST does.
 */
const A = DEMO_UNIVERSITY_ID;
const B = "00000000-0000-4000-8000-0000000000b0";
const C = "00000000-0000-4000-8000-0000000000c0";
const B_CAMPUS = "00000000-0000-4000-8000-0000000000b1";
const B_BUILDING = "00000000-0000-4000-8000-0000000000b2";
const B_FLOOR = "00000000-0000-4000-8000-0000000000b3";
const B_NODE = "00000000-0000-4000-8000-0000000000b4";
const B_ROOM = "00000000-0000-4000-8000-0000000000b5";

const users = {
  platform: "10000000-0000-4000-8000-000000000001",
  ownerA: "10000000-0000-4000-8000-000000000002",
  adminA: "10000000-0000-4000-8000-000000000003",
  deptAdminA: "10000000-0000-4000-8000-000000000004",
  lecturerA: "10000000-0000-4000-8000-000000000005",
  studentA: "10000000-0000-4000-8000-000000000006",
  adminB: "10000000-0000-4000-8000-000000000007",
  newbie: "10000000-0000-4000-8000-000000000008",
  stuCs1: "10000000-0000-4000-8000-000000000009",
  stuCs2: "10000000-0000-4000-8000-00000000000a",
  outsider: "10000000-0000-4000-8000-00000000000b",
} as const;
type UserKey = keyof typeof users;

const ENG_FLOOR_1 = did("eng-floor-1");
const ENG = did("demo-building-eng");
const CS = did("demo-dept-cs");
const CE = did("demo-dept-ce");
const ROOM_204 = did("eng-room-204"); // CS department
const ROOM_G01 = did("eng-room-G01"); // CE department
const LECT_A = did("lect-a");
const LECT_B = did("lect-b");

let pool: pg.Pool;

/** Run `fn` inside a transaction as the given user (or anon), then roll back. */
async function as<T>(who: UserKey | null, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${who ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [who ? users[who] : ""]);
    // Each statement runs in a savepoint so an expected failure doesn't abort the rest of the test.
    let n = 0;
    return await fn(async (sql, params) => {
      const sp = `sp${n++}`;
      await client.query(`savepoint ${sp}`);
      try {
        const r = await client.query(sql, params);
        await client.query(`release savepoint ${sp}`);
        return r;
      } catch (err) {
        await client.query(`rollback to savepoint ${sp}`);
        throw err;
      }
    });
  } finally {
    await client.query("rollback");
    client.release();
  }
}

async function expectDenied(p: Promise<unknown>, pattern: RegExp = /row-level security|permission denied|permission required|forbidden|violates|not allowed|may only|42501/i) {
  await expect(p).rejects.toThrow(pattern);
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: ADMIN_URL.replace(/\/postgres$/, `/${DB_NAME}`), max: 4 });
  const su = (sql: string, params?: unknown[]) => pool.query(sql, params);
  for (const [k, id] of Object.entries(users)) await su("insert into auth.users (id, email) values ($1, $2)", [id, `${k}@test.invalid`]);
  await su("update public.user_profiles set is_platform_owner = true where id = $1", [users.platform]);
  // Second (unpublished) tenant B and a published tenant C with members-only timetables
  await su(`insert into public.universities (id, slug, name, short_name, published) values ($1, 'tenant-b', '{"en":"Tenant B"}', 'B', false)`, [B]);
  await su(`insert into public.universities (id, slug, name, short_name, published, settings) values ($1, 'tenant-c', '{"en":"Tenant C"}', 'C', true,
    '{"timezone":"Asia/Baghdad","timetableVisibility":"members"}')`, [C]);
  await su(`insert into public.campuses (id, university_id, name) values ($1, $2, '{"en":"B campus"}')`, [B_CAMPUS, B]);
  await su(`insert into public.buildings (id, university_id, campus_id, code, name) values ($1, $2, $3, 'BB', '{"en":"B building"}')`, [B_BUILDING, B, B_CAMPUS]);
  await su(`insert into public.floors (id, university_id, building_id, level, name, width, height, meters_per_unit) values ($1, $2, $3, 0, '{"en":"G"}', 100, 100, 0.1)`, [B_FLOOR, B, B_BUILDING]);
  await su(`insert into public.navigation_nodes (id, university_id, floor_id, x, y, kind) values ($1, $2, $3, 1, 1, 'corridor')`, [B_NODE, B, B_FLOOR]);
  await su(`insert into public.rooms (id, university_id, building_id, floor_id, code, name, type) values ($1, $2, $3, $4, 'SECRET-1', '{"en":"B private room"}', 'office')`, [B_ROOM, B, B_BUILDING, B_FLOOR]);
  await su(`insert into public.qr_checkpoints (university_id, token, node_id, label) values ($1, 'TenantBSecretToken0001', $2, '{"en":"B cp"}')`, [B, B_NODE]);

  const member = (u: string, univ: string, role: Role, dept: string | null = null) =>
    su("insert into public.memberships (user_id, university_id, role, department_id) values ($1, $2, $3, $4)", [u, univ, role, dept]);
  await member(users.ownerA, A, "university_owner");
  await member(users.adminA, A, "university_admin");
  await member(users.deptAdminA, A, "department_admin", CS);
  await member(users.lecturerA, A, "lecturer");
  await member(users.studentA, A, "student");
  await member(users.adminB, B, "university_admin");
  await su("update public.lecturers set user_id = $1 where id = $2", [users.lecturerA, LECT_A]);
  // Students prove their address with a one-time code; only confirmed emails count.
  await su("update auth.users set email = 'cs1@students.demo.example', email_confirmed_at = now() where id = $1", [users.stuCs1]);
  await su("update auth.users set email = 'cs2@students.demo.example', email_confirmed_at = now() where id = $1", [users.stuCs2]);
  await su("update auth.users set email = 'someone@gmail.test', email_confirmed_at = now() where id = $1", [users.outsider]);
  await su("update auth.users set email = 'newbie@students.demo.example' where id = $1", [users.newbie]); // never confirmed
  await su(`update public.universities set settings = settings || '{"studentEmailDomains":["students.demo.example"]}' where id = $1`, [A]);
  await su("insert into public.student_roster (university_id, email, department_id, year) values ($1, 'cs1@students.demo.example', $2, 1)", [A, CS]);
  await su("insert into public.student_roster (university_id, email, department_id, year) values ($1, 'ce3@students.demo.example', $2, 3)", [A, CE]);
});

afterAll(async () => {
  await pool?.end();
});

describe("public (anonymous) access", () => {
  it("reads published university data, but only the public places indoors", async () => {
    const rows = await as(null, (q) => q("select code, type from public.rooms where university_id = $1", [A]));
    expect(rows.rowCount).toBeGreaterThan(20);
    expect(rows.rows.every((r) => ["office", "library", "cafeteria", "toilet", "prayer_room", "service", "other"].includes(r.type))).toBe(true);
    expect(rows.rows.some((r) => r.code === "204")).toBe(false); // a classroom
  });
  it("cannot see unpublished tenants at all", async () => {
    await as(null, async (q) => {
      expect((await q("select 1 from public.universities where id = $1", [B])).rowCount).toBe(0);
      expect((await q("select 1 from public.rooms where university_id = $1", [B])).rowCount).toBe(0);
    });
  });
  it("cannot read QR tokens, audit logs, memberships or profiles", async () => {
    await as(null, async (q) => {
      expect((await q("select * from public.qr_checkpoints")).rowCount).toBe(0);
      await expectDenied(q("select * from public.audit_logs")); // no grant at all for anon
      expect((await q("select * from public.memberships")).rowCount).toBe(0);
      expect((await q("select * from public.user_profiles")).rowCount).toBe(0);
    });
  });
  it("sees non-sensitive checkpoint info through the public view (no token column)", async () => {
    const res = await as(null, (q) => q("select * from public.public_checkpoints where university_id = $1", [A]));
    expect(res.rowCount).toBe(6); // active, unexpired only (ENG main, ENG floor 1 stairs, ENG floor 2, SCI, LIB, CAF)
    expect(res.fields.map((f) => f.name)).not.toContain("token");
  });
  it("cannot call staff RPCs or trigger functions directly", async () => {
    await as(null, async (q) => {
      await expectDenied(q("select public.create_university('x', '{\"en\":\"x\"}', 'X', 'a@b.c')"));
      await expectDenied(q("select * from public.admin_list_members($1)", [A]));
      await expectDenied(q("select public.audit_trigger()"));
    });
  });
  it("cannot write anything", async () => {
    await as(null, async (q) => {
      await expectDenied(q(`insert into public.buildings (university_id, campus_id, code, name) values ($1, $2, 'X', '{"en":"x"}')`, [A, did("demo-campus-main")]));
      await expectDenied(q("update public.rooms set code = 'hacked' where university_id = $1", [A]));
    });
  });
  it("never sees timetables, schedule changes, or classroom outlines", async () => {
    await as(null, async (q) => {
      expect((await q("select 1 from public.timetable_entries where university_id = $1", [A])).rowCount).toBe(0);
      expect((await q("select 1 from public.schedule_changes where university_id = $1", [A])).rowCount).toBe(0);
      expect((await q("select 1 from public.map_elements where room_id = $1", [ROOM_204])).rowCount).toBe(0);
      expect((await q("select 1 from public.universities where id = $1", [C])).rowCount).toBe(1);
    });
  });
});

describe("QR checkpoint resolution", () => {
  it("resolves a valid token without exposing tokens", async () => {
    const res = await as(null, (q) => q("select * from public.resolve_checkpoint($1)", ["DEMOengMainEntrance01"]));
    expect(res.rows[0]).toMatchObject({ university_id: A, status: "active" });
    expect(Object.keys(res.rows[0])).not.toContain("token");
  });
  it("returns disabled/expired status so clients can explain", async () => {
    const res = await as(null, (q) => q("select status, expires_at from public.resolve_checkpoint($1)", ["DEMOexpiredCheckpoint1"]));
    expect(res.rows[0].expires_at).not.toBeNull();
  });
  it("ignores malformed and malicious input", async () => {
    for (const bad of ["' or 1=1 --", "DEMOengMainEntrance01'; drop table rooms;--", "", "x".repeat(500)]) {
      const res = await as(null, (q) => q("select * from public.resolve_checkpoint($1)", [bad]));
      expect(res.rowCount).toBe(0);
    }
  });
  it("does not resolve checkpoints of unpublished tenants for outsiders", async () => {
    expect((await as(null, (q) => q("select * from public.resolve_checkpoint($1)", ["TenantBSecretToken0001"]))).rowCount).toBe(0);
    expect((await as("studentA", (q) => q("select * from public.resolve_checkpoint($1)", ["TenantBSecretToken0001"]))).rowCount).toBe(0);
    expect((await as("adminB", (q) => q("select * from public.resolve_checkpoint($1)", ["TenantBSecretToken0001"]))).rowCount).toBe(1);
  });
});

describe("cross-tenant isolation", () => {
  it("tenant B admin cannot read tenant B secrets from A's side and vice versa", async () => {
    await as("adminA", async (q) => {
      expect((await q("select 1 from public.rooms where university_id = $1", [B])).rowCount).toBe(0);
      expect((await q("select 1 from public.qr_checkpoints where university_id = $1", [B])).rowCount).toBe(0);
    });
    await as("adminB", async (q) => {
      expect((await q("select 1 from public.rooms where id = $1", [B_ROOM])).rowCount).toBe(1);
      expect((await q("select 1 from public.qr_checkpoints where university_id = $1", [A])).rowCount).toBe(0);
      expect((await q("select 1 from public.audit_logs where university_id = $1", [A])).rowCount).toBe(0);
      expect((await q("select 1 from public.memberships where university_id = $1", [A])).rowCount).toBe(0);
    });
  });
  it("tenant B admin cannot insert, update or delete tenant A rows", async () => {
    await as("adminB", async (q) => {
      await expectDenied(q(`insert into public.rooms (university_id, building_id, floor_id, code, name, type) values ($1, $2, $3, 'X1', '{"en":"x"}', 'office')`, [A, ENG, ENG_FLOOR_1]));
      expect((await q("update public.rooms set code = 'pwned' where id = $1", [ROOM_204])).rowCount).toBe(0);
      expect((await q("delete from public.rooms where id = $1", [ROOM_204])).rowCount).toBe(0);
      expect((await q("update public.universities set name = '{\"en\":\"pwned\"}' where id = $1", [A])).rowCount).toBe(0);
    });
  });
  it("cannot move a row into another tenant by changing university_id", async () => {
    await as("adminB", (q) => expectDenied(q("update public.rooms set university_id = $1 where id = $2", [A, B_ROOM])));
  });
  it("cannot reference another tenant's parent rows (composite foreign keys)", async () => {
    // Admin of A tries to create a room in A that points at B's floor.
    await as("adminA", (q) =>
      expectDenied(
        q(`insert into public.rooms (university_id, building_id, floor_id, code, name, type) values ($1, $2, $3, 'X2', '{"en":"x"}', 'office')`, [A, ENG, B_FLOOR]),
        /foreign key/i,
      ),
    );
    // Admin of B tries to attach a B checkpoint to an A node.
    await as("adminB", (q) =>
      expectDenied(
        q(`insert into public.qr_checkpoints (university_id, token, node_id, label) values ($1, 'CrossTenantToken00001', $2, '{"en":"x"}')`, [B, did(`${ENG_FLOOR_1}-stairs`)]),
        /foreign key/i,
      ),
    );
  });
  it("cannot list another tenant's members via RPC", async () => {
    await as("adminB", (q) => expectDenied(q("select * from public.admin_list_members($1)", [A])));
  });
});

describe("role-based authorization", () => {
  it("students and lecturers cannot manage campus data", async () => {
    for (const who of ["studentA", "lecturerA"] as const) {
      await as(who, async (q) => {
        await expectDenied(q(`insert into public.buildings (university_id, campus_id, code, name) values ($1, $2, 'X', '{"en":"x"}')`, [A, did("demo-campus-main")]));
        expect((await q("update public.rooms set code = 'x' where id = $1", [ROOM_204])).rowCount).toBe(0);
        expect((await q("select 1 from public.audit_logs")).rowCount).toBe(0);
        expect((await q("select 1 from public.qr_checkpoints")).rowCount).toBe(0);
      });
    }
  });
  it("university admin can create a building, floor and room", async () => {
    await as("adminA", async (q) => {
      const b = await q(`insert into public.buildings (university_id, campus_id, code, name) values ($1, $2, 'NEWB', '{"en":"New"}') returning id`, [A, did("demo-campus-main")]);
      const f = await q(`insert into public.floors (university_id, building_id, level, name, width, height, meters_per_unit) values ($1, $2, 0, '{"en":"G"}', 100, 100, 0.1) returning id`, [A, b.rows[0].id]);
      const r = await q(`insert into public.rooms (university_id, building_id, floor_id, code, name, type) values ($1, $2, $3, 'N1', '{"en":"N1"}', 'classroom') returning id`, [A, b.rows[0].id, f.rows[0].id]);
      expect(r.rowCount).toBe(1);
    });
  });
  it("university admin cannot change tenant settings or publication; owner can", async () => {
    await as("adminA", (q) => expectDenied(q(`update public.universities set published = false where id = $1`, [A])));
    await as("adminA", (q) => expectDenied(q(`update public.universities set settings = settings || '{"timezone":"UTC"}' where id = $1`, [A])));
    await as("ownerA", async (q) => {
      expect((await q(`update public.universities set settings = settings || '{"timetableVisibility":"members"}' where id = $1`, [A])).rowCount).toBe(1);
    });
  });
  it("department admin is limited to their department", async () => {
    await as("deptAdminA", async (q) => {
      expect((await q("update public.rooms set capacity = 51 where id = $1", [ROOM_204])).rowCount).toBe(1);
      expect((await q("update public.rooms set capacity = 51 where id = $1", [ROOM_G01])).rowCount).toBe(0);
      await expectDenied(q("update public.rooms set department_id = $1 where id = $2", [CE, ROOM_204]));
      await expectDenied(q(`insert into public.buildings (university_id, campus_id, code, name) values ($1, $2, 'X', '{"en":"x"}')`, [A, did("demo-campus-main")]));
    });
  });
  it("lecturers can update only their own office hours and availability", async () => {
    await as("lecturerA", async (q) => {
      expect((await q(`update public.lecturers set office_hours = '[{"day":1,"start":"09:00","end":"10:00"}]' where id = $1`, [LECT_A])).rowCount).toBe(1);
      await expectDenied(q(`update public.lecturers set full_name = '{"en":"Impostor"}' where id = $1`, [LECT_A]));
      expect((await q(`update public.lecturers set office_hours = '[]' where id = $1`, [LECT_B])).rowCount).toBe(0);
    });
  });
});

describe("role escalation", () => {
  it("users cannot make themselves platform owner", async () => {
    await as("studentA", (q) => expectDenied(q("update public.user_profiles set is_platform_owner = true where id = $1", [users.studentA])));
  });
  it("memberships cannot be inserted directly", async () => {
    await as("adminA", (q) => expectDenied(q("insert into public.memberships (user_id, university_id, role) values ($1, $2, 'university_owner')", [users.adminA, A])));
  });
  it("admins cannot grant roles at or above their own rank", async () => {
    await as("adminA", async (q) => {
      await expectDenied(q("select * from public.admin_set_member_role($1, $2, 'university_owner')", [A, "newbie@test.invalid"]));
      await expectDenied(q("select * from public.admin_set_member_role($1, $2, 'university_admin')", [A, "newbie@test.invalid"]));
      await expectDenied(q("select * from public.admin_set_member_role($1, $2, 'platform_owner')", [A, "newbie@test.invalid"]), /forbidden|invalid input/i);
      const ok = await q("select * from public.admin_set_member_role($1, $2, 'department_admin', $3)", [A, "newbie@test.invalid", CS]);
      expect(ok.rows[0].role).toBe("department_admin");
    });
  });
  it("admins cannot demote owners or change their own role", async () => {
    await as("adminA", async (q) => {
      await expectDenied(q("select * from public.admin_set_member_role($1, $2, 'student')", [A, "ownerA@test.invalid"]));
      await expectDenied(q("select * from public.admin_set_member_role($1, $2, 'student')", [A, "adminA@test.invalid"]));
      expect((await q("delete from public.memberships where user_id = $1", [users.ownerA])).rowCount).toBe(0);
    });
  });
  it("students and other tenants' admins cannot assign roles", async () => {
    await as("studentA", (q) => expectDenied(q("select * from public.admin_set_member_role($1, $2, 'visitor')", [A, "newbie@test.invalid"])));
    await as("adminB", (q) => expectDenied(q("select * from public.admin_set_member_role($1, $2, 'student')", [A, "newbie@test.invalid"])));
  });
  it("only platform owners can onboard universities", async () => {
    await as("ownerA", (q) => expectDenied(q(`select public.create_university('x-univ', '{"en":"X"}', 'X', 'newbie@test.invalid')`)));
    await as("platform", async (q) => {
      const id = (await q(`select public.create_university('new-univ', '{"en":"New University"}', 'NEW', 'newbie@test.invalid') as id`)).rows[0].id;
      const m = await q("select role from public.memberships where university_id = $1", [id]);
      expect(m.rows[0].role).toBe("university_owner");
    });
  });
});

describe("data integrity and audit", () => {
  it("rejects malformed data via constraints", async () => {
    await as("adminA", async (q) => {
      await expectDenied(
        q(`insert into public.timetable_entries (university_id, course_id, day, start_time, end_time, valid_from, valid_to) values ($1, $2, 1, '25:00', '26:00', '2026-01-01', '2026-02-01')`, [A, did("course-DEMO-CS101")]),
        /check constraint/i,
      );
      await expectDenied(q(`insert into public.qr_checkpoints (university_id, token, node_id, label) values ($1, 'short', $2, '{"en":"x"}')`, [A, did(`${ENG_FLOOR_1}-stairs`)]), /check constraint/i);
      await expectDenied(q(`insert into public.buildings (university_id, campus_id, code, name) values ($1, $2, 'Z', '{"ar":"no english"}')`, [A, did("demo-campus-main")]), /check constraint/i);
    });
  });
  it("campus pictures must be http(s) URLs and only campus managers can set them", async () => {
    const campus = did("demo-campus-main");
    await as("adminA", async (q) => {
      expect((await q("update public.campuses set overview_image_url = $1 where id = $2", ["https://example.supabase.co/storage/v1/object/public/campus-images/a.jpg", campus])).rowCount).toBe(1);
      await expectDenied(q("update public.campuses set overview_image_url = 'javascript:alert(1)' where id = $1", [campus]), /check constraint/i);
      await expectDenied(q("update public.campuses set overview_image_url = 'data:image/png;base64,AAAA' where id = $1", [campus]), /check constraint/i);
    });
    await as("studentA", async (q) => {
      expect((await q("update public.campuses set overview_image_url = 'https://evil.example/x.jpg' where id = $1", [campus])).rowCount).toBe(0);
    });
  });
  it("building identity: logos must be http(s) URLs, colours hex, icons simple keys", async () => {
    const bld = did("demo-building-lib");
    await as("adminA", async (q) => {
      expect((await q("update public.buildings set icon = 'library', color = '#6D28D9', logo_url = 'https://example.supabase.co/storage/v1/object/public/brand-images/x.png' where id = $1", [bld])).rowCount).toBe(1);
      await expectDenied(q("update public.buildings set logo_url = 'javascript:alert(1)' where id = $1", [bld]), /check constraint/i);
      await expectDenied(q("update public.buildings set color = 'red' where id = $1", [bld]), /check constraint/i);
      await expectDenied(q("update public.buildings set icon = '<svg>' where id = $1", [bld]), /check constraint/i);
      await expectDenied(q("update public.buildings set hours = '[1,2]'::jsonb where id = $1", [bld]), /check constraint/i);
    });
    await as("studentA", async (q) => {
      expect((await q("update public.buildings set color = '#000000' where id = $1", [bld])).rowCount).toBe(0);
    });
  });
  it("walkway paths: map editors can draw them on outdoor edges only; students cannot", async () => {
    const outdoor = (await pool.query("select id from public.navigation_edges where kind = 'outdoor' and university_id = $1 limit 1", [A])).rows[0].id;
    const corridor = (await pool.query("select id from public.navigation_edges where kind = 'corridor' and university_id = $1 limit 1", [A])).rows[0].id;
    const path = JSON.stringify([[44.02, 36.14], [44.021, 36.141], [44.022, 36.141]]);
    await as("adminA", async (q) => {
      expect((await q("update public.navigation_edges set geometry = $1::jsonb where id = $2", [path, outdoor])).rowCount).toBe(1);
      await expectDenied(q("update public.navigation_edges set geometry = $1::jsonb where id = $2", [path, corridor]), /check constraint/i);
      await expectDenied(q("update public.navigation_edges set geometry = '[[44.02, 36.14]]'::jsonb where id = $1", [outdoor]), /check constraint/i);
    });
    await as("studentA", async (q) => {
      expect((await q("update public.navigation_edges set geometry = $1::jsonb where id = $2", [path, outdoor])).rowCount).toBe(0);
    });
  });
  it("records who changed what, readable only by the tenant's admins, with tokens redacted", async () => {
    await as("adminA", async (q) => {
      await q("update public.rooms set capacity = 77 where id = $1", [ROOM_204]);
      await q(`insert into public.qr_checkpoints (university_id, token, node_id, label) values ($1, 'AuditTokenShouldHide01', $2, '{"en":"x"}')`, [A, did(`${ENG_FLOOR_1}-stairs`)]);
      const log = await q("select actor_id, action, diff from public.audit_logs where university_id = $1 order by id desc limit 2", [A]);
      expect(log.rows[1]).toMatchObject({ actor_id: users.adminA, action: "update" });
      expect(log.rows[1].diff.capacity.to).toBe(77);
      expect(JSON.stringify(log.rows[0].diff)).not.toContain("AuditTokenShouldHide01");
      await expectDenied(q("insert into public.audit_logs (action, table_name) values ('insert', 'x')"));
      await expectDenied(q("delete from public.audit_logs"));
    });
  });
  it("soft-deleted rows disappear from public reads", async () => {
    await as("adminA", async (q) => {
      await q("update public.rooms set deleted_at = now() where id = $1", [ROOM_204]);
      await q("set local role anon");
      await q("select set_config('request.jwt.claim.sub', '', true)");
      expect((await q("select 1 from public.rooms where id = $1", [ROOM_204])).rowCount).toBe(0);
    });
  });
  it("personal data is visible only to its owner", async () => {
    await as("studentA", (q) => q("insert into public.saved_locations (user_id, university_id, room_id) values ($1, $2, $3)", [users.studentA, A, ROOM_204]));
    await as("studentA", async (q) => {
      await q("insert into public.saved_locations (user_id, university_id, room_id) values ($1, $2, $3)", [users.studentA, A, ROOM_204]);
      await expectDenied(q("insert into public.saved_locations (user_id, university_id, room_id) values ($1, $2, $3)", [users.adminA, A, ROOM_204]));
      await q("set local request.jwt.claim.sub = '" + users.adminA + "'");
      expect((await q("select 1 from public.saved_locations")).rowCount).toBe(0);
    });
  });
});

describe("permission matrix parity", () => {
  it("database roles and permissions match packages/core", async () => {
    const res = await pool.query("select role::text, permission from public.role_permissions");
    const db: Record<string, Set<string>> = {};
    for (const r of res.rows) (db[r.role] ??= new Set()).add(r.permission);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) expect([...(db[role] ?? [])].sort(), role).toEqual([...perms].sort());
    const ranks = await pool.query("select role::text, rank from public.roles");
    for (const r of ranks.rows) expect(r.rank).toBe(ROLE_RANK[r.role as Role]);
  });
});

describe("closures and problem reports", () => {
  const EDGE = did(`edge:${did(`${ENG_FLOOR_1}-stairs`)}:${did(`${did("eng-floor-2")}-stairs`)}`);
  const reason = '{"en":"Closed for repairs"}';

  it("only map editors can create closures; everyone who can read the university sees them", async () => {
    await as("adminA", async (q) => {
      await q("insert into public.closures (university_id, target_type, target_id, reason) values ($1, 'edge', $2, $3)", [A, EDGE, reason]);
      await q("set local role anon");
      await q("select set_config('request.jwt.claim.sub', '', true)");
      expect((await q("select 1 from public.closures where university_id = $1", [A])).rowCount).toBe(1);
    });
    await as("studentA", (q) => expectDenied(q("insert into public.closures (university_id, target_type, target_id, reason) values ($1, 'edge', $2, $3)", [A, EDGE, reason])));
    await as("deptAdminA", (q) => expectDenied(q("insert into public.closures (university_id, target_type, target_id, reason) values ($1, 'edge', $2, $3)", [A, EDGE, reason])));
    await as(null, (q) => expectDenied(q("insert into public.closures (university_id, target_type, target_id, reason) values ($1, 'edge', $2, $3)", [A, EDGE, reason])));
  });

  it("closure targets must exist in the same university and end after they start", async () => {
    await as("adminA", async (q) => {
      await expect(q("insert into public.closures (university_id, target_type, target_id, reason) values ($1, 'room', $2, $3)", [A, B_ROOM, reason])).rejects.toThrow(/not found/);
      await expect(q("insert into public.closures (university_id, target_type, target_id, reason, starts_at, ends_at) values ($1, 'room', $2, $3, now(), now() - interval '1 day')", [A, ROOM_204, reason])).rejects.toThrow(/check/);
    });
    await as("adminB", (q) => expectDenied(q("insert into public.closures (university_id, target_type, target_id, reason) values ($1, 'edge', $2, $3)", [A, EDGE, reason])));
  });

  it("anyone can submit a report through the RPC, but cannot read reports or insert directly", async () => {
    await as(null, async (q) => {
      const r = await q("select public.submit_problem_report($1, 'blocked_path', 'Door near room 204 is locked', $2) as id", [A, ROOM_204]);
      expect(r.rows[0].id).toBeTruthy();
      await expectDenied(q("select 1 from public.problem_reports"));
      await expectDenied(q("insert into public.problem_reports (university_id, category, message) values ($1, 'other', 'direct insert')", [A]));
      await expect(q("select public.submit_problem_report($1, 'other', 'x')", [A])).rejects.toThrow(/check/);
      await expect(q("select public.submit_problem_report($1, 'spam', 'valid length text')", [A])).rejects.toThrow(/check/);
      await expect(q("select public.submit_problem_report($1, 'other', $2)", [A, "a".repeat(1001)])).rejects.toThrow(/check/);
      // Unpublished university B is not readable by anonymous users
      await expectDenied(q("select public.submit_problem_report($1, 'other', 'hello there')", [B]), /not found|42501/);
      // A room from another university cannot be attached
      await expect(q("select public.submit_problem_report($1, 'other', 'hello there', $2)", [A, B_ROOM])).rejects.toThrow(/foreign key/);
    });
  });

  it("staff with report.manage triage reports (status/note only); others cannot see them", async () => {
    await pool.query("select public.submit_problem_report($1, 'wrong_info', 'Room name is outdated')", [A]);
    await as("adminA", async (q) => {
      const r = await q("select id from public.problem_reports where university_id = $1 and message = 'Room name is outdated'", [A]);
      expect(r.rowCount).toBe(1);
      const id = r.rows[0].id;
      await q("update public.problem_reports set status = 'resolved', admin_note = 'Fixed' where id = $1", [id]);
      await expectDenied(q("update public.problem_reports set message = 'tampered' where id = $1", [id]), /only status/);
    });
    await as("studentA", async (q) => expect((await q("select 1 from public.problem_reports")).rowCount).toBe(0));
    await as("lecturerA", async (q) => expect((await q("select 1 from public.problem_reports")).rowCount).toBe(0));
    await as("adminB", async (q) => expect((await q("select 1 from public.problem_reports where university_id = $1", [A])).rowCount).toBe(0));
    await pool.query("delete from public.problem_reports where message = 'Room name is outdated'");
  });
});

describe("students: verified major and year", () => {
  const CS_Y1 = did("group-DEMO-CS-Y1-A");
  const CS_Y2 = did("group-DEMO-CS-Y2-A");
  const groupsSeen = async (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) =>
    new Set((await q("select group_id from public.timetable_entries where university_id = $1", [A])).rows.map((r) => r.group_id as string));

  it("a signed-in but unverified user sees what a visitor sees", async () => {
    await as("studentA", async (q) => {
      expect((await q("select 1 from public.timetable_entries where university_id = $1", [A])).rowCount).toBe(0);
      expect((await q("select 1 from public.rooms where id = $1", [ROOM_204])).rowCount).toBe(0);
    });
  });

  it("a student on the roster is verified automatically and sees only their own major and year", async () => {
    await as("stuCs1", async (q) => {
      const e = await q("select status, year, department_id, method from public.claim_student_enrollment($1)", [A]);
      expect(e.rows[0]).toMatchObject({ status: "verified", year: 1, department_id: CS, method: "roster" });
      expect([...(await groupsSeen(q))]).toEqual([CS_Y1]);
      expect((await q("select 1 from public.rooms where id = $1", [ROOM_204])).rowCount).toBe(1); // classrooms now visible
      expect((await q("select 1 from public.schedule_changes where university_id = $1", [A])).rowCount).toBe(2); // both are on CS stage 1
    });
  });

  it("an unconfirmed email or a non-university address cannot verify", async () => {
    await as("newbie", (q) => expectDenied(q("select * from public.claim_student_enrollment($1)", [A]), /confirmed email/));
    await as("outsider", (q) => expectDenied(q("select * from public.claim_student_enrollment($1)", [A]), /email_domain_not_allowed/));
    await as("outsider", (q) => expectDenied(q("select * from public.request_student_enrollment($1, $2, 1)", [A, CS]), /email_domain_not_allowed/));
  });

  it("a student not on the roster requests major and year; a department admin approves", async () => {
    await as("stuCs2", async (q) => {
      expect((await q("select * from public.claim_student_enrollment($1)", [A])).rowCount).toBe(0);
      await expect(q("select * from public.request_student_enrollment($1, $2, 5)", [A, CS])).rejects.toThrow(/invalid year/); // 4-year bachelor
      const r = await q("select id, status from public.request_student_enrollment($1, $2, 2, 'S-123')", [A, CS]);
      expect(r.rows[0].status).toBe("pending");
      expect((await groupsSeen(q)).size).toBe(0); // nothing until approved
      // Students cannot approve themselves, directly or via the RPC
      await expectDenied(q("update public.student_enrollments set status = 'verified' where id = $1", [r.rows[0].id]));
      await expectDenied(q("select * from public.admin_review_enrollment($1, 'verified')", [r.rows[0].id]));
      // The CS department admin approves
      await q("select set_config('request.jwt.claim.sub', $1, true)", [users.deptAdminA]);
      expect((await q("select status from public.admin_review_enrollment($1, 'verified')", [r.rows[0].id])).rows[0].status).toBe("verified");
      await q("select set_config('request.jwt.claim.sub', $1, true)", [users.stuCs2]);
      expect([...(await groupsSeen(q))]).toEqual([CS_Y2]);
    });
  });

  it("department admins only see and review their own department's students", async () => {
    await as("deptAdminA", async (q) => {
      const roster = await q("select email from public.student_roster where university_id = $1", [A]);
      expect(roster.rows.map((r) => r.email)).toEqual(["cs1@students.demo.example"]);
      await expectDenied(q("insert into public.student_roster (university_id, email, department_id, year) values ($1, 'x@students.demo.example', $2, 1)", [A, CE]));
    });
    await as("adminB", async (q) => expect((await q("select 1 from public.student_roster where university_id = $1", [A])).rowCount).toBe(0));
    await as(null, (q) => expectDenied(q("select * from public.student_roster")));
  });

  it("free rooms: verified students get anonymous room bookings, visitors get none", async () => {
    await as("stuCs1", async (q) => {
      await q("select * from public.claim_student_enrollment($1)", [A]);
      const occ = (await q("select public.room_occupancy($1) as o", [A])).rows[0].o;
      expect(occ.entries.length).toBeGreaterThan(14); // every booking, not just CS stage 1
      expect(Object.keys(occ.entries[0]).sort()).toEqual(["day", "end_time", "id", "recurrence", "room_id", "start_time", "status", "valid_from", "valid_to"]);
      expect(JSON.stringify(occ)).not.toMatch(/course|group|lecturer|note/);
    });
    await as("studentA", async (q) => expect((await q("select public.room_occupancy($1) as o", [A])).rows[0].o.entries).toEqual([]));
    await as(null, (q) => expectDenied(q("select public.room_occupancy($1)", [A])));
  });

  it("students cannot write enrollments directly, and staff still see every timetable", async () => {
    await as("stuCs1", (q) => expectDenied(q("insert into public.student_enrollments (user_id, university_id, email, department_id, year, status, method) values ($1, $2, 'x', $3, 4, 'verified', 'roster')", [users.stuCs1, A, CS])));
    await as("lecturerA", async (q) => expect((await groupsSeen(q)).size).toBeGreaterThan(4));
  });
});

describe("class reps, lecture materials and class announcements", () => {
  const CS_Y1 = did("group-DEMO-CS-Y1-A");
  const CS_Y2 = did("group-DEMO-CS-Y2-A");
  const CS101 = did("course-DEMO-CS101"); // CS stage 1, taught by lecturer A
  const CS201 = did("course-DEMO-CS201"); // CS stage 2 only
  const CE110 = did("course-DEMO-CE110"); // taught to CS stage 1 too, by lecturer C
  const rep = "10000000-0000-4000-8000-0000000000c1";
  const ce1 = "10000000-0000-4000-8000-0000000000c2";
  const path = (course: string) => `${A}/${course}/${"00000000-0000-4000-8000-00000000f00d"}.pdf`;
  const asUser = async <T,>(id: string, fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>) =>
    as("newbie", async (q) => {
      await q("select set_config('request.jwt.claim.sub', $1, true)", [id]);
      return fn(q);
    });
  const insertMaterial = (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>, course: string, group: string | null, title = "Week 1 slides") =>
    q("insert into public.course_materials (university_id, course_id, group_id, section, title, kind, url) values ($1, $2, $3, 'Week 1', $4, 'link', 'https://example.org/slides') returning uploaded_by", [A, course, group, title]);

  beforeAll(async () => {
    const su = (sql: string, params?: unknown[]) => pool.query(sql, params);
    await su("insert into auth.users (id, email, email_confirmed_at) values ($1, 'rep1@students.demo.example', now()), ($2, 'ce1@students.demo.example', now())", [rep, ce1]);
    await su("insert into public.student_enrollments (user_id, university_id, email, department_id, year, status, method) values ($1, $2, 'rep1@students.demo.example', $3, 1, 'verified', 'roster'), ($4, $2, 'ce1@students.demo.example', $5, 1, 'verified', 'roster')", [rep, A, CS, ce1, CE]);
  });

  it("only group managers appoint reps, and only verified students of that major and year", async () => {
    await asUser(rep, (q) => expectDenied(q("select * from public.appoint_group_rep($1, $2)", [CS_Y1, rep])));
    await as("deptAdminA", async (q) => {
      const r = await q("select group_id, user_id, email from public.appoint_group_rep($1, $2)", [CS_Y1, rep]);
      expect(r.rows[0]).toMatchObject({ group_id: CS_Y1, user_id: rep, email: "rep1@students.demo.example" });
      await expect(q("select * from public.appoint_group_rep($1, $2)", [CS_Y1, ce1])).rejects.toThrow(/not_verified_for_group/);
      await expect(q("select * from public.appoint_group_rep($1, $2)", [CS_Y2, rep])).rejects.toThrow(/not_verified_for_group/);
    });
    await asUser(rep, (q) => expectDenied(q("insert into public.group_reps (university_id, group_id, user_id) values ($1, $2, $3)", [A, CS_Y1, rep])));
  });

  describe("as an appointed rep", () => {
    beforeAll(async () => {
      await pool.query("insert into public.group_reps (university_id, group_id, user_id, email) values ($1, $2, $3, 'rep1@students.demo.example')", [A, CS_Y1, rep]);
    });

    it("uploads materials only for their own class's courses", async () => {
      await asUser(rep, async (q) => {
        const r = await insertMaterial(q, CS101, CS_Y1);
        expect(r.rows[0].uploaded_by).toBe(rep); // stamped, cannot be spoofed
        await insertMaterial(q, CE110, CS_Y1); // CS stage 1 takes CE110 too
        await expectDenied(insertMaterial(q, CS101, null)); // reps must name their class
        await expectDenied(insertMaterial(q, CS201, CS_Y1)); // not taken by their class
        await expectDenied(insertMaterial(q, CS201, CS_Y2)); // not their class
      });
    });

    it("cannot upload when the course turns rep uploads off", async () => {
      await asUser(rep, async (q) => {
        await q("select set_config('request.jwt.claim.sub', $1, true)", [users.adminA]);
        await q("update public.courses set reps_can_upload = false where id = $1", [CS101]);
        await q("select set_config('request.jwt.claim.sub', $1, true)", [rep]);
        await expectDenied(insertMaterial(q, CS101, CS_Y1));
      });
    });

    it("posts announcements to their own class only", async () => {
      await asUser(rep, async (q) => {
        const ins = (group: string | null) =>
          q(`insert into public.announcements (university_id, group_id, title, body) values ($1, $2, '{"en":"Quiz moved"}', '{"en":"To Thursday"}') returning author_id`, [A, group]);
        expect((await ins(CS_Y1)).rows[0].author_id).toBe(rep);
        await expectDenied(ins(CS_Y2));
        await expectDenied(ins(null)); // university-wide needs announcement.manage
      });
    });

    it("loses rep powers when their verification is revoked", async () => {
      await asUser(rep, async (q) => {
        await q("select set_config('request.jwt.claim.sub', $1, true)", [users.deptAdminA]);
        const e = await q("select id from public.student_enrollments where user_id = $1", [rep]);
        await q("select * from public.admin_review_enrollment($1, 'revoked')", [e.rows[0].id]);
        await q("select set_config('request.jwt.claim.sub', $1, true)", [rep]);
        await expectDenied(insertMaterial(q, CS101, CS_Y1));
      });
    });
  });

  it("linked lecturers upload for the courses they teach, not others", async () => {
    await as("lecturerA", async (q) => {
      await insertMaterial(q, CS101, null, "Syllabus");
      await expectDenied(insertMaterial(q, CE110, CS_Y1)); // taught by lecturer C
    });
  });

  describe("reading", () => {
    beforeAll(async () => {
      await pool.query("insert into public.course_materials (university_id, course_id, group_id, title, kind, storage_path, mime, size_bytes) values ($1, $2, $3, 'Lecture 1', 'file', $4, 'application/pdf', 1000)", [A, CS101, CS_Y1, path(CS101)]);
      await pool.query(`insert into public.announcements (university_id, group_id, title, body) values ($1, $2, '{"en":"CS1 class notice"}', '{"en":"Bring calculators"}')`, [A, CS_Y1]);
    });

    it("materials and class posts are visible to verified students of that major and year only", async () => {
      await asUser(rep, async (q) => {
        expect((await q("select title from public.course_materials where course_id = $1", [CS101])).rows.map((r) => r.title)).toContain("Lecture 1");
        expect((await q("select 1 from public.announcements where group_id = $1", [CS_Y1])).rowCount).toBe(1);
      });
      await asUser(ce1, async (q) => {
        expect((await q("select 1 from public.course_materials where course_id = $1", [CS101])).rowCount).toBe(0);
        expect((await q("select 1 from public.announcements where group_id = $1", [CS_Y1])).rowCount).toBe(0);
      });
      await as("studentA", async (q) => expect((await q("select 1 from public.course_materials")).rowCount).toBe(0)); // unverified
      await as(null, async (q) => {
        await expectDenied(q("select 1 from public.course_materials"));
        expect((await q("select 1 from public.announcements where group_id is not null")).rowCount).toBe(0);
        expect((await q("select 1 from public.announcements where university_id = $1", [A])).rowCount).toBeGreaterThan(0); // university-wide still public
      });
      await as("lecturerA", async (q) => expect((await q("select 1 from public.course_materials where course_id = $1", [CS101])).rowCount).toBe(1));
    });

    it("file paths must sit under the material's own university and course", async () => {
      await as("adminA", (q) =>
        expectDenied(q("insert into public.course_materials (university_id, course_id, title, kind, storage_path) values ($1, $2, 'x', 'file', $3)", [A, CS201, path(CS101)]), /violates|check/));
    });
  });
});
