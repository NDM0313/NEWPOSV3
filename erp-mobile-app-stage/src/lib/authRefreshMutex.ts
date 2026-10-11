/**
 * Serialize Supabase auth refreshSession calls to avoid GoTrue Web Locks abort races
 * (e.g. counter PIN unlock vs autoRefreshToken vs vault maintenance).
 */

let refreshInFlight: Promise<unknown> | null = null;

export function isAuthAbortError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === 'object') {
    const name = (err as { name?: string }).name ?? '';
    if (name === 'AbortError') return true;
  }
  const m = String(
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message?: string }).message
      : err,
  ).toLowerCase();
  return m.includes('aborted') || m.includes('abort');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run fn while holding the auth refresh lock; retries once on abort by default. */
export async function withAuthRefreshMutex<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; retryDelayMs?: number },
): Promise<T> {
  const maxRetries = options?.retries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 400;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    while (refreshInFlight) {
      try {
        await refreshInFlight;
      } catch {
        /* prior refresh failed — continue */
      }
    }

    const run = fn();
    refreshInFlight = run;
    try {
      return await run;
    } catch (err) {
      if (attempt < maxRetries && isAuthAbortError(err)) {
        await sleep(retryDelayMs);
        continue;
      }
      throw err;
    } finally {
      if (refreshInFlight === run) refreshInFlight = null;
    }
  }

  throw new Error('Auth refresh mutex exhausted retries');
}
