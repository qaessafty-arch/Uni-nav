import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { featureOn, lt, openStatus } from "@campusnav/core";
import { DataBanners, Gate } from "@/Gate";
import { BuildingMark, Icon, OpenStatusLine } from "@/campus";
import { useApp } from "@/store";
import { Label, T, c, useCard, useText } from "@/ui";

/** Buildings directory: logo/icon, opening hours, open-now filter. */
export default function BuildingsScreen() {
  const { t, prefs } = useApp();
  const tx = useText();
  const card = useCard();
  const [openOnly, setOpenOnly] = useState(false);
  return (
    <Gate>
      {(b) => {
        const tz = b.university.settings.timezone;
        const now = new Date();
        const list = b.buildings
          .filter((x) => !openOnly || openStatus(x.hours, now, tz)?.open)
          .sort((x, y) => lt(x.name, prefs.locale).localeCompare(lt(y.name, prefs.locale)));
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            <DataBanners />
            {featureOn(b.university.settings, "buildingDirectory") ? <T muted size="sm">{t("buildings.subtitle")}</T> : null}
            <Pressable onPress={() => setOpenOnly((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: openOnly }} style={{ flexDirection: tx.row, alignItems: "center", gap: 8, alignSelf: tx.rtl ? "flex-end" : "flex-start", minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: openOnly ? c.accent : c.border, backgroundColor: openOnly ? c.accentSoft : "transparent" }}>
              <Icon name="clock" size={18} color={openOnly ? c.accent : c.textMuted} />
              <T size="sm">{t("buildings.openNow")}</T>
            </Pressable>
            <Label>{t("buildings.title")}</Label>
            {list.length === 0 ? <T muted>{t("buildings.none")}</T> : null}
            {list.map((x) => {
              const floors = b.floors.filter((f) => f.buildingId === x.id).length;
              const rooms = b.rooms.filter((r) => r.buildingId === x.id).length;
              return (
                <Pressable key={x.id} onPress={() => router.push(`/building/${x.id}`)} accessibilityRole="link" accessibilityLabel={lt(x.name, prefs.locale)}>
                  {({ pressed }) => (
                    <View style={[card, { flexDirection: tx.row, gap: 12, alignItems: "center", opacity: pressed ? 0.7 : 1 }]}>
                      <BuildingMark b={x} size={48} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T muted mono size="xs">{x.code}</T>
                        <T bold>{lt(x.name, prefs.locale)}</T>
                        <T muted size="xs">{`${floors === 1 ? t("explore.floorOne") : t("explore.floorsCount", { n: floors })} · ${t("explore.roomsCount", { n: rooms })}`}</T>
                        <OpenStatusLine hours={x.hours} timeZone={tz} />
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
