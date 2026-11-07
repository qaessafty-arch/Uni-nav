import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { freeRoomScope, freeRoomsAt, lt } from "@campusnav/core";
import { formatClock, formatDuration } from "@campusnav/i18n";
import { StudentOnly } from "@/StudentGate";
import { Gate } from "@/Gate";
import { MajorYear } from "@/MajorYear";
import { useApp } from "@/store";
import { Badge, Btn, Notice, Row, T, c, useText } from "@/ui";

/** Teaching rooms with no class right now, from the published timetable. */
export default function FreeRoomsScreen() {
  const { t, prefs, start } = useApp();
  const tx = useText();
  const [min, setMin] = useState(30);
  return (
    <Gate>
      {(b) => <StudentOnly>{(() => {
        const loc = prefs.locale;
        if (!(b.roomOccupancy?.entries.length ?? b.timetable.length)) return <Notice>{t("free.noTimetable")}</Notice>;
        const scope = freeRoomScope(b, prefs.groupId ?? b.groups[0]?.id, start?.nodeId);
        if (!scope.buildingIds.size)
          return (
            <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
              <T muted>{t("free.noScope")}</T>
              <MajorYear bundle={b} />
              <Btn variant="primary" title={t("navigate.scanToStart")} href="/scan" />
            </ScrollView>
          );
        const free = freeRoomsAt(b, new Date(), { minMinutes: min, buildingIds: scope.buildingIds });
        const scopeText = [
          ...scope.majorBuildingIds.map((id) => `${t("free.scopeMajor")}: ${lt(b.buildings.find((x) => x.id === id)?.name, loc)}`),
          ...(scope.hereBuildingId && !scope.majorBuildingIds.includes(scope.hereBuildingId) ? [`${t("free.scopeHere")}: ${lt(b.buildings.find((x) => x.id === scope.hereBuildingId)?.name, loc)}`] : []),
        ].join(" · ");
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
            <T size="sm">{scopeText}</T>
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
      })()}</StudentOnly>}
    </Gate>
  );
}
