"use client";
import { useEffect, useState } from "react";
import { lt, type CampusBundle } from "@campusnav/core";
import { useApp } from "@/lib/store";

const sel = "w-full min-h-11 bg-surface border border-line-strong px-3 rounded-[var(--cn-radius,6px)]";

/**
 * Verified students: their major and year are fixed by verification; they only
 * pick their section when the year has several. Staff can browse any group.
 * Visitors never get here (see StudentOnly).
 */
export function MajorYearPicker({ bundle }: { bundle: CampusBundle }) {
  const { student } = useApp();
  if (student.access.kind === "staff") return <StaffGroupPicker bundle={bundle} />;
  if (student.access.kind === "student") return <MySection bundle={bundle} />;
  return null;
}

function MySection({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, setPrefs, student } = useApp();
  const a = student.access.kind === "student" ? student.access : null;
  // bundle.groups is already limited to the student's own major and year.
  const groups = bundle.groups;
  const ok = groups.some((g) => g.id === prefs.groupId);
  useEffect(() => {
    if (!ok) setPrefs({ groupId: groups.length === 1 ? groups[0]!.id : null });
  }, [ok, groups, setPrefs]);
  if (!a) return null;
  const dept = bundle.departments.find((d) => d.id === a.departmentId);
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4" data-testid="my-section">
      <span className="cn-chip !min-h-9" data-testid="my-major-year">
        <span className="text-muted">{t("access.student")}:</span> {t("access.studentOf", { major: dept ? lt(dept.name, prefs.locale) : "—", year: a.year })}
      </span>
      {groups.length > 1 ? (
        <label className="text-sm min-w-56">
          <span className="label-caps block mb-1">{t("student.yourSections")}</span>
          <select className={sel} value={prefs.groupId ?? ""} onChange={(e) => setPrefs({ groupId: e.target.value || null })} aria-label={t("student.yourSections")}>
            <option value="">{t("timetable.chooseGroup")}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{lt(g.name, prefs.locale)}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function StaffGroupPicker({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, setPrefs } = useApp();
  const loc = prefs.locale;
  const current = bundle.groups.find((g) => g.id === prefs.groupId);
  const [major, setMajor] = useState<string>(current?.departmentId ?? "");
  const [year, setYear] = useState<string>(current?.stage != null ? String(current.stage) : "");
  useEffect(() => {
    if (current) {
      setMajor(current.departmentId ?? "");
      setYear(current.stage != null ? String(current.stage) : "");
    }
  }, [current]);

  const majors = bundle.departments.filter((d) => bundle.groups.some((g) => g.departmentId === d.id)).sort((a, b) => lt(a.name, loc).localeCompare(lt(b.name, loc)));
  const years = [...new Set(bundle.groups.filter((g) => g.departmentId === major).map((g) => g.stage ?? 0))].sort((a, b) => a - b);
  const groups = bundle.groups.filter((g) => g.departmentId === major && String(g.stage ?? 0) === year);

  const pickYear = (y: string) => {
    setYear(y);
    const gs = bundle.groups.filter((g) => g.departmentId === major && String(g.stage ?? 0) === y);
    setPrefs({ groupId: gs.length === 1 ? gs[0]!.id : null });
  };

  return (
    <div className="grid sm:grid-cols-3 gap-2 mb-4" data-testid="major-year">
      <label className="text-sm">
        <span className="label-caps block mb-1">{t("timetable.major")}</span>
        <select className={sel} value={major} onChange={(e) => { setMajor(e.target.value); setYear(""); setPrefs({ groupId: null }); }} aria-label={t("timetable.major")}>
          <option value="">{t("timetable.chooseMajor")}</option>
          {majors.map((d) => <option key={d.id} value={d.id}>{lt(d.name, loc)}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="label-caps block mb-1">{t("timetable.year")}</span>
        <select className={sel} value={year} disabled={!major} onChange={(e) => pickYear(e.target.value)} aria-label={t("timetable.year")}>
          <option value="">{t("timetable.chooseYear")}</option>
          {years.map((y) => <option key={y} value={String(y)}>{t("timetable.yearN", { n: y })}</option>)}
        </select>
      </label>
      {groups.length > 1 ? (
        <label className="text-sm">
          <span className="label-caps block mb-1">{t("timetable.section")}</span>
          <select className={sel} value={prefs.groupId ?? ""} onChange={(e) => setPrefs({ groupId: e.target.value || null })} aria-label={t("timetable.section")}>
            <option value="">{t("timetable.chooseGroup")}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{lt(g.name, loc)}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
}
