"use client";
import { useState } from "react";
import { addDays, isWeekend, lt, occurrencesForDates, weekDates, weekStartFor, zonedNow } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { Gate } from "@/components/Gate";
import { LectureCard } from "@/components/LectureCard";
import { MajorYearPicker } from "@/components/MajorYearPicker";
import { StudentOnly } from "@/components/StudentGate";
import { Button, EmptyState, PageTitle, cx } from "@/components/ui";
import { useApp } from "@/lib/store";

export default function TimetablePage() {
  const { t, prefs, setPrefs } = useApp();
  const [view, setView] = useState<"day" | "week">("day");
  const [offset, setOffset] = useState(0);
  return (
    <Gate>
      {(bundle) => {
        const loc = prefs.locale;
        const s = bundle.university.settings;
        const today = zonedNow(new Date(), s.timezone).date;
        const anchor = addDays(today, view === "day" ? offset : offset * 7);
        const dates = view === "day" ? [anchor] : weekDates(anchor, weekStartFor(s.weekendDays));
        const occ = prefs.groupId ? occurrencesForDates(dates, bundle.timetable, bundle.scheduleChanges, { groupId: prefs.groupId }) : null;
        return (
          <div className="max-w-3xl">
            <PageTitle>{t("timetable.title")}</PageTitle>
            <StudentOnly then="/timetable">
            <MajorYearPicker bundle={bundle} />

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="cn-seg" role="tablist">
                {(["day", "week"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setOffset(0); }} className="min-h-11 px-4 text-sm">
                    {t(`timetable.${v}`)}
                  </button>
                ))}
              </div>
              <Button onClick={() => setOffset(offset - 1)} aria-label={t("timetable.prev")}><span className="rtl:rotate-180">←</span></Button>
              <Button onClick={() => setOffset(0)} disabled={offset === 0}>{t("timetable.today")}</Button>
              <Button onClick={() => setOffset(offset + 1)} aria-label={t("timetable.next")}><span className="rtl:rotate-180">→</span></Button>
              <span className="text-xs text-faint mono ms-auto">{t("timetable.timezone", { tz: s.timezone })}</span>
            </div>

            {!occ ? (
              <EmptyState title={t("home.pickGroup")} />
            ) : (
              <div className="space-y-6">
                {dates.map((d) => {
                  const list = occ.get(d) ?? [];
                  const weekend = isWeekend(d, s.weekendDays);
                  return (
                    <section key={d} aria-label={formatDate(loc, d, { weekday: "long", day: "numeric", month: "long" })}>
                      <h2 className={cx("label-caps mb-2 flex items-center gap-2", d === today && "text-accent")}>
                        {formatDate(loc, d, { weekday: "long", day: "numeric", month: "short" })}
                        {d === today ? <span>· {t("timetable.today")}</span> : null}
                      </h2>
                      {list.length ? (
                        <div className="space-y-2">{list.map((o) => <LectureCard key={`${o.entryId}-${d}`} bundle={bundle} occ={o} emphasis={d === today} />)}</div>
                      ) : (
                        <p className="text-sm text-muted border border-dashed border-line px-4 py-3">{weekend ? t("timetable.weekend") : t("timetable.noClasses")}</p>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
            </StudentOnly>
          </div>
        );
      }}
    </Gate>
  );
}
