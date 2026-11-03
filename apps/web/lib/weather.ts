"use client";
import { useEffect, useState } from "react";
import type { CampusGeo, Locale } from "@campusnav/core";
import { formatNumber } from "@campusnav/i18n";

export interface CurrentWeather {
  tempC: number;
  feelsC: number;
  at: number;
}

const TTL = 20 * 60_000;

/**
 * Current temperature at the campus from Open-Meteo (free, no key). Only the
 * campus coordinates are sent — nothing about the student. Cached for 20 min;
 * returns null offline or on any error, and callers then show nothing.
 */
export function useCampusWeather(geo: CampusGeo | null | undefined): CurrentWeather | null {
  const [w, setW] = useState<CurrentWeather | null>(null);
  const lat = geo?.center[1];
  const lng = geo?.center[0];
  useEffect(() => {
    if (lat == null || lng == null) return;
    const key = `campusnav.weather.${lat.toFixed(3)},${lng.toFixed(3)}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) ?? "null") as CurrentWeather | null;
      if (cached && Date.now() - cached.at < TTL) return setW(cached);
    } catch {
      /* storage unavailable */
    }
    const ctrl = new AbortController();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,apparent_temperature`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { current?: { temperature_2m?: number; apparent_temperature?: number } } | null) => {
        const c = j?.current;
        if (typeof c?.temperature_2m !== "number" || typeof c.apparent_temperature !== "number") return;
        const v = { tempC: c.temperature_2m, feelsC: c.apparent_temperature, at: Date.now() };
        setW(v);
        try {
          sessionStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [lat, lng]);
  return w;
}

/** "44°C" in the locale's digits, isolated so right-to-left text never flips it to "C°44". */
export const formatTemp = (locale: Locale, c: number) => `\u2066${formatNumber(locale, Math.round(c))}°C\u2069`;
