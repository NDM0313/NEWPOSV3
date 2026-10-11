/**
 * Studio production list snapshot cache (uses listCache KV store).
 */
import type { StudioProductionRow, StudioStageRow } from '../api/studio';
import { listCacheKeys } from './listCache';
import type { ListBranchScope } from './listBranchScope';
import { readThroughCache, type ReadThroughResult } from './offlineData';

export interface StudioSnapshot {
  productions: StudioProductionRow[];
  stagesByProductionId: Record<string, StudioStageRow[]>;
}

/** Cache key segment from list branch scope (single UUID, acc:…, or all). */
export function studioScopeCacheKey(scope: ListBranchScope): string {
  if (scope.mode === 'single') return scope.branchId;
  if (scope.mode === 'accessible') {
    return scope.branchIds.length > 0 ? `acc:${[...scope.branchIds].sort().join(',')}` : 'acc:';
  }
  return 'all';
}

export function studioCacheKey(companyId: string, branchCacheKey: string): string {
  return listCacheKeys.studio(companyId, branchCacheKey || 'all');
}

export async function loadStudioSnapshot(
  companyId: string,
  branchCacheKey: string,
  onlineFetch: () => Promise<{ data: StudioSnapshot; error: string | null }>,
  emptyFallback: StudioSnapshot = { productions: [], stagesByProductionId: {} },
): Promise<ReadThroughResult<StudioSnapshot>> {
  return readThroughCache(studioCacheKey(companyId, branchCacheKey), onlineFetch, emptyFallback);
}
