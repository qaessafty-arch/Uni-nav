import { ImageResponse } from "next/og";
import { NULL_TECH as N } from "@campusnav/tokens";

export const alt = "UNI NAV: find your room, timetable and lecture files";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link-preview card shown when uni-nav.online is shared (Instagram, Telegram, WhatsApp…). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0E0F12", color: "#F4F5F7", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 100 100">
            <g transform="rotate(-45 50 50)">
              <circle cx={N.ring.cx} cy={N.ring.cy} r={N.ring.r} fill="none" stroke={N.red} strokeWidth={N.ring.edge} />
              <circle cx={N.ring.cx} cy={N.ring.cy} r={N.ring.r} fill="none" stroke="#F4F5F7" strokeWidth={N.ring.core} />
              <rect x={N.bar.edge.x} y={N.bar.edge.y} width={N.bar.edge.w} height={N.bar.edge.h} rx={N.bar.edge.rx} fill={N.red} />
              <rect x={N.bar.core.x} y={N.bar.core.y} width={N.bar.core.w} height={N.bar.core.h} rx={N.bar.core.rx} fill="#F4F5F7" />
            </g>
          </svg>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 6 }}>UNI NAV</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1 }}>Find your room, your timetable and your lecture files.</div>
          <div style={{ fontSize: 30, color: "#A9AEB8" }}>Campus map · indoor directions · class timetable · free rooms</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26 }}>
          <div style={{ color: N.red, fontWeight: 700 }}>uni-nav.online</div>
          <div style={{ color: "#7D8390" }}>Student project · not an official university app · by NULL-TECH</div>
        </div>
      </div>
    ),
    size,
  );
}
