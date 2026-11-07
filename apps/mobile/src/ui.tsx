import { Link, router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from "react-native";
import { colors, fontSize, ICONS, space, styleTokens, touchTarget, type StyleTokens } from "@campusnav/tokens";
import Svg, { Path } from "react-native-svg";
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

/** Current visual style tokens (UI-only: Minimalism / Editorial / Brutalism × Electric). */
export function useLook(): StyleTokens {
  const { prefs } = useApp();
  return styleTokens[prefs.style] ?? styleTokens.editorial;
}

/** Hard offset shadow used by the Brutalism style (iOS shadow + Android elevation fallback). */
function hardShadow(look: StyleTokens, color: string): ViewStyle {
  if (!look.shadowOffset) return {};
  return { shadowColor: color, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: look.shadowOffset, height: look.shadowOffset }, elevation: 0 };
}

/** Card surface for the current style. */
export function useCard(accent = false): ViewStyle {
  const look = useLook();
  if (look.ruleCards) {
    return { borderTopWidth: accent ? 3 : 1, borderTopColor: accent ? c.accent : c.text, paddingVertical: space[4], paddingHorizontal: 0, backgroundColor: "transparent" };
  }
  return {
    borderWidth: look.borderWidth,
    borderColor: accent ? c.accent : look.strongBorders ? c.text : c.border,
    borderRadius: look.radius,
    backgroundColor: c.surface,
    padding: space[4],
    ...hardShadow(look, accent ? c.accent : c.text),
  };
}

export function T({ children, style, muted, bold, mono, display, size = "md", numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean; mono?: boolean; display?: boolean; size?: keyof typeof fontSize; numberOfLines?: number }) {
  const tx = useText();
  const look = useLook();
  const base: TextStyle = { color: muted ? c.textMuted : c.text, fontSize: fontSize[size], textAlign: tx.align, writingDirection: tx.rtl ? "rtl" : "ltr" };
  let face: TextStyle | null = null;
  if (tx.rtl) face = { fontFamily: bold || display ? tx.fontBold : tx.font };
  else if (display) {
    const fs = Math.round(fontSize[size] * look.displayScale);
    face = {
      fontSize: fs,
      lineHeight: Math.round(fs * 1.05),
      fontWeight: look.displayWeight,
      letterSpacing: look.displayTracking,
      textTransform: look.displayUppercase ? "uppercase" : "none",
      ...(look.displayFont ? { fontFamily: look.displayFont, fontWeight: "400" } : {}),
    };
  } else if (mono) face = { fontFamily: "IBMPlexMono_400Regular" };
  return (
    <Text numberOfLines={numberOfLines} style={[base, bold && !display && { fontWeight: "700" }, face, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const tx = useText();
  const look = useLook();
  return (
    <View style={{ flexDirection: tx.row, alignItems: "center", gap: 6, marginTop: space[2], marginBottom: space[3], paddingBottom: look.sectionIndex ? space[2] : 0, borderBottomWidth: look.sectionIndex ? (look.strongBorders ? 2 : 1) : 0, borderBottomColor: look.strongBorders ? c.accent : c.text }}>
      {look.sectionIndex ? <View style={{ width: 6, height: 6, backgroundColor: c.accent, borderRadius: look.ruleCards ? 3 : 0 }} /> : null}
      <Text style={{ color: look.strongBorders ? c.text : c.textMuted, fontSize: 12, fontWeight: look.strongBorders ? "700" : "400", letterSpacing: tx.rtl ? 0 : look.labelTracking, textTransform: "uppercase", fontFamily: tx.rtl ? tx.font : "IBMPlexMono_400Regular", textAlign: tx.align, flexShrink: 1 }}>{children}</Text>
    </View>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flex: 1, backgroundColor: c.bg, padding: space[4] }, style]}>{children}</View>;
}

export function Btn({ title, onPress, variant = "secondary", disabled, href, accessibilityLabel }: { title: string; onPress?: () => void; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; href?: Href; accessibilityLabel?: string }) {
  const look = useLook();
  const tx = useText();
  const style: ViewStyle = {
    minHeight: touchTarget,
    paddingHorizontal: space[4],
    borderWidth: look.borderWidth,
    borderRadius: look.radius,
    borderColor: variant === "primary" ? (look.strongBorders ? c.text : c.accent) : variant === "danger" ? c.danger : look.ruleCards || look.strongBorders ? c.text : c.borderStrong,
    backgroundColor: variant === "primary" ? c.accent : look.ruleCards ? "transparent" : c.surface,
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.4 : 1,
    ...(disabled ? {} : hardShadow({ ...look, shadowOffset: look.shadowOffset ? 3 : 0 }, c.text)),
  };
  const label = (
    <T
      style={{
        color: variant === "primary" ? c.accentText : variant === "danger" ? c.danger : c.text,
        fontWeight: look.strongBorders ? "800" : "600",
        textAlign: "center",
        ...(tx.rtl ? {} : { textTransform: look.buttonUppercase ? "uppercase" : "none", letterSpacing: look.buttonMono ? 1.5 : look.buttonUppercase ? 0.5 : 0 }),
        ...(look.buttonMono && !tx.rtl ? { fontFamily: "IBMPlexMono_400Regular", fontSize: 13, fontWeight: "400" } : {}),
      }}
    >
      {title}
    </T>
  );
  const pressedStyle: ViewStyle = look.shadowOffset ? { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOpacity: 0 } : { opacity: 0.7 };
  // Navigate with the router rather than wrapping in <Link asChild>: on web the
  // Link wrapper drops Pressable's style function, which removed the button fill.
  if (href && !disabled)
    return (
      <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel ?? title} onPress={() => router.push(href)} style={({ pressed }) => [style, pressed && pressedStyle]}>
        {label}
      </Pressable>
    );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [style, pressed && pressedStyle]}>
      {label}
    </Pressable>
  );
}

export function Row({ title, subtitle, meta, href, onPress }: { title: string; subtitle?: string; meta?: string; href?: Href; onPress?: () => void }) {
  const tx = useText();
  // router.push instead of <Link asChild>: on web the Link wrapper drops the style function (row layout).
  return (
    <Pressable accessibilityRole={href ? "link" : "button"} onPress={href ? () => router.push(href) : onPress} style={({ pressed }) => [styles.row, { flexDirection: tx.row }, pressed && { backgroundColor: c.surface }]}>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{title}</T>
        {subtitle ? <T muted size="sm" numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {meta ? <T muted size="sm" mono>{meta}</T> : null}
      <View style={{ transform: [{ scaleX: tx.rtl ? -1 : 1 }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c.textFaint} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d={ICONS.arrow} />
        </Svg>
      </View>
    </Pressable>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "danger" }) {
  const look = useLook();
  const col = { neutral: c.textMuted, accent: c.accent, warn: c.warning, danger: c.danger }[tone];
  return (
    <View style={{ borderWidth: look.strongBorders ? 2 : 1, borderColor: col, borderRadius: look.radius, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: col, fontSize: 11, fontFamily: "IBMPlexMono_400Regular", fontWeight: look.strongBorders ? "700" : "400" }}>{children}</Text>
    </View>
  );
}

export function Input(props: TextInputProps) {
  const tx = useText();
  const look = useLook();
  const frame: TextStyle = look.ruleCards
    ? { borderBottomWidth: 1, borderColor: c.text, backgroundColor: "transparent", paddingHorizontal: 0 }
    : { borderWidth: look.borderWidth, borderRadius: look.radius, borderColor: look.strongBorders ? c.text : c.borderStrong, backgroundColor: c.surface, paddingHorizontal: space[3] };
  return <TextInput placeholderTextColor={c.textFaint} {...props} style={[{ minHeight: 48, color: c.text, fontSize: 16, textAlign: tx.align, fontFamily: tx.font }, frame, props.style]} />;
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
  const look = useLook();
  const col = { info: c.info, warn: c.warning, danger: c.danger }[tone];
  // Brutalism: the demo/warning notice becomes a solid block with dark text.
  if (look.strongBorders && tone === "warn") {
    return (
      <View style={{ backgroundColor: c.warning, padding: space[3], marginVertical: space[2], borderWidth: 2, borderColor: c.text }}>
        {typeof children === "string" ? <T size="sm" style={{ color: "#0B0C0D", fontWeight: "700" }}>{children}</T> : children}
      </View>
    );
  }
  return (
    <View style={{ borderColor: col, [tx.rtl ? "borderRightWidth" : "borderLeftWidth"]: look.strongBorders ? 4 : 3, backgroundColor: look.ruleCards ? "transparent" : c.surface, padding: space[3], marginVertical: space[2] }}>
      {typeof children === "string" ? <T size="sm">{children}</T> : children}
    </View>
  );
}

/** Visual-style selector (UI only). */
export function StylePicker({ value, onChange, labels }: { value: StyleKey; onChange: (v: StyleKey) => void; labels: Record<StyleKey, string> }) {
  const tx = useText();
  const keys: StyleKey[] = ["minimal", "editorial", "brutal"];
  const sample: Record<StyleKey, TextStyle> = {
    minimal: { fontWeight: "600", fontSize: 16, letterSpacing: -0.4 },
    editorial: { fontFamily: "InstrumentSerif_400Regular", fontSize: 24, fontStyle: "italic" },
    brutal: { fontWeight: "900", fontSize: 16, textTransform: "uppercase", letterSpacing: -0.8 },
  };
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {keys.map((k) => {
        const on = value === k;
        const t = styleTokens[k];
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={labels[k]}
            onPress={() => onChange(k)}
            style={{ flexDirection: tx.row, alignItems: "center", gap: 12, minHeight: 60, padding: 10, borderWidth: t.borderWidth, borderRadius: t.radius, borderColor: on ? c.accent : c.borderStrong, backgroundColor: on ? c.accentSoft : "transparent" }}
          >
            <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}>
              <Text style={[{ color: c.text }, sample[k]]}>{k === "brutal" ? "AA" : "Aa"}</Text>
            </View>
            <Text style={{ flex: 1, color: c.text, fontWeight: "600", fontSize: 14, writingDirection: "ltr", textAlign: tx.align }}>{labels[k]}</Text>
            {on ? <View style={{ width: 10, height: 10, backgroundColor: c.accent, borderRadius: 5 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
type StyleKey = "minimal" | "editorial" | "brutal";

export const styles = StyleSheet.create({
  row: { alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: c.border },
  card: { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: space[4] },
});
