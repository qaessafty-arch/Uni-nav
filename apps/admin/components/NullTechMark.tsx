import { NULL_TECH as N } from "@campusnav/tokens";

/** NULL-TECH studio mark (vector redraw of the studio logo). */
export function NullTechMark({ size = 16, className = "" }: { size?: number; className?: string }) {
  const { ring, bar } = N;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className={className}>
      <g transform="rotate(-45 50 50)">
        <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={N.red} strokeWidth={ring.edge} />
        <rect x={bar.edge.x} y={bar.edge.y} width={bar.edge.w} height={bar.edge.h} rx={bar.edge.rx} fill={N.red} />
        <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={N.body} strokeWidth={ring.core} />
        <rect x={bar.core.x} y={bar.core.y} width={bar.core.w} height={bar.core.h} rx={bar.core.rx} fill={N.body} />
      </g>
    </svg>
  );
}
