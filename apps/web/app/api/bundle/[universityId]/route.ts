import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SupabaseDataSource, createSupabase } from "@campusnav/data/supabase";
import { SUPABASE_ANON_KEY, SUPABASE_URL, backendMode } from "@/lib/config";

/**
 * Cached public campus bundle — the scalability path for "every student opens
 * the app at 8:00". One request per student, served from the CDN edge cache;
 * the database is queried at most once per university per cache window, not
 * once per student. Uses the public anon key, so RLS returns exactly what an
 * anonymous visitor may read (published universities only).
 */
export const dynamic = "force-dynamic";

const ID = /^[0-9a-fA-F-]{8,64}$/;
const CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export async function GET(req: NextRequest, ctx: { params: Promise<{ universityId: string }> }) {
  const { universityId } = await ctx.params;
  if (backendMode !== "supabase") return NextResponse.json({ error: "no_backend" }, { status: 404 });
  if (!ID.test(universityId)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  try {
    const src = new SupabaseDataSource(createSupabase({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, persistSession: false }));
    const bundle = await src.getBundle(universityId);
    const body = JSON.stringify({ ...bundle, generatedAt: new Date(0).toISOString() }); // stable bytes → stable ETag
    const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
    return new NextResponse(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ETag: etag, "Cache-Control": CACHE } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
