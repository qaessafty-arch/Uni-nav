// NULL-TECH portfolio slides for the Commerce Platform Architecture project. Run: node docs/launch/commerce/generate.cjs
const { chromium } = require("/home/user/Uni-nav/node_modules/playwright");
const fs = require("fs"), path = require("path");
const OUT = __dirname, NM = "/home/user/Uni-nav/node_modules";
const font = (p) => "data:font/woff2;base64," + fs.readFileSync(p).toString("base64");
const INTER = font(`${NM}/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2`);
const AR7 = font(`${NM}/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2`);
const img = (f) => "data:image/png;base64," + fs.readFileSync(path.join(OUT, "assets", f)).toString("base64");
const RED = "#E11D2E";
const MARK = `<svg viewBox="0 0 100 100" width="100%" height="100%"><g transform="rotate(-45 50 50)"><circle cx="50" cy="50" r="28" fill="none" stroke="${RED}" stroke-width="13"/><circle cx="50" cy="50" r="28" fill="none" stroke="#F4F5F7" stroke-width="9.5"/><rect x="2.5" y="43" width="95" height="14" rx="4.5" fill="${RED}"/><rect x="4.5" y="44.75" width="91" height="10.5" rx="3" fill="#F4F5F7"/></g></svg>`;
const css = `@font-face{font-family:Inter;src:url(${INTER}) format("woff2");font-weight:100 900}
@font-face{font-family:NA;src:url(${AR7}) format("woff2");font-weight:700}
*{box-sizing:border-box;margin:0}body{background:#0E0F12;color:#F4F5F7;font-family:Inter,sans-serif}
.page{position:relative;width:1080px;height:1350px;padding:80px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:radial-gradient(900px 700px at 85% 10%,rgba(225,29,46,.22),transparent 60%),#0E0F12}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px}
.rel{position:relative}.top{display:flex;justify-content:space-between;align-items:center;font-size:26px;letter-spacing:.28em;color:#A9AEB8}
.mark{display:inline-block}.chip{display:inline-block;border:2px solid #2A2D35;border-radius:999px;padding:10px 22px;color:#A9AEB8;font-size:28px}
.h{font-size:84px;font-weight:800;line-height:1.03;letter-spacing:-.02em}.sub{font-size:32px;color:#A9AEB8;line-height:1.4}
.ku{font-family:NA,sans-serif;direction:rtl;text-align:right;color:#C9CDD5;font-weight:700}
.frame{border:2px solid #2A2D35;border-radius:24px;overflow:hidden;background:#0B0F1C}
.foot{display:flex;justify-content:space-between;font-size:26px;color:#7D8390}.red{color:${RED};font-weight:800}`;
const top = (n) => `<div class="top rel"><span>NULL-TECH · PROJECT</span><span>${n}</span></div>`;
const foot = `<div class="foot rel"><span class="red">@nullt_ech</span><span>Architecture design · Swipe →</span></div>`;
const steps = [
  ["Edge", "Cloudflare serves the storefront and checks API calls (WAF, bots) before they reach the gateway."],
  ["Gateway", "Kong verifies the login token, applies rate limits and routes to the right service."],
  ["Order write", "The Orders API saves the order and an outbox row in one PostgreSQL transaction, then replies."],
  ["Fan-out", "order.created goes to Kafka. Search and notifications catch up on their own time, so checkout never waits."],
  ["Payment", "Billing charges through Stripe; the invoice PDF is stored in S3 and emailed."],
];
const slides = [
  ["0-cover", `${top("01/05")}<div class="rel" style="display:flex;flex-direction:column;gap:36px">
      <span class="mark" style="width:220px;height:220px">${MARK}</span>
      <div style="font-size:112px;font-weight:800;line-height:1;letter-spacing:-.01em">Commerce<br>Platform<br>Architecture</div>
      <div class="sub" style="font-size:40px">A production-ready blueprint for an online store: five layers, one checkout path.</div>
      <div class="ku" style="font-size:40px">نەخشەی تەکنیکیی پلاتفۆرمێکی بازرگانیی ئۆنلاین</div></div>${foot}`],
  ["1-full", `${top("02/05")}<div class="rel"><div class="chip" style="margin-bottom:26px">The whole system</div>
      <div class="h" style="font-size:76px">Five layers.<br>One platform.</div>
      <div class="frame" style="margin-top:40px;height:560px"><img src="${img("full.png")}" style="width:100%;height:100%;object-fit:contain"/></div>
      <div class="sub" style="font-size:26px;margin-top:16px">Clients · Edge · Services · Events &amp; data · Platform</div></div>${foot}`],
  ["2-front", `${top("03/05")}<div class="rel"><div class="chip" style="margin-bottom:26px">Front door</div>
      <div class="h" style="font-size:76px">Every request passes the edge first.</div>
      <div class="frame" style="margin-top:40px;height:520px"><img src="${img("top.png")}" style="width:100%;height:100%;object-fit:contain"/></div>
      <div class="sub" style="font-size:26px;margin-top:16px">Web, mobile, partners and admin → Cloudflare → Kong → six services</div></div>${foot}`],
  ["3-back", `${top("04/05")}<div class="rel"><div class="chip" style="margin-bottom:26px">Behind the scenes</div>
      <div class="h" style="font-size:76px">Events, data and the platform underneath.</div>
      <div class="frame" style="margin-top:40px;height:520px"><img src="${img("bottom.png")}" style="width:100%;height:100%;object-fit:contain"/></div>
      <div class="sub" style="font-size:26px;margin-top:16px">Kafka · PostgreSQL · Redis · OpenSearch · S3 · Stripe · EKS · Grafana · Vault · Argo CD</div></div>${foot}`],
  ["4-checkout", `${top("05/05")}<div class="rel"><div class="chip" style="margin-bottom:26px">One checkout, step by step</div>
      <div class="h" style="font-size:72px">Follow a checkout request.</div>
      <div style="margin-top:40px;display:flex;flex-direction:column;gap:18px">${steps.map(([t, d], i) => `<div style="display:flex;gap:24px;align-items:flex-start;border:2px solid #2A2D35;border-radius:20px;padding:22px 26px;background:rgba(255,255,255,.02)">
        <span style="flex:none;width:52px;height:52px;border-radius:50%;background:#2DD4BF;color:#0E0F12;font-weight:800;font-size:28px;display:grid;place-items:center">${i + 1}</span>
        <div><div style="font-size:32px;font-weight:700">${t}</div><div style="font-size:25px;color:#A9AEB8;line-height:1.35;margin-top:4px">${d}</div></div></div>`).join("")}</div></div>
      <div class="foot rel"><span class="red">@nullt_ech</span><span>Designed by NULL-TECH</span></div>`],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, inner] of slides) {
    const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="page"><div class="grid"></div>${inner}</div></body></html>`, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `commerce-${name}.png`) });
    await p.close();
  }
  await b.close();
})();
