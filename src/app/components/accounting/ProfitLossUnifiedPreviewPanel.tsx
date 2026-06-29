'use client';

import React, { useMemo } from 'react';
import type { UnifiedLedgerEngineState } from '@/app/lib/unifiedLedgerEngineState';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { UNIFIED_LEDGER_BASIS_LABELS } from '@/app/lib/unifiedLedgerBasisFilter';
import { unifiedBasisBannerLabel } from '@/app/lib/unifiedLedgerBasisUi';
import { UnifiedLedgerEngineBanner } from '@/app/components/accounting/UnifiedLedgerEngineBanner';
import { UnifiedLedgerPreviewBadge } from '@/app/components/accounting/UnifiedLedgerPreviewBadge';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { downloadCompareJson } from '@/app/components/admin/unified-ledger-compare/CompareSummaryCards';
import { Button } from '@/app/components/ui/button';
import type { ProfitLossUnifiedPreviewDiff } from '@/app/lib/accounting/bsPlUnifiedPreviewDiff';
import type { ProfitLossUnifiedPreviewLoadResult } from '@/app/services/bsPlUnifiedPreviewService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function ProfitLossUnifiedPreviewPanel({
  startDate,
  endDate,
  branchLabel,
  loadResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
}: {
  startDate: string;
  endDate: string;
  branchLabel: string;
  loadResult: ProfitLossUnifiedPreviewLoadResult | null;
  diff: ProfitLossUnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
}) {
  const { formatCurrency } = useFormatCurrency();

  const exportPayload = useMemo(
    () => ({
      phase: '3A',
      screen: 'profit_loss',
      startDate,
      endDate,
      branchLabel,
      previewBasis,
      engineState,
      diff,
      preview: loadResult?.preview ?? null,
      tbMeta: loadResult?.tbPreview?.meta ?? null,
      accountingRuleNotes: loadResult?.preview?.accountingRuleNotes ?? [],
      exportedAt: new Date().toISOString(),
      note: 'PREVIEW_ONLY — legacy P&L remains authoritative. COGS heuristic NEEDS_RULE_CONFIRMATION.',
    }),
    [startDate, endDate, branchLabel, previewBasis, engineState, diff, loadResult]
  );

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4 no-print"
      data-profit-loss-preview-compare="unified_tb_derived"
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-amber-100">Unified TB preview compare (P&L)</h3>
          <UnifiedLedgerPreviewBadge mode={engineState.mode} />
          <span className="text-xs text-amber-200/80 border border-amber-700/50 rounded px-1.5 py-0.5">
            PREVIEW_ONLY
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadCompareJson(`phase3a-compare-profit-loss-${Date.now()}.json`, exportPayload)}
          disabled={!diff}
        >
          Export compare JSON
        </Button>
      </div>

      <UnifiedLedgerEngineBanner mode={engineState.mode} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">Preview basis:</span>
        {PREVIEW_BASIS_OPTIONS.map((b) => (
          <button
            key={b}
            type="button"
            className={`text-xs px-2 py-1 rounded border ${
              previewBasis === b
                ? 'border-amber-500 text-amber-100 bg-amber-500/10'
                : 'border-gray-700 text-gray-400'
            }`}
            onClick={() => onPreviewBasisChange(b)}
          >
            {UNIFIED_LEDGER_BASIS_LABELS[b]}
          </button>
        ))}
      </div>

      <ReportBasisBanner
        basis={previewBasis}
        detail={`${unifiedBasisBannerLabel(previewBasis)} — derived from get_unified_trial_balance. Legacy getProfitLoss remains main.`}
      />

      {loading ? <p className="text-sm text-gray-400">Loading unified preview…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {diff && loadResult?.preview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Legacy (main)</p>
            <p className="flex justify-between">
              <span>Revenue</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyRevenue)}</span>
            </p>
            <p className="flex justify-between">
              <span>Cost of Sales</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyCostOfSales)}</span>
            </p>
            <p className="flex justify-between">
              <span>Net Profit</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyNetProfit)}</span>
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Unified preview</p>
            <p className="flex justify-between">
              <span>Revenue</span>
              <span className="tabular-nums">{formatCurrency(diff.previewRevenue)}</span>
            </p>
            <p className="flex justify-between">
              <span>Cost of Sales</span>
              <span className="tabular-nums">{formatCurrency(diff.previewCostOfSales)}</span>
            </p>
            <p className="flex justify-between">
              <span>Net Profit</span>
              <span className="tabular-nums">{formatCurrency(diff.previewNetProfit)}</span>
            </p>
          </div>
        </div>
      ) : null}

      {diff ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            diff.pass
              ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-200'
              : 'border-amber-800/60 bg-amber-950/20 text-amber-100'
          }`}
        >
          <p className="font-medium">{diff.pass ? 'Section totals match (within tolerance)' : 'Section total differences detected'}</p>
          <ul className="mt-2 space-y-1 text-xs tabular-nums">
            <li>Revenue Δ {formatCurrency(diff.revenueDelta)}</li>
            <li>COGS Δ {formatCurrency(diff.costDelta)}</li>
            <li>Expenses Δ {formatCurrency(diff.expensesDelta)}</li>
            <li>Net Profit Δ {formatCurrency(diff.netProfitDelta)}</li>
          </ul>
          <p className="mt-2 text-xs text-gray-400">NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.</p>
        </div>
      ) : null}
    </div>
  );
}
