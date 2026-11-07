/**
 * The one icon set for every CAMPUS NAV surface (student web, admin, mobile):
 * 24×24 line icons drawn with stroke="currentColor", stroke-width 1.75, round
 * caps and joins. Icons in FILLED_ICONS are drawn filled instead. No emoji
 * or text glyphs are used as icons anywhere in the product.
 */
export const ICONS = {
  // Navigation & app shell
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  search: "M10 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l5 5",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8",
  nearby: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  lecturers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  timetable: "M4 5h16v15H4zM4 9h16M9 3v4M15 3v4",
  saved: "M6 3h12v18l-6-4-6 4z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4",
  ask: "M4 5h16v11H8l-4 4zM8 9h8M8 12h5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.2 4 8 3 11l2 1-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z",
  flag: "M5 21V4h11l-1.5 4L16 12H5",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8",
  share: "M4 12v7h16v-7M12 3v12M7 8l5-5 5 5",
  warning: "M12 3 2 20h20zM12 10v4M12 17v.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  // Map & 3D controls
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  rotate: "M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5",
  reset: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  play: "M7 4.5v15l12-7.5z",
  stop: "M6.5 6.5h11v11h-11z",
  layers: "M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5",
  // State & feedback
  check: "M5 12.5 10 17.5 19 7",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6",
  star: "M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z",
  dot: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.2 2",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z",
  thermometer: "M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0zM12 17v.01",
  door: "M6 21V3h12v18M3 21h18M14 12v.5",
  steps: "M3 20h5v-4h5v-4h5V8h3",
  accessible: "M12 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 9h6M12 9v5h4l2 5M12 14a5 5 0 1 0 3.5 6",
  // Admin & customization
  palette: "M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.5-1-2.5 0-1 .8-1.9 1.9-1.9H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7.5h.01M15 7.5h.01",
  image: "M4 5h16v14H4zM4 15l4-4 5 5 3-3 4 4M15 9h.01",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2",
  // Facilities (room types)
  book: "M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6M20 4v14h-6",
  building: "M4 21V5l8-3 8 3v16M9 21v-5h6v5M8 8h2M14 8h2M8 12h2M14 12h2",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18",
  toilet: "M7 3h4v8H7zM5 11h12a5 5 0 0 1-5 5h-2v5M14 3h3",
  prayer: "M12 3c-3 3-5 5.5-5 9h10c0-3.5-2-6-5-9zM5 21v-9M19 21v-9M3 21h18",
  cafe: "M4 8h13v5a6 6 0 0 1-12 0zM17 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2",
  library: "M4 20V4M9 20V4M14 20l-3-15 4-1 4 16M3 20h18",
  lab: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10",
  office: "M4 7h16v13H4zM9 7V4h6v3M4 12h16",
  hall: "M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6",
} as const;

export type IconName = keyof typeof ICONS;

/** Icons drawn filled rather than stroked. */
export const FILLED_ICONS: ReadonlySet<IconName> = new Set<IconName>(["play", "stop", "dot"]);

/**
 * Icons staff can give a building (faculty or facility). The key is stored on
 * the building; labels are for the admin picker (English, staff-facing).
 */
export const BUILDING_ICONS = {
  building: { label: "General building", path: ICONS.building },
  engineering: { label: "Engineering", path: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.2 4 8 3 11l2 1-2 1 1 3 2-.2 1.3 1.3L7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3z" },
  science: { label: "Science", path: ICONS.lab },
  computing: { label: "Computing / IT", path: "M3 4h18v12H3zM8 20h8M12 16v4M8 9l-2 1.5L8 12M16 9l2 1.5-2 1.5" },
  medicine: { label: "Medicine", path: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" },
  pharmacy: { label: "Pharmacy", path: "M8.5 15.5l7-7M7 17a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-3 3a5 5 0 0 1-7 0z" },
  dentistry: { label: "Dentistry", path: "M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7 .5 3 1 6.5 2.5 6.5S9.5 17 12 17s3 4 4.5 4 2-3.5 2.5-6.5c.5-2.5 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z" },
  law: { label: "Law", path: "M12 4v16M8 20h8M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z" },
  business: { label: "Business & economics", path: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" },
  arts: { label: "Arts & humanities", path: ICONS.palette },
  languages: { label: "Languages", path: "M4 5h9M8.5 3v2M6 5c0 4 2.5 7 6 8M11 5c0 4-3 8-7 9M13 21l4-9 4 9M14.5 18h5" },
  education: { label: "Education", path: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6" },
  agriculture: { label: "Agriculture", path: "M5 20c0-9 6-15 15-15 0 9-6 15-15 15zM5 20l8-8" },
  library: { label: "Library", path: ICONS.book },
  cafeteria: { label: "Cafeteria", path: ICONS.cafe },
  mosque: { label: "Mosque / prayer", path: ICONS.prayer },
  sports: { label: "Sports", path: "M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" },
  clinic: { label: "Health centre", path: "M3 12h4l2-5 4 10 2-5h6" },
  admin: { label: "Administration", path: "M4 8h16v11H4zM9 8V5h6v3M4 13h16" },
  hall: { label: "Auditorium / hall", path: ICONS.hall },
  dorm: { label: "Dormitory", path: "M3 19V6M3 14h18v5M21 14v-1a3 3 0 0 0-3-3h-7v4M7 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  research: { label: "Research centre", path: "M10 3h4M11 3v5l-1 2M13 3v5M6 21h12M9 17h6M12 10a4 4 0 1 0 4 4" },
  gate: { label: "Gate / entrance", path: "M4 21V5h16v16M4 9h16M9 9v12M15 9v12" },
  parking: { label: "Parking", path: "M4 4h16v16H4zM9 17V7h4a3 3 0 0 1 0 6H9" },
} as const;

export type BuildingIconKey = keyof typeof BUILDING_ICONS;
export const BUILDING_ICON_KEYS = Object.keys(BUILDING_ICONS) as BuildingIconKey[];

export function buildingIconPath(key: string | null | undefined): string {
  return (BUILDING_ICONS as Record<string, { path: string }>)[key ?? ""]?.path ?? ICONS.building;
}

/** Curated building colours with readable white icons (contrast ≥ 4.5:1). */
export const BUILDING_COLORS = ["#1D4ED8", "#0E7490", "#047857", "#4D7C0F", "#B45309", "#B91C1C", "#9D174D", "#6D28D9", "#374151", "#7C2D12"] as const;
