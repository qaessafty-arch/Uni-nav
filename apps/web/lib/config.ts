import { createSupabase, DemoDataSource, SupabaseDataSource, SandboxAdminSource, type CampusDataSource } from "@campusnav/data";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
export const APP_VERSION = "0.1.0";

export const backendMode: "supabase" | "demo" = SUPABASE_URL && SUPABASE_ANON_KEY ? "supabase" : "demo";

let source: CampusDataSource | null = null;

/**
 * Data source for the student app. Without Supabase configuration the app runs
 * on the fictional demo dataset (and reflects any local admin-sandbox edits made
 * in the same browser, so the admin → student flow can be demonstrated offline).
 */
export function getDataSource(): CampusDataSource {
  if (source) return source;
  if (backendMode === "supabase") {
    source = new SupabaseDataSource(createSupabase({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, persistSession: true }));
  } else {
    source = new DemoDataSource(() => {
      if (typeof window === "undefined") return null;
      try {
        if (!window.localStorage.getItem("campusnav.sandbox.v1")) return null;
        return new SandboxAdminSource(window.localStorage).toBundle();
      } catch {
        return null;
      }
    });
  }
  return source;
}
