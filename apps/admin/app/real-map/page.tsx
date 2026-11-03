"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { buildingSchema, campusSchema, lt, type Building, type Campus, type LngLat } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { Badge, Button, EmptyState, Notice, PageTitle, Spinner, cx } from "@/components/ui";
import type { RealMapEditorHandle } from "@/components/RealMapEditor";

const RealMapEditor = dynamic(() => import("@/components/RealMapEditor").then((m) => m.RealMapEditor), { ssr: false, loading: () => <Spinner label="Loading map…" /> });

export default function RealMapPage() {
  const { universityId, can, bump, toast } = useAdmin();
  const { rows: campuses } = useTable<Campus>("campuses");
  const { rows: buildings } = useTable<Building>("buildings");
  const [campusId, setCampusId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const handle = useRef<RealMapEditorHandle | null>(null);
  const campus = useMemo(() => campuses?.find((c) => c.id === campusId) ?? campuses?.[0], [campuses, campusId]);
  if (!universityId) return null;
  if (!campuses || !buildings) return <Spinner label="Loading…" />;
  if (!campus) return <EmptyState title="Create a campus first." />;
  const list = buildings.filter((b) => b.campusId === campus.id);
  const sel = list.find((b) => b.id === selected) ?? null;
  const editable = can("building.manage");

  const saveCampus = async (geo: Campus["geo"]) => {
    const parsed = campusSchema.safeParse({ ...campus, geo });
    if (!parsed.success) return toast(parsed.error.issues.map((i) => i.message).join("; "), "error");
    try {
      await getAdminSource().upsert("campuses", parsed.data as Campus);
      toast("Campus location saved");
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };
  const saveOutline = async (b: Building, footprint: LngLat[] | null) => {
    const parsed = buildingSchema.safeParse({ ...b, geo: footprint ? { footprint } : null });
    if (!parsed.success) return toast(parsed.error.issues.map((i) => i.message).join("; "), "error");
    try {
      await getAdminSource().upsert("buildings", parsed.data as Building);
      toast(footprint ? `Outline saved for ${b.code}` : `Outline removed from ${b.code}`);
      setDrawing(false);
      setDraft([]);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  return (
    <div>
      <PageTitle eyebrow="Campus & maps">Real map</PageTitle>
      <p className="text-muted max-w-3xl -mt-4 mb-5">
        Place the campus on the real map and trace each building&apos;s outline over the base map, so students see buildings at their true position and scale. Base map: OpenStreetMap contributors (via OpenFreeMap). Use outlines your team checked on site.
      </p>
      {campus.geo?.source && /OpenStreetMap/.test(campus.geo.source) ? (
        <div className="mb-4 max-w-3xl">
          <Notice tone="info">Campus location comes from: {campus.geo.source}. Confirm it with the university before publishing.</Notice>
        </div>
      ) : null}
      <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {campuses.length > 1 ? (
              <select aria-label="Campus" className="cn-input" value={campus.id} onChange={(e) => setCampusId(e.target.value)}>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{lt(c.name, "en")}</option>
                ))}
              </select>
            ) : null}
            {drawing ? (
              <>
                <Badge tone="warn">Drawing {sel?.code}: click the corners ({draft.length} points)</Badge>
                <Button className="!min-h-9" disabled={!draft.length} onClick={() => setDraft(draft.slice(0, -1))}>Undo point</Button>
                <Button variant="primary" className="!min-h-9" disabled={draft.length < 3 || !sel} onClick={() => sel && void saveOutline(sel, draft)}>Finish &amp; save</Button>
                <Button className="!min-h-9" onClick={() => { setDrawing(false); setDraft([]); }}>Cancel</Button>
              </>
            ) : null}
          </div>
          <RealMapEditor geo={campus.geo ?? null} buildings={list} selectedId={selected} drawing={drawing} draft={draft} onAddPoint={(p) => setDraft((d) => [...d, p])} onSelect={setSelected} onReady={(h) => (handle.current = h)} />
        </div>

        <aside className="space-y-4">
          <section className="cn-panel p-4 space-y-3" aria-labelledby="loc-h">
            <h2 id="loc-h" className="font-semibold">Campus location</h2>
            {campus.geo ? (
              <p className="text-sm text-muted mono">{campus.geo.center[1].toFixed(5)}, {campus.geo.center[0].toFixed(5)} · zoom {campus.geo.zoom}</p>
            ) : (
              <p className="text-sm text-warn">Not set — students see the schematic map only.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">Latitude<input className="cn-input w-full mt-1" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="36.14" /></label>
              <label className="text-xs">Longitude<input className="cn-input w-full mt-1" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="44.02" /></label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="!min-h-9 text-sm" disabled={!editable || !lat || !lng} onClick={() => void saveCampus({ center: [Number(lng), Number(lat)], zoom: campus.geo?.zoom ?? 16, source: "Entered by staff" })}>Save coordinates</Button>
              <Button className="!min-h-9 text-sm" disabled={!editable} onClick={() => { const v = handle.current?.view(); if (v) void saveCampus({ ...v, source: "Set by staff on the map" }); }}>Use current map view</Button>
            </div>
          </section>

          <section className="cn-panel p-4" aria-labelledby="bld-h">
            <h2 id="bld-h" className="font-semibold mb-2">Buildings</h2>
            <p className="text-xs text-muted mb-2">{list.filter((b) => b.geo).length} of {list.length} on the real map</p>
            <ul className="divide-y divide-[var(--cn-border)]" aria-label="Buildings on the real map">
              {list.map((b) => (
                <li key={b.id}>
                  <button type="button" className={cx("w-full text-start py-2.5 flex items-center gap-2", selected === b.id && "text-accent font-semibold")} onClick={() => setSelected(b.id)}>
                    <span className="mono text-sm w-20 truncate">{b.code}</span>
                    <span className="text-sm flex-1 truncate">{lt(b.name, "en")}</span>
                    {b.geo ? <Badge tone="accent">placed</Badge> : <Badge>not placed</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            {sel && editable ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" className="!min-h-9 text-sm" disabled={!campus.geo || drawing} onClick={() => { setDrawing(true); setDraft([]); }}>
                  {sel.geo ? "Redraw outline" : "Draw outline"}
                </Button>
                {sel.geo ? <Button variant="danger" className="!min-h-9 text-sm" onClick={() => void saveOutline(sel, null)}>Remove outline</Button> : null}
              </div>
            ) : null}
            {!campus.geo ? <p className="text-xs text-muted mt-2">Set the campus location first.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
