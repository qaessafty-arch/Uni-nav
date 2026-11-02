/**
 * Conservative SVG floor-plan sanitizer for uploads.
 *
 * Floor plans are later displayed through <image href>, which browsers render in
 * "secure static mode" (no scripts, no external loads). This sanitizer is a
 * second layer: it rejects files that contain active content rather than trying
 * to repair them, so administrators get a clear error.
 */
export const MAX_SVG_BYTES = 2 * 1024 * 1024;

export type SvgCheck =
  | { ok: true; svg: string; width: number | null; height: number | null }
  | { ok: false; reason: "too_large" | "not_svg" | "active_content" | "external_reference" | "entity_declaration" };

const ACTIVE = [
  /<\s*script\b/i,
  /<\s*foreignObject\b/i,
  /<\s*iframe\b/i,
  /<\s*embed\b/i,
  /<\s*object\b/i,
  /<\s*handler\b/i,
  /<\s*set\b[^>]*attributeName\s*=\s*["']?(href|xlink:href|on)/i,
  /<\s*animate\b[^>]*attributeName\s*=\s*["']?(href|xlink:href|on)/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
];

export function checkSvg(input: string): SvgCheck {
  if (new TextEncoder().encode(input).length > MAX_SVG_BYTES) return { ok: false, reason: "too_large" };
  const s = input.replace(/^﻿/, "").trim();
  if (/<!ENTITY/i.test(s) || /<!DOCTYPE[^>]*\[/i.test(s)) return { ok: false, reason: "entity_declaration" };
  if (!/<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return { ok: false, reason: "not_svg" };
  for (const re of ACTIVE) if (re.test(s)) return { ok: false, reason: "active_content" };
  // Only allow fragment references (#id) and inline raster data images.
  const hrefs = [...s.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1]!.trim());
  for (const h of hrefs) if (!h.startsWith("#") && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(h)) return { ok: false, reason: "external_reference" };
  if (/url\(\s*["']?(?!#)/i.test(s)) return { ok: false, reason: "external_reference" };
  if (/@import/i.test(s)) return { ok: false, reason: "external_reference" };

  const root = /<svg\b([^>]*)>/i.exec(s)?.[1] ?? "";
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(root);
  const w = /\swidth\s*=\s*["']([\d.]+)/i.exec(root);
  const h = /\sheight\s*=\s*["']([\d.]+)/i.exec(root);
  return {
    ok: true,
    svg: s,
    width: vb ? Number(vb[1]) : w ? Number(w[1]) : null,
    height: vb ? Number(vb[2]) : h ? Number(h[1]) : null,
  };
}
