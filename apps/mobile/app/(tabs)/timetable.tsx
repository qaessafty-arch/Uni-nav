import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { addDays, isWeekend, lt, occurrencesOn, zonedNow } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { Gate } from "@/Gate";
import { OccurrenceCard } from "@/OccurrenceCard";
import { useApp } from "@/store";
import { Btn, Label, T, c, useText } from "@/ui";

export default function TimetableScreen() {
  const { t, prefs, setPrefs } = useApp();
  const tx = useText();
  const [offset, setOffset] = useState(0);
  return (
    <Gate>
      {(b) => {
        const s = b.university.settings;
        const today = zonedNow(new Date(), s.timezone).date;
        const date = addDays(today, offset);
        const list = prefs.groupId ? occurrencesOn(date, b.timetable, b.scheduleChanges, { groupId: prefs.groupId }) : [];
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Label>{t("timetable.group")}</Label>
            <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }}>
              {b.groups.map((g) => (
                <Pressable key={g.id} accessibilityRole="radio" accessibilityState={{ selected: prefs.groupId === g.id }} onPress={() => setPrefs({ groupId: g.id })} style={{ borderWidth: 1, borderColor: prefs.groupId === g.id ? c.accent : c.borderStrong, paddingHorizontal: 10, minHeight: 40, justifyContent: "center" }}>
                  <T size="sm" mono style={{ color: prefs.groupId === g.id ? c.accent : c.text }}>{g.code}</T>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: tx.row, gap: 8, alignItems: "center" }}>
              <Btn title={tx.rtl ? "→" : "←"} accessibilityLabel={t("timetable.prev")} onPress={() => setOffset(offset - 1)} />
              <View style={{ flex: 1 }}>
                <T bold style={{ textAlign: "center" }}>{formatDate(prefs.locale, date, { weekday: "long", day: "numeric", month: "short" })}</T>
              </View>
              <Btn title={tx.rtl ? "←" : "→"} accessibilityLabel={t("timetable.next")} onPress={() => setOffset(offset + 1)} />
            </View>
            {offset !== 0 ? <Btn title={t("timetable.today")} onPress={() => setOffset(0)} /> : null}
            <T muted size="xs">{t("timetable.timezone", { tz: s.timezone })}</T>
            {!prefs.groupId ? <T muted>{t("home.pickGroup")}</T> : list.length === 0 ? <T muted>{isWeekend(date, s.weekendDays) ? t("timetable.weekend") : t("timetable.noClasses")}</T> : list.map((o) => <OccurrenceCard key={o.entryId} bundle={b} occ={o} />)}
            {prefs.groupId ? <T muted size="xs">{lt(b.groups.find((g) => g.id === prefs.groupId)?.name, prefs.locale)}</T> : null}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
