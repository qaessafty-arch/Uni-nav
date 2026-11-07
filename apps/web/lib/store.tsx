"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CampusBundle, Locale, UniversitySummary } from "@campusnav/core";
import { visualStyles, type VisualStyle } from "@campusnav/tokens";
import { buildSearchIndex, bundleForAccess, VISITOR, type SearchIndex } from "@campusnav/core";
import type { StudentStatus } from "@campusnav/data/types";
import { clearCachedBundle, loadBundle, readCachedBundle, type AsyncKV } from "@campusnav/data/cache";
import { dir, isLocale, translate, type MessageKey, type Params } from "@campusnav/i18n";
import { getDataSource } from "./config";

/** Safe localStorage wrapper (private mode / disabled storage must not crash the app). */
export const kv: AsyncKV & { getJSON<T>(k: string, d: T): T; setJSON(k: string, v: unknown): void } = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* quota or disabled */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
  getJSON<T>(k: string, d: T): T {
    try {
      const raw = window.localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : d;
    } catch {
      return d;
    }
  },
  setJSON(k: string, v: unknown) {
    try {
      window.localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
};

export interface Prefs {
  locale: Locale;
  theme: "dark" | "light" | "system";
  /** UI-only visual style (Minimalism / Editorial / Brutalism × Electric). */
  style: VisualStyle;
  universityId: string | null;
  groupId: string | null;
  accessible: boolean;
  keepHistory: boolean;
  onboarded: boolean;
  reminders: boolean;
}

export interface Start {
  nodeId: string;
  source: "checkpoint" | "manual";
  label?: string;
  at: string;
}

export interface HistoryItem {
  to: string; // room id or node:<id>
  from: string;
  at: string;
}

const DEFAULT_PREFS: Prefs = {
  locale: "en",
  theme: "light",
  style: "minimal",
  universityId: null,
  groupId: null,
  accessible: false,
  keepHistory: false,
  onboarded: false,
  reminders: false,
};

type BundleState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; bundle: CampusBundle; origin: "network" | "cache"; cachedAt: string; index: SearchIndex }
  | { status: "error"; error: string };

interface AppState {
  hydrated: boolean;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  universities: UniversitySummary[] | null;
  bundleState: BundleState;
  /** Visitor, verified student (major + year) or staff, and verification state. */
  student: StudentStatus;
  refreshStudent: () => Promise<void>;
  signOutStudent: () => Promise<void>;
  reload: () => void;
  clearOffline: () => Promise<void>;
  online: boolean;
  start: Start | null;
  setStart: (s: Start | null) => void;
  saved: string[];
  toggleSaved: (roomId: string) => void;
  history: HistoryItem[];
  addHistory: (h: Omit<HistoryItem, "at">) => void;
  clearHistory: () => void;
  t: (key: MessageKey, params?: Params) => string;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [universities, setUniversities] = useState<UniversitySummary[] | null>(null);
  const [rawBundleState, setBundleState] = useState<BundleState>({ status: "idle" });
  const [student, setStudent] = useState<StudentStatus>({ access: VISITOR });
  const [online, setOnline] = useState(true);
  const [start, setStartState] = useState<Start | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  // Hydrate persisted state on the client only.
  useEffect(() => {
    const stored = kv.getJSON<Partial<Prefs>>("campusnav.prefs", {});
    const p = { ...DEFAULT_PREFS, ...stored };
    if (!stored.locale) {
      const nav = navigator.language?.toLowerCase() ?? "";
      p.locale = nav.startsWith("ckb") || nav.startsWith("ku") ? "ckb" : nav.startsWith("ar") ? "ar" : "en";
    }
    if (!isLocale(p.locale)) p.locale = "en";
    if (!visualStyles.includes(p.style)) p.style = DEFAULT_PREFS.style;
    setPrefsState(p);
    setStartState(kv.getJSON<Start | null>("campusnav.start", null));
    setSaved(kv.getJSON<string[]>("campusnav.saved", []));
    setHistory(p.keepHistory ? kv.getJSON<HistoryItem[]>("campusnav.history", []) : []);
    setOnline(navigator.onLine);
    setHydrated(true);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Apply language, direction and theme to <html>.
  useEffect(() => {
    if (!hydrated) return;
    const el = document.documentElement;
    el.lang = prefs.locale;
    el.dir = dir(prefs.locale);
    const theme = prefs.theme === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : prefs.theme;
    el.dataset.theme = theme;
    el.dataset.style = prefs.style;
  }, [hydrated, prefs.locale, prefs.theme, prefs.style]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      kv.setJSON("campusnav.prefs", next);
      if (p.keepHistory === false) kv.removeItem("campusnav.history");
      return next;
    });
  }, []);

  // University list
  useEffect(() => {
    if (!hydrated) return;
    getDataSource()
      .then((src) => src.listUniversities())
      .then(setUniversities)
      .catch(() => setUniversities([]));
  }, [hydrated, reloadKey]);

  // Bundle with offline fallback
  useEffect(() => {
    if (!hydrated || !prefs.universityId) return;
    let cancelled = false;
    const uid = prefs.universityId;
    setBundleState((s) => (s.status === "ready" ? s : { status: "loading" }));
    (async () => {
      // Show cached data immediately (fast start on slow campus networks), then refresh.
      const cached = await readCachedBundle(kv, uid);
      if (cached && !cancelled) setBundleState({ status: "ready", ...cached, index: buildSearchIndex(cached.bundle) });
      try {
        const res = await loadBundle(await getDataSource(), kv, uid);
        if (!cancelled) setBundleState({ status: "ready", ...res, index: buildSearchIndex(res.bundle) });
      } catch (e) {
        if (!cancelled && !cached) setBundleState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, prefs.universityId, reloadKey]);

  const refreshStudent = useCallback(async () => {
    if (!prefs.universityId) return setStudent({ access: VISITOR });
    try {
      const src = await getDataSource();
      setStudent((await src.student?.status(prefs.universityId)) ?? { access: VISITOR });
    } catch {
      setStudent({ access: VISITOR });
    }
  }, [prefs.universityId]);

  useEffect(() => {
    if (hydrated) void refreshStudent();
  }, [hydrated, refreshStudent, reloadKey]);

  const signOutStudent = useCallback(async () => {
    const src = await getDataSource();
    await src.student?.signOut();
    // The cached bundle may hold this student's classrooms and timetable.
    if (prefs.universityId) await clearCachedBundle(kv, prefs.universityId);
    setPrefsState((p) => ({ ...p, groupId: null }));
    setStudent({ access: VISITOR });
    setReloadKey((k) => k + 1);
  }, [prefs.universityId]);

  // What this person may see: visitors get public places only, students their own major and year.
  const bundleState = useMemo<BundleState>(() => {
    if (rawBundleState.status !== "ready") return rawBundleState;
    const bundle = bundleForAccess(rawBundleState.bundle, student.access);
    return bundle === rawBundleState.bundle ? rawBundleState : { ...rawBundleState, bundle, index: buildSearchIndex(bundle) };
  }, [rawBundleState, student.access]);

  const setStart = useCallback((s: Start | null) => {
    setStartState(s);
    if (s) kv.setJSON("campusnav.start", s);
    else kv.removeItem("campusnav.start");
  }, []);

  const toggleSaved = useCallback((roomId: string) => {
    setSaved((prev) => {
      const next = prev.includes(roomId) ? prev.filter((x) => x !== roomId) : [roomId, ...prev].slice(0, 50);
      kv.setJSON("campusnav.saved", next);
      return next;
    });
  }, []);

  const addHistory = useCallback(
    (h: Omit<HistoryItem, "at">) => {
      if (!prefs.keepHistory) return;
      setHistory((prev) => {
        const next = [{ ...h, at: new Date().toISOString() }, ...prev.filter((x) => x.to !== h.to)].slice(0, 20);
        kv.setJSON("campusnav.history", next);
        return next;
      });
    },
    [prefs.keepHistory],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    kv.removeItem("campusnav.history");
  }, []);

  const clearOffline = useCallback(async () => {
    if (prefs.universityId) await clearCachedBundle(kv, prefs.universityId);
  }, [prefs.universityId]);

  const t = useCallback((key: MessageKey, params?: Params) => translate(prefs.locale, key, params), [prefs.locale]);

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      prefs,
      setPrefs,
      universities,
      bundleState,
      student,
      refreshStudent,
      signOutStudent,
      reload: () => setReloadKey((k) => k + 1),
      clearOffline,
      online,
      start,
      setStart,
      saved,
      toggleSaved,
      history,
      addHistory,
      clearHistory,
      t,
    }),
    [hydrated, prefs, setPrefs, universities, bundleState, student, refreshStudent, signOutStudent, clearOffline, online, start, setStart, saved, toggleSaved, history, addHistory, clearHistory, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

/** Convenience: the ready bundle or null. */
export function useBundle(): CampusBundle | null {
  const { bundleState } = useApp();
  return bundleState.status === "ready" ? bundleState.bundle : null;
}
