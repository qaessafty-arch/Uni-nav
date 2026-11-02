"use client";
import { Fragment, useEffect, useState } from "react";
import type { AuditEntry } from "@campusnav/data";
import { errorMessage, getAdminSource, useAdmin } from "@/lib/admin";
import { Badge, EmptyState, ErrorState, PageTitle, Spinner } from "@/components/ui";

export default function AuditPage() {
  const { universityId, version } = useAdmin();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!universityId) return;
    getAdminSource().auditLog(universityId, 300).then(setRows).catch((e) => setError(errorMessage(e)));
  }, [universityId, version]);
  if (error) return <ErrorState title="Could not load audit log" body={error} />;
  if (!rows) return <Spinner label="Loading…" />;
  return (
    <div>
      <PageTitle eyebrow="Written by database triggers — cannot be edited">Audit log</PageTitle>
      {rows.length === 0 ? <EmptyState title="No changes recorded yet." /> : (
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface"><tr>{["When", "Who", "Action", "Table", "Record", ""].map((h) => <th key={h} className="text-start px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-line">
                    <td className="px-3 py-2 mono text-xs whitespace-nowrap">{new Date(r.changedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 mono text-xs">{r.actorEmail ?? r.actorId ?? "system"}</td>
                    <td className="px-3 py-2"><Badge tone={r.action === "delete" ? "danger" : r.action === "insert" ? "accent" : "info"}>{r.action}</Badge></td>
                    <td className="px-3 py-2 mono text-xs">{r.tableName}</td>
                    <td className="px-3 py-2 mono text-xs truncate max-w-48">{r.recordId}</td>
                    <td className="px-3 py-2"><button className="underline text-xs" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>details</button></td>
                  </tr>
                  {open === r.id ? (
                    <tr><td colSpan={6} className="px-3 py-2 bg-surface"><pre className="text-xs overflow-auto max-h-64">{JSON.stringify(r.diff, null, 2)}</pre></td></tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
