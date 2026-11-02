"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  fitPoints,
  fitViewBox,
  lt,
  pan,
  polygonPath,
  shapeCenter,
  zoomAt,
  type Floor,
  type Locale,
  type MapElement,
  type NavNode,
  type Room,
  type ViewBox,
} from "@campusnav/core";

export interface FloorMapLabels {
  zoomIn: string;
  zoomOut: string;
  reset: string;
  youAreHere: string;
  destination: string;
  checkpoint: string;
  mapOf: string;
}

export interface FloorMapProps {
  floor: Floor;
  elements: MapElement[];
  rooms: Room[];
  locale: Locale;
  labels: FloorMapLabels;
  selectedRoomId?: string | null;
  /** Route polyline points on this floor, in order (one or more segments). */
  routeSegments?: NavNode[][];
  startNode?: NavNode | null;
  destinationNode?: NavNode | null;
  checkpointNodes?: NavNode[];
  /** Highlight a specific node (e.g. current instruction). */
  focusNode?: NavNode | null;
  onRoomSelect?: (roomId: string) => void;
  /** Called with map coordinates when the background is clicked (used by editors). */
  onCanvasClick?: (x: number, y: number) => void;
  /** Extra SVG drawn above elements (editor overlays). */
  overlay?: ReactNode;
  className?: string;
  /** When true, fit to route on change. */
  autoFit?: boolean;
  height?: number | string;
}

const KIND_FILL: Record<string, string> = {
  room: "var(--cn-map-room)",
  corridor: "var(--cn-map-corridor)",
  stairs: "var(--cn-map-stairs)",
  elevator: "var(--cn-map-elevator)",
  toilet: "var(--cn-map-toilet)",
  entrance: "var(--cn-accent-soft)",
  emergency_exit: "color-mix(in srgb, var(--cn-danger) 18%, transparent)",
  wall: "var(--cn-border-strong)",
  outdoor: "transparent",
  building: "var(--cn-map-room)",
};

/**
 * Interactive SVG floor map: zoom (wheel, pinch, buttons), pan (drag), keyboard
 * selectable rooms, route overlay. Every element maps 1:1 to a database row id.
 */
export function FloorMap(props: FloorMapProps) {
  const { floor, elements, rooms, locale, labels, selectedRoomId, routeSegments, startNode, destinationNode, checkpointNodes, focusNode, onRoomSelect, onCanvasClick, overlay, autoFit = true } = props;
  const base = useMemo(() => fitViewBox(floor.width, floor.height), [floor.width, floor.height]);
  const [vb, setVb] = useState<ViewBox>(base);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragged = useRef(false);
  const lastPinch = useRef<number | null>(null);

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const fitTarget = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (const seg of routeSegments ?? []) pts.push(...seg);
    if (!pts.length && selectedRoomId) {
      const el = elements.find((e) => e.roomId === selectedRoomId);
      if (el) pts.push(shapeCenter(el.shape));
    }
    if (focusNode) return [focusNode];
    return pts;
  }, [routeSegments, selectedRoomId, elements, focusNode]);

  useEffect(() => {
    if (!autoFit) return;
    setVb(fitTarget.length ? fitPoints(base, fitTarget, 80) : base);
  }, [base, fitTarget, autoFit]);

  const toMap = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const r = svg.getBoundingClientRect();
      // preserveAspectRatio xMidYMid meet: compute scale and offsets
      const scale = Math.min(r.width / vb.w, r.height / vb.h);
      const ox = (r.width - vb.w * scale) / 2;
      const oy = (r.height - vb.h * scale) / 2;
      return { x: vb.x + (clientX - r.left - ox) / scale, y: vb.y + (clientY - r.top - oy) / scale };
    },
    [vb],
  );

  const scaleFactor = useCallback(() => {
    const r = svgRef.current?.getBoundingClientRect();
    return r ? Math.min(r.width / vb.w, r.height / vb.h) : 1;
  }, [vb]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toMap(e.clientX, e.clientY);
      setVb((v) => zoomAt(v, e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y, base));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toMap, base]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    lastPinch.current = null;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (lastPinch.current) {
        const mid = toMap((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
        setVb((v) => zoomAt(v, d / lastPinch.current!, mid.x, mid.y, base));
      }
      lastPinch.current = d;
      dragged.current = true;
      return;
    }
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
    const s = scaleFactor();
    setVb((v) => pan(v, dx / s, dy / s));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastPinch.current = null;
  };

  const zoomBy = (f: number) => setVb((v) => zoomAt(v, f, v.x + v.w / 2, v.y + v.h / 2, base));

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (dragged.current || !onCanvasClick) return;
    const p = toMap(e.clientX, e.clientY);
    onCanvasClick(p.x, p.y);
  };

  const unit = vb.w / 100; // relative stroke/label sizing

  return (
    <div className={["cn-mapframe", props.className].filter(Boolean).join(" ")} style={{ position: "relative", height: props.height ?? "100%", minHeight: 240, background: "var(--cn-map-bg)", border: "1px solid var(--cn-border)", touchAction: "none", overflow: "hidden" }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={`${labels.mapOf} ${lt(floor.name, locale)}`}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", cursor: "grab", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleBackgroundClick}
        // Map coordinates are always LTR regardless of UI direction.
        direction="ltr"
      >
        <rect x={0} y={0} width={floor.width} height={floor.height} fill="var(--cn-map-bg)" stroke="var(--cn-border)" strokeWidth={unit * 0.15} />
        {floor.planAssetUrl ? <image href={floor.planAssetUrl} x={0} y={0} width={floor.width} height={floor.height} preserveAspectRatio="xMidYMid meet" opacity={0.85} /> : null}

        {elements
          .slice()
          .sort((a, b) => (a.kind === "corridor" ? -1 : 0) - (b.kind === "corridor" ? -1 : 0))
          .map((el) => {
            const room = el.roomId ? roomById.get(el.roomId) : undefined;
            const selected = !!room && room.id === selectedRoomId;
            const interactive = !!room && !!onRoomSelect;
            const fill = selected ? "var(--cn-map-selected)" : KIND_FILL[el.kind] ?? "var(--cn-map-room)";
            const stroke = selected ? "var(--cn-accent)" : "var(--cn-map-room-stroke)";
            const c = shapeCenter(el.shape);
            const label = room ? room.code : lt(el.label, locale);
            const bw = el.shape.type === "rect" ? el.shape.w : Math.max(...el.shape.points.map((p) => p[0])) - Math.min(...el.shape.points.map((p) => p[0]));
            const fontSize = Math.min(Math.max(14, unit * 2.2), (bw * 0.9) / Math.max(1, label.length * 0.62));
            const shapeProps = { fill, stroke, strokeWidth: selected ? unit * 0.5 : unit * 0.12, vectorEffect: "non-scaling-stroke" as const };
            return (
              <g
                key={el.id}
                data-element-id={el.id}
                data-room-id={room?.id}
                role={interactive ? "button" : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? `${room!.code} — ${lt(room!.name, locale)}` : undefined}
                aria-pressed={interactive ? selected : undefined}
                style={{ cursor: interactive ? "pointer" : "inherit", outline: "none" }}
                onClick={(e) => {
                  if (!interactive || dragged.current) return;
                  e.stopPropagation();
                  onRoomSelect!(room!.id);
                }}
                onKeyDown={(e) => {
                  if (interactive && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onRoomSelect!(room!.id);
                  }
                }}
              >
                {el.shape.type === "rect" ? <rect x={el.shape.x} y={el.shape.y} width={el.shape.w} height={el.shape.h} {...shapeProps} /> : <path d={polygonPath(el.shape.points)} {...shapeProps} />}
                {label && el.kind !== "corridor" ? (
                  <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontFamily="IBM Plex Mono, ui-monospace, monospace" fill={selected ? "var(--cn-accent)" : "var(--cn-text-muted)"} pointerEvents="none">
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}

        {routeSegments?.map((seg, i) =>
          seg.length > 1 ? (
            <g key={i} pointerEvents="none">
              <polyline points={seg.map((n) => `${n.x},${n.y}`).join(" ")} fill="none" stroke="var(--cn-bg)" strokeWidth={unit * 1.6} strokeLinecap="square" strokeLinejoin="miter" />
              <polyline points={seg.map((n) => `${n.x},${n.y}`).join(" ")} fill="none" stroke="var(--cn-map-route)" strokeWidth={unit * 0.9} strokeLinecap="square" strokeLinejoin="miter" strokeDasharray={`${unit * 2.4} ${unit * 1.2}`}>
                <animate attributeName="stroke-dashoffset" from={unit * 7.2} to={0} dur="1.2s" repeatCount="indefinite" />
              </polyline>
            </g>
          ) : null,
        )}

        {checkpointNodes?.map((n) => (
          <g key={n.id} pointerEvents="none" aria-label={labels.checkpoint}>
            <rect x={n.x - unit * 1.1} y={n.y - unit * 1.1} width={unit * 2.2} height={unit * 2.2} fill="var(--cn-surface)" stroke="var(--cn-info)" strokeWidth={unit * 0.3} />
            <rect x={n.x - unit * 0.45} y={n.y - unit * 0.45} width={unit * 0.9} height={unit * 0.9} fill="var(--cn-info)" />
          </g>
        ))}

        {destinationNode ? (
          <g pointerEvents="none">
            <title>{labels.destination}</title>
            <path d={`M ${destinationNode.x} ${destinationNode.y} l ${-unit * 1.8} ${-unit * 3.6} h ${unit * 3.6} z`} fill="var(--cn-accent)" stroke="var(--cn-bg)" strokeWidth={unit * 0.25} />
          </g>
        ) : null}

        {startNode ? (
          <g pointerEvents="none">
            <title>{labels.youAreHere}</title>
            <circle cx={startNode.x} cy={startNode.y} r={unit * 3.2} fill="var(--cn-accent)" opacity={0.18}>
              <animate attributeName="r" values={`${unit * 1.8};${unit * 3.6};${unit * 1.8}`} dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={startNode.x} cy={startNode.y} r={unit * 1.3} fill="var(--cn-accent)" stroke="var(--cn-bg)" strokeWidth={unit * 0.35} />
          </g>
        ) : null}

        {focusNode ? <circle cx={focusNode.x} cy={focusNode.y} r={unit * 2.4} fill="none" stroke="var(--cn-warning)" strokeWidth={unit * 0.4} pointerEvents="none" /> : null}
        {overlay}
      </svg>

      <div style={{ position: "absolute", insetInlineEnd: 8, top: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        <MapButton label={labels.zoomIn} onClick={() => zoomBy(1.4)}>+</MapButton>
        <MapButton label={labels.zoomOut} onClick={() => zoomBy(1 / 1.4)}>−</MapButton>
        <MapButton label={labels.reset} onClick={() => setVb(fitTarget.length ? fitPoints(base, fitTarget, 80) : base)}>⟲</MapButton>
      </div>
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        display: "grid",
        placeItems: "center",
        background: "var(--cn-surface)",
        color: "var(--cn-text)",
        border: "var(--cn-bw, 1px) solid var(--cn-border-strong)",
        borderRadius: "var(--cn-radius, 0px)",
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 20,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
