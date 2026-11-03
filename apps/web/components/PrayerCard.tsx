"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { graphForBundle, hijriDate, isRamadan, lt, nearestRooms, nextPrayer, prayerTimes, PRAYERS, routeOptionsFor, withClosures, zonedNow, type CampusBundle } from "@campusnav/core";
import { formatClock, formatCountdownText, formatDistance } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { Icon } from "./Icon";
import { I } from "./icons";
import { cx } from "./ui";

/**
 * Next prayer for the campus (calculated on the device from the campus
 * location — works offline) with the nearest prayer room by walking distance.
 * In Ramadan it leads with the iftar countdown instead.
 */
export function PrayerCard({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, start } = useApp();
  const loc = prefs.locale;
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const settings = bundle.university.settings;
  const cfg = settings.prayer ?? {};
  const geo = bundle.campuses.find((c) => c.geo)?.geo;
  const tz = settings.timezone;
  const opts = { method: cfg.method, asr: cfg.asr, maghribOffsetMin: cfg.maghribOffsetMin ?? undefined };

  const nearest = useMemo(() => {
    if (!start || !bundle.rooms.some((r) => r.type === "prayer_room")) return null;
    return nearestRooms(bundle, graphForBundle(bundle), start.nodeId, ["prayer_room"], withClosures(bundle, routeOptionsFor(prefs.accessible ? "step_free" : "shortest")), 1)[0] ?? null;
  }, [bundle, start, prefs.accessible]);

  if (cfg.enabled === false || !geo) return null;
  const [lng, lat] = geo.center;
  const next = nextPrayer(now, lat, lng, tz, opts);
  if (!next) return null;
  const today = prayerTimes(zonedNow(now, tz).date, lat, lng, tz, opts);
  const ramadan = isRamadan(hijriDate(now, tz));
  const methodName = t(`prayer.method.${cfg.method ?? "mwl"}`);
  // In Ramadan the countdown that matters is to Maghrib (iftar).
  const iftar = ramadan ? (next.name === "maghrib" ? next : null) : null;

  return (
    <section className={cx("cn-card p-4", ramadan && "cn-card-accent")} aria-label={t("prayer.title")} data-testid="prayer-card">
      {ramadan ? <div className="label-caps text-accent mb-1">☾ {t("ramadan.title")}</div> : <div className="label-caps mb-1">{t("prayer.title")}</div>}
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-semibold text-lg">
          {iftar
            ? t("ramadan.iftar", { time: formatCountdownText(loc, iftar.secondsUntil), clock: formatClock(loc, iftar.time) })
            : t("prayer.next", { prayer: t(`prayer.${next.name}`), time: formatCountdownText(loc, next.secondsUntil) })}
        </div>
        {!iftar ? <div className="mono text-lg">{formatClock(loc, next.time)}</div> : null}
      </div>
      {ramadan && today.fajr ? <p className="text-sm text-muted">{t("ramadan.suhoor", { clock: formatClock(loc, prayerTimes(next.date, lat, lng, tz, opts).fajr ?? today.fajr) })}</p> : null}
      {nearest ? (
        <Link href={`/navigate?to=${nearest.room.id}`} className="mt-2 flex items-center gap-2 text-sm hover:text-accent">
          <Icon d={I.prayer} className="size-4 text-accent" />
          <span className="truncate">
            {t("prayer.nearestRoom")}: <span className="font-medium">{nearest.room.code} · {lt(nearest.room.name, loc)}</span> · {formatDistance(loc, nearest.distanceM)}
          </span>
          <Icon d={I.route} className="size-4 ms-auto shrink-0" />
        </Link>
      ) : null}
      <button type="button" className="text-xs text-muted underline mt-2" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? t("prayer.hideAll") : t("prayer.showAll")}
      </button>
      {open ? (
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm" data-testid="prayer-times">
          {(["fajr", "sunrise", ...PRAYERS.slice(1)] as const).map((p) => (
            <li key={p} className={cx("flex justify-between gap-2", p === next.name && next.date === zonedNow(now, tz).date && "text-accent font-semibold")}>
              <span>{t(`prayer.${p}`)}</span>
              <span className="mono">{today[p] ? formatClock(loc, today[p]!) : "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-faint mt-2">
        {t("prayer.calculated", { method: methodName })}
        {ramadan ? ` ${t("ramadan.note")}` : ""}
      </p>
    </section>
  );
}
