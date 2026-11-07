import Svg, { Circle, G, Rect } from "react-native-svg";
import { NULL_TECH as N } from "@campusnav/tokens";

/** NULL-TECH studio mark (vector redraw of the studio logo). */
export function NullTechMark({ size = 16 }: { size?: number }) {
  const { ring, bar } = N;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <G rotation={-45} origin="50, 50">
        <Circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={N.red} strokeWidth={ring.edge} />
        <Rect x={bar.edge.x} y={bar.edge.y} width={bar.edge.w} height={bar.edge.h} rx={bar.edge.rx} fill={N.red} />
        <Circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke={N.body} strokeWidth={ring.core} />
        <Rect x={bar.core.x} y={bar.core.y} width={bar.core.w} height={bar.core.h} rx={bar.core.rx} fill={N.body} />
      </G>
    </Svg>
  );
}
