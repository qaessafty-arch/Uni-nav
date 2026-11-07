"use client";
import { useEffect, useState } from "react";
import { lt, type CampusBundle } from "@campusnav/core";
import { useApp } from "@/lib/store";

const sel = "w-full min-h-11 bg-surface border border-line-strong px-3 rounded-[var(--cn-radius,6px)]";

/**
 * Pick your major (department), then your year (stage), then your group when
 * a year has several. Stores the group; no account needed.
 */
export function MajorYearPicker({ bundle }: { bundle: CampusBundle }) {
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
