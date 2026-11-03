"use client";
/**
 * The outdoor part of a route on the real map: the walkway lines staff drew or
 * imported from OpenStreetMap, start/end markers and building outlines.
 * Loaded lazily (next/dynamic) like the main real map.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Building, CampusGeo, LngLat } from "@campusnav/core";
import { MAP_STYLE_URL } from "./RealMap";

function css(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export interface RouteRealMapProps {
  geo: CampusGeo;
  buildings: Building[];
  /** Route lines in walking order. */
  parts: LngLat[][];
  labels: { tilesFailed: string };
}

export default function RouteRealMap({ geo, buildings, parts, labels }: RouteRealMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify(parts);

  useEffect(() => {
    if (!host.current) return;
    const accent = css("--cn-accent", "#1D4ED8");
    const info = css("--cn-info", "#0E7490");
    const muted = css("--cn-text-muted", "#4B5563");
    const m = new maplibregl.Map({ container: host.current, style: MAP_STYLE_URL, center: geo.center, zoom: geo.zoom, bearing: geo.bearing ?? 0, attributionControl: { compact: true }, dragRotate: false });
    m.on("error", () => setFailed(true));
    m.on("load", () => {
      setFailed(false);
      m.addSource("b", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: buildings.filter((b) => b.geo && b.geo.footprint.length >= 3).map((b) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...b.geo!.footprint, b.geo!.footprint[0]!]] } })),
        },
      });
      m.addLayer({ id: "b-fill", type: "fill", source: "b", paint: { "fill-color": muted, "fill-opacity": 0.12 } });
      m.addLayer({ id: "b-line", type: "line", source: "b", paint: { "line-color": muted, "line-width": 1.2 } });
      m.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: parts.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: p } })) } });
      m.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9 } });
      m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": accent, "line-width": 5 } });
      const first = parts[0]?.[0];
      const last = parts.at(-1)?.at(-1);
      const dot = (color: string, size: number) => {
        const el = document.createElement("div");
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
        return el;
      };
      if (first) new maplibregl.Marker({ element: dot(info, 16) }).setLngLat(first).addTo(m);
      if (last) new maplibregl.Marker({ element: dot(accent, 20) }).setLngLat(last).addTo(m);
      const all = parts.flat();
      if (all.length) {
        const xs = all.map((p) => p[0]);
        const ys = all.map((p) => p[1]);
        m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 48, maxZoom: 18.5, duration: 0 });
      }
    });
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="absolute inset-0">
      <div ref={host} className="w-full h-full" data-testid="route-real-map" />
      {failed ? <div className="absolute inset-x-3 top-3 z-[5] mx-auto max-w-md cn-panel px-4 py-3 text-sm" role="status">{labels.tilesFailed}</div> : null}
    </div>
  );
}
