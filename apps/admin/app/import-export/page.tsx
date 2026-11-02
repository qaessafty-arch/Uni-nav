"use client";
import { useState } from "react";
import { entitySchemas, type EntityTable } from "@campusnav/core";
import { errorMessage, getAdminSource, useAdmin } from "@/lib/admin";
import { BUNDLE_TABLES, loadAdminBundle } from "@/lib/bundle";
import { Badge, Button, Notice, PageTitle, Section } from "@/components/ui";

// Write order respects foreign keys.
const IMPORT_ORDER: EntityTable[] = [
  "campuses", "buildings", "floors", "departments", "navigation_nodes", "navigation_edges", "rooms", "map_elements",
  "lecturers", "courses", "student_groups", "semesters", "timetable_entries", "schedule_changes", "announcements",
];

interface Plan {
  rows: Partial<Record<EntityTable, { id: string }[]>>;
  errors: string[];
}

/**
 * JSON export/import of a whole university dataset. Imports are validated with
 * the shared schemas and always re-bound to the CURRENT university — the
 * universityId inside the file is never trusted.
 */
export default function ImportExportPage() {
  const { universityId, can, bump, toast } = useAdmin();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  if (!universityId) return null;

  const exportJson = async () => {
    const { bundle } = await loadAdminBundle(universityId, false);
    const out = { format: "campusnav.bundle", exportedAt: new Date().toISOString(), ...bundle, checkpoints: undefined };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `campusnav-${bundle.university.slug}-${new Date().toISOString().slice(0, 10)}.json` }).click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast("File too large (max 20 MB)", "error");
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return setPlan({ rows: {}, errors: ["Not valid JSON."] });
    }
    if (json.format !== "campusnav.bundle" || json.schemaVersion !== 1) return setPlan({ rows: {}, errors: ["Not a CAMPUS NAV bundle (format/schemaVersion mismatch)."] });
    const errors: string[] = [];
    const rows: Plan["rows"] = {};
    for (const [table, key] of BUNDLE_TABLES) {
      const list = json[key];
      if (!Array.isArray(list)) continue;
      const schema = entitySchemas[table];
      const ok: { id: string }[] = [];
      list.forEach((raw, i) => {
        const candidate = { ...(raw as object), universityId };
        const res = schema.safeParse(candidate);
        if (res.success) ok.push(res.data as { id: string });
        else errors.push(`${table}[${i}]: ${res.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join(", ")}`);
      });
      rows[table] = ok;
    }
    setPlan({ rows, errors });
  };

  const commit = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      for (const t of IMPORT_ORDER) {
        const list = plan.rows[t];
        if (list?.length) await getAdminSource().upsertMany(t, list);
      }
      toast("Import complete");
      setPlan(null);
      bump();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageTitle>Import / export</PageTitle>
      <Section title="Export">
        <p className="text-sm text-muted mb-3">Download this university&apos;s campus data as JSON (backups, migration between environments). QR checkpoint tokens are never exported.</p>
        <Button onClick={() => void exportJson()}>Export JSON bundle</Button>
        <p className="text-sm text-muted mt-3">Timetable CSV export and import are on the Timetable page.</p>
      </Section>
      {can("data.import") ? (
        <Section title="Import">
          <Notice tone="warn">Import upserts records by id: existing records with the same id are overwritten. Export a backup first.</Notice>
          <input type="file" accept="application/json,.json" aria-label="JSON bundle" className="mt-4 text-sm" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          {plan ? (
            <div className="mt-4 border border-line p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(plan.rows).map(([t, l]) => <Badge key={t}>{t}: {l!.length}</Badge>)}
                <Badge tone={plan.errors.length ? "danger" : "accent"}>{plan.errors.length} invalid</Badge>
              </div>
              {plan.errors.length ? <ul className="text-xs mono max-h-48 overflow-auto text-danger mb-3">{plan.errors.slice(0, 100).map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
              <div className="flex gap-2">
                <Button variant="primary" disabled={busy || plan.errors.length > 0} onClick={() => void commit()}>Confirm import</Button>
                <Button onClick={() => setPlan(null)}>Discard</Button>
              </div>
              {plan.errors.length ? <p className="text-xs text-muted mt-2">Fix all invalid records before importing; partial imports are not allowed.</p> : null}
            </div>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
