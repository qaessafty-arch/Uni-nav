import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { freeRoomsAt, lt } from "@campusnav/core";
import { formatClock, formatDuration } from "@campusnav/i18n";
import { Gate } from "@/Gate";
import { useApp } from "@/store";
import { Badge, Notice, Row, T, c, useText } from "@/ui";

/** Teaching rooms with no class right now, from the published timetable. */
export default function FreeRoomsScreen() {
  const { t, prefs } = useApp();
  const tx = useText();
  const [min, setMin] = useState(30);
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        if (!b.timetable.length) return <Notice>{t("free.noTimetable")}</Notice>;
        const free = freeRoomsAt(b, new Date(), { minMinutes: min });
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            <T display size="2xl">{t("free.title")}</T>
            <T muted size="sm">{t("free.subtitle")}</T>
            <View style={{ flexDirection: tx.row, alignItems: "center", gap: 6, flexWrap: "wrap" }} accessibilityRole="radiogroup" accessibilityLabel={t("free.minFree")}>
              <T muted size="sm">{t("free.minFree")}</T>
              {[30, 60, 120].map((m) => (
                <Pressable key={m} onPress={() => setMin(m)} accessibilityRole="radio" accessibilityState={{ checked: min === m }} style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: min === m ? c.accent : c.border, backgroundColor: min === m ? c.accentSoft : "transparent" }}>
                  <T size="sm">{formatDuration(loc, m * 60)}</T>
                </Pressable>
              ))}
            </View>
            <Notice>{t("free.caveat")}</Notice>
            {free.length === 0 ? <T muted>{t("free.none")}</T> : null}
            {free.map(({ room, freeUntil, freedByCancellation }) => (
              <View key={room.id}>
                <Row
                  title={`${room.code} · ${lt(room.name, loc)}`}
                  subtitle={`${freeUntil ? t("free.until", { time: formatClock(loc, freeUntil) }) : t("free.restOfDay")} · ${b.buildings.find((x) => x.id === room.buildingId)?.code ?? ""}`}
                  href={`/navigate?to=${room.id}`}
                />
                {freedByCancellation ? <Badge tone="warn">{t("free.cancelled")}</Badge> : null}
              </View>
            ))}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
