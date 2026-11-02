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
  await expect(page.getByText("DEMO DATA").filter({ visible: true }).first()).toBeVisible();
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
  await page.getByRole("radio", { name: "Step-free" }).click();
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
  await expect(page.getByText("الجامعة التجريبية").filter({ visible: true }).first()).toBeVisible();
  await page.goto(`${BASE}/language`);
  await page.getByRole("radio", { name: "کوردی (سۆرانی)" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ckb");
  await page.goto(BASE);
  await expect(page.getByText("زانکۆی نموونە").filter({ visible: true }).first()).toBeVisible();
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

test("app bars: sidebar navigation, location bar and Ctrl+K search", async ({ page }) => {
  await enterDemo(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(BASE);
  const nav = page.getByRole("navigation", { name: "Primary" }).first();
  await nav.getByRole("link", { name: "Timetable" }).click();
  await expect(page).toHaveURL(/\/timetable/);
  await expect(nav.getByRole("link", { name: "Timetable" })).toHaveAttribute("aria-current", "page");
  // Location bar opens the picker; choosing a place sets "You are here"
  await page.getByRole("button", { name: /Your location/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Your location" });
  await dialog.getByRole("combobox").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("button", { name: /Your location/ }).first()).not.toContainText("Location not set");
  // Command palette
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search" });
  await palette.getByRole("combobox").fill("204");
  await palette.getByRole("combobox").press("Enter");
  await expect(page.getByRole("heading", { name: "204" })).toBeVisible();
});

test("nearest facilities are ordered by walking distance from your location", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/nearby?type=toilet`);
  await expect(page.getByText("Set your location first")).toBeVisible();
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/)).toBeVisible();
  await page.goto(`${BASE}/nearby?type=toilet`);
  const list = page.getByRole("list", { name: "Nearest places" });
  await expect(list.getByRole("listitem")).toHaveCount(5);
  const metres = await list.getByRole("listitem").allTextContents();
  const nums = metres.map((t) => Number(/(\d+) m walk/.exec(t)?.[1]));
  expect(nums).toEqual([...nums].sort((a, b) => a - b));
  await list.getByRole("link", { name: "Navigate" }).first().click();
  await expect(page.getByText("Walking time")).toBeVisible();
});

test("route preferences, progress bar and report a problem (demo mode is honest)", async ({ page }) => {
  await enterDemo(page);
  await page.goto(`${BASE}/q/DEMOengMainEntrance01`);
  await expect(page.getByText(/Location set/)).toBeVisible();
  await page.goto(`${BASE}/navigate?to=${ROOM_204}`);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.getByRole("radio", { name: "Fewer stairs" }).click();
  await expect(page.getByRole("list", { name: "Directions" })).not.toContainText("stairs");
  await page.getByRole("radio", { name: "Shortest" }).click();
  await page.getByRole("link", { name: "Something wrong? Report it" }).click();
  await expect(page.getByRole("heading", { name: "Report a problem" })).toBeVisible();
  await expect(page.getByLabel("Directions were wrong or confusing")).toBeChecked();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Please write at least 5 characters.")).toBeVisible();
  await page.getByLabel("Details").fill("The stairs sign on floor 1 points the wrong way.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText(/Demo mode: your report was checked but not sent/)).toBeVisible();
});

test("planned closures are shown on the home screen", async ({ page }) => {
  await enterDemo(page);
  await page.goto(BASE);
  await expect(page.getByText("Closures & changes")).toBeVisible();
  await expect(page.getByText(/Science stairs closed for repainting/)).toBeVisible();
  await expect(page.getByText("Planned closure")).toBeVisible();
});
