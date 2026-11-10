"use client";
import Link from "next/link";
import { lt, type CampusBundle, type Occurrence } from "@campusnav/core";
import { formatClock, formatDate } from "@campusnav/i18n";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";
import { useUnseenMaterials } from "@/lib/materials";
import { Badge, ButtonLink, cx } from "./ui";

/** One timetable occurrence with room/lecturer links, change markers and a Navigate action. */
export function LectureCard({ bundle, occ, emphasis, countdown, showDate }: { bundle: CampusBundle; occ: Occurrence; emphasis?: boolean; countdown?: string; showDate?: boolean }) {
  const { t, prefs } = useApp();
  const l = lookup(bundle);
  const loc = prefs.locale;
  const course = l.courses.get(occ.courseId);
  const room = occ.roomId ? l.rooms.get(occ.roomId) : undefined;
  const building = room ? l.buildings.get(room.buildingId) : undefined;
  const floor = room ? l.floors.get(room.floorId) : undefined;
  const lecturer = occ.lecturerId ? l.lecturers.get(occ.lecturerId) : undefined;
  const roomChanged = occ.changes.some((c) => c.type === "room_change");
  const timeChanged = occ.changes.some((c) => c.type === "time_change");
  const lecturerChanged = occ.changes.some((c) => c.type === "lecturer_change");
  const origRoom = occ.original.roomId ? l.rooms.get(occ.original.roomId) : undefined;
  const unseen = useUnseenMaterials(bundle).filter((m) => m.courseId === occ.courseId).length;
  const hasMaterials = (bundle.materials ?? []).some((m) => m.courseId === occ.courseId);

  return (
    <article className={cx("cn-card p-4 md:p-5", emphasis && "cn-card-accent", occ.cancelled && "opacity-70")} aria-label={lt(course?.name, loc)}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="mono text-sm leading-tight shrink-0 w-16">
          {showDate ? <div className="text-faint text-xs mb-1">{formatDate(loc, occ.date)}</div> : null}
          <div className={cx("cn-figure text-xl", occ.cancelled && "line-through")}>{formatClock(loc, occ.startTime)}</div>
          <div className="text-muted">{formatClock(loc, occ.endTime)}</div>
        </div>
        <div className="min-w-[11rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {course ? (
              <Link href={`/courses/${course.id}`} className="font-semibold hover:underline">
                {lt(course.name, loc)}
              </Link>
            ) : null}
            {occ.kind ? <Badge>{t(`timetable.kind.${occ.kind}`)}</Badge> : null}
            {course && hasMaterials ? (
              <Link href={`/courses/${course.id}#materials`} className="text-xs underline text-muted hover:text-fg" data-testid="card-materials">
                {t("material.title")}
              </Link>
            ) : null}
            {unseen ? <Badge tone="accent">{t("material.newCount", { n: unseen })}</Badge> : null}
            {occ.cancelled ? <Badge tone="danger">{t("timetable.cancelled")}</Badge> : null}
          </div>
          <div className="text-sm text-muted mt-1 space-y-0.5">
            {room ? (
              <div>
                <Link href={`/rooms/${room.id}`} className="mono text-fg hover:underline">
                  {room.code}
                </Link>{" "}
                · {lt(building?.name, loc)} · {lt(floor?.name, loc)}
              </div>
            ) : null}
            {lecturer ? (
              <div>
                <Link href={`/lecturers/${lecturer.id}`} className="hover:underline">
                  {lt(lecturer.fullName, loc)}
                </Link>
              </div>
            ) : null}
          </div>
          {(roomChanged || timeChanged || lecturerChanged) && !occ.cancelled ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {roomChanged ? <Badge tone="warn">{t("timetable.roomChanged", { room: origRoom?.code ?? "—" })}</Badge> : null}
              {timeChanged ? <Badge tone="warn">{t("timetable.timeChanged", { time: `${formatClock(loc, occ.original.startTime)}–${formatClock(loc, occ.original.endTime)}` })}</Badge> : null}
              {lecturerChanged ? <Badge tone="warn">{t("timetable.lecturerChanged")}</Badge> : null}
            </div>
          ) : null}
          {occ.changes.map((c) => (c.note ? <p key={c.id} className="text-xs text-warn mt-1">{lt(c.note, loc)}</p> : null))}
          {countdown ? <p className="mono text-accent text-sm mt-2">{countdown}</p> : null}
        </div>
        {room && !occ.cancelled ? (
          <ButtonLink href={`/navigate?to=${room.id}`} variant={emphasis ? "primary" : "secondary"} className="shrink-0 ms-auto">
            {t("common.navigate")}
          </ButtonLink>
        ) : null}
      </div>
    </article>
  );
}
