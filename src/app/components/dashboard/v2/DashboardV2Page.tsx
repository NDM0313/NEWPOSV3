import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Store, Info } from 'lucide-react';
import { useNavigation } from '@/app/context/NavigationContext';
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { useSupabase, STORAGE_BLOCKED_MESSAGE } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useDashboardV2 } from '@/app/hooks/useDashboardV2';
import { canViewExecutiveDashboard } from '@/app/lib/executiveDashboardAccess';
import { branchService } from '@/app/services/branchService';
import { CreateYourBusinessCard } from '@/app/components/dashboard/DashboardLegacy';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DashboardErrorState } from './DashboardErrorState';
import { DashboardEmptyState } from './DashboardEmptyState';
import { BusinessHealthGrid } from './BusinessHealthGrid';
import { BranchBreakdownTable } from './BranchBreakdownTable';
import { ActionRequiredPanel } from './ActionRequiredPanel';
import { MoneyFlowCharts } from './MoneyFlowCharts';
import { TopEntitiesCharts } from './TopEntitiesCharts';
import { OperationsPanel } from './OperationsPanel';

export const DashboardV2Page: React.FC = () => {
  const { setCurrentView } = useNavigation();
  const { setCurrentModule, getDateRangeLabel, branchId } = useGlobalFilter();
  const {
    user,
    userRole,
    companyId,
    signOut,
    profileLoadComplete,
    authConfigError,
    connectionError,
    storageBlocked,
    retryConnection,
    refreshUserProfile,
  } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { data, isLoading, error, refetch, lastUpdated } = useDashboardV2();
  const canExecutive = canViewExecutiveDashboard(userRole);
  const [branchLabel, setBranchLabel] = useState('All branches');

  useEffect(() => {
    setCurrentModule('dashboard');
  }, [setCurrentModule]);

  useEffect(() => {
    if (!companyId) {
      setBranchLabel('All branches');
      return;
    }
    const bid = branchId;
    if (!bid || bid === 'all') {
      setBranchLabel('All branches');
      return;
    }
    branchService
      .getAllBranches(companyId)
      .then((rows) => {
        const name = (rows || []).find((b: { id: string }) => b.id === bid)?.name;
        setBranchLabel(name ? String(name) : 'Selected branch');
      })
      .catch(() => setBranchLabel('Selected branch'));
  }, [companyId, branchId]);

  const showAllBranches = !branchId || branchId === 'all';
  const periodLabel = data?.meta.periodLabel ?? getDateRangeLabel();

  const isEmptyPeriod = useMemo(() => {
    if (!data || !canExecutive) return false;
    const s = data.summary;
    return (
      s.periodSales === 0 &&
      s.periodPurchases === 0 &&
      s.periodOperatingExpenses === 0 &&
      data.charts.salesTrend.every((t) => t.value === 0)
    );
  }, [data, canExecutive]);

  const handleNavigate = (view: string) => setCurrentView(view as Parameters<typeof setCurrentView>[0]);

  if (!companyId) {
    if (!profileLoadComplete) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-[#9CA3AF]">
            <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
            <span>Loading your profile…</span>
          </div>
        </div>
      );
    }
    if (authConfigError) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md p-8 rounded-xl bg-[#1F2937] border border-red-500/40 text-center">
            <p className="text-red-400 text-sm mb-4">{authConfigError}</p>
            <button
              type="button"
              className="text-[#9CA3AF] hover:text-white text-sm underline"
              onClick={async () => {
                await signOut();
                window.location.href = '/';
              }}
            >
              Sign out and go to login
            </button>
          </div>
        </div>
      );
    }
    if (user && connectionError) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md p-8 rounded-xl bg-[#1F2937] border border-amber-500/40 text-center">
            <p className="text-amber-200 text-sm mb-4">
              {storageBlocked ? STORAGE_BLOCKED_MESSAGE : 'Could not load your company profile. Please try again.'}
            </p>
            <button
              type="button"
              className="w-full mb-3 px-4 py-2 rounded-lg bg-[#3B82F6] text-white hover:bg-[#2563EB]"
              onClick={retryConnection}
            >
              Retry
            </button>
            <button
              type="button"
              className="text-[#9CA3AF] hover:text-white text-sm underline"
              onClick={async () => {
                await signOut();
                window.location.href = '/';
              }}
            >
              Sign out and go to login
            </button>
          </div>
        </div>
      );
    }
    return <CreateYourBusinessCard signOut={signOut} refreshUserProfile={refreshUserProfile} />;
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-3 bg-[#111827]/95 backdrop-blur border-b border-[#374151] flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
          <Store className="w-4 h-4" />
          <span>
            <span className="text-white">{periodLabel}</span>
            <span className="mx-2">·</span>
            <span className="text-white">{branchLabel}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1F2937] border border-[#374151] text-[#9CA3AF] hover:text-white text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
        {lastUpdated ? (
          <span className="text-xs text-[#6B7280]">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
        ) : null}
      </div>

      {error ? <DashboardErrorState message={error} onRetry={() => refetch()} /> : null}

      {isLoading && !data ? <DashboardSkeleton /> : null}

      {data ? (
        <>
          <ActionRequiredPanel alerts={data.alerts} onNavigate={handleNavigate} />

          <BusinessHealthGrid snapshot={data} formatCurrency={formatCurrency} showMoney={canExecutive} />

          {isEmptyPeriod && canExecutive ? (
            <DashboardEmptyState periodLabel={periodLabel} branchLabel={branchLabel} />
          ) : null}

          {showAllBranches && canExecutive && data.branchBreakdown.length ? (
            <BranchBreakdownTable rows={data.branchBreakdown} formatCurrency={formatCurrency} />
          ) : null}

          <MoneyFlowCharts charts={data.charts} formatCurrency={formatCurrency} showMoney={canExecutive} />
          <TopEntitiesCharts charts={data.charts} formatCurrency={formatCurrency} showMoney={canExecutive} />
          <OperationsPanel operations={data.operations} formatCurrency={formatCurrency} onNavigate={handleNavigate} />

          {data.limitations.length ? (
            <div className="rounded-xl border border-[#374151] bg-[#1F2937]/50 p-4">
              <div className="flex items-start gap-2 text-[#9CA3AF] text-xs">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <ul className="list-disc list-inside space-y-1">
                  {data.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default DashboardV2Page;
