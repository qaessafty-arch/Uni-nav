import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { lt, openStatus, outdoorMeters, planRoute, routeOptionsFor, ROUTE_PREFERENCES, startCandidates, type CampusBundle, type NavNode, type RoutePreference } from "@campusnav/core";
import { describeStep, formatDistance, formatDuration } from "@campusnav/i18n";
import { NativeFloorMap } from "@/FloorMap";
import { Gate } from "@/Gate";
import { Icon, OpenStatusLine } from "@/campus";
import { useApp } from "@/store";
import { Badge, Btn, Label, Notice, Row, T, c, useText } from "@/ui";

function nodeName(b: CampusBundle, n: NavNode, loc: Parameters<typeof lt>[1]) {
  const room = b.rooms.find((r) => r.entranceNodeId === n.id);
  return room ? `${room.code} · ${lt(room.name, loc)}` : lt(n.label, loc) || lt(b.floors.find((f) => f.id === n.floorId)?.name, loc);
}

const PREF_KEY: Record<RoutePreference, "navigate.prefShortest" | "navigate.prefFewerStairs" | "navigate.prefStepFree" | "navigate.prefIndoor"> = {
  shortest: "navigate.prefShortest",
  fewer_stairs: "navigate.prefFewerStairs",
  step_free: "navigate.prefStepFree",
  indoor_first: "navigate.prefIndoor",
};

function PrefPicker({ value, onChange }: { value: RoutePreference; onChange: (p: RoutePreference) => void }) {
  const { t } = useApp();
  const tx = useText();
  return (
    <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={t("navigate.preference")}>
      <T muted size="xs">{t("navigate.preference")}</T>
      <View style={{ flexDirection: tx.row, flexWrap: "wrap", gap: 6 }}>
        {ROUTE_PREFERENCES.map((p) => (
          <Pressable key={p} onPress={() => onChange(p)} accessibilityRole="radio" accessibilityState={{ checked: value === p }} style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: value === p ? c.accent : c.border, backgroundColor: value === p ? c.accentSoft : "transparent" }}>
            <T size="sm">{t(PREF_KEY[p])}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StartPicker({ b, onPick, to }: { b: CampusBundle; onPick: (id: string) => void; to: string }) {
  const { t, prefs } = useApp();
  const list = useMemo(() => startCandidates(b).filter((n) => n.kind !== "room_entrance" || true), [b]);
  return (
    <View style={{ gap: 8 }}>
      <T display size="xl">{t("navigate.chooseStart")}</T>
      <T muted size="sm">{t("navigate.chooseStartHint")}</T>
      <Btn variant="primary" title={t("navigate.scanToStart")} href={`/scan?then=${encodeURIComponent(`/navigate?to=${to}`)}`} />
      <Label>{t("navigate.pickStart")}</Label>
      {list.map((n) => (
        <Row key={n.id} title={nodeName(b, n, prefs.locale)} subtitle={`${b.buildings.find((x) => x.id === b.floors.find((f) => f.id === n.floorId)?.buildingId)?.code ?? ""} · ${lt(b.floors.find((f) => f.id === n.floorId)?.name, prefs.locale)}`} onPress={() => onPick(n.id)} />
      ))}
    </View>
  );
}

export default function NavigateScreen() {
  const { to } = useLocalSearchParams<{ to: string }>();
  const { t, prefs, start, setStart } = useApp();
  const tx = useText();
  const [pref, setPref] = useState<RoutePreference>(prefs.accessible ? "step_free" : "shortest");
  const accessible = pref === "step_free";
  const [stepIdx, setStepIdx] = useState(0);
  const [arrived, setArrived] = useState(false);
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        // Destination: a room, or any map point as "node:<id>" (building entrances, shared locations).
        const nodeTarget = to?.startsWith("node:") ? b.navNodes.find((n) => n.id === to.slice(5)) : undefined;
        const room = nodeTarget ? b.rooms.find((r) => r.entranceNodeId === nodeTarget.id) : b.rooms.find((r) => r.id === to);
        const destId = nodeTarget?.id ?? room?.entranceNodeId ?? null;
        if (!room && !nodeTarget) return <Notice tone="danger">{t("navigate.unknownDestination")}</Notice>;
        if (!destId) return <Notice tone="warn">{t("navigate.noEntrance")}</Notice>;
        const destTitle = room ? `${room.code} · ${lt(room.name, loc)}` : nodeName(b, nodeTarget!, loc);
        const destNodeObj = b.navNodes.find((n) => n.id === destId);
        const destBuilding = b.buildings.find((x) => x.id === b.floors.find((f) => f.id === destNodeObj?.floorId)?.buildingId);
        const destOpen = destBuilding ? openStatus(destBuilding.hours, new Date(), b.university.settings.timezone) : null;
        const header = (
          <View style={{ marginBottom: 8 }}>
            <T muted size="sm">{t("navigate.to")}</T>
            <T display size="2xl">{destTitle}</T>
          </View>
        );
        if (!start) {
          return (
            <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
              {header}
              <StartPicker b={b} to={to ?? ""} onPick={(nodeId) => setStart({ nodeId })} />
            </ScrollView>
          );
        }
        const res = planRoute(b, start.nodeId, destId, routeOptionsFor(pref));
        if (!res.ok) {
          return (
            <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {header}
              <Notice tone="danger">{res.error.code === "UNREACHABLE" ? (accessible ? t("navigate.unreachableAccessible") : t("navigate.unreachable")) : t("navigate.unknownStart")}</Notice>
              <PrefPicker value={pref} onChange={setPref} />
              <Btn title={t("navigate.changeStart")} onPress={() => setStart(null)} />
            </ScrollView>
          );
        }
        const { plan } = res;
        const floors = new Map(b.floors.map((f) => [f.id, f]));
        const step = plan.steps[Math.min(stepIdx, plan.steps.length - 1)]!;
        const viewFloorId = step.toFloorId && step.kind !== "start" ? step.toFloorId : step.floorId;
        const viewFloor = floors.get(viewFloorId)!;
        const segs: NavNode[][] = [];
        let cur: NavNode[] = [];
        for (const n of plan.route.nodes) {
          if (n.floorId === viewFloorId) cur.push(n);
          else if (cur.length) {
            segs.push(cur);
            cur = [];
          }
        }
        if (cur.length) segs.push(cur);
        const startNode = b.navNodes.find((n) => n.id === start.nodeId);
        const dest = destNodeObj;
        const outM = outdoorMeters(plan.route.legs);

        if (arrived)
          return (
            <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: "center", gap: 12 }} accessibilityLiveRegion="polite">
              <View style={{ alignSelf: "center", width: 72, height: 72, borderRadius: 36, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={40} color={c.accentText} />
              </View>
              <T display size="3xl" style={{ textAlign: "center" }}>{t("navigate.arrived")}</T>
              <T muted style={{ textAlign: "center" }}>{t("navigate.arrivedAt", { place: destTitle })}</T>
              <Btn variant="primary" title={t("nav.home")} href="/" />
            </View>
          );

        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
            {header}
            <View style={{ flexDirection: tx.row, gap: 12 }}>
              <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, padding: 12 }}>
                <T muted size="xs">{t("navigate.distance")}</T>
                <T bold mono size="xl">{formatDistance(loc, plan.route.distanceM)}</T>
              </View>
              <View style={{ flex: 1, borderWidth: 1, borderColor: c.border, padding: 12 }}>
                <View style={{ flexDirection: tx.row, gap: 6, alignItems: "center" }}>
                  <T muted size="xs">{t("navigate.time")}</T>
                  <Badge>{t("data.estimate")}</Badge>
                </View>
                <T bold mono size="xl">{`≈ ${formatDuration(loc, plan.estimate.seconds)}`}</T>
              </View>
            </View>
            {outM > 0 ? (
              <View style={{ flexDirection: tx.row, alignItems: "center", gap: 6 }}>
                <Icon name="sun" size={16} color={c.textMuted} />
                <T muted size="sm">{t("navigate.outdoor", { distance: formatDistance(loc, outM) })}</T>
              </View>
            ) : null}
            {destBuilding && destOpen && !destOpen.open ? (
              <View style={{ borderStartWidth: 4, borderStartColor: c.warning, paddingStart: 10, gap: 2 }} accessibilityRole="alert">
                <T bold size="sm">{t("navigate.destClosed", { building: lt(destBuilding.name, loc) })}</T>
                <OpenStatusLine hours={destBuilding.hours} timeZone={b.university.settings.timezone} />
              </View>
            ) : null}
            <PrefPicker value={pref} onChange={(p) => { setPref(p); setStepIdx(0); }} />
            <T muted size="sm">{`${b.buildings.find((x) => x.id === viewFloor.buildingId)?.code ?? ""} · ${lt(viewFloor.name, loc)}`}</T>
            <NativeFloorMap floor={viewFloor} elements={b.mapElements.filter((e) => e.floorId === viewFloor.id)} rooms={b.rooms.filter((r) => r.floorId === viewFloor.id)} locale={loc} selectedRoomId={room && room.floorId === viewFloor.id ? room.id : null} route={segs} start={startNode?.floorId === viewFloor.id ? startNode : null} destination={dest?.floorId === viewFloor.id ? dest : null} labels={{ zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), reset: t("map.reset") }} />
            <Label>{t("navigate.steps")}</Label>
            {plan.steps.map((s, i) => (
              <Pressable key={i} onPress={() => setStepIdx(i)} accessibilityRole="button" accessibilityState={{ selected: i === stepIdx }} style={{ flexDirection: tx.row, gap: 10, padding: 10, minHeight: 44, backgroundColor: i === stepIdx ? c.accentSoft : "transparent", borderBottomWidth: 1, borderBottomColor: c.border }}>
                <T mono muted size="xs">{String(i + 1).padStart(2, "0")}</T>
                <T style={{ flex: 1 }} size="sm">{describeStep(loc, s, floors, dest?.label)}</T>
              </Pressable>
            ))}
            <View style={{ flexDirection: tx.row, gap: 8 }}>
              <View style={{ flex: 1 }}>
                {stepIdx < plan.steps.length - 1 ? <Btn variant="primary" title={t("navigate.next")} onPress={() => setStepIdx(stepIdx + 1)} /> : <Btn variant="primary" title={t("navigate.markArrived")} onPress={() => setArrived(true)} />}
              </View>
              <Btn title={t("navigate.changeStart")} onPress={() => setStart(null)} />
            </View>
            <T muted size="xs">{t("navigate.timeNote", { speed: plan.estimate.assumptions.speedMps })}</T>
          </ScrollView>
        );
      }}
    </Gate>
  );
}
