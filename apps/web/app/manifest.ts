import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UNI NAV",
    short_name: "UNI NAV",
    description: "Find your lecture room and lecturer, and navigate there.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0C0D",
    theme_color: "#0B0C0D",
    lang: "en",
    dir: "auto",
    categories: ["education", "navigation"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan checkpoint", url: "/scan" },
      { name: "Timetable", url: "/timetable" },
    ],
  };
}
