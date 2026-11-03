import { expect, test, type Page } from "@playwright/test";
import { did } from "@campusnav/data/demo";
import { enterDemo } from "../fixtures/student";

const BASE = "http://localhost:3000";
const SCI_S003 = did("sci-room-S003");

/** Stub the weather service so the test never depends on the real sky. */
async function stubWeather(page: Page, tempC: number, feelsC: number) {
  await page.route(/api\.open-meteo\.com/, (r) => r.fulfill({ json: { current: { temperature_2m: tempC, apparent_temperature: feelsC } } }));
}

test("home shows the next prayer for the campus, calculated offline", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z")); // 15:00 in Erbil, after Asr
  await enterDemo(page);
  await page.goto(`${BASE}/?v=2d`);
  const card = page.getByTestId("prayer-card");
  await expect(card).toContainText(/Maghrib in/);
  await card.getByRole("button", { name: "All times today" }).click();
  const times = page.getByTestId("prayer-times");
  await expect(times).toContainText("Fajr");
  await expect(times).toContainText("04:59"); // matches published Erbil times for this date
  await expect(card).toContainText("Muslim World League");
});

test("in Ramadan the card counts down to iftar", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-02-25T12:00:00Z")); // 8 Ramadan 1447, 15:00 Erbil
  await enterDemo(page);
  await page.goto(`${BASE}/?v=2d`);
  const card = page.getByTestId("prayer-card");
  await expect(card).toContainText("Ramadan Kareem");
  await expect(card).toContainText(/Asr in|Iftar in/);
});

test("hot day: outdoor route warns and offers indoor-first", async ({ page }) => {
  await stubWeather(page, 44, 47);
  await enterDemo(page);
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${SCI_S003}`);
  await expect(page.getByTestId("outdoor-m")).toContainText("outdoors");
  const notice = page.getByTestId("heat-notice");
  await expect(notice).toContainText("Extreme heat");
  await expect(notice).toContainText("carry water");
  await notice.getByRole("button", { name: "Prefer indoor paths" }).click();
  await expect(page.getByRole("radio", { name: "Indoor first" })).toHaveAttribute("aria-checked", "true");
});

test("mild day: no heat warning", async ({ page }) => {
  await stubWeather(page, 22, 21);
  await enterDemo(page);
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${SCI_S003}`);
  await expect(page.getByTestId("outdoor-m")).toBeVisible();
  await expect(page.getByTestId("heat-notice")).toHaveCount(0);
});

test("library is its own building: route goes outside, with an Outside view and step-free detour", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/q/DEMOsciMainEntrance01`);
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${did("lib-room-L001")}`);
  await expect(page.getByTestId("outdoor-m")).toContainText("60 m outdoors");
  await page.getByTestId("tab-outside").click();
  const view = page.getByTestId("outside-view");
  await expect(view.getByTestId("schematic-route")).toBeVisible();
  await expect(view).toContainText("Schematic: straight lines between buildings");
  await page.getByRole("radio", { name: "Step-free" }).click();
  await expect(page.getByTestId("outdoor-m")).toContainText("225 m outdoors");
});
