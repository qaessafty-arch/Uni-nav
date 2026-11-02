import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { CheckpointResult } from "@/CheckpointResult";
import { c } from "@/ui";

/** Deep link target: campusnav://q/<token> and https://<host>/q/<token> (App/Universal Links). */
export default function CheckpointLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
      <CheckpointResult token={String(token ?? "")} />
    </ScrollView>
  );
}
