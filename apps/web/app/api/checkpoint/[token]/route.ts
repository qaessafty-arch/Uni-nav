import { NextResponse, type NextRequest } from "next/server";
import { parseCheckpointPayload } from "@campusnav/core";
import { createSupabase, DemoDataSource, SupabaseDataSource, type CampusDataSource } from "@campusnav/data";
import { clientKey, RateLimiter } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

// 30 checkpoint lookups per minute per client IP.
const limiter = new RateLimiter(30, 60_000);

let source: CampusDataSource | null = null;
function serverSource(): CampusDataSource {
  if (source) return source;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Uses the public anon key: the RPC is subject to the same RLS as browsers.
  source = url && key ? new SupabaseDataSource(createSupabase({ url, anonKey: key, persistSession: false })) : new DemoDataSource();
  return source;
}

/**
 * Resolve a QR checkpoint token. Validates format before any backend call,
 * rate limits per client, and returns only non-sensitive fields.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const rl = limiter.check(clientKey(req.headers));
  if (!rl.allowed) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }
  const { token } = await ctx.params;
  const parsed = parseCheckpointPayload(decodeURIComponent(token));
  if (!parsed.ok) return NextResponse.json({ status: "unknown" }, { status: 404 });
  const university = req.nextUrl.searchParams.get("university") ?? undefined;
  try {
    const res = await serverSource().resolveCheckpoint(parsed.token, university && /^[0-9a-f-]{36}$/.test(university) ? university : undefined);
    const code = res.status === "ok" || res.status === "wrong_university" ? 200 : res.status === "unknown" ? 404 : res.status === "network_error" ? 502 : 410;
    return NextResponse.json(res, { status: code, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "network_error" }, { status: 502 });
  }
}
