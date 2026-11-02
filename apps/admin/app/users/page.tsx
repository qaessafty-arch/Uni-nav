"use client";
import { useEffect, useState } from "react";
import { canAssignRole, lt, ROLES, type Department, type LocalizedText, type Role } from "@campusnav/core";
import type { MembershipRow } from "@campusnav/data";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { inputCls } from "@/components/Form";
import { Badge, Button, ErrorState, Notice, PageTitle, Spinner } from "@/components/ui";

export default function UsersPage() {
  const { universityId, role, session, version, bump, toast } = useAdmin();
  const { rows: depts } = useTable<Department>("departments");
  const [members, setMembers] = useState<MembershipRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("student");
  const [dept, setDept] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    if (!universityId) return;
    getAdminSource().listMembers(universityId).then(setMembers).catch((e) => setError(errorMessage(e)));
  }, [universityId, version]);
  if (!role) return null;
  const assignable = ROLES.filter((r) => canAssignRole(role, r));
  if (error) return <ErrorState title="Could not load members" body={error} />;
  if (!members) return <Spinner label="Loading…" />;

  const submit = async () => {
    setFormError(null);
    if (newRole === "department_admin" && !dept) return setFormError("Choose the department this admin manages.");
    try {
      await getAdminSource().setMemberRole(universityId!, email.trim(), newRole, newRole === "department_admin" ? dept : null);
      toast("Role assigned");
      setEmail("");
      bump();
    } catch (e) {
      const m = errorMessage(e);
      setFormError(/user_not_found/.test(m) ? "No account exists for this email yet. Ask the person to create an account (or invite them via the invite-member edge function), then try again." : m);
    }
  };

  return (
    <div className="max-w-4xl">
      <PageTitle>Users</PageTitle>
      <form className="border border-line p-4 mb-6 grid sm:grid-cols-[1fr_200px_200px_auto] gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="text-sm">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></label>
        <label className="text-sm">Role
          <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)} className={inputCls}>
            {assignable.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-sm">Department
          <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls} disabled={newRole !== "department_admin"}>
            <option value="">—</option>
            {(depts ?? []).map((d) => <option key={d.id} value={d.id}>{lt(d.name as LocalizedText, "en")}</option>)}
          </select>
        </label>
        <Button type="submit" variant="primary">Assign</Button>
        {formError ? <p role="alert" className="text-danger text-sm sm:col-span-4">{formError}</p> : null}
      </form>
      <Notice>You can assign only roles below your own ({role.replace("_", " ")}). Role changes are recorded in the audit log.</Notice>
      <div className="border border-line mt-4">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0">
            <span className="mono text-sm flex-1 truncate">{m.email ?? m.userId}</span>
            <Badge tone="info">{m.role.replace("_", " ")}</Badge>
            {m.departmentId ? <span className="text-xs text-muted">{lt(depts?.find((d) => d.id === m.departmentId)?.name, "en")}</span> : null}
            {canAssignRole(role, m.role) && m.userId !== session?.userId ? (
              <button className="underline text-danger text-sm" onClick={async () => {
                if (!window.confirm("Remove this member's access?")) return;
                try { await getAdminSource().removeMember(m.id); toast("Removed"); bump(); } catch (e) { toast(errorMessage(e), "error"); }
              }}>Remove</button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
