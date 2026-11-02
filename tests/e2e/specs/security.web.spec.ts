import { expect, test } from "@playwright/test";

const BASE = "http://localhost:3000";

test("security headers are set on the student app", async ({ request }) => {
  const res = await request.get(BASE);
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["permissions-policy"]).toContain("geolocation=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("checkpoint API validates input and never returns tokens", async ({ request }) => {
  const ok = await request.get(`${BASE}/api/checkpoint/DEMOengMainEntrance01`, { headers: { "x-forwarded-for": "10.9.0.1" } });
  expect(ok.status()).toBe(200);
  const body = await ok.text();
  expect(body).not.toContain("DEMOengMainEntrance01");
  const bad = await request.get(`${BASE}/api/checkpoint/${encodeURIComponent("' or 1=1 --")}`, { headers: { "x-forwarded-for": "10.9.0.1" } });
  expect(bad.status()).toBe(404);
});

test("checkpoint API is rate limited per client", async ({ request }) => {
  const ip = `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  let limited = false;
  for (let i = 0; i < 35; i++) {
    const r = await request.get(`${BASE}/api/checkpoint/ZZZZZZZZZZZZZZZZZZZZ`, { headers: { "x-forwarded-for": ip } });
    if (r.status() === 429) {
      limited = true;
      expect(r.headers()["retry-after"]).toBeTruthy();
      break;
    }
  }
  expect(limited).toBe(true);
});

test("admin app is not indexable and has no camera permission", async ({ request }) => {
  const h = (await request.get("http://localhost:3001")).headers();
  expect(h["x-robots-tag"]).toContain("noindex");
  expect(h["permissions-policy"]).toContain("camera=()");
});

test("checkpoint 'then' redirect only allows same-site paths", async ({ page }) => {
  await page.goto(`${BASE}/offline`);
  await page.evaluate(() => localStorage.setItem("campusnav.prefs", JSON.stringify({ locale: "en", universityId: "428a3a64-8fef-450d-824a-163e8f2fc957", onboarded: true })));
  await page.goto(`${BASE}/scan?then=${encodeURIComponent("/\\evil.example")}`);
  await page.getByPlaceholder("Code printed under the QR").fill("DEMOengMainEntrance01");
  await page.getByRole("button", { name: "Use code" }).click();
  // Unsafe target is ignored: the generic action is offered instead of "Continue".
  await expect(page.getByRole("link", { name: "Navigate from here" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
});
