"use client";
import { lt, type Building, type CampusBundle } from "@campusnav/core";
import { useApp } from "@/lib/store";
import { buildingIconPath } from "@campusnav/tokens";

/**
 * The staff-drawn campus picture (building boxes on a plain canvas or a campus
 * photo). With `routeBuildingIds` it also draws a schematic route: straight
 * dashed lines between building centres, never presented as the real path.
 */
export function CampusMap2D({ bundle, campusId, selectedId, onSelect, routeBuildingIds, insets }: { bundle: CampusBundle; campusId: string; selectedId: string | null; onSelect: (id: string) => void; routeBuildingIds?: string[]; insets?: { start: number; bottom: number } }) {
  const { prefs, t } = useApp();
  const campus = bundle.campuses.find((c) => c.id === campusId)!;
  const w = campus.overviewWidth ?? 1000;
  const h = campus.overviewHeight ?? 700;
  const buildings = bundle.buildings.filter((b) => b.campusId === campusId && b.overview);
  const fs = Math.max(22, w * 0.036); // readable on phones, where the campus is scaled down
  return (
    <svg viewBox={`${-w * 0.05} ${-h * 0.05} ${w * 1.1} ${h * 1.1}`} className="absolute top-0" style={{ insetInlineStart: insets?.start ?? 0, width: `calc(100% - ${insets?.start ?? 0}px)`, height: `calc(100% - ${insets?.bottom ?? 0}px)` }} role="img" aria-label={t("map.campus")} direction="ltr" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={w} height={h} fill="var(--cn-surface)" stroke="var(--cn-border-strong)" />
      {campus.overviewImageUrl ? <image href={campus.overviewImageUrl} x={0} y={0} width={w} height={h} preserveAspectRatio="none" opacity={0.9} /> : null}
      {buildings.map((b) => {
        const r = b.overview!;
        const sel = b.id === selectedId;
        return (
          <g key={b.id} role="button" tabIndex={0} aria-label={lt(b.name, prefs.locale)} aria-pressed={sel} className="cursor-pointer" onClick={() => onSelect(b.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(b.id)}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={sel ? `color-mix(in srgb, ${b.color ?? "var(--cn-accent)"} 24%, var(--cn-surface))` : campus.overviewImageUrl ? "color-mix(in srgb, var(--cn-accent) 18%, transparent)" : "var(--cn-map-room)"} stroke={sel ? (b.color ?? "var(--cn-accent)") : "var(--cn-border-strong)"} strokeWidth={sel ? 5 : 2} />
            <BoxMark b={b} x={r.x + r.w - fs * 1.55} y={r.y + fs * 0.35} s={fs * 1.2} />
            <text x={r.x + fs * 0.6} y={r.y + fs * 1.4} fill="var(--cn-text)" fontSize={fs} fontFamily="IBM Plex Mono, monospace" fontWeight={600}>
              {b.code}
            </text>
            <text x={r.x + fs * 0.6} y={r.y + fs * 2.5} fill="var(--cn-text-muted)" fontSize={fs * 0.72}>
              {lt(b.name, prefs.locale)}
            </text>
          </g>
        );
      })}
      {routeBuildingIds && routeBuildingIds.length >= 2 ? <SchematicRoute buildings={routeBuildingIds.map((id) => buildings.find((b) => b.id === id)).filter((b): b is (typeof buildings)[number] => !!b)} w={w} /> : null}
    </svg>
  );
}

function SchematicRoute({ buildings, w }: { buildings: Building[]; w: number }) {
  const pts = buildings.map((b) => [b.overview!.x + b.overview!.w / 2, b.overview!.y + b.overview!.h / 2] as const);
  const sw = Math.max(4, w * 0.006);
  return (
    <g data-testid="schematic-route" pointerEvents="none">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--cn-surface)" strokeWidth={sw * 2.2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--cn-map-route, var(--cn-accent))" strokeWidth={sw} strokeDasharray={`${sw * 2.5} ${sw * 1.6}`} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={sw * (i === 0 || i === pts.length - 1 ? 2.4 : 1.5)} fill={i === pts.length - 1 ? "var(--cn-accent)" : i === 0 ? "var(--cn-info)" : "var(--cn-surface)"} stroke="var(--cn-accent)" strokeWidth={sw * 0.6} />
      ))}
    </g>
  );
}

/** Building logo or icon tile inside a campus-picture box. */
function BoxMark({ b, x, y, s }: { b: Building; x: number; y: number; s: number }) {
  if (b.logoUrl) return <image href={b.logoUrl} x={x} y={y} width={s} height={s} preserveAspectRatio="xMidYMid meet" />;
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.18} fill={b.color ?? "var(--cn-accent)"} />
      <svg x={x + s * 0.15} y={y + s * 0.15} width={s * 0.7} height={s * 0.7} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={buildingIconPath(b.icon)} />
      </svg>
    </g>
  );
}
