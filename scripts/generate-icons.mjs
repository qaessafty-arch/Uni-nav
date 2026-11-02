// Renders the CAMPUS NAV mark to PNG icons for the PWA and the Expo app.
// Usage: node scripts/generate-icons.mjs   (uses the pre-installed Playwright Chromium)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mark = (pad, bg = "#0B0C0D") => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <rect width="100" height="100" fill="${bg}"/>
  <g transform="translate(${pad} ${pad}) scale(${(100 - 2 * pad) / 24})">
    <rect x="1" y="1" width="22" height="22" fill="none" stroke="#EDEDE8" stroke-width="2"/>
    <path d="M6 18 L6 10 L14 10 L14 6" fill="none" stroke="#2BFF88" stroke-width="2.5" stroke-linecap="square"/>
    <rect x="15.5" y="15.5" width="3" height="3" fill="#2BFF88"/>
  </g>
</svg>`;
const splash = `
<div style="width:100%;height:100%;background:#0B0C0D;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:monospace;color:#EDEDE8">
  <div style="width:22%;aspect-ratio:1">${mark(14)}</div>
  <div style="margin-top:4%;font-size:4vw;letter-spacing:0.2em;font-weight:600">CAMPUS NAV</div>
  <div style="margin-top:1%;font-size:2vw;letter-spacing:0.3em;color:#6B737C">NULL-TECH</div>
</div>`;

const targets = [
  ["apps/web/public/icons/icon-192.png", 192, mark(12)],
  ["apps/web/public/icons/icon-512.png", 512, mark(12)],
  ["apps/web/public/icons/icon-maskable-512.png", 512, mark(24)],
  ["apps/admin/public/icon.png", 192, mark(12)],
  ["apps/mobile/assets/icon.png", 1024, mark(12)],
  ["apps/mobile/assets/adaptive-icon.png", 1024, mark(24, "transparent")],
  ["apps/mobile/assets/splash-icon.png", 1024, mark(14, "transparent")],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [out, size, svg] of targets) {
  mkdirSync(dirname(resolve(root, out)), { recursive: true });
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: resolve(root, out), omitBackground: true });
  console.log("wrote", out);
}
await page.setViewportSize({ width: 1284, height: 2778 });
await page.setContent(`<html><body style="margin:0;width:100vw;height:100vh">${splash}</body></html>`);
await page.screenshot({ path: resolve(root, "apps/mobile/assets/splash.png") });
await browser.close();
