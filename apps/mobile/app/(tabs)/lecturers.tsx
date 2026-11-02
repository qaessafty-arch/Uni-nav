import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { lt, search } from "@campusnav/core";
import { Gate } from "@/Gate";
import { useApp } from "@/store";
import { Input, Row, T, c } from "@/ui";

export default function LecturersScreen() {
  const { t, prefs } = useApp();
  const [q, setQ] = useState("");
  return (
    <Gate>
      {(b, index) => {
        const loc = prefs.locale;
        const ids = q.trim() ? new Set(search(index, q, { limit: 200, types: ["lecturer"] }).map((r) => r.id)) : null;
        const list = b.lecturers.filter((l) => !ids || ids.has(l.id)).sort((x, y) => lt(x.fullName, loc).localeCompare(lt(y.fullName, loc), loc));
        return (
          <View style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}>
            <Input value={q} onChangeText={setQ} placeholder={t("lecturers.search")} accessibilityLabel={t("lecturers.search")} />
            <FlatList
              data={list}
              keyExtractor={(x) => x.id}
              ListEmptyComponent={<T muted style={{ marginTop: 16 }}>{t("lecturers.none")}</T>}
              renderItem={({ item }) => {
                const office = b.rooms.find((r) => r.id === item.officeRoomId);
                return <Row title={lt(item.fullName, loc)} subtitle={lt(b.departments.find((d) => d.id === item.departmentId)?.name, loc)} meta={office?.code} href={`/lecturer/${item.id}`} />;
              }}
            />
          </View>
        );
      }}
    </Gate>
  );
}
