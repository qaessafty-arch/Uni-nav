/**
 * Scene builders: CampusBundle data → three.js objects. Geometry is generated
 * only from stored map data (campus footprints, floor map elements, navigation
 * nodes). Heights are schematic (a fixed height per floor) — the UI says so.
 */
import * as THREE from "three";
import { lt, type CampusBundle, type Floor, type Locale, type MapElement, type NavNode, type Route } from "@campusnav/core";
import { cssColor, type LabelSpec, type SceneContent } from "./viewer";

const CAMPUS_SCALE = 0.1; // campus overview units → scene units
const CAMPUS_FLOOR_H = 3.2; // schematic storey height on the campus model

function palette() {
  return {
    ground: cssColor("--cn-map-bg", "#121518"),
    building: cssColor("--cn-surface-raised", "#16191c"),
    edge: cssColor("--cn-border-strong", "#353b42"),
    accent: cssColor("--cn-accent", "#b7ff35"),
    text: cssColor("--cn-text", "#ededE8"),
    room: cssColor("--cn-map-room", "#1e2328"),
    corridor: cssColor("--cn-map-corridor", "#171b1f"),
    stairs: cssColor("--cn-map-stairs", "#2a2f24"),
    elevator: cssColor("--cn-map-elevator", "#24292f"),
    toilet: cssColor("--cn-map-toilet", "#1f2630"),
    danger: cssColor("--cn-danger", "#ff5a5a"),
    info: cssColor("--cn-info", "#6cb4ff"),
    warn: cssColor("--cn-warning", "#ffb547"),
  };
}

function std(color: THREE.Color, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o });
}

function edges(geo: THREE.BufferGeometry, color: THREE.Color, opacity = 1) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

// ─── Campus ───────────────────────────────────────────────────────────────
export interface CampusSceneOptions {
  campusId: string;
  selectedBuildingId: string | null;
  locale: Locale;
  onAsset?: () => void;
}

export function buildCampus(bundle: CampusBundle, o: CampusSceneOptions): SceneContent & { buildingBoxes: Map<string, THREE.Box3> } {
  const c = palette();
  const campus = bundle.campuses.find((x) => x.id === o.campusId) ?? bundle.campuses[0]!;
  const W = (campus.overviewWidth ?? 1000) * CAMPUS_SCALE;
  const H = (campus.overviewHeight ?? 700) * CAMPUS_SCALE;
  const root = new THREE.Group();
  root.position.set(-W / 2, 0, -H / 2);

  const groundMat = std(c.ground.clone().offsetHSL(0, 0, 0.03));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, 0, H / 2);
  root.add(ground);
  if (campus.overviewImageUrl) {
    new THREE.TextureLoader().load(campus.overviewImageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      groundMat.map = tex;
      groundMat.color.set(0xffffff);
      groundMat.needsUpdate = true;
      o.onAsset?.();
    });
  }
  const border = edges(new THREE.BoxGeometry(W, 0.01, H), c.edge, 0.8);
  border.position.set(W / 2, 0, H / 2);
  root.add(border);

  const pickables: THREE.Object3D[] = [];
  const labels: LabelSpec[] = [];
  const buildingBoxes = new Map<string, THREE.Box3>();
  const buildings = bundle.buildings.filter((b) => b.campusId === campus.id && b.overview);
  const bodyMat = std(c.building);
  const selMat = std(c.accent, { emissive: c.accent, emissiveIntensity: 0.25 });
  for (const b of buildings) {
    const r = b.overview!;
    const floors = bundle.floors.filter((f) => f.buildingId === b.id).length;
    const storeys = Math.max(1, floors);
    const h = storeys * CAMPUS_FLOOR_H;
    const w = r.w * CAMPUS_SCALE;
    const d = r.h * CAMPUS_SCALE;
    const selected = b.id === o.selectedBuildingId;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, selected ? selMat : bodyMat);
    const g = new THREE.Group();
    g.position.set(r.x * CAMPUS_SCALE + w / 2, h / 2, r.y * CAMPUS_SCALE + d / 2);
    g.userData.pick = { kind: "building", id: b.id };
    g.add(mesh);
    g.add(edges(geo, selected ? c.accent : c.edge));
    // storey lines — architectural read of the building height
    for (let i = 1; i < storeys; i++) {
      const line = edges(new THREE.BoxGeometry(w, 0.001, d), c.edge, 0.55);
      line.position.y = -h / 2 + i * CAMPUS_FLOOR_H;
      g.add(line);
    }
    root.add(g);
    pickables.push(mesh);
    const box = new THREE.Box3().setFromObject(g);
    box.translate(root.position);
    buildingBoxes.set(b.id, box);
    labels.push({
      id: `b-${b.id}`,
      text: b.code,
      sub: lt(b.name, o.locale),
      position: new THREE.Vector3(r.x * CAMPUS_SCALE + w / 2 - W / 2, h + 1.2, r.y * CAMPUS_SCALE + d / 2 - H / 2),
      priority: selected ? 100 : 10,
      tone: selected ? "accent" : "default",
    });
  }
  const bounds = new THREE.Box3(new THREE.Vector3(-W / 2, 0, -H / 2), new THREE.Vector3(W / 2, 8, H / 2));
  return { root, pickables, labels, bounds, buildingBoxes };
}

// ─── Building ─────────────────────────────────────────────────────────────
export interface BuildingSceneOptions {
  buildingId: string;
  /** null = whole building */
  floorId: string | null;
  exploded: boolean;
  hideOtherFloors: boolean;
  selectedRoomId: string | null;
  route: Route | null;
  startNodeId: string | null;
  destinationNodeId: string | null;
  locale: Locale;
  floorLabel: (f: Floor) => string;
}

const ROOM_H = 1.4; // cutaway wall height: rooms read as open boxes from above
const TALL_H = 2.8;

function shapeOf(el: MapElement, mpu: number, ox: number, oz: number): THREE.Shape {
  const pts: [number, number][] =
    el.shape.type === "rect"
      ? [
          [el.shape.x, el.shape.y],
          [el.shape.x + el.shape.w, el.shape.y],
          [el.shape.x + el.shape.w, el.shape.y + el.shape.h],
          [el.shape.x, el.shape.y + el.shape.h],
        ]
      : el.shape.points;
  // Shape lives in XY; after rotateX(-90°) shape (x, -z) becomes world (x, ·, z).
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * mpu - ox, -(y * mpu - oz))));
}

export function buildBuilding(bundle: CampusBundle, o: BuildingSceneOptions): SceneContent & { floorBoxes: Map<string, THREE.Box3>; floorsWithPlan: Set<string>; routePath: THREE.Vector3[] } {
  const c = palette();
  const floors = bundle.floors.filter((f) => f.buildingId === o.buildingId).sort((a, b) => a.level - b.level);
  const root = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const labels: LabelSpec[] = [];
  const floorBoxes = new Map<string, THREE.Box3>();
  /** Every in-building route point in walking order, for the fly-through. */
  const routePath: THREE.Vector3[] = [];
  const floorsWithPlan = new Set<string>();
  const gap = o.exploded ? 10 : 4.2;
  const ref = floors[0];
  const ox = ref ? (ref.width * ref.metersPerUnit) / 2 : 0;
  const oz = ref ? (ref.height * ref.metersPerUnit) / 2 : 0;
  const elevation = new Map(floors.map((f, i) => [f.id, i * gap]));

  const mats = {
    slab: std(c.ground.clone().offsetHSL(0, 0, 0.04)),
    room: std(c.room.clone().offsetHSL(0, 0, 0.07)),
    roomSel: std(c.accent, { emissive: c.accent, emissiveIntensity: 0.3 }),
    corridor: std(c.corridor.clone().offsetHSL(0, 0, 0.05)),
    stairs: std(c.warn.clone().lerp(c.stairs, 0.55)),
    elevator: std(c.info.clone().lerp(c.elevator, 0.5)),
    toilet: std(c.toilet),
    entrance: std(c.accent.clone().lerp(c.room, 0.6)),
    exit: std(c.danger.clone().lerp(c.room, 0.55)),
    wall: std(c.edge),
  };
  const faded = new Map<THREE.Material, THREE.Material>();
  const fade = (m: THREE.Material) => {
    let f = faded.get(m);
    if (!f) {
      f = (m as THREE.MeshStandardMaterial).clone();
      f.transparent = true;
      f.opacity = 0.14;
      f.depthWrite = false;
      faded.set(m, f);
    }
    return f;
  };

  for (const f of floors) {
    const focused = !o.floorId || o.floorId === f.id;
    if (!focused && o.hideOtherFloors) continue;
    const y0 = elevation.get(f.id)!;
    const mpu = f.metersPerUnit;
    const fw = f.width * mpu;
    const fd = f.height * mpu;
    const g = new THREE.Group();
    g.position.y = y0;
    const slabGeo = new THREE.BoxGeometry(fw, 0.18, fd);
    const slab = new THREE.Mesh(slabGeo, focused ? mats.slab : fade(mats.slab));
    slab.position.set(fw / 2 - ox, -0.09, fd / 2 - oz);
    slab.userData.pick = { kind: "floor", id: f.id };
    g.add(slab);
    const slabEdges = edges(slabGeo, c.edge, focused ? 1 : 0.25);
    slabEdges.position.copy(slab.position);
    g.add(slabEdges);
    pickables.push(slab);

    const els = bundle.mapElements.filter((e) => e.floorId === f.id);
    if (els.length) floorsWithPlan.add(f.id);
    for (const el of els) {
      if (el.kind === "outdoor" || el.kind === "building") continue;
      const kind = el.kind;
      const room = el.roomId ? bundle.rooms.find((r) => r.id === el.roomId) : undefined;
      const height = kind === "corridor" ? 0.05 : kind === "stairs" || kind === "elevator" || kind === "wall" ? TALL_H : kind === "entrance" || kind === "emergency_exit" ? 0.3 : ROOM_H;
      let mat: THREE.Material =
        kind === "corridor" ? mats.corridor : kind === "stairs" ? mats.stairs : kind === "elevator" ? mats.elevator : kind === "toilet" ? mats.toilet : kind === "entrance" ? mats.entrance : kind === "emergency_exit" ? mats.exit : kind === "wall" ? mats.wall : mats.room;
      const selected = !!room && room.id === o.selectedRoomId;
      if (selected) mat = mats.roomSel;
      if (!focused) mat = fade(mat);
      const geo = new THREE.ExtrudeGeometry(shapeOf(el, mpu, ox, oz), { depth: height, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      if (room) mesh.userData.pick = { kind: "room", id: room.id };
      g.add(mesh);
      if (focused && kind !== "corridor") g.add(edges(geo, selected ? c.accent : c.edge, 0.9));
      if (room) pickables.push(mesh);
      if (room && focused && (o.floorId || selected)) {
        const bb = new THREE.Box3().setFromBufferAttribute(geo.getAttribute("position") as THREE.BufferAttribute);
        const ctr = bb.getCenter(new THREE.Vector3());
        labels.push({ id: `r-${room.id}`, text: room.code, sub: selected ? lt(room.name, o.locale) : undefined, position: new THREE.Vector3(ctr.x, y0 + height + 0.4, ctr.z), priority: selected ? 100 : 5, tone: selected ? "accent" : "default" });
      }
    }
    root.add(g);
    const fb = new THREE.Box3(new THREE.Vector3(-ox, y0, -oz), new THREE.Vector3(fw - ox, y0 + TALL_H, fd - oz));
    floorBoxes.set(f.id, fb);
    labels.push({ id: `f-${f.id}`, text: o.floorLabel(f), position: new THREE.Vector3(-ox - 1.5, y0 + 0.4, -oz), priority: focused ? 60 : 20, tone: focused ? (o.floorId === f.id ? "accent" : "default") : "muted" });
  }

  // Route from the navigation engine — the polyline goes through the exact graph nodes.
  if (o.route) {
    const nodeY = (n: NavNode) => (elevation.get(n.floorId) ?? 0) + 0.5;
    const toV = (n: NavNode) => {
      const f = floors.find((x) => x.id === n.floorId)!;
      return new THREE.Vector3(n.x * f.metersPerUnit - ox, nodeY(n), n.y * f.metersPerUnit - oz);
    };
    const inBuilding = (n: NavNode) => elevation.has(n.floorId) && (!o.hideOtherFloors || !o.floorId || n.floorId === o.floorId);
    const routeMat = new THREE.MeshBasicMaterial({ color: c.accent });
    let run: THREE.Vector3[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const path = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 1; i < run.length; i++) path.add(new THREE.LineCurve3(run[i - 1]!, run[i]!));
        root.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, run.length * 6), 0.28, 6, false), routeMat));
      }
      run = [];
    };
    for (const n of o.route.nodes) {
      if (inBuilding(n)) {
        run.push(toV(n));
        routePath.push(toV(n));
      } else flush();
    }
    flush();
    const marker = (n: NavNode | undefined, color: THREE.Color, cone: boolean) => {
      if (!n || !inBuilding(n)) return;
      const m = new THREE.Mesh(cone ? new THREE.ConeGeometry(0.7, 1.8, 16) : new THREE.SphereGeometry(0.65, 16, 12), new THREE.MeshBasicMaterial({ color }));
      const p = toV(n);
      m.position.set(p.x, p.y + (cone ? 1.4 : 0.4), p.z);
      if (cone) m.rotation.x = Math.PI;
      root.add(m);
    };
    marker(o.route.nodes[0], c.info, false);
    marker(o.route.nodes.at(-1), c.accent, true);
  } else {
    const nodes = new Map(bundle.navNodes.map((n) => [n.id, n]));
    for (const [id, color, cone] of [
      [o.startNodeId, c.info, false],
      [o.destinationNodeId, c.accent, true],
    ] as const) {
      const n = id ? nodes.get(id) : undefined;
      const f = n ? floors.find((x) => x.id === n.floorId) : undefined;
      if (!n || !f || (o.hideOtherFloors && o.floorId && n.floorId !== o.floorId)) continue;
      const m = new THREE.Mesh(cone ? new THREE.ConeGeometry(0.7, 1.8, 16) : new THREE.SphereGeometry(0.65, 16, 12), new THREE.MeshBasicMaterial({ color }));
      m.position.set(n.x * f.metersPerUnit - ox, elevation.get(f.id)! + (cone ? 1.9 : 0.9), n.y * f.metersPerUnit - oz);
      if (cone) m.rotation.x = Math.PI;
      root.add(m);
    }
  }

  // QR checkpoints on visible floors
  const cpMat = new THREE.MeshBasicMaterial({ color: c.info });
  for (const cp of bundle.checkpoints) {
    const n = bundle.navNodes.find((x) => x.id === cp.nodeId);
    const f = n ? floors.find((x) => x.id === n.floorId) : undefined;
    if (!n || !f || (o.floorId && f.id !== o.floorId)) continue;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), cpMat);
    m.position.set(n.x * f.metersPerUnit - ox, elevation.get(f.id)! + 0.6, n.y * f.metersPerUnit - oz);
    root.add(m);
  }

  const bounds = new THREE.Box3();
  for (const b of floorBoxes.values()) bounds.union(b);
  if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
  return { root, pickables, labels, bounds, floorBoxes, floorsWithPlan, routePath, dispose: () => faded.forEach((m) => m.dispose()) };
}
