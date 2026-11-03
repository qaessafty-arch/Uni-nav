"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { auditCampus, buildGraph, lt, type AuditCode, type AuditIssue, type AuditSeverity, type CampusBundle } from "@campusnav/core";
import { useAdminBundle } from "@/lib/bundle";
import { Badge, Button, EmptyState, ErrorState, Notice, PageTitle, Spinner, cx } from "@/components/ui";

/**
 * Campus data health. Runs the same routing graph the student app uses and
 * lists what would break a real route — before a student finds it.
 */

const TEXT: Record<AuditCode, { title: string; why: string; fix: string; href: string }> = {
  BUILDING_NO_ENTRANCE: { title: "Building has no entrance on the map", why: "No route can enter this building, so none of its rooms can be reached.", fix: "Add a “building entrance” node on the ground floor.", href: "/map-editor" },
  FLOOR_UNREACHABLE: { title: "Floor cannot be reached", why: "No stairs, elevator or ramp connects this floor to an entrance.", fix: "Link the floor's stairs/elevator nodes to the floor below.", href: "/map-editor" },
  ROOM_NO_ENTRANCE: { title: "Room has no entrance node", why: "Students can find the room but can't be guided to it.", fix: "Set the room's door on the floor map.", href: "/rooms" },
  ROOM_UNREACHABLE: { title: "Room is cut off from the corridors", why: "Its door is not connected to the walking network.", fix: "Connect the door node to the nearest corridor.", href: "/map-editor" },
  ROOM_TRAP: { title: "One-way trap: you can get in but not back out", why: "Every path into this room is one-way.", fix: "Make the door or corridor edge two-way, or add a way back.", href: "/map-editor" },
  CHECKPOINT_DANGLING: { title: "QR checkpoint points at a deleted spot", why: "Scanning this sign would fail.", fix: "Move the checkpoint to an existing node or disable it.", href: "/checkpoints" },
  CHECKPOINT_UNREACHABLE: { title: "QR checkpoint is on an isolated spot", why: "A student who scans it can't be routed anywhere.", fix: "Connect the node to the walking network.", href: "/checkpoints" },
  EDGE_REJECTED: { title: "Path ignored by the router", why: "The path has no usable length (e.g. stairs between floors without a distance).", fix: "Enter the length in metres or fix its end points.", href: "/map-editor" },
  ROOM_STEP_FREE_MISMATCH: { title: "Marked step-free, but only stairs reach it", why: "A wheelchair user would be told the room is accessible and then get no route.", fix: "Mark the elevator/ramp edges accessible, or untick “accessible” on the room.", href: "/rooms" },
  NODE_ISOLATED: { title: "Map point with no connections", why: "Usually left over after editing; it can confuse “I am here” taps.", fix: "Connect it or delete it.", href: "/map-editor" },
  FLOOR_NO_PLAN: { title: "Floor has no drawn plan", why: "Routing may work, but students see an empty floor.", fix: "Draw or import the floor plan.", href: "/map-editor" },
  EDGE_ONE_WAY: { title: "One-way path", why: "Fine for exit-only doors; otherwise routes will detour.", fix: "Check that it is intended.", href: "/map-editor" },
  BUILDING_NOT_ON_MAP: { title: "Building not placed on the campus map", why: "Students can't see where it is outside.", fix: "Draw its outline on the real map.", href: "/real-map" },
};

const SEV: Record<AuditSeverity, { label: string; tone: "danger" | "warn" | "neutral" }> = {
  error: { label: "Breaks routes", tone: "danger" },
  warning: { label: "Should fix", tone: "warn" },
  info: { label: "Check", tone: "neutral" },
};

function targetName(b: CampusBundle, i: AuditIssue): string {
  const room = b.rooms.find((r) => r.id === i.targetId);
  if (room) return `Room ${room.code} · ${lt(room.name, "en")}`;
  const floor = b.floors.find((f) => f.id === i.targetId);
  if (floor) return lt(floor.name, "en");
  const bld = b.buildings.find((x) => x.id === i.targetId);
  if (bld) return `${bld.code} · ${lt(bld.name, "en")}`;
  const cp = b.checkpoints.find((c) => c.id === i.targetId);
  if (cp) return `Checkpoint “${lt(cp.label, "en")}”`;
  const node = b.navNodes.find((n) => n.id === i.targetId);
  if (node) return `${node.kind.replace("_", " ")} “${lt(node.label, "en") || node.id.slice(0, 8)}”`;
  return `Path ${i.targetId.slice(0, 8)}`;
}

function Ring({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const tone = value >= 95 ? "var(--cn-accent)" : value >= 75 ? "var(--cn-warning)" : "var(--cn-danger)";
  return (
    <svg viewBox="0 0 80 80" className="size-24 shrink-0" role="img" aria-label={`Health score ${value} out of 100`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--cn-border)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 40 40)" />
      <text x="40" y="45" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor">{value}</text>
    </svg>
  );
}

function Bar({ label, value, total, hint }: { label: string; value: number; total: number; hint?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="mono text-muted">
          {value}/{total} · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--cn-border)] mt-1 overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-[var(--cn-accent)]" style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="text-xs text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

function csv(b: CampusBundle, issues: AuditIssue[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [["severity", "code", "building", "item", "problem", "how to fix"].join(",")];
  for (const i of issues) {
    const bld = b.buildings.find((x) => x.id === i.buildingId);
    lines.push([i.severity, i.code, bld?.code ?? "", targetName(b, i), TEXT[i.code].title, TEXT[i.code].fix].map(esc).join(","));
  }
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "campus-data-health.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

export default function HealthPage() {
  const { data, error } = useAdminBundle();
  const [sev, setSev] = useState<AuditSeverity | "all">("all");
  const report = useMemo(() => (data ? auditCampus(data.bundle) : null), [data]);
  if (error) return <ErrorState title="Could not load data" body={error} />;
  if (!data || !report) return <Spinner label="Checking campus data…" />;
  const b = data.bundle;
  const { stats, issues } = report;
  const counts = { error: 0, warning: 0, info: 0 } as Record<AuditSeverity, number>;
  for (const i of issues) counts[i.severity]++;
  const shown = sev === "all" ? issues : issues.filter((i) => i.severity === sev);

  // Per-building reachability, from the same audit run.
  const unreachable = new Set(issues.filter((i) => i.code === "ROOM_UNREACHABLE" || i.code === "ROOM_NO_ENTRANCE").map((i) => i.targetId));
  const perBuilding = b.buildings.map((bld) => {
    const rooms = b.rooms.filter((r) => r.buildingId === bld.id);
    const blocked = issues.some((i) => (i.code === "BUILDING_NO_ENTRANCE" && i.targetId === bld.id) || (i.code === "FLOOR_UNREACHABLE" && i.buildingId === bld.id));
    const floorsCut = new Set(issues.filter((i) => i.code === "FLOOR_UNREACHABLE" && i.buildingId === bld.id).map((i) => i.targetId));
    const ok = rooms.filter((r) => !unreachable.has(r.id) && !(blocked && (floorsCut.has(r.floorId) || issues.some((i) => i.code === "BUILDING_NO_ENTRANCE" && i.targetId === bld.id)))).length;
    return { bld, total: rooms.length, ok };
  });
  const rejected = buildGraph(b.navNodes, b.navEdges, b.floors).rejectedEdges.length;

  return (
    <div>
      <PageTitle
        eyebrow="Campus & maps"
        actions={
          <Button className="!min-h-9 text-sm" onClick={() => csv(b, issues)} disabled={!issues.length}>
            Download CSV for the data team
          </Button>
        }
      >
        Data health
      </PageTitle>
      <p className="text-muted max-w-3xl -mt-4 mb-6">
        Every check below runs on the <strong>same walking network the student app routes on</strong>. It finds rooms students can’t be guided to, one-way traps, QR signs that lead nowhere and accessibility promises the map can’t keep — before a student does.
      </p>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 mb-6">
        <section className="cn-panel p-5 flex items-center gap-5" aria-label="Score">
          <Ring value={stats.score} />
          <div className="min-w-0">
            <div className="text-lg font-semibold">{stats.score >= 95 ? "Ready for students" : stats.score >= 75 ? "Mostly routable" : "Not ready yet"}</div>
            <p className="text-sm text-muted">Share of rooms a student can be routed to, minus a penalty for each route-breaking problem.</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge tone="danger">{counts.error} break routes</Badge>
              <Badge tone="warn">{counts.warning} should fix</Badge>
              <Badge>{counts.info} to check</Badge>
            </div>
          </div>
        </section>
        <section className="cn-panel p-5 space-y-3" aria-label="Coverage">
          <Bar label="Rooms reachable on foot" value={stats.roomsReachable} total={stats.rooms} />
          <Bar label="Rooms reachable step-free" value={stats.roomsStepFree} total={stats.rooms} hint="Via elevators, ramps and level paths only." />
          <Bar label="Floors with a drawn plan" value={stats.floorsWithPlan} total={stats.floors} />
          <p className="text-xs text-muted mono">
            {stats.nodes} map points · {stats.edges} paths ({rejected} ignored) · {stats.checkpoints} QR checkpoints
          </p>
        </section>
      </div>

      {perBuilding.length ? (
        <section className="cn-panel p-5 mb-6" aria-label="By building">
          <h2 className="font-semibold mb-3">Reachable rooms by building</h2>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
            {perBuilding.map(({ bld, total, ok }) => (
              <Bar key={bld.id} label={`${bld.code} · ${lt(bld.name, "en")}`} value={ok} total={total} />
            ))}
          </div>
        </section>
      ) : null}

      {b.source === "demo" ? (
        <div className="mb-4">
          <Notice tone="info">This is the fictional demo campus. Run this page again after real floor plans are entered — it is the fastest way to find mapping mistakes.</Notice>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mb-3" role="group" aria-label="Filter by severity">
        {(["all", "error", "warning", "info"] as const).map((s) => (
          <button key={s} type="button" className="cn-chip !min-h-9" aria-pressed={sev === s} onClick={() => setSev(s)}>
            {s === "all" ? `All (${issues.length})` : `${SEV[s].label} (${counts[s]})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={issues.length ? "Nothing in this category." : "No problems found — every room can be reached."} />
      ) : (
        <ul className="cn-panel divide-y divide-[var(--cn-border)]" data-testid="health-issues">
          {shown.map((i, k) => {
            const tx = TEXT[i.code];
            const bld = b.buildings.find((x) => x.id === i.buildingId);
            return (
              <li key={`${i.code}-${i.targetId}-${k}`} className="p-4 flex flex-wrap items-start gap-3">
                <Badge tone={SEV[i.severity].tone} className="shrink-0">{SEV[i.severity].label}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{tx.title}</div>
                  <div className="text-sm">
                    {bld ? <span className="mono text-muted me-2">{bld.code}</span> : null}
                    {targetName(b, i)}
                    {i.detail ? <span className="text-muted"> · {i.detail.replace(/_/g, " ")}</span> : null}
                  </div>
                  <p className={cx("text-sm text-muted mt-1")}>
                    {tx.why} <strong className="font-medium text-fg">{tx.fix}</strong>
                  </p>
                </div>
                <Link href={tx.href} className="text-sm underline text-muted shrink-0">
                  Fix
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
