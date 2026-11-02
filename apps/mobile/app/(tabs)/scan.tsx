import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { parseCheckpointPayload } from "@campusnav/core";
import { CheckpointResult } from "@/CheckpointResult";
import { useApp } from "@/store";
import { Btn, Input, Label, Notice, T, c } from "@/ui";

/**
 * QR checkpoint scanner. The camera permission is requested only when the user
 * taps "Start camera"; if it is denied the code can be typed manually.
 */
export default function ScanScreen() {
  const { t } = useApp();
  const { then } = useLocalSearchParams<{ then?: string }>();
  const [perm, requestPerm] = useCameraPermissions();
  const [active, setActive] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState(false);
  const handled = useRef(false);

  const accept = (raw: string) => {
    const p = parseCheckpointPayload(raw);
    if (!p.ok) return false;
    handled.current = true;
    setActive(false);
    setToken(p.token);
    return true;
  };

  if (token) {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }}>
        <CheckpointResult token={token} then={then} onReset={() => { handled.current = false; setToken(null); }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <T muted>{t("scan.hint")}</T>
      <View style={{ aspectRatio: 1, backgroundColor: "#000", borderWidth: 1, borderColor: c.borderStrong, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        {active && perm?.granted ? (
          <CameraView
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handled.current ? undefined : ({ data }) => { accept(data); }}
          />
        ) : (
          <Btn
            variant="primary"
            title={t("scan.startCamera")}
            onPress={async () => {
              const res = perm?.granted ? perm : await requestPerm();
              if (res.granted) setActive(true);
            }}
          />
        )}
        {active ? <View pointerEvents="none" style={{ position: "absolute", top: "18%", left: "18%", right: "18%", bottom: "18%", borderWidth: 2, borderColor: c.accent }} /> : null}
      </View>
      {perm && !perm.granted && !perm.canAskAgain ? (
        <Notice tone="warn">
          <T size="sm">{t("scan.cameraDenied")}</T>
          <Btn title={t("nav.settings")} onPress={() => void Linking.openSettings()} />
        </Notice>
      ) : null}
      <Label>{t("scan.manual")}</Label>
      <Input value={manual} onChangeText={(v) => { setManual(v); setManualError(false); }} placeholder={t("scan.manualPlaceholder")} autoCapitalize="none" autoCorrect={false} maxLength={512} />
      {manualError ? <T style={{ color: c.danger }} size="sm">{t("scan.unknown")}</T> : null}
      <Btn title={t("scan.submit")} disabled={!manual.trim()} onPress={() => setManualError(!accept(manual))} />
    </ScrollView>
  );
}
