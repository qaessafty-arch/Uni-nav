"use client";
/** Admin: draw building outlines on the real map (MapLibre + OpenStreetMap-based tiles). */
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Building, CampusGeo, LngLat } from "@campusnav/core";

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
let rtl = false;

export interface RealMapEditorHandle {
  view: () => { center: LngLat; zoom: number; bearing: number } | null;
}

export function RealMapEditor({
  geo,
  buildings,
  selectedId,
  drawing,
  draft,
  onAddPoint,
  onSelect,
  onReady,
  lines = [],
  draftMode = "polygon",
  onSelectLine,
}: {
  geo: CampusGeo | null;
  buildings: Building[];
  selectedId: string | null;
  drawing: boolean;
  draft: LngLat[];
  onAddPoint: (p: LngLat) => void;
  onSelect: (id: string) => void;
  onReady: (h: RealMapEditorHandle) => void;
  /** Extra lines to show (e.g. walkways); the selected one is highlighted. */
  lines?: { id: string; coords: LngLat[]; selected?: boolean; steps?: boolean }[];
  /** "polygon" closes the draft (building outlines); "line" keeps it open (walkways). */
  draftMode?: "polygon" | "line";
  onSelectLine?: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onAddPoint, onSelect, drawing, onSelectLine });
  cb.current = { onAddPoint, onSelect, drawing, onSelectLine };

  useEffect(() => {
    if (!host.current) return;
    if (!rtl) {
      rtl = true;
      void maplibregl.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text-0.3.0.js", true).catch(() => undefined);
    }
    const m = new maplibregl.Map({ container: host.current, style: STYLE, center: geo?.center ?? [0, 20], zoom: geo?.zoom ?? 2, attributionControl: { compact: true } });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    m.on("error", () => setFailed(true));
    m.on("load", () => {
      setFailed(false);
      m.addSource("b", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "b-fill", type: "fill", source: "b", paint: { "fill-color": ["get", "c"], "fill-opacity": ["get", "o"] } });
      m.addLayer({ id: "b-line", type: "line", source: "b", paint: { "line-color": ["get", "c"], "line-width": 2 } });
      m.addSource("lines", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "l-casing", type: "line", source: "lines", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": ["case", ["get", "sel"], 9, 6] } });
      m.addLayer({ id: "l-line", type: "line", source: "lines", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["case", ["get", "sel"], "#1D4ED8", ["get", "steps"], "#B45309", "#2563EB"], "line-width": ["case", ["get", "sel"], 5, 3], "line-opacity": ["case", ["get", "sel"], 1, 0.7] } });
      m.addLayer({ id: "d-line", type: "line", source: "draft", paint: { "line-color": "#B45309", "line-width": 2.5, "line-dasharray": [2, 1] } });
      m.addLayer({ id: "d-pt", type: "circle", source: "draft", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 5, "circle-color": "#B45309", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      m.on("click", (e) => {
        if (cb.current.drawing) {
          cb.current.onAddPoint([Number(e.lngLat.lng.toFixed(7)), Number(e.lngLat.lat.toFixed(7))]);
          return;
        }
        const ln = m.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ["l-line"] })[0];
        if (ln?.properties?.id && cb.current.onSelectLine) return cb.current.onSelectLine(String(ln.properties.id));
        const f = m.queryRenderedFeatures(e.point, { layers: ["b-fill"] })[0];
        if (f?.properties?.id) cb.current.onSelect(String(f.properties.id));
      });
      setLoaded(true);
    });
    onReady({
      view: () => {
        if (!map.current) return null;
        const c = map.current.getCenter();
        return { center: [Number(c.lng.toFixed(7)), Number(c.lat.toFixed(7))], zoom: Number(map.current.getZoom().toFixed(2)), bearing: Number(map.current.getBearing().toFixed(1)) };
      },
    });
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    (m.getSource("b") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: buildings
        .filter((b) => b.geo && b.geo.footprint.length >= 3)
        .map((b) => ({
          type: "Feature" as const,
          properties: { id: b.id, c: b.id === selectedId ? "#1D4ED8" : "#4B5563", o: b.id === selectedId ? 0.35 : 0.15 },
          geometry: { type: "Polygon" as const, coordinates: [[...b.geo!.footprint, b.geo!.footprint[0]!]] },
        })),
    });
    (m.getSource("draft") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        ...(draft.length >= 2 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: draftMode === "polygon" && draft.length >= 3 ? [...draft, draft[0]!] : draft } }] : []),
        ...draft.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } })),
      ],
    });
    (m.getSource("lines") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: lines.filter((l) => l.coords.length >= 2).map((l) => ({ type: "Feature" as const, properties: { id: l.id, sel: !!l.selected, steps: !!l.steps }, geometry: { type: "LineString" as const, coordinates: l.coords } })),
    });
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [loaded, buildings, selectedId, draft, drawing, lines, draftMode]);

  useEffect(() => {
    const m = map.current;
    if (!m || !geo) return;
    m.jumpTo({ center: geo.center, zoom: geo.zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo?.center[0], geo?.center[1]]);

  return (
    <div className="relative w-full h-[62vh] min-h-[380px] border border-line rounded-[10px] overflow-hidden">
      <div ref={host} className="w-full h-full" data-testid="real-map-editor" />
      {failed ? <div className="absolute top-3 inset-x-3 z-10 cn-panel px-3 py-2 text-sm">Map tiles couldn&apos;t load. Check the internet connection (outlines you already drew are kept).</div> : null}
    </div>
  );
}
