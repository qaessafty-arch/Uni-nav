/**
 * NULL-TECH / CAMPUS NAV design tokens.
 * Restrained brutalist palette: deep charcoal surfaces, off-white text, one
 * electric-green accent used for primary actions, routes and "you are here".
 * Shared by web (CSS variables / Tailwind) and React Native (StyleSheet).
 */

export const palette = {
  charcoal950: "#0B0C0D",
  charcoal900: "#111315",
  charcoal850: "#16191C",
  charcoal800: "#1C2024",
  charcoal700: "#272C31",
  charcoal600: "#353B42",
  gray500: "#6B737C",
  gray400: "#8C949C",
  gray300: "#B4BAC0",
  offwhite100: "#EDEDE8",
  offwhite50: "#F6F6F2",
  green500: "#2BFF88",
  green600: "#17D86E",
  green700: "#0E9F50",
  green950: "#06261A",
  amber500: "#FFB547",
  red500: "#FF5A5A",
  blue400: "#6CB4FF",
} as const;

export const colors = {
  dark: {
    bg: palette.charcoal950,
    surface: palette.charcoal900,
    surfaceRaised: palette.charcoal850,
    surfaceSunken: palette.charcoal800,
    border: palette.charcoal700,
    borderStrong: palette.charcoal600,
    text: palette.offwhite100,
    textMuted: palette.gray400,
    textFaint: palette.gray500,
    accent: palette.green500,
    accentText: palette.charcoal950,
    accentSoft: palette.green950,
    warning: palette.amber500,
    danger: palette.red500,
    info: palette.blue400,
    // Map
    mapBg: "#121518",
    mapRoom: "#1E2328",
    mapRoomStroke: "#3A4148",
    mapCorridor: "#171B1F",
    mapStairs: "#2A2F24",
    mapElevator: "#24292F",
    mapToilet: "#1F2630",
    mapSelected: palette.green950,
    mapRoute: palette.green500,
  },
  light: {
    bg: palette.offwhite50,
    surface: "#FFFFFF",
    surfaceRaised: "#FFFFFF",
    surfaceSunken: palette.offwhite100,
    border: "#D9D9D2",
    borderStrong: "#B9B9B0",
    text: palette.charcoal950,
    textMuted: "#4F565D",
    textFaint: "#6B737C",
    accent: palette.green700,
    accentText: "#FFFFFF",
    accentSoft: "#DFF8EA",
    warning: "#9A5B00",
    danger: "#B42318",
    info: "#175CD3",
    mapBg: "#F2F2EC",
    mapRoom: "#FFFFFF",
    mapRoomStroke: "#9EA3A8",
    mapCorridor: "#E7E7E0",
    mapStairs: "#EEF1E2",
    mapElevator: "#E6EBF0",
    mapToilet: "#E8EEF5",
    mapSelected: "#C9F5DC",
    mapRoute: palette.green700,
  },
} as const;

export type ThemeName = keyof typeof colors;
export type ThemeColors = { [K in keyof (typeof colors)["dark"]]: string };

/** 4-pt spacing scale. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Square, technical corners. Only small radii. */
export const radius = { none: 0, sm: 2, md: 4, lg: 6, pill: 999 } as const;

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
