import type { Page } from "@playwright/test";
import { DEMO_UNIVERSITY_ID } from "@campusnav/data";
import { did } from "@campusnav/data/demo";
import { stubMapTiles } from "./maptiles";


/** Who opens the app: a visitor (no account) or a verified demo student of a major and year. */
export type Who = "visitor" | { email: string; departmentId: string; year: number };

/**
 * Skip onboarding and select the demo university by seeding preferences.
 * By default the person is a verified demo student (Computing, year 1), since
 * timetables and classrooms are student-only; pass "visitor" for the public view.
 */
export async function enterDemo(page: Page, prefs: Record<string, unknown> = {}, who: Who | null = null) {
  const person: Who = who ?? { email: "cs1@students.demo.example", departmentId: did("demo-dept-cs"), year: 1 };
  await stubMapTiles(page);
  await page.goto("http://localhost:3000/offline");
  await page.evaluate(
    ([uid, extra, p]) => {
      localStorage.clear();
      localStorage.setItem("campusnav.prefs", JSON.stringify({ locale: "en", theme: "dark", style: (extra as { style?: string }).style ?? "editorial", universityId: uid, onboarded: true, groupId: null, accessible: false, keepHistory: false, reminders: false, ...(extra as object) }));
      if (p !== "visitor") localStorage.setItem("campusnav.student.v1", JSON.stringify({ universityId: uid, status: "verified", ...(p as object) }));
    },
    [DEMO_UNIVERSITY_ID, { style: process.env.E2E_STYLE ?? "editorial", ...prefs }, person] as const,
  );
}
