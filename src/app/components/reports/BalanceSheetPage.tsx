import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Calendar, Users, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { FinancialReportPrintShell } from './shared/FinancialReportPrintShell';
import { shareViaWhatsApp } from '@/app/services/documentShareService';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/DatePicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useAccountingReportReload } from '@/app/hooks/useAccountingReportReload';
import { toast } from 'sonner';
import { accountingReportsService, BalanceSheetResult, type BalanceSheetLineItem } from '@/app/services/accountingReportsService';
import type { BalanceSheetAssetGroup } from '@/app/lib/accountHierarchy';
import { exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { fetchControlAccountBreakdown, type ControlAccountBreakdownResult, type PartyGlRow } from '@/app/services/controlAccountBreakdownService';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { useNavigation } from '@/app/context/NavigationContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/app/components/ui/utils';
import { canAccessBsPlUnifiedPreview } from '@/app/lib/accounting/bsPlUnifiedPreviewAccess';
import {
  compareBalanceSheetUnifiedPreview,
  DEFAULT_BS_PL_PREVIEW_BASIS,
  type BalanceSheetUnifiedPreviewDiff,
} from '@/app/lib/accounting/bsPlUnifiedPreviewDiff';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { useUnifiedLedgerEngineState } from '@/app/hooks/useUnifiedLedgerEngineState';
import { loadBalanceSheetUnifiedPreview } from '@/app/services/bsPlUnifiedPreviewService';
import type { BalanceSheetUnifiedPreviewLoadResult } from '@/app/services/bsPlUnifiedPreviewService';
import { BalanceSheetUnifiedPreviewPanel } from '@/app/components/accounting/BalanceSheetUnifiedPreviewPanel';
import {
  effectiveBalanceSheetMainLoaderSource,
  resolveBalanceSheetMainLoaderSource,
} from '@/app/lib/accounting/resolveBalanceSheetMainLoaderSource';
import { resolveBalanceSheetPreviewCompareSource } from '@/app/lib/accounting/resolveBalanceSheetPreviewCompareSource';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import {
  balanceSheetResultToPreviewShape,
  loadBalanceSheetUnifiedMain,
} from '@/app/services/bsPlUnifiedMainService';

// Group account items into standard Balance Sheet subgroups with subtotals
type GroupKey = string;
interface GroupedItem {
  groupLabel: string;
  items: BalanceSheetLineItem[];
  subtotal: number;
}

function groupAssets(items: BalanceSheetLineItem[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: BalanceSheetLineItem[] }> = {
    cash_bank: { label: 'Cash & Cash Equivalents', items: [] },
    inventory: { label: 'Inventory', items: [] },
    receivables: { label: 'Receivables', items: [] },
    advances: { label: 'Advances & prepayments', items: [] },
    other: { label: 'Other Assets', items: [] },
  };
  items.forEach((i) => {
    const g = i.bs_asset_group as BalanceSheetAssetGroup | undefined;
    if (g === 'cash_bank') {
      groups.cash_bank.items.push(i);
      return;
    }
    if (g === 'inventory') {
      groups.inventory.items.push(i);
      return;
    }
    if (g === 'receivables') {
      groups.receivables.items.push(i);
      return;
    }
    if (g === 'advances') {
      groups.advances.items.push(i);
      return;
    }
    if (g === 'other') {
      groups.other.items.push(i);
      return;
    }
    const n = (i.name || '').toLowerCase();
    const c = (i.code || '').toLowerCase();
    if (n.includes('cash') || n.includes('bank') || n.includes('wallet') || c.includes('1000') || c.includes('1010') || c.includes('1020')) {
      groups.cash_bank.items.push(i);
    } else if (n.includes('inventory') || n.includes('stock') || c.includes('1200') || c.includes('1300')) {
      groups.inventory.items.push(i);
    } else if (n.includes('receivable') || n.includes('receivables') || c.includes('1100')) {
      groups.receivables.items.push(i);
    } else if (n.includes('advance') && n.includes('worker')) {
      groups.advances.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });
  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([, g]) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
}

function groupLiabilities(items: BalanceSheetLineItem[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: BalanceSheetLineItem[] }> = {
    trade_payables: { label: 'Trade & other payables', items: [] },
    payroll_related: { label: 'Payroll & worker', items: [] },
    deposits_and_advances: { label: 'Deposits & advances held', items: [] },
    courier: { label: 'Courier payables', items: [] },
    other: { label: 'Other liabilities', items: [] },
  };
  items.forEach((i) => {
    const lg = i.bs_liability_group;
    if (lg === 'courier') {
      groups.courier.items.push(i);
      return;
    }
    if (lg === 'payroll_related') {
      groups.payroll_related.items.push(i);
      return;
    }
    if (lg === 'deposits_and_advances') {
      groups.deposits_and_advances.items.push(i);
      return;
    }
    if (lg === 'trade_payables') {
      groups.trade_payables.items.push(i);
      return;
    }
    const n = (i.name || '').toLowerCase();
    if (n.includes('courier')) {
      groups.courier.items.push(i);
    } else if (n.includes('worker') && n.includes('payable')) {
      groups.payroll_related.items.push(i);
    } else if (n.includes('deposit') || n.includes('rental advance')) {
      groups.deposits_and_advances.items.push(i);
    } else if (n.includes('payable') || n.includes('payables')) {
      groups.trade_payables.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });
  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([, g]) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
}

function groupEquity(items: { name: string; amount: number; code?: string }[]): GroupedItem[] {
  const groups: Record<GroupKey, { label: string; items: typeof items }> = {
    capital: { label: 'Owner Capital', items: [] },
    retained: { label: 'Retained Earnings', items: [] },
    other: { label: 'Other Equity', items: [] },
  };
  items.forEach((i) => {
    const n = (i.name || '').toLowerCase();
    if (n.includes('capital') || n.includes('owner')) {
      groups.capital.items.push(i);
    } else if (n.includes('retained') || n.includes('earnings') || n.includes('profit') || n.includes('net income')) {
      groups.retained.items.push(i);
    } else {
      groups.other.items.push(i);
    }
  });
  return Object.entries(groups)
    .filter(([, g]) => g.items.length > 0)
    .map(([, g]) => ({
      groupLabel: g.label,
      items: g.items,
      subtotal: g.items.reduce((s, i) => s + i.amount, 0),
    }));
}

const toExportGrouped = (
  r: BalanceSheetResult,
  formatCurrency: (n: number) => string,
  groupedAssets: GroupedItem[],
  groupedLiabilities: GroupedItem[],
  groupedEquity: GroupedItem[]
): ExportData => {
  const headers = ['Section', 'Group', 'Account', 'Code', 'Amount'];
  const rows: (string | number)[][] = [];
  const pushSection = (section: string, groups: GroupedItem[], sectionTotal: number) => {
    rows.push([section, '', '', '', '']);
    groups.forEach((g) => {
      rows.push(['', g.groupLabel, '', '', '']);
      g.items.forEach((i) => rows.push(['', g.groupLabel, i.name, i.code || '', formatCurrency(i.amount)]));
      rows.push(['', g.groupLabel, 'Subtotal', '', formatCurrency(g.subtotal)]);
    });
    rows.push([`Total ${section}`, '', '', '', formatCurrency(sectionTotal)]);
    rows.push([]);
  };
  pushSection(r.assets.label, groupedAssets, r.totalAssets);
  pushSection(r.liabilities.label, groupedLiabilities, r.liabilities.total);
  pushSection(r.equity.label, groupedEquity, r.equity.total);
  rows.push(['Total Liabilities & Equity', '', '', '', formatCurrency(r.totalLiabilitiesAndEquity)]);
  rows.push(['Difference (should be 0)', '', '', '', formatCurrency(r.difference)]);
  return {
    title: `Balance Sheet (GL) as at ${r.asOfDate}`,
    headers,
    rows,
  };
};

function SectionBlock({
  title,
  grouped,
  formatCurrency,
  sectionTotal,
  onPartyDrilldown,
}: {
  title: string;
  grouped: GroupedItem[];
  formatCurrency: (n: number) => string;
  sectionTotal: number;
  onPartyDrilldown?: (kind: 'ar' | 'ap') => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-6">
      <h3 className="text-lg font-semibold text-foreground mb-3">{title}</h3>
      <ul className="space-y-3">
        {grouped.map((g) => (
          <li key={g.groupLabel}>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{g.groupLabel}</div>
            <ul className="space-y-1.5 pl-2">
              {g.items.map((i) => (
                <li key={i.code || i.name} className={`flex justify-between items-center gap-2 text-sm ${i.amount < -0.005 ? 'bg-amber-500/10 -mx-2 px-2 rounded' : ''}`}>
                  <span className="text-muted-foreground flex items-center gap-2 min-w-0">
                    {i.name}
                    {i.amount < -0.005 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Unusual negative balance — check ledger" />
                    )}
                    {i.drilldownControl && onPartyDrilldown && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-indigo-400 shrink-0"
                        onClick={() => onPartyDrilldown(i.drilldownControl!)}
                      >
                        <Users className="w-3.5 h-3.5 mr-1" /> Parties
                      </Button>
                    )}
                  </span>
                  <span className={`tabular-nums shrink-0 ${i.amount < -0.005 ? 'text-amber-300 font-medium' : 'text-foreground'}`}>
                    {formatCurrency(i.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between text-sm font-medium text-muted-foreground border-t border-border mt-1.5 pt-1.5">
              Subtotal <span className="tabular-nums">{formatCurrency(g.subtotal)}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="flex justify-between font-medium text-foreground border-t border-border mt-3 pt-2">
        Total {title} <span className="tabular-nums">{formatCurrency(sectionTotal)}</span>
      </p>
    </div>
  );
}

export const BalanceSheetPage: React.FC<{
  asOfDate?: string;
  branchId?: string;
}> = ({ asOfDate: initialAsOfDate, branchId }) => {
  const { companyId, userRole } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { openLedgerStatementV2 } = useNavigation();
  const reportReloadEpoch = useAccountingReportReload({ companyId, branchId: branchId ?? null });
  const defaultDate = initialAsOfDate || new Date().toISOString().slice(0, 10);
  const [asOfDate, setAsOfDate] = useState(defaultDate);
  useEffect(() => {
    if (initialAsOfDate) setAsOfDate(initialAsOfDate);
  }, [initialAsOfDate]);
  const [data, setData] = useState<BalanceSheetResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchRetryKey, setFetchRetryKey] = useState(0);
  const [mainLoaderSource, setMainLoaderSource] = useState<'legacy' | 'unified'>('legacy');
  const [partyKind, setPartyKind] = useState<'ar' | 'ap' | null>(null);
  const [partyLoading, setPartyLoading] = useState(false);
  const [partyBreakdown, setPartyBreakdown] = useState<ControlAccountBreakdownResult | null>(null);

  const showUnifiedPreviewTools = canAccessBsPlUnifiedPreview(userRole);
  const [unifiedPreviewEnabled, setUnifiedPreviewEnabled] = useState(false);
  const [previewBasis, setPreviewBasis] = useState<UnifiedLedgerBasis>(DEFAULT_BS_PL_PREVIEW_BASIS);
  const [previewLoadResult, setPreviewLoadResult] = useState<BalanceSheetUnifiedPreviewLoadResult | null>(null);
  const [previewDiff, setPreviewDiff] = useState<BalanceSheetUnifiedPreviewDiff | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { state: engineState } = useUnifiedLedgerEngineState(companyId, {
    screenId: UNIFIED_LEDGER_SCREEN_IDS.BALANCE_SHEET,
    screenPreview: unifiedPreviewEnabled,
  });

  const previewCompareSource = useMemo(
    () => resolveBalanceSheetPreviewCompareSource(mainLoaderSource),
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
        const legacy = await accountingReportsService.getBalanceSheet(companyId, data.asOfDate, branchId);
        const previewShape = balanceSheetResultToPreviewShape(data);
        setPreviewLoadResult({
          preview: previewShape,
          tbPreview: {
            rows: [],
            accounts: [],
            totalDebit: 0,
            totalCredit: 0,
            difference: 0,
            basis: previewBasis,
            rpcScope: { branchId: null, asOfDate: data.asOfDate },
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
        setPreviewDiff(compareBalanceSheetUnifiedPreview({ legacy, preview: previewShape }));
        return;
      }

      const result = await loadBalanceSheetUnifiedPreview({
        companyId,
        asOfDate: data.asOfDate,
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
        setPreviewDiff(compareBalanceSheetUnifiedPreview({ legacy: data, preview: result.preview }));
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

  useEffect(() => {
    if (!companyId || !asOfDate) {
      if (!companyId) setLoading(true);
      return;
    }
    setLoading(true);
    setFetchError(null);
    (async () => {
      try {
        const resolved = await resolveBalanceSheetMainLoaderSource(companyId);
        const mainSource = effectiveBalanceSheetMainLoaderSource(resolved);
        setMainLoaderSource(mainSource);

        if (mainSource === 'unified') {
          try {
            const unified = await loadBalanceSheetUnifiedMain({
              companyId,
              asOfDate,
              branchId,
              basis: previewBasis,
            });
            setData(unified);
            return;
          } catch (unifiedErr) {
            console.warn('Unified Balance Sheet main loader failed; falling back to legacy.', unifiedErr);
          }
        }

        const legacy = await accountingReportsService.getBalanceSheet(companyId, asOfDate, branchId);
        setData(legacy);
        if (mainSource === 'unified') {
          setMainLoaderSource('legacy');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load balance sheet';
        setFetchError(msg);
        toast.error(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, asOfDate, branchId, fetchRetryKey, previewBasis, reportReloadEpoch]);

  const groupedAssets = useMemo(() => (data ? groupAssets(data.assets.items) : []), [data]);
  const groupedLiabilities = useMemo(() => (data ? groupLiabilities(data.liabilities.items) : []), [data]);
  const groupedEquity = useMemo(() => (data ? groupEquity(data.equity.items) : []), [data]);
  const branchLabel = branchId && branchId !== 'all' ? 'Branch scope' : 'All branches';

  const exportPayload = useMemo(() => {
    if (!data) return null;
    const ga = groupedAssets.length > 0 ? groupedAssets : [{ groupLabel: 'Assets', items: data.assets.items, subtotal: data.totalAssets }];
    const gl = groupedLiabilities.length > 0 ? groupedLiabilities : [{ groupLabel: 'Liabilities', items: data.liabilities.items, subtotal: data.liabilities.total }];
    const ge = groupedEquity.length > 0 ? groupedEquity : [{ groupLabel: 'Equity', items: data.equity.items, subtotal: data.equity.total }];
    return toExportGrouped(data, formatCurrency, ga, gl, ge);
  }, [data, formatCurrency, groupedAssets, groupedLiabilities, groupedEquity]);

  const handleExportExcel = () => {
    if (!exportPayload) return;
    exportToExcel(exportPayload, `Balance_Sheet_GL_${data!.asOfDate}`);
  };
  const handleWhatsApp = () => {
    if (!data) return;
    void shareViaWhatsApp(
      `Balance Sheet (GL)\nAs at ${data.asOfDate}\nTotal Assets: ${formatCurrency(data.totalAssets)}\nL+E: ${formatCurrency(data.totalLiabilitiesAndEquity)}`
    );
  };

  const openPartyDrilldown = async (kind: 'ar' | 'ap') => {
    if (!companyId) return;
    setPartyKind(kind);
    setPartyLoading(true);
    setPartyBreakdown(null);
    try {
      const code = kind === 'ar' ? '1100' : '2000';
      const { data: acc } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('code', code)
        .maybeSingle();
      if (!acc?.id) {
        setPartyBreakdown(null);
        return;
      }
      const b = await fetchControlAccountBreakdown({
        companyId,
        branchId: branchId === 'all' ? null : branchId ?? null,
        accountId: acc.id,
        accountCode: String(acc.code || code),
        accountName: String(acc.name || ''),
        controlKind: kind === 'ar' ? 'ar' : 'ap',
        asOfDate,
      });
      setPartyBreakdown(b);
    } catch {
      setPartyBreakdown(null);
    } finally {
      setPartyLoading(false);
    }
  };

  const openPartyLedgerV2 = (row: PartyGlRow) => {
    if (!partyKind) return;
    openLedgerStatementV2?.({
      entityId: row.contactId,
      statementType: partyKind === 'ar' ? 'customer' : 'supplier',
      entityLabel: row.name,
    });
    setPartyKind(null);
    setPartyBreakdown(null);
  };

  const formatPartyCode = (row: PartyGlRow) => {
    if (row.contactCode) return row.contactCode;
    if (row.subledgerAccountCode) return row.subledgerAccountCode;
    return '—';
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
      <div className="rounded-xl border border-border bg-muted/40 p-6 text-center text-muted-foreground">
        <p className="font-medium">{fetchError || 'No data for the selected period'}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {fetchError ? 'Check your connection and try again.' : 'Adjust the date or ensure journal entries exist.'}
        </p>
        {fetchError ? (
          <Button variant="outline" className="mt-4 border-border" onClick={() => { setFetchError(null); setFetchRetryKey((k) => k + 1); }}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-balance-sheet-main-loader={mainLoaderSource}>
      <ReportBasisBanner
        basis="official_gl"
        detail="Point-in-time balance sheet from posted accounts. Party “Parties” drill-down is Party GL attribution, not operational due."
      />
      {showUnifiedPreviewTools ? (
        <div className="flex flex-wrap items-center gap-3 no-print">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={unifiedPreviewEnabled}
              disabled={engineState.killSwitchActive}
              onChange={(e) => setUnifiedPreviewEnabled(e.target.checked)}
              className="rounded border-gray-600 disabled:opacity-50"
            />
            Unified TB preview (Balance Sheet compare only)
          </label>
          {unifiedPreviewEnabled ? (
            <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => void loadUnifiedPreview()}>
              Refresh preview
            </Button>
          ) : null}
        </div>
      ) : null}
      {unifiedPreviewEnabled && showUnifiedPreviewTools ? (
        <BalanceSheetUnifiedPreviewPanel
          asOfDate={data.asOfDate}
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
        actionsTitle="Balance Sheet (GL)"
        reportTitle="Balance Sheet (GL)"
        periodLabel={`As at ${data.asOfDate}`}
        branchLabel={branchLabel}
        previewReference={`balance-sheet-${asOfDate}`}
        exportPayload={exportPayload}
        onExcel={handleExportExcel}
        onWhatsapp={handleWhatsApp}
      />
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <label className="text-sm text-muted-foreground whitespace-nowrap">As at date</label>
            <DatePicker
              value={asOfDate}
              onChange={(v) => setAsOfDate(v)}
              className="w-[160px]"
            />
          </div>
          {data.difference !== 0 && (
            <span
              className="text-amber-400 text-sm font-medium"
              title="Assets ≠ L+E after absorbing all accounts. This equals the Trial Balance imbalance — unbalanced journal entries exist. Use Integrity Lab to find them."
            >
              ⚠ Difference: {formatCurrency(data.difference)}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        <SectionBlock
          title={data.assets.label}
          grouped={groupedAssets.length > 0 ? groupedAssets : [{ groupLabel: 'Assets', items: data.assets.items, subtotal: data.totalAssets }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.totalAssets}
          onPartyDrilldown={openPartyDrilldown}
        />
        <SectionBlock
          title={data.liabilities.label}
          grouped={groupedLiabilities.length > 0 ? groupedLiabilities : [{ groupLabel: 'Liabilities', items: data.liabilities.items, subtotal: data.liabilities.total }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.liabilities.total}
          onPartyDrilldown={openPartyDrilldown}
        />
        <SectionBlock
          title={data.equity.label}
          grouped={groupedEquity.length > 0 ? groupedEquity : [{ groupLabel: 'Equity', items: data.equity.items, subtotal: data.equity.total }]}
          formatCurrency={formatCurrency}
          sectionTotal={data.equity.total}
        />
      </div>
      <div className="rounded-xl border border-border bg-accent/30 p-4 flex justify-between items-center">
        <span className="font-medium text-foreground">Total Liabilities + Equity</span>
        <span className="text-foreground tabular-nums">{formatCurrency(data.totalLiabilitiesAndEquity)}</span>
      </div>

      {/* Trial Balance Imbalance diagnostic — shown only when non-zero */}
      {data.tbImbalance !== 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/95 space-y-1">
            <p className="font-semibold">
              Trial Balance imbalance detected: <span className="tabular-nums">{formatCurrency(data.tbImbalance)}</span>
            </p>
            <p className="text-amber-200/80 text-xs leading-relaxed">
              Assets = Liabilities + Equity holds for all properly double-entered transactions.
              This <strong>{formatCurrency(Math.abs(data.tbImbalance))}</strong> gap means one or more journal entries
              have unequal debit and credit sides. This is a data integrity issue, not a reporting formula issue.
            </p>
            <p className="text-amber-200/80 text-xs">
              <strong>Fix:</strong> Go to <span className="font-medium text-foreground">AR/AP Diagnostics → Tie-out</span> (unbalanced JEs / TB difference rows)
              to identify the specific entry/entries causing this imbalance, then reverse or manually adjust them.
            </p>
          </div>
        </div>
      )}

      <Dialog open={partyKind !== null} onOpenChange={(o) => !o && setPartyKind(null)}>
        <DialogContent className="max-w-2xl bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>
              {partyKind === 'ar' ? 'Receivables — party breakdown' : partyKind === 'ap' ? 'Payables — party breakdown' : 'Party breakdown'}
            </DialogTitle>
          </DialogHeader>
          {partyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          ) : partyBreakdown?.partyRows?.length ? (
            <div className="space-y-2">
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/95 text-muted-foreground text-left">
                    <tr>
                      <th className="py-2 px-3 font-medium">Code</th>
                      <th className="py-2 px-3 font-medium">Party</th>
                      <th className="py-2 px-3 font-medium text-right">GL balance</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {partyBreakdown.partyRows.map((r) => (
                      <tr
                        key={r.contactId}
                        className={cn(
                          'border-t border-border/80 cursor-pointer hover:bg-indigo-950/30 transition-colors',
                          r.glAmount < -0.005 && 'bg-amber-950/10'
                        )}
                        onClick={() => openPartyLedgerV2(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openPartyLedgerV2(r);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        title="Open Account Statements for this party"
                      >
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{formatPartyCode(r)}</td>
                        <td className="py-2 px-3 text-gray-200 truncate max-w-[220px]">{r.name}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-foreground shrink-0">
                          {formatCurrency(r.glAmount)}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          <ChevronRight className="w-4 h-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Click a row to open Account Statements for that party.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No party rows or data unavailable (ensure GL mapping RPC is applied).</p>
          )}
          {partyBreakdown?.partySectionNote && (
            <p className="text-xs text-amber-200/90">{partyBreakdown.partySectionNote}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
