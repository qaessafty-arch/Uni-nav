import { useLocalSearchParams } from "expo-router";
import { Linking, ScrollView, View } from "react-native";
import { lt, type Weekday } from "@campusnav/core";
import { formatClock } from "@campusnav/i18n";
import { Gate } from "@/Gate";
import { useApp } from "@/store";
import { Badge, Btn, Label, Notice, T, c, useText } from "@/ui";

export default function LecturerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, prefs } = useApp();
  const tx = useText();
  return (
    <Gate>
      {(b) => {
        const loc = prefs.locale;
        const l = b.lecturers.find((x) => x.id === id);
        if (!l) return <Notice tone="danger">{t("error.notFound")}</Notice>;
        const office = b.rooms.find((r) => r.id === l.officeRoomId);
        const courses = [...new Set(b.timetable.filter((e) => e.lecturerId === l.id).map((e) => e.courseId))].map((cid) => b.courses.find((x) => x.id === cid)).filter(Boolean);
        return (
          <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            {l.title ? <T muted size="sm">{lt(l.title, loc)}</T> : null}
            <T display size="3xl">{lt(l.fullName, loc)}</T>
            <T muted>{lt(b.departments.find((d) => d.id === l.departmentId)?.name, loc)}</T>
            {l.dataStatus === "demo" ? <Badge tone="warn">{t("data.demo")}</Badge> : null}
            <Label>{t("lecturer.office")}</Label>
            {office ? (
              <View style={{ gap: 8 }}>
                <T mono bold size="lg">{office.code}</T>
                <Btn variant="primary" title={t("lecturer.navigateOffice")} href={`/navigate?to=${office.id}`} />
              </View>
            ) : (
              <T muted>{t("lecturer.noOffice")}</T>
            )}
            <Label>{t("lecturer.officeHours")}</Label>
            {l.officeHours.length ? (
              l.officeHours.map((h, i) => (
                <View key={i} style={{ flexDirection: tx.row, justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 8 }}>
                  <T>{t(`day.${h.day as Weekday}`)}</T>
                  <T mono>{`${formatClock(loc, h.start)}–${formatClock(loc, h.end)}`}</T>
                </View>
              ))
            ) : (
              <T muted>{t("lecturer.noOfficeHours")}</T>
            )}
            <Label>{t("lecturer.availability")}</Label>
            {l.availability ? <Badge tone="accent">{t(`lecturer.availability.${l.availability.status}`)}</Badge> : <T muted>{t("lecturer.availabilityUnknown")}</T>}
            <Label>{t("lecturer.courses")}</Label>
            {courses.map((co) => <T key={co!.id}>{`${co!.code} · ${lt(co!.name, loc)}`}</T>)}
            {l.publicEmail ? (
              <>
                <Label>{t("lecturer.contact")}</Label>
                <Btn title={l.publicEmail} onPress={() => void Linking.openURL(`mailto:${l.publicEmail}`)} />
              </>
            ) : null}
          </ScrollView>
        );
      }}
    </Gate>
  );
}
