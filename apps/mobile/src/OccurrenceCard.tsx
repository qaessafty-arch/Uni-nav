import { View } from "react-native";
import { lt, type CampusBundle, type Occurrence, type SearchResult } from "@campusnav/core";
import { formatClock } from "@campusnav/i18n";
import { useApp } from "./store";
import { Badge, Btn, T, c, styles, useText } from "./ui";

export function resultHref(r: SearchResult) {
  return r.type === "room" ? (`/room/${r.id}` as const) : r.type === "lecturer" ? (`/lecturer/${r.id}` as const) : r.type === "building" ? (`/building/${r.id}` as const) : ("/lecturers" as const);
}

export function OccurrenceCard({ bundle, occ, countdown }: { bundle: CampusBundle; occ: Occurrence; countdown?: string }) {
  const { t, prefs } = useApp();
  const tx = useText();
  const course = bundle.courses.find((x) => x.id === occ.courseId);
  const room = bundle.rooms.find((x) => x.id === occ.roomId);
  const building = room ? bundle.buildings.find((b) => b.id === room.buildingId) : undefined;
  const lecturer = bundle.lecturers.find((x) => x.id === occ.lecturerId);
  return (
    <View style={[styles.card, { gap: 6, opacity: occ.cancelled ? 0.6 : 1 }]}>
      <View style={{ flexDirection: tx.row, justifyContent: "space-between", gap: 8 }}>
        <T mono bold>{`${formatClock(prefs.locale, occ.startTime)}–${formatClock(prefs.locale, occ.endTime)}`}</T>
        {occ.cancelled ? <Badge tone="danger">{t("timetable.cancelled")}</Badge> : occ.changes.length ? <Badge tone="warn">{t("timetable.roomChanged", { room: bundle.rooms.find((r) => r.id === occ.original.roomId)?.code ?? "—" })}</Badge> : null}
      </View>
      <T bold>{lt(course?.name, prefs.locale)}</T>
      {room ? <T muted size="sm">{`${room.code} · ${lt(building?.name, prefs.locale)}`}</T> : null}
      {lecturer ? <T muted size="sm">{lt(lecturer.fullName, prefs.locale)}</T> : null}
      {countdown ? <T style={{ color: c.accent }} mono size="sm">{countdown}</T> : null}
      {room && !occ.cancelled ? <Btn variant="primary" title={t("common.navigate")} href={`/navigate?to=${room.id}`} /> : null}
    </View>
  );
}

