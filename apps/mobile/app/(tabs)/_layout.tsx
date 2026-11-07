import { Tabs } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors, ICONS as SHARED } from "@campusnav/tokens";
import { useApp } from "@/store";
import { useLook } from "@/ui";

const ICONS: Record<string, string> = {
  index: SHARED.home,
  map: SHARED.building,
  scan: SHARED.scan,
  lecturers: SHARED.lecturers,
  timetable: SHARED.timetable,
};

export default function TabsLayout() {
  const { t } = useApp();
  const look = useLook();
  const c = colors.dark;
  const icon = (name: string) =>
    function TabIcon({ color }: { color: unknown }) {
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={String(color ?? c.textMuted)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d={ICONS[name]!} />
        </Svg>
      );
    };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerShadowVisible: false,
        headerTitleStyle: look.displayFont ? { fontFamily: look.displayFont, fontSize: 24 } : look.displayUppercase ? { fontWeight: "900", textTransform: "uppercase" } as never : undefined,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: look.strongBorders ? c.text : c.border, borderTopWidth: 1 },
        tabBarLabelStyle: look.buttonMono ? { fontFamily: "IBMPlexMono_400Regular", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" } : undefined,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home"), tabBarIcon: icon("index") }} />
      <Tabs.Screen name="map" options={{ title: t("nav.buildings"), tabBarIcon: icon("map") }} />
      <Tabs.Screen name="scan" options={{ title: t("nav.scan"), tabBarIcon: icon("scan") }} />
      <Tabs.Screen name="lecturers" options={{ title: t("nav.lecturers"), tabBarIcon: icon("lecturers") }} />
      <Tabs.Screen name="timetable" options={{ title: t("nav.timetable"), tabBarIcon: icon("timetable") }} />
    </Tabs>
  );
}
