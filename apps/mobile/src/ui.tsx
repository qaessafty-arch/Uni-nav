import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { colors, fontSize, space, touchTarget } from "@campusnav/tokens";
import { useApp } from "./store";

export const c = colors.dark;

export function useText() {
  const { rtl } = useApp();
  return {
    rtl,
    font: rtl ? "NotoSansArabic_400Regular" : undefined,
    fontBold: rtl ? "NotoSansArabic_700Bold" : undefined,
    align: (rtl ? "right" : "left") as TextStyle["textAlign"],
    row: (rtl ? "row-reverse" : "row") as ViewStyle["flexDirection"],
  };
}

export function T({ children, style, muted, bold, mono, size = "md", numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean; mono?: boolean; size?: keyof typeof fontSize; numberOfLines?: number }) {
  const tx = useText();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: muted ? c.textMuted : c.text, fontSize: fontSize[size], textAlign: tx.align, writingDirection: tx.rtl ? "rtl" : "ltr" },
        bold && { fontWeight: "700" },
        tx.rtl ? { fontFamily: bold ? tx.fontBold : tx.font } : mono ? { fontFamily: "IBMPlexMono_400Regular" } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const tx = useText();
  return <Text style={{ color: c.textMuted, fontSize: 12, letterSpacing: tx.rtl ? 0 : 1.5, textTransform: "uppercase", fontFamily: tx.rtl ? tx.font : "IBMPlexMono_400Regular", textAlign: tx.align, marginBottom: space[2] }}>{children}</Text>;
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: c.bg, padding: space[4] }, style]}>{children}</View>;
}

export function Btn({ title, onPress, variant = "secondary", disabled, href, accessibilityLabel }: { title: string; onPress?: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; href?: Href; accessibilityLabel?: string }) {
  const style: ViewStyle = {
    minHeight: touchTarget,
    paddingHorizontal: space[4],
    borderWidth: 1,
    borderColor: variant === "primary" ? c.accent : variant === "danger" ? c.danger : c.borderStrong,
    backgroundColor: variant === "primary" ? c.accent : c.surface,
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.4 : 1,
  };
  const label = <T style={{ color: variant === "primary" ? c.accentText : variant === "danger" ? c.danger : c.text, fontWeight: "600", textAlign: "center" }}>{title}</T>;
  if (href && !disabled)
    return (
      <Link href={href} asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={style}>
          {label}
        </Pressable>
      </Link>
    );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}>
      {label}
    </Pressable>
  );
}

export function Row({ title, subtitle, meta, href, onPress }: { title: string; subtitle?: string; meta?: string; href?: Href; onPress?: () => void }) {
  const tx = useText();
  const inner = (
    <Pressable accessibilityRole={href ? "link" : "button"} onPress={onPress} style={({ pressed }) => [styles.row, { flexDirection: tx.row }, pressed && { backgroundColor: c.surface }]}>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{title}</T>
        {subtitle ? <T muted size="sm" numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {meta ? <T muted size="sm" mono>{meta}</T> : null}
    </Pressable>
  );
  return href ? <Link href={href} asChild>{inner}</Link> : inner;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "danger" }) {
  const col = { neutral: c.textMuted, accent: c.accent, warn: c.warning, danger: c.danger }[tone];
  return (
    <View style={{ borderWidth: 1, borderColor: col, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: col, fontSize: 11, fontFamily: "IBMPlexMono_400Regular" }}>{children}</Text>
    </View>
  );
}

export function Input(props: TextInputProps) {
  const tx = useText();
  return <TextInput placeholderTextColor={c.textFaint} {...props} style={[{ minHeight: 48, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, color: c.text, paddingHorizontal: space[3], fontSize: 16, textAlign: tx.align, fontFamily: tx.font }, props.style]} />;
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={c.accent} />
      <T muted style={{ marginTop: space[3], textAlign: "center" }}>{label}</T>
    </View>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const tx = useText();
  const col = { info: c.info, warn: c.warning, danger: c.danger }[tone];
  return (
    <View style={{ borderColor: col, [tx.rtl ? "borderRightWidth" : "borderLeftWidth"]: 3, backgroundColor: c.surface, padding: space[3], marginVertical: space[2] }}>
      {typeof children === "string" ? <T size="sm">{children}</T> : children}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: c.border },
  card: { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: space[4] },
});
