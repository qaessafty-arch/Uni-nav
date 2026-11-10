"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentAndNext, featureOn, freeRoomsAt, freeRoomScope, lt, todaySummary, toMinutes, zonedNow, type CampusBundle } from "@campusnav/core";
import { formatClock, formatDate } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { useUnseenMaterials } from "@/lib/materials";
import { LectureCard } from "./LectureCard";
import { LeaveBy } from "./LeaveBy";
import { Icon } from "./Icon";
import { I } from "./icons";
import { Badge, ButtonLink, cx } from "./ui";

/**
 * The student's day at a glance: the class that is on now or next (with when to
 * leave), the rest of today, what changed, new lecture files, free rooms and
 * lecturers in office hours. Visitors get a short guide instead.
 */
export function TodayCard({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, student, start } = useApp();
  const loc = prefs.locale;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const unseen = useUnseenMaterials(bundle);
  const settings = bundle.university.settings;

  if (student.access.kind === "visitor") {
    return (
      <section className="cn-card cn-today p-4" data-testid="today-visitor" aria-label={t("today.visitorTitle")}>
        <h2 className="font-semibold text-lg">{t("today.visitorTitle")}</h2>
        <p className="text-sm text-muted mt-1">{t("today.visitorBody")}</p>
        <div className="mt-3">
          <ButtonLink href="/verify" variant="primary" className="!min-h-10">{t("student.verifyCta")}</ButtonLink>
        </div>
      </section>
    );
  }

  const tz = settings.timezone;
  const l = lookup(bundle);
  const today = todaySummary(bundle, now, prefs.groupId);
  const z = zonedNow(now, tz);
  const cn = today.groupId ? currentAndNext(now, tz, bundle.timetable, bundle.scheduleChanges, { groupId: today.groupId }) : null;
  const lead = cn?.current ?? cn?.next ?? null;
  const later = today.classes.filter((o) => o !== lead && !(lead && o.entryId === lead.entryId && o.date === lead.date) && toMinutes(o.endTime) > z.minutes);
  const scope = freeRoomScope(bundle, today.groupId, start?.nodeId);
  const free = featureOn(settings, "freeRooms") && bundle.roomOccupancy ? freeRoomsAt(bundle, now, scope.buildingIds.size ? { buildingIds: scope.buildingIds } : {}) : [];
  const group = today.groupId ? l.groups.get(today.groupId) : undefined;

  return (
    <section className="cn-card cn-today p-4 space-y-3" data-testid="today-card" aria-label={t("today.title")}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold text-lg">{t("today.title")}</h2>
        <span className="text-sm text-muted">{formatDate(loc, today.date)}</span>
        {group ? <span className="mono text-xs text-faint">{group.code}</span> : null}
        <span className="flex-1" />
        {today.remaining ? <Badge tone="accent">{t("today.left", { n: today.remaining })}</Badge> : null}
        {today.changed ? <Badge tone="warn">{t("today.changed", { n: today.changed })}</Badge> : null}
      </header>

      {lead ? (
        <div>
          <div className="label-caps mb-1.5">{cn?.current ? t("today.now") : t("today.next")}</div>
          <LectureCard bundle={bundle} occ={lead} emphasis showDate={lead.date !== today.date} />
          {!cn?.current && featureOn(settings, "leaveBy") ? <LeaveBy bundle={bundle} occ={lead} /> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("home.noLectures")}</p>
      )}

      {later.length ? (
        <ul className="divide-y divide-[var(--cn-border)]" data-testid="today-later">
          {later.map((o) => {
            const course = l.courses.get(o.courseId);
            const room = o.roomId ? l.rooms.get(o.roomId) : undefined;
            return (
              <li key={`${o.entryId}-${o.startTime}`} className={cx("py-2 flex items-center gap-3 text-sm", o.cancelled && "opacity-60")}>
                <span className={cx("mono w-24 shrink-0", o.cancelled && "line-through")}>{formatClock(loc, o.startTime)}–{formatClock(loc, o.endTime)}</span>
                <Link href={`/courses/${o.courseId}`} className="flex-1 min-w-0 truncate hover:underline">{lt(course?.name, loc)}</Link>
                {o.cancelled ? <Badge tone="danger">{t("timetable.cancelled")}</Badge> : room ? (
                  <Link href={`/navigate?to=${room.id}`} className="mono text-accent hover:underline shrink-0">{room.code} →</Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : lead && lead.date === today.date ? null : today.classes.length ? (
        <p className="text-sm text-muted">{t("today.done")}</p>
      ) : (
        <p className="text-sm text-muted">{t("today.none")}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        {free.length ? (
          <Link href="/free-rooms" className="cn-tile p-3 flex flex-col gap-0.5 min-w-0" data-testid="today-free">
            <span className="flex items-center gap-2 text-muted"><Icon d={I.hall} className="size-4 text-accent" />{t("today.freeNow")}</span>
            <span className="font-semibold">{t("today.freeCount", { n: free.length })}</span>
            <span className="mono text-xs text-muted truncate">{free.slice(0, 3).map((f) => f.room.code).join(" · ")}</span>
          </Link>
        ) : null}
        {today.lecturersAvailable.length ? (
          <Link href="/lecturers" className="cn-tile p-3 flex flex-col gap-0.5 min-w-0" data-testid="today-lecturers">
            <span className="flex items-center gap-2 text-muted"><Icon d={I.lecturers} className="size-4 text-accent" />{t("today.lecturersNow")}</span>
            <span className="font-semibold">{today.lecturersAvailable.length}</span>
            <span className="text-xs text-muted truncate">{today.lecturersAvailable.slice(0, 2).map((x) => lt(x.fullName, loc)).join(" · ")}</span>
          </Link>
        ) : null}
        {unseen.length ? (
          <Link href="/notifications" className="cn-tile p-3 flex flex-col gap-0.5 min-w-0" data-testid="today-files">
            <span className="flex items-center gap-2 text-muted"><Icon d={I.bell} className="size-4 text-accent" />{t("today.newFiles")}</span>
            <span className="font-semibold">{t("material.newCount", { n: unseen.length })}</span>
          </Link>
        ) : null}
        <Link href="/timetable" className="cn-tile p-3 flex flex-col gap-0.5 min-w-0">
          <span className="flex items-center gap-2 text-muted"><Icon d={I.timetable} className="size-4 text-accent" />{t("nav.timetable")}</span>
          <span className="font-semibold">{t("today.week")}</span>
        </Link>
      </div>
    </section>
  );
}
