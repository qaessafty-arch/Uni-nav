"use client";
import { useEffect, useState } from "react";
import { leaveAdvice, planRouteToRoom, routeOptionsFor, zonedToInstant, type CampusBundle, type Occurrence } from "@campusnav/core";
import { formatCountdownText, formatDuration } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { nodeName } from "./LocationPicker";
import { Icon } from "./Icon";
import { I } from "./icons";
import { ButtonLink, cx } from "./ui";

const TONE = { relax: "border-line", leave_soon: "border-accent", leave_now: "border-warn", late: "border-danger" } as const;

/**
 * "When should I leave?" for the next class: the real walking route from the
 * place the student set (QR / pick / tap) to the class room, with closures and
 * the step-free preference applied. Hidden when the class is far away in time.
 */
export function LeaveBy({ bundle, occ }: { bundle: CampusBundle; occ: Occurrence }) {
  const { t, prefs, start } = useApp();
  const loc = prefs.locale;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!occ.roomId || occ.cancelled) return null;
  const startsAt = zonedToInstant(occ.date, occ.startTime, bundle.university.settings.timezone).getTime();
  const secondsUntil = (startsAt - now) / 1000;
  if (secondsUntil <= 0 || secondsUntil > 3 * 3600) return null;

  if (!start) return <p className="text-sm text-muted mt-2" data-testid="leave-by">{t("leave.setLocation")}</p>;
  const res = planRouteToRoom(bundle, start.nodeId, occ.roomId, routeOptionsFor(prefs.accessible ? "step_free" : "shortest"), new Date(now));
  if (!res.ok) return null;
  const walk = res.plan.estimate.seconds;
  const a = leaveAdvice(secondsUntil, walk);
  const startNode = lookup(bundle).nodes.get(start.nodeId);
  const headline =
    a.status === "leave_now" ? t("leave.leave_now")
    : a.status === "late" ? t("leave.late", { time: formatDuration(loc, walk - secondsUntil) })
    : t(`leave.${a.status}`, { time: formatCountdownText(loc, a.leaveInSeconds) });

  return (
    <div className={cx("mt-2 cn-card p-3 border-s-4 flex items-center gap-3", TONE[a.status])} data-testid="leave-by" role="status">
      <div className="min-w-0 flex-1">
        <div className={cx("font-semibold", a.status === "late" ? "text-danger" : a.status === "leave_now" ? "text-warn" : a.status === "leave_soon" ? "text-accent" : "")}>{headline}</div>
        <div className="text-xs text-muted truncate">
          {t("leave.walk", { time: formatDuration(loc, walk), place: startNode ? nodeName(startNode, lookup(bundle), loc) : "" })} · {t("data.estimate")}
        </div>
      </div>
      <ButtonLink href={`/navigate?to=${occ.roomId}`} variant={a.status === "relax" ? "secondary" : "primary"} className="!min-h-9 shrink-0">
        <Icon d={I.route} className="size-4" /> {t("common.navigate")}
      </ButtonLink>
    </div>
  );
}
