import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { lt, type CampusBundle } from "@campusnav/core";
import { useApp } from "./store";
import { Label, T, c, useText } from "./ui";

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={{ borderWidth: 1, borderColor: on ? c.accent : c.borderStrong, backgroundColor: on ? c.accentSoft : "transparent", borderRadius: 8, paddingHorizontal: 12, minHeight: 40, justifyContent: "center" }}>
      <T size="sm" style={{ color: on ? c.accent : c.text }}>{label}</T>
    </Pressable>
  );
}

/** Major → year → group (when a year has several). No account needed. */
export function MajorYear({ bundle }: { bundle: CampusBundle }) {
  const { t, prefs, setPrefs } = useApp();
  const tx = useText();
  const loc = prefs.locale;
  const current = bundle.groups.find((g) => g.id === prefs.groupId);
  const [major, setMajor] = useState(current?.departmentId ?? "");
  const [year, setYear] = useState(current?.stage != null ? String(current.stage) : "");
  useEffect(() => {
    if (current) {
      setMajor(current.departmentId ?? "");
      setYear(current.stage != null ? String(current.stage) : "");
    }
  }, [current]);
  const majors = bundle.departments.filter((d) => bundle.groups.some((g) => g.departmentId === d.id));
  const years = [...new Set(bundle.groups.filter((g) => g.departmentId === major).map((g) => g.stage ?? 0))].sort((a, b) => a - b);
  const groups = bundle.groups.filter((g) => g.departmentId === major && String(g.stage ?? 0) === year);
  return (
    <View style={{ gap: 8 }}>
      <Label>{t("timetable.major")}</Label>
      <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
        {majors.map((d) => <Chip key={d.id} label={lt(d.name, loc)} on={major === d.id} onPress={() => { setMajor(d.id); setYear(""); setPrefs({ groupId: null }); }} />)}
      </View>
      {major ? (
        <>
          <Label>{t("timetable.year")}</Label>
          <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }} accessibilityRole="radiogroup">
            {years.map((y) => (
              <Chip key={y} label={t("timetable.yearN", { n: y })} on={year === String(y)} onPress={() => {
                setYear(String(y));
                const gs = bundle.groups.filter((g) => g.departmentId === major && (g.stage ?? 0) === y);
                setPrefs({ groupId: gs.length === 1 ? gs[0]!.id : null });
              }} />
            ))}
          </View>
        </>
      ) : null}
      {groups.length > 1 ? (
        <>
          <Label>{t("timetable.section")}</Label>
          <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }}>
            {groups.map((g) => <Chip key={g.id} label={lt(g.name, loc)} on={prefs.groupId === g.id} onPress={() => setPrefs({ groupId: g.id })} />)}
          </View>
        </>
      ) : null}
    </View>
  );
}
