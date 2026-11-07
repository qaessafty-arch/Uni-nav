import { expect, test } from "@playwright/test";

const ADMIN = "http://localhost:3001";

test("staff add a lecture link to a course, switch rep uploads off, and see the class reps section", async ({ page }) => {
  await page.goto(ADMIN);
  await page.evaluate(() => localStorage.clear());
  await page.goto(ADMIN);
  await page.getByRole("button", { name: "Open local sandbox" }).click();
  await expect(page.getByText("Map & navigation integrity")).toBeVisible();
  page.on("dialog", (d) => void d.accept());

  await page.goto(`${ADMIN}/materials`);
  await page.getByLabel("Course").selectOption({ label: "DEMO-CS101 — Demo Introduction to Programming" });
  await expect(page.getByText("Demo course outline")).toBeVisible();
  await page.getByLabel("Title").fill("Week 4 slides");
  await page.getByPlaceholder("https://").fill("https://example.org/week4");
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByTestId("admin-materials").filter({ hasText: "Week 4 slides" })).toBeVisible();

  await page.getByRole("button", { name: "Stop class reps uploading" }).click();
  await expect(page.getByText("Reps cannot upload")).toBeVisible();

  await page.goto(`${ADMIN}/students`);
  await expect(page.getByText(/Class representatives \(0\)/)).toBeVisible();
  const form = page.getByTestId("appoint-rep");
  await form.getByLabel("Class").selectOption({ index: 1 });
  await expect(form.getByLabel("Student")).toContainText("No verified students for this major and year yet");
});
