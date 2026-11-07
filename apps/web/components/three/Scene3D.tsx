"use client";
/**
 * React wrapper around the plain three.js Viewer. Loaded with next/dynamic
 * (ssr: false) so three.js is only downloaded when a 3D view is shown.
 */
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import type { CampusBundle } from "@campusnav/core";
import { Viewer, webglAvailable, type PickData } from "@/lib/three/viewer";
import { buildBuilding, buildCampus, type BuildingSceneOptions, type CampusSceneOptions } from "@/lib/three/scenes";

export type Scene3DSpec = ({ type: "campus" } & Omit<CampusSceneOptions, "onAsset">) | ({ type: "building" } & BuildingSceneOptions);

export interface Scene3DProps {
  bundle: CampusBundle;
  spec: Scene3DSpec;
  /** Changing this key re-frames the camera (e.g. a new building or floor was chosen). */
  focusKey: string;
  onPick: (p: PickData | null) => void;
  onUnavailable: () => void;
  labels: { zoomIn: string; zoomOut: string; rotate: string; reset: string; canvas: string; play?: string; stop?: string };
  /** Pixels covered by UI on the start side / bottom; the camera centres on the rest. */
  insets?: { start: number; bottom: number };
}

export default function Scene3D({ bundle, spec, focusKey, onPick, onUnavailable, labels, insets }: Scene3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const boxes = useRef<{ building?: Map<string, import("three").Box3>; floor?: Map<string, import("three").Box3>; all?: import("three").Box3 }>({});
  const [ready, setReady] = useState(false);
  const lastFocus = useRef<string | null>(null);
  const routePath = useRef<import("three").Vector3[]>([]);
  const [hasRoute, setHasRoute] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    if (!webglAvailable()) {
      onUnavailable();
      return;
    }
    try {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      setReduced(reduced);
      viewer.current = new Viewer(host.current, { onPick: (p) => pickRef.current(p), reducedMotion: reduced, onContextLost: onUnavailable });
      setReady(true);
    } catch {
      onUnavailable();
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) viewer.current?.setInsets(insets?.start ?? 0, insets?.bottom ?? 0, document.documentElement.dir === "rtl");
  }, [ready, insets?.start, insets?.bottom]);

  // Rebuild scene content when the spec changes; re-frame only when focusKey changes.
  useEffect(() => {
    const v = viewer.current;
    if (!v || !ready) return;
    const refocus = lastFocus.current !== focusKey;
    lastFocus.current = focusKey;
    if (spec.type === "campus") {
      const content = buildCampus(bundle, { ...spec, onAsset: () => v.requestRender() });
      boxes.current = { building: content.buildingBoxes, all: content.bounds };
      v.setContent(content, refocus && !spec.selectedBuildingId ? "fit" : "keep");
      if (refocus && spec.selectedBuildingId) {
        const b = content.buildingBoxes.get(spec.selectedBuildingId);
        if (b) v.focus(b.clone().expandByScalar(6), { tilt: 0.9 });
      }
    } else {
      v.stopPath();
      const content = buildBuilding(bundle, spec);
      routePath.current = content.routePath ?? [];
      setHasRoute(routePath.current.length >= 2);
      boxes.current = { floor: content.floorBoxes, all: content.bounds };
      v.setContent(content, refocus && !spec.floorId ? "fit" : "keep");
      if (refocus && spec.floorId) {
        const b = content.floorBoxes.get(spec.floorId);
        if (b) v.focus(b, { tilt: 0.75 });
      }
    }
  }, [bundle, spec, focusKey, ready]);

  const btn = "cn3d-btn";
  return (
    <div className="cn3d" role="application" aria-label={labels.canvas} aria-roledescription="3D map">
      <div ref={host} className="absolute inset-0" />
      <div className="cn3d-controls" role="group" aria-label={labels.canvas}>
        <button type="button" className={btn} onClick={() => viewer.current?.zoom(0.75)} aria-label={labels.zoomIn} title={labels.zoomIn}><Icon name="plus" /></button>
        <button type="button" className={btn} onClick={() => viewer.current?.zoom(1.33)} aria-label={labels.zoomOut} title={labels.zoomOut}><Icon name="minus" /></button>
        <button type="button" className={btn} onClick={() => viewer.current?.rotate(Math.PI / 4)} aria-label={labels.rotate} title={labels.rotate}><Icon name="rotate" /></button>
        <button type="button" className={btn} onClick={() => boxes.current.all && viewer.current?.focus(boxes.current.all)} aria-label={labels.reset} title={labels.reset}><Icon name="reset" /></button>
        {hasRoute && labels.play && !reduced ? (
          <button
            type="button"
            className={btn}
            aria-pressed={playing}
            data-testid="route-play"
            onClick={() => {
              const v = viewer.current;
              if (!v) return;
              if (v.playing) return v.stopPath();
              setPlaying(true);
              v.playPath(routePath.current, () => setPlaying(false));
            }}
            aria-label={playing ? labels.stop : labels.play}
            title={playing ? labels.stop : labels.play}
          >
            <Icon name={playing ? "stop" : "play"} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
