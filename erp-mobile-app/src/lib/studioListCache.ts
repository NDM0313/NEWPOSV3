/**
 * Studio production list snapshot cache (uses listCache KV store).
 */
import type { StudioProductionRow, StudioStageRow } from '../api/studio';
import { listCacheKeys } from './listCache';
import { readThroughCache, type ReadThroughResult } from './offlineData';

export interface StudioSnapshot {
  productions: StudioProductionRow[];
  stagesByProductionId: Record<string, StudioStageRow[]>;
}

export function studioCacheKey(companyId: string, branchId: string | null | undefined): string {
  return listCacheKeys.studio(companyId, branchId ?? 'all');
}

export async function loadStudioSnapshot(
  companyId: string,
  branchId: string | null | undefined,
  onlineFetch: () => Promise<{ data: StudioSnapshot; error: string | null }>,
  emptyFallback: StudioSnapshot = { productions: [], stagesByProductionId: {} },
): Promise<ReadThroughResult<StudioSnapshot>> {
  return readThroughCache(studioCacheKey(companyId, branchId), onlineFetch, emptyFallback);
}
