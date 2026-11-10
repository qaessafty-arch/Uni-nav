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

test("free rooms: a Computing student sees free Engineering rooms, with times", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-01T06:00:00Z")); // Sunday 09:00
  await enterDemo(page, { groupId: GROUP_CS1 });
  await page.goto(`${BASE}/free-rooms`);
  await expect(page.getByTestId("free-scope")).toContainText("Your major's building: Demo Engineering Building");
  const list = page.getByTestId("free-rooms");
  await expect(list.getByText(/^204 ·/)).toHaveCount(0); // DEMO-CS101 08:30–10:00
  await expect(list.getByText(/^S00\d ·/)).toHaveCount(0); // Science rooms are not offered
  await page.getByRole("button", { name: "60 min" }).click();
  await expect(list.locator("li", { hasText: "107 ·" })).toContainText("Free until 10:30");
  await page.getByRole("button", { name: "120 min" }).click();
  await expect(list.getByText(/^107 ·/)).toHaveCount(0);
  await expect(page.getByText("Based on the timetable only.")).toBeVisible();
});

test("visitors get the public view: no timetable, no free rooms, no classrooms", async ({ page }) => {
  await enterDemo(page, {}, "visitor");
  await page.goto(`${BASE}/timetable`);
  await expect(page.getByTestId("student-only")).toBeVisible();
  await page.goto(`${BASE}/free-rooms`);
  await expect(page.getByTestId("student-only")).toBeVisible();
  await page.goto(`${BASE}/rooms/${ROOM_204}`);
  await expect(page.getByText(/^204 ·|Demo Lecture Room 204/)).toHaveCount(0);
  await expect(page.getByTestId("access-chip").first()).toContainText("Visitor");
});

test("timetable shows the verified student's own major and year, not a free choice", async ({ page }) => {
  await enterDemo(page, {}, { email: "cs2@students.demo.example", departmentId: did("demo-dept-cs"), year: 2 });
  await page.goto(`${BASE}/timetable`);
  await expect(page.getByTestId("my-major-year")).toContainText("Demo Department of Computing · Year 2");
  await expect(page.getByLabel("Major")).toHaveCount(0);
});

test("a visitor verifies with a university email and the demo code", async ({ page }) => {
  await enterDemo(page, {}, "visitor");
  await page.goto(`${BASE}/timetable`);
  await page.getByTestId("verify-cta").click();
  await page.getByTestId("verify-email").fill("someone@gmail.com");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(/Use your university address/)).toBeVisible();
  await page.getByTestId("verify-email").fill("ce3@students.demo.example");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByTestId("verify-code").fill("246810");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(page.getByTestId("verify-done")).toContainText("Demo Department of Civil Engineering · Year 3");
  await page.getByRole("button", { name: "Open my timetable" }).click();
  await expect(page.getByTestId("my-major-year")).toContainText("Year 3");
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


test("today card: a verified student sees their day without picking a group", async ({ page }) => {
  await page.clock.setFixedTime(SUN_0812);
  await enterDemo(page); // verified CS year 1, no group chosen
  await page.goto(`${BASE}/?v=2d`);
  const card = page.getByTestId("today-card");
  await expect(card).toContainText("Today");
  await expect(card).toContainText("DEMO-CS-Y1-A");
  await expect(card).toContainText("2 left today");
  await expect(card).toContainText("Demo Introduction to Programming"); // 08:30, next
  await expect(page.getByTestId("today-later")).toContainText("Demo Physics I"); // 10:30
  await expect(page.getByTestId("today-free")).toContainText("free");
});

test("today card: visitors get a short guide and a verify button, no timetable", async ({ page }) => {
  await page.clock.setFixedTime(SUN_0812);
  await enterDemo(page, {}, "visitor");
  await page.goto(`${BASE}/?v=2d`);
  await expect(page.getByTestId("today-visitor")).toContainText("Welcome to campus");
  await expect(page.getByTestId("today-card")).toHaveCount(0);
  await page.getByTestId("today-visitor").getByRole("link").click();
  await expect(page).toHaveURL(/\/verify/);
});
