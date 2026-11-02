import type { Floor, NavNode, UniversitySettings } from "../model/types";
import type { Route, RouteLeg } from "./pathfinding";

export type StepKind =
  | "start"
  | "straight"
  | "turn_left"
  | "turn_right"
  | "slight_left"
  | "slight_right"
  | "turn_around"
  | "stairs_up"
  | "stairs_down"
  | "elevator_up"
  | "elevator_down"
  | "exit_building"
  | "enter_building"
  | "outdoor"
  | "arrive";

/**
 * A localizable instruction. UI renders `kind` via i18n keys `step.<kind>`
 * with params (distance, floor name, landmark).
 */
export interface RouteStep {
  kind: StepKind;
  /** Metres walked during this step (0 for turns/arrive). */
  distanceM: number;
  floorId: string;
  /** Node at which the step begins (used to highlight on map). */
  nodeId: string;
  /** Target floor for vertical transitions. */
  toFloorId?: string;
  /** Number of floors moved (vertical transitions). */
  floors?: number;
  /** Optional landmark label (node label) at the step's end. */
  landmark?: NavNode["label"];
}

/** Heading in degrees (0 = +x axis, counter-clockwise positive in math coords; y grows downward in SVG). */
function heading(a: NavNode, b: NavNode): number {
  return (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
}

/** Signed turn angle in (-180, 180]. Positive = left turn (counter-clockwise on screen). */
export function turnAngle(prevHeading: number, nextHeading: number): number {
  let d = nextHeading - prevHeading;
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}

function classifyTurn(angle: number): StepKind | null {
  const a = Math.abs(angle);
  if (a < 25) return null;
  if (a > 155) return "turn_around";
  if (a < 50) return angle > 0 ? "slight_left" : "slight_right";
  return angle > 0 ? "turn_left" : "turn_right";
}

function isVertical(leg: RouteLeg): boolean {
  return leg.from.floorId !== leg.to.floorId;
}

export function buildInstructions(route: Route, floors: Map<string, Floor>): RouteStep[] {
  const steps: RouteStep[] = [];
  const first = route.nodes[0]!;
  steps.push({ kind: "start", distanceM: 0, floorId: first.floorId, nodeId: first.id, landmark: first.label ?? null });

  let prevHeading: number | null = null;
  let pendingStraight: RouteStep | null = null;
  const flushStraight = () => {
    if (pendingStraight && pendingStraight.distanceM > 0) steps.push(pendingStraight);
    pendingStraight = null;
  };

  for (const leg of route.legs) {
    if (isVertical(leg)) {
      flushStraight();
      const fromFloor = floors.get(leg.from.floorId);
      const toFloor = floors.get(leg.to.floorId);
      const delta = (toFloor?.level ?? 0) - (fromFloor?.level ?? 0);
      const differentBuilding = fromFloor && toFloor && fromFloor.buildingId !== toFloor.buildingId;
      let kind: StepKind;
      if (differentBuilding) kind = "enter_building";
      else if (leg.edge.kind === "elevator") kind = delta >= 0 ? "elevator_up" : "elevator_down";
      else kind = delta >= 0 ? "stairs_up" : "stairs_down";
      steps.push({
        kind,
        distanceM: leg.distanceM,
        floorId: leg.from.floorId,
        toFloorId: leg.to.floorId,
        floors: Math.abs(delta),
        nodeId: leg.from.id,
        landmark: leg.to.label ?? null,
      });
      prevHeading = null;
      continue;
    }

    const h = heading(leg.from, leg.to);
    const turn = prevHeading == null ? null : classifyTurn(turnAngle(prevHeading, h));
    if (turn) {
      flushStraight();
      steps.push({ kind: turn, distanceM: 0, floorId: leg.from.floorId, nodeId: leg.from.id, landmark: leg.from.label ?? null });
    }
    if (leg.edge.kind === "outdoor" && leg.from.kind === "building_entrance" && pendingStraight == null) {
      steps.push({ kind: "exit_building", distanceM: 0, floorId: leg.from.floorId, nodeId: leg.from.id, landmark: leg.from.label ?? null });
    }
    const kind: StepKind = leg.edge.kind === "outdoor" ? "outdoor" : "straight";
    if (!pendingStraight || pendingStraight.kind !== kind) {
      flushStraight();
      pendingStraight = { kind, distanceM: 0, floorId: leg.from.floorId, nodeId: leg.from.id };
    }
    pendingStraight.distanceM += leg.distanceM;
    pendingStraight.landmark = leg.to.label ?? pendingStraight.landmark ?? null;
    prevHeading = h;
  }
  flushStraight();
  const last = route.nodes[route.nodes.length - 1]!;
  steps.push({ kind: "arrive", distanceM: 0, floorId: last.floorId, nodeId: last.id, landmark: last.label ?? null });
  return steps;
}

export interface WalkingEstimate {
  seconds: number;
  /** Always true — estimates come from configured assumptions, not measurement. */
  isEstimate: true;
  assumptions: { speedMps: number; perFloorSeconds: { stairs: number; elevator: number } };
}

/** Estimated walking time using the university's configured assumptions. */
export function estimateWalkingTime(
  route: Route,
  settings: Pick<
    UniversitySettings,
    "walkingSpeedMps" | "accessibleWalkingSpeedMps" | "stairsSecondsPerFloor" | "elevatorSecondsPerFloor"
  >,
  floors: Map<string, Floor>,
  accessible = false,
): WalkingEstimate {
  const speed = accessible ? settings.accessibleWalkingSpeedMps : settings.walkingSpeedMps;
  let seconds = 0;
  for (const leg of route.legs) {
    if (isVertical(leg) && (leg.edge.kind === "stairs" || leg.edge.kind === "elevator")) {
      const a = floors.get(leg.from.floorId)?.level ?? 0;
      const b = floors.get(leg.to.floorId)?.level ?? 0;
      const n = Math.max(1, Math.abs(b - a));
      seconds += n * (leg.edge.kind === "stairs" ? settings.stairsSecondsPerFloor : settings.elevatorSecondsPerFloor);
    } else {
      seconds += leg.distanceM / speed;
    }
  }
  return {
    seconds: Math.round(seconds),
    isEstimate: true,
    assumptions: {
      speedMps: speed,
      perFloorSeconds: { stairs: settings.stairsSecondsPerFloor, elevator: settings.elevatorSecondsPerFloor },
    },
  };
}
