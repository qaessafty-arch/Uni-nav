"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fitViewBox, zoomAt, type ViewBox } from "@campusnav/core";
import { Button, cx } from "./ui";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasBuilding {
  id: string;
  code: string;
  name: string;
  overview?: Rect | null;
}

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

interface Props {
  width: number;
  height: number;
  imageUrl?: string | null;
  imageOpacity?: number;
  buildings: CanvasBuilding[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called while dragging/drawing with the new footprint of the selected building. */
  onChange: (id: string, rect: Rect) => void;
  /** When true, dragging on empty space draws the selected building's footprint. */
  drawMode: boolean;
  onDrawDone?: () => void;
  className?: string;
  height_?: string;
}

const MIN = 10;
const SNAP = 5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/**
 * Campus overview editor: building footprints over an optional campus picture.
 * Click to select; drag to move; drag a handle to resize; in draw mode drag on
 * the canvas to draw the selected building's footprint. Wheel/buttons zoom,
 * drag on empty space pans.
 */
export function CampusCanvas(p: Props) {
  const base = useMemo(() => fitViewBox(p.width, p.height, 0.03), [p.width, p.height]);
  const [vb, setVb] = useState<ViewBox>(base);
  useEffect(() => setVb(base), [base]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<
    | { kind: "pan"; sx: number; sy: number; vb: ViewBox }
    | { kind: "move"; id: string; sx: number; sy: number; orig: Rect }
    | { kind: "resize"; id: string; handle: Handle; orig: Rect }
    | { kind: "draw"; id: string; x0: number; y0: number }
    | null
  >(null);

  const toMap = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = toMap(e);
      setVb((v) => zoomAt(v, e.deltaY < 0 ? 1.15 : 1 / 1.15, m.x, m.y, base));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toMap, base]);

  const clamp = (r: Rect): Rect => {
    const w = Math.max(MIN, Math.min(r.w, p.width));
    const h = Math.max(MIN, Math.min(r.h, p.height));
    return { x: Math.max(0, Math.min(r.x, p.width - w)), y: Math.max(0, Math.min(r.y, p.height - h)), w, h };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const m = toMap(e);
    const el = (e.target as Element).closest("[data-b],[data-h]") as HTMLElement | null;
    const handle = el?.dataset.h as Handle | undefined;
    const bid = el?.dataset.b;
    const sel = p.buildings.find((b) => b.id === p.selectedId);
    if (handle && sel?.overview) {
      drag.current = { kind: "resize", id: sel.id, handle, orig: sel.overview };
      return;
    }
    if (p.drawMode && p.selectedId) {
      drag.current = { kind: "draw", id: p.selectedId, x0: snap(m.x), y0: snap(m.y) };
      p.onChange(p.selectedId, clamp({ x: snap(m.x), y: snap(m.y), w: MIN, h: MIN }));
      return;
    }
    if (bid) {
      p.onSelect(bid);
      const b = p.buildings.find((x) => x.id === bid);
      if (b?.overview) drag.current = { kind: "move", id: bid, sx: m.x, sy: m.y, orig: b.overview };
      return;
    }
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, vb };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const r = svgRef.current!.getBoundingClientRect();
      const s = Math.min(r.width / d.vb.w, r.height / d.vb.h);
      setVb({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) / s, y: d.vb.y - (e.clientY - d.sy) / s });
      return;
    }
    const m = toMap(e);
    if (d.kind === "move") {
      p.onChange(d.id, clamp({ ...d.orig, x: snap(d.orig.x + m.x - d.sx), y: snap(d.orig.y + m.y - d.sy) }));
    } else if (d.kind === "draw") {
      const x1 = snap(m.x);
      const y1 = snap(m.y);
      p.onChange(d.id, clamp({ x: Math.min(d.x0, x1), y: Math.min(d.y0, y1), w: Math.abs(x1 - d.x0), h: Math.abs(y1 - d.y0) }));
    } else if (d.kind === "resize") {
      const o = d.orig;
      let { x, y, w, h } = o;
      const mx = snap(m.x);
      const my = snap(m.y);
      if (d.handle.includes("w")) {
        w = o.x + o.w - mx;
        x = mx;
      }
      if (d.handle.includes("e")) w = mx - o.x;
      if (d.handle.includes("n")) {
        h = o.y + o.h - my;
        y = my;
      }
      if (d.handle.includes("s")) h = my - o.y;
      if (w < MIN) {
        if (d.handle.includes("w")) x = o.x + o.w - MIN;
        w = MIN;
      }
      if (h < MIN) {
        if (d.handle.includes("n")) y = o.y + o.h - MIN;
        h = MIN;
      }
      p.onChange(d.id, clamp({ x, y, w, h }));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === "draw") p.onDrawDone?.();
  };

  const unit = vb.w / 100;
  const sel = p.buildings.find((b) => b.id === p.selectedId);
  const handles: [Handle, number, number][] = sel?.overview
    ? [
        ["nw", sel.overview.x, sel.overview.y],
        ["n", sel.overview.x + sel.overview.w / 2, sel.overview.y],
        ["ne", sel.overview.x + sel.overview.w, sel.overview.y],
        ["e", sel.overview.x + sel.overview.w, sel.overview.y + sel.overview.h / 2],
        ["se", sel.overview.x + sel.overview.w, sel.overview.y + sel.overview.h],
        ["s", sel.overview.x + sel.overview.w / 2, sel.overview.y + sel.overview.h],
        ["sw", sel.overview.x, sel.overview.y + sel.overview.h],
        ["w", sel.overview.x, sel.overview.y + sel.overview.h / 2],
      ]
    : [];
  const cursor: Record<Handle, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };

  return (
    <div className={cx("relative", p.className)}>
      <svg
        ref={svgRef}
        role="application"
        aria-label="Campus map editor"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="cn-mapframe w-full bg-[var(--cn-map-bg)] border border-line touch-none select-none"
        style={{ height: p.height_ ?? "62vh", cursor: p.drawMode ? "crosshair" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <pattern id="campus-grid" width={50} height={50} patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="var(--cn-border)" strokeWidth={0.6} />
          </pattern>
        </defs>
        <rect x={0} y={0} width={p.width} height={p.height} fill="url(#campus-grid)" stroke="var(--cn-border-strong)" vectorEffect="non-scaling-stroke" />
        {p.imageUrl ? <image href={p.imageUrl} x={0} y={0} width={p.width} height={p.height} preserveAspectRatio="none" opacity={p.imageOpacity ?? 0.85} pointerEvents="none" /> : null}
        {p.buildings
          .filter((b) => b.overview)
          .map((b) => {
            const r = b.overview!;
            const isSel = b.id === p.selectedId;
            return (
              <g key={b.id} data-b={b.id} style={{ cursor: p.drawMode ? "crosshair" : isSel ? "move" : "pointer" }}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={isSel ? "color-mix(in srgb, var(--cn-accent) 30%, transparent)" : "color-mix(in srgb, var(--cn-map-room) 70%, transparent)"}
                  stroke={isSel ? "var(--cn-accent)" : "var(--cn-text)"}
                  strokeWidth={isSel ? 3 : 1.5}
                  vectorEffect="non-scaling-stroke"
                />
                <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(12, Math.min(unit * 2.4, r.w / Math.max(3, b.code.length * 0.65)))} fontFamily="IBM Plex Mono, monospace" fill="var(--cn-text)" stroke="var(--cn-bg)" strokeWidth={unit * 0.35} paintOrder="stroke" pointerEvents="none">
                  {b.code}
                </text>
              </g>
            );
          })}
        {handles.map(([h, x, y]) => (
          <rect key={h} data-h={h} x={x - unit * 0.9} y={y - unit * 0.9} width={unit * 1.8} height={unit * 1.8} fill="var(--cn-bg)" stroke="var(--cn-accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: cursor[h] }} />
        ))}
      </svg>
      <div className="absolute end-2 top-2 flex flex-col gap-1">
        <Button className="!min-h-9 !px-3" aria-label="Zoom in" onClick={() => setVb((v) => zoomAt(v, 1.4, v.x + v.w / 2, v.y + v.h / 2, base))}>+</Button>
        <Button className="!min-h-9 !px-3" aria-label="Zoom out" onClick={() => setVb((v) => zoomAt(v, 1 / 1.4, v.x + v.w / 2, v.y + v.h / 2, base))}>−</Button>
        <Button className="!min-h-9 !px-3" aria-label="Reset view" onClick={() => setVb(base)}>⟲</Button>
      </div>
    </div>
  );
}

/**
 * Prepare an uploaded campus picture: accepts PNG/JPEG/WebP up to 15 MB, decodes
 * it (rejecting anything that isn't a real image), downsizes to ≤ 2048 px and
 * re-encodes as JPEG — which also strips EXIF metadata such as GPS tags.
 */
export async function prepareCampusImage(file: File, maxSide = 2048, maxBytes = 1_400_000): Promise<{ blob: Blob; width: number; height: number }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Use a PNG, JPEG or WebP image (e.g. an aerial screenshot or the official campus plan).");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image is larger than 15 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This file could not be read as an image.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const q of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= maxBytes) return { blob, width, height };
  }
  throw new Error("Image is too detailed to store; try a smaller or simpler picture.");
}
