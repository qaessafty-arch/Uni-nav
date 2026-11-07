"use client";
/**
 * Real-world campus map (MapLibre GL + OpenStreetMap-based vector tiles).
 * Loaded lazily with next/dynamic. Shows building outlines that staff drew on
 * the real map (building.geo); nothing is placed where no outline exists.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { buildingIconPath } from "@campusnav/tokens";
import { lt, type Building, type CampusGeo, type LngLat, type Locale } from "@campusnav/core";

export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

let rtlRequested = false;
function ensureRtlPlugin() {
  if (rtlRequested) return;
  rtlRequested = true;
  try {
    // Shapes Arabic/Kurdish street labels correctly; loaded only when RTL text appears.
    void maplibregl.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text-0.3.0.js", true).catch(() => undefined);
  } catch {
    /* already set */
  }
}

/** Building logo or icon for a map marker, built as DOM (markers live outside React). */
function markNode(b: Building): HTMLElement {
  if (b.logoUrl) {
    const img = document.createElement("img");
    img.src = b.logoUrl;
    img.alt = "";
    img.className = "cn-maplabel-logo";
    return img;
  }
  const span = document.createElement("span");
  span.className = "cn-maplabel-mark";
  span.style.background = b.color ?? "var(--cn-accent)";
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", buildingIconPath(b.icon));
  svg.appendChild(path);
  span.appendChild(svg);
  return span;
}

function css(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function bboxOf(points: [number, number][]): [[number, number], [number, number]] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

export interface RealMapProps {
  geo: CampusGeo;
  buildings: Building[];
  /** Walkway lines staff drew or imported (outdoor navigation edges). */
  walkways?: LngLat[][];
  selectedId: string | null;
  locale: Locale;
  onSelect: (id: string) => void;
  onUnavailable: () => void;
  padding: { start: number; bottom: number };
  labels: { tilesFailed: string; zoomIn: string; zoomOut: string; reset: string };
}

export default function RealMap({ geo, buildings, walkways = [], selectedId, locale, onSelect, onUnavailable, padding, labels }: RealMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [loaded, setLoaded] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const placed = buildings.filter((b) => b.geo && b.geo.footprint.length >= 3);

  useEffect(() => {
    if (!host.current) return;
    ensureRtlPlugin();
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: host.current,
        style: MAP_STYLE_URL,
        center: geo.center,
        zoom: geo.zoom,
        bearing: geo.bearing ?? 0,
        attributionControl: { compact: true },
        dragRotate: true,
        pitchWithRotate: false,
      });
    } catch {
      onUnavailable();
      return;
    }
    map.current = m;
    let didLoad = false;
    m.on("error", (e) => {
      // Style/tile failures (offline, blocked) — keep the page usable and say so.
      if (!didLoad || /tile|style|source/i.test(String((e as { error?: Error }).error?.message ?? ""))) setTilesFailed(true);
    });
    m.on("load", () => {
      didLoad = true;
      setTilesFailed(false);
      m.addSource("walkways", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "walkways", type: "line", source: "walkways", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css("--cn-accent", "#1D4ED8"), "line-width": 2.5, "line-opacity": 0.55, "line-dasharray": [1.5, 1.2] } });
      m.addSource("buildings", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "buildings-fill", type: "fill", source: "buildings", paint: { "fill-color": ["get", "fill"], "fill-opacity": ["get", "opacity"] } });
      m.addLayer({ id: "buildings-line", type: "line", source: "buildings", paint: { "line-color": ["get", "stroke"], "line-width": ["get", "width"] } });
      m.on("click", "buildings-fill", (ev) => {
        const id = ev.features?.[0]?.properties?.id;
        if (typeof id === "string") selectRef.current(id);
      });
      m.on("mouseenter", "buildings-fill", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "buildings-fill", () => (m.getCanvas().style.cursor = ""));
      setLoaded(true);
    });
    m.getCanvas().addEventListener("webglcontextlost", () => onUnavailable());
    return () => {
      markers.current.forEach((mk) => mk.remove());
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Building outlines + labels
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded) return;
    const accent = css("--cn-accent", "#1D4ED8");
    const neutral = css("--cn-text-muted", "#4B5563");
    (m.getSource("walkways") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: walkways.map((w) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: w } })),
    });
    const src = m.getSource("buildings") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: placed.map((b) => {
        const sel = b.id === selectedId;
        return {
          type: "Feature",
          properties: { id: b.id, fill: sel ? accent : neutral, opacity: sel ? 0.35 : 0.12, stroke: sel ? accent : neutral, width: sel ? 3 : 1.5 },
          geometry: { type: "Polygon", coordinates: [[...b.geo!.footprint, b.geo!.footprint[0]!]] },
        };
      }),
    });
    markers.current.forEach((mk) => mk.remove());
    markers.current = placed.map((b) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `cn-maplabel${b.id === selectedId ? " is-selected" : ""}`;
      el.appendChild(markNode(b));
      el.appendChild(document.createTextNode(b.code));
      el.title = lt(b.name, locale);
      el.setAttribute("aria-label", lt(b.name, locale));
      el.addEventListener("click", () => selectRef.current(b.id));
      const [[x0, y0], [x1, y1]] = bboxOf(b.geo!.footprint);
      return new maplibregl.Marker({ element: el }).setLngLat([(x0 + x1) / 2, (y0 + y1) / 2]).addTo(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, selectedId, locale, buildings, walkways.length]);

  // Camera: fit the selected building, keeping it clear of the panel/sheet
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const rtl = document.documentElement.dir === "rtl";
    const pad = { top: 60, bottom: padding.bottom + 40, left: rtl ? 40 : padding.start + 40, right: rtl ? padding.start + 40 : 60 };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const b = placed.find((x) => x.id === selectedId);
    if (b) m.fitBounds(bboxOf(b.geo!.footprint), { padding: pad, maxZoom: 18.5, duration: reduce ? 0 : 500 });
    else m.easeTo({ padding: pad, duration: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, padding.start, padding.bottom, loaded]);

  const btn = "cn3d-btn";
  return (
    <div className="absolute inset-0">
      {/* MapLibre's stylesheet makes its container position:relative, so the host fills the absolute wrapper by size. */}
      <div ref={host} className="w-full h-full" data-testid="real-map" />
      {tilesFailed ? (
        <div className="absolute inset-x-3 top-3 z-[5] mx-auto max-w-md cn-panel px-4 py-3 text-sm" role="status">
          {labels.tilesFailed}
        </div>
      ) : null}
      <div className="cn3d-controls">
        <button type="button" className={btn} onClick={() => map.current?.zoomIn()} aria-label={labels.zoomIn} title={labels.zoomIn}><Icon name="plus" /></button>
        <button type="button" className={btn} onClick={() => map.current?.zoomOut()} aria-label={labels.zoomOut} title={labels.zoomOut}><Icon name="minus" /></button>
        <button type="button" className={btn} onClick={() => map.current?.easeTo({ center: geo.center, zoom: geo.zoom, bearing: geo.bearing ?? 0 })} aria-label={labels.reset} title={labels.reset}><Icon name="reset" /></button>
      </div>
    </div>
  );
}
