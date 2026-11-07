/**
 * NULL-TECH / CAMPUS NAV design tokens.
 * Shared by web (CSS variables / Tailwind) and React Native (StyleSheet).
 */

export const palette = {
  ink950: "#0F1115",
  ink900: "#161A20",
  ink850: "#1C2128",
  ink800: "#12151A",
  ink700: "#262C35",
  ink600: "#343C47",
  gray500: "#6B7280",
  gray400: "#9AA3AE",
  gray300: "#C9CED6",
  white: "#FFFFFF",
  paper: "#F6F7F9",
  blue600: "#1D4ED8",
  blue500: "#2F6BEA",
  blue400: "#6B9BF2",
  blue50: "#EAF0FD",
  blue950: "#16233F",
  amber600: "#B45309",
  amber400: "#F2B04A",
  red600: "#B91C1C",
  red400: "#F07171",
  teal600: "#0E7490",
  teal400: "#5CC1D6",
} as const;

/**
 * Calm, professional palette: neutral surfaces, one university-blue accent for
 * primary actions, selection, routes and "you are here". Light is the default.
 */
export const colors = {
  dark: {
    bg: palette.ink950,
    surface: palette.ink900,
    surfaceRaised: palette.ink850,
    surfaceSunken: palette.ink800,
    border: palette.ink700,
    borderStrong: palette.ink600,
    text: "#E8EAED",
    textMuted: palette.gray400,
    textFaint: "#7C8591",
    accent: palette.blue400,
    accentText: "#0B1220",
    accentSoft: palette.blue950,
    warning: palette.amber400,
    danger: palette.red400,
    info: palette.teal400,
    // Map
    mapBg: "#13161B",
    mapRoom: "#1F242C",
    mapRoomStroke: "#3A424E",
    mapCorridor: "#181C22",
    mapStairs: "#2A2620",
    mapElevator: "#1E2836",
    mapToilet: "#1D2A30",
    mapSelected: palette.blue950,
    mapRoute: palette.blue400,
  },
  light: {
    bg: palette.paper,
    surface: palette.white,
    surfaceRaised: palette.white,
    surfaceSunken: "#EEF0F3",
    border: "#E2E5EA",
    borderStrong: "#CBD1D9",
    text: "#111827",
    textMuted: "#4B5563",
    textFaint: "#6B7280",
    accent: palette.blue600,
    accentText: "#FFFFFF",
    accentSoft: palette.blue50,
    warning: palette.amber600,
    danger: palette.red600,
    info: palette.teal600,
    mapBg: "#F1F3F6",
    mapRoom: "#FFFFFF",
    mapRoomStroke: "#AEB6C1",
    mapCorridor: "#E6E9EE",
    mapStairs: "#F6EFE3",
    mapElevator: "#E7EEFB",
    mapToilet: "#E6F3F6",
    mapSelected: "#D6E3FC",
    mapRoute: palette.blue600,
  },
} as const;

/**
 * Visual styles (UI-only). They change geometry, typography and surface
 * treatment — never colours' meaning, layout semantics or behaviour.
 */
export const visualStyles = ["minimal", "editorial", "brutal"] as const;
export type VisualStyle = (typeof visualStyles)[number];
export const visualStyleLabels: Record<VisualStyle, string> = {
  minimal: "Standard",
  editorial: "Editorial × Electric",
  brutal: "Brutalism × Electric",
};

/**
 * Native (React Native) equivalents of the CSS visual-style variables in
 * tokens.css / ui.css. UI-only: geometry, type and surface treatment.
 */
export interface StyleTokens {
  radius: number;
  borderWidth: number;
  borderWidthStrong: number;
  /** Font family for display headings; null = platform sans-serif. */
  displayFont: string | null;
  displayWeight: "400" | "600" | "700" | "800" | "900";
  displayUppercase: boolean;
  displayScale: number;
  displayTracking: number;
  labelTracking: number;
  /** Hard offset shadow (brutal) in px; 0 = none. */
  shadowOffset: number;
  buttonUppercase: boolean;
  buttonMono: boolean;
  /** Cards drawn as a top rule instead of a box (editorial). */
  ruleCards: boolean;
  /** Card/control borders use the text colour instead of the border colour. */
  strongBorders: boolean;
  /** Numbered section labels ("01 —"). */
  sectionIndex: boolean;
}

export const styleTokens: Record<VisualStyle, StyleTokens> = {
  minimal: { radius: 8, borderWidth: 1, borderWidthStrong: 1, displayFont: null, displayWeight: "600", displayUppercase: false, displayScale: 1, displayTracking: -0.3, labelTracking: 0, shadowOffset: 0, buttonUppercase: false, buttonMono: false, ruleCards: false, strongBorders: false, sectionIndex: false },
  editorial: { radius: 0, borderWidth: 1, borderWidthStrong: 1, displayFont: "InstrumentSerif_400Regular", displayWeight: "400", displayUppercase: false, displayScale: 1.3, displayTracking: -0.3, labelTracking: 2.2, shadowOffset: 0, buttonUppercase: true, buttonMono: true, ruleCards: true, strongBorders: false, sectionIndex: true },
  brutal: { radius: 0, borderWidth: 2, borderWidthStrong: 3, displayFont: null, displayWeight: "900", displayUppercase: true, displayScale: 1.1, displayTracking: -1, labelTracking: 1, shadowOffset: 4, buttonUppercase: true, buttonMono: false, ruleCards: false, strongBorders: true, sectionIndex: true },
};

export type ThemeName = keyof typeof colors;
export type ThemeColors = { [K in keyof (typeof colors)["dark"]]: string };

/** 4-pt spacing scale. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Square, technical corners. Only small radii. */
export const radius = { none: 0, sm: 4, md: 8, lg: 12, pill: 999 } as const;

export const fonts = {
  /** Latin UI text */
  sans: "Inter",
  /** Arabic-script text (Sorani + Arabic) with verified glyph coverage for ە ڕ ڵ ۆ ێ ڤ */
  arabic: "Noto Sans Arabic",
  /** Codes, room numbers, metadata */
  mono: "IBM Plex Mono",
} as const;

export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, "2xl": 28, "3xl": 36, "4xl": 48 } as const;
export const lineHeight = { tight: 1.15, snug: 1.3, normal: 1.5 } as const;
export const fontWeight = { regular: "400", medium: "500", semibold: "600", bold: "700" } as const;

export const motion = { fast: 120, normal: 200, slow: 320 } as const;

/** Minimum touch target in px (WCAG 2.5.5 AAA is 44). */
export const touchTarget = 44;

export const brand = {
  studio: "NULL-TECH",
  product: "CAMPUS NAV",
} as const;
export * from "./icons";
export * from "./brand";
