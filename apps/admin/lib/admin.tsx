"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { can, roleIn, type Permission, type Role, type UniversitySummary } from "@campusnav/core";
import { createSupabase, SandboxAdminSource, SupabaseAdminSource, type AdminDataSource, type AdminSession } from "@campusnav/data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const STUDENT_APP_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? "http://localhost:3000";
export const adminMode: "supabase" | "sandbox" = SUPABASE_URL && SUPABASE_ANON_KEY ? "supabase" : "sandbox";

let source: AdminDataSource | null = null;
export function getAdminSource(): AdminDataSource {
  if (!source) {
    source = adminMode === "supabase" ? new SupabaseAdminSource(createSupabase({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY })) : new SandboxAdminSource(window.localStorage);
  }
  return source;
}

interface AdminState {
  ready: boolean;
  session: AdminSession | null;
  universities: UniversitySummary[];
  universityId: string | null;
  setUniversityId: (id: string) => void;
  role: Role | null;
  can: (p: Permission) => boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Bumped after writes so pages refetch. */
  version: number;
  bump: () => void;
  toast: (msg: string, tone?: "ok" | "error") => void;
}

const Ctx = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [universities, setUniversities] = useState<UniversitySummary[]>([]);
  const [universityId, setUid] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: "ok" | "error" }[]>([]);

  const refreshSession = useCallback(async () => {
    const src = getAdminSource();
    const s = await src.session().catch(() => null);
    setSession(s);
    if (s) {
      const all = await src.listUniversities().catch(() => []);
      // Only universities where the user has a membership (or all, for platform owners).
      const mine = s.isPlatformOwner ? all : all.filter((u) => s.memberships.some((m) => m.universityId === u.id));
      setUniversities(mine);
      const stored = window.localStorage.getItem("campusnav.admin.university");
      setUid((prev) => prev ?? (mine.find((u) => u.id === stored)?.id ?? mine[0]?.id ?? null));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const setUniversityId = useCallback((id: string) => {
    setUid(id);
    try {
      window.localStorage.setItem("campusnav.admin.university", id);
    } catch {
      /* ignore */
    }
  }, []);

  const role = useMemo(() => (session && universityId ? roleIn(session.memberships, universityId, session.isPlatformOwner) : null), [session, universityId]);

  const toast = useCallback((msg: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const value = useMemo<AdminState>(
    () => ({
      ready,
      session,
      universities,
      universityId,
      setUniversityId,
      role,
      can: (p) => can(role, p),
      refreshSession,
      signOut: async () => {
        await getAdminSource().signOut();
        setSession(null);
      },
      version,
      bump: () => setVersion((v) => v + 1),
      toast,
    }),
    [ready, session, universities, universityId, setUniversityId, role, refreshSession, version, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 end-4 z-50 space-y-2 no-print" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className={`border px-4 py-3 bg-raised text-sm max-w-sm ${t.tone === "error" ? "border-danger text-danger" : "border-accent"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useAdmin(): AdminState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin outside provider");
  return v;
}

/** Load a table for the current university; refetches when `version` changes. */
export function useTable<T>(table: Parameters<AdminDataSource["list"]>[0]): { rows: T[] | null; error: string | null; reload: () => void } {
  const { universityId, version } = useAdmin();
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!universityId) return;
    let cancelled = false;
    getAdminSource()
      .list<T>(table, universityId)
      .then((r) => {
        if (!cancelled) {
          setRows(r);
          setError(null);
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [table, universityId, version, k]);
  return { rows, error, reload: () => setK((x) => x + 1) };
}

export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/row-level security|permission denied|42501|forbidden/i.test(msg)) return "Permission denied — your role cannot perform this action.";
  if (/duplicate key|unique/i.test(msg)) return "A record with this code already exists.";
  if (/foreign key/i.test(msg)) return "This record references something that does not exist (or belongs to another university).";
  return msg;
}

export function newId(): string {
  return crypto.randomUUID();
}
