import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, GitCompare } from 'lucide-react';
import { FinancialReportPrintShell } from './shared/FinancialReportPrintShell';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingReportsService, ProfitLossResult } from '@/app/services/accountingReportsService';
import { exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { shareViaWhatsApp } from '@/app/services/documentShareService';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { canAccessBsPlUnifiedPreview } from '@/app/lib/accounting/bsPlUnifiedPreviewAccess';
import {
  compareProfitLossUnifiedPreview,
  DEFAULT_BS_PL_PREVIEW_BASIS,
  type ProfitLossUnifiedPreviewDiff,
} from '@/app/lib/accounting/bsPlUnifiedPreviewDiff';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { useUnifiedLedgerEngineState } from '@/app/hooks/useUnifiedLedgerEngineState';
import { loadProfitLossUnifiedPreview } from '@/app/services/bsPlUnifiedPreviewService';
import type { ProfitLossUnifiedPreviewLoadResult } from '@/app/services/bsPlUnifiedPreviewService';
import { ProfitLossUnifiedPreviewPanel } from '@/app/components/accounting/ProfitLossUnifiedPreviewPanel';
import {
  effectiveProfitLossMainLoaderSource,
  resolveProfitLossMainLoaderSource,
} from '@/app/lib/accounting/resolveProfitLossMainLoaderSource';
import { resolveProfitLossPreviewCompareSource } from '@/app/lib/accounting/resolveProfitLossPreviewCompareSource';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import {
  loadProfitLossUnifiedMain,
  profitLossResultToPreviewShape,
} from '@/app/services/bsPlUnifiedMainService';

const toExport = (
  r: ProfitLossResult,
  formatCurrency: (n: number) => string,
  periodLabel: string
): ExportData => {
  const comp = r.comparison;
  const headers = comp
    ? ['Section', 'Code', `Current (${r.startDate}–${r.endDate})`, `Prior (${comp.startDate}–${comp.endDate})`]
    : ['Section', 'Code', 'Amount'];
  const amt = (n: number, prior?: number) =>
    comp ? [formatCurrency(n), formatCurrency(prior ?? 0)] : [formatCurrency(n)];
  const rows: (string | number)[][] = [
    ['Revenue', '', ...(comp ? ['', ''] : [''])],
    ...r.revenue.items.map((i) => [i.name, i.code || '', ...amt(i.amount)]),
    ['Total Revenue', '', ...amt(r.revenue.total, comp?.revenue)],
    [],
    ['Cost of Sales', '', ...(comp ? ['', ''] : [''])],
    ...r.costOfSales.items.map((i) => [i.name, i.code || '', ...amt(i.amount)]),
    ['Total Cost of Sales', '', ...amt(r.costOfSales.total, comp?.costOfSales)],
    ['Gross Profit', '', ...amt(r.grossProfit, comp?.grossProfit)],
    [],
    ['Expenses', '', ...(comp ? ['', ''] : [''])],
    ...r.expenses.items.map((i) => [i.name, i.code || '', ...amt(i.amount)]),
    ['Total Expenses', '', ...amt(r.expenses.total, comp?.expenses)],
    [],
    ['Net Profit', '', ...amt(r.netProfit, comp?.netProfit)],
  ];
  return { title: `Profit & Loss (GL) — ${periodLabel}`, headers, rows };
};

function getCompareDates(startDate: string, endDate: string, period: 'prior-month' | 'prior-quarter'): { compareStart: string; compareEnd: string } {
  const end = new Date(endDate);
  const start = new Date(startDate);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (period === 'prior-month') {
    const compareEnd = new Date(start);
    compareEnd.setDate(compareEnd.getDate() - 1);
    const compareStart = new Date(compareEnd);
    compareStart.setDate(compareStart.getDate() - days);
    return { compareStart: compareStart.toISOString().slice(0, 10), compareEnd: compareEnd.toISOString().slice(0, 10) };
  }
  const compareEnd = new Date(start);
  compareEnd.setDate(compareEnd.getDate() - 1);
  const compareStart = new Date(compareEnd);
  compareStart.setDate(compareStart.getDate() - days);
  return { compareStart: compareStart.toISOString().slice(0, 10), compareEnd: compareEnd.toISOString().slice(0, 10) };
}

export const ProfitLossPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string;
}> = ({ startDate, endDate, branchId }) => {
  const { companyId, userRole } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [data, setData] = useState<ProfitLossResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchRetryKey, setFetchRetryKey] = useState(0);
  const [mainLoaderSource, setMainLoaderSource] = useState<'legacy' | 'unified'>('legacy');
  const [comparePeriod, setComparePeriod] = useState<'none' | 'prior-month' | 'prior-quarter'>('none');

  const showUnifiedPreviewTools = canAccessBsPlUnifiedPreview(userRole);
  const [unifiedPreviewEnabled, setUnifiedPreviewEnabled] = useState(false);
  const [previewBasis, setPreviewBasis] = useState<UnifiedLedgerBasis>(DEFAULT_BS_PL_PREVIEW_BASIS);
  const [previewLoadResult, setPreviewLoadResult] = useState<ProfitLossUnifiedPreviewLoadResult | null>(null);
  const [previewDiff, setPreviewDiff] = useState<ProfitLossUnifiedPreviewDiff | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { state: engineState } = useUnifiedLedgerEngineState(companyId, {
    screenId: UNIFIED_LEDGER_SCREEN_IDS.PROFIT_LOSS,
    screenPreview: unifiedPreviewEnabled,
  });

  const previewCompareSource = useMemo(
    () => resolveProfitLossPreviewCompareSource(mainLoaderSource),
    [mainLoaderSource],
  );

  const loadUnifiedPreview = useCallback(async () => {
    if (!companyId || !data || !unifiedPreviewEnabled) {
      setPreviewLoadResult(null);
      setPreviewDiff(null);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      if (previewCompareSource === 'legacy_shadow') {
        const legacy = await accountingReportsService.getProfitLoss(
          companyId,
          data.startDate,
          data.endDate,
          branchId,
        );
        const previewShape = profitLossResultToPreviewShape(data);
        setPreviewLoadResult({
          preview: previewShape,
          tbPreview: {
            rows: [],
            accounts: [],
            totalDebit: 0,
            totalCredit: 0,
            difference: 0,
            basis: previewBasis,
            rpcScope: { branchId: null, asOfDate: data.endDate },
            meta: {
              engine: 'unified_shadow',
              basis: previewBasis,
              featureFlagEnabled: true,
              shadowForce: false,
              queryDurationMs: 0,
              rowCount: 0,
              periodOpeningBalance: 0,
            },
          },
          basis: previewBasis,
        });
        setPreviewDiff(compareProfitLossUnifiedPreview({ legacy, preview: previewShape }));
        return;
      }

      const result = await loadProfitLossUnifiedPreview({
        companyId,
        startDate: data.startDate,
        endDate: data.endDate,
        branchId,
        basis: previewBasis,
      });
      setPreviewLoadResult(result);
      if (result.tbPreview.blockedByKillSwitch) {
        setPreviewDiff(null);
        setPreviewError(result.tbPreview.blockReason ?? 'Unified preview blocked.');
        return;
      }
      if (result.preview) {
        setPreviewDiff(compareProfitLossUnifiedPreview({ legacy: data, preview: result.preview }));
      } else {
        setPreviewDiff(null);
      }
    } catch (err) {
      console.error(err);
      setPreviewLoadResult(null);
      setPreviewDiff(null);
      setPreviewError('Unified preview failed to load');
    } finally {
      setPreviewLoading(false);
    }
  }, [companyId, data, unifiedPreviewEnabled, branchId, previewBasis, previewCompareSource]);

  useEffect(() => {
    if (!unifiedPreviewEnabled) {
      setPreviewLoadResult(null);
      setPreviewDiff(null);
      setPreviewError(null);
      return;
    }
    void loadUnifiedPreview();
  }, [unifiedPreviewEnabled, loadUnifiedPreview]);

  const compareOptions = useMemo(() => {
    if (comparePeriod === 'none') return undefined;
    return getCompareDates(startDate, endDate, comparePeriod === 'prior-quarter' ? 'prior-quarter' : 'prior-month');
  }, [startDate, endDate, comparePeriod]);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      if (!companyId) setLoading(true);
      return;
    }
    setLoading(true);
    setFetchError(null);
    (async () => {
      try {
        const resolved = await resolveProfitLossMainLoaderSource(companyId);
        const mainSource = effectiveProfitLossMainLoaderSource(resolved);
        setMainLoaderSource(mainSource);

        const compareArgs = compareOptions
          ? { compareStartDate: compareOptions.compareStart, compareEndDate: compareOptions.compareEnd }
          : {};

        if (mainSource === 'unified') {
          try {
            const unified = await loadProfitLossUnifiedMain({
              companyId,
              startDate,
              endDate,
              branchId,
              basis: previewBasis,
              ...compareArgs,
            });
            setData(unified);
            return;
          } catch (unifiedErr) {
            console.warn('Unified P&L main loader failed; falling back to legacy.', unifiedErr);
          }
        }

        const legacy = await accountingReportsService.getProfitLoss(
          companyId,
          startDate,
          endDate,
          branchId,
          compareArgs.compareStartDate && compareArgs.compareEndDate ? compareArgs : undefined,
        );
        setData(legacy);
        if (mainSource === 'unified') {
          setMainLoaderSource('legacy');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load profit & loss';
        setFetchError(msg);
        toast.error(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    companyId,
    startDate,
    endDate,
    branchId,
    compareOptions?.compareStart,
    compareOptions?.compareEnd,
    fetchRetryKey,
    previewBasis,
  ]);

  const exportPeriodLabel = `${data?.startDate ?? startDate} to ${data?.endDate ?? endDate}`;
  const branchLabel = branchId && branchId !== 'all' ? 'Branch scope' : 'All branches';

  const exportPayload = useMemo(
    () => (data ? toExport(data, formatCurrency, exportPeriodLabel) : null),
    [data, formatCurrency, exportPeriodLabel]
  );

  const handleExportExcel = () => {
    if (!exportPayload) return;
    exportToExcel(exportPayload, `P_L_GL_${data!.startDate}_${data!.endDate}`);
  };
  const handleWhatsApp = () => {
    if (!data) return;
    void shareViaWhatsApp(
      `Profit & Loss (GL)\n${exportPeriodLabel}\nNet Profit: ${formatCurrency(data.netProfit)}\nRevenue: ${formatCurrency(data.revenue.total)}`
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-center text-gray-400">
        <p className="font-medium">{fetchError || 'No data for the selected period'}</p>
        {fetchError ? (
          <Button variant="outline" className="mt-4 border-gray-700" onClick={() => { setFetchError(null); setFetchRetryKey((k) => k + 1); }}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  const comp = data.comparison;

  return (
    <div className="space-y-4" data-profit-loss-main-loader={mainLoaderSource}>
      <ReportBasisBanner
        basis="official_gl"
        detail='Reports Overview "operational flow" uses documents — do not compare without reading both labels.'
      />
      {showUnifiedPreviewTools ? (
        <div className="flex flex-wrap items-center gap-3 no-print">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={unifiedPreviewEnabled}
              disabled={engineState.killSwitchActive}
              onChange={(e) => setUnifiedPreviewEnabled(e.target.checked)}
              className="rounded border-gray-600 disabled:opacity-50"
            />
            Unified TB preview (P&L compare only)
          </label>
          {unifiedPreviewEnabled ? (
            <Button type="button" variant="outline" size="sm" className="border-gray-700" onClick={() => void loadUnifiedPreview()}>
              Refresh preview
            </Button>
          ) : null}
        </div>
      ) : null}
      {unifiedPreviewEnabled && showUnifiedPreviewTools ? (
        <ProfitLossUnifiedPreviewPanel
          startDate={data.startDate}
          endDate={data.endDate}
          branchLabel={branchLabel}
          loadResult={previewLoadResult}
          diff={previewDiff}
          loading={previewLoading}
          error={previewError}
          engineState={engineState}
          previewBasis={previewBasis}
          onPreviewBasisChange={setPreviewBasis}
        />
      ) : null}
      <FinancialReportPrintShell
        companyId={companyId}
        actionsTitle="Profit & Loss (GL)"
        reportTitle="Profit & Loss (GL)"
        periodLabel={exportPeriodLabel}
        branchLabel={branchLabel}
        previewReference={`profit-loss-${data.startDate}-${data.endDate}`}
        exportPayload={exportPayload}
        onExcel={handleExportExcel}
        onWhatsapp={handleWhatsApp}
      />
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-400">
          Period: {data.startDate} to {data.endDate}
          {comp && (
            <span className="ml-2 text-gray-500">
              • Compare: {comp.startDate} to {comp.endDate}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <GitCompare size={14} className="text-gray-400" />
            <Select value={comparePeriod} onValueChange={(v: 'none' | 'prior-month' | 'prior-quarter') => setComparePeriod(v)}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-gray-700 bg-gray-800">
                <SelectValue placeholder="Compare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No comparison</SelectItem>
                <SelectItem value="prior-month">Prior month</SelectItem>
                <SelectItem value="prior-quarter">Prior period</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-6 no-print">
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">{data.revenue.label}</h3>
          <ul className="space-y-1">
            {data.revenue.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between font-medium text-white border-t border-gray-700 mt-2 pt-2">
            Total Revenue
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.revenue)}</span>}
              <span>{formatCurrency(data.revenue.total)}</span>
            </span>
          </p>
        </section>
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">{data.costOfSales.label}</h3>
          <ul className="space-y-1">
            {data.costOfSales.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-gray-300 border-t border-gray-700 mt-2 pt-2">
            Total Cost of Sales
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.costOfSales)}</span>}
              <span>{formatCurrency(data.costOfSales.total)}</span>
            </span>
          </p>
          <p className="flex justify-between font-medium text-green-400 mt-1">
            Gross Profit
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.grossProfit)}</span>}
              <span>{formatCurrency(data.grossProfit)}</span>
            </span>
          </p>
        </section>
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">{data.expenses.label}</h3>
          <ul className="space-y-1">
            {data.expenses.items.map((i) => (
              <li key={i.code || i.name} className="flex justify-between text-sm">
                <span className="text-gray-300">{i.name}</span>
                <span className="text-white">{formatCurrency(i.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-gray-300 border-t border-gray-700 mt-2 pt-2">
            Total Expenses
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-xs">Prior: {formatCurrency(comp.expenses)}</span>}
              <span>{formatCurrency(data.expenses.total)}</span>
            </span>
          </p>
        </section>
        <section className="border-t-2 border-gray-700 pt-4">
          <p className="flex justify-between text-xl font-bold text-white">
            Net Profit
            <span className="flex items-center gap-4">
              {comp && <span className="text-gray-500 text-sm font-normal">Prior: {formatCurrency(comp.netProfit)}</span>}
              <span className={data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(data.netProfit)}</span>
            </span>
          </p>
        </section>
      </div>
    </div>
  );
};
