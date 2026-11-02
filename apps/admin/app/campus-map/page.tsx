"use client";
import { useEffect, useMemo, useState } from "react";
import { lt, type Building, type Campus } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin, useTable } from "@/lib/admin";
import { CampusCanvas, prepareCampusImage, type Rect } from "@/components/CampusCanvas";
import { inputCls } from "@/components/Form";
import { Badge, Button, EmptyState, Notice, PageTitle, Spinner, cx } from "@/components/ui";

/**
 * Campus map editor: place every building on the campus overview by drawing
 * its footprint on top of an uploaded campus picture.
 */
export default function CampusMapPage() {
  const { universityId, can, bump, toast } = useAdmin();
  const { rows: campuses } = useTable<Campus>("campuses");
  const { rows: buildingRows } = useTable<Building>("buildings");
  const [campusId, setCampusId] = useState("");
  const [campus, setCampus] = useState<Campus | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [opacity, setOpacity] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const editable = can("building.manage");

  useEffect(() => {
    if (campuses?.length && !campusId) setCampusId(campuses[0]!.id);
  }, [campuses, campusId]);
  useEffect(() => {
    const c = campuses?.find((x) => x.id === campusId) ?? null;
    setCampus(c ? structuredClone(c) : null);
    setBuildings(structuredClone((buildingRows ?? []).filter((b) => b.campusId === campusId)));
    setSelected(null);
    setDrawMode(false);
  }, [campuses, buildingRows, campusId]);

  const original = useMemo(() => ({ campus: campuses?.find((x) => x.id === campusId) ?? null, buildings: (buildingRows ?? []).filter((b) => b.campusId === campusId) }), [campuses, buildingRows, campusId]);
  const changedBuildings = buildings.filter((b) => JSON.stringify(b.overview ?? null) !== JSON.stringify(original.buildings.find((o) => o.id === b.id)?.overview ?? null));
  const campusChanged = !!campus && JSON.stringify(campus) !== JSON.stringify(original.campus);
  const dirty = changedBuildings.length > 0 || campusChanged;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (!universityId) return null;
  if (!campuses || !buildingRows) return <Spinner label="Loading…" />;
  if (!campuses.length) return <EmptyState title="Create a campus first (Campuses)." />;

  const W = campus?.overviewWidth ?? 1000;
  const H = campus?.overviewHeight ?? 700;
  const sel = buildings.find((b) => b.id === selected);

  const setRect = (id: string, rect: Rect) => setBuildings((bs) => bs.map((b) => (b.id === id ? { ...b, overview: rect } : b)));

  const upload = async (file: File) => {
    if (!campus) return;
    setBusy(true);
    try {
      const img = await prepareCampusImage(file);
      const url = await getAdminSource().uploadCampusImage(universityId, campus.id, img.blob, "image/jpeg");
      // Keep the canvas width; match the picture's aspect ratio so it isn't distorted.
      const width = campus.overviewWidth ?? 1000;
      const height = Math.round((width * img.height) / img.width);
      setCampus({ ...campus, overviewImageUrl: url, overviewWidth: width, overviewHeight: height });
      toast("Picture added — press Save to publish it");
    } catch (e) {
      toast(e instanceof Error ? (e.message === "IMAGE_TOO_LARGE_FOR_SANDBOX" ? "Image too large for the local sandbox." : e.message) : String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!campus) return;
    setBusy(true);
    try {
      if (campusChanged) await getAdminSource().upsert("campuses", campus);
      if (changedBuildings.length) await getAdminSource().upsertMany("buildings", changedBuildings);
      toast(`Saved${changedBuildings.length ? ` ${changedBuildings.length} footprint(s)` : ""}`);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const placed = buildings.filter((b) => b.overview).length;

  return (
    <div>
      <PageTitle
        eyebrow={`${placed} / ${buildings.length} buildings placed`}
        actions={
          editable ? (
            <div className="flex items-center gap-2">
              {dirty ? <Badge tone="warn">unsaved</Badge> : <Badge>saved</Badge>}
              <Button onClick={() => { setCampus(original.campus ? structuredClone(original.campus) : null); setBuildings(structuredClone(original.buildings)); }} disabled={!dirty || busy}>Discard</Button>
              <Button variant="primary" onClick={() => void save()} disabled={!dirty || busy}>Save</Button>
            </div>
          ) : null
        }
      >
        Campus map
      </PageTitle>

      <div className="grid xl:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select aria-label="Campus" className={cx(inputCls, "!w-auto")} value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              {campuses.map((c) => <option key={c.id} value={c.id}>{lt(c.name, "en")}</option>)}
            </select>
            {editable ? (
              <label className="cn-btn cursor-pointer">
                {campus?.overviewImageUrl ? "Replace picture" : "Add campus picture"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Campus picture" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
              </label>
            ) : null}
            {campus?.overviewImageUrl && editable ? <Button onClick={() => setCampus({ ...campus, overviewImageUrl: null })}>Remove picture</Button> : null}
            {campus?.overviewImageUrl ? (
              <label className="flex items-center gap-2 text-xs text-muted ms-2">
                Picture
                <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="Picture opacity" />
              </label>
            ) : null}
          </div>
          <p className="text-xs text-muted mb-2">
            {drawMode && sel
              ? `Drag on the map to draw the outline of ${sel.code}.`
              : sel
                ? sel.overview
                  ? "Drag the building to move it, drag the square handles to resize. Drag empty space to pan, scroll to zoom."
                  : "This building isn't on the map yet — press “Draw footprint” and drag over it on the picture."
                : "Select a building on the map or in the list."}
          </p>
          <CampusCanvas
            width={W}
            height={H}
            imageUrl={campus?.overviewImageUrl}
            imageOpacity={opacity}
            buildings={buildings.map((b) => ({ id: b.id, code: b.code, name: lt(b.name, "en"), overview: b.overview ?? null }))}
            selectedId={selected}
            onSelect={setSelected}
            onChange={editable ? setRect : () => {}}
            drawMode={editable && drawMode}
            onDrawDone={() => setDrawMode(false)}
          />
          {!campus?.overviewImageUrl ? (
            <div className="mt-3">
              <Notice>
                Tip: add a picture of the campus — an aerial screenshot from a map service (check its terms of use) or the university&apos;s official campus plan — then trace each building over it.
              </Notice>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="cn-card p-3">
            <div className="label-caps mb-2">Buildings</div>
            {buildings.length === 0 ? <p className="text-sm text-muted">No buildings on this campus yet.</p> : null}
            <ul className="space-y-1 max-h-[44vh] overflow-auto">
              {buildings
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => { setSelected(b.id); setDrawMode(!b.overview && editable); }}
                      aria-pressed={selected === b.id}
                      className={cx("w-full text-start flex items-center gap-2 px-2 py-2 border-s-2", selected === b.id ? "border-accent bg-bg" : "border-transparent hover:bg-bg")}
                    >
                      <span className="mono text-xs w-20 truncate">{b.code}</span>
                      <span className="text-sm flex-1 truncate">{lt(b.name, "en")}</span>
                      {b.overview ? <Badge tone="accent">placed</Badge> : <Badge tone="warn">not placed</Badge>}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          {sel && editable ? (
            <div className="cn-card cn-card-accent p-3 space-y-2">
              <div className="label-caps">{sel.code}</div>
              <p className="text-sm">{lt(sel.name, "en")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant={drawMode ? "primary" : "secondary"} onClick={() => setDrawMode(!drawMode)} aria-pressed={drawMode}>
                  {sel.overview ? "Redraw footprint" : "Draw footprint"}
                </Button>
                {sel.overview ? <Button variant="danger" onClick={() => setBuildings((bs) => bs.map((b) => (b.id === sel.id ? { ...b, overview: null } : b)))}>Remove from map</Button> : null}
              </div>
              {sel.overview ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted">Exact position</summary>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {(["x", "y", "w", "h"] as const).map((k) => (
                      <label key={k} className="text-[10px] text-muted">
                        {k}
                        <input type="number" className={inputCls} value={sel.overview![k]} onChange={(e) => setRect(sel.id, { ...sel.overview!, [k]: Number(e.target.value) })} />
                      </label>
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs text-muted">Footprints are what students tap on the campus map to open a building. Indoor floor plans are edited in the Map editor.</p>
        </aside>
      </div>
    </div>
  );
}
