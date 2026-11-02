"use client";
import Link from "next/link";
import { detectConflicts, lt, validateMap } from "@campusnav/core";
import { useAdminBundle } from "@/lib/bundle";
import { Badge, ErrorState, PageTitle, Section, Spinner } from "@/components/ui";

/**
 * Dashboard: real counts and data-quality analytics computed from the tenant's
 * data. No usage statistics are shown because none are collected.
 */
export default function Dashboard() {
  const { data, error } = useAdminBundle();
  if (error) return <ErrorState title="Could not load data" body={error} />;
  if (!data) return <Spinner label="Loading…" />;
  const b = data.bundle;
  const issues = validateMap({ ...b, checkpoints: data.checkpoints });
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const conflicts = detectConflicts(b.timetable);
  const noEntrance = b.rooms.filter((r) => !r.entranceNodeId);
  const noOffice = b.lecturers.filter((l) => !l.officeRoomId);
  const unverifiedRooms = b.rooms.filter((r) => r.dataStatus !== "verified");
  const missingCkb = b.rooms.filter((r) => !r.name.ckb).length;
  const missingAr = b.rooms.filter((r) => !r.name.ar).length;

  const stats: [string, number, string][] = [
    ["Buildings", b.buildings.length, "/buildings"],
    ["Floors", b.floors.length, "/floors"],
    ["Rooms", b.rooms.length, "/rooms"],
    ["Nav nodes", b.navNodes.length, "/map-editor"],
    ["Nav edges", b.navEdges.length, "/map-editor"],
    ["Checkpoints", data.checkpoints.length, "/checkpoints"],
    ["Lecturers", b.lecturers.length, "/lecturers"],
    ["Courses", b.courses.length, "/courses"],
    ["Groups", b.groups.length, "/groups"],
    ["Timetable entries", b.timetable.length, "/timetable"],
  ];

  return (
    <div>
      <PageTitle eyebrow={b.university.dataStatus === "demo" ? "Demo university" : b.university.published ? "Published" : "Not published"}>{lt(b.university.name, "en")}</PageTitle>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map(([label, n, href]) => (
          <Link key={label} href={href} className="cn-tile p-4 min-h-28 flex flex-col justify-between">
            <div className="label-caps">{label}</div>
            <div className="cn-figure text-4xl mt-3">{n}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-x-10 gap-y-2 mt-12">
        <Section title="Map & navigation integrity">
          <p className="text-sm mb-3">
            {errors.length === 0 ? <Badge tone="accent">no blocking errors</Badge> : <Badge tone="danger">{errors.length} errors</Badge>} <Badge tone={warnings.length ? "warn" : "neutral"}>{warnings.length} warnings</Badge>
          </p>
          <ul className="text-sm space-y-1 max-h-64 overflow-auto">
            {issues.slice(0, 50).map((i, n) => (
              <li key={n} className="flex gap-2">
                <Badge tone={i.severity === "error" ? "danger" : "warn"}>{i.code}</Badge>
                <span className="mono text-xs text-muted truncate">{i.refId}</span>
              </li>
            ))}
          </ul>
          <Link href="/map-editor" className="text-sm underline mt-3 inline-block">Open map editor →</Link>
        </Section>
        <Section title="Timetable">
          <p className="text-sm">
            {conflicts.length === 0 ? <Badge tone="accent">no conflicts</Badge> : <Badge tone="danger">{conflicts.length} conflicts</Badge>}
          </p>
          <ul className="text-sm mt-2 space-y-1">
            {conflicts.slice(0, 10).map((c, i) => (
              <li key={i} className="mono text-xs">{c.kind} clash on {c.firstDate}</li>
            ))}
          </ul>
          <Link href="/timetable" className="text-sm underline mt-3 inline-block">Manage timetable →</Link>
        </Section>
        <Section title="Data completeness">
          <ul className="text-sm space-y-2">
            <li className="flex justify-between"><span>Rooms without an entrance (not navigable)</span><span className="mono">{noEntrance.length}</span></li>
            <li className="flex justify-between"><span>Lecturers without an office location</span><span className="mono">{noOffice.length}</span></li>
            <li className="flex justify-between"><span>Rooms not yet verified by the university</span><span className="mono">{unverifiedRooms.length}</span></li>
            <li className="flex justify-between"><span>Rooms missing a Sorani name</span><span className="mono">{missingCkb}</span></li>
            <li className="flex justify-between"><span>Rooms missing an Arabic name</span><span className="mono">{missingAr}</span></li>
          </ul>
        </Section>
        <Section title="Analytics">
          <p className="text-sm text-muted">
            CAMPUS NAV does not collect usage analytics or location history from students by default, so no traffic statistics are shown here. The figures above are computed live from your university&apos;s data.
          </p>
        </Section>
      </div>
    </div>
  );
}
