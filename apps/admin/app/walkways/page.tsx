"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  centroid,
  haversineM,
  lt,
  navEdgeSchema,
  overpassWalkwayQuery,
  polylineLengthM,
  suggestWalkway,
  walkwaysFromOverpass,
  type CampusBundle,
  type LngLat,
  type NavEdge,
  type NavNode,
} from "@campusnav/core";
import { useAdminBundle } from "@/lib/bundle";
import { errorMessage, getAdminSource, useAdmin } from "@/lib/admin";
import { Badge, Button, EmptyState, ErrorState, Notice, PageTitle, Spinner, cx } from "@/components/ui";
import type { RealMapEditorHandle } from "@/components/RealMapEditor";

const RealMapEditor = dynamic(() => import("@/components/RealMapEditor").then((m) => m.RealMapEditor), { ssr: false, loading: () => <Spinner label="Loading map…" /> });
const OVERPASS = "https://overpass-api.de/api/interpreter";

/** Building entrances: the places outdoor walkways connect. */
function entrances(b: CampusBundle) {
  const floorOf = new Map(b.floors.map((f) => [f.id, f]));
  return b.navNodes
    .filter((n) => n.kind === "building_entrance")
    .map((n) => {
      const bld = b.buildings.find((x) => x.id === floorOf.get(n.floorId)?.buildingId);
      return { node: n, building: bld ?? null, name: `${bld?.code ?? "?"} · ${lt(n.label, "en") || "entrance"}` };
    })
    .sort((a, z) => a.name.localeCompare(z.name));
}

export default function WalkwaysPage() {
  const { can, bump, toast, universityId } = useAdmin();
  const { data, error } = useAdminBundle();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [accessible, setAccessible] = useState(true);
  const [typedM, setTypedM] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const handle = useRef<RealMapEditorHandle | null>(null);
  const b = data?.bundle;
  const ents = useMemo(() => (b ? entrances(b) : []), [b]);
  if (error) return <ErrorState title="Could not load data" body={error} />;
  if (!b || !universityId) return <Spinner label="Loading…" />;

  const editable = can("map.edit");
  const campus = b.campuses.find((c) => c.geo) ?? b.campuses[0];
  const walkways = b.navEdges.filter((e) => e.kind === "outdoor");
  const nameOf = (id: string) => ents.find((x) => x.node.id === id)?.name ?? "Unknown point";
  const sel = walkways.find((w) => w.id === selectedId) ?? null;

  const startNew = () => {
    setSelectedId(null);
    setFromId("");
    setToId("");
    setDraft([]);
    setAccessible(true);
    setTypedM("");
    setSuggestNote(null);
    setDrawing(false);
  };
  const pick = (w: NavEdge) => {
    setSelectedId(w.id);
    setFromId(w.fromNodeId);
    setToId(w.toNodeId);
    setDraft(w.geometry ?? []);
    setAccessible(w.accessible);
    setTypedM(w.geometry ? "" : String(w.distanceM ?? ""));
    setSuggestNote(null);
    setDrawing(false);
  };

  const anchorFor = (n: NavNode | undefined): LngLat | null => {
    const bld = b.buildings.find((x) => x.id === b.floors.find((f) => f.id === n?.floorId)?.buildingId);
    return bld?.geo ? centroid(bld.geo.footprint) : null;
  };

  const suggest = async () => {
    const a = anchorFor(b.navNodes.find((n) => n.id === fromId));
    const z = anchorFor(b.navNodes.find((n) => n.id === toId));
    if (!a || !z) return toast("Both buildings need an outline on the Real map first.", "error");
    const pad = 0.0025; // ~250 m around the two buildings
    const bbox: [LngLat, LngLat] = [[Math.min(a[0], z[0]) - pad, Math.min(a[1], z[1]) - pad], [Math.max(a[0], z[0]) + pad, Math.max(a[1], z[1]) + pad]];
    setBusy(true);
    setSuggestNote(null);
    try {
      const res = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassWalkwayQuery(bbox) }) });
      if (!res.ok) throw new Error(`OpenStreetMap answered ${res.status}`);
      const ways = walkwaysFromOverpass(await res.json());
      if (!ways.length) throw new Error("No mapped paths found around these buildings on OpenStreetMap.");
      const s = suggestWalkway(ways, a, z, { stepFree: accessible, maxGapM: 150 });
      if (!s) throw new Error(accessible ? "No step-free path found on OpenStreetMap — untick “step-free” or draw it by hand." : "No connected path found on OpenStreetMap — draw it by hand.");
      setDraft(s.path);
      setSuggestNote(`Suggested from OpenStreetMap: ${Math.round(s.lengthM)} m${s.usesSteps ? ", includes steps" : ""}. The first ${Math.round(s.gapStartM)} m and last ${Math.round(s.gapEndM)} m are straight joins to the building — adjust the ends to the real doors, then save.`);
      if (s.usesSteps) setAccessible(false);
    } catch (e) {
      toast(`${errorMessage(e)} You can still trace the path by clicking on the map.`, "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!fromId || !toId || fromId === toId) return toast("Choose two different entrances.", "error");
    const geometry = draft.length >= 2 ? draft : null;
    const distanceM = geometry ? null : Number(typedM);
    if (!geometry && !(distanceM && distanceM > 0)) return toast("Draw the path on the map, or enter its length in metres.", "error");
    const edge: NavEdge = {
      ...(sel ?? { id: crypto.randomUUID(), universityId, blocked: false, restriction: null }),
      fromNodeId: fromId,
      toNodeId: toId,
      kind: "outdoor",
      bidirectional: true,
      accessible,
      geometry,
      distanceM,
    } as NavEdge;
    const parsed = navEdgeSchema.safeParse(edge);
    if (!parsed.success) return toast(parsed.error.issues.map((i) => i.message).join("; "), "error");
    try {
      await getAdminSource().upsert("navigation_edges", parsed.data as NavEdge);
      toast(sel ? "Walkway updated" : "Walkway added");
      setSelectedId(parsed.data.id);
      setDrawing(false);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const remove = async () => {
    if (!sel || !window.confirm(`Delete the walkway ${nameOf(sel.fromNodeId)} ↔ ${nameOf(sel.toNodeId)}? Routes will no longer use it.`)) return;
    try {
      await getAdminSource().remove("navigation_edges", sel.id);
      toast("Walkway deleted");
      startNew();
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const lengthOf = (w: NavEdge) => (w.geometry && w.geometry.length >= 2 ? polylineLengthM(w.geometry) : w.distanceM ?? null);
  const draftLen = draft.length >= 2 ? polylineLengthM(draft) : null;
  const straight = (() => {
    const a = anchorFor(b.navNodes.find((n) => n.id === fromId));
    const z = anchorFor(b.navNodes.find((n) => n.id === toId));
    return a && z ? haversineM(a, z) : null;
  })();

  return (
    <div>
      <PageTitle eyebrow="Campus & maps">Walkways between buildings</PageTitle>
      <p className="text-muted max-w-3xl -mt-4 mb-5">
        Connect building entrances with the paths people really walk. Trace each path over the map, or let <strong>OpenStreetMap</strong> suggest it from the footpaths already mapped around your campus. Routes are measured along the real path, students see it on the map, and paths with steps are skipped for step-free routes.
      </p>
      {!campus?.geo ? (
        <div className="mb-4 max-w-3xl">
          <Notice tone="warn">
            Place the campus on the <Link className="underline" href="/real-map">Real map</Link> first. You can still add walkways by length only; they will show as straight lines.
          </Notice>
        </div>
      ) : null}
      <div className="grid xl:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 min-h-9">
            {drawing ? (
              <>
                <Badge tone="warn">Click along the path, from the first entrance to the second ({draft.length} points)</Badge>
                <Button className="!min-h-9" disabled={!draft.length} onClick={() => setDraft(draft.slice(0, -1))}>Undo point</Button>
                <Button className="!min-h-9" onClick={() => setDrawing(false)}>Done</Button>
              </>
            ) : (
              <span className="text-sm text-muted">{walkways.length} walkway(s) · {walkways.filter((w) => w.geometry).length} drawn on the map · amber = has steps</span>
            )}
          </div>
          {campus?.geo ? (
            <RealMapEditor
              geo={campus.geo}
              buildings={b.buildings}
              selectedId={null}
              drawing={drawing}
              draft={draft}
              draftMode="line"
              onAddPoint={(p) => setDraft((d) => [...d, p])}
              onSelect={() => undefined}
              onSelectLine={(id) => {
                const w = walkways.find((x) => x.id === id);
                if (w) pick(w);
              }}
              lines={walkways.filter((w) => w.geometry && w.id !== selectedId).map((w) => ({ id: w.id, coords: w.geometry!, steps: !w.accessible }))}
              onReady={(h) => (handle.current = h)}
            />
          ) : (
            <div className="cn-panel p-6 text-muted">No real map for this campus yet.</div>
          )}
          <section className="cn-panel" aria-label="Walkways">
            {walkways.length === 0 ? (
              <EmptyState title="No walkways yet." body="Add one with the form — each connects two building entrances." />
            ) : (
              <ul className="divide-y divide-[var(--cn-border)]" data-testid="walkway-list">
                {walkways.map((w) => {
                  const len = lengthOf(w);
                  return (
                    <li key={w.id}>
                      <button type="button" className={cx("w-full text-start px-4 py-3 flex flex-wrap items-center gap-2 hover:bg-[var(--cn-surface-sunken)]", w.id === selectedId && "bg-[var(--cn-accent-soft)]")} onClick={() => pick(w)}>
                        <span className="font-medium">{nameOf(w.fromNodeId)}</span>
                        <span aria-hidden>↔</span>
                        <span className="font-medium">{nameOf(w.toNodeId)}</span>
                        <span className="ms-auto flex items-center gap-1.5">
                          <span className="mono text-sm text-muted">{len != null ? `${Math.round(len)} m` : "—"}</span>
                          {w.geometry ? <Badge tone="accent">Real path</Badge> : <Badge>Length only</Badge>}
                          {!w.accessible ? <Badge tone="warn">Steps</Badge> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="cn-panel p-5 space-y-4 xl:sticky xl:top-20" aria-label="Walkway details">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{sel ? "Edit walkway" : "New walkway"}</h2>
            {sel ? <Button className="!min-h-8 text-sm" onClick={startNew}>New</Button> : null}
          </div>
          <fieldset disabled={!editable} className="space-y-3">
            <label className="block text-sm">
              From entrance
              <select className="cn-input w-full mt-1" value={fromId} onChange={(e) => setFromId(e.target.value)} aria-label="From entrance">
                <option value="">Choose…</option>
                {ents.map((x) => <option key={x.node.id} value={x.node.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              To entrance
              <select className="cn-input w-full mt-1" value={toId} onChange={(e) => setToId(e.target.value)} aria-label="To entrance">
                <option value="">Choose…</option>
                {ents.filter((x) => x.node.id !== fromId).map((x) => <option key={x.node.id} value={x.node.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} /> Step-free (no stairs or kerbs on this path)
            </label>
            {campus?.geo ? (
              <div className="space-y-2">
                <div className="grid gap-2">
                  <Button className="!min-h-9 text-sm" disabled={!fromId || !toId || busy} onClick={() => void suggest()} data-testid="suggest-osm">
                    {busy ? "Asking OpenStreetMap…" : "Suggest from OpenStreetMap"}
                  </Button>
                  <Button className="!min-h-9 text-sm" onClick={() => { setDraft([]); setDrawing(true); }}>Trace by hand</Button>
                </div>
                {suggestNote ? <p className="text-xs text-muted" role="status">{suggestNote}</p> : null}
                <p className="text-sm">
                  Path length: <strong className="mono">{draftLen != null ? `${Math.round(draftLen)} m` : "not drawn"}</strong>
                  {draftLen != null && straight ? <span className="text-muted"> · straight line {Math.round(straight)} m</span> : null}
                </p>
                {draft.length ? <Button className="!min-h-8 text-xs" onClick={() => setDraft([])}>Clear path</Button> : null}
              </div>
            ) : null}
            {draft.length < 2 ? (
              <label className="block text-sm">
                Or length only (metres)
                <input className="cn-input w-full mt-1" type="number" min={1} value={typedM} onChange={(e) => setTypedM(e.target.value)} aria-label="Length in metres" />
                <span className="text-xs text-muted">Measured on site. Students will see a straight-line sketch for this walkway.</span>
              </label>
            ) : null}
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void save()}>{sel ? "Save changes" : "Add walkway"}</Button>
              {sel ? <Button onClick={() => void remove()}>Delete</Button> : null}
            </div>
          </fieldset>
          <p className="text-xs text-muted">Path data from OpenStreetMap is © OpenStreetMap contributors (ODbL). Check suggested paths on site — gates, fences and opening hours aren’t always mapped.</p>
        </aside>
      </div>
    </div>
  );
}
