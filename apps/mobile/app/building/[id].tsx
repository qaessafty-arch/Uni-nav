import { useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { lt } from "@campusnav/core";
import { Gate } from "@/Gate";
import { BuildingMark, HoursTable, OpenStatusLine } from "@/campus";
import { useApp } from "@/store";
import { Badge, Btn, Label, Notice, Row, T, c, useText } from "@/ui";

export default function BuildingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, prefs } = useApp();
  const tx = useText();
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        const building = b.buildings.find((x) => x.id === id);
        if (!building) return <Notice tone="danger">{t("error.notFound")}</Notice>;
        const floors = b.floors.filter((f) => f.buildingId === building.id).sort((x, y) => y.level - x.level);
        const entrance = b.navNodes.find((n) => n.kind === "building_entrance" && floors.some((f) => f.id === n.floorId));
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            <View style={{ flexDirection: tx.row, gap: 14, alignItems: "center" }}>
              <BuildingMark b={building} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <T muted mono>{building.code}</T>
                <T display size="2xl">{lt(building.name, loc)}</T>
              </View>
            </View>
            {building.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : null}
            <OpenStatusLine hours={building.hours} timeZone={b.university.settings.timezone} />
            {building.description ? <T muted>{lt(building.description, loc)}</T> : null}
            {entrance ? <Btn variant="primary" title={t("explore.toEntrance")} href={`/navigate?to=node:${entrance.id}`} /> : null}
            {building.hours && Object.keys(building.hours).length ? (
              <>
                <Label>{t("hours.title")}</Label>
                <HoursTable hours={building.hours} />
              </>
            ) : null}
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
