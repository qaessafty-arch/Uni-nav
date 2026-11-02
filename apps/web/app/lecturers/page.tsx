"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { lt, search } from "@campusnav/core";
import { Gate } from "@/components/Gate";
import { Badge, EmptyState, PageTitle, Row } from "@/components/ui";
import { useApp } from "@/lib/store";
import { lookup } from "@/lib/lookup";

function LecturersInner() {
  const { t, prefs } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const dept = params.get("dept") ?? "";
  return (
    <Gate>
      {(bundle, index) => {
        const loc = prefs.locale;
        const l = lookup(bundle);
        // Course → lecturers via timetable
        const lecturerCourses = new Map<string, Set<string>>();
        for (const e of bundle.timetable) if (e.lecturerId) (lecturerCourses.get(e.lecturerId) ?? lecturerCourses.set(e.lecturerId, new Set()).get(e.lecturerId)!).add(e.courseId);
        let list = bundle.lecturers;
        if (q.trim()) {
          const hits = search(index, q, { limit: 200, types: ["lecturer", "course", "department", "room"] });
          const ids = new Set<string>();
          for (const h of hits) {
            if (h.type === "lecturer") ids.add(h.id);
            if (h.type === "department") bundle.lecturers.filter((x) => x.departmentId === h.id).forEach((x) => ids.add(x.id));
            if (h.type === "course") for (const [lid, cs] of lecturerCourses) if (cs.has(h.id)) ids.add(lid);
            if (h.type === "room") bundle.lecturers.filter((x) => x.officeRoomId === h.id).forEach((x) => ids.add(x.id));
          }
          list = list.filter((x) => ids.has(x.id));
        }
        if (dept) list = list.filter((x) => x.departmentId === dept);
        list = [...list].sort((a, b) => lt(a.fullName, loc).localeCompare(lt(b.fullName, loc), loc));
        return (
          <div className="max-w-3xl">
            <PageTitle>{t("lecturers.title")}</PageTitle>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <label className="sr-only" htmlFor="lect-q">{t("lecturers.search")}</label>
              <input id="lect-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("lecturers.search")} className="flex-1 min-h-12 bg-surface border border-line-strong px-3" />
              <label className="sr-only" htmlFor="lect-dept">{t("common.department")}</label>
              <select id="lect-dept" value={dept} onChange={(e) => router.replace(e.target.value ? `/lecturers?dept=${e.target.value}` : "/lecturers")} className="min-h-12 bg-surface border border-line-strong px-3">
                <option value="">{t("common.all")} — {t("common.department")}</option>
                {bundle.departments.map((d) => (
                  <option key={d.id} value={d.id}>{lt(d.name, loc)}</option>
                ))}
              </select>
            </div>
            {list.length === 0 ? (
              <EmptyState title={t("lecturers.none")} />
            ) : (
              list.map((x) => {
                const office = x.officeRoomId ? l.rooms.get(x.officeRoomId) : undefined;
                return (
                  <Row
                    key={x.id}
                    href={`/lecturers/${x.id}`}
                    title={lt(x.fullName, loc)}
                    subtitle={[lt(x.title, loc), lt(x.departmentId ? l.departments.get(x.departmentId)?.name : null, loc)].filter(Boolean).join(" · ")}
                    meta={office ? <span className="mono">{office.code}</span> : x.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : null}
                  />
                );
              })
            )}
          </div>
        );
      }}
    </Gate>
  );
}

export default function LecturersPage() {
  return (
    <Suspense>
      <LecturersInner />
    </Suspense>
  );
}
