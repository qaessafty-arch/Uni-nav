/**
 * Mobile building identity, opening hours, prayer times and leave-by — the
 * same shared logic (@campusnav/core) and icons (@campusnav/tokens) as the
 * web app, drawn with React Native + react-native-svg.
 */
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { buildingIconPath, FILLED_ICONS, ICONS, type IconName } from "@campusnav/tokens";
import {
  featureOn,
  hijriDate,
  isRamadan,
  leaveAdvice,
  nearestRooms,
  graphForBundle,
  nextPrayer,
  openStatus,
  planRouteToRoom,
  readableWithWhite,
  routeOptionsFor,
  zonedToInstant,
  type Building,
  type CampusBundle,
  type Occurrence,
  type OpeningHours,
  type Weekday,
} from "@campusnav/core";
import { formatClock, formatCountdownText, formatDistance, formatDuration } from "@campusnav/i18n";
import { useApp } from "./store";
import { Btn, T, c, useCard, useText } from "./ui";

export function Icon({ name, d, size = 20, color = c.text }: { name?: IconName; d?: string; size?: number; color?: string }) {
  const filled = name ? FILLED_ICONS.has(name) : false;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={filled ? "none" : color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d ?? (name ? ICONS[name] : "")} />
    </Svg>
  );
}

/** Logo, or the building's icon on its colour. */
export function BuildingMark({ b, size = 40 }: { b: Pick<Building, "icon" | "color" | "logoUrl">; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (b.logoUrl && !broken) {
    return <Image source={{ uri: b.logoUrl }} onError={() => setBroken(true)} style={{ width: size, height: size, borderRadius: size * 0.2, backgroundColor: "#FFFFFF" }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.2, backgroundColor: b.color ?? c.accent, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon d={buildingIconPath(b.icon)} size={size * 0.55} color="#FFFFFF" />
    </View>
  );
}

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function OpenStatusLine({ hours, timeZone }: { hours: OpeningHours | null | undefined; timeZone: string }) {
  const { t, prefs } = useApp();
  const tx = useText();
  const s = openStatus(hours, useNow(), timeZone);
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
    <View style={{ flexDirection: tx.row, alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.open ? (s.closingSoon ? c.warning : "#34D399") : c.danger }} />
      <T size="sm" muted={!s.open}>{text}</T>
    </View>
  );
}

export function HoursTable({ hours }: { hours: OpeningHours }) {
  const { t, prefs } = useApp();
  const tx = useText();
  const today = new Date().getDay();
  return (
    <View style={{ gap: 4 }}>
      {([6, 0, 1, 2, 3, 4, 5] as Weekday[]).map((d) => {
        const iv = hours[String(d) as keyof OpeningHours];
        return (
          <View key={d} style={{ flexDirection: tx.row, justifyContent: "space-between" }}>
            <T size="sm" bold={d === today}>{t(`day.${d}`)}</T>
            <T size="sm" mono muted={!iv?.length} bold={d === today}>
              {iv?.length ? iv.map(([a, b]) => `${formatClock(prefs.locale, a)}–${formatClock(prefs.locale, b)}`).join(", ") : t("hours.closedDay")}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** Next prayer (calculated on the phone), nearest prayer room, Ramadan iftar. */
export function PrayerCard({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, start } = useApp();
  const card = useCard();
  const now = useNow();
  const s = bundle.university.settings;
  const geo = bundle.campuses.find((x) => x.geo)?.geo;
  if (!featureOn(s, "prayer") || s.prayer?.enabled === false || !geo) return null;
  const opts = { method: s.prayer?.method, asr: s.prayer?.asr, maghribOffsetMin: s.prayer?.maghribOffsetMin ?? undefined };
  const next = nextPrayer(now, geo.center[1], geo.center[0], s.timezone, opts);
  if (!next) return null;
  const loc = prefs.locale;
  const ramadan = isRamadan(hijriDate(now, s.timezone));
  const room = start && bundle.rooms.some((r) => r.type === "prayer_room") ? nearestRooms(bundle, graphForBundle(bundle), start.nodeId, ["prayer_room"], routeOptionsFor("shortest"), 1)[0] : undefined;
  return (
    <View style={[card, { gap: 4 }]} accessibilityLabel={t("prayer.title")}>
      <T muted size="xs">{ramadan ? t("ramadan.title") : t("prayer.title")}</T>
      <T bold size="lg">
        {ramadan && next.name === "maghrib"
          ? t("ramadan.iftar", { time: formatCountdownText(loc, next.secondsUntil), clock: formatClock(loc, next.time) })
          : `${t("prayer.next", { prayer: t(`prayer.${next.name}`), time: formatCountdownText(loc, next.secondsUntil) })} · ${formatClock(loc, next.time)}`}
      </T>
      {room ? <Btn title={`${t("prayer.nearestRoom")}: ${room.room.code} · ${formatDistance(loc, room.distanceM)}`} href={`/navigate?to=${room.room.id}`} /> : null}
      <T muted size="xs">{t("prayer.calculated", { method: t(`prayer.method.${s.prayer?.method ?? "mwl"}`) })}</T>
    </View>
  );
}

/** When to leave for the next class, from the student's set location. */
export function LeaveBy({ bundle, occ }: { bundle: CampusBundle; occ: Occurrence }) {
  const { t, prefs, start } = useApp();
  const now = useNow();
  if (!featureOn(bundle.university.settings, "leaveBy") || !occ.roomId || occ.cancelled) return null;
  const secondsUntil = (zonedToInstant(occ.date, occ.startTime, bundle.university.settings.timezone).getTime() - now.getTime()) / 1000;
  if (secondsUntil <= 0 || secondsUntil > 3 * 3600) return null;
  if (!start) return <T muted size="sm">{t("leave.setLocation")}</T>;
  const res = planRouteToRoom(bundle, start.nodeId, occ.roomId, routeOptionsFor(prefs.accessible ? "step_free" : "shortest"), now);
  if (!res.ok) return null;
  const walk = res.plan.estimate.seconds;
  const a = leaveAdvice(secondsUntil, walk);
  const loc = prefs.locale;
  const headline =
    a.status === "leave_now" ? t("leave.leave_now") : a.status === "late" ? t("leave.late", { time: formatDuration(loc, walk - secondsUntil) }) : t(`leave.${a.status}`, { time: formatCountdownText(loc, a.leaveInSeconds) });
  return (
    <View style={{ borderStartWidth: 4, borderStartColor: a.status === "late" ? c.danger : a.status === "leave_now" ? c.warning : c.accent, paddingStart: 10, gap: 2 }} accessibilityLiveRegion="polite">
      <T bold style={{ color: a.status === "relax" ? c.text : a.status === "late" ? c.danger : a.status === "leave_now" ? c.warning : c.accent }}>{headline}</T>
      <T muted size="xs">{`${formatDuration(loc, walk)} · ${t("data.estimate")}`}</T>
    </View>
  );
}

/** Blend hex colour `a` toward `b` by `amount` (0–1) — RN has no CSS color-mix. */
function mix(a: string, b: string, amount: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const ch = [16, 8, 0].map((sh) => Math.round(((ca >> sh) & 255) * (1 - amount) + ((cb >> sh) & 255) * amount));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const DEFAULT_ACCENT = { accent: c.accent, accentSoft: c.accentSoft, mapRoute: c.mapRoute, mapSelected: c.mapSelected };

/**
 * The app uses the dark palette, so the university's brand colour is lightened
 * for contrast on dark backgrounds. Colours that fail WCAG AA with white are
 * ignored, as on the web.
 */
export function applyBranding(bundle: CampusBundle) {
  const p = bundle.university.branding.primaryColor;
  const target = c as unknown as Record<string, string>;
  if (p && readableWithWhite(p)) {
    target.accent = mix(p, "#FFFFFF", 0.45);
    target.mapRoute = target.accent;
    target.accentSoft = mix(p, c.bg, 0.72);
    target.mapSelected = target.accentSoft;
  } else Object.assign(target, DEFAULT_ACCENT);
}
