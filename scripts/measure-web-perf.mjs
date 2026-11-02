// Measures student web app load performance under emulated mobile conditions.
// Usage: start the production server (pnpm --filter @campusnav/web start), then: node scripts/measure-web-perf.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PROFILES = {
  // Lighthouse "slow 4G" mobile profile: 150 ms RTT, 1.6 Mbps down, 4x CPU slowdown
  "slow-4g": { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8, cpu: 4 },
  "fast-3g": { latency: 562, download: (1.44 * 1024 * 1024) / 8, upload: (675 * 1024) / 8, cpu: 4 },
};
const DEMO = "428a3a64-8fef-450d-824a-163e8f2fc957";

async function run(profileName, path, warm) {
  const p = PROFILES[profileName];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/offline`);
  await page.evaluate((uid) => localStorage.setItem("campusnav.prefs", JSON.stringify({ locale: "en", universityId: uid, onboarded: true, theme: "dark" })), DEMO);
  if (warm) await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  if (!warm) await cdp.send("Network.clearBrowserCache");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: p.latency, downloadThroughput: p.download, uploadThroughput: p.upload });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
  let bytes = 0;
  cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  // "Usable" = the main search input (home) or main heading is rendered and interactive.
  await page.waitForSelector(path === "/" ? 'input[role="combobox"]' : "h1", { state: "visible" });
  const usableMs = Date.now() - t0;
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const lcp = new Promise((res) => new PerformanceObserver((l) => res(l.getEntries().at(-1)?.startTime ?? null)).observe({ type: "largest-contentful-paint", buffered: true }));
    return Promise.race([lcp, new Promise((r) => setTimeout(() => r(null), 1500))]).then((l) => ({ ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, lcp: l }));
  });
  await browser.close();
  return { profile: profileName, path, cache: warm ? "warm" : "cold", usableMs, transferredKB: Math.round(bytes / 1024), ...Object.fromEntries(Object.entries(nav).map(([k, v]) => [k, v == null ? null : Math.round(v)])) };
}

const rows = [];
for (const profile of Object.keys(PROFILES)) for (const path of ["/", "/rooms/5aab5c60-cd51-4138-952e-cc2802d43170"]) for (const warm of [false, true]) rows.push(await run(profile, path, warm));
console.table(rows);
