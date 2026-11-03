import type { LngLat, NavEdge } from "../model/types";
import { MinHeap } from "../navigation/heap";

/**
 * Real-world (WGS84) helpers for outdoor walkways: distances, routing along a
 * walkway network (e.g. OpenStreetMap footways) and stitching a route's
 * outdoor legs into one line for the map.
 */

const R = 6_371_008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function polylineLengthM(points: LngLat[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineM(points[i - 1]!, points[i]!);
  return d;
}

export function centroid(points: LngLat[]): LngLat {
  const n = points.length || 1;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

// ───────────────────────── Walkway network routing ─────────────────────────

export interface Walkway {
  /** Points in order; consecutive ways that share a point are connected there. */
  points: LngLat[];
  /** e.g. OSM highway=steps — skipped for step-free suggestions. */
  steps?: boolean;
}

export interface WalkwayNetwork {
  points: LngLat[];
  adj: { to: number; m: number; steps: boolean }[][];
}

const key = (p: LngLat) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;

/** Build a graph from walkway polylines; identical coordinates become one junction. */
export function buildWalkwayNetwork(ways: Walkway[]): WalkwayNetwork {
  const index = new Map<string, number>();
  const points: LngLat[] = [];
  const adj: WalkwayNetwork["adj"] = [];
  const id = (p: LngLat) => {
    const k = key(p);
    let i = index.get(k);
    if (i == null) {
      i = points.length;
      index.set(k, i);
      points.push([Number(p[0].toFixed(7)), Number(p[1].toFixed(7))]);
      adj.push([]);
    }
    return i;
  };
  for (const w of ways) {
    for (let i = 1; i < w.points.length; i++) {
      const a = id(w.points[i - 1]!);
      const b = id(w.points[i]!);
      if (a === b) continue;
      const m = haversineM(points[a]!, points[b]!);
      adj[a]!.push({ to: b, m, steps: !!w.steps });
      adj[b]!.push({ to: a, m, steps: !!w.steps });
    }
  }
  return { points, adj };
}

function nearestIndex(net: WalkwayNetwork, p: LngLat): { i: number; m: number } | null {
  let best: { i: number; m: number } | null = null;
  net.points.forEach((q, i) => {
    if (!net.adj[i]!.length) return;
    const m = haversineM(p, q);
    if (!best || m < best.m) best = { i, m };
  });
  return best;
}

export interface WalkwaySuggestion {
  /** Full path: from-point → walkways → to-point. */
  path: LngLat[];
  lengthM: number;
  /** Straight gaps (metres) between the buildings and the walkway network. */
  gapStartM: number;
  gapEndM: number;
  usesSteps: boolean;
}

/**
 * Shortest path along the walkway network between two points (typically
 * building entrances or footprint centres). The ends are joined to the nearest
 * walkway point with a straight segment, reported as a gap so staff can check
 * it. Returns null when no connected path exists or a gap exceeds `maxGapM`.
 */
export function suggestWalkway(ways: Walkway[] | WalkwayNetwork, from: LngLat, to: LngLat, o: { stepFree?: boolean; maxGapM?: number } = {}): WalkwaySuggestion | null {
  const net = Array.isArray(ways) ? buildWalkwayNetwork(ways) : ways;
  const maxGap = o.maxGapM ?? 120;
  const s = nearestIndex(net, from);
  const t = nearestIndex(net, to);
  if (!s || !t || s.m > maxGap || t.m > maxGap) return null;
  const dist = new Float64Array(net.points.length).fill(Infinity);
  const prev = new Int32Array(net.points.length).fill(-1);
  const viaSteps = new Uint8Array(net.points.length);
  const heap = new MinHeap<number>();
  dist[s.i] = 0;
  heap.push(s.i, 0);
  while (heap.size) {
    const u = heap.pop()!;
    if (u === t.i) break;
    for (const e of net.adj[u]!) {
      if (o.stepFree && e.steps) continue;
      const nd = dist[u]! + e.m;
      if (nd < dist[e.to]!) {
        dist[e.to] = nd;
        prev[e.to] = u;
        viaSteps[e.to] = viaSteps[u]! || (e.steps ? 1 : 0);
        heap.push(e.to, nd);
      }
    }
  }
  if (!Number.isFinite(dist[t.i]!)) return null;
  const chain: LngLat[] = [];
  for (let v = t.i; v !== -1; v = prev[v]!) chain.push(net.points[v]!);
  chain.reverse();
  const path = [from, ...chain, to];
  return { path: dedupe(path), lengthM: dist[t.i]! + s.m + t.m, gapStartM: s.m, gapEndM: t.m, usesSteps: !!viaSteps[t.i] };
}

function dedupe(p: LngLat[]): LngLat[] {
  return p.filter((q, i) => i === 0 || q[0] !== p[i - 1]![0] || q[1] !== p[i - 1]![1]);
}

/** Pedestrian-usable ways from an Overpass `out geom` response (OpenStreetMap). */
export function walkwaysFromOverpass(json: unknown): Walkway[] {
  const els = (json as { elements?: unknown[] })?.elements;
  if (!Array.isArray(els)) return [];
  const out: Walkway[] = [];
  for (const el of els as { type?: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }[]) {
    if (el.type !== "way" || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const t = el.tags ?? {};
    if (t.foot === "no" || t.access === "private" || t.access === "no") continue;
    if (["motorway", "trunk", "motorway_link", "trunk_link"].includes(t.highway ?? "")) continue;
    out.push({ points: el.geometry.map((g) => [g.lon, g.lat] as LngLat), steps: t.highway === "steps" });
  }
  return out;
}

/** Overpass QL for walkable ways inside a bounding box [[minLng,minLat],[maxLng,maxLat]]. */
export function overpassWalkwayQuery(bbox: [LngLat, LngLat]): string {
  const [[w, s], [e, n]] = bbox;
  return `[out:json][timeout:25];way["highway"~"^(footway|path|pedestrian|steps|living_street|service|residential|unclassified|track|cycleway)$"](${s},${w},${n},${e});out geom;`;
}

// ───────────────────────── Route display ─────────────────────────

/**
 * The real-world line of a route's outdoor legs, in walking order (legs walked
 * against the stored direction are reversed). Legs without geometry break the
 * line into separate parts and are reported so the UI can say so.
 */
export function routeOutdoorGeometry(legs: { edge: NavEdge; from: { id: string }; to: { id: string } }[]): { parts: LngLat[][]; missing: number } {
  const parts: LngLat[][] = [];
  let missing = 0;
  let current: LngLat[] = [];
  const flush = () => {
    if (current.length >= 2) parts.push(current);
    current = [];
  };
  for (const l of legs) {
    if (l.edge.kind !== "outdoor") {
      flush();
      continue;
    }
    const g = l.edge.geometry;
    if (!g || g.length < 2) {
      missing++;
      flush();
      continue;
    }
    const pts = l.edge.fromNodeId === l.from.id ? g : [...g].reverse();
    current = current.length ? [...current, ...pts.slice(1)] : [...pts];
  }
  flush();
  return { parts, missing };
}
