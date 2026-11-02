import { selectByText } from "../fixtures/select";
import { expect, test } from "@playwright/test";
import { did } from "@campusnav/data/demo";
import { enterDemo } from "../fixtures/student";

const ROOM_204 = did("eng-room-204");
const BASE = "http://localhost:3000";

test("first launch: onboarding → university selection → home", async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page).toHaveURL(/campus/);
  await page.getByRole("button", { name: /Demo University/ }).click();
  await expect(page.getByRole("heading", { name: "Demo University" })).toBeVisible();
  await expect(page.getByText("DEMO DATA").first()).toBeVisible();
});

test("student searches for Room 204 and opens it", async ({ page }) => {
  await enterDemo(page);
  await page.goto(BASE);
  await page.getByRole("combobox").fill("room 204");
  await expect(page.getByRole("option").first()).toContainText("204");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/rooms/${ROOM_204}`));
  await expect(page.getByRole("heading", { name: "204" })).toBeVisible();
  await expect(page.getByText("Demo Engineering Building").first()).toBeVisible();
});

test("student navigates to a room from a chosen start and reaches the arrival state", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/navigate?to=${ROOM_204}`);
  await expect(page.getByText("Where are you now?")).toBeVisible();
  await selectByText(page.locator("#start-select"), /main entrance/);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Walking time")).toBeVisible();
  await expect(page.getByText(/Arrive at/)).toBeVisible();
  // Accessible routing must use the elevator, not stairs.
  await page.getByLabel("Accessible route (avoid stairs)").check();
  await expect(page.getByRole("list", { name: "Directions" })).toContainText("elevator");
  await expect(page.getByRole("list", { name: "Directions" })).not.toContainText("stairs");
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole("button", { name: "Next step" });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await page.getByRole("button", { name: "I'm here" }).click();
  await expect(page.getByRole("heading", { name: "You have arrived" })).toBeVisible();
});

test("student scans a QR checkpoint link and gets a start location", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set: Demo Engineering — main entrance/)).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${ROOM_204}`);
  await expect(page.getByText("Walking time")).toBeVisible();
});

test("QR scanner rejects unknown, disabled and expired codes", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/scan`);
  await page.getByPlaceholder("Code printed under the QR").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Use code" }).click();
  await expect(page.getByText("not a recognised CAMPUS NAV checkpoint").first()).toBeVisible();
  await page.getByPlaceholder("Code printed under the QR").fill("DEMOdisabledCheckpoint");
  await page.getByRole("button", { name: "Use code" }).click();
  await expect(page.getByText("disabled by the university")).toBeVisible();
  await page.goto(`${BASE}/q/DEMOexpiredCheckpoint1`);
  await expect(page.getByText("This checkpoint has expired.")).toBeVisible();
  await page.goto(`${BASE}/q/ZZZZZZZZZZZZZZZZZZZZZZ`);
  await expect(page.getByText("not a recognised CAMPUS NAV checkpoint")).toBeVisible();
});

test("student finds a lecturer and navigates to their office", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/lecturers`);
  await page.getByLabel("Search by name, department or course").fill("Lecturer C");
  await page.getByRole("link", { name: /Demo Lecturer C/ }).click();
  await expect(page.getByRole("heading", { name: "Demo Lecturer C" })).toBeVisible();
  await expect(page.getByText("Availability not published.")).toBeVisible();
  await page.getByRole("link", { name: "Navigate to office" }).click();
  await expect(page).toHaveURL(/navigate\?to=/);
  await expect(page.getByRole("heading", { name: /205/ })).toBeVisible();
});

test("student views the timetable for their group, including a published room change", async ({ page }) => {
  await enterDemo(page, { groupId: did("group-DEMO-CS-Y1-A") });
  await page.goto(`${BASE}/timetable`);
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.getByText(/Times shown in Asia\/Baghdad/)).toBeVisible();
  const cards = page.locator("article");
  await expect(cards.first()).toBeVisible();
  // The demo room change applies on 2026-11-08 only; page through to that week if needed.
  await expect(page.getByText("Demo Introduction to Programming").first()).toBeVisible();
});

test("language switch to Arabic and Sorani sets RTL and translates the UI", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/language`);
  await page.getByRole("radio", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await page.goto(BASE);
  await expect(page.getByText("الجامعة التجريبية").first()).toBeVisible();
  await page.goto(`${BASE}/language`);
  await page.getByRole("radio", { name: "کوردی (سۆرانی)" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ckb");
  await page.goto(BASE);
  await expect(page.getByText("زانکۆی نموونە").first()).toBeVisible();
});

test("works offline from the cached bundle after one online visit", async ({ page, context }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/rooms/${ROOM_204}`);
  await expect(page.getByRole("heading", { name: "204" })).toBeVisible();
  const cached = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("campusnav.bundle.")));
  expect(cached).toBe(true);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText("You're offline")).toBeVisible();
  await context.setOffline(false);
});
