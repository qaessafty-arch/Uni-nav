import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Real-world base map (vector tiles). Default: OpenFreeMap (free, no key, OpenStreetMap data).
const mapStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
const mapOrigin = new URL(mapStyleUrl).origin;
// OpenStreetMap Overpass API: walkway suggestions on the Walkways page (only a bounding box is sent).
const overpassOrigin = "https://overpass-api.de";
const connectSrc = ["'self'", supabaseUrl, supabaseUrl.replace(/^http/, "ws"), mapOrigin, overpassOrigin].filter(Boolean).join(" ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline bootstrap scripts require 'unsafe-inline' without a nonce setup.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${mapOrigin} ${supabaseUrl}`.trim(),
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:", // the map library runs its tile workers from blob: URLs
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // Admin needs no device permissions.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@campusnav/core", "@campusnav/data", "@campusnav/i18n", "@campusnav/map-web", "@campusnav/tokens"],
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
    ];
  },
};

export default config;
