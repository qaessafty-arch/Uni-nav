import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { currentAndNext, featureOn, lt, relevantClosures, search, type CampusBundle, type Occurrence, type SearchResult } from "@campusnav/core";
import { formatClock, formatCountdownText } from "@campusnav/i18n";
import { DataBanners, Gate } from "@/Gate";
import { OccurrenceCard, resultHref } from "@/OccurrenceCard";
import { BuildingMark, Icon, LeaveBy, OpenStatusLine, PrayerCard } from "@/campus";
import { useApp } from "@/store";
import { Badge, Btn, Input, Label, Notice, Row, T, c, useCard, useText } from "@/ui";

function Home({ bundle, index }: { bundle: CampusBundle; index: Parameters<typeof search>[0] }) {
  const { t, prefs, saved } = useApp();
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim() ? search(index, q, { limit: 10 }) : []), [index, q]);
  const cn = prefs.groupId ? currentAndNext(new Date(), bundle.university.settings.timezone, bundle.timetable, bundle.scheduleChanges, { groupId: prefs.groupId }) : null;
  const loc = prefs.locale;
  const card = useCard();
  const tx = useText();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <DataBanners />
      <T display size="4xl">{lt(bundle.university.name, loc)}</T>
      <T muted>{t("splash.tagline")}</T>
      <Input value={q} onChangeText={setQ} placeholder={t("home.searchPlaceholder")} accessibilityLabel={t("common.search")} returnKeyType="search" maxLength={120} />
      {q.trim() ? (
        <View>
          {results.length === 0 ? <T muted>{t("search.noResults", { q })}</T> : null}
          {results.map((r) => {
            const title = r.type === "room" ? `${r.item.code} · ${lt(r.item.name, loc)}` : r.type === "lecturer" ? lt(r.item.fullName, loc) : r.type === "course" ? `${r.item.code} · ${lt(r.item.name, loc)}` : lt(r.item.name, loc);
            return <Row key={`${r.type}${r.id}`} title={title} meta={t(`search.type.${r.type}`)} href={resultHref(r)} />;
          })}
        </View>
      ) : (
        <>
          {featureOn(bundle.university.settings, "closures") && relevantClosures(bundle, new Date()).active.length ? (
            <Notice tone="warn">{`${t("home.closures")}: ${lt(relevantClosures(bundle, new Date()).active[0]!.reason, loc)}`}</Notice>
          ) : null}
          <PrayerCard bundle={bundle} />
          <Label>{cn?.current ? t("home.currentLecture") : t("home.nextLecture")}</Label>
          {!prefs.groupId ? (
            <View style={card}>
              <T>{t("home.pickGroup")}</T>
              <Link href="/timetable" asChild>
                <Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }}>
                  <T style={{ color: c.accent }}>{t("timetable.chooseGroup")}</T>
                </Pressable>
              </Link>
            </View>
          ) : cn?.current || cn?.next ? (
            <View style={{ gap: 8 }}>
              {cn.current ? <OccurrenceCard bundle={bundle} occ={cn.current} countdown={cn.secondsUntilCurrentEnds != null ? t("home.endsIn", { time: formatCountdownText(loc, cn.secondsUntilCurrentEnds) }) : undefined} /> : null}
              {cn.next ? <OccurrenceCard bundle={bundle} occ={cn.next} countdown={cn.secondsUntilNext != null ? t("home.startsIn", { time: formatCountdownText(loc, cn.secondsUntilNext) }) : undefined} /> : null}
              {!cn.current && cn.next ? <LeaveBy bundle={bundle} occ={cn.next} /> : null}
            </View>
          ) : (
            <T muted>{t("home.noLectures")}</T>
          )}
          {featureOn(bundle.university.settings, "freeRooms") ? <Btn title={t("free.homeLink")} href="/free-rooms" /> : null}
          <Label>{t("nav.buildings")}</Label>
          {bundle.buildings.map((x) => (
            <Pressable key={x.id} onPress={() => router.push(`/building/${x.id}`)} accessibilityRole="link" accessibilityLabel={lt(x.name, loc)} style={{ flexDirection: tx.row, alignItems: "center", gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <BuildingMark b={x} size={34} />
                <View style={{ flex: 1 }}>
                  <T size="sm" bold numberOfLines={1}>{lt(x.name, loc)}</T>
                  <OpenStatusLine hours={x.hours} timeZone={bundle.university.settings.timezone} />
                </View>
                <Icon name="arrow" size={18} color={c.textMuted} />
              </Pressable>
          ))}
          <Label>{t("home.savedPlaces")}</Label>
          {saved.length === 0 ? <T muted size="sm">{t("home.noSaved")}</T> : saved.map((id) => bundle.rooms.find((r) => r.id === id)).filter(Boolean).map((r) => <Row key={r!.id} title={`${r!.code} · ${lt(r!.name, loc)}`} href={`/room/${r!.id}`} />)}
          <Label>{t("home.announcements")}</Label>
          {bundle.announcements.filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > Date.now()).slice(0, 3).map((a) => (
            <View key={a.id} style={{ marginBottom: 8 }}>
              <T bold size="sm">{lt(a.title, loc)}</T>
              <T muted size="sm">{lt(a.body, loc)}</T>
            </View>
          ))}
          <Btn title={t("nav.settings")} href="/settings" />
        </>
      )}
    </ScrollView>
  );
}

export default function HomeScreen() {
  return <Gate>{(b, i) => <Home bundle={b} index={i} />}</Gate>;
}
