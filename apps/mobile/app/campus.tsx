import { router } from "expo-router";
import { ScrollView } from "react-native";
import { lt } from "@campusnav/core";
import { useApp } from "@/store";
import { Loading, Row, T, c } from "@/ui";

export default function CampusScreen() {
  const { t, universities, prefs, setPrefs, setStart } = useApp();
  if (!universities) return <Loading label={t("common.loading")} />;
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <T muted>{t("campus.selectHint")}</T>
      {universities.length === 0 ? <T muted>{t("campus.none")}</T> : null}
      {universities.map((u) => (
        <Row
          key={u.id}
          title={lt(u.name, prefs.locale)}
          subtitle={u.branding.productName ?? u.shortName}
          meta={u.dataStatus === "demo" ? t("data.demo") : u.dataStatus === "verified" ? t("data.verified") : t("data.unverified")}
          onPress={() => {
            if (u.id !== prefs.universityId) {
              setPrefs({ universityId: u.id, groupId: null, onboarded: true });
              setStart(null);
            }
            router.replace("/");
          }}
        />
      ))}
    </ScrollView>
  );
}
