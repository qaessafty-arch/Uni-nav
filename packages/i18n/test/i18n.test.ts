import { describe, expect, it } from "vitest";
import { dir, formatClock, messages, translate, formatDistance } from "../src";

describe("i18n", () => {
  it("has every key translated (non-empty) in all locales", () => {
    const keys = Object.keys(messages.en);
    for (const loc of ["ckb", "ar"] as const) {
      for (const k of keys) expect(messages[loc][k as keyof typeof messages.en]?.trim(), `${loc}:${k}`).toBeTruthy();
    }
  });
  it("keeps placeholders consistent across locales", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(messages.en) as (keyof typeof messages.en)[]) {
      expect(ph(messages.ckb[k]), `ckb:${k}`).toBe(ph(messages.en[k]));
      expect(ph(messages.ar[k]), `ar:${k}`).toBe(ph(messages.en[k]));
    }
  });
  it("sets RTL for Sorani and Arabic", () => {
    expect(dir("ckb")).toBe("rtl");
    expect(dir("ar")).toBe("rtl");
    expect(dir("en")).toBe("ltr");
  });
  it("interpolates and formats without crashing on locales with sparse ICU data", () => {
    expect(translate("en", "home.startsIn", { time: "5m" })).toBe("Starts in 5m");
    expect(formatClock("ckb", "08:30")).toMatch(/0?8|٠?٨/);
    expect(formatDistance("ar", 42)).toContain("م");
  });
});

describe("Sorani formatting fallback", () => {
  it("produces Sorani dates even without ICU data", async () => {
    const orig = Intl.DateTimeFormat.supportedLocalesOf;
    // Simulate a runtime without ckb data (Chromium reduced ICU, Hermes)
    (Intl.DateTimeFormat as unknown as { supportedLocalesOf: () => string[] }).supportedLocalesOf = () => [];
    const { vi } = await import("vitest");
    vi.resetModules();
    const mod = await import("../src/index");
    expect(mod.formatDate("ckb", "2026-11-02", { weekday: "long", day: "numeric", month: "long" })).toBe("دووشەممە، ٢ی تشرینی دووەم");
    expect(mod.formatClock("ckb", "08:30")).toBe("٠٨:٣٠");
    Intl.DateTimeFormat.supportedLocalesOf = orig;
  });
});
