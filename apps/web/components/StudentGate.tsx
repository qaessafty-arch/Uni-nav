"use client";
import type { ReactNode } from "react";
import { lt } from "@campusnav/core";
import { useApp, useBundle } from "@/lib/store";
import { Icon } from "./Icon";
import { I } from "./icons";
import { ButtonLink, Notice } from "./ui";

/** "Computing · Year 2" for the current student, or null. */
export function useStudentLabel(): string | null {
  const { student, t, prefs } = useApp();
  const bundle = useBundle();
  const a = student.access;
  if (a.kind !== "student") return null;
  const dept = bundle?.departments.find((d) => d.id === a.departmentId);
  const base = t("access.studentOf", { major: dept ? lt(dept.name, prefs.locale) : "—", year: a.year });
  const repOf = bundle?.classRoles?.repGroupIds.map((id) => bundle.groups.find((g) => g.id === id)?.code).filter(Boolean) ?? [];
  return repOf.length ? `${base} · ${t("class.rep", { group: repOf.join(", ") })}` : base;
}

/**
 * Timetables, classrooms and free rooms are for verified students only.
 * Visitors see why, and how to verify; nothing student-only is rendered.
 */
export function StudentOnly({ children, then }: { children: ReactNode; then: string }) {
  const { student, t, prefs } = useApp();
  const bundle = useBundle();
  if (student.access.kind !== "visitor") return <>{children}</>;
  const p = student.pending;
  const pendingDept = p ? bundle?.departments.find((d) => d.id === p.departmentId) : null;
  return (
    <div className="cn-panel p-5 md:p-6 max-w-2xl space-y-4" data-testid="student-only">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-10 shrink-0 bg-accent/10 text-accent rounded-[var(--cn-radius,8px)]">
          <Icon d={I.lecturers} className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-lg">{t("student.onlyTitle")}</h2>
          <p className="text-muted mt-1">{t("student.onlyBody")}</p>
        </div>
      </div>
      {p ? <Notice tone="info">{t("student.pending", { major: pendingDept ? lt(pendingDept.name, prefs.locale) : "—", year: p.year })}</Notice> : null}
      {student.rejected ? <Notice tone="warn">{t("student.rejected")}</Notice> : null}
      <ButtonLink variant="primary" href={`/verify?then=${encodeURIComponent(then)}`} data-testid="verify-cta">
        <Icon d={I.checkCircle} className="size-4" /> {t("student.verifyCta")}
      </ButtonLink>
      <p className="text-sm text-faint">{t("student.visitorNote")}</p>
    </div>
  );
}
