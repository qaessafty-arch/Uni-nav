import type { CampusDataSource } from "@campusnav/data";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
export const APP_VERSION = "0.1.0";

export const backendMode: "supabase" | "demo" = SUPABASE_URL && SUPABASE_ANON_KEY ? "supabase" : "demo";

let source: Promise<CampusDataSource> | null = null;

/**
 * Data source for the student app, loaded lazily so the initial JS bundle
 * contains neither the Supabase client (in demo mode) nor the demo dataset (in
 * Supabase mode). Without Supabase configuration the app runs on the fictional
 * demo dataset, overlaid with local admin-sandbox edits when both apps share
 * an origin.
 */
export function getDataSource(): Promise<CampusDataSource> {
  if (source) return source;
  source =
    backendMode === "supabase"
      ? import("@campusnav/data/supabase").then(({ SupabaseDataSource, createSupabase }) => {
          const direct = new SupabaseDataSource(createSupabase({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, persistSession: true }));
          // Prefer the CDN-cached bundle (one cached request per student); fall back to direct queries.
          const getBundle = direct.getBundle.bind(direct);
          direct.getBundle = async (universityId: string) => {
            try {
              const res = await fetch(`/api/bundle/${encodeURIComponent(universityId)}`);
              if (res.ok) return { ...(await res.json()), generatedAt: new Date().toISOString() };
            } catch {
              /* offline or edge unavailable */
            }
            return getBundle(universityId);
          };
          return direct;
        })
      : import("@campusnav/data/demo").then(
          ({ DemoDataSource, SandboxAdminSource }) =>
            new DemoDataSource(() => {
              try {
                if (!window.localStorage.getItem("campusnav.sandbox.v1")) return null;
                return new SandboxAdminSource(window.localStorage).toBundle();
              } catch {
                return null;
              }
            }),
        );
  return source;
}
