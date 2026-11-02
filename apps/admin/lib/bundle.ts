"use client";
import { useEffect, useState } from "react";
import type { CampusBundle, EntityTable, QrCheckpoint, University } from "@campusnav/core";
import { getAdminSource, useAdmin } from "./admin";

export const BUNDLE_TABLES: [EntityTable, keyof CampusBundle][] = [
  ["campuses", "campuses"],
  ["buildings", "buildings"],
  ["floors", "floors"],
  ["rooms", "rooms"],
  ["map_elements", "mapElements"],
  ["navigation_nodes", "navNodes"],
  ["navigation_edges", "navEdges"],
  ["departments", "departments"],
  ["lecturers", "lecturers"],
  ["courses", "courses"],
  ["student_groups", "groups"],
  ["semesters", "semesters"],
  ["timetable_entries", "timetable"],
  ["schedule_changes", "scheduleChanges"],
  ["announcements", "announcements"],
];

export interface AdminBundle {
  bundle: CampusBundle;
  checkpoints: QrCheckpoint[];
}

/** Load the whole tenant dataset as the admin sees it (RLS-filtered). */
export async function loadAdminBundle(universityId: string, includeCheckpoints: boolean): Promise<AdminBundle> {
  const src = getAdminSource();
  const [uni] = await src.list<University>("universities", universityId);
  const lists = await Promise.all(BUNDLE_TABLES.map(([t]) => src.list(t, universityId)));
  const checkpoints = includeCheckpoints ? await src.list<QrCheckpoint>("qr_checkpoints", universityId).catch(() => []) : [];
  const bundle = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: src.kind === "demo" ? "demo" : "supabase",
    university: uni!,
    checkpoints: checkpoints.map(({ id, nodeId, label }) => ({ id, nodeId, label })),
  } as unknown as Record<string, unknown>;
  BUNDLE_TABLES.forEach(([, key], i) => (bundle[key] = lists[i]));
  return { bundle: bundle as unknown as CampusBundle, checkpoints };
}

export function useAdminBundle(): { data: AdminBundle | null; error: string | null } {
  const { universityId, version, can } = useAdmin();
  const [data, setData] = useState<AdminBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cp = can("checkpoint.manage");
  useEffect(() => {
    if (!universityId) return;
    let cancelled = false;
    loadAdminBundle(universityId, cp)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [universityId, version, cp]);
  return { data, error };
}
