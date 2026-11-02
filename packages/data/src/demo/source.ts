import { evaluateCheckpoint, parseCheckpointPayload, problemReportInputSchema, type CampusBundle, type CheckpointResolution, type ProblemReportInput, type UniversitySummary } from "@campusnav/core";
import type { CampusDataSource } from "../types";
import { demoBundle, demoCheckpoints, demoUniversity } from "./dataset";

/**
 * Read-only in-memory data source over the fictional demo dataset.
 * Optionally overlays a locally edited bundle (admin sandbox) so the student
 * app on the same device reflects sandbox edits.
 */
export class DemoDataSource implements CampusDataSource {
  readonly kind = "demo" as const;
  constructor(private readonly overlay?: () => CampusBundle | null) {}

  async listUniversities(): Promise<UniversitySummary[]> {
    const u = this.overlay?.()?.university ?? demoUniversity;
    return [{ id: u.id, slug: u.slug, name: u.name, shortName: u.shortName, dataStatus: u.dataStatus, branding: u.branding }];
  }

  async getBundle(universityId: string): Promise<CampusBundle> {
    const b = this.overlay?.() ?? demoBundle();
    if (universityId !== b.university.id) throw new Error("UNKNOWN_UNIVERSITY");
    return b;
  }

  async resolveCheckpoint(token: string, activeUniversityId?: string): Promise<CheckpointResolution> {
    const parsed = parseCheckpointPayload(token);
    if (!parsed.ok) return { status: "unknown" };
    const record = demoCheckpoints.find((c) => c.token === parsed.token) ?? null;
    return evaluateCheckpoint(record, new Date(), activeUniversityId);
  }

  async submitReport(input: ProblemReportInput): Promise<{ status: "demo" }> {
    const parsed = problemReportInputSchema.safeParse(input);
    if (!parsed.success) throw new Error("INVALID_REPORT");
    return { status: "demo" };
  }
}
