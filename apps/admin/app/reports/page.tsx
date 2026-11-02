"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { lt, type NavNode, type ProblemReport, type ProblemStatus, type Room } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { Badge, Button, EmptyState, PageTitle, Spinner, cx } from "@/components/ui";

const CATEGORY: Record<ProblemReport["category"], string> = {
  wrong_location: "Wrong location",
  blocked_path: "Blocked / locked path",
  wrong_directions: "Wrong directions",
  wrong_info: "Wrong name or details",
  accessibility: "Accessibility",
  other: "Other",
};
const STATUS: { value: ProblemStatus; label: string; tone: "warn" | "info" | "accent" | "neutral" }[] = [
  { value: "open", label: "Open", tone: "warn" },
  { value: "in_progress", label: "In progress", tone: "info" },
  { value: "resolved", label: "Resolved", tone: "accent" },
  { value: "rejected", label: "Rejected", tone: "neutral" },
];

export default function ReportsPage() {
  const { universityId, can, bump, toast } = useAdmin();
  const { rows } = useTable<ProblemReport>("problem_reports");
  const { rows: rooms } = useTable<Room>("rooms");
  const { rows: nodes } = useTable<NavNode>("navigation_nodes");
  const [filter, setFilter] = useState<ProblemStatus | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const roomById = useMemo(() => new Map((rooms ?? []).map((r) => [r.id, r])), [rooms]);
  const nodeById = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);
  if (!universityId) return null;
  if (!can("report.manage")) return <EmptyState title="Your role cannot review problem reports." />;
  if (!rows) return <Spinner label="Loading…" />;

  const counts = Object.fromEntries(STATUS.map((s) => [s.value, rows.filter((r) => r.status === s.value).length]));
  const list = rows.filter((r) => filter === "all" || r.status === filter).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const update = async (r: ProblemReport, status: ProblemStatus) => {
    try {
      await getAdminSource().updateReport(r.id, status, (notes[r.id] ?? r.adminNote ?? "").trim() || null);
      toast(`Report marked ${STATUS.find((s) => s.value === status)!.label.toLowerCase()}`);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const nodeLabel = (id: string | null | undefined) => {
    const n = id ? nodeById.get(id) : undefined;
    return n ? lt(n.label, "en") || `${n.kind} ${n.id.slice(0, 6)}` : null;
  };

  return (
    <div>
      <PageTitle eyebrow="Overview">Problem reports</PageTitle>
      <p className="text-muted max-w-2xl -mt-4 mb-6">Reports sent by students and visitors from the app (no names or contact details are collected). Fix the data, then mark the report resolved. Every change is in the audit log.</p>
      <div className="cn-scroll-x mb-5" role="tablist" aria-label="Filter by status">
        {[...STATUS, { value: "all" as const, label: "All", tone: "neutral" as const }].map((s) => (
          <button key={s.value} role="tab" aria-selected={filter === s.value} aria-pressed={filter === s.value} className="cn-chip !min-h-9" onClick={() => setFilter(s.value)}>
            {s.label}
            <span className="mono text-xs opacity-80">{s.value === "all" ? rows.length : counts[s.value]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title={filter === "open" ? "No open reports. Nice." : "Nothing here."} />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const room = r.roomId ? roomById.get(r.roomId) : undefined;
            const st = STATUS.find((s) => s.value === r.status)!;
            const from = nodeLabel(r.routeFromNodeId);
            const to = nodeLabel(r.routeToNodeId);
            return (
              <li key={r.id} className={cx("cn-panel p-4", r.status === "open" && "!border-[var(--cn-warning)]")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <Badge>{CATEGORY[r.category]}</Badge>
                  {r.createdAt ? <span className="mono text-xs text-muted">{r.createdAt.slice(0, 16).replace("T", " ")}</span> : null}
                  {room ? (
                    <Link className="text-sm underline ms-auto" href="/rooms">
                      Room {room.code} · {lt(room.name, "en")}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words">{r.message}</p>
                {from && to ? <p className="text-sm text-muted mt-1">Route: {from} → {to}</p> : nodeLabel(r.nodeId) ? <p className="text-sm text-muted mt-1">Place: {nodeLabel(r.nodeId)}</p> : null}
                <div className="mt-4 flex flex-col md:flex-row gap-2 md:items-center">
                  <label className="sr-only" htmlFor={`note-${r.id}`}>Staff note</label>
                  <input id={`note-${r.id}`} className="cn-input flex-1 !min-h-10 text-sm" placeholder="Staff note (optional, internal)" maxLength={1000} value={notes[r.id] ?? r.adminNote ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                  <div className="flex gap-2 flex-wrap">
                    {STATUS.filter((s) => s.value !== r.status).map((s) => (
                      <Button key={s.value} variant={s.value === "resolved" ? "primary" : "secondary"} className="!min-h-10 text-sm" onClick={() => void update(r, s.value)}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
