"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkSvg,
  fitViewBox,
  lt,
  planRoute,
  polygonPath,
  shapeCenter,
  validateMap,
  zoomAt,
  ROOM_TYPES,
  type Building,
  type CampusBundle,
  type Floor,
  type MapElement,
  type MapElementKind,
  type MapIssue,
  type NavEdge,
  type NavNode,
  type NavNodeKind,
  type Room,
  type RoomType,
  type ViewBox,
} from "@campusnav/core";
import { errorMessage, getAdminSource, newId, useAdmin } from "@/lib/admin";
import { useAdminBundle } from "@/lib/bundle";
import { inputCls } from "@/components/Form";
import { Badge, Button, ErrorState, Notice, PageTitle, Spinner, cx } from "@/components/ui";

type Tool = "select" | "room" | "area" | "node" | "edge";
type Sel = { type: "element" | "node" | "edge"; id: string } | null;

interface Work {
  elements: MapElement[];
  nodes: NavNode[];
  edges: NavEdge[];
  rooms: Room[];
  floors: Floor[];
}

const AREA_KINDS: MapElementKind[] = ["corridor", "stairs", "elevator", "toilet", "entrance", "emergency_exit", "wall", "outdoor"];
const NODE_KINDS: NavNodeKind[] = ["corridor", "room_entrance", "stairs", "elevator", "building_entrance", "checkpoint", "outdoor"];
const FILL: Record<string, string> = { room: "var(--cn-map-room)", corridor: "var(--cn-map-corridor)", stairs: "var(--cn-map-stairs)", elevator: "var(--cn-map-elevator)", toilet: "var(--cn-map-toilet)", entrance: "var(--cn-accent-soft)", emergency_exit: "color-mix(in srgb, var(--cn-danger) 20%, transparent)", wall: "var(--cn-border-strong)", outdoor: "transparent", building: "var(--cn-map-room)" };

function byId<T extends { id: string }>(a: T[]): Map<string, T> {
  return new Map(a.map((x) => [x.id, x]));
}

export default function MapEditorPage() {
  const { data, error } = useAdminBundle();
  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");
  useEffect(() => {
    if (data && !buildingId) {
      const b = data.bundle.buildings[0];
      if (b) setBuildingId(b.id);
    }
  }, [data, buildingId]);
  useEffect(() => {
    if (!data || !buildingId) return;
    const fs = data.bundle.floors.filter((f) => f.buildingId === buildingId).sort((a, b) => a.level - b.level);
    if (!fs.some((f) => f.id === floorId)) setFloorId(fs[0]?.id ?? "");
  }, [data, buildingId, floorId]);

  if (error) return <ErrorState title="Could not load" body={error} />;
  if (!data) return <Spinner label="Loading…" />;
  const b = data.bundle;
  const floors = b.floors.filter((f) => f.buildingId === buildingId).sort((x, y) => x.level - y.level);
  return (
    <div>
      <PageTitle eyebrow="Map assets and navigation graph stay in sync — every shape and node is a database record">Map editor</PageTitle>
      <div className="flex flex-wrap gap-2 mb-4">
        <select aria-label="Building" className={cx(inputCls, "w-auto")} value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
          {b.buildings.map((x) => <option key={x.id} value={x.id}>{x.code} — {lt(x.name, "en")}</option>)}
        </select>
        <div className="flex border border-line-strong" role="tablist" aria-label="Floor">
          {floors.map((f) => (
            <button key={f.id} role="tab" aria-selected={f.id === floorId} onClick={() => setFloorId(f.id)} className={cx("min-h-10 px-3 mono text-sm", f.id === floorId ? "bg-accent text-accent-fg" : "text-muted")}>
              L{f.level}
            </button>
          ))}
        </div>
      </div>
      {!buildingId || floors.length === 0 ? (
        <Notice tone="warn">Create a building and at least one floor first (Buildings → Floors).</Notice>
      ) : (
        <Editor key={buildingId} bundle={b} building={b.buildings.find((x) => x.id === buildingId)!} floorId={floorId} setFloorId={setFloorId} checkpoints={data.checkpoints.map(({ id, nodeId }) => ({ id, nodeId }))} />
      )}
    </div>
  );
}

function Editor({ bundle, building, floorId, setFloorId, checkpoints }: { bundle: CampusBundle; building: Building; floorId: string; setFloorId: (id: string) => void; checkpoints: { id: string; nodeId: string }[] }) {
  const { universityId, bump, toast, can } = useAdmin();
  const uid = universityId!;
  const initial = useMemo<Work>(() => {
    const floors = bundle.floors.filter((f) => f.buildingId === building.id);
    const fids = new Set(floors.map((f) => f.id));
    const nodes = bundle.navNodes.filter((n) => fids.has(n.floorId));
    const nids = new Set(nodes.map((n) => n.id));
    return {
      floors,
      nodes,
      elements: bundle.mapElements.filter((e) => fids.has(e.floorId)),
      // Edges touching this building (including outdoor links to other buildings)
      edges: bundle.navEdges.filter((e) => nids.has(e.fromNodeId) || nids.has(e.toNodeId)),
      rooms: bundle.rooms.filter((r) => r.buildingId === building.id),
    };
  }, [bundle, building.id]);
  const [work, setWork] = useState<Work>(() => structuredClone(initial));
  const [tool, setTool] = useState<Tool>("select");
  const [areaKind, setAreaKind] = useState<MapElementKind>("corridor");
  const [nodeKind, setNodeKind] = useState<NavNodeKind>("corridor");
  const [sel, setSel] = useState<Sel>(null);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [preview, setPreview] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<MapIssue[] | null>(null);

  const floor = work.floors.find((f) => f.id === floorId) ?? work.floors[0]!;
  const base = useMemo(() => fitViewBox(floor.width, floor.height), [floor.width, floor.height]);
  const [vb, setVb] = useState<ViewBox>(base);
  useEffect(() => setVb(base), [base]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "pan" | "node" | "element" | "draw"; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const dirty = JSON.stringify(work) !== JSON.stringify(initial);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const nodeMap = useMemo(() => byId(work.nodes), [work.nodes]);
  const roomMap = useMemo(() => byId(work.rooms), [work.rooms]);
  const floorNodes = work.nodes.filter((n) => n.floorId === floor.id);
  const floorElements = work.elements.filter((e) => e.floorId === floor.id);
  const sn = (v: number) => (snap ? Math.round(v / 10) * 10 : Math.round(v * 10) / 10);

  const toMap = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e);
      setVb((v) => zoomAt(v, e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y, base));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toMap, base]);

  const update = (fn: (w: Work) => Work) => setWork((w) => fn(structuredClone(w)));

  const addEdge = (a: string, b: string) => {
    if (a === b) return;
    if (work.edges.some((e) => (e.fromNodeId === a && e.toNodeId === b) || (e.fromNodeId === b && e.toNodeId === a))) return toast("These nodes are already connected", "error");
    const na = nodeMap.get(a)!;
    const nb = nodeMap.get(b)!;
    const kind = na.kind === "room_entrance" || nb.kind === "room_entrance" ? "door" : "corridor";
    const edge: NavEdge = { id: newId(), universityId: uid, fromNodeId: a, toNodeId: b, kind, distanceM: null, accessible: true, bidirectional: true, blocked: false, restriction: null };
    update((w) => ({ ...w, edges: [...w.edges, edge] }));
    setSel({ type: "edge", id: edge.id });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toMap(e);
    const target = (e.target as Element).closest("[data-kind]") as HTMLElement | null;
    const tk = target?.dataset.kind;
    const tid = target?.dataset.id;
    if (tool === "select") {
      if (tk === "node" && tid) {
        const n = nodeMap.get(tid)!;
        drag.current = { kind: "node", id: tid, sx: p.x, sy: p.y, ox: n.x, oy: n.y, moved: false };
        setSel({ type: "node", id: tid });
      } else if (tk === "edge" && tid) {
        setSel({ type: "edge", id: tid });
      } else if (tk === "element" && tid) {
        const el = work.elements.find((x) => x.id === tid)!;
        const c = el.shape.type === "rect" ? { x: el.shape.x, y: el.shape.y } : { x: 0, y: 0 };
        drag.current = { kind: "element", id: tid, sx: p.x, sy: p.y, ox: c.x, oy: c.y, moved: false };
        setSel({ type: "element", id: tid });
      } else {
        drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: vb.x, oy: vb.y, moved: false };
        setSel(null);
      }
    } else if (tool === "room" || tool === "area") {
      drag.current = { kind: "draw", sx: sn(p.x), sy: sn(p.y), ox: 0, oy: 0, moved: false };
      setDraft({ x0: sn(p.x), y0: sn(p.y), x1: sn(p.x), y1: sn(p.y) });
    } else if (tool === "node") {
      const n: NavNode = { id: newId(), universityId: uid, floorId: floor.id, x: sn(p.x), y: sn(p.y), kind: nodeKind, label: null, verticalGroup: null };
      update((w) => ({ ...w, nodes: [...w.nodes, n] }));
      setSel({ type: "node", id: n.id });
      // Chain: connect consecutive corridor nodes automatically if one is selected and the shift key is held.
      if (e.shiftKey && sel?.type === "node") addEdge(sel.id, n.id);
    } else if (tool === "edge") {
      if (tk === "node" && tid) {
        if (!edgeStart) setEdgeStart(tid);
        else {
          addEdge(edgeStart, tid);
          setEdgeStart(e.shiftKey ? tid : null);
        }
      } else setEdgeStart(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const svg = svgRef.current!;
      const r = svg.getBoundingClientRect();
      const s = Math.min(r.width / vb.w, r.height / vb.h);
      setVb((v) => ({ ...v, x: d.ox - (e.clientX - d.sx) / s, y: d.oy - (e.clientY - d.sy) / s }));
      return;
    }
    const p = toMap(e);
    d.moved = true;
    if (d.kind === "node") update((w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === d.id ? { ...n, x: sn(d.ox + p.x - d.sx), y: sn(d.oy + p.y - d.sy) } : n)) }));
    else if (d.kind === "element")
      update((w) => ({ ...w, elements: w.elements.map((el) => (el.id === d.id && el.shape.type === "rect" ? { ...el, shape: { ...el.shape, x: sn(d.ox + p.x - d.sx), y: sn(d.oy + p.y - d.sy) } } : el)) }));
    else if (d.kind === "draw") setDraft((dr) => (dr ? { ...dr, x1: sn(p.x), y1: sn(p.y) } : dr));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "draw" && draft) {
      const x = Math.min(draft.x0, draft.x1);
      const y = Math.min(draft.y0, draft.y1);
      const w = Math.abs(draft.x1 - draft.x0);
      const h = Math.abs(draft.y1 - draft.y0);
      setDraft(null);
      if (w < 5 || h < 5) return;
      const el: MapElement = { id: newId(), universityId: uid, floorId: floor.id, kind: tool === "room" ? "room" : areaKind, shape: { type: "rect", x, y, w, h }, label: null, roomId: null };
      update((wk) => ({ ...wk, elements: [...wk.elements, el] }));
      setSel({ type: "element", id: el.id });
      setTool("select");
    }
  };

  const deleteSel = useCallback(() => {
    if (!sel) return;
    update((w) => {
      if (sel.type === "node") {
        return { ...w, nodes: w.nodes.filter((n) => n.id !== sel.id), edges: w.edges.filter((e) => e.fromNodeId !== sel.id && e.toNodeId !== sel.id), rooms: w.rooms.map((r) => (r.entranceNodeId === sel.id ? { ...r, entranceNodeId: null } : r)) };
      }
      if (sel.type === "edge") return { ...w, edges: w.edges.filter((e) => e.id !== sel.id) };
      return { ...w, elements: w.elements.filter((e) => e.id !== sel.id) };
    });
    setSel(null);
  }, [sel]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,select,textarea")) return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSel();
      if (e.key === "Escape") {
        setSel(null);
        setEdgeStart(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [deleteSel]);

  const workBundle = useMemo<CampusBundle>(() => ({ ...bundle, floors: bundle.floors.map((f) => work.floors.find((x) => x.id === f.id) ?? f), navNodes: [...bundle.navNodes.filter((n) => !initial.nodes.some((x) => x.id === n.id)), ...work.nodes], navEdges: [...bundle.navEdges.filter((e) => !initial.edges.some((x) => x.id === e.id)), ...work.edges], rooms: [...bundle.rooms.filter((r) => r.buildingId !== building.id), ...work.rooms] }), [bundle, work, initial, building.id]);

  const route = useMemo(() => {
    if (!preview.from || !preview.to) return null;
    const a = roomMap.get(preview.from)?.entranceNodeId;
    const z = roomMap.get(preview.to)?.entranceNodeId;
    if (!a || !z) return { error: "Both rooms need an entrance node." };
    const r = planRoute(workBundle, a, z);
    return r.ok ? { route: r.plan.route } : { error: `No route (${r.error.code})` };
  }, [preview, roomMap, workBundle]);

  const validate = () => {
    const res = validateMap({ floors: work.floors, rooms: work.rooms, mapElements: work.elements, navNodes: [...work.nodes, ...workBundle.navNodes.filter((n) => !nodeMap.has(n.id) && work.edges.some((e) => e.fromNodeId === n.id || e.toNodeId === n.id))], navEdges: work.edges, checkpoints: checkpoints.filter((c) => nodeMap.has(c.nodeId)) });
    setIssues(res);
    return res;
  };

  const save = async () => {
    const res = validate();
    const errs = res.filter((i) => i.severity === "error");
    if (errs.length && !window.confirm(`${errs.length} validation error(s) remain. Students may get incomplete routes. Save anyway?`)) return;
    setSaving(true);
    const src = getAdminSource();
    try {
      const changed = <T extends { id: string }>(cur: T[], orig: T[]) => {
        const o = byId(orig);
        return cur.filter((x) => JSON.stringify(x) !== JSON.stringify(o.get(x.id)));
      };
      const removed = <T extends { id: string }>(cur: T[], orig: T[]) => {
        const c = new Set(cur.map((x) => x.id));
        return orig.filter((x) => !c.has(x.id));
      };
      // Order: floors → nodes → edges → rooms → elements; deletions in reverse.
      await src.upsertMany("floors", changed(work.floors, initial.floors));
      await src.upsertMany("navigation_nodes", changed(work.nodes, initial.nodes));
      await src.upsertMany("navigation_edges", changed(work.edges, initial.edges));
      await src.upsertMany("rooms", changed(work.rooms, initial.rooms));
      await src.upsertMany("map_elements", changed(work.elements, initial.elements));
      for (const x of removed(work.elements, initial.elements)) await src.remove("map_elements", x.id);
      for (const x of removed(work.edges, initial.edges)) await src.remove("navigation_edges", x.id);
      for (const x of removed(work.nodes, initial.nodes)) await src.remove("navigation_nodes", x.id);
      toast("Map saved");
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const uploadPlan = async (file: File) => {
    const text = await file.text();
    const check = checkSvg(text);
    if (!check.ok) return toast(`SVG rejected: ${check.reason.replace(/_/g, " ")}`, "error");
    try {
      const url = await getAdminSource().uploadFloorPlan(uid, floor.id, new Blob([check.svg], { type: "image/svg+xml" }), "image/svg+xml");
      update((w) => ({ ...w, floors: w.floors.map((f) => (f.id === floor.id ? { ...f, planAssetUrl: url, ...(check.width && check.height ? { width: check.width, height: check.height } : {}) } : f)) }));
      toast("Floor plan uploaded — save to publish");
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  };

  const unit = vb.w / 100;
  const selected = sel?.type === "element" ? work.elements.find((x) => x.id === sel.id) : undefined;
  const selNode = sel?.type === "node" ? nodeMap.get(sel.id) : undefined;
  const selEdge = sel?.type === "edge" ? work.edges.find((x) => x.id === sel.id) : undefined;
  const routeNodes = route && "route" in route ? route.route!.nodes.filter((n) => n.floorId === floor.id) : [];
  const editable = can("map.edit");

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-1 mb-2" role="toolbar" aria-label="Map tools">
          {(
            [
              ["select", "Select / move"],
              ["room", "Draw room"],
              ["area", "Draw area"],
              ["node", "Add node"],
              ["edge", "Connect nodes"],
            ] as [Tool, string][]
          ).map(([t, label]) => (
            <button key={t} disabled={!editable && t !== "select"} aria-pressed={tool === t} onClick={() => { setTool(t); setEdgeStart(null); }} className={cx("min-h-10 px-3 text-sm border", tool === t ? "border-accent text-accent" : "border-line-strong text-muted")}>
              {label}
            </button>
          ))}
          {tool === "area" ? (
            <select aria-label="Area kind" className={cx(inputCls, "w-auto")} value={areaKind} onChange={(e) => setAreaKind(e.target.value as MapElementKind)}>
              {AREA_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          ) : null}
          {tool === "node" ? (
            <select aria-label="Node kind" className={cx(inputCls, "w-auto")} value={nodeKind} onChange={(e) => setNodeKind(e.target.value as NavNodeKind)}>
              {NODE_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
          ) : null}
          <label className="flex items-center gap-1 text-xs ms-2"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> snap 10</label>
          <span className="flex-1" />
          <Button onClick={() => setVb(base)}>Reset view</Button>
        </div>
        <p className="text-xs text-muted mb-2">
          {tool === "edge" ? (edgeStart ? "Click the second node (hold Shift to keep chaining)." : "Click the first node.") : tool === "node" ? "Click to place a node. Shift+click connects it to the selected node." : tool === "select" ? "Drag nodes/rects to move. Drag empty space to pan, wheel to zoom. Delete removes the selection." : "Drag to draw."}
        </p>
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-[68vh] bg-[var(--cn-map-bg)] border border-line touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="application"
          aria-label={`Floor editor ${lt(floor.name, "en")}`}
        >
          <defs>
            <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="var(--cn-border)" strokeWidth={0.5} /></pattern>
          </defs>
          <rect x={0} y={0} width={floor.width} height={floor.height} fill="url(#grid)" stroke="var(--cn-border-strong)" />
          {floor.planAssetUrl ? <image href={floor.planAssetUrl} x={0} y={0} width={floor.width} height={floor.height} opacity={0.6} pointerEvents="none" /> : null}
          {floorElements.map((el) => {
            const isSel = sel?.type === "element" && sel.id === el.id;
            const room = el.roomId ? roomMap.get(el.roomId) : undefined;
            const c = shapeCenter(el.shape);
            const props = { fill: FILL[el.kind] ?? "var(--cn-map-room)", stroke: isSel ? "var(--cn-accent)" : el.kind === "room" && !room ? "var(--cn-warning)" : "var(--cn-map-room-stroke)", strokeWidth: isSel ? 3 : 1.5, vectorEffect: "non-scaling-stroke" as const };
            return (
              <g key={el.id} data-kind="element" data-id={el.id} style={{ cursor: tool === "select" ? "move" : "crosshair" }}>
                {el.shape.type === "rect" ? <rect x={el.shape.x} y={el.shape.y} width={el.shape.w} height={el.shape.h} {...props} /> : <path d={polygonPath(el.shape.points)} {...props} />}
                <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(12, unit * 1.8)} fill="var(--cn-text-muted)" fontFamily="IBM Plex Mono" pointerEvents="none">
                  {room?.code ?? (el.kind === "room" ? "?" : el.kind)}
                </text>
              </g>
            );
          })}
          {work.edges.map((e) => {
            const a = nodeMap.get(e.fromNodeId);
            const z = nodeMap.get(e.toNodeId);
            if (!a || !z) return null;
            const sameFloor = a.floorId === floor.id && z.floorId === floor.id;
            if (!sameFloor) return null;
            const isSel = sel?.type === "edge" && sel.id === e.id;
            return (
              <g key={e.id} data-kind="edge" data-id={e.id} style={{ cursor: "pointer" }}>
                <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="transparent" strokeWidth={unit * 1.5} />
                <line x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke={e.blocked ? "var(--cn-danger)" : isSel ? "var(--cn-accent)" : e.kind === "door" ? "var(--cn-info)" : "var(--cn-text-faint)"} strokeWidth={isSel ? 3 : 2} strokeDasharray={e.accessible ? undefined : "6 4"} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              </g>
            );
          })}
          {routeNodes.length > 1 ? <polyline points={routeNodes.map((n) => `${n.x},${n.y}`).join(" ")} fill="none" stroke="var(--cn-map-route)" strokeWidth={unit * 0.8} pointerEvents="none" /> : null}
          {floorNodes.map((n) => {
            const isSel = sel?.type === "node" && sel.id === n.id;
            const vertical = work.edges.some((e) => (e.fromNodeId === n.id || e.toNodeId === n.id) && nodeMap.get(e.fromNodeId === n.id ? e.toNodeId : e.fromNodeId)?.floorId !== n.floorId);
            const r = unit * (n.kind === "corridor" ? 0.7 : 1);
            const color = n.kind === "room_entrance" ? "var(--cn-info)" : n.kind === "stairs" || n.kind === "elevator" ? "var(--cn-warning)" : n.kind === "building_entrance" ? "var(--cn-accent)" : n.kind === "checkpoint" ? "var(--cn-info)" : "var(--cn-text)";
            return (
              <g key={n.id} data-kind="node" data-id={n.id} style={{ cursor: tool === "edge" ? "pointer" : "move" }}>
                <circle cx={n.x} cy={n.y} r={r * 1.8} fill="transparent" />
                <circle cx={n.x} cy={n.y} r={r} fill={color} stroke={isSel || edgeStart === n.id ? "var(--cn-accent)" : "var(--cn-bg)"} strokeWidth={isSel || edgeStart === n.id ? 3 : 1} vectorEffect="non-scaling-stroke" />
                {vertical ? <circle cx={n.x} cy={n.y} r={r * 1.6} fill="none" stroke="var(--cn-warning)" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null}
              </g>
            );
          })}
          {draft ? <rect x={Math.min(draft.x0, draft.x1)} y={Math.min(draft.y0, draft.y1)} width={Math.abs(draft.x1 - draft.x0)} height={Math.abs(draft.y1 - draft.y0)} fill="color-mix(in srgb, var(--cn-accent) 15%, transparent)" stroke="var(--cn-accent)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        <div className="flex flex-wrap gap-3 text-xs text-muted mt-2">
          <span><span className="text-info">●</span> entrance/door</span>
          <span><span className="text-warn">●</span> stairs/elevator (ring = linked to another floor)</span>
          <span><span className="text-accent">●</span> building entrance</span>
          <span>– – not step-free</span>
          <span className="text-danger">— blocked</span>
          <span className="text-warn">? room shape not linked to a room record</span>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="border border-line p-3 flex flex-wrap gap-2 items-center">
          <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving || !editable}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button onClick={() => { setWork(structuredClone(initial)); setSel(null); }} disabled={!dirty}>Discard</Button>
          <Button onClick={validate}>Validate</Button>
          {dirty ? <Badge tone="warn">unsaved</Badge> : <Badge>saved</Badge>}
        </div>

        <div className="border border-line p-3">
          <div className="label-caps mb-2">Floor plan (SVG)</div>
          <input type="file" accept="image/svg+xml,.svg" aria-label="Upload SVG floor plan" className="text-xs" disabled={!editable} onChange={(e) => e.target.files?.[0] && void uploadPlan(e.target.files[0])} />
          <p className="text-xs text-muted mt-1">Max 2 MB. Files with scripts, event handlers or external references are rejected. Use official, verified plans only.</p>
          {floor.planAssetUrl ? <button className="text-xs underline mt-1" onClick={() => update((w) => ({ ...w, floors: w.floors.map((f) => (f.id === floor.id ? { ...f, planAssetUrl: null } : f)) }))}>Remove plan</button> : null}
        </div>

        {selected ? <ElementPanel el={selected} work={work} floor={floor} building={building} uid={uid} update={update} onDelete={deleteSel} /> : null}
        {selNode ? <NodePanel node={selNode} work={work} building={building} update={update} onDelete={deleteSel} setFloorId={setFloorId} uid={uid} /> : null}
        {selEdge ? <EdgePanel edge={selEdge} update={update} onDelete={deleteSel} nodes={nodeMap} /> : null}

        <div className="border border-line p-3">
          <div className="label-caps mb-2">Preview student route</div>
          <select aria-label="From room" className={cx(inputCls, "mb-1")} value={preview.from} onChange={(e) => setPreview({ ...preview, from: e.target.value })}>
            <option value="">From room…</option>
            {work.rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
          </select>
          <select aria-label="To room" className={inputCls} value={preview.to} onChange={(e) => setPreview({ ...preview, to: e.target.value })}>
            <option value="">To room…</option>
            {work.rooms.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
          </select>
          {route ? ("error" in route ? <p className="text-danger text-xs mt-2">{route.error}</p> : <p className="text-xs mt-2">Route: {route.route!.legs.length} legs, {Math.round(route.route!.distanceM)} m across {route.route!.floorSequence.length} floor(s). Switch floors to follow it.</p>) : null}
        </div>

        {issues ? (
          <div className="border border-line p-3">
            <div className="label-caps mb-2">Validation ({issues.length})</div>
            {issues.length === 0 ? <p className="text-sm text-accent">No issues found.</p> : (
              <ul className="space-y-1 max-h-72 overflow-auto">
                {issues.map((i, n) => (
                  <li key={n}>
                    <button className="text-start text-xs w-full hover:underline" onClick={() => {
                      if (i.floorId) setFloorId(i.floorId);
                      if (nodeMap.has(i.refId)) setSel({ type: "node", id: i.refId });
                      else if (work.edges.some((e) => e.id === i.refId)) setSel({ type: "edge", id: i.refId });
                      else {
                        const el = work.elements.find((e) => e.id === i.refId || e.roomId === i.refId);
                        if (el) setSel({ type: "element", id: el.id });
                      }
                    }}>
                      <Badge tone={i.severity === "error" ? "danger" : "warn"}>{i.code}</Badge> <span className="mono">{roomMap.get(i.refId)?.code ?? i.refId.slice(0, 8)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

type Upd = (fn: (w: Work) => Work) => void;

function ElementPanel({ el, work, floor, building, uid, update, onDelete }: { el: MapElement; work: Work; floor: Floor; building: Building; uid: string; update: Upd; onDelete: () => void }) {
  const room = el.roomId ? work.rooms.find((r) => r.id === el.roomId) : undefined;
  const [code, setCode] = useState("");
  const [type, setType] = useState<RoomType>("classroom");
  const setEl = (p: Partial<MapElement>) => update((w) => ({ ...w, elements: w.elements.map((x) => (x.id === el.id ? { ...x, ...p } : x)) }));
  const setRoom = (p: Partial<Room>) => update((w) => ({ ...w, rooms: w.rooms.map((r) => (r.id === room!.id ? { ...r, ...p } : r)) }));
  const floorEntrances = work.nodes.filter((n) => n.floorId === floor.id && (n.kind === "room_entrance" || n.kind === "corridor"));
  return (
    <div className="border border-accent p-3 space-y-2">
      <div className="label-caps">Shape · {el.kind}</div>
      <select aria-label="Shape kind" className={inputCls} value={el.kind} onChange={(e) => setEl({ kind: e.target.value as MapElementKind })}>
        {["room", ...AREA_KINDS].map((k) => <option key={k}>{k}</option>)}
      </select>
      {el.shape.type === "rect" ? (
        <div className="grid grid-cols-4 gap-1">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <input key={k} aria-label={k} type="number" className={inputCls} value={el.shape.type === "rect" ? el.shape[k] : 0} onChange={(e) => el.shape.type === "rect" && setEl({ shape: { ...el.shape, [k]: Number(e.target.value) } })} />
          ))}
        </div>
      ) : null}
      {el.kind === "room" ? (
        room ? (
          <div className="space-y-2 border-t border-line pt-2">
            <div className="text-sm">Linked room <span className="mono">{room.code}</span> — {lt(room.name, "en")}</div>
            <label className="text-xs block">Entrance node (route destination)
              <select className={inputCls} value={room.entranceNodeId ?? ""} onChange={(e) => setRoom({ entranceNodeId: e.target.value || null })}>
                <option value="">— none (not navigable) —</option>
                {floorEntrances.map((n) => <option key={n.id} value={n.id}>{n.kind} @ {Math.round(n.x)},{Math.round(n.y)}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={room.accessible} onChange={(e) => setRoom({ accessible: e.target.checked })} /> step-free access</label>
            <button className="text-xs underline" onClick={() => setEl({ roomId: null })}>Unlink</button>
          </div>
        ) : (
          <div className="space-y-2 border-t border-line pt-2">
            <label className="text-xs block">Link existing room
              <select className={inputCls} value="" onChange={(e) => e.target.value && setEl({ roomId: e.target.value })}>
                <option value="">Select…</option>
                {work.rooms.filter((r) => r.floorId === floor.id && !work.elements.some((x) => x.roomId === r.id)).map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            </label>
            <div className="text-xs">…or create a new room record:</div>
            <div className="flex gap-1">
              <input aria-label="New room code" placeholder="Code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} />
              <select aria-label="New room type" className={inputCls} value={type} onChange={(e) => setType(e.target.value as RoomType)}>
                {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <Button disabled={!code.trim() || work.rooms.some((r) => r.code.toLowerCase() === code.trim().toLowerCase())} onClick={() => {
              const id = newId();
              // Auto-pick the nearest room_entrance node within 60 units of the shape.
              const c = shapeCenter(el.shape);
              const near = work.nodes.filter((n) => n.floorId === floor.id && n.kind === "room_entrance").sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
              const half = el.shape.type === "rect" ? Math.max(el.shape.w, el.shape.h) / 2 + 60 : 200;
              const r: Room = { id, universityId: uid, buildingId: building.id, floorId: floor.id, code: code.trim(), name: { en: code.trim() }, type, departmentId: null, capacity: null, entranceNodeId: near && Math.hypot(near.x - c.x, near.y - c.y) < half ? near.id : null, accessible: true, dataStatus: "unverified" };
              update((w) => ({ ...w, rooms: [...w.rooms, r], elements: w.elements.map((x) => (x.id === el.id ? { ...x, roomId: id } : x)) }));
              setCode("");
            }}>Create & link</Button>
            <p className="text-xs text-muted">Add names in all languages later on the Rooms page.</p>
          </div>
        )
      ) : null}
      <Button variant="danger" onClick={onDelete}>Delete shape</Button>
    </div>
  );
}

function NodePanel({ node, work, building, update, onDelete, setFloorId, uid }: { node: NavNode; work: Work; building: Building; update: Upd; onDelete: () => void; setFloorId: (id: string) => void; uid: string }) {
  const setN = (p: Partial<NavNode>) => update((w) => ({ ...w, nodes: w.nodes.map((x) => (x.id === node.id ? { ...x, ...p } : x)) }));
  const [target, setTarget] = useState("");
  const [dist, setDist] = useState("");
  const vertical = node.kind === "stairs" || node.kind === "elevator";
  const floorOf = new Map(work.floors.map((f) => [f.id, f]));
  const candidates = work.nodes.filter((n) => n.floorId !== node.floorId && n.kind === node.kind);
  const links = work.edges.filter((e) => (e.fromNodeId === node.id || e.toNodeId === node.id)).map((e) => ({ e, other: work.nodes.find((n) => n.id === (e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId)) }));
  return (
    <div className="border border-accent p-3 space-y-2">
      <div className="label-caps">Navigation node</div>
      <select aria-label="Node kind" className={inputCls} value={node.kind} onChange={(e) => setN({ kind: e.target.value as NavNodeKind })}>
        {NODE_KINDS.map((k) => <option key={k}>{k}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input aria-label="x" type="number" className={inputCls} value={node.x} onChange={(e) => setN({ x: Number(e.target.value) })} />
        <input aria-label="y" type="number" className={inputCls} value={node.y} onChange={(e) => setN({ y: Number(e.target.value) })} />
      </div>
      <input aria-label="Label (English)" placeholder="Label (e.g. Main entrance)" className={inputCls} value={node.label?.en ?? ""} onChange={(e) => setN({ label: e.target.value ? { ...(node.label ?? {}), en: e.target.value } : null })} />
      <div className="text-xs text-muted">{links.length} connection(s){links.some((l) => l.other && l.other.floorId !== node.floorId) ? " · includes other floors" : ""}</div>
      <ul className="text-xs space-y-0.5">
        {links.filter((l) => l.other && l.other.floorId !== node.floorId).map((l) => (
          <li key={l.e.id}><button className="underline" onClick={() => setFloorId(l.other!.floorId)}>→ L{floorOf.get(l.other!.floorId)?.level ?? "?"} ({l.e.kind}, {l.e.distanceM ?? "?"} m)</button></li>
        ))}
      </ul>
      {vertical ? (
        <div className="border-t border-line pt-2 space-y-1">
          <div className="text-xs">Connect to the same {node.kind} on another floor of {building.code}:</div>
          <select aria-label="Target node" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Select…</option>
            {candidates.map((n) => <option key={n.id} value={n.id}>L{floorOf.get(n.floorId)?.level} · {n.kind} @ {Math.round(n.x)},{Math.round(n.y)}</option>)}
          </select>
          <input aria-label="Walking distance (m)" type="number" placeholder={node.kind === "elevator" ? "Distance m (0 for elevator)" : "Measured stair length (m)"} className={inputCls} value={dist} onChange={(e) => setDist(e.target.value)} />
          <Button disabled={!target || dist === ""} onClick={() => {
            const e: NavEdge = { id: newId(), universityId: uid, fromNodeId: node.id, toNodeId: target, kind: node.kind === "elevator" ? "elevator" : "stairs", distanceM: Number(dist), accessible: node.kind === "elevator", bidirectional: true, blocked: false, restriction: null };
            update((w) => ({ ...w, edges: [...w.edges, e] }));
            setTarget("");
            setDist("");
          }}>Add floor connection</Button>
          <p className="text-xs text-muted">Floor-to-floor distances must be measured; they are never inferred.</p>
        </div>
      ) : null}
      <Button variant="danger" onClick={onDelete}>Delete node</Button>
    </div>
  );
}

function EdgePanel({ edge, update, onDelete, nodes }: { edge: NavEdge; update: Upd; onDelete: () => void; nodes: Map<string, NavNode> }) {
  const setE = (p: Partial<NavEdge>) => update((w) => ({ ...w, edges: w.edges.map((x) => (x.id === edge.id ? { ...x, ...p } : x)) }));
  const a = nodes.get(edge.fromNodeId);
  const z = nodes.get(edge.toNodeId);
  return (
    <div className="border border-accent p-3 space-y-2">
      <div className="label-caps">Connection</div>
      <select aria-label="Edge kind" className={inputCls} value={edge.kind} onChange={(e) => setE({ kind: e.target.value as NavEdge["kind"] })}>
        {["corridor", "door", "stairs", "elevator", "ramp", "outdoor"].map((k) => <option key={k}>{k}</option>)}
      </select>
      <label className="text-xs block">Distance override (m) — empty = computed from map scale
        <input type="number" className={inputCls} value={edge.distanceM ?? ""} onChange={(e) => setE({ distanceM: e.target.value === "" ? null : Number(e.target.value) })} />
      </label>
      {a && z && a.floorId !== z.floorId && edge.distanceM == null ? <p className="text-xs text-danger">Cross-floor connections need a measured distance.</p> : null}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edge.accessible} onChange={(e) => setE({ accessible: e.target.checked })} /> Step-free / accessible</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edge.bidirectional} onChange={(e) => setE({ bidirectional: e.target.checked })} /> Two-way</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edge.blocked} onChange={(e) => setE({ blocked: e.target.checked })} /> Blocked (closed for works etc.)</label>
      <label className="text-xs block">Restriction (e.g. staff_only) — routes avoid it
        <input className={inputCls} value={edge.restriction ?? ""} onChange={(e) => setE({ restriction: e.target.value.trim() || null })} />
      </label>
      <Button variant="danger" onClick={onDelete}>Delete connection</Button>
    </div>
  );
}
