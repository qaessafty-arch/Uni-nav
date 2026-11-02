import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { lt } from "@campusnav/core";
import { NativeFloorMap } from "@/FloorMap";
import { Gate } from "@/Gate";
import { useApp } from "@/store";
import { Btn, Notice, T, c, useText } from "@/ui";

export default function FloorScreen() {
  const { id, room } = useLocalSearchParams<{ id: string; room?: string }>();
  const { t, prefs, start } = useApp();
  const tx = useText();
  const [selected, setSelected] = useState<string | null>(room ?? null);
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        const floor = b.floors.find((f) => f.id === id);
        if (!floor) return <Notice tone="danger">{t("error.notFound")}</Notice>;
        const siblings = b.floors.filter((f) => f.buildingId === floor.buildingId).sort((x, y) => y.level - x.level);
        const sel = selected ? b.rooms.find((r) => r.id === selected) : undefined;
        const startNode = start ? b.navNodes.find((n) => n.id === start.nodeId && n.floorId === floor.id) ?? null : null;
        const cps = b.checkpoints.map((cp) => b.navNodes.find((n) => n.id === cp.nodeId)).filter((n): n is NonNullable<typeof n> => !!n && n.floorId === floor.id);
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            <T bold size="xl">{lt(floor.name, loc)}</T>
            <View style={{ flexDirection: tx.row, gap: 4 }} accessibilityRole="tablist">
              {siblings.map((f) => (
                <Pressable key={f.id} accessibilityRole="tab" accessibilityState={{ selected: f.id === floor.id }} onPress={() => router.setParams({ id: f.id })} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: f.id === floor.id ? c.accent : c.borderStrong, backgroundColor: f.id === floor.id ? c.accent : c.surface }}>
                  <T mono style={{ color: f.id === floor.id ? c.accentText : c.text, textAlign: "center" }}>{f.level === 0 ? "G" : String(f.level)}</T>
                </Pressable>
              ))}
            </View>
            {b.university.dataStatus === "demo" ? <Notice tone="warn">{t("map.planDemo")}</Notice> : null}
            <NativeFloorMap floor={floor} elements={b.mapElements.filter((e) => e.floorId === floor.id)} rooms={b.rooms.filter((r) => r.floorId === floor.id)} locale={loc} selectedRoomId={selected} onRoomPress={setSelected} start={startNode} checkpoints={cps} height={440} labels={{ zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), reset: t("map.reset") }} />
            {sel ? (
              <View style={{ borderWidth: 1, borderColor: c.border, padding: 12, gap: 8 }}>
                <T bold mono>{sel.code}</T>
                <T muted>{lt(sel.name, loc)}</T>
                <Btn variant="primary" title={t("common.navigate")} href={`/navigate?to=${sel.id}`} />
                <Btn title={t("common.room")} href={`/room/${sel.id}`} />
              </View>
            ) : (
              <T muted size="sm">{t("map.selectRoom")}</T>
            )}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
