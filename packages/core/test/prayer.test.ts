import { describe, expect, it } from "vitest";
import { hijriDate, isRamadan, nextPrayer, prayerTimes, toMinutes } from "../src";

// Erbil city centre. Reference values for 31 Oct 2026 published by gtaf.org
// (Muslim World League angles): Fajr 04:59, Dhuhr 11:49, Asr (Hanafi) 15:30,
// Maghrib 17:09, Isha 18:31.
const ERBIL = [36.1911, 44.0092] as const;
const TZ = "Asia/Baghdad";
const near = (a: string | null, b: string, tol = 2) => expect(Math.abs(toMinutes(a!) - toMinutes(b))).toBeLessThanOrEqual(tol);

describe("prayer times (offline calculation)", () => {
  it("matches published Erbil times within 2 minutes", () => {
    const t = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ);
    near(t.fajr, "04:59");
    near(t.dhuhr, "11:49");
    near(t.maghrib, "17:09");
    near(t.isha, "18:31");
    near(prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ, { asr: "hanafi" }).asr, "15:30");
  });

  it("falls back to the defaults when settings are unset (undefined / null)", () => {
    const unset = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ, { method: undefined, asr: undefined, maghribOffsetMin: undefined });
    expect(unset).toEqual(prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ));
    expect(nextPrayer(new Date("2026-10-31T12:00:00Z"), ERBIL[0], ERBIL[1], TZ, { method: undefined })?.name).toBe("maghrib");
  });

  it("Shafi'i Asr (the Kurdistan default) is earlier than Hanafi", () => {
    const shafii = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ).asr!;
    const hanafi = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ, { asr: "hanafi" }).asr!;
    expect(toMinutes(hanafi) - toMinutes(shafii)).toBeGreaterThan(30);
  });

  it("keeps the five prayers in order through the year and follows the method's angles", () => {
    for (const d of ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]) {
      const t = prayerTimes(d, ERBIL[0], ERBIL[1], TZ);
      const seq = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map((x) => toMinutes(x!));
      expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    }
    const mwl = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ);
    const isna = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ, { method: "isna" });
    expect(toMinutes(isna.fajr!)).toBeGreaterThan(toMinutes(mwl.fajr!)); // 15° vs 18°
    const uq = prayerTimes("2026-10-31", ERBIL[0], ERBIL[1], TZ, { method: "umm_al_qura" });
    expect(toMinutes(uq.isha!) - toMinutes(uq.maghrib!)).toBe(90);
  });

  it("finds the next prayer and rolls over to tomorrow's Fajr after Isha", () => {
    const afterAsr = nextPrayer(new Date("2026-10-31T12:00:00Z"), ERBIL[0], ERBIL[1], TZ)!; // 15:00 local
    expect(afterAsr.name).toBe("maghrib");
    expect(afterAsr.secondsUntil).toBeGreaterThan(0);
    const late = nextPrayer(new Date("2026-10-31T19:00:00Z"), ERBIL[0], ERBIL[1], TZ)!; // 22:00 local
    expect(late).toMatchObject({ name: "fajr", date: "2026-11-01" });
  });
});

describe("hijri calendar", () => {
  it("knows Ramadan 1447 (Feb–Mar 2026)", () => {
    expect(isRamadan(hijriDate(new Date("2026-02-25T12:00:00Z"), TZ))).toBe(true);
    expect(isRamadan(hijriDate(new Date("2026-11-03T12:00:00Z"), TZ))).toBe(false);
  });
});

import { findRoute, buildGraph, heatLevel, outdoorMeters, routeOptionsFor } from "../src";
import { e, floor, n } from "./fixtures";

describe("heat-aware routing", () => {
  // Two buildings: a short outdoor crossing (40 m) or a longer indoor link bridge (70 m).
  const floors = [floor("A", 0, "b1"), floor("B", 0, "b2")];
  const nodes = [n("a", "A", 0, 0, "building_entrance"), n("b", "B", 0, 0, "building_entrance"), n("bridgeA", "A", 0, 10), n("bridgeB", "B", 0, 10)];
  const edges = [
    e("out", "a", "b", "outdoor", { distanceM: 40 }),
    e("a1", "a", "bridgeA", "corridor", { distanceM: 10 }),
    e("br", "bridgeA", "bridgeB", "corridor", { distanceM: 50 }),
    e("b1", "bridgeB", "b", "corridor", { distanceM: 10 }),
  ];
  const g = buildGraph(nodes, edges, floors);

  it("shortest crosses outside; indoor-first takes the bridge and reports no sun exposure", () => {
    const short = findRoute(g, "a", "b", routeOptionsFor("shortest"));
    const indoor = findRoute(g, "a", "b", routeOptionsFor("indoor_first"));
    if (!short.ok || !indoor.ok) throw new Error("no route");
    expect(outdoorMeters(short.route.legs)).toBe(40);
    expect(outdoorMeters(indoor.route.legs)).toBe(0);
    expect(indoor.route.distanceM).toBe(70); // reported distance stays physical
  });

  it("classifies heat from the feels-like temperature", () => {
    expect(heatLevel(null)).toBe("none");
    expect(heatLevel(32)).toBe("none");
    expect(heatLevel(41)).toBe("hot");
    expect(heatLevel(47)).toBe("extreme");
    expect(heatLevel(36, 35)).toBe("hot");
  });
});
