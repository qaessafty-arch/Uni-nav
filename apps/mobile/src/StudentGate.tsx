import type { ReactNode } from "react";
import { View } from "react-native";
import { lt } from "@campusnav/core";
import { useApp } from "./store";
import { Btn, Notice, Screen, T } from "./ui";

/** Timetables, classrooms and free rooms are for verified students; visitors see how to verify. */
export function StudentOnly({ children }: { children: ReactNode }) {
  const { student, t, bundleState, prefs } = useApp();
  if (student.access.kind !== "visitor") return <>{children}</>;
  const p = student.pending;
  const dept = p && bundleState.status === "ready" ? bundleState.bundle.departments.find((d) => d.id === p.departmentId) : null;
  return (
    <Screen>
      <View style={{ gap: 12 }}>
        <T display size="xl">{t("student.onlyTitle")}</T>
        <T muted>{t("student.onlyBody")}</T>
        {p ? <Notice>{t("student.pending", { major: dept ? lt(dept.name, prefs.locale) : "—", year: p.year })}</Notice> : null}
        {student.rejected ? <Notice tone="warn">{t("student.rejected")}</Notice> : null}
        <Btn variant="primary" title={t("student.verifyCta")} href="/verify" />
        <T muted size="sm">{t("student.visitorNote")}</T>
      </View>
    </Screen>
  );
}
