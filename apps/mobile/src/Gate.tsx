import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import type { CampusBundle, SearchIndex } from "@campusnav/core";
import { formatInstant } from "@campusnav/i18n";
import { useApp } from "./store";
import { applyBranding } from "./campus";
import { Btn, Loading, Notice, Screen, T } from "./ui";

export function Gate({ children }: { children: (b: CampusBundle, index: SearchIndex) => ReactNode }) {
  const { hydrated, prefs, bundleState, t, reload } = useApp();
  if (!hydrated) return <Loading label={t("common.loading")} />;
  if (!prefs.onboarded) return <Redirect href="/onboarding" />;
  if (!prefs.universityId) return <Redirect href="/campus" />;
  if (bundleState.status !== "ready" && bundleState.status !== "error") return <Loading label={t("common.loading")} />;
  if (bundleState.status === "error")
    return (
      <Screen>
        <Notice tone="danger">{t("offline.noData")}</Notice>
        <T muted size="sm">{bundleState.error}</T>
        <View style={{ height: 12 }} />
        <Btn title={t("common.retry")} onPress={reload} />
      </Screen>
    );
  applyBranding(bundleState.bundle);
  return <>{children(bundleState.bundle, bundleState.index)}</>;
}

/** Banners for demo data and offline/cached data. */
export function DataBanners() {
  const { bundleState, t, prefs, online } = useApp();
  if (bundleState.status !== "ready") return null;
  const b = bundleState.bundle;
  return (
    <View>
      {b.university.dataStatus === "demo" ? <Notice tone="warn">{`${t("data.demo")} — ${t("data.demoLong")}`}</Notice> : null}
      {bundleState.origin === "cache" || !online ? <Notice>{t("offline.body", { date: formatInstant(prefs.locale, bundleState.cachedAt, b.university.settings.timezone) })}</Notice> : null}
    </View>
  );
}
