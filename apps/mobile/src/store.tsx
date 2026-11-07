import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfoFallback from "./net";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildSearchIndex, bundleForAccess, VISITOR, type CampusBundle, type Locale, type SearchIndex, type UniversitySummary } from "@campusnav/core";
import { clearCachedBundle, createSupabase, DemoDataSource, loadBundle, readCachedBundle, SupabaseDataSource, type AsyncKV, type CampusDataSource, type StudentStatus } from "@campusnav/data";
import { dir, isLocale, translate, type MessageKey, type Params } from "@campusnav/i18n";
import { visualStyles, type VisualStyle } from "@campusnav/tokens";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "";

export const kv: AsyncKV = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

/** Synchronous view over AsyncStorage for the demo verification (preloaded at start, written through). */
const STUDENT_KEY = "campusnav.student.v1";
const memory = new Map<string, string>();
const syncKV = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memory.set(k, v);
    void AsyncStorage.setItem(k, v);
  },
  removeItem: (k: string) => {
    memory.delete(k);
    void AsyncStorage.removeItem(k);
  },
};

let source: CampusDataSource | null = null;
export function dataSource(): CampusDataSource {
  if (!source) {
    source =
      SUPABASE_URL && SUPABASE_ANON_KEY
        ? new SupabaseDataSource(createSupabase({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, storage: AsyncStorage, persistSession: true }))
        : new DemoDataSource(undefined, syncKV);
  }
  return source;
}

export interface Prefs {
  locale: Locale;
  universityId: string | null;
  groupId: string | null;
  accessible: boolean;
  onboarded: boolean;
  reminders: boolean;
  keepHistory: boolean;
  /** UI-only visual style (Minimalism / Editorial / Brutalism × Electric). */
  style: VisualStyle;
}

const DEFAULT: Prefs = { locale: "en", universityId: null, groupId: null, accessible: false, onboarded: false, reminders: false, keepHistory: false, style: "minimal" };

type BundleState =
  | { status: "idle" | "loading" }
  | { status: "ready"; bundle: CampusBundle; index: SearchIndex; origin: "network" | "cache"; cachedAt: string }
  | { status: "error"; error: string };

interface Ctx {
  hydrated: boolean;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  universities: UniversitySummary[] | null;
  bundleState: BundleState;
  /** Visitor, verified student (major + year) or staff. */
  student: StudentStatus;
  refreshStudent: () => Promise<void>;
  signOutStudent: () => Promise<void>;
  reload: () => void;
  start: { nodeId: string; label?: string } | null;
  setStart: (s: { nodeId: string; label?: string } | null) => void;
  saved: string[];
  toggleSaved: (id: string) => void;
  online: boolean;
  t: (k: MessageKey, p?: Params) => string;
  rtl: boolean;
}

const C = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT);
  const [universities, setUniversities] = useState<UniversitySummary[] | null>(null);
  const [rawBundleState, setBundleState] = useState<BundleState>({ status: "idle" });
  const [student, setStudent] = useState<StudentStatus>({ access: VISITOR });
  const [start, setStartState] = useState<Ctx["start"]>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [online, setOnline] = useState(true);
  const [k, setK] = useState(0);

  useEffect(() => {
    (async () => {
      const [p, s, sv, st] = await Promise.all([AsyncStorage.getItem("prefs"), AsyncStorage.getItem("start"), AsyncStorage.getItem("saved"), AsyncStorage.getItem(STUDENT_KEY)]);
      if (st) memory.set(STUDENT_KEY, st);
      const parsed: Partial<Prefs> = p ? JSON.parse(p) : {};
      if (!parsed.locale) {
        const lang = getLocales()[0]?.languageCode ?? "en";
        parsed.locale = lang === "ckb" || lang === "ku" ? "ckb" : lang === "ar" ? "ar" : "en";
      }
      if (!isLocale(parsed.locale)) parsed.locale = "en";
      if (!parsed.style || !visualStyles.includes(parsed.style)) parsed.style = DEFAULT.style;
      setPrefsState({ ...DEFAULT, ...parsed });
      setStartState(s ? JSON.parse(s) : null);
      setSaved(sv ? JSON.parse(sv) : []);
      setHydrated(true);
    })();
    return NetInfoFallback.subscribe(setOnline);
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      void AsyncStorage.setItem("prefs", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    dataSource().listUniversities().then(setUniversities).catch(() => setUniversities([]));
  }, [hydrated, k]);

  useEffect(() => {
    if (!hydrated || !prefs.universityId) return;
    let cancelled = false;
    const uid = prefs.universityId;
    (async () => {
      const cached = await readCachedBundle(kv, uid);
      if (cached && !cancelled) setBundleState({ status: "ready", ...cached, index: buildSearchIndex(cached.bundle) });
      else setBundleState({ status: "loading" });
      try {
        const res = await loadBundle(dataSource(), kv, uid);
        if (!cancelled) setBundleState({ status: "ready", ...res, index: buildSearchIndex(res.bundle) });
      } catch (e) {
        if (!cancelled && !cached) setBundleState({ status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, prefs.universityId, k]);

  const refreshStudent = useCallback(async () => {
    if (!prefs.universityId) return setStudent({ access: VISITOR });
    try {
      setStudent((await dataSource().student?.status(prefs.universityId)) ?? { access: VISITOR });
    } catch {
      setStudent({ access: VISITOR });
    }
  }, [prefs.universityId]);

  useEffect(() => {
    if (hydrated) void refreshStudent();
  }, [hydrated, refreshStudent, k]);

  const signOutStudent = useCallback(async () => {
    await dataSource().student?.signOut();
    if (prefs.universityId) await clearCachedBundle(kv, prefs.universityId);
    setPrefs({ groupId: null });
    setStudent({ access: VISITOR });
    setK((x) => x + 1);
  }, [prefs.universityId, setPrefs]);

  // Visitors get public places only; students their own major and year.
  const bundleState = useMemo<BundleState>(() => {
    if (rawBundleState.status !== "ready") return rawBundleState;
    const bundle = bundleForAccess(rawBundleState.bundle, student.access);
    return bundle === rawBundleState.bundle ? rawBundleState : { ...rawBundleState, bundle, index: buildSearchIndex(bundle) };
  }, [rawBundleState, student.access]);

  const setStart = useCallback((s: Ctx["start"]) => {
    setStartState(s);
    void (s ? AsyncStorage.setItem("start", JSON.stringify(s)) : AsyncStorage.removeItem("start"));
  }, []);

  const toggleSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev].slice(0, 50);
      void AsyncStorage.setItem("saved", JSON.stringify(next));
      return next;
    });
  }, []);

  const t = useCallback((key: MessageKey, p?: Params) => translate(prefs.locale, key, p), [prefs.locale]);

  const value = useMemo<Ctx>(
    () => ({ hydrated, prefs, setPrefs, universities, bundleState, student, refreshStudent, signOutStudent, reload: () => setK((x) => x + 1), start, setStart, saved, toggleSaved, online, t, rtl: dir(prefs.locale) === "rtl" }),
    [hydrated, prefs, setPrefs, universities, bundleState, student, refreshStudent, signOutStudent, start, setStart, saved, toggleSaved, online, t],
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("useApp outside provider");
  return v;
}
