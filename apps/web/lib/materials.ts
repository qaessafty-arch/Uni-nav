"use client";
import { useEffect, useState } from "react";
import { unseenMaterials, type CampusBundle, type CourseMaterial } from "@campusnav/core";
import { kv } from "./store";

/** Fired when a course page marks its materials as seen, so badges update at once. */
export const SEEN_EVENT = "campusnav:materials-seen";

export const seenKey = (courseId: string) => `campusnav.materials.seen.${courseId}`;

/** New lecture materials for this person (read after mount: the "seen" marks live in this browser). */
export function useUnseenMaterials(bundle: CampusBundle | null | undefined, refreshKey?: unknown): CourseMaterial[] {
  const [list, setList] = useState<CourseMaterial[]>([]);
  useEffect(() => {
    const compute = () => setList(bundle?.materials?.length ? unseenMaterials(bundle.materials, (id) => kv.getJSON<string>(seenKey(id), ""), new Date()) : []);
    compute();
    window.addEventListener(SEEN_EVENT, compute);
    return () => window.removeEventListener(SEEN_EVENT, compute);
  }, [bundle, refreshKey]);
  return list;
}
