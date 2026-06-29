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
import type { CashFlowUnifiedPreviewDiff } from '@/app/lib/accounting/cashFlowUnifiedPreviewDiff';
import type { CashFlowUnifiedPreviewLoadResult } from '@/app/services/cashFlowUnifiedPreviewService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function CashFlowUnifiedPreviewPanel({
  dateFrom,
  dateTo,
  branchLabel,
  auditMode,
  loadResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
}: {
  dateFrom: string;
  dateTo: string;
  branchLabel: string;
  auditMode: boolean;
  loadResult: CashFlowUnifiedPreviewLoadResult | null;
  diff: CashFlowUnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
}) {
  const { formatCurrency } = useFormatCurrency();

  const exportPayload = useMemo(
    () => ({
      phase: '3B',
      screen: 'cash_flow',
      dateFrom,
      dateTo,
      branchLabel,
      auditMode,
      previewBasis,
      engineState,
      diff,
      preview: loadResult?.preview ?? null,
      roznamchaMeta: loadResult?.roznamchaPreview?.meta ?? null,
      accountingRuleNotes: loadResult?.preview?.accountingRuleNotes ?? [],
      exportedAt: new Date().toISOString(),
      note: 'PREVIEW_ONLY — legacy Cash Flow table remains authoritative. NEEDS_FINANCE_GOLDEN_APPROVAL.',
    }),
    [dateFrom, dateTo, branchLabel, auditMode, previewBasis, engineState, diff, loadResult]
  );

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4 no-print"
      data-cash-flow-preview-compare="unified_roznamcha_derived"
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-amber-100">Unified Roznamcha preview compare (Cash Flow)</h3>
          <UnifiedLedgerPreviewBadge mode={engineState.mode} />
          <span className="text-xs text-amber-200/80 border border-amber-700/50 rounded px-1.5 py-0.5">
            PREVIEW_ONLY
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadCompareJson(`phase3b-compare-cash-flow-${Date.now()}.json`, exportPayload)}
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
        detail={`${unifiedBasisBannerLabel(previewBasis)} — derived from unified cash/bank ledger. Legacy getCashFlowReport → roznamchaService remains main.`}
      />

      {auditMode ? (
        <p className="text-xs text-blue-300/80">
          Audit mode: preview includes voided/reversal visibility per unified basis. Normal mode excludes them on both sides.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-gray-400">Loading unified preview…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {diff && loadResult?.preview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Legacy (main)</p>
            <p className="flex justify-between">
              <span>Cash In</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyCashIn)}</span>
            </p>
            <p className="flex justify-between">
              <span>Cash Out</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyCashOut)}</span>
            </p>
            <p className="flex justify-between">
              <span>Net movement</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyNetMovement)}</span>
            </p>
            <p className="flex justify-between">
              <span>Closing</span>
              <span className="tabular-nums">{formatCurrency(diff.legacyClosing)}</span>
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Unified preview</p>
            <p className="flex justify-between">
              <span>Cash In</span>
              <span className="tabular-nums">{formatCurrency(diff.previewCashIn)}</span>
            </p>
            <p className="flex justify-between">
              <span>Cash Out</span>
              <span className="tabular-nums">{formatCurrency(diff.previewCashOut)}</span>
            </p>
            <p className="flex justify-between">
              <span>Net movement</span>
              <span className="tabular-nums">{formatCurrency(diff.previewNetMovement)}</span>
            </p>
            <p className="flex justify-between">
              <span>Closing</span>
              <span className="tabular-nums">{formatCurrency(diff.previewClosing)}</span>
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
          <p className="font-medium">
            {diff.pass ? 'Summary totals match (within tolerance)' : 'Summary total differences detected'}
          </p>
          <ul className="mt-2 space-y-1 text-xs tabular-nums">
            <li>Opening Δ {formatCurrency(diff.openingDelta)}</li>
            <li>Cash In Δ {formatCurrency(diff.cashInDelta)}</li>
            <li>Cash Out Δ {formatCurrency(diff.cashOutDelta)}</li>
            <li>Net movement Δ {formatCurrency(diff.netMovementDelta)}</li>
            <li>Closing Δ {formatCurrency(diff.closingDelta)}</li>
            <li>Row count Δ {diff.rowCountDelta} (legacy {diff.legacyRowCount} · preview {diff.previewRowCount})</li>
          </ul>
          <p className="mt-2 text-xs text-gray-400">NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.</p>
        </div>
      ) : null}
    </div>
  );
}
