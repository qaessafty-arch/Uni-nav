import type { Page } from "@playwright/test";
import { DEMO_UNIVERSITY_ID } from "@campusnav/data";
import { stubMapTiles } from "./maptiles";

/** Skip onboarding and select the demo university by seeding preferences. */
export async function enterDemo(page: Page, prefs: Record<string, unknown> = {}) {
  await stubMapTiles(page);
  await page.goto("http://localhost:3000/offline");
  await page.evaluate(
    ([uid, extra]) => {
      localStorage.clear();
      localStorage.setItem("campusnav.prefs", JSON.stringify({ locale: "en", theme: "dark", style: (extra as { style?: string }).style ?? "editorial", universityId: uid, onboarded: true, groupId: null, accessible: false, keepHistory: false, reminders: false, ...(extra as object) }));
    },
    [DEMO_UNIVERSITY_ID, { style: process.env.E2E_STYLE ?? "editorial", ...prefs }] as const,
  );
}
