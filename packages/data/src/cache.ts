import type { CampusBundle } from "@campusnav/core";
import type { CampusDataSource } from "./types";

/** Async key-value store (localStorage wrapper on web, AsyncStorage on mobile). */
export interface AsyncKV {
  getItem(k: string): Promise<string | null> | string | null;
  setItem(k: string, v: string): Promise<void> | void;
  removeItem(k: string): Promise<void> | void;
}

export interface CachedBundle {
  bundle: CampusBundle;
  /** Where this copy came from: fresh from network, or the offline cache. */
  origin: "network" | "cache";
  cachedAt: string;
}

const key = (universityId: string) => `campusnav.bundle.${universityId}`;

/**
 * Offline-first bundle loading: try the network; on failure fall back to the
 * last cached copy and say so. Live data (schedule changes) may be stale in
 * that case — the UI must display `cachedAt`.
 */
export async function loadBundle(source: CampusDataSource, kv: AsyncKV, universityId: string): Promise<CachedBundle> {
  try {
    const bundle = await source.getBundle(universityId);
    const cachedAt = new Date().toISOString();
    try {
      await kv.setItem(key(universityId), JSON.stringify({ bundle, cachedAt }));
    } catch {
      /* storage full or unavailable: still usable online */
    }
    return { bundle, origin: "network", cachedAt };
  } catch (err) {
    const cached = await readCachedBundle(kv, universityId);
    if (cached) return cached;
    throw err;
  }
}

export async function readCachedBundle(kv: AsyncKV, universityId: string): Promise<CachedBundle | null> {
  const raw = await kv.getItem(key(universityId));
  if (!raw) return null;
  try {
    const { bundle, cachedAt } = JSON.parse(raw) as { bundle: CampusBundle; cachedAt: string };
    if (bundle?.schemaVersion !== 1) return null;
    return { bundle, origin: "cache", cachedAt };
  } catch {
    return null;
  }
}

export async function clearCachedBundle(kv: AsyncKV, universityId: string): Promise<void> {
  await kv.removeItem(key(universityId));
}
