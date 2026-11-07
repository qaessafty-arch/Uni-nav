-- Security hardening from the Supabase advisors.

-- Pin search_path on the two helper functions that lacked it.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.is_localized(jsonb) set search_path = public, pg_temp;

-- Trigger functions are never called directly; Postgres does not check EXECUTE
-- when a trigger fires, so nobody needs it through the API.
revoke execute on function
  public.audit_trigger(),
  public.check_closure_target(),
  public.guard_lecturer_self_update(),
  public.guard_problem_report_update(),
  public.guard_profile_update(),
  public.guard_university_settings(),
  public.handle_new_user()
from public, anon, authenticated;

-- Staff-only RPCs: signed-in callers only (each also checks permissions inside).
revoke execute on function
  public.admin_list_members(uuid),
  public.admin_set_member_role(uuid, text, public.app_role, uuid),
  public.create_university(text, jsonb, text, text, text)
from public, anon;
grant execute on function
  public.admin_list_members(uuid),
  public.admin_set_member_role(uuid, text, public.app_role, uuid),
  public.create_university(text, jsonb, text, text, text)
to authenticated;

-- Note: public.public_checkpoints is intentionally a definer view
-- (security_barrier): it exposes only id/node_id/label of active checkpoints of
-- readable universities, never the QR token. The policy-helper functions
-- (can_read_university, can_write, has_permission, ...) must stay executable
-- because RLS policies evaluate them as the calling role.
