import { expect, test } from "@playwright/test";

const ADMIN = "http://localhost:3001";

test("admin data health audits the routing graph", async ({ page }) => {
  await page.goto(ADMIN);
  await page.evaluate(() => localStorage.clear());
  await page.goto(ADMIN);
  await page.getByRole("button", { name: "Open local sandbox" }).click();
  await page.goto(`${ADMIN}/health`);
  await expect(page.getByRole("heading", { name: "Data health" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Health score 100 out of 100" })).toBeVisible();
  await expect(page.getByText("Rooms reachable on foot")).toBeVisible();
  await expect(page.getByRole("button", { name: "Breaks routes (0)" })).toBeVisible();
});
