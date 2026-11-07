"use client";
import { ROLE_PERMISSIONS, ROLES, type Permission } from "@campusnav/core";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/ui";

/** Read-only view of the role → permission matrix enforced by database RLS. */
export default function RolesPage() {
  const perms = [...new Set(Object.values(ROLE_PERMISSIONS).flat())].sort() as Permission[];
  return (
    <div>
      <PageTitle eyebrow="Enforced by Row Level Security">Roles & permissions</PageTitle>
      <p className="text-sm text-muted mb-4 max-w-2xl">
        Roles are assigned per university on the Users page. A user can never grant a role at or above their own, and only owners can create owners. The same matrix lives in the database (role_permissions) and is checked by automated tests.
      </p>
      <div className="cn-tablewrap">
        <table className="cn-table !w-auto">
          <thead>
            <tr>
              <th className="text-start px-3 py-2 sticky start-0 bg-surface">Permission</th>
              {ROLES.map((r) => <th key={r} className="px-3 py-2 mono text-xs whitespace-nowrap">{r.replace("_", " ")}</th>)}
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => (
              <tr key={p} className="border-t border-line">
                <td className="px-3 py-1.5 mono text-xs sticky start-0 bg-bg">{p}</td>
                {ROLES.map((r) => (
                  <td key={r} className="text-center px-3">{ROLE_PERMISSIONS[r].includes(p) ? <span className="inline-flex text-accent" aria-label="allowed"><Icon name="check" className="size-4" /></span> : <span className="text-faint" aria-label="not allowed">·</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
