/**
 * DEMONSTRATION DATASET — entirely fictional.
 *
 * "Demo University" and everything in it is invented to exercise the platform
 * before verified Salahaddin University data is available. Nothing here is,
 * or may be presented as, official information about any real university.
 */
import type {
  Announcement,
  Building,
  Campus,
  CampusBundle,
  Closure,
  Course,
  Department,
  Floor,
  Lecturer,
  LocalizedText,
  MapElement,
  NavEdge,
  NavNode,
  QrCheckpoint,
  Room,
  RoomType,
  ScheduleChange,
  Semester,
  StudentGroup,
  TimetableEntry,
  University,
  Weekday,
} from "@campusnav/core";

/** Deterministic UUID-formatted id from a name (stable across runs; not RFC 4122 namespaced). */
export function did(name: string): string {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < name.length; i++) {
    const k = name.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  const hex = [h1 ^ h2 ^ h3 ^ h4, h2 ^ h1, h3 ^ h1, h4 ^ h1].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
  // Set version nibble to 4 and variant to 10xx so Postgres/uuid validators accept it.
  const v = hex.slice(0, 12) + "4" + hex.slice(13, 16) + ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 32);
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}

const T = (en: string, ckb?: string, ar?: string): LocalizedText => ({ en, ...(ckb ? { ckb } : {}), ...(ar ? { ar } : {}) });

export const DEMO_UNIVERSITY_ID = did("demo-university");
const U = DEMO_UNIVERSITY_ID;

export const demoUniversity: University = {
  id: U,
  slug: "demo",
  name: T("Demo University", "زانکۆی نموونە", "الجامعة التجريبية"),
  shortName: "DEMO",
  dataStatus: "demo",
  published: true,
  branding: { primaryColor: "#1D4ED8", logoUrl: null, productName: "DEMO NAV" },
  settings: {
    timezone: "Asia/Baghdad",
    weekendDays: [5, 6],
    defaultLocale: "en",
    enabledLocales: ["en", "ckb", "ar"],
    timetableVisibility: "public",
    walkingSpeedMps: 1.2,
    accessibleWalkingSpeedMps: 0.8,
    stairsSecondsPerFloor: 20,
    elevatorSecondsPerFloor: 45,
  },
};

const CAMPUS_ID = did("demo-campus-main");
export const demoCampuses: Campus[] = [
  {
    id: CAMPUS_ID,
    universityId: U,
    name: T("Demo Main Campus", "کەمپەسی سەرەکیی نموونە", "الحرم الرئيسي التجريبي"),
    description: T("Fictional campus used for demonstration only."),
    overviewWidth: 1000,
    overviewHeight: 700,
    // Pilot preview: centre the real map on the Salahaddin University-Erbil main campus as recorded in
    // OpenStreetMap (way 686923804). The fictional demo buildings are NOT placed on the real map.
    geo: { center: [44.0249844, 36.1439009], zoom: 16, source: "OpenStreetMap — Salahaddin University-Erbil main campus (pilot preview location)" },
  },
];

/** Demo opening hours (not real): Sunday–Thursday 07:00–17:00. */
const WEEKDAY_7_TO_17 = { "0": [["07:00", "17:00"]], "1": [["07:00", "17:00"]], "2": [["07:00", "17:00"]], "3": [["07:00", "17:00"]], "4": [["07:00", "17:00"]] } as Building["hours"] & object;
const ENG = did("demo-building-eng");
const SCI = did("demo-building-sci");
const LIB = did("demo-building-lib");
const CAF = did("demo-building-caf");
export const demoBuildings: Building[] = [
  {
    id: ENG,
    universityId: U,
    campusId: CAMPUS_ID,
    code: "DEMO-ENG",
    name: T("Demo Engineering Building", "بینای ئەندازیاریی نموونە", "مبنى الهندسة التجريبي"),
    description: T("Three-storey demonstration building with stairs and an elevator."),
    overview: { x: 120, y: 160, w: 360, h: 220 },
    icon: "engineering",
    color: "#1D4ED8",
    hours: WEEKDAY_7_TO_17,
    dataStatus: "demo",
  },
  {
    id: SCI,
    universityId: U,
    campusId: CAMPUS_ID,
    code: "DEMO-SCI",
    name: T("Demo Science Building", "بینای زانستیی نموونە", "مبنى العلوم التجريبي"),
    description: T("Two-storey demonstration building connected to the Engineering building by an outdoor path."),
    overview: { x: 600, y: 300, w: 280, h: 200 },
    icon: "science",
    color: "#047857",
    hours: WEEKDAY_7_TO_17,
    dataStatus: "demo",
  },
  {
    id: LIB,
    universityId: U,
    campusId: CAMPUS_ID,
    code: "DEMO-LIB",
    name: T("Demo Central Library", "کتێبخانەی ناوەندیی نموونە", "المكتبة المركزية التجريبية"),
    description: T("Two-storey demonstration library, a separate building reached by outdoor paths."),
    overview: { x: 600, y: 40, w: 300, h: 190 },
    icon: "library",
    color: "#6D28D9",
    // Demo hours only: Sun–Thu 08:00–20:00, Sat 09:00–14:00, Fri closed.
    hours: { "0": [["08:00", "20:00"]], "1": [["08:00", "20:00"]], "2": [["08:00", "20:00"]], "3": [["08:00", "20:00"]], "4": [["08:00", "20:00"]], "6": [["09:00", "14:00"]] },
    dataStatus: "demo",
  },
  {
    id: CAF,
    universityId: U,
    campusId: CAMPUS_ID,
    code: "DEMO-CAF",
    name: T("Demo Student Cafeteria", "کافتریای قوتابیانی نموونە", "كافتيريا الطلبة التجريبية"),
    description: T("Single-storey demonstration cafeteria building."),
    overview: { x: 170, y: 470, w: 260, h: 160 },
    icon: "cafeteria",
    color: "#B45309",
    // Demo hours only: Sun–Thu 07:30–16:00 with a short cleaning break.
    hours: { "0": [["07:30", "12:00"], ["12:30", "16:00"]], "1": [["07:30", "12:00"], ["12:30", "16:00"]], "2": [["07:30", "12:00"], ["12:30", "16:00"]], "3": [["07:30", "12:00"], ["12:30", "16:00"]], "4": [["07:30", "12:00"], ["12:30", "16:00"]] },
    dataStatus: "demo",
  },
];

// ─── Floor generator ───────────────────────────────────────────────────────
const FLOOR_W = 1000;
const FLOOR_H = 600;
const MPU = 0.05; // 1 unit = 5 cm → floor is 50 m × 30 m
const CORRIDOR_Y = 300;
const ROOM_SLOTS = [150, 290, 430, 570, 710, 850]; // door x positions

const floors: Floor[] = [];
const rooms: Room[] = [];
const elements: MapElement[] = [];
const nodes: NavNode[] = [];
const edges: NavEdge[] = [];

const levelName = (level: number): LocalizedText =>
  level === 0 ? T("Demo Ground Floor", "نهۆمی زەویی نموونە", "الطابق الأرضي التجريبي") : T(`Demo Floor ${level}`, `نهۆمی ${level}ی نموونە`, `الطابق ${level} التجريبي`);

const node = (key: string, floorId: string, x: number, y: number, kind: NavNode["kind"], label?: LocalizedText, verticalGroup?: string): NavNode => {
  const n: NavNode = { id: did(key), universityId: U, floorId, x, y, kind, label: label ?? null, verticalGroup: verticalGroup ?? null };
  nodes.push(n);
  return n;
};
const edge = (a: NavNode, b: NavNode, kind: NavEdge["kind"], opts: Partial<NavEdge> = {}): NavEdge => {
  const e: NavEdge = {
    id: did(`edge:${a.id}:${b.id}`),
    universityId: U,
    fromNodeId: a.id,
    toNodeId: b.id,
    kind,
    distanceM: null,
    accessible: kind !== "stairs",
    bidirectional: true,
    blocked: false,
    restriction: null,
    ...opts,
  };
  edges.push(e);
  return e;
};

interface RoomSpec {
  code: string;
  name: LocalizedText;
  type: RoomType;
  dept?: string;
  capacity?: number;
}

function buildFloor(buildingKey: string, buildingId: string, buildingCode: string, level: number, specs: (RoomSpec | null)[], hasEntrance: boolean) {
  const floorId = did(`${buildingKey}-floor-${level}`);
  floors.push({ id: floorId, universityId: U, buildingId, level, name: levelName(level), width: FLOOR_W, height: FLOOR_H, metersPerUnit: MPU, planAssetUrl: null });

  elements.push({ id: did(`${floorId}-corridor`), universityId: U, floorId, kind: "corridor", shape: { type: "rect", x: 40, y: 270, w: 920, h: 60 }, label: T("Corridor", "ڕاڕەو", "ممر") });
  elements.push({ id: did(`${floorId}-stairs-el`), universityId: U, floorId, kind: "stairs", shape: { type: "rect", x: 40, y: 340, w: 60, h: 120 }, label: T("Stairs", "قادرمە", "درج") });
  elements.push({ id: did(`${floorId}-lift-el`), universityId: U, floorId, kind: "elevator", shape: { type: "rect", x: 900, y: 340, w: 60, h: 80 }, label: T("Elevator", "مەسعەد", "مصعد") });
  elements.push({ id: did(`${floorId}-exit-el`), universityId: U, floorId, kind: "emergency_exit", shape: { type: "rect", x: 40, y: 140, w: 40, h: 60 }, label: T("Emergency exit", "دەرچەی فریاکەوتن", "مخرج طوارئ") });

  // Corridor spine
  const west = node(`${floorId}-c-west`, floorId, 70, CORRIDOR_Y, "corridor");
  const spine = [west];
  for (const x of ROOM_SLOTS) spine.push(node(`${floorId}-c-${x}`, floorId, x, CORRIDOR_Y, "corridor"));
  const east = node(`${floorId}-c-east`, floorId, 930, CORRIDOR_Y, "corridor");
  spine.push(east);
  for (let i = 0; i < spine.length - 1; i++) edge(spine[i]!, spine[i + 1]!, "corridor");

  const stairs = node(`${floorId}-stairs`, floorId, 70, 400, "stairs", T(`${buildingCode} stairs`, "قادرمە", "الدرج"), `${buildingKey}-stairs`);
  const lift = node(`${floorId}-lift`, floorId, 930, 380, "elevator", T(`${buildingCode} elevator`, "مەسعەد", "المصعد"), `${buildingKey}-lift`);
  edge(west, stairs, "corridor");
  edge(east, lift, "corridor");

  specs.forEach((spec, i) => {
    const top = i < 6;
    const slot = i % 6;
    const doorX = ROOM_SLOTS[slot]!;
    if (!spec) return;
    const roomId = did(`${buildingKey}-room-${spec.code}`);
    const y = top ? 40 : 330;
    const doorY = top ? 270 : 330;
    const entrance = node(`${roomId}-door`, floorId, doorX, doorY, "room_entrance", T(`${spec.name.en}`, spec.name.ckb, spec.name.ar));
    edge(entrance, spine[slot + 1]!, "door");
    rooms.push({
      id: roomId,
      universityId: U,
      buildingId,
      floorId,
      code: spec.code,
      name: spec.name,
      type: spec.type,
      departmentId: spec.dept ?? null,
      capacity: spec.capacity ?? null,
      entranceNodeId: entrance.id,
      accessible: true,
      dataStatus: "demo",
    });
    elements.push({ id: did(`${roomId}-el`), universityId: U, floorId, kind: spec.type === "toilet" ? "toilet" : "room", shape: { type: "rect", x: doorX - 65, y, w: 130, h: 230 }, label: T(spec.code), roomId });
  });

  if (hasEntrance) {
    const entrance = node(`${floorId}-entrance`, floorId, 500, 590, "building_entrance", T(`${buildingCode} main entrance`, "دەرگای سەرەکی", "المدخل الرئيسي"));
    const lobby = node(`${floorId}-lobby`, floorId, 500, CORRIDOR_Y, "corridor");
    // Splice lobby into the spine between 430 and 570
    const a = spine.find((n) => n.x === 430)!;
    const b = spine.find((n) => n.x === 570)!;
    edges.splice(edges.findIndex((e) => e.fromNodeId === a.id && e.toNodeId === b.id), 1);
    edge(a, lobby, "corridor");
    edge(lobby, b, "corridor");
    edge(lobby, entrance, "corridor");
    elements.push({ id: did(`${floorId}-entrance-el`), universityId: U, floorId, kind: "entrance", shape: { type: "rect", x: 460, y: 560, w: 80, h: 40 }, label: T("Entrance", "دەرگا", "مدخل") });
  }
  return { floorId, stairs, lift, nodes: spine };
}

const D_CS = did("demo-dept-cs");
const D_CE = did("demo-dept-ce");
const D_PHY = did("demo-dept-phy");

const R = (code: string, en: string, type: RoomType, dept?: string, capacity?: number, ckb?: string, ar?: string): RoomSpec => ({
  code,
  name: T(en, ckb, ar),
  type,
  dept,
  capacity,
});

// Demo Engineering: ground, 1, 2
const engG = buildFloor("eng", ENG, "DEMO-ENG", 0, [
  R("G01", "Demo Lecture Hall G01", "lecture_hall", D_CE, 120, "هۆڵی وانەی G01", "قاعة المحاضرات G01"),
  R("G02", "Demo Classroom G02", "classroom", D_CE, 40),
  R("G03", "Demo Student Services", "service", undefined, undefined, "خزمەتگوزاریی قوتابیان", "خدمات الطلبة"),
  R("G04", "Demo Classroom G04", "classroom", D_CE, 40),
  R("G05", "Demo Classroom G05", "classroom", D_CE, 40),
  R("G06", "Demo Toilets G06", "toilet", undefined, undefined, "ئاودەست", "دورات المياه"),
  R("G07", "Demo Civil Lab G07", "laboratory", D_CE, 30, "تاقیگەی شارستانی", "مختبر المدني"),
  R("G08", "Demo Classroom G08", "classroom", D_CE, 40),
  null, // entrance lobby slot
  R("G10", "Demo Prayer Room", "prayer_room", undefined, 20, "ژووری نوێژ", "مصلى"),
  R("G11", "Demo Storage", "storage"),
  R("G12", "Demo Classroom G12", "classroom", D_CE, 35),
], true);
const eng1 = buildFloor("eng", ENG, "DEMO-ENG", 1, [
  R("101", "Demo Room 101", "classroom", D_CS, 45, "ژووری ١٠١", "غرفة 101"),
  R("102", "Demo Room 102", "classroom", D_CS, 45),
  R("103", "Demo Computer Lab 103", "laboratory", D_CS, 30, "تاقیگەی کۆمپیوتەر ١٠٣", "مختبر الحاسوب 103"),
  R("104", "Demo Computer Lab 104", "laboratory", D_CS, 30),
  R("105", "Demo Lecturer Office 105", "office", D_CS, undefined, "ژووری مامۆستا ١٠٥", "مكتب المحاضر 105"),
  R("106", "Demo Toilets 106", "toilet"),
  R("107", "Demo Lecture Hall 107", "lecture_hall", D_CS, 100),
  R("108", "Demo Lecturer Office 108", "office", D_CS),
  R("109", "Demo Lecturer Office 109", "office", D_CE),
  R("110", "Demo Department Office (Computing)", "office", D_CS, undefined, "ئۆفیسی بەشی کۆمپیوتەر", "مكتب قسم الحاسوب"),
  R("111", "Demo Seminar Room 111", "classroom", D_CS, 25),
  R("112", "Demo Room 112", "classroom", D_CS, 40),
], false);
const eng2 = buildFloor("eng", ENG, "DEMO-ENG", 2, [
  R("201", "Demo Room 201", "classroom", D_CS, 40),
  R("202", "Demo Room 202", "classroom", D_CS, 40),
  R("203", "Demo Electronics Lab 203", "laboratory", D_CE, 24),
  R("204", "Demo Room 204", "classroom", D_CS, 50, "ژووری ٢٠٤", "غرفة 204"),
  R("205", "Demo Lecturer Office 205", "office", D_CE),
  R("206", "Demo Toilets 206", "toilet"),
  R("207", "Demo Lecture Hall 207", "lecture_hall", D_CE, 140),
  R("208", "Demo Lecturer Office 208", "office", D_CS),
  R("209", "Demo Study Room 209", "other", undefined, 30),
  R("210", "Demo Room 210", "classroom", D_CS, 40),
  R("211", "Demo Room 211", "classroom", D_CE, 40),
  R("212", "Demo Meeting Room 212", "other", undefined, 12),
], false);

// Science: ground, 1
const sciG = buildFloor("sci", SCI, "DEMO-SCI", 0, [
  R("S001", "Demo Physics Lab S001", "laboratory", D_PHY, 30, "تاقیگەی فیزیا", "مختبر الفيزياء"),
  R("S002", "Demo Physics Lab S002", "laboratory", D_PHY, 30),
  R("S003", "Demo Lecture Hall S003", "lecture_hall", D_PHY, 150),
  R("S004", "Demo Classroom S004", "classroom", D_PHY, 40),
  R("S005", "Demo Toilets S005", "toilet"),
  R("S006", "Demo Classroom S006", "classroom", D_PHY, 40),
  R("S007", "Demo Lecturer Office S007", "office", D_PHY),
  R("S008", "Demo Lecturer Office S008", "office", D_PHY),
  null,
  R("S010", "Demo Department Office (Physics)", "office", D_PHY),
  R("S011", "Demo Storage S011", "storage"),
  R("S012", "Demo Classroom S012", "classroom", D_PHY, 30),
], true);
const sci1 = buildFloor("sci", SCI, "DEMO-SCI", 1, [
  R("S101", "Demo Optics Lab S101", "laboratory", D_PHY, 20),
  R("S102", "Demo Classroom S102", "classroom", D_PHY, 40),
  R("S103", "Demo Classroom S103", "classroom", D_PHY, 40),
  R("S104", "Demo Lecturer Office S104", "office", D_PHY),
  R("S105", "Demo Toilets S105", "toilet"),
  R("S106", "Demo Seminar Room S106", "classroom", D_PHY, 20),
  null, null, null, null, null, null,
], false);

// Library: ground, 1 — its own building.
const libG = buildFloor("lib", LIB, "DEMO-LIB", 0, [
  R("L001", "Demo Main Reading Hall", "library", undefined, 200, "هۆڵی سەرەکیی خوێندنەوە", "قاعة المطالعة الرئيسية"),
  R("L002", "Demo Circulation Desk", "service", undefined, undefined, "مێزی خواستنی کتێب", "مكتب الإعارة"),
  R("L003", "Demo E-Library", "library", undefined, 60, "کتێبخانەی ئەلیکترۆنی", "المكتبة الإلكترونية"),
  R("L004", "Demo Group Study Room L004", "other", undefined, 10),
  R("L005", "Demo Toilets L005", "toilet", undefined, undefined, "ئاودەست", "دورات المياه"),
  R("L006", "Demo Group Study Room L006", "other", undefined, 10),
  R("L007", "Demo Periodicals Room", "library", undefined, 40, "ژووری گۆڤارەکان", "قاعة الدوريات"),
  R("L008", "Demo Prayer Room L008", "prayer_room", undefined, 15, "نوێژخانە", "مصلى"),
  null,
  R("L010", "Demo Librarian Office", "office"),
  R("L011", "Demo Book Store L011", "storage"),
  R("L012", "Demo Group Study Room L012", "other", undefined, 10),
], true);
const lib1 = buildFloor("lib", LIB, "DEMO-LIB", 1, [
  R("L101", "Demo Quiet Reading Room", "library", undefined, 120, "ژووری خوێندنەوەی بێدەنگ", "قاعة المطالعة الهادئة"),
  R("L102", "Demo Thesis Archive", "library", undefined, 20),
  R("L103", "Demo Study Room L103", "other", undefined, 12),
  R("L104", "Demo Study Room L104", "other", undefined, 12),
  R("L105", "Demo Toilets L105", "toilet"),
  null, null, null, null, null, null, null,
], false);

// Cafeteria: ground only — its own building.
const cafG = buildFloor("caf", CAF, "DEMO-CAF", 0, [
  R("C001", "Demo Main Cafeteria", "cafeteria", undefined, 250, "کافتریای سەرەکی", "الكافتيريا الرئيسية"),
  R("C002", "Demo Coffee Corner", "cafeteria", undefined, 40, "گۆشەی قاوە", "ركن القهوة"),
  R("C003", "Demo Food Court", "cafeteria", undefined, 120, "شوێنی خواردن", "ساحة الطعام"),
  R("C004", "Demo Toilets C004", "toilet", undefined, undefined, "ئاودەست", "دورات المياه"),
  R("C005", "Demo Prayer Room C005", "prayer_room", undefined, 25, "نوێژخانە", "مصلى"),
  R("C006", "Demo Kitchen Store", "storage"),
  null, null, null, null, null, null,
], true);

// Vertical connections. Stair lengths are demo configuration values, not measurements.
const STAIR_FLIGHT_M = 12;
for (const [a, b] of [[engG, eng1], [eng1, eng2], [sciG, sci1], [libG, lib1]] as const) {
  edge(a.stairs, b.stairs, "stairs", { distanceM: STAIR_FLIGHT_M, accessible: false });
  edge(a.lift, b.lift, "elevator", { distanceM: 0, accessible: true });
}

// Outdoor path between building entrances (demo value).
const engEntrance = nodes.find((n) => n.id === did(`${engG.floorId}-entrance`))!;
const sciEntrance = nodes.find((n) => n.id === did(`${sciG.floorId}-entrance`))!;
const libEntrance = nodes.find((n) => n.id === did(`${libG.floorId}-entrance`))!;
const cafEntrance = nodes.find((n) => n.id === did(`${cafG.floorId}-entrance`))!;
// Outdoor walkway network between building entrances. Demo lengths only — the
// demo buildings are not placed on the real map, so these edges carry no
// real-world geometry. Real campuses draw or import each walkway in the admin
// "Walkways" page and the length is measured along the real path.
edge(engEntrance, sciEntrance, "outdoor", { distanceM: 85, accessible: true });
edge(engEntrance, cafEntrance, "outdoor", { distanceM: 70, accessible: true });
edge(cafEntrance, sciEntrance, "outdoor", { distanceM: 110, accessible: true });
edge(engEntrance, libEntrance, "outdoor", { distanceM: 140, accessible: true });
// Short cut with steps: fastest on foot, skipped by step-free routes.
edge(sciEntrance, libEntrance, "outdoor", { distanceM: 60, accessible: false });

// Staff-only shortcut example (restricted edge) on ENG floor 1: from office 110 door straight to stairs.
const office110Door = nodes.find((n) => n.id === did(`${did("eng-room-110")}-door`))!;
edge(office110Door, eng1.stairs, "corridor", { restriction: "staff_only", distanceM: 4 });

export const demoFloors = floors;
export const demoRooms = rooms;
export const demoMapElements = elements;
export const demoNavNodes = nodes;
export const demoNavEdges = edges;

// ─── Checkpoints ───────────────────────────────────────────────────────────
// Tokens are fixed so printed demo QR sheets stay valid across reseeds.
export const demoCheckpoints: QrCheckpoint[] = [
  { id: did("cp-eng-main"), universityId: U, token: "DEMOengMainEntrance01", nodeId: engEntrance.id, label: T("Demo Engineering — main entrance", "دەرگای سەرەکیی ئەندازیاری", "مدخل الهندسة الرئيسي"), status: "active", expiresAt: null },
  { id: did("cp-eng-1-stairs"), universityId: U, token: "DEMOengFloor1Stairs01", nodeId: eng1.stairs.id, label: T("Demo Engineering — floor 1 stairs", "قادرمەی نهۆمی ١", "درج الطابق 1"), status: "active", expiresAt: null },
  { id: did("cp-eng-2-mid"), universityId: U, token: "DEMOengFloor2Middle01", nodeId: eng2.nodes[3]!.id, label: T("Demo Engineering — floor 2 corridor", "ڕاڕەوی نهۆمی ٢", "ممر الطابق 2"), status: "active", expiresAt: null },
  { id: did("cp-sci-main"), universityId: U, token: "DEMOsciMainEntrance01", nodeId: sciEntrance.id, label: T("Demo Science — main entrance", "دەرگای سەرەکیی زانست", "مدخل العلوم الرئيسي"), status: "active", expiresAt: null },
  { id: did("cp-lib-main"), universityId: U, token: "DEMOlibMainEntrance01", nodeId: libEntrance.id, label: T("Demo Library — main entrance", "دەرگای سەرەکیی کتێبخانە", "مدخل المكتبة الرئيسي"), status: "active", expiresAt: null },
  { id: did("cp-caf-main"), universityId: U, token: "DEMOcafMainEntrance01", nodeId: cafEntrance.id, label: T("Demo Cafeteria — main entrance", "دەرگای سەرەکیی کافتریا", "مدخل الكافتيريا الرئيسي"), status: "active", expiresAt: null },
  { id: did("cp-disabled"), universityId: U, token: "DEMOdisabledCheckpoint", nodeId: eng1.lift.id, label: T("Demo disabled checkpoint"), status: "disabled", expiresAt: null },
  { id: did("cp-expired"), universityId: U, token: "DEMOexpiredCheckpoint1", nodeId: eng1.lift.id, label: T("Demo expired checkpoint"), status: "active", expiresAt: "2025-01-01T00:00:00Z" },
];

// ─── Academic structure ────────────────────────────────────────────────────
export const demoDepartments: Department[] = [
  { id: D_CS, universityId: U, code: "DEMO-CS", name: T("Demo Department of Computing", "بەشی کۆمپیوتەری نموونە", "قسم الحاسوب التجريبي"), college: T("Demo College of Engineering", "کۆلێژی ئەندازیاریی نموونە", "كلية الهندسة التجريبية"), buildingId: ENG },
  { id: D_CE, universityId: U, code: "DEMO-CE", name: T("Demo Department of Civil Engineering", "بەشی ئەندازیاریی شارستانیی نموونە", "قسم الهندسة المدنية التجريبي"), college: T("Demo College of Engineering", "کۆلێژی ئەندازیاریی نموونە", "كلية الهندسة التجريبية"), buildingId: ENG },
  { id: D_PHY, universityId: U, code: "DEMO-PHY", name: T("Demo Department of Physics", "بەشی فیزیای نموونە", "قسم الفيزياء التجريبي"), college: T("Demo College of Science", "کۆلێژی زانستی نموونە", "كلية العلوم التجريبية"), buildingId: SCI },
];

const roomId = (b: "eng" | "sci", code: string) => did(`${b}-room-${code}`);
const L = (key: string, en: string, ckb: string, ar: string, dept: string, office: string | null, hours: [Weekday, string, string][], email?: string): Lecturer => ({
  id: did(`lect-${key}`),
  universityId: U,
  departmentId: dept,
  fullName: T(en, ckb, ar),
  title: T("Demo Lecturer", "مامۆستای نموونە", "محاضر تجريبي"),
  officeRoomId: office,
  officeHours: hours.map(([day, start, end]) => ({ day, start, end })),
  publicEmail: email ?? null,
  photoUrl: null,
  availability: null,
  dataStatus: "demo",
});

export const demoLecturers: Lecturer[] = [
  L("a", "Demo Lecturer A", "مامۆستای نموونە A", "المحاضر التجريبي A", D_CS, roomId("eng", "105"), [[0, "10:00", "12:00"], [2, "10:00", "12:00"]], "lecturer.a@demo.invalid"),
  L("b", "Demo Lecturer B", "مامۆستای نموونە B", "المحاضر التجريبي B", D_CS, roomId("eng", "108"), [[1, "09:00", "11:00"]]),
  L("c", "Demo Lecturer C", "مامۆستای نموونە C", "المحاضر التجريبي C", D_CE, roomId("eng", "205"), [[3, "12:00", "14:00"]], "lecturer.c@demo.invalid"),
  L("d", "Demo Lecturer D", "مامۆستای نموونە D", "المحاضر التجريبي D", D_PHY, roomId("sci", "S007"), [[0, "13:00", "14:30"], [4, "09:00", "10:30"]]),
  L("e", "Demo Lecturer E", "مامۆستای نموونە E", "المحاضر التجريبي E", D_CE, roomId("eng", "109"), []),
  L("f", "Demo Lecturer F", "مامۆستای نموونە F", "المحاضر التجريبي F", D_PHY, roomId("sci", "S104"), [[2, "11:00", "12:30"]]),
];

const C = (code: string, en: string, dept: string, ckb?: string, ar?: string, credits = 3): Course => ({
  id: did(`course-${code}`),
  universityId: U,
  departmentId: dept,
  code,
  name: T(en, ckb, ar),
  description: T("Demonstration course."),
  credits,
});
export const demoCourses: Course[] = [
  C("DEMO-CS101", "Demo Introduction to Programming", D_CS, "ناساندنی پرۆگرامسازی", "مقدمة في البرمجة"),
  C("DEMO-CS201", "Demo Data Structures", D_CS, "پێکهاتەی داتا", "هياكل البيانات"),
  C("DEMO-CS210", "Demo Databases", D_CS, "بنکەی زانیاری", "قواعد البيانات"),
  C("DEMO-CE110", "Demo Statics", D_CE, "ستاتیک", "الستاتيك"),
  C("DEMO-CE220", "Demo Surveying", D_CE, "ڕووپێوی", "المساحة"),
  C("DEMO-PHY101", "Demo Physics I", D_PHY, "فیزیا ١", "الفيزياء 1", 4),
];

const G = (code: string, en: string, dept: string, stage: number): StudentGroup => ({
  id: did(`group-${code}`),
  universityId: U,
  departmentId: dept,
  code,
  name: T(en),
  academicYear: "2026-2027",
  stage,
});
export const demoGroups: StudentGroup[] = [
  G("DEMO-CS-Y1-A", "Demo Computing — Stage 1, Group A", D_CS, 1),
  G("DEMO-CS-Y2-A", "Demo Computing — Stage 2, Group A", D_CS, 2),
  G("DEMO-CE-Y1-A", "Demo Civil — Stage 1, Group A", D_CE, 1),
  G("DEMO-PHY-Y1-A", "Demo Physics — Stage 1, Group A", D_PHY, 1),
];

const SEM = did("sem-2026-fall");
export const demoSemesters: Semester[] = [
  { id: SEM, universityId: U, academicYear: "2026-2027", name: T("Demo Fall Semester 2026", "وەرزی پاییزی ٢٠٢٦", "الفصل الخريفي 2026"), startDate: "2026-09-20", endDate: "2027-01-21" },
];

let ttCounter = 0;
const TT = (course: string, group: string, lect: string, room: string, day: Weekday, start: string, end: string, kind: TimetableEntry["kind"] = "lecture"): TimetableEntry => ({
  id: did(`tt-${ttCounter++}`),
  universityId: U,
  semesterId: SEM,
  courseId: did(`course-${course}`),
  lecturerId: did(`lect-${lect}`),
  roomId: room,
  groupId: did(`group-${group}`),
  kind,
  recurrence: "weekly",
  day,
  startTime: start,
  endTime: end,
  validFrom: "2026-09-20",
  validTo: "2027-01-21",
  status: "scheduled",
});

export const demoTimetable: TimetableEntry[] = [
  // Computing stage 1 — Sunday–Thursday
  TT("DEMO-CS101", "DEMO-CS-Y1-A", "a", roomId("eng", "204"), 0, "08:30", "10:00"),
  TT("DEMO-PHY101", "DEMO-CS-Y1-A", "d", roomId("sci", "S003"), 0, "10:30", "12:00"),
  TT("DEMO-CS101", "DEMO-CS-Y1-A", "a", roomId("eng", "103"), 1, "08:30", "10:30", "lab"),
  TT("DEMO-CE110", "DEMO-CS-Y1-A", "c", roomId("eng", "207"), 1, "11:00", "12:30"),
  TT("DEMO-CS101", "DEMO-CS-Y1-A", "a", roomId("eng", "204"), 2, "08:30", "10:00"),
  TT("DEMO-PHY101", "DEMO-CS-Y1-A", "f", roomId("sci", "S001"), 3, "09:00", "11:00", "lab"),
  TT("DEMO-CS101", "DEMO-CS-Y1-A", "b", roomId("eng", "111"), 4, "10:00", "11:30", "tutorial"),
  // Computing stage 2
  TT("DEMO-CS201", "DEMO-CS-Y2-A", "b", roomId("eng", "107"), 0, "10:30", "12:00"),
  TT("DEMO-CS210", "DEMO-CS-Y2-A", "a", roomId("eng", "201"), 1, "12:30", "14:00"),
  TT("DEMO-CS201", "DEMO-CS-Y2-A", "b", roomId("eng", "104"), 3, "08:30", "10:30", "lab"),
  // Civil stage 1
  TT("DEMO-CE110", "DEMO-CE-Y1-A", "c", roomId("eng", "G01"), 0, "08:30", "10:00"),
  TT("DEMO-CE220", "DEMO-CE-Y1-A", "e", roomId("eng", "G07"), 2, "10:30", "12:30", "lab"),
  // Physics stage 1
  TT("DEMO-PHY101", "DEMO-PHY-Y1-A", "d", roomId("sci", "S003"), 1, "08:30", "10:00"),
  TT("DEMO-PHY101", "DEMO-PHY-Y1-A", "f", roomId("sci", "S101"), 4, "08:30", "10:30", "lab"),
];

export const demoScheduleChanges: ScheduleChange[] = [
  {
    id: did("chg-1"),
    universityId: U,
    entryId: demoTimetable[0]!.id,
    date: "2026-11-08",
    type: "room_change",
    newRoomId: roomId("eng", "210"),
    note: T("Demo change: moved to Room 210 for this week.", "گۆڕانکاریی نموونە: بۆ ژووری ٢١٠ گوازرایەوە", "تغيير تجريبي: نُقلت إلى الغرفة 210"),
  },
  {
    id: did("chg-2"),
    universityId: U,
    entryId: demoTimetable[3]!.id,
    date: "2026-11-09",
    type: "cancelled",
    note: T("Demo change: lecture cancelled.", "گۆڕانکاریی نموونە: وانە هەڵوەشێنرایەوە", "تغيير تجريبي: أُلغيت المحاضرة"),
  },
];

export const demoAnnouncements: Announcement[] = [
  {
    id: did("ann-demo"),
    universityId: U,
    title: T("This is a demonstration environment", "ئەمە ژینگەیەکی نموونەییە", "هذه بيئة تجريبية"),
    body: T(
      "All buildings, rooms, lecturers and timetables shown for Demo University are fictional and exist only to demonstrate CAMPUS NAV.",
      "هەموو بیناکان، ژوورەکان، مامۆستایان و خشتەکان خەیاڵین و تەنها بۆ نیشاندانی CAMPUS NAV ن.",
      "جميع المباني والقاعات والمحاضرين والجداول وهمية وموجودة فقط لعرض CAMPUS NAV.",
    ),
    publishedAt: "2026-09-01T08:00:00Z",
    expiresAt: null,
    priority: "important",
  },
  {
    id: did("ann-room-change"),
    universityId: U,
    title: T("Demo notice: Room 204 lecture moved on 8 Nov", "ئاگاداری: وانەی ژووری ٢٠٤ گوازرایەوە", "إشعار: نقل محاضرة الغرفة 204"),
    body: T("Demo Introduction to Programming (Stage 1, Group A) meets in Room 210 on 8 November 2026."),
    publishedAt: "2026-11-01T08:00:00Z",
    expiresAt: "2026-11-09T00:00:00Z",
    priority: "normal",
  },
];

/** Demo closure: the Science stairs (ground ↔ floor 1) close for repainting, starting 2 days after `now`. */
export function demoClosures(now = new Date()): Closure[] {
  const day = 86_400_000;
  return [
    {
      id: did("closure-sci-stairs"),
      universityId: U,
      targetType: "edge",
      targetId: did(`edge:${sciG.stairs.id}:${sci1.stairs.id}`),
      reason: T("Demo: Science stairs closed for repainting — use the elevator", "نموونە: قادرمەی زانست بۆ بۆیەکردن داخراوە — مەسعەد بەکاربهێنە", "تجريبي: درج العلوم مغلق للطلاء — استخدم المصعد"),
      startsAt: new Date(now.getTime() + 2 * day).toISOString(),
      endsAt: new Date(now.getTime() + 9 * day).toISOString(),
    },
  ];
}

export function demoBundle(now = new Date()): CampusBundle {
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    source: "demo",
    university: demoUniversity,
    campuses: demoCampuses,
    buildings: demoBuildings,
    floors: demoFloors,
    rooms: demoRooms,
    mapElements: demoMapElements,
    navNodes: demoNavNodes,
    navEdges: demoNavEdges,
    checkpoints: demoCheckpoints.map(({ id, nodeId, label }) => ({ id, nodeId, label })),
    departments: demoDepartments,
    lecturers: demoLecturers,
    courses: demoCourses,
    groups: demoGroups,
    semesters: demoSemesters,
    timetable: demoTimetable,
    scheduleChanges: demoScheduleChanges,
    announcements: demoAnnouncements,
    closures: demoClosures(now),
  };
}

// ─── Second fictional tenant (used to test isolation) ─────────────────────
export const OTHER_UNIVERSITY_ID = did("other-demo-university");
export const otherUniversity: University = {
  ...demoUniversity,
  id: OTHER_UNIVERSITY_ID,
  slug: "demo-two",
  name: T("Second Demo University", "زانکۆی نموونەی دووەم", "الجامعة التجريبية الثانية"),
  shortName: "DEMO2",
  published: false,
};
