import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { lt } from "@campusnav/core";
import { Gate } from "@/Gate";
import { useApp } from "@/store";
import { Label, Notice, Row, T, c } from "@/ui";

export default function BuildingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, prefs } = useApp();
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        const building = b.buildings.find((x) => x.id === id);
        if (!building) return <Notice tone="danger">{t("error.notFound")}</Notice>;
        const floors = b.floors.filter((f) => f.buildingId === building.id).sort((x, y) => y.level - x.level);
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            <T muted mono>{building.code}</T>
            <T display size="3xl">{lt(building.name, loc)}</T>
            {building.description ? <T muted>{lt(building.description, loc)}</T> : null}
            <Label>{t("map.floors")}</Label>
            {floors.length === 0 ? <T muted>{t("map.noFloors")}</T> : floors.map((f) => <Row key={f.id} title={lt(f.name, loc)} meta={String(b.rooms.filter((r) => r.floorId === f.id).length)} href={`/floor/${f.id}`} />)}
            <Label>{t("building.rooms")}</Label>
            {b.rooms
              .filter((r) => r.buildingId === building.id)
              .sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))
              .map((r) => <Row key={r.id} title={`${r.code} · ${lt(r.name, loc)}`} meta={t(`roomType.${r.type}`)} href={`/room/${r.id}`} />)}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
