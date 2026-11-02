import { ScrollView } from "react-native";
import { lt } from "@campusnav/core";
import { DataBanners, Gate } from "@/Gate";
import { useApp } from "@/store";
import { Label, Notice, Row, c } from "@/ui";

export default function MapScreen() {
  const { t, prefs } = useApp();
  return (
    <Gate>
      {(b) => (
        <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
          <DataBanners />
          {b.university.dataStatus === "demo" ? <Notice tone="warn">{t("map.planDemo")}</Notice> : null}
          {b.campuses.map((campus) => (
            <ScrollView key={campus.id} scrollEnabled={false}>
              <Label>{lt(campus.name, prefs.locale)}</Label>
              {b.buildings
                .filter((x) => x.campusId === campus.id)
                .map((x) => (
                  <Row key={x.id} title={lt(x.name, prefs.locale)} subtitle={x.code} meta={t("building.floors", { n: b.floors.filter((f) => f.buildingId === x.id).length })} href={`/building/${x.id}`} />
                ))}
            </ScrollView>
          ))}
        </ScrollView>
      )}
    </Gate>
  );
}
