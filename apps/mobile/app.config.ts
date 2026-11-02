import type { ExpoConfig } from "expo/config";

/**
 * CAMPUS NAV native app (Android + iOS). Values marked PLACEHOLDER must be set
 * before store submission — see docs/MOBILE.md.
 */
const config: ExpoConfig = {
  name: "CAMPUS NAV",
  slug: "campus-nav",
  scheme: "campusnav",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: "#0B0C0D",
  ios: {
    bundleIdentifier: "com.nulltech.campusnav",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "The camera is used only to scan CAMPUS NAV QR checkpoints so the app knows where you are inside a building.",
    },
    // Universal links for printed QR codes (https://<host>/q/<token>). PLACEHOLDER host.
    associatedDomains: process.env.CAMPUSNAV_LINK_HOST ? [`applinks:${process.env.CAMPUSNAV_LINK_HOST}`] : [],
  },
  android: {
    package: "com.nulltech.campusnav",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#0B0C0D" },
    // Only the camera is requested. No location, contacts, storage or microphone.
    permissions: ["android.permission.CAMERA"],
    blockedPermissions: ["android.permission.RECORD_AUDIO", "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
    intentFilters: process.env.CAMPUSNAV_LINK_HOST
      ? [{ action: "VIEW", autoVerify: true, data: [{ scheme: "https", host: process.env.CAMPUSNAV_LINK_HOST, pathPrefix: "/q/" }], category: ["BROWSABLE", "DEFAULT"] }]
      : [],
  },
  web: { bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-localization",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 160, backgroundColor: "#0B0C0D", resizeMode: "contain" }],
    ["expo-camera", { cameraPermission: "The camera is used only to scan CAMPUS NAV QR checkpoints.", microphonePermission: false, recordAudioAndroid: false }],
    ["expo-notifications", { color: "#2BFF88" }],
    "expo-font",
  ],
  experiments: { typedRoutes: false },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    // EAS project id is required for remote push tokens. PLACEHOLDER until `eas init`.
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
};

export default config;
