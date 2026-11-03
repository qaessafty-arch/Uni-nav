import type { Page } from "@playwright/test";

/** The test sandbox has no internet: serve a blank base-map style instead of OpenFreeMap tiles. */
export async function stubMapTiles(page: Page) {
  await page.route(/tiles\.openfreemap\.org/, (route) =>
    route.request().url().includes("/styles/")
      ? route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef0f3" } }] } })
      : route.fulfill({ status: 204 }),
  );
}
