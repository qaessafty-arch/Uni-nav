"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { lt, type Weekday } from "@campusnav/core";
import { formatClock, formatInstant } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { Badge, ButtonLink, ErrorState, Notice, Section } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

export default function LecturerPage() {
  const { id } = useParams<{ id: string }>();
  const { t, prefs } = useApp();
  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        const x = l.lecturers.get(id);
        if (!x) return <ErrorState title={t("error.notFound")} />;
        const office = x.officeRoomId ? l.rooms.get(x.officeRoomId) : undefined;
        const dept = x.departmentId ? l.departments.get(x.departmentId) : undefined;
        const courseIds = [...new Set(bundle.timetable.filter((e) => e.lecturerId === x.id).map((e) => e.courseId))];
        return (
          <div className="max-w-3xl">
            <div className="flex items-start gap-5">
              {x.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.photoUrl} alt="" className="size-20 object-cover border border-line" />
              ) : (
                <div className="size-20 border border-line-strong grid place-items-center mono text-xl text-muted" aria-hidden>
                  {lt(x.fullName, "en").split(" ").map((p) => p[0]).slice(-2).join("")}
                </div>
              )}
              <div className="min-w-0">
                {x.title ? <div className="label-caps">{lt(x.title, loc)}</div> : null}
                <h1 className="cn-display cn-display-lg mt-1">{lt(x.fullName, loc)}</h1>
                {dept ? (
                  <Link href={`/lecturers?dept=${dept.id}`} className="text-muted hover:underline">
                    {lt(dept.name, loc)}
                  </Link>
                ) : null}
                <div className="mt-2 flex gap-2">{x.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : x.dataStatus === "verified" ? <Badge tone="accent">{t("data.verified")}</Badge> : null}</div>
              </div>
            </div>

            <Section title={t("lecturer.office")} className="mt-8">
              {office ? (
                <div className="cn-card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <Link href={`/rooms/${office.id}`} className="mono text-xl font-semibold hover:underline">
                      {office.code}
                    </Link>
                    <p className="text-sm text-muted">
                      {lt(l.buildings.get(office.buildingId)?.name, loc)} · {lt(l.floors.get(office.floorId)?.name, loc)}
                    </p>
                  </div>
                  <ButtonLink href={`/navigate?to=${office.id}`} variant="primary">
                    {t("lecturer.navigateOffice")}
                  </ButtonLink>
                </div>
              ) : (
                <p className="text-muted text-sm">{t("lecturer.noOffice")}</p>
              )}
            </Section>

            <Section title={t("lecturer.officeHours")}>
              {x.officeHours.length ? (
                <ul className="divide-y divide-line border border-line">
                  {[...x.officeHours]
                    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
                    .map((h, i) => (
                      <li key={i} className="flex justify-between px-4 py-3 text-sm">
                        <span>{t(`day.${h.day as Weekday}`)}</span>
                        <span className="mono">
                          {formatClock(loc, h.start)}–{formatClock(loc, h.end)}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-muted text-sm">{t("lecturer.noOfficeHours")}</p>
              )}
            </Section>

            <Section title={t("lecturer.availability")}>
              {x.availability ? (
                <div className="text-sm">
                  <Badge tone={x.availability.status === "available" ? "accent" : "warn"}>{t(`lecturer.availability.${x.availability.status}`)}</Badge>
                  {x.availability.note ? <p className="mt-2">{lt(x.availability.note, loc)}</p> : null}
                  <p className="text-faint mono text-xs mt-1">{t("lecturer.updated", { date: formatInstant(loc, x.availability.updatedAt, bundle.university.settings.timezone) })}</p>
                </div>
              ) : (
                <Notice>{t("lecturer.availabilityUnknown")}</Notice>
              )}
            </Section>

            <Section title={t("lecturer.courses")}>
              {courseIds.length ? (
                <ul className="flex flex-wrap gap-2">
                  {courseIds.map((cid) => {
                    const c = l.courses.get(cid);
                    return c ? (
                      <li key={cid}>
                        <Link href={`/courses/${cid}`} className="inline-block border border-line-strong px-3 py-2 text-sm hover:border-accent">
                          <span className="mono me-2 text-muted">{c.code}</span>
                          {lt(c.name, loc)}
                        </Link>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <p className="text-muted text-sm">—</p>
              )}
            </Section>

            {x.publicEmail ? (
              <Section title={t("lecturer.contact")}>
                <a href={`mailto:${x.publicEmail}`} className="mono text-sm underline">
                  {x.publicEmail}
                </a>
              </Section>
            ) : null}
          </div>
        );
      }}
    </Gate>
  );
}
