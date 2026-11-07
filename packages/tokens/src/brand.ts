/**
 * NULL-TECH studio mark: a ring crossed by a diagonal bar, black body with a
 * red edge. Vector redraw of the studio logo (docs/brand/null-tech-logo.webp)
 * so it stays crisp at icon sizes. ViewBox 0 0 100 100, drawn rotated -45°.
 */
export const NULL_TECH = {
  red: "#E11D2E",
  body: "#141414",
  ring: { cx: 50, cy: 50, r: 28, edge: 13, core: 9.5 },
  bar: { edge: { x: 2.5, y: 43, w: 95, h: 14, rx: 4.5 }, core: { x: 4.5, y: 44.75, w: 91, h: 10.5, rx: 3 } },
} as const;
