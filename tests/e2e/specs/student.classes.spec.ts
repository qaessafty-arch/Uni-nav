import { expect, test } from "@playwright/test";
import { did } from "@campusnav/data/demo";
import { enterDemo } from "../fixtures/student";

const BASE = "http://localhost:3000";
const CS101 = did("course-DEMO-CS101");
const CS = did("demo-dept-cs");

test("visitors are told lecture materials are for verified students", async ({ page }) => {
  await enterDemo(page, {}, "visitor");
  await page.goto(`${BASE}/courses/${CS101}`);
  await expect(page.getByText("Lecture materials are for verified students")).toBeVisible();
  await expect(page.getByTestId("materials")).toHaveCount(0);
});

test("a verified student of the class sees materials but cannot upload", async ({ page }) => {
  await enterDemo(page, {}, { email: "cs1b@students.demo.example", departmentId: CS, year: 1 });
  await page.goto(`${BASE}/courses/${CS101}`);
  await expect(page.getByTestId("material")).toHaveCount(2);
  await expect(page.getByText("Demo course outline")).toBeVisible();
  await expect(page.getByTestId("material-upload")).toHaveCount(0);
  await page.goto(`${BASE}/notifications`);
  await expect(page.getByTestId("class-post")).toHaveCount(0);
});

test("the class rep uploads a PDF and posts to their class", async ({ page }) => {
  await enterDemo(page); // cs1@ = demo class rep of DEMO-CS-Y1-A
  await page.goto(`${BASE}/courses/${CS101}`);
  await page.getByTestId("material-upload").locator("summary").click();
  await page.getByTestId("material-title").fill("Lab 3 sheet");
  await page.getByTestId("material-file").setInputFiles({ name: "lab3.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%demo\n") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Material added")).toBeVisible();
  await expect(page.getByTestId("material")).toHaveCount(3);
  await expect(page.getByTestId("material").filter({ hasText: "Lab 3 sheet" })).toContainText("DEMO-CS-Y1-A");

  // Wrong file types are refused before anything is sent.
  await page.getByTestId("material-title").fill("Bad");
  await page.getByTestId("material-file").setInputFiles({ name: "x.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Only PDF, PPTX, DOCX, PNG or JPEG files.")).toBeVisible();

  await page.goto(`${BASE}/notifications`);
  const form = page.getByTestId("class-post");
  await expect(form).toContainText("Class rep · DEMO-CS-Y1-A");
  await form.getByLabel("Title").fill("Quiz moved");
  await form.getByLabel("Message").fill("The quiz is on Thursday now.");
  await form.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText("Posted to DEMO-CS-Y1-A")).toBeVisible();
  await expect(page.getByText("Quiz moved")).toBeVisible();
  await expect(page.getByText("Class · DEMO-CS-Y1-A").first()).toBeVisible();
});

test("classmates are told about new materials: bell count, notifications list, timetable badge", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-01T05:12:00Z")); // a Sunday with CS101 on the timetable
  await enterDemo(page); // the rep uploads first
  await page.goto(`${BASE}/courses/${CS101}`);
  await page.getByTestId("material-upload").locator("summary").click();
  await page.getByTestId("material-title").fill("Week 5 notes");
  await page.getByTestId("material-url").fill("https://example.org/week5");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Material added")).toBeVisible();

  // Same device, now a classmate who has never opened the course page.
  await page.evaluate((dept) => {
    localStorage.setItem("campusnav.student.v1", JSON.stringify({ universityId: JSON.parse(localStorage.getItem("campusnav.prefs")!).universityId, status: "verified", email: "cs1b@students.demo.example", departmentId: dept, year: 1 }));
    for (const k of Object.keys(localStorage)) if (k.startsWith("campusnav.materials.seen.")) localStorage.removeItem(k);
  }, CS);
  await page.goto(`${BASE}/timetable`);
  await expect(page.getByTestId("bell-count").first()).toHaveText("1");
  await expect(page.getByText("1 new").first()).toBeVisible();
  await page.goto(`${BASE}/notifications`);
  const recent = page.getByTestId("recent-materials");
  await expect(recent).toContainText("Week 5 notes");
  await recent.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/courses/${CS101}#materials`));
  await expect(page.getByTestId("bell-count")).toHaveCount(0); // opening the course marks them seen
});
