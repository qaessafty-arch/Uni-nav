/** Platform-neutral zoom/pan math for SVG floor maps (used by web and React Native). */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;

export function fitViewBox(width: number, height: number, padding = 0.04): ViewBox {
  const px = width * padding;
  const py = height * padding;
  return { x: -px, y: -py, w: width + 2 * px, h: height + 2 * py };
}

/** Zoom by `factor` (>1 zooms in) keeping the point (cx, cy) in map units fixed. */
export function zoomAt(vb: ViewBox, factor: number, cx: number, cy: number, base: ViewBox): ViewBox {
  const zoom = base.w / vb.w;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
  const f = zoom / nextZoom;
  const w = vb.w * f;
  const h = vb.h * f;
  return { x: cx - (cx - vb.x) * f, y: cy - (cy - vb.y) * f, w, h };
}

export function pan(vb: ViewBox, dx: number, dy: number): ViewBox {
  return { ...vb, x: vb.x - dx, y: vb.y - dy };
}

/** View box centred on a point at a given zoom relative to `base`. */
export function focusOn(base: ViewBox, x: number, y: number, zoom = 2.5): ViewBox {
  const w = base.w / zoom;
  const h = base.h / zoom;
  return { x: x - w / 2, y: y - h / 2, w, h };
}

/** Bounding view box around points with padding, never zooming beyond MAX_ZOOM. */
export function fitPoints(base: ViewBox, pts: { x: number; y: number }[], pad = 40, maxZoom = 3): ViewBox {
  if (!pts.length) return base;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  let x = Math.min(...xs) - pad;
  let y = Math.min(...ys) - pad;
  let w = Math.max(...xs) - x + pad;
  let h = Math.max(...ys) - y + pad;
  const aspect = base.w / base.h;
  if (w / h > aspect) {
    const nh = w / aspect;
    y -= (nh - h) / 2;
    h = nh;
  } else {
    const nw = h * aspect;
    x -= (nw - w) / 2;
    w = nw;
  }
  const minW = base.w / Math.min(maxZoom, MAX_ZOOM);
  if (w < minW) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    w = minW;
    h = minW / aspect;
    x = cx - w / 2;
    y = cy - h / 2;
  }
  return { x, y, w, h };
}

export function shapeCenter(shape: { type: "rect"; x: number; y: number; w: number; h: number } | { type: "polygon"; points: [number, number][] }): { x: number; y: number } {
  if (shape.type === "rect") return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
  const n = shape.points.length;
  return { x: shape.points.reduce((s, p) => s + p[0], 0) / n, y: shape.points.reduce((s, p) => s + p[1], 0) / n };
}

export function polygonPath(points: [number, number][]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ") + " Z";
}
