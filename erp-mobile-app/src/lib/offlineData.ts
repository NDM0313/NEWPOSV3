/**
 * Shared offline read-through cache helpers (IndexedDB listCache).
 */
import { isBrowserOffline, listCacheGet, listCacheSet } from './listCache';

export const OFFLINE_NO_CACHE_MSG =
  'Offline: no saved data for this screen. Connect once while logged in to download.';

export interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

export interface ReadThroughResult<T> {
  data: T;
  fromCache: boolean;
  cachedAt: number | null;
  error: string | null;
}

export async function readThroughCache<T>(
  cacheKey: string,
  onlineFetch: () => Promise<{ data: T; error: string | null }>,
  emptyFallback: T,
): Promise<ReadThroughResult<T>> {
  if (isBrowserOffline()) {
    const cached = await listCacheGet<CacheEnvelope<T>>(cacheKey);
    if (cached?.data != null) {
      return {
        data: cached.data,
        fromCache: true,
        cachedAt: cached.cachedAt ?? null,
        error: null,
      };
    }
    return {
      data: emptyFallback,
      fromCache: true,
      cachedAt: null,
      error: OFFLINE_NO_CACHE_MSG,
    };
  }

  const { data, error } = await onlineFetch();
  if (!error) {
    const hasPayload = Array.isArray(data) ? data.length > 0 : data != null;
    if (hasPayload) {
      await listCacheSet(cacheKey, { data, cachedAt: Date.now() } satisfies CacheEnvelope<T>);
    }
    return { data, fromCache: false, cachedAt: Date.now(), error: null };
  }

  const cached = await listCacheGet<CacheEnvelope<T>>(cacheKey);
  if (cached?.data != null) {
    return {
      data: cached.data,
      fromCache: true,
      cachedAt: cached.cachedAt ?? null,
      error: error,
    };
  }
  return { data: data, fromCache: false, cachedAt: null, error };
}

export async function getCacheMeta(cacheKey: string): Promise<{ cachedAt: number | null }> {
  const cached = await listCacheGet<CacheEnvelope<unknown>>(cacheKey);
  return { cachedAt: cached?.cachedAt ?? null };
}
