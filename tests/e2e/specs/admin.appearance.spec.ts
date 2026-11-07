import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ADMIN = "http://localhost:3001";

async function openSandbox(page: Page) {
  await page.goto(ADMIN);
  await page.evaluate(() => localStorage.clear());
  await page.goto(ADMIN);
  await page.getByRole("button", { name: "Open local sandbox" }).click();
  await expect(page.getByText("Map & navigation integrity")).toBeVisible();
}

test("buildings: staff give a building an icon, colour, logo and opening hours", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/buildings`);
  await page.getByRole("row", { name: /DEMO-ENG/ }).getByRole("button", { name: "Edit" }).click();
  const id = page.getByTestId("identity-input");
  await id.getByRole("radio", { name: "Mosque / prayer" }).click();
  await expect(id.getByRole("radio", { name: "Mosque / prayer" })).toHaveAttribute("aria-checked", "true");
  await id.getByLabel("Custom colour").fill("#2bff88");
  await expect(id.getByText(/hard to read/)).toBeVisible();
  await id.getByRole("radio", { name: "#047857" }).click();
  await expect(id.getByText(/hard to read/)).toHaveCount(0);
  const png = readFileSync(resolve(__dirname, "../../../apps/web/public/icons/icon-192.png"));
  await id.getByLabel("Building logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Logo added/)).toBeVisible();
  const hours = page.getByTestId("hours-input");
  await hours.getByLabel("Open on Friday").check();
  await hours.getByLabel("Friday opens").fill("09:00");
  await hours.getByLabel("Friday closes").fill("12:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row", { name: /DEMO-ENG/ })).toContainText("6 days");
});

test("appearance: brand colour is contrast-checked, features switch off, preview follows", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/appearance`);
  const preview = page.getByTestId("appearance-preview");
  await expect(preview).toContainText("Prayer times");
  await page.getByLabel("Custom brand colour").fill("#2bff88");
  await expect(page.getByTestId("contrast")).toContainText("below 4.5:1");
  await page.getByRole("radio", { name: "#6D28D9" }).click();
  await expect(page.getByTestId("contrast")).toContainText("meets WCAG AA");
  await page.getByTestId("feature-toggles").getByLabel("Prayer times").uncheck();
  await expect(preview).not.toContainText("Prayer times");
  await page.getByLabel("App name").fill("SUL NAV");
  await expect(preview).toContainText("SUL NAV");
  await page.getByRole("button", { name: "Save appearance" }).click();
  await expect(page.getByText(/Appearance saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("feature-toggles").getByLabel("Prayer times")).not.toBeChecked();
});
