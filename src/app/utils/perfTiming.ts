/**
 * DEV-only performance timing spans for save paths (sale / purchase / product).
 * No-op in production builds.
 */
export type PerfSpan = { end: (extra?: Record<string, unknown>) => void };

export function perfStart(label: string): PerfSpan {
  if (!import.meta.env.DEV) {
    return { end: () => undefined };
  }
  const t0 = performance.now();
  return {
    end(extra?: Record<string, unknown>) {
      const ms = Math.round(performance.now() - t0);
      console.info(`[PERF] ${label}: ${ms}ms`, extra ?? '');
    },
  };
}

/** Run async tasks with limited concurrency (default 5). */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
