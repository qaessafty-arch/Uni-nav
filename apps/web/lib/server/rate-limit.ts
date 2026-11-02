/**
 * Fixed-window rate limiter (in-memory, per server instance).
 * Adequate for a single Node instance; for multi-instance deployments put a
 * shared limiter (e.g. Vercel Firewall rules, Upstash, or Supabase edge) in front.
 */
interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string, now = Date.now()): { allowed: boolean; remaining: number; retryAfterSec: number } {
    if (this.windows.size > 10_000) this.sweep(now);
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, w);
    }
    w.count++;
    const allowed = w.count <= this.limit;
    return { allowed, remaining: Math.max(0, this.limit - w.count), retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }

  private sweep(now: number) {
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }
}

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip") || "unknown";
}
