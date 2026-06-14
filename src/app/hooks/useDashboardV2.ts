import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useAccountingOptional } from '@/app/context/AccountingContext';
import { formatLocalDateYYYYMMDD } from '@/app/utils/localDate';
import { loadDashboardV2Snapshot, clearDashboardV2Cache } from '@/app/services/dashboardV2Service';
import { enrichDashboardSnapshot } from '@/app/lib/dashboardV2ContextEnrich';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';

export function useDashboardV2() {
  const { companyId } = useSupabase();
  const { startDateObj, endDateObj, branchId } = useGlobalFilter();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const accounting = useAccountingOptional();
  const [rawData, setRawData] = useState<DashboardV2Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const dateFrom = startDateObj ? formatLocalDateYYYYMMDD(startDateObj) : new Date().toISOString().slice(0, 10);
  const dateTo = endDateObj ? formatLocalDateYYYYMMDD(endDateObj) : dateFrom;

  const fetchSnapshot = useCallback(
    async (force?: boolean) => {
      if (!companyId) {
        setRawData(null);
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
        setRawData(snapshot);
        setLastUpdated(snapshot.meta.loadedAt);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
        setRawData(null);
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

  const data = useMemo(() => {
    if (!rawData) return null;
    return enrichDashboardSnapshot(rawData, {
      sales: sales.sales,
      purchases: purchases.purchases,
      expenses: expenses.expenses,
      accounts: accounting?.accounts,
      dateFrom,
      dateTo,
      branchId: branchId ?? null,
      priorMetrics: rawData.summary.priorPeriod
        ? {
            today_sales: rawData.summary.priorPeriod.periodSales,
            today_profit: rawData.summary.priorPeriod.netProfit,
            monthly_revenue: rawData.summary.priorPeriod.periodSales,
            monthly_expenses: 0,
            monthly_profit: rawData.summary.priorPeriod.netProfit,
            profit_margin_pct: 0,
            cash_balance: 0,
            bank_balance: 0,
            receivables: 0,
            payables: 0,
            sales_trend: [],
            expense_trend: [],
            profit_trend: [],
          }
        : null,
    });
  }, [rawData, sales.sales, purchases.purchases, expenses.expenses, accounting?.accounts, dateFrom, dateTo, branchId]);

  return { data, isLoading, error, refetch, lastUpdated, dateFrom, dateTo };
}
