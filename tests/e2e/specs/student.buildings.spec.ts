import { expect, test } from "@playwright/test";
import { did } from "@campusnav/data/demo";
import { enterDemo } from "../fixtures/student";

const BASE = "http://localhost:3000";
const SUN_1000 = new Date("2026-11-01T07:00:00Z"); // Sunday 10:00 Erbil
const FRI_1000 = new Date("2026-11-06T07:00:00Z"); // Friday 10:00 Erbil

test("building directory: every building with its icon, hours and an open-now filter", async ({ page }) => {
  await page.clock.setFixedTime(SUN_1000);
  await enterDemo(page);
  await page.goto(`${BASE}/buildings`);
  const cards = page.getByTestId("building-cards").locator("li");
  await expect(cards).toHaveCount(4);
  await expect(cards.filter({ hasText: "Demo Central Library" })).toContainText("Open · closes 20:00");
  await page.getByRole("button", { name: "Open now" }).click();
  await expect(cards).toHaveCount(4);
});

test("on Friday the library is closed, says when it opens, and the route warns", async ({ page }) => {
  await page.clock.setFixedTime(FRI_1000);
  await enterDemo(page);
  await page.goto(`${BASE}/buildings`);
  const lib = page.getByTestId("building-cards").locator("li", { hasText: "Demo Central Library" });
  await expect(lib).toContainText("Closed · opens Saturday 09:00");
  await page.getByRole("button", { name: "Open now" }).click();
  await expect(page.getByTestId("building-cards")).toHaveCount(0);

  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${did("lib-room-L001")}`);
  await expect(page.getByTestId("dest-closed")).toContainText("Demo Central Library is closed now.");
});

test("building page shows the weekly hours", async ({ page }) => {
  await page.clock.setFixedTime(SUN_1000);
  await enterDemo(page);
  await page.goto(`${BASE}/buildings/${did("demo-building-caf")}`);
  const table = page.getByTestId("hours-table");
  await expect(table).toContainText("07:30–12:00, 12:30–16:00");
  await expect(table.locator("tr", { hasText: "Friday" })).toContainText("Closed");
});

test("nearest toilets can be filtered to men's or women's, and the choice is remembered", async ({ page }) => {
  await enterDemo(page, {}, "visitor");
  await page.goto("http://localhost:3000/q/DEMOengMainEntrance01");
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto("http://localhost:3000/nearby?type=toilet");
  const filter = page.getByTestId("gender-filter");
  await filter.getByRole("button", { name: "Women" }).click();
  const list = page.locator("ol.cn-panel");
  await expect(list.locator("li").first()).toContainText("Women");
  await expect(list.locator("li").filter({ has: page.getByText("Men", { exact: true }) })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("gender-filter").getByRole("button", { name: "Women" })).toHaveAttribute("aria-pressed", "true");
});
