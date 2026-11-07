import { NullTechMark } from "@/NullTechMark";
import { router } from "expo-router";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { LOCALES, lt } from "@campusnav/core";
import { visualStyleLabels } from "@campusnav/tokens";
import { formatInstant } from "@campusnav/i18n";
import { clearCachedBundle } from "@campusnav/data";
import { requestPermission } from "@/notifications";
import { kv, useApp } from "@/store";
import { Btn, Label, Notice, StylePicker, T, c, useText } from "@/ui";

export default function SettingsScreen() {
  const { t, prefs, setPrefs, universities, bundleState, reload } = useApp();
  const tx = useText();
  const uni = universities?.find((u) => u.id === prefs.universityId);
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Label>{t("settings.language")}</Label>
      {LOCALES.map((l) => (
        <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: prefs.locale === l }} onPress={() => setPrefs({ locale: l })} style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: c.border }}>
          <T style={{ color: prefs.locale === l ? c.accent : c.text }}>{t(`language.${l}`)}</T>
        </Pressable>
      ))}
      <Label>{t("settings.style")}</Label>
      <StylePicker value={prefs.style} onChange={(style) => setPrefs({ style })} labels={visualStyleLabels} />
      <Label>{t("campus.select")}</Label>
      <T>{uni ? lt(uni.name, prefs.locale) : "—"}</T>
      <Btn title={t("campus.change")} onPress={() => router.push("/campus")} />
      <Label>{t("navigate.title")}</Label>
      <View style={{ flexDirection: tx.row, justifyContent: "space-between", alignItems: "center", minHeight: 48 }}>
        <T style={{ flex: 1 }}>{t("settings.accessibleDefault")}</T>
        <Switch value={prefs.accessible} onValueChange={(v) => setPrefs({ accessible: v })} />
      </View>
      <Label>{t("notifications.title")}</Label>
      <View style={{ flexDirection: tx.row, justifyContent: "space-between", alignItems: "center", minHeight: 48 }}>
        <T style={{ flex: 1 }}>{t("notifications.enable")}</T>
        <Switch
          value={prefs.reminders}
          onValueChange={async (v) => {
            if (!v) return setPrefs({ reminders: false });
            const ok = await requestPermission();
            setPrefs({ reminders: ok });
          }}
        />
      </View>
      {!prefs.groupId ? <Notice>{t("home.pickGroup")}</Notice> : null}
      <Label>{t("settings.offline")}</Label>
      {bundleState.status === "ready" ? <T muted size="sm">{t("settings.offlineSaved", { date: formatInstant(prefs.locale, bundleState.cachedAt, bundleState.bundle.university.settings.timezone) })}</T> : null}
      <Btn title={t("settings.offlineRefresh")} onPress={reload} />
      <Btn variant="danger" title={t("settings.offlineClear")} onPress={() => prefs.universityId && void clearCachedBundle(kv, prefs.universityId)} />
      <T muted size="xs">{t("settings.privacy")}</T>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <NullTechMark size={14} />
        <T muted size="xs" mono>{`${t("brand.product")} · ${t("brand.studio")} · 0.1.0`}</T>
      </View>
    </ScrollView>
  );
}
