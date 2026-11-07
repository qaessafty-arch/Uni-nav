import type { Announcement, CampusBundle, CourseMaterial } from "@campusnav/core";
import { MATERIAL_TYPES, materialProblem, type ClassTools, type MaterialInput } from "../types";
import { DEMO_UNIVERSITY_ID, did } from "./dataset";
import type { SyncKV } from "./student";

const KEY = "campusnav.demo.classes.v1";
/** Demo files are kept on this device only, as data URLs, so they must stay small. */
export const DEMO_FILE_LIMIT = 1_500_000;

interface Stored {
  materials: (CourseMaterial & { dataUrl?: string })[];
  announcements: Announcement[];
}

/** The fictional class rep: the demo Computing year-1 student represents group A. */
export const DEMO_REP_EMAIL = "cs1@students.demo.example";
export const DEMO_REP_GROUP = did("group-DEMO-CS-Y1-A");
export const DEMO_USER_ID = "demo-student";

/** Fictional starter materials so the course pages are not empty in demo mode. */
export const demoMaterials: CourseMaterial[] = [
  {
    id: did("mat-cs101-outline"),
    universityId: DEMO_UNIVERSITY_ID,
    courseId: did("course-DEMO-CS101"),
    groupId: null,
    section: "Week 1 – Introduction",
    title: "Demo course outline",
    kind: "link",
    url: "https://example.org/demo-course-outline",
    createdAt: "2026-09-21T08:00:00Z",
  },
  {
    id: did("mat-cs101-w2"),
    universityId: DEMO_UNIVERSITY_ID,
    courseId: did("course-DEMO-CS101"),
    groupId: DEMO_REP_GROUP,
    section: "Week 2 – Variables",
    title: "Demo lab sheet (link)",
    kind: "link",
    url: "https://example.org/demo-lab-sheet",
    createdAt: "2026-09-28T08:00:00Z",
  },
];

/**
 * Demo class tools: everything stays on this device. Nothing is shared with
 * anyone, which the UI states. Mirrors the real calls so the screens and the
 * tests exercise the same flow.
 */
export class DemoClassTools implements ClassTools {
  constructor(private readonly kv: SyncKV | null) {}

  read(): Stored {
    try {
      const raw = this.kv?.getItem(KEY);
      if (raw) return JSON.parse(raw) as Stored;
    } catch {
      /* ignore */
    }
    return { materials: [], announcements: [] };
  }
  private write(s: Stored) {
    try {
      this.kv?.setItem(KEY, JSON.stringify(s));
    } catch {
      throw new Error("demo_storage_full");
    }
  }

  /** Adds demo + locally added materials and class posts to a bundle. */
  apply(bundle: CampusBundle, signedInEmail: string | null): CampusBundle {
    const s = this.read();
    const rep = signedInEmail === DEMO_REP_EMAIL;
    return {
      ...bundle,
      materials: [...s.materials.map(({ dataUrl: _d, ...m }) => m), ...demoMaterials],
      announcements: [...s.announcements, ...bundle.announcements],
      classRoles: signedInEmail ? { userId: DEMO_USER_ID, repGroupIds: rep ? [DEMO_REP_GROUP] : [], lecturerId: null } : null,
    };
  }

  async addMaterial(universityId: string, input: MaterialInput): Promise<CourseMaterial> {
    const problem = materialProblem(input);
    if (problem) throw new Error(`material_${problem}`);
    let dataUrl: string | undefined;
    let mime: string | null = null;
    if (input.file) {
      if (input.file.size > DEMO_FILE_LIMIT) throw new Error("material_demo_size");
      const ext = (input.fileName ?? "").toLowerCase().split(".").pop()!;
      mime = MATERIAL_TYPES[ext]!;
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      dataUrl = `data:${mime};base64,${btoa(bin)}`;
    }
    const m: CourseMaterial & { dataUrl?: string } = {
      id: `demo-mat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      universityId,
      courseId: input.courseId,
      groupId: input.groupId,
      section: input.section?.trim() || null,
      title: input.title.trim(),
      kind: input.file ? "file" : "link",
      storagePath: input.file ? `demo/${input.fileName}` : null,
      url: input.file ? null : input.url!.trim(),
      mime,
      sizeBytes: input.file?.size ?? null,
      uploadedBy: DEMO_USER_ID,
      createdAt: new Date().toISOString(),
      dataUrl,
    };
    const s = this.read();
    s.materials.unshift(m);
    this.write(s);
    const { dataUrl: _d, ...out } = m;
    return out;
  }

  async removeMaterial(material: CourseMaterial): Promise<void> {
    const s = this.read();
    if (!s.materials.some((m) => m.id === material.id)) throw new Error("demo_builtin_material");
    s.materials = s.materials.filter((m) => m.id !== material.id);
    this.write(s);
  }

  async openMaterial(material: CourseMaterial): Promise<string> {
    if (material.kind === "link") return material.url!;
    const hit = this.read().materials.find((m) => m.id === material.id);
    if (!hit?.dataUrl) throw new Error("not_found");
    return hit.dataUrl;
  }

  async postToClass(universityId: string, groupId: string, title: string, body: string): Promise<void> {
    if (!title.trim() || !body.trim()) throw new Error("announcement_empty");
    const s = this.read();
    s.announcements.unshift({
      id: `demo-post-${Date.now()}`,
      universityId,
      groupId,
      authorId: DEMO_USER_ID,
      title: { en: title.trim() },
      body: { en: body.trim() },
      publishedAt: new Date().toISOString(),
      expiresAt: null,
      priority: "normal",
    });
    this.write(s);
  }

  async removeAnnouncement(id: string): Promise<void> {
    const s = this.read();
    s.announcements = s.announcements.filter((a) => a.id !== id);
    this.write(s);
  }
}
