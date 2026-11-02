"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { lt, type CampusBundle, type Floor, type Route } from "@campusnav/core";
import { useApp } from "@/lib/store";
import type { Scene3DSpec } from "./three/Scene3D";
import { Spinner } from "./ui";

const Scene3D = dynamic(() => import("./three/Scene3D"), { ssr: false, loading: () => <div className="absolute inset-0 grid place-items-center"><Spinner label="3D" /></div> });

/**
 * The navigation route inside one building, drawn in 3D from the exact graph
 * nodes the router returned (no decorative path). Floors are separated so the
 * stairs/elevator legs are visible.
 */
export function RouteView3D({ bundle, route, buildingId, onUnavailable }: { bundle: CampusBundle; route: Route; buildingId: string; onUnavailable: () => void }) {
  const { t, prefs } = useApp();
  const loc = prefs.locale;
  const spec = useMemo<Scene3DSpec>(
    () => ({
      type: "building",
      buildingId,
      floorId: null,
      exploded: true,
      hideOtherFloors: false,
      selectedRoomId: null,
      route,
      startNodeId: null,
      destinationNodeId: null,
      locale: loc,
      floorLabel: (f: Floor) => lt(f.name, loc),
    }),
    [buildingId, route, loc],
  );
  return (
    <Scene3D
      bundle={bundle}
      spec={spec}
      focusKey={buildingId}
      onPick={() => undefined}
      onUnavailable={onUnavailable}
      labels={{ zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), rotate: t("explore.rotate"), reset: t("map.reset"), canvas: t("explore.canvas") }}
    />
  );
}
