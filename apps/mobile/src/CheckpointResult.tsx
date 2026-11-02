import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { lt, type CheckpointResolution } from "@campusnav/core";
import { dataSource, useApp } from "./store";
import { Btn, Loading, Notice, T, c } from "./ui";

/** Validate a checkpoint token against the backend (never trusted locally) and set the start point. */
export function CheckpointResult({ token, then, onReset }: { token: string; then?: string; onReset?: () => void }) {
  const { t, prefs, setPrefs, setStart, universities } = useApp();
  const [res, setRes] = useState<CheckpointResolution | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRes(null);
    dataSource()
      .resolveCheckpoint(token, prefs.universityId ?? undefined)
      .then((r) => {
        if (cancelled) return;
        setRes(r);
        if (r.status === "ok") {
          if (!prefs.universityId) setPrefs({ universityId: r.checkpoint.universityId, onboarded: true });
          setStart({ nodeId: r.checkpoint.nodeId, label: lt(r.checkpoint.label, prefs.locale) });
        }
      })
      .catch(() => !cancelled && setRes({ status: "network_error" }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, prefs.universityId]);

  if (!res) return <Loading label={t("scan.resolving")} />;
  if (res.status === "ok") {
    const safeThen = then && /^\/[A-Za-z0-9]/.test(then) ? then : null;
    return (
      <View style={{ borderWidth: 1, borderColor: c.accent, padding: 16, gap: 12 }} accessibilityLiveRegion="polite">
        <T display size="xl">{t("scan.ok", { place: lt(res.checkpoint.label, prefs.locale) })}</T>
        {safeThen ? <Btn variant="primary" title={t("common.continue")} onPress={() => router.replace(safeThen as never)} /> : <Btn variant="primary" title={t("scan.navigateFromHere")} href="/" />}
        {onReset ? <Btn title={t("nav.scan")} onPress={onReset} /> : null}
      </View>
    );
  }
  if (res.status === "wrong_university") {
    const other = universities?.find((u) => u.id === res.universityId);
    return (
      <View style={{ gap: 12 }}>
        <Notice tone="warn">{t("scan.wrongUniversity")}</Notice>
        {other ? <Btn title={`${t("scan.switchUniversity")}: ${lt(other.name, prefs.locale)}`} onPress={() => setPrefs({ universityId: other.id, groupId: null })} /> : null}
      </View>
    );
  }
  const msg = { unknown: t("scan.unknown"), disabled: t("scan.disabled"), expired: t("scan.expired"), rate_limited: t("scan.rateLimited"), network_error: t("scan.network") }[res.status];
  return (
    <View style={{ gap: 12 }}>
      <Notice tone="danger">{msg}</Notice>
      {onReset ? <Btn title={t("common.retry")} onPress={onReset} /> : null}
    </View>
  );
}
