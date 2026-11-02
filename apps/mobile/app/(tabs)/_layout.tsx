import { Tabs } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "@campusnav/tokens";
import { useApp } from "@/store";
import { useLook } from "@/ui";

const ICONS: Record<string, string> = {
  index: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  scan: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h2v2h-2zM19 19h1v1h-1z",
  lecturers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  timetable: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4",
};

export default function TabsLayout() {
  const { t } = useApp();
  const look = useLook();
  const c = colors.dark;
  const icon = (name: string) =>
    function TabIcon({ color }: { color: unknown }) {
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={String(color ?? c.textMuted)} strokeWidth={1.8}>
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
      <Tabs.Screen name="map" options={{ title: t("nav.map"), tabBarIcon: icon("map") }} />
      <Tabs.Screen name="scan" options={{ title: t("nav.scan"), tabBarIcon: icon("scan") }} />
      <Tabs.Screen name="lecturers" options={{ title: t("nav.lecturers"), tabBarIcon: icon("lecturers") }} />
      <Tabs.Screen name="timetable" options={{ title: t("nav.timetable"), tabBarIcon: icon("timetable") }} />
    </Tabs>
  );
}
