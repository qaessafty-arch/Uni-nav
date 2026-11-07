import { expect, test, type Page } from "@playwright/test";

const ADMIN = "http://localhost:3001";
const C = [44.0249844, 36.1439009]; // demo campus centre (zoom 16)
const sq = (lng: number, lat: number, d: number) => [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]];

/** Base map with a big site-wide shape and two real-looking buildings west and east of the centre. */
async function stubBuildings(page: Page) {
  const style = {
    version: 8,
    sources: {
      osm: {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: sq(C[0]!, C[1]!, 0.004) } },
            // Like the real campus: several buildings (incl. a long one) stored as ONE multi-part object
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "MultiPolygon",
                coordinates: [
                  [[[C[0]! - 0.002, C[1]! + 0.0012], [C[0]! + 0.002, C[1]! + 0.0012], [C[0]! + 0.002, C[1]! + 0.0016], [C[0]! - 0.002, C[1]! + 0.0016], [C[0]! - 0.002, C[1]! + 0.0012]]],
                  sq(C[0]! - 0.0015, C[1]!, 0.0003),
                  sq(C[0]! + 0.0015, C[1]!, 0.0003),
                ],
              },
            },
          ],
        },
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#eef0f3" } },
      { id: "building", type: "fill", source: "osm", paint: { "fill-color": "#d9dbe0" } },
    ],
  };
  await page.route(/tiles\.openfreemap\.org/, (r) => (r.request().url().includes("/styles/") ? r.fulfill({ json: style }) : r.fulfill({ status: 204 })));
}

async function openSandbox(page: Page) {
  await stubBuildings(page);
  await page.goto(ADMIN);
  await page.evaluate(() => localStorage.clear());
  await page.goto(ADMIN);
  await page.getByRole("button", { name: "Open local sandbox" }).click();
  await expect(page.getByText("Map & navigation integrity")).toBeVisible();
}

/** Click at an offset in degrees from the map centre (zoom 16: ~1.073e-5° longitude per pixel). */
async function clickAt(page: Page, dLng: number) {
  const box = (await page.getByTestId("real-map-editor").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 + dLng / 1.0729e-5, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2 + dLng / 1.0729e-5, box.y + box.height / 2);
}

test("pick from map: each building gets the shape actually clicked, after a preview, never the big site shape", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/real-map`);
  await expect(page.getByTestId("real-map-editor")).toBeVisible();
  await page.waitForTimeout(1500); // map style loaded

  const list = page.getByRole("list", { name: "Buildings on the real map" });
  await list.getByRole("button", { name: /DEMO-LIB/ }).click();
  await page.getByTestId("pick-outline").click();
  await clickAt(page, -0.0015);
  await expect(page.getByText("Preview for DEMO-LIB: 4 corners")).toBeVisible();
  await page.getByTestId("pick-confirm").click();
  await expect(page.getByText("Outline saved for DEMO-LIB")).toBeVisible();

  await list.getByRole("button", { name: /DEMO-CAF/ }).click();
  await page.getByTestId("pick-outline").click();
  await clickAt(page, +0.0015);
  await expect(page.getByText("Preview for DEMO-CAF: 4 corners")).toBeVisible();
  await expect(page.getByText(/Already used by/)).toHaveCount(0); // a different building, not the same shape again
  await page.getByTestId("pick-confirm").click();
  await expect(page.getByText("Outline saved for DEMO-CAF")).toBeVisible();

  // Picking the library's building again for another one is flagged
  await list.getByRole("button", { name: /DEMO-SCI/ }).click();
  await page.getByTestId("pick-outline").click();
  await clickAt(page, -0.0015);
  await expect(page.getByText("Already used by DEMO-LIB")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).last().click();
  await expect(list.locator("li", { hasText: "DEMO-SCI" })).toContainText("not placed");
  await expect(list.locator("li", { hasText: "DEMO-LIB" })).toContainText("placed");
});

test("students: add one student by choosing department and year", async ({ page }) => {
  await openSandbox(page);
  await page.goto(`${ADMIN}/students`);
  const form = page.getByTestId("add-student");
  await form.getByLabel("Student email").fill("New.Student@students.demo.example");
  await expect(form.getByLabel("Year")).toBeDisabled();
  await form.getByLabel("Department").selectOption({ label: "Demo Department of Computing" });
  await expect(form.getByLabel("Year").locator("option")).toHaveCount(5); // Choose… + years 1–4
  await form.getByLabel("Year").selectOption("3");
  await form.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByText("new.student@students.demo.example added")).toBeVisible();
  await expect(page.getByTestId("roster-list")).toContainText("new.student@students.demo.example");
  await expect(page.getByTestId("roster-list")).toContainText("Year 3");
});

test("campus location: search a place by name and use it", async ({ page }) => {
  await openSandbox(page);
  await page.route(/nominatim\.openstreetmap\.org\/search/, (r) =>
    r.fulfill({ json: [{ display_name: "Salahaddin University - College of Science, Karkuk Street, Erbil, Iraq", lat: "36.1531938", lon: "44.0210416" }] }),
  );
  await page.goto(`${ADMIN}/real-map`);
  await page.getByLabel("Search a place").fill("Salahaddin College of Science");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByTestId("place-results").getByRole("button", { name: /College of Science/ }).click();
  await expect(page.getByText("Campus location saved")).toBeVisible();
  await expect(page.getByText("36.15319, 44.02104")).toBeVisible();
});
