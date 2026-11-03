/**
 * Minimal 3D viewer on plain three.js (no React renderer): one WebGL canvas,
 * orbit camera, picking, DOM labels with collision avoidance and on-demand
 * rendering (frames are drawn only when something changes — good for battery).
 *
 * The viewer knows nothing about campuses or routing: scene builders
 * (./campus.ts, ./building.ts) turn CampusBundle data into a SceneContent.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface LabelSpec {
  id: string;
  text: string;
  sub?: string;
  position: THREE.Vector3;
  /** Higher wins when labels collide. */
  priority: number;
  tone?: "default" | "accent" | "muted" | "warn";
}

export interface PickData {
  kind: "building" | "room" | "floor";
  id: string;
}

export interface SceneContent {
  root: THREE.Object3D;
  pickables: THREE.Object3D[];
  labels: LabelSpec[];
  /** Default framing for "overview". */
  bounds: THREE.Box3;
  /** Route points in walking order (building scenes with a route). */
  routePath?: THREE.Vector3[];
  /** Called when the viewer is done with this content. */
  dispose?: () => void;
}

export { webglAvailable } from "./support";

export function cssColor(name: string, fallback: string): THREE.Color {
  const v = typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : "";
  try {
    return new THREE.Color(v || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private content: SceneContent | null = null;
  private labelLayer: HTMLDivElement;
  private labelEls = new Map<string, HTMLDivElement>();
  private raf = 0;
  private anim: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t0: number; ms: number } | null = null;
  private resizeObs: ResizeObserver;
  private down: { x: number; y: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private insets = { start: 0, bottom: 0, rtl: false };
  private walk: { pts: THREE.Vector3[]; cum: number[]; total: number; t0: number; ms: number; dot: THREE.Mesh; halo: THREE.Mesh; onEnd: () => void } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly opts: { onPick: (p: PickData | null) => void; reducedMotion: boolean; onContextLost?: () => void },
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      opts.onContextLost?.();
    });

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    this.camera.position.set(60, 70, 90);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !opts.reducedMotion;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.47; // never go under the ground
    this.controls.minDistance = 4;
    this.controls.maxDistance = 900;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener("change", () => this.requestRender());

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-60, 120, 40); // no real-time shadows: cheaper and cleaner
    this.scene.add(sun);

    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "cn3d-labels";
    container.appendChild(this.labelLayer);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", (e) => {
      this.down = { x: e.clientX, y: e.clientY };
      if (this.walk) this.stopPath(); // the user takes the camera back
    });
    el.addEventListener("pointerup", (e) => {
      if (!this.down || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return;
      this.down = null;
      this.opts.onPick(this.pick(e.clientX, e.clientY));
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.applyInsets();
    this.requestRender();
  }

  /**
   * Keep the model centred in the part of the map not covered by the side panel
   * (desktop) or bottom sheet (phone) by shifting the projection window.
   */
  setInsets(start: number, bottom: number, rtl: boolean) {
    this.insets = { start, bottom, rtl };
    this.applyInsets();
    this.requestRender();
  }

  private applyInsets() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const { start, bottom, rtl } = this.insets;
    if (start || bottom) this.camera.setViewOffset(w, h, (rtl ? 1 : -1) * (start / 2), bottom / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private pick(cx: number, cy: number): PickData | null {
    if (!this.content) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.content.pickables, false).filter((h) => h.object.visible);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.pick) o = o.parent;
      if (o) return o.userData.pick as PickData;
    }
    return null;
  }

  setContent(content: SceneContent, frame: "keep" | "fit" = "fit") {
    if (this.content) {
      this.scene.remove(this.content.root);
      disposeTree(this.content.root);
      this.content.dispose?.();
    }
    this.content = content;
    this.scene.add(content.root);
    this.syncLabels();
    if (frame === "fit") this.focus(content.bounds, { instant: true });
    this.requestRender();
  }

  /** Move the camera to frame a box (animated unless reduced motion). */
  focus(box: THREE.Box3, o: { instant?: boolean; tilt?: number } = {}) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, size.y * 1.5, 6) * 0.75;
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = radius / Math.sin(fov / 2) / Math.max(0.6, Math.min(1, this.camera.aspect));
    const tilt = o.tilt ?? 0.95; // radians from vertical
    const azimuth = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z) || Math.PI / 4;
    const pos = new THREE.Vector3(center.x + dist * Math.sin(tilt) * Math.sin(azimuth), center.y + dist * Math.cos(tilt), center.z + dist * Math.sin(tilt) * Math.cos(azimuth));
    if (o.instant || this.opts.reducedMotion) {
      this.controls.target.copy(center);
      this.camera.position.copy(pos);
      this.controls.update();
      this.requestRender();
      return;
    }
    this.anim = { from: [this.camera.position.clone(), this.controls.target.clone()], to: [pos, center], t0: performance.now(), ms: 450 };
    this.requestRender();
  }

  /**
   * Fly-through: a walker moves along the route at a steady pace while the
   * camera glides after it, keeping the user's chosen angle. Duration scales
   * with route length (5–16 s) so long routes don't crawl or short ones flash.
   */
  playPath(points: THREE.Vector3[], onEnd: () => void) {
    this.stopPath();
    if (points.length < 2) return onEnd();
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
    const total = cum.at(-1)!;
    if (!total) return onEnd();
    const color = cssColor("--cn-accent", "#1D4ED8");
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), new THREE.MeshBasicMaterial({ color }));
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.5, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    dot.add(halo);
    dot.position.copy(points[0]!);
    this.scene.add(dot);
    this.anim = null;
    this.walk = { pts: points, cum, total, t0: performance.now(), ms: THREE.MathUtils.clamp(total * 90, 5000, 16000), dot, halo, onEnd };
    this.requestRender();
  }

  stopPath() {
    const w = this.walk;
    if (!w) return;
    this.walk = null;
    this.scene.remove(w.dot);
    w.dot.geometry.dispose();
    (w.dot.material as THREE.Material).dispose();
    w.halo.geometry.dispose();
    (w.halo.material as THREE.Material).dispose();
    w.onEnd();
    this.requestRender();
  }

  get playing() {
    return !!this.walk;
  }

  private stepWalk(now: number): boolean {
    const w = this.walk!;
    const k = Math.min(1, (now - w.t0) / w.ms);
    const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const d = ease * w.total;
    let i = 1;
    while (i < w.cum.length - 1 && w.cum[i]! < d) i++;
    const seg = w.cum[i]! - w.cum[i - 1]! || 1;
    const p = new THREE.Vector3().lerpVectors(w.pts[i - 1]!, w.pts[i]!, (d - w.cum[i - 1]!) / seg);
    w.dot.position.copy(p).add(new THREE.Vector3(0, 0.8, 0));
    const pulse = 1 + 0.25 * Math.sin(now / 160);
    w.halo.scale.set(pulse, pulse, pulse);
    // Glide the camera: move target toward the walker and carry the camera with it.
    const delta = p.clone().sub(this.controls.target).multiplyScalar(0.08);
    this.controls.target.add(delta);
    this.camera.position.add(delta);
    // Ease in to a walking-scale view (keeps the user's angle).
    const off = this.camera.position.clone().sub(this.controls.target);
    const want = THREE.MathUtils.clamp(off.length(), 22, 38);
    off.setLength(off.length() + (want - off.length()) * 0.05);
    this.camera.position.copy(this.controls.target).add(off);
    if (k >= 1) {
      this.stopPath();
      return false;
    }
    return true;
  }

  zoom(factor: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target.clone().add(dir.setLength(len)));
    this.controls.update();
    this.requestRender();
  }

  rotate(radians: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), radians);
    this.camera.position.copy(this.controls.target.clone().add(off));
    this.controls.update();
    this.requestRender();
  }

  requestRender() {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.frame();
    });
  }

  private frame() {
    let more = false;
    if (this.anim) {
      const k = Math.min(1, (performance.now() - this.anim.t0) / this.anim.ms);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera.position.lerpVectors(this.anim.from[0], this.anim.to[0], e);
      this.controls.target.lerpVectors(this.anim.from[1], this.anim.to[1], e);
      if (k >= 1) this.anim = null;
      else more = true;
    }
    if (this.walk && this.stepWalk(performance.now())) more = true;
    if (this.controls.update()) more = true; // damping still moving
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
    if (more) this.requestRender();
  }

  private syncLabels() {
    const specs = this.content?.labels ?? [];
    const keep = new Set(specs.map((s) => s.id));
    for (const [id, el] of this.labelEls) if (!keep.has(id)) (el.remove(), this.labelEls.delete(id));
    for (const s of specs) {
      let el = this.labelEls.get(s.id);
      if (!el) {
        el = document.createElement("div");
        this.labelLayer.appendChild(el);
        this.labelEls.set(s.id, el);
      }
      el.className = `cn3d-label cn3d-label-${s.tone ?? "default"}`;
      el.textContent = "";
      const strong = document.createElement("span");
      strong.textContent = s.text;
      el.appendChild(strong);
      if (s.sub) {
        const sub = document.createElement("small");
        sub.textContent = s.sub;
        el.appendChild(sub);
      }
    }
  }

  /** Project labels and hide the ones that would overlap a higher-priority label. */
  private placeLabels() {
    const specs = [...(this.content?.labels ?? [])].sort((a, b) => b.priority - a.priority);
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const placed: DOMRect[] = [];
    const v = new THREE.Vector3();
    for (const s of specs) {
      const el = this.labelEls.get(s.id);
      if (!el) continue;
      v.copy(s.position).project(this.camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      const off = v.z > 1 || x < -40 || x > w + 40 || y < -20 || y > h + 20;
      if (off) {
        el.style.visibility = "hidden";
        continue;
      }
      const bw = el.offsetWidth || 60;
      const bh = el.offsetHeight || 20;
      const r = new DOMRect(x - bw / 2, y - bh, bw, bh);
      const hit = placed.some((p) => !(r.right < p.left || r.left > p.right || r.bottom < p.top || r.top > p.bottom));
      el.style.visibility = hit ? "hidden" : "visible";
      el.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
      if (!hit) placed.push(r);
    }
  }

  dispose() {
    this.walk = null;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    if (this.content) {
      disposeTree(this.content.root);
      this.content.dispose?.();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
  }
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
