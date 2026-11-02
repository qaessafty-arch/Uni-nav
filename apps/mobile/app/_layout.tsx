import "react-native-url-polyfill/auto";
// Import single weights so unused font files are not bundled.
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { NotoSansArabic_400Regular } from "@expo-google-fonts/noto-sans-arabic/400Regular";
import { NotoSansArabic_700Bold } from "@expo-google-fonts/noto-sans-arabic/700Bold";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@campusnav/tokens";
import { AppProvider, useApp } from "@/store";
import { scheduleLectureReminders } from "@/notifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Reminders() {
  const { prefs, bundleState } = useApp();
  useEffect(() => {
    if (!prefs.reminders || !prefs.groupId || bundleState.status !== "ready") return;
    scheduleLectureReminders(bundleState.bundle, prefs.groupId, prefs.locale).catch(() => {});
  }, [prefs.reminders, prefs.groupId, prefs.locale, bundleState]);
  // Tapping a reminder opens navigation to the lecture room.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as never);
    });
    return () => sub.remove();
  }, []);
  return null;
}

function Root() {
  const { hydrated, t } = useApp();
  const [fontsLoaded] = useFonts({ IBMPlexMono_400Regular, InstrumentSerif_400Regular, NotoSansArabic_400Regular, NotoSansArabic_700Bold });
  useEffect(() => {
    if (hydrated && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated, fontsLoaded]);
  if (!hydrated || !fontsLoaded) return null;
  const c = colors.dark;
  return (
    <>
      <StatusBar style="light" />
      <Reminders />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          headerBackTitle: t("common.back"),
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="campus" options={{ title: t("campus.select") }} />
        <Stack.Screen name="room/[id]" options={{ title: t("common.room") }} />
        <Stack.Screen name="floor/[id]" options={{ title: t("common.floor") }} />
        <Stack.Screen name="building/[id]" options={{ title: t("common.building") }} />
        <Stack.Screen name="lecturer/[id]" options={{ title: t("lecturers.title") }} />
        <Stack.Screen name="navigate" options={{ title: t("navigate.title") }} />
        <Stack.Screen name="settings" options={{ title: t("settings.title") }} />
        <Stack.Screen name="q/[token]" options={{ title: t("map.checkpoint") }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
