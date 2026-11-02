import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LOCALES } from "@campusnav/core";
import { useApp } from "@/store";
import { Btn, T, c, useText } from "@/ui";

export default function Onboarding() {
  const { t, prefs, setPrefs } = useApp();
  const tx = useText();
  const [step, setStep] = useState(0);
  const slides = [
    [t("onboarding.title1"), t("onboarding.body1")],
    [t("onboarding.title2"), t("onboarding.body2")],
    [t("onboarding.title3"), t("onboarding.body3")],
  ] as const;
  const finish = () => {
    setPrefs({ onboarded: true });
    router.replace(prefs.universityId ? "/" : "/campus");
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}>
      <View style={{ flexDirection: tx.row, justifyContent: "space-between", alignItems: "center" }}>
        <T mono bold>CAMPUS NAV</T>
        <Pressable onPress={finish} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
          <T muted>{t("onboarding.skip")}</T>
        </Pressable>
      </View>
      <View style={{ flexDirection: tx.row, gap: 6, marginTop: 24 }}>
        {LOCALES.map((l) => (
          <Pressable key={l} onPress={() => setPrefs({ locale: l })} accessibilityRole="radio" accessibilityState={{ selected: prefs.locale === l }} style={{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: prefs.locale === l ? c.accent : c.borderStrong, alignItems: "center", justifyContent: "center" }}>
            <T size="sm" style={{ textAlign: "center", color: prefs.locale === l ? c.accent : c.textMuted }}>{t(`language.${l}`)}</T>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <T muted mono size="xs">{`0${step + 1} / 03`}</T>
        <T display size="4xl">{slides[step]![0]}</T>
        <T muted size="lg">{slides[step]![1]}</T>
      </View>
      <View style={{ flexDirection: tx.row, gap: 6, marginBottom: 16 }}>
        {slides.map((_, i) => <View key={i} style={{ flex: 1, height: 3, backgroundColor: i <= step ? c.accent : c.border }} />)}
      </View>
      <Btn variant="primary" title={step < 2 ? t("common.continue") : t("onboarding.start")} onPress={() => (step < 2 ? setStep(step + 1) : finish())} />
    </SafeAreaView>
  );
}
