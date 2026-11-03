import { expect, test, type Page } from "@playwright/test";
import { stubMapTiles } from "../fixtures/maptiles";

const ADMIN = "http://localhost:3001";

async function openSandbox(page: Page) {
  await stubMapTiles(page);
  await page.goto(ADMIN);
  await page.evaluate(() => localStorage.clear());
  await page.goto(ADMIN);
  await page.getByRole("button", { name: "Open local sandbox" }).click();
  await expect(page.getByText("Map & navigation integrity")).toBeVisible();
  page.on("dialog", (d) => void d.accept());
}

async function clickMap(page: Page, testId: string, points: readonly (readonly [number, number])[]) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  for (const [fx, fy] of points) await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test("walkways: the demo campus network is listed with lengths and step markers", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/walkways`);
  const list = page.getByTestId("walkway-list");
  await expect(list.locator("li")).toHaveCount(5);
  await expect(list.locator("li", { hasText: "DEMO-SCI" }).filter({ hasText: "DEMO-LIB" })).toContainText("Steps");
  await expect(list).toContainText("140 m");
});

test("walkways: staff trace a real path between two buildings", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/walkways`);
  await page.getByLabel("From entrance").selectOption({ label: "DEMO-CAF · DEMO-CAF main entrance" });
  await page.getByLabel("To entrance").selectOption({ label: "DEMO-LIB · DEMO-LIB main entrance" });
  await page.getByRole("button", { name: "Trace by hand" }).click();
  await clickMap(page, "real-map-editor", [[0.3, 0.7], [0.3, 0.4], [0.6, 0.4], [0.6, 0.25]]);
  await expect(page.getByText(/\(4 points\)/)).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(/Path length: \d+ m/)).toBeVisible();
  await page.getByRole("button", { name: "Add walkway" }).click();
  await expect(page.getByText("Walkway added")).toBeVisible();
  const list = page.getByTestId("walkway-list");
  await expect(list.locator("li")).toHaveCount(6);
  await expect(list.locator("li", { hasText: "DEMO-CAF" }).filter({ hasText: "DEMO-LIB" })).toContainText("Real path");
});

test("walkways: OpenStreetMap suggestion follows mapped paths (stubbed OSM)", async ({ page }) => {
  // Synthetic path grid over whatever area is requested — not real OSM data.
  await page.route(/overpass-api\.de/, async (route) => {
    const q = new URLSearchParams(route.request().postData() ?? "").get("data") ?? "";
    const [s, w, n, e] = q.match(/\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)/)!.slice(1).map(Number) as [number, number, number, number];
    const elements = [];
    for (let i = 0; i <= 8; i++) {
      const lat = s + ((n - s) * i) / 8;
      const lon = w + ((e - w) * i) / 8;
      elements.push({ type: "way", tags: { highway: "footway" }, geometry: Array.from({ length: 9 }, (_, k) => ({ lat, lon: w + ((e - w) * k) / 8 })) });
      elements.push({ type: "way", tags: { highway: "footway" }, geometry: Array.from({ length: 9 }, (_, k) => ({ lat: s + ((n - s) * k) / 8, lon })) });
    }
    await route.fulfill({ json: { elements } });
  });
  await openSandbox(page);
  // Both buildings need outlines on the real map first.
  await page.goto(`${ADMIN}/real-map`);
  for (const [code, pts] of [
    ["DEMO-ENG", [[0.35, 0.55], [0.45, 0.55], [0.45, 0.65], [0.35, 0.65]]],
    ["DEMO-SCI", [[0.6, 0.35], [0.7, 0.35], [0.7, 0.45], [0.6, 0.45]]],
  ] as const) {
    await page.getByRole("list", { name: "Buildings on the real map" }).getByRole("button", { name: new RegExp(code) }).click();
    await page.getByRole("button", { name: "Draw outline" }).click();
    await clickMap(page, "real-map-editor", pts);
    await page.getByRole("button", { name: "Finish & save" }).click();
    await expect(page.getByText(`Outline saved for ${code}`)).toBeVisible();
  }
  await page.goto(`${ADMIN}/walkways`);
  await page.getByRole("button", { name: /DEMO-ENG main entrance.*DEMO-SCI main entrance/ }).click();
  await expect(page.getByText("Path length: not drawn")).toBeVisible();
  await page.getByTestId("suggest-osm").click();
  await expect(page.getByText(/Suggested from OpenStreetMap: \d+ m/)).toBeVisible();
  await expect(page.getByText(/Path length: \d+ m · straight line \d+ m/)).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Walkway updated")).toBeVisible();
  await expect(page.getByTestId("walkway-list").locator("li", { hasText: "DEMO-ENG" }).filter({ hasText: "DEMO-SCI" })).toContainText("Real path");
});
