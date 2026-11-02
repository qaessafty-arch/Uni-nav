"use client";
import Link from "next/link";
import { lt, validateMap, type Building, type Room } from "@campusnav/core";
import { useAdminBundle } from "@/lib/bundle";
import { errorMessage, getAdminSource, useAdmin } from "@/lib/admin";
import { Badge, Button, EmptyState, ErrorState, Notice, PageTitle, Spinner } from "@/components/ui";

/**
 * Data verification & publishing. The data model has a per-record status
 * (unverified → verified, or demo) and a university-level "published" flag.
 * This page shows what blocks verification and lets staff with the right
 * permissions record that a building was checked on site.
 */
export default function VerificationPage() {
  const { can, bump, toast } = useAdmin();
  const { data, error } = useAdminBundle();
  if (error) return <ErrorState title="Could not load data" body={error} />;
  if (!data) return <Spinner label="Loading…" />;
  const b = data.bundle;
  const canEdit = can("building.manage") && can("room.manage");

  const rows = b.buildings.map((bld) => {
    const floors = b.floors.filter((f) => f.buildingId === bld.id);
    const floorIds = new Set(floors.map((f) => f.id));
    const rooms = b.rooms.filter((r) => r.buildingId === bld.id);
    const issues = validateMap({
      floors,
      rooms,
      mapElements: b.mapElements.filter((e) => floorIds.has(e.floorId)),
      navNodes: b.navNodes.filter((n) => floorIds.has(n.floorId)),
      navEdges: b.navEdges.filter((e) => {
        const a = b.navNodes.find((n) => n.id === e.fromNodeId);
        return !!a && floorIds.has(a.floorId);
      }),
    }).filter((i) => i.severity === "error" && i.code !== "EDGE_UNKNOWN_NODE"); // cross-building edges point outside this subset
    const noPlan = floors.filter((f) => !b.mapElements.some((e) => e.floorId === f.id));
    const checks = [
      { ok: !!bld.overview, label: "Placed on the campus map", href: "/campus-map" },
      { ok: floors.length > 0, label: "Has floors", href: "/floors" },
      { ok: floors.length > 0 && noPlan.length === 0, label: noPlan.length ? `Floor plan missing on ${noPlan.length} floor(s)` : "Every floor has a plan", href: "/map-editor" },
      { ok: issues.length === 0, label: issues.length ? `${issues.length} map error(s)` : "No map errors", href: "/map-editor" },
      { ok: rooms.every((r) => !!r.entranceNodeId), label: "Every room has an entrance", href: "/rooms" },
    ];
    const verifiedRooms = rooms.filter((r) => r.dataStatus === "verified").length;
    return { bld, rooms, checks, ready: checks.every((c) => c.ok), verifiedRooms };
  });

  const setStatus = async (bld: Building, rooms: Room[], status: "verified" | "unverified") => {
    if (status === "verified" && !window.confirm(`Confirm that ${bld.code} and its ${rooms.length} rooms were checked on site against the real building?`)) return;
    try {
      const src = getAdminSource();
      await src.upsert("buildings", { ...bld, dataStatus: status });
      await src.upsertMany("rooms", rooms.map((r) => ({ ...r, dataStatus: status })));
      toast(status === "verified" ? `${bld.code} marked verified` : `${bld.code} marked unverified`);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div>
      <PageTitle eyebrow="Campus & maps">Verification & publishing</PageTitle>
      <div className="max-w-3xl space-y-3 -mt-4 mb-6">
        <p className="text-muted">
          Students see a <strong>Verified</strong> badge only for data your team confirmed on site. Unverified data is labelled “Location not verified”; demo data is labelled as fictional everywhere.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Workflow:</span>
          <Badge>Unverified (draft)</Badge>
          <span aria-hidden>→</span>
          <Badge tone="accent">Verified</Badge>
          <span aria-hidden>→</span>
          <Badge tone={b.university.published ? "accent" : "neutral"}>{b.university.published ? "University published" : "University not published"}</Badge>
          <Link href="/settings" className="underline text-muted">Publishing settings</Link>
        </div>
        <Notice tone="info">There is no separate “in review” state in the data model yet; use problem reports and the audit log to track review. Adding draft/review states needs a database change.</Notice>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No buildings yet." />
      ) : (
        <ul className="grid lg:grid-cols-2 gap-4">
          {rows.map(({ bld, rooms, checks, ready, verifiedRooms }) => (
            <li key={bld.id} className="cn-panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono font-semibold">{bld.code}</span>
                <span className="font-medium">{lt(bld.name, "en")}</span>
                <span className="ms-auto">
                  {bld.dataStatus === "verified" ? <Badge tone="accent">Verified</Badge> : bld.dataStatus === "demo" ? <Badge tone="warn">Demo</Badge> : <Badge>Unverified</Badge>}
                </span>
              </div>
              <p className="text-sm text-muted mt-1">
                Rooms verified: {verifiedRooms} / {rooms.length}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm" aria-label={`Checks for ${bld.code}`}>
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span aria-hidden className={c.ok ? "text-accent" : "text-warn"}>{c.ok ? "✓" : "!"}</span>
                    <span className={c.ok ? "" : "text-warn"}>{c.label}</span>
                    {!c.ok ? (
                      <Link href={c.href} className="ms-auto text-xs underline text-muted">
                        Fix
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {bld.dataStatus !== "verified" ? (
                    <Button variant="primary" className="!min-h-9 text-sm" disabled={!ready || bld.dataStatus === "demo"} onClick={() => void setStatus(bld, rooms, "verified")}>
                      Mark verified
                    </Button>
                  ) : (
                    <Button className="!min-h-9 text-sm" onClick={() => void setStatus(bld, rooms, "unverified")}>
                      Mark unverified
                    </Button>
                  )}
                  {bld.dataStatus === "demo" ? <span className="text-xs text-muted self-center">Demo buildings cannot be marked verified.</span> : !ready ? <span className="text-xs text-muted self-center">Resolve the checks first.</span> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
