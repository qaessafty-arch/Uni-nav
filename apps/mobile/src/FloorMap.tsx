import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { fitPoints, fitViewBox, lt, pan, polygonPath, shapeCenter, zoomAt, type Floor, type Locale, type MapElement, type NavNode, type Room, type ViewBox } from "@campusnav/core";
import { colors } from "@campusnav/tokens";

const c = colors.dark;
const FILL: Record<string, string> = { room: c.mapRoom, corridor: c.mapCorridor, stairs: c.mapStairs, elevator: c.mapElevator, toilet: c.mapToilet, entrance: c.accentSoft, emergency_exit: "#3A1C1C", wall: c.borderStrong, outdoor: "transparent", building: c.mapRoom };

export interface NativeFloorMapProps {
  floor: Floor;
  elements: MapElement[];
  rooms: Room[];
  locale: Locale;
  selectedRoomId?: string | null;
  route?: NavNode[][];
  start?: NavNode | null;
  destination?: NavNode | null;
  checkpoints?: NavNode[];
  onRoomPress?: (roomId: string) => void;
  height?: number;
  labels: { zoomIn: string; zoomOut: string; reset: string };
}

/**
 * Native SVG floor map with pan (one finger) and pinch zoom (two fingers) using
 * React Native's built-in PanResponder — no extra gesture library required.
 */
export function NativeFloorMap(p: NativeFloorMapProps) {
  const base = useMemo(() => fitViewBox(p.floor.width, p.floor.height), [p.floor.width, p.floor.height]);
  const target = useMemo(() => {
    const pts = (p.route ?? []).flat();
    if (!pts.length && p.selectedRoomId) {
      const el = p.elements.find((e) => e.roomId === p.selectedRoomId);
      if (el) pts.push({ ...shapeCenter(el.shape) } as NavNode);
    }
    return pts;
  }, [p.route, p.selectedRoomId, p.elements]);
  const [vb, setVb] = useState<ViewBox>(base);
  const [size, setSize] = useState({ w: 1, h: 1 });
  useEffect(() => setVb(target.length ? fitPoints(base, target, 80) : base), [base, target]);

  const vbRef = useRef(vb);
  vbRef.current = vb;
  const gesture = useRef<{ x: number; y: number; dist: number | null }>({ x: 0, y: 0, dist: null });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const scale = () => Math.min(sizeRef.current.w / vbRef.current.w, sizeRef.current.h / vbRef.current.h);
  const touchDist = (e: GestureResponderEvent) => {
    const t = e.nativeEvent.touches;
    return t.length >= 2 ? Math.hypot(t[0]!.pageX - t[1]!.pageX, t[0]!.pageY - t[1]!.pageY) : null;
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderGrant: (e, g) => {
          gesture.current = { x: g.moveX, y: g.moveY, dist: touchDist(e) };
        },
        onPanResponderMove: (e, g) => {
          const d = touchDist(e);
          if (d && gesture.current.dist) {
            const v = vbRef.current;
            setVb(zoomAt(v, d / gesture.current.dist, v.x + v.w / 2, v.y + v.h / 2, base));
            gesture.current.dist = d;
          } else {
            const s = scale();
            setVb((v) => pan(v, (g.moveX - gesture.current.x) / s, (g.moveY - gesture.current.y) / s));
            gesture.current.dist = d;
          }
          gesture.current.x = g.moveX;
          gesture.current.y = g.moveY;
        },
      }),
    [base],
  );

  const unit = vb.w / 100;
  const roomById = new Map(p.rooms.map((r) => [r.id, r]));
  const zoom = (f: number) => setVb((v) => zoomAt(v, f, v.x + v.w / 2, v.y + v.h / 2, base));

  return (
    <View style={{ height: p.height ?? 380, borderWidth: 1, borderColor: c.border, backgroundColor: c.mapBg }} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...responder.panHandlers}>
      <Svg width="100%" height="100%" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} accessibilityLabel={lt(p.floor.name, p.locale)}>
        <Rect x={0} y={0} width={p.floor.width} height={p.floor.height} fill={c.mapBg} stroke={c.border} />
        {p.elements.map((el) => {
          const room = el.roomId ? roomById.get(el.roomId) : undefined;
          const sel = !!room && room.id === p.selectedRoomId;
          const fill = sel ? c.mapSelected : FILL[el.kind] ?? c.mapRoom;
          const stroke = sel ? c.accent : c.mapRoomStroke;
          const center = shapeCenter(el.shape);
          const label = room ? room.code : el.kind === "corridor" ? "" : lt(el.label, p.locale);
          return (
            <G key={el.id} onPress={room && p.onRoomPress ? () => p.onRoomPress!(room.id) : undefined}>
              {el.shape.type === "rect" ? <Rect x={el.shape.x} y={el.shape.y} width={el.shape.w} height={el.shape.h} fill={fill} stroke={stroke} strokeWidth={sel ? unit * 0.4 : unit * 0.12} /> : <Path d={polygonPath(el.shape.points)} fill={fill} stroke={stroke} strokeWidth={unit * 0.12} />}
              {label ? (
                <SvgText x={center.x} y={center.y} fill={sel ? c.accent : c.textMuted} fontSize={Math.max(14, unit * 2.2)} textAnchor="middle" alignmentBaseline="middle">
                  {label}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {(p.route ?? []).map((seg, i) => (seg.length > 1 ? <Polyline key={i} points={seg.map((n) => `${n.x},${n.y}`).join(" ")} fill="none" stroke={c.mapRoute} strokeWidth={unit * 0.9} strokeDasharray={`${unit * 2.4} ${unit * 1.2}`} /> : null))}
        {(p.checkpoints ?? []).map((n) => <Rect key={n.id} x={n.x - unit} y={n.y - unit} width={unit * 2} height={unit * 2} fill={c.surface} stroke={c.info} strokeWidth={unit * 0.3} />)}
        {p.destination ? <Path d={`M ${p.destination.x} ${p.destination.y} l ${-unit * 1.8} ${-unit * 3.6} h ${unit * 3.6} z`} fill={c.accent} /> : null}
        {p.start ? <Circle cx={p.start.x} cy={p.start.y} r={unit * 1.4} fill={c.accent} stroke={c.bg} strokeWidth={unit * 0.35} /> : null}
      </Svg>
      <View style={{ position: "absolute", right: 8, top: 8, gap: 4 }}>
        {[
          ["+", p.labels.zoomIn, () => zoom(1.4)],
          ["−", p.labels.zoomOut, () => zoom(1 / 1.4)],
          ["⟲", p.labels.reset, () => setVb(target.length ? fitPoints(base, target, 80) : base)],
        ].map(([g, label, fn]) => (
          <Pressable key={label as string} accessibilityRole="button" accessibilityLabel={label as string} onPress={fn as () => void} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong }}>
            <Text style={{ color: c.text, fontSize: 20 }}>{g as string}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
