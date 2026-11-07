"use client";
import { useEffect, useState } from "react";
import { buildingIconPath } from "@campusnav/tokens";
import { openStatus, type Building, type OpeningHours, type Weekday } from "@campusnav/core";
import { formatClock } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { cx } from "./ui";

const SIZES = { xs: "size-6 rounded-[5px]", sm: "size-8 rounded-md", md: "size-10 rounded-lg", lg: "size-14 rounded-xl" } as const;
const ICON = { xs: "size-3.5", sm: "size-[18px]", md: "size-5", lg: "size-7" } as const;

/**
 * A building's identity: its uploaded logo, or its icon on its colour
 * (falls back to the university accent and a generic building icon).
 */
export function BuildingMark({ building, size = "md", className }: { building: Pick<Building, "icon" | "color" | "logoUrl" | "code">; size?: keyof typeof SIZES; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (building.logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={building.logoUrl} alt="" onError={() => setBroken(true)} className={cx(SIZES[size], "shrink-0 object-contain bg-white border border-line p-0.5", className)} />
    );
  }
  return (
    <span className={cx(SIZES[size], "shrink-0 grid place-items-center text-white", className)} style={{ background: building.color ?? "var(--cn-accent)" }} aria-hidden>
      <svg viewBox="0 0 24 24" className={ICON[size]} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d={buildingIconPath(building.icon)} />
      </svg>
    </span>
  );
}

function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "Open · closes 20:00" / "Closed · opens Sat 09:00". Renders nothing when no hours are published. */
export function OpenStatusLine({ hours, timeZone, className }: { hours: OpeningHours | null | undefined; timeZone: string; className?: string }) {
  const { t, prefs } = useApp();
  const now = useNow();
  const s = openStatus(hours, now, timeZone);
  if (!s) return null;
  const loc = prefs.locale;
  const text = s.open
    ? t(s.closingSoon ? "hours.closingSoon" : "hours.open", { time: formatClock(loc, s.closesAt) })
    : s.opensAt
      ? s.opensToday
        ? t("hours.opensToday", { time: formatClock(loc, s.opensAt) })
        : t("hours.opensDay", { day: t(`day.${s.opensDay as Weekday}`), time: formatClock(loc, s.opensAt) })
      : t("hours.closed");
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm", className)} data-testid="open-status">
      <span className={cx("size-2 rounded-full", s.open ? (s.closingSoon ? "bg-warn" : "bg-[var(--cn-ok)]") : "bg-danger")} aria-hidden />
      <span className={s.open ? "" : "text-muted"}>{text}</span>
    </span>
  );
}

/** Weekly hours table, starting on Saturday (the Kurdistan week) and highlighting today. */
export function HoursTable({ hours }: { hours: OpeningHours }) {
  const { t, prefs } = useApp();
  const today = new Date().getDay();
  return (
    <table className="text-sm w-full" data-testid="hours-table">
      <tbody>
        {([6, 0, 1, 2, 3, 4, 5] as Weekday[]).map((d) => {
          const iv = hours[String(d) as keyof OpeningHours];
          return (
            <tr key={d} className={cx(d === today && "font-semibold")}>
              <td className="py-0.5 pe-4">{t(`day.${d}`)}</td>
              <td className="py-0.5 mono text-end">{iv && iv.length ? iv.map(([a, b]) => `${formatClock(prefs.locale, a)}–${formatClock(prefs.locale, b)}`).join(", ") : <span className="text-muted">{t("hours.closedDay")}</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
