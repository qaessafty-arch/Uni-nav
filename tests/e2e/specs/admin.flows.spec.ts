import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { selectByText } from "../fixtures/select";
import { expect, test, type Page } from "@playwright/test";

const ADMIN = "http://localhost:3001";

async function openSandbox(page: Page) {
  await page.goto(ADMIN);
  await page.evaluate(() => localStorage.clear());
  await page.goto(ADMIN);
  await page.getByRole("button", { name: "Open local sandbox" }).click();
  await expect(page.getByText("Map & navigation integrity")).toBeVisible();
  page.on("dialog", (d) => void d.accept());
}

test("admin creates a building, a floor and a room (with validation feedback)", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/buildings`);
  await page.getByRole("button", { name: "+ New building" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Required").first()).toBeVisible();
  await page.locator("#f-campusId").selectOption({ index: 1 });
  await page.locator("#f-code").fill("DEMO-LIB");
  await page.locator("#f-name").fill("Demo Library Building");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "DEMO-LIB" })).toBeVisible();

  await page.goto(`${ADMIN}/floors`);
  await page.getByRole("button", { name: "+ New floor" }).click();
  await page.locator("#f-buildingId").selectOption({ label: "DEMO-LIB — Demo Library Building" });
  await page.locator("#f-name").fill("Demo Library Ground");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "Demo Library Ground" })).toBeVisible();

  await page.goto(`${ADMIN}/rooms`);
  await page.getByRole("button", { name: "+ New room" }).click();
  await page.locator("#f-buildingId").selectOption({ label: "DEMO-LIB — Demo Library Building" });
  await page.locator("#f-floorId").selectOption({ index: 1 });
  await page.locator("#f-code").fill("L001");
  await page.locator("#f-name").fill("Demo Reading Room");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: "Demo Reading Room" })).toBeVisible();
  await expect(page.getByText("no entrance").first()).toBeVisible();

  await page.goto(`${ADMIN}/audit`);
  await expect(page.getByRole("cell", { name: "rooms" }).first()).toBeVisible();
});

test("admin draws on the map editor, connects nodes, validates and saves", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/map-editor`);
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("No issues found.")).toBeVisible();
  const svg = page.locator('svg[role="application"]');
  await page.getByRole("button", { name: "Add node" }).click();
  await svg.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.15);
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.15);
  await expect(page.getByText("unsaved")).toBeVisible();
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByText("NODE_ISOLATED").first()).toBeVisible();
  await page.getByRole("button", { name: "Connect nodes" }).click();
  const nodes = page.locator('[data-kind="node"]');
  const count = await nodes.count();
  await nodes.nth(count - 2).locator("circle").nth(1).click({ force: true });
  await nodes.nth(count - 1).locator("circle").nth(1).click({ force: true });
  await expect(page.getByText("Connection", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Map saved")).toBeVisible();
});

test("map editor rejects malicious SVG floor plans and accepts clean ones", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/map-editor`);
  const input = page.getByLabel("Upload SVG floor plan");
  await input.setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByText(/SVG rejected: active content/)).toBeVisible();
  await input.setInputFiles({ name: "plan.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#222"/></svg>') });
  await expect(page.getByText(/Floor plan uploaded/)).toBeVisible();
});

test("timetable editor detects conflicts and requires explicit review", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/timetable`);
  await page.getByRole("button", { name: "+ New entry" }).click();
  await selectByText(page.locator("#tc"), /DEMO-CS201/);
  await selectByText(page.locator("#trm"), /DEMO-ENG 204/);
  await page.locator("#td").selectOption("0");
  await page.locator("#ts").fill("09:00");
  await page.locator("#te").fill("09:45");
  await expect(page.getByText(/room 204 already booked/)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/conflicts with existing bookings/)).toBeVisible();
  await page.getByLabel(/Save anyway/).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Timetable entry saved")).toBeVisible();
  await expect(page.getByText(/existing conflict/)).toBeVisible();
});

test("timetable CSV import shows a preview with errors and imports only valid files", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/timetable`);
  const header = "course_code,group_code,lecturer,building_code,room_code,day,start_time,end_time,valid_from,valid_to";
  const file = page.getByLabel("CSV file");
  await file.setInputFiles({ name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from(`${header}\nNOPE,DEMO-CS-Y1-A,,DEMO-ENG,999,Funday,25:00,10:00,2026-09-20,2027-01-21`) });
  await expect(page.getByText(/unknown course/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Import 0 entries/ })).toBeDisabled();
  await file.setInputFiles({ name: "good.csv", mimeType: "text/csv", buffer: Buffer.from(`${header}\nDEMO-CS210,DEMO-CS-Y2-A,Demo Lecturer A,DEMO-ENG,202,Wed,13:00,14:30,2026-09-20,2027-01-21`) });
  await expect(page.getByText("1 valid")).toBeVisible();
  await page.getByRole("button", { name: "Import 1 entries" }).click();
  await expect(page.getByText("Imported 1 timetable entries")).toBeVisible();
});

test("admin publishes a schedule change", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/schedule-changes`);
  await page.getByRole("button", { name: "+ New schedule change" }).click();
  await page.locator("#f-entryId").selectOption({ index: 1 });
  await page.locator("#f-type").selectOption("room_change");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Choose the new room.")).toBeVisible();
  await page.locator("#f-newRoomId").selectOption({ index: 3 });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Schedule change saved")).toBeVisible();
});

test("admin creates a QR checkpoint and prints the sheet", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/checkpoints`);
  await page.locator("#cpf").selectOption({ index: 1 });
  await page.locator("#cpn").selectOption({ index: 1 });
  await page.locator("#cpl").fill("Demo test checkpoint");
  await page.getByRole("button", { name: "Create checkpoint" }).click();
  await expect(page.getByRole("cell", { name: "Demo test checkpoint" })).toBeVisible();
  await page.getByRole("link", { name: "Print QR sheet" }).click();
  await expect(page.getByText("Demo test checkpoint")).toBeVisible();
  await expect(page.locator('[aria-label="QR code"] svg').first()).toBeVisible();
});

test("role assignment cannot escalate above the actor's rank", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/users`);
  const options = await page.getByLabel("Role").locator("option").allTextContents();
  expect(options).not.toContain("platform owner");
  expect(options).toContain("university admin");
});

test("admin adds a campus picture and places buildings by drawing on the map", async ({ page }) => {
  await openSandbox(page);
  // 1) Campus picture + move an existing building on the Campus map page
  await page.goto(`${ADMIN}/campus-map`);
  await expect(page.getByText("2 / 2 buildings placed")).toBeVisible();
  const png = readFileSync(resolve(__dirname, "../../../apps/web/public/icons/icon-512.png"));
  await page.getByLabel("Campus picture").setInputFiles({ name: "campus.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Picture added/)).toBeVisible();
  await expect(page.locator('svg[aria-label="Campus map editor"] image')).toHaveCount(1);
  await page.getByLabel("Campus picture").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText(/Use a PNG, JPEG or WebP image/)).toBeVisible();

  await page.getByRole("button", { name: /DEMO-SCI/ }).click();
  const svg = page.locator('svg[aria-label="Campus map editor"]');
  const sci = svg.locator('[data-b] rect').nth(1);
  const box = (await sci.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText("unsaved")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Saved 1 footprint/)).toBeVisible();

  // 2) New building: draw its footprint directly in the building form
  await page.goto(`${ADMIN}/buildings`);
  await page.getByRole("button", { name: "+ New building" }).click();
  await page.locator("#f-campusId").selectOption({ index: 1 });
  await page.locator("#f-code").fill("DEMO-LIB");
  await page.locator("#f-name").fill("Demo Library Building");
  const picker = page.locator('[role="dialog"] svg[aria-label="Campus map editor"]');
  await expect(picker.locator("image")).toHaveCount(1); // the campus picture shows in the form too
  await picker.scrollIntoViewIfNeeded();
  const pb = (await picker.boundingBox())!;
  await page.mouse.move(pb.x + pb.width * 0.1, pb.y + pb.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(pb.x + pb.width * 0.3, pb.y + pb.height * 0.85, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText("Drag to move · handles to resize")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("cell", { name: "DEMO-LIB" })).toBeVisible();

  await page.goto(`${ADMIN}/campus-map`);
  await expect(page.getByText("3 / 3 buildings placed")).toBeVisible();
});

test("admin bars: grouped sidebar with report count, breadcrumb and jump-to search", async ({ page }) => {
  await openSandbox(page);
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: /Problem reports/ })).toContainText("1");
  await nav.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Rooms");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("closures");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/closures/);
  await page.getByRole("button", { name: "Quick action" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit a floor map" })).toBeVisible();
});

test("admin triages a problem report and creates a closure", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/reports`);
  await expect(page.getByText(/corridor door next to room 204/)).toBeVisible();
  await page.getByLabel("Staff note").first().fill("Facilities unlocked it");
  await page.getByRole("button", { name: "Resolved" }).first().click();
  await expect(page.getByText("Report marked resolved")).toBeVisible();
  await expect(page.getByText("No open reports. Nice.")).toBeVisible();

  await page.goto(`${ADMIN}/closures`);
  await expect(page.getByText(/Science stairs closed for repainting/)).toBeVisible();
  await page.getByRole("radio", { name: "Point" }).click();
  await page.locator("#cl-floor").selectOption({ index: 1 });
  await page.locator("#cl-target").selectOption({ index: 1 });
  await page.locator("#cl-reason").fill("Elevator out of service");
  await page.getByRole("button", { name: "Save closure" }).click();
  await expect(page.getByText(/routes avoid it while it is active/)).toBeVisible();
  await expect(page.getByText("Closed now")).toBeVisible();
  await page.getByRole("button", { name: "Reopen now" }).first().click();
  await expect(page.getByText("Reopened", { exact: true })).toBeVisible();
});

test("map editor calibrates the floor scale from a measured distance", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/map-editor`);
  await expect(page.getByText("1 unit = 0.05 m")).toBeVisible();
  await page.getByRole("button", { name: "Calibrate scale" }).click();
  const svg = page.locator('svg[role="application"]');
  await svg.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = (await svg.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.getByLabel("Measured real length (metres)").fill("30");
  await page.getByRole("button", { name: "Apply scale" }).click();
  await expect(page.getByText("unsaved")).toBeVisible();
  await expect(page.getByText("1 unit = 0.05 m")).not.toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Map saved")).toBeVisible();
});
