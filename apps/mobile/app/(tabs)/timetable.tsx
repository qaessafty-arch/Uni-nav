import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { addDays, isWeekend, lt, occurrencesOn, zonedNow } from "@campusnav/core";
import { formatDate } from "@campusnav/i18n";
import { StudentOnly } from "@/StudentGate";
import { Gate } from "@/Gate";
import { OccurrenceCard } from "@/OccurrenceCard";
import { MajorYear } from "@/MajorYear";
import { useApp } from "@/store";
import { Btn, Label, T, c, useText } from "@/ui";

export default function TimetableScreen() {
  const { t, prefs, setPrefs } = useApp();
  const tx = useText();
  const [offset, setOffset] = useState(0);
  return (
    <Gate>
      {(b) => <StudentOnly>{(() => {
        const s = b.university.settings;
        const today = zonedNow(new Date(), s.timezone).date;
        const date = addDays(today, offset);
        const list = prefs.groupId ? occurrencesOn(date, b.timetable, b.scheduleChanges, { groupId: prefs.groupId }) : [];
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
            <MajorYear bundle={b} />
            <View style={{ flexDirection: tx.row, gap: 8, alignItems: "center" }}>
              <Btn title={t("timetable.prev")} accessibilityLabel={t("timetable.prev")} onPress={() => setOffset(offset - 1)} />
              <View style={{ flex: 1 }}>
                <T bold style={{ textAlign: "center" }}>{formatDate(prefs.locale, date, { weekday: "long", day: "numeric", month: "short" })}</T>
              </View>
              <Btn title={t("timetable.next")} accessibilityLabel={t("timetable.next")} onPress={() => setOffset(offset + 1)} />
            </View>
            {offset !== 0 ? <Btn title={t("timetable.today")} onPress={() => setOffset(0)} /> : null}
            <T muted size="xs">{t("timetable.timezone", { tz: s.timezone })}</T>
            {!prefs.groupId ? <T muted>{t("home.pickGroup")}</T> : list.length === 0 ? <T muted>{isWeekend(date, s.weekendDays) ? t("timetable.weekend") : t("timetable.noClasses")}</T> : list.map((o) => <OccurrenceCard key={o.entryId} bundle={b} occ={o} />)}
            {prefs.groupId ? <T muted size="xs">{lt(b.groups.find((g) => g.id === prefs.groupId)?.name, prefs.locale)}</T> : null}
          </ScrollView>
        );
      })()}</StudentOnly>}
    </Gate>
  );
}
