"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { buildingSchema, campusSchema, lt, type Building, type Campus, type LngLat, sameOutline } from "@campusnav/core";
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
  const [picking, setPicking] = useState(false);
  /** Outline picked from the base map, shown as a preview until confirmed. */
  const [picked, setPicked] = useState<LngLat[] | null>(null);
  const [height, setHeight] = useState("");
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [lat, setLat] = useState("");
  const [placeQ, setPlaceQ] = useState("");
  const [places, setPlaces] = useState<{ name: string; lat: number; lng: number }[] | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
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
  /** Search a place by name (OpenStreetMap Nominatim, a few results, user-initiated only). */
  const searchPlace = async () => {
    if (!placeQ.trim()) return;
    setPlaceBusy(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(placeQ.trim())}`, { headers: { "Accept-Language": "en" } });
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      setPlaces(rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })));
    } catch {
      setPlaces([]);
      toast("Place search is unavailable right now. Enter the coordinates instead.", "error");
    } finally {
      setPlaceBusy(false);
    }
  };

  const saveOutline = async (b: Building, footprint: LngLat[] | null, heightM: number | null = b.geo?.heightM ?? null) => {
    const parsed = buildingSchema.safeParse({ ...b, geo: footprint ? { footprint, heightM } : null });
    if (!parsed.success) return toast(parsed.error.issues.map((i) => i.message).join("; "), "error");
    try {
      await getAdminSource().upsert("buildings", parsed.data as Building);
      toast(footprint ? `Outline saved for ${b.code}` : `Outline removed from ${b.code}`);
      setDrawing(false);
      setPicking(false);
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
            {picking && !picked ? (
              <>
                <Badge tone="warn">Point at the real building for {sel?.code} — it lights up blue — then click</Badge>
                <Button className="!min-h-9" onClick={() => setPicking(false)}>Cancel</Button>
              </>
            ) : null}
            {picked && sel ? (
              <>
                <Badge tone="accent">Preview for {sel.code}: {picked.length} corners</Badge>
                {(() => {
                  const dup = list.find((b) => b.id !== sel.id && sameOutline(b.geo?.footprint, picked));
                  return dup ? <Badge tone="danger">Already used by {dup.code}</Badge> : null;
                })()}
                <Button variant="primary" className="!min-h-9" data-testid="pick-confirm" onClick={() => { void saveOutline(sel, picked); setPicked(null); }}>Use this outline</Button>
                <Button className="!min-h-9" onClick={() => setPicked(null)}>Pick again</Button>
                <Button className="!min-h-9" onClick={() => { setPicked(null); setPicking(false); }}>Cancel</Button>
              </>
            ) : null}
          </div>
          <RealMapEditor
            geo={campus.geo ?? null}
            buildings={list}
            selectedId={selected}
            drawing={drawing}
            draft={picked ?? draft}
            onAddPoint={(p) => setDraft((d) => [...d, p])}
            onSelect={(id) => { setSelected(id); setPicked(null); }}
            onReady={(h) => (handle.current = h)}
            picking={picking && !picked}
            onPick={(outline) => {
              if (!sel) return;
              if (!outline) return toast("No building shape there on the base map. Zoom in (buildings show from zoom 15) and click inside one, or draw the outline.", "error");
              setPicked(outline);
            }}
          />
          <p className="text-xs text-muted">Tip: “Pick from map” copies the outline of a building that OpenStreetMap already has (highlighted in blue while picking). Check it on site; if a building is split across map tiles, draw it instead. Students see placed buildings in 3D on the real map.</p>
        </div>

        <aside className="space-y-4">
          <section className="cn-panel p-4 space-y-3" aria-labelledby="loc-h">
            <h2 id="loc-h" className="font-semibold">Campus location</h2>
            {campus.geo ? (
              <p className="text-sm text-muted mono">{campus.geo.center[1].toFixed(5)}, {campus.geo.center[0].toFixed(5)} · zoom {campus.geo.zoom}</p>
            ) : (
              <p className="text-sm text-warn">Not set — students see the schematic map only.</p>
            )}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void searchPlace(); }}>
              <input className="cn-input flex-1 min-w-0" value={placeQ} onChange={(e) => setPlaceQ(e.target.value)} placeholder="Search a place, e.g. Salahaddin University" aria-label="Search a place" disabled={!editable} />
              <Button type="submit" className="!min-h-9 text-sm" disabled={!editable || placeBusy || !placeQ.trim()}>{placeBusy ? "…" : "Search"}</Button>
            </form>
            {places ? (
              places.length ? (
                <ul className="border border-line rounded-[8px] divide-y divide-[var(--cn-border)] max-h-56 overflow-auto" aria-label="Place results" data-testid="place-results">
                  {places.map((p) => (
                    <li key={`${p.lat},${p.lng}`}>
                      <button type="button" className="w-full text-start px-3 py-2 text-sm hover:bg-[var(--cn-surface-2)]" onClick={() => { setPlaces(null); void saveCampus({ center: [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))], zoom: 16.5, source: `OpenStreetMap — ${p.name.split(",").slice(0, 3).join(",")}. Confirm on site.` }); }}>
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted">No places found. Try another name, or enter the coordinates.</p>
            ) : null}
            <p className="text-[11px] text-muted">Search results © OpenStreetMap contributors (Nominatim).</p>
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
                  <button type="button" className={cx("w-full text-start py-2.5 flex items-center gap-2", selected === b.id && "text-accent font-semibold")} onClick={() => { setSelected(b.id); setPicked(null); setHeight(""); }}>
                    <span className="mono text-sm w-20 truncate">{b.code}</span>
                    <span className="text-sm flex-1 truncate">{lt(b.name, "en")}</span>
                    {b.geo ? <Badge tone="accent">placed</Badge> : <Badge>not placed</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            {sel && editable ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" className="!min-h-9 text-sm" disabled={!campus.geo || drawing || picking} onClick={() => { setPicking(true); setPicked(null); setDrawing(false); setDraft([]); }} data-testid="pick-outline">
                  Pick from map
                </Button>
                <Button className="!min-h-9 text-sm" disabled={!campus.geo || drawing || picking} onClick={() => { setDrawing(true); setPicking(false); setDraft([]); }}>
                  {sel.geo ? "Redraw outline" : "Draw outline"}
                </Button>
                {sel.geo ? <Button variant="danger" className="!min-h-9 text-sm" onClick={() => void saveOutline(sel, null)}>Remove outline</Button> : null}
              </div>
            ) : null}
            {sel && editable && sel.geo ? (
              <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); const h = height.trim() ? Number(height) : null; if (h !== null && !(h >= 2 && h <= 300)) return toast("Height must be 2–300 m.", "error"); void saveOutline(sel, sel.geo!.footprint, h); }}>
                <label className="text-xs flex-1">3D height (m) — empty = from floors
                  <input className="cn-input w-full mt-1" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder={sel.geo.heightM ? String(sel.geo.heightM) : "auto"} aria-label="3D height in metres" />
                </label>
                <Button type="submit" className="!min-h-9 text-sm">Save height</Button>
              </form>
            ) : null}
            {!campus.geo ? <p className="text-xs text-muted mt-2">Set the campus location first.</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
