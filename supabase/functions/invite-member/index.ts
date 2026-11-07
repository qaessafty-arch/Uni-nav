// Supabase Edge Function: invite a staff member by email and assign a role.
//
// Why an edge function: creating auth users / sending invites requires the
// service-role key, which must never reach browsers. The function verifies the
// CALLER's JWT and re-checks authorization with the same database function used
// by RLS (can_assign_role) before using the service role.
//
// Deploy: supabase functions deploy invite-member
// Env (set via `supabase secrets set`): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, INVITE_REDIRECT_URL
// STATUS: written against the Supabase Edge runtime API but NOT executed in this
// repository's automated tests (no Supabase project available). Test before use.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const ROLES = new Set(["university_owner", "university_admin", "department_admin", "lecturer", "student", "visitor"]);
const cors = { "Access-Control-Allow-Origin": Deno.env.get("ADMIN_ORIGIN") ?? "", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  let body: { universityId?: string; email?: string; role?: string; departmentId?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const { universityId, email, role, departmentId = null } = body;
  if (!universityId || !/^[0-9a-f-]{36}$/.test(universityId)) return json({ error: "invalid_university" }, 400);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return json({ error: "invalid_email" }, 400);
  if (!role || !ROLES.has(role)) return json({ error: "invalid_role" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  // 1) Authorise as the caller (RLS applies).
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: allowed, error: authErr } = await asCaller.rpc("can_assign_role", { p_university: universityId, p_target: role });
  if (authErr || allowed !== true) return json({ error: "forbidden" }, 403);

  // 2) Create/invite the auth user with the service role.
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: Deno.env.get("INVITE_REDIRECT_URL") ?? undefined });
  if (inviteErr && !/already/i.test(inviteErr.message)) return json({ error: "invite_failed" }, 502);

  // 3) Assign the role AS THE CALLER so escalation rules and audit logging apply.
  const { data, error } = await asCaller.rpc("admin_set_member_role", { p_university: universityId, p_email: email, p_role: role, p_department_id: departmentId });
  if (error) return json({ error: "assign_failed", detail: error.message }, 400);
  return json({ ok: true, membership: data });
});
