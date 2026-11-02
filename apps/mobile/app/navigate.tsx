import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { lt, planRoute, startCandidates, type CampusBundle, type NavNode } from "@campusnav/core";
import { describeStep, formatDistance, formatDuration } from "@campusnav/i18n";
import { NativeFloorMap } from "@/FloorMap";
import { Gate } from "@/Gate";
import { useApp } from "@/store";
import { Badge, Btn, Label, Notice, Row, T, c, useText } from "@/ui";

function nodeName(b: CampusBundle, n: NavNode, loc: Parameters<typeof lt>[1]) {
  const room = b.rooms.find((r) => r.entranceNodeId === n.id);
  return room ? `${room.code} · ${lt(room.name, loc)}` : lt(n.label, loc) || lt(b.floors.find((f) => f.id === n.floorId)?.name, loc);
}

function StartPicker({ b, onPick, to }: { b: CampusBundle; onPick: (id: string) => void; to: string }) {
  const { t, prefs } = useApp();
  const list = useMemo(() => startCandidates(b).filter((n) => n.kind !== "room_entrance" || true), [b]);
  return (
    <View style={{ gap: 8 }}>
      <T bold size="lg">{t("navigate.chooseStart")}</T>
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
  const [accessible, setAccessible] = useState(prefs.accessible);
  const [stepIdx, setStepIdx] = useState(0);
  const [arrived, setArrived] = useState(false);
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        const room = b.rooms.find((r) => r.id === to);
        if (!room) return <Notice tone="danger">{t("navigate.unknownDestination")}</Notice>;
        if (!room.entranceNodeId) return <Notice tone="warn">{t("navigate.noEntrance")}</Notice>;
        const header = (
          <View style={{ marginBottom: 8 }}>
            <T muted size="sm">{t("navigate.to")}</T>
            <T bold size="xl">{`${room.code} · ${lt(room.name, loc)}`}</T>
          </View>
        );
        if (!start) {
          return (
            <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
              {header}
              <StartPicker b={b} to={room.id} onPick={(nodeId) => setStart({ nodeId })} />
            </ScrollView>
          );
        }
        const res = planRoute(b, start.nodeId, room.entranceNodeId, { accessibleOnly: accessible });
        if (!res.ok) {
          return (
            <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
              {header}
              <Notice tone="danger">{res.error.code === "UNREACHABLE" ? (accessible ? t("navigate.unreachableAccessible") : t("navigate.unreachable")) : t("navigate.unknownStart")}</Notice>
              <View style={{ flexDirection: tx.row, alignItems: "center", justifyContent: "space-between" }}>
                <T>{t("navigate.accessible")}</T>
                <Switch value={accessible} onValueChange={setAccessible} />
              </View>
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
        const dest = b.navNodes.find((n) => n.id === room.entranceNodeId);

        if (arrived)
          return (
            <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: "center", gap: 12 }} accessibilityLiveRegion="polite">
              <T size="3xl" bold style={{ textAlign: "center", color: c.accent }}>✓</T>
              <T size="2xl" bold style={{ textAlign: "center" }}>{t("navigate.arrived")}</T>
              <T muted style={{ textAlign: "center" }}>{t("navigate.arrivedAt", { place: `${room.code} · ${lt(room.name, loc)}` })}</T>
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
            <View style={{ flexDirection: tx.row, alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
              <T style={{ flex: 1 }}>{t("navigate.accessible")}</T>
              <Switch value={accessible} onValueChange={(v) => { setAccessible(v); setStepIdx(0); }} accessibilityLabel={t("navigate.accessible")} />
            </View>
            <T muted size="sm">{`${b.buildings.find((x) => x.id === viewFloor.buildingId)?.code ?? ""} · ${lt(viewFloor.name, loc)}`}</T>
            <NativeFloorMap floor={viewFloor} elements={b.mapElements.filter((e) => e.floorId === viewFloor.id)} rooms={b.rooms.filter((r) => r.floorId === viewFloor.id)} locale={loc} selectedRoomId={room.floorId === viewFloor.id ? room.id : null} route={segs} start={startNode?.floorId === viewFloor.id ? startNode : null} destination={dest?.floorId === viewFloor.id ? dest : null} labels={{ zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"), reset: t("map.reset") }} />
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
