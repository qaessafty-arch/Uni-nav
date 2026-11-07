import { describe, expect, it } from "vitest";
import { buildingSchema, contrastRatio, featureOn, openStatus, readableWithWhite, universitySettingsSchema } from "../src";

const TZ = "Asia/Baghdad"; // UTC+3
const at = (iso: string) => new Date(iso);
// Sun–Thu 08:00–20:00, Sat 09:00–14:00, Fri closed (demo library pattern).
const H = { "0": [["08:00", "20:00"]], "1": [["08:00", "20:00"]], "2": [["08:00", "20:00"]], "3": [["08:00", "20:00"]], "4": [["08:00", "20:00"]], "6": [["09:00", "14:00"]] } as const;
const hours = H as unknown as Parameters<typeof openStatus>[0];

describe("opening hours", () => {
  it("is open inside the hours and warns when closing soon", () => {
    expect(openStatus(hours, at("2026-11-01T07:00:00Z"), TZ)).toEqual({ open: true, closesAt: "20:00", closingSoon: false }); // Sun 10:00
    expect(openStatus(hours, at("2026-11-01T16:45:00Z"), TZ)).toMatchObject({ open: true, closingSoon: true }); // Sun 19:45
  });
  it("says when it opens later today, or on the next open day (skipping Friday)", () => {
    expect(openStatus(hours, at("2026-11-01T03:00:00Z"), TZ)).toEqual({ open: false, opensAt: "08:00", opensDay: 0, opensToday: true }); // Sun 06:00
    expect(openStatus(hours, at("2026-11-05T18:00:00Z"), TZ)).toEqual({ open: false, opensAt: "09:00", opensDay: 6, opensToday: false }); // Thu 21:00 → Sat
  });
  it("says nothing when no hours are published", () => {
    expect(openStatus(null, at("2026-11-01T07:00:00Z"), TZ)).toBeNull();
    expect(openStatus({}, at("2026-11-01T07:00:00Z"), TZ)).toBeNull();
  });
  it("validates intervals", () => {
    const base = { id: "b", universityId: "u", campusId: "c", code: "B", name: { en: "B" }, dataStatus: "demo" };
    expect(buildingSchema.safeParse({ ...base, hours: H }).success).toBe(true);
    expect(buildingSchema.safeParse({ ...base, hours: { "0": [["20:00", "08:00"]] } }).success).toBe(false);
    expect(buildingSchema.safeParse({ ...base, icon: "library", color: "#1D4ED8" }).success).toBe(true);
    expect(buildingSchema.safeParse({ ...base, color: "red" }).success).toBe(false);
    expect(buildingSchema.safeParse({ ...base, logoUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("branding and features", () => {
  it("checks colour contrast for white icons and text", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(readableWithWhite("#1D4ED8")).toBe(true);
    expect(readableWithWhite("#2BFF88")).toBe(false); // the old neon demo colour
  });
  it("home features default to on and can be switched off", () => {
    expect(featureOn({}, "prayer")).toBe(true);
    expect(featureOn({ features: { prayer: false } }, "prayer")).toBe(false);
    const s = { timezone: TZ, weekendDays: [5, 6], defaultLocale: "ckb", enabledLocales: ["ckb"], timetableVisibility: "public", walkingSpeedMps: 1.2, accessibleWalkingSpeedMps: 0.8, stairsSecondsPerFloor: 20, elevatorSecondsPerFloor: 40 };
    expect(universitySettingsSchema.safeParse({ ...s, features: { prayer: false } }).success).toBe(true);
    expect(universitySettingsSchema.safeParse({ ...s, homeFacilities: ["toilet", "cafeteria"], defaultView: "3d" }).success).toBe(true);
  });
});
