/**
 * Minimal connectivity signal without an extra native module: periodically
 * probes the configured backend's health endpoint. In demo mode (no backend)
 * nothing is probed — the data is bundled locally. Used only to label data as
 * cached; loading always falls back to the offline cache on failure.
 */
type Listener = (online: boolean) => void;

const BACKEND = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

async function probe(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${BACKEND}/auth/v1/health`, { method: "GET", signal: ctrl.signal });
    clearTimeout(id);
    return res.status < 500;
  } catch {
    return false;
  }
}

export default {
  subscribe(listener: Listener): () => void {
    if (!BACKEND) {
      listener(true);
      return () => {};
    }
    let stopped = false;
    const run = async () => {
      const ok = await probe();
      if (!stopped) listener(ok);
    };
    void run();
    const timer = setInterval(run, 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  },
};
