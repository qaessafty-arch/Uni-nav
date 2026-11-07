import { useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { lt, occurrencesOn, zonedNow } from "@campusnav/core";
import { NativeFloorMap } from "@/FloorMap";
import { Gate } from "@/Gate";
import { OccurrenceCard } from "@/OccurrenceCard";
import { useApp } from "@/store";
import { Badge, Btn, Label, Notice, T, c, useText } from "@/ui";

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, prefs, saved, toggleSaved } = useApp();
  const tx = useText();
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        const room = b.rooms.find((r) => r.id === id);
        if (!room) return <Notice tone="danger">{t("error.notFound")}</Notice>;
        const floor = b.floors.find((f) => f.id === room.floorId)!;
        const building = b.buildings.find((x) => x.id === room.buildingId);
        const today = zonedNow(new Date(), b.university.settings.timezone).date;
        const lectures = occurrencesOn(today, b.timetable, b.scheduleChanges, { roomId: room.id });
        const entrance = b.navNodes.find((n) => n.id === room.entranceNodeId) ?? null;
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            <T muted size="sm">{`${building?.code ?? ""} · ${lt(floor.name, loc)}`}</T>
            <T size="4xl" bold mono style={{ fontSize: 64, lineHeight: 68 }}>{room.code}</T>
            <T size="lg">{lt(room.name, loc)}</T>
            <View style={{ flexDirection: tx.row, gap: 6, flexWrap: "wrap" }}>
              <Badge>{t(`roomType.${room.type}`)}</Badge>
              {room.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : null}
              {room.accessible ? <Badge tone="accent">{t("room.accessible")}</Badge> : null}
            </View>
            {room.entranceNodeId ? <Btn variant="primary" title={t("common.navigate")} href={`/navigate?to=${room.id}`} /> : <Notice tone="warn">{t("room.noEntrance")}</Notice>}
            <Btn title={saved.includes(room.id) ? t("common.saved_location") : t("common.save_location")} onPress={() => toggleSaved(room.id)} />
            <NativeFloorMap floor={floor} elements={b.mapElements.filter((e) => e.floorId === floor.id)} rooms={b.rooms.filter((r) => r.floorId === floor.id)} locale={loc} selectedRoomId={room.id} destination={entrance} labels={{ zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), reset: t("map.reset") }} />
            <Btn title={t("common.viewOnMap")} href={`/floor/${floor.id}?room=${room.id}`} />
            <Label>{t("room.lecturesToday")}</Label>
            {lectures.length ? lectures.map((o) => <OccurrenceCard key={o.entryId} bundle={b} occ={o} />) : <T muted size="sm">{t("timetable.noClasses")}</T>}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
