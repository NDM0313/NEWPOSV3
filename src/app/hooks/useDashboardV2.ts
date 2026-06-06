import { useCallback, useEffect, useState } from 'react';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { formatLocalDateYYYYMMDD } from '@/app/utils/localDate';
import { loadDashboardV2Snapshot, clearDashboardV2Cache } from '@/app/services/dashboardV2Service';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';

export function useDashboardV2() {
  const { companyId } = useSupabase();
  const { startDateObj, endDateObj, branchId } = useGlobalFilter();
  const [data, setData] = useState<DashboardV2Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const dateFrom = startDateObj ? formatLocalDateYYYYMMDD(startDateObj) : new Date().toISOString().slice(0, 10);
  const dateTo = endDateObj ? formatLocalDateYYYYMMDD(endDateObj) : dateFrom;

  const fetchSnapshot = useCallback(
    async (force?: boolean) => {
      if (!companyId) {
        setData(null);
        setIsLoading(false);
        return;
      }
      if (force) clearDashboardV2Cache(companyId);
      setIsLoading(true);
      setError(null);
      try {
        const snapshot = await loadDashboardV2Snapshot({
          companyId,
          branchId: branchId ?? null,
          dateFrom,
          dateTo,
        });
        setData(snapshot);
        setLastUpdated(snapshot.meta.loadedAt);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [companyId, branchId, dateFrom, dateTo]
  );

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const refetch = useCallback(() => fetchSnapshot(true), [fetchSnapshot]);

  return { data, isLoading, error, refetch, lastUpdated, dateFrom, dateTo };
}
