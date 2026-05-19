/**
 * Parallel batching for CSV import commits (client-only).
 * Processes items in fixed-size chunks with Promise.allSettled so one failure
 * does not abort the chunk; callers aggregate counts/errors.
 */

/** Balance throughput vs. concurrent COA/subledger side effects (see products/contacts profiles). */
export const DEFAULT_IMPORT_CHUNK_SIZE = 8;

/**
 * Run async work over `items` in slices of `chunkSize`, awaiting each chunk
 * before starting the next (limits peak concurrency).
 */
export async function runChunkedAllSettled<T, R>(
  items: T[],
  chunkSize: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const size = Math.max(1, chunkSize);
  const out: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const settled = await Promise.allSettled(slice.map((item) => worker(item)));
    out.push(...settled);
  }
  return out;
}
