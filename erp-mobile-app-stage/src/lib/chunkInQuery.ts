/**
 * Split large PostgREST `.in('column', ids)` filters to avoid HTTP 414 (URI too long).
 */

const DEFAULT_CHUNK_SIZE = 30;
const DEFAULT_CONCURRENCY = 4;

export function chunkIds(ids: string[], size = DEFAULT_CHUNK_SIZE): string[][] {
  if (!ids.length) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

export async function fetchInBatches<T>(
  ids: string[],
  fetchChunk: (chunkIds: string[]) => Promise<T[]>,
  options?: { chunkSize?: number; concurrency?: number }
): Promise<T[]> {
  if (!ids.length) return [];
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const chunks = chunkIds(ids, chunkSize);
  const merged: T[] = [];

  for (let i = 0; i < chunks.length; i += concurrency) {
    const wave = chunks.slice(i, i + concurrency);
    const results = await Promise.all(wave.map((chunk) => fetchChunk(chunk)));
    for (const rows of results) {
      merged.push(...rows);
    }
  }

  return merged;
}
