const { chromium } = require("/home/user/Uni-nav/node_modules/playwright");
const QR = require("/home/user/Uni-nav/node_modules/qrcode");
const fs = require("fs");
const path = require("path");
const OUT = "/home/user/Uni-nav/docs/launch";
fs.mkdirSync(OUT, { recursive: true });
const NM = "/home/user/Uni-nav/node_modules";
const font = (p) => "data:font/woff2;base64," + fs.readFileSync(p).toString("base64");
const INTER = font(`${NM}/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2`);
const AR4 = font(`${NM}/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff2`);
const AR7 = font(`${NM}/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2`);
const RED = "#E11D2E";
const MARK = `<svg viewBox="0 0 100 100" width="100%" height="100%"><g transform="rotate(-45 50 50)"><circle cx="50" cy="50" r="28" fill="none" stroke="${RED}" stroke-width="13"/><circle cx="50" cy="50" r="28" fill="none" stroke="#F4F5F7" stroke-width="9.5"/><rect x="2.5" y="43" width="95" height="14" rx="4.5" fill="${RED}"/><rect x="4.5" y="44.75" width="91" height="10.5" rx="3" fill="#F4F5F7"/></g></svg>`;
const css = `
@font-face{font-family:Inter;src:url(${INTER}) format("woff2");font-weight:100 900}
@font-face{font-family:NA;src:url(${AR4}) format("woff2");font-weight:400}
@font-face{font-family:NA;src:url(${AR7}) format("woff2");font-weight:700}
*{box-sizing:border-box;margin:0}
body{background:#0E0F12;color:#F4F5F7;font-family:Inter,sans-serif}
.page{position:relative;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;
  background:radial-gradient(900px 700px at 85% 10%,rgba(225,29,46,.22),transparent 60%),#0E0F12}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:60px 60px}
.brand{display:flex;align-items:center;gap:22px;font-weight:800;letter-spacing:.14em}
.mark{display:inline-block}
.ku{font-family:NA,sans-serif;direction:rtl;text-align:right;color:#C9CDD5}
.foot{display:flex;justify-content:space-between;align-items:flex-end;color:#7D8390}
.url{color:${RED};font-weight:800}
.chip{display:inline-block;border:2px solid #2A2D35;border-radius:999px;padding:10px 22px;color:#A9AEB8}
`;
const posts = [
  { n: 1, kicker: "01 · Find", en: "Find any room at SUE in seconds.", sub: "Search a room, lecturer or building. Get walking directions, floor by floor.", ku: "هەر ژوورێک لە زانکۆ لە چەند چرکەیەکدا بدۆزەرەوە." },
  { n: 2, kicker: "02 · Timetable", en: "Your timetable. Only for your class.", sub: "Verify with your university email. See your classes, rooms and changes — and nobody else's.", ku: "خشتەی وانەکانت، تەنها بۆ پۆلەکەت." },
  { n: 3, kicker: "03 · Lectures", en: "Lecture files from your class rep.", sub: "PDFs and slides on each course page, with a badge when something new is posted.", ku: "فایلی وانەکان لە نوێنەری پۆلەکەتەوە." },
];
const page = (w, h, inner) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="page" style="width:${w}px;height:${h}px;padding:${Math.round(w * 0.075)}px"><div class="grid"></div>${inner}</div></body></html>`;
const brand = (s) => `<div class="brand" style="font-size:${s}px;position:relative"><span class="mark" style="width:${s * 1.5}px;height:${s * 1.5}px">${MARK}</span>UNI NAV</div>`;
const foot = (s, url = "uni-nav.online", stack = false) => `<div class="foot" style="font-size:${s}px;position:relative;${stack ? "flex-direction:column;align-items:flex-start;gap:12px" : ""}"><span class="url">${url}</span><span>Student project · not an official university app</span></div>`;

(async () => {
  const b = await chromium.launch();
  const shot = async (html, w, h, file) => {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, file) });
    await p.close();
  };
  for (const x of posts) {
    await shot(page(1080, 1350, `${brand(44)}
      <div style="position:relative">
        <div class="chip" style="font-size:28px;margin-bottom:36px">${x.kicker}</div>
        <div style="font-size:104px;font-weight:800;line-height:1.02;letter-spacing:-.02em">${x.en}</div>
        <div style="font-size:36px;color:#A9AEB8;margin-top:32px;line-height:1.35">${x.sub}</div>
        <div class="ku" style="font-size:46px;font-weight:700;margin-top:44px;line-height:1.5">${x.ku}</div>
      </div>${foot(30)}`), 1080, 1350, `post-${x.n}.png`);
    await shot(page(1080, 1920, `${brand(50)}
      <div style="position:relative">
        <div class="chip" style="font-size:32px;margin-bottom:44px">${x.kicker}</div>
        <div style="font-size:118px;font-weight:800;line-height:1.02;letter-spacing:-.02em">${x.en}</div>
        <div class="ku" style="font-size:54px;font-weight:700;margin-top:52px;line-height:1.5">${x.ku}</div>
        <div style="margin-top:90px;border:3px solid ${RED};border-radius:28px;padding:36px 40px;font-size:40px;line-height:1.4">
          Open <b class="url">uni-nav.online</b><br><span style="color:#A9AEB8">→ Share → Add to Home Screen. No app store needed.</span>
          <div class="ku" style="font-size:38px;margin-top:14px">بیکەرەوە و زیادی بکە بۆ شاشەی سەرەکی</div>
        </div>
      </div>${foot(32, "uni-nav.online", true)}`), 1080, 1920, `story-${x.n}.png`);
  }
  // A4 QR poster (print as PDF)
  const qr = await QR.toString("https://uni-nav.online/?ref=poster", { type: "svg", margin: 1, color: { dark: "#0E0F12", light: "#FFFFFF" }, errorCorrectionLevel: "M" }).then((x) => x.replace("<svg ", '<svg width="100%" height="100%" '));
  const poster = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    @page{size:A4;margin:0} body{background:#0E0F12} .page{width:210mm;height:297mm;padding:16mm}</style></head><body>
    <div class="page"><div class="grid"></div>${brand(34)}
      <div style="position:relative">
        <div style="font-size:64px;font-weight:800;line-height:1.03;letter-spacing:-.02em">Lost on campus?<br>Find your room.</div>
        <div class="ku" style="font-size:34px;font-weight:700;margin-top:14px">ژوورەکەت بدۆزەرەوە</div>
        <div style="display:flex;gap:12mm;align-items:center;margin-top:12mm">
          <div style="background:#fff;border-radius:6mm;padding:5mm;width:78mm;height:78mm">${qr}</div>
          <div style="font-size:22px;line-height:1.5;color:#C9CDD5">Scan with your camera.<br>Rooms · directions · timetable · lecture files.<br><span class="url" style="font-size:28px">uni-nav.online</span></div>
        </div>
      </div>${foot(16)}</div></body></html>`;
  const p = await b.newPage();
  await p.setContent(poster, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(OUT, "qr-poster-A4.pdf"), format: "A4", printBackground: true });
  await p.setViewportSize({ width: 794, height: 1123 });
  await p.screenshot({ path: path.join(OUT, "qr-poster-preview.png") });
  await b.close();
  console.log(fs.readdirSync(OUT).join("\n"));
})();
