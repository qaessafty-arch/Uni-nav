"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { lt, type Weekday } from "@campusnav/core";
import { formatClock } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { Badge, ButtonLink, ErrorState, PageTitle, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { t, prefs } = useApp();
  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        const c = l.courses.get(id);
        if (!c) return <ErrorState title={t("error.notFound")} />;
        const entries = bundle.timetable.filter((e) => e.courseId === c.id && e.status !== "cancelled").sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
        const lecturerIds = [...new Set(entries.map((e) => e.lecturerId).filter((x): x is string => !!x))];
        return (
          <div className="max-w-3xl">
            <PageTitle eyebrow={<span className="mono">{c.code}</span>}>{lt(c.name, loc)}</PageTitle>
            <div className="flex flex-wrap gap-2 -mt-2 mb-4">
              {c.departmentId ? <Badge>{lt(l.departments.get(c.departmentId)?.name, loc)}</Badge> : null}
              {c.credits != null ? <Badge>{t("course.credits", { n: c.credits })}</Badge> : null}
            </div>
            {c.description ? <p className="text-muted">{lt(c.description, loc)}</p> : null}
            <Section title={t("course.sessions")} className="mt-6">
              <ul className="border border-line divide-y divide-line">
                {entries.map((e) => {
                  const room = e.roomId ? l.rooms.get(e.roomId) : undefined;
                  const group = e.groupId ? l.groups.get(e.groupId) : undefined;
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="w-28 text-sm">{t(`day.${e.day as Weekday}`)}</span>
                      <span className="mono text-sm w-28">{formatClock(loc, e.startTime)}–{formatClock(loc, e.endTime)}</span>
                      {e.kind ? <Badge>{t(`timetable.kind.${e.kind}`)}</Badge> : null}
                      {group ? <span className="text-sm text-muted mono">{group.code}</span> : null}
                      <span className="flex-1" />
                      {room ? (
                        <ButtonLink href={`/navigate?to=${room.id}`} className="!min-h-9">
                          <span className="mono">{room.code}</span> →
                        </ButtonLink>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
            <Section title={t("course.lecturers")}>
              {lecturerIds.map((lid) => (
                <Link key={lid} href={`/lecturers/${lid}`} className="block py-2 hover:underline">
                  {lt(l.lecturers.get(lid)?.fullName, loc)}
                </Link>
              ))}
            </Section>
          </div>
        );
      }}
    </Gate>
  );
}
