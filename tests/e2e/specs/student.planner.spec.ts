import { expect, test } from "@playwright/test";
import { did } from "@campusnav/data/demo";
import { enterDemo } from "../fixtures/student";

const BASE = "http://localhost:3000";
const ROOM_204 = did("eng-room-204");
const GROUP_CS1 = did("group-DEMO-CS-Y1-A");
// Sunday 1 Nov 2026, 08:12 in Erbil — DEMO-CS101 starts 08:30 in Room 204.
const SUN_0812 = new Date("2026-11-01T05:12:00Z");

test("leave-by coach tells the student when to set off for the next class", async ({ page }) => {
  await page.clock.setFixedTime(SUN_0812);
  await enterDemo(page, { groupId: GROUP_CS1 });
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto(`${BASE}/?v=2d`);
  const coach = page.getByTestId("leave-by");
  await expect(coach).toContainText(/Leave in \d+m/);
  await expect(coach).toContainText("walk from DEMO-ENG main entrance");
  await coach.getByRole("link", { name: "Navigate" }).click();
  await expect(page).toHaveURL(new RegExp(`/navigate\\?to=${ROOM_204}`));
});

test("leave-by asks for a location instead of guessing", async ({ page }) => {
  await page.clock.setFixedTime(SUN_0812);
  await enterDemo(page, { groupId: GROUP_CS1 });
  await page.goto(`${BASE}/?v=2d`);
  await expect(page.getByTestId("leave-by")).toHaveText("Set where you are to see when to leave.");
});

test("free rooms excludes rooms with a class now and shows until when the rest are free", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-01T06:00:00Z")); // Sunday 09:00
  await enterDemo(page);
  await page.goto(`${BASE}/free-rooms`);
  const list = page.getByTestId("free-rooms");
  await expect(list).toBeVisible();
  await expect(list.getByText(/^204 ·/)).toHaveCount(0); // DEMO-CS101 08:30–10:00
  await page.getByRole("button", { name: "60 min" }).click();
  await expect(list.locator("li", { hasText: "107 ·" })).toContainText("Free until 10:30");
  await page.getByRole("button", { name: "120 min" }).click();
  await expect(list.getByText(/^107 ·/)).toHaveCount(0);
  await expect(page.getByText("Based on the timetable only.")).toBeVisible();
});

test("3D route view offers a fly-through that can be stopped", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/).first()).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${ROOM_204}`);
  await page.getByRole("radio", { name: "3D" }).click();
  const play = page.getByTestId("route-play");
  await expect(play).toHaveAttribute("aria-label", "Play route");
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
});

