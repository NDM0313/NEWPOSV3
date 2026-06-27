'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { UnifiedLedgerEngineState } from '@/app/lib/unifiedLedgerEngineState';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { unifiedBasisBannerLabel } from '@/app/lib/unifiedLedgerBasisUi';
import { UNIFIED_LEDGER_BASIS_LABELS } from '@/app/lib/unifiedLedgerBasisFilter';
import { UnifiedLedgerEngineBanner } from '@/app/components/accounting/UnifiedLedgerEngineBanner';
import { UnifiedLedgerPreviewBadge } from '@/app/components/accounting/UnifiedLedgerPreviewBadge';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import {
  CompareSummaryCards,
  downloadCompareJson,
} from '@/app/components/admin/unified-ledger-compare/CompareSummaryCards';
import { Button } from '@/app/components/ui/button';
import type { TrialBalanceUnifiedPreviewDiff } from '@/app/lib/trialBalanceUnifiedPreviewDiff';
import type { TrialBalanceUnifiedPreviewResult } from '@/app/services/trialBalanceUnifiedPreviewService';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import {
  trialBalancePreviewCompareLabels,
  type TrialBalancePreviewCompareSource,
} from '@/app/lib/resolveTrialBalancePreviewCompareSource';
import type { TrialBalanceArApMode } from '@/app/services/accountingReportsService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function TrialBalanceUnifiedPreviewPanel({
  startDate,
  endDate,
  branchLabel,
  previewResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
  searchActive,
  arApMode,
  periodDiffersFromAsOf,
  previewCompareSource = 'unified_compare',
}: {
  startDate: string;
  endDate: string;
  branchLabel: string;
  previewResult: TrialBalanceUnifiedPreviewResult | null;
  diff: TrialBalanceUnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
  searchActive: boolean;
  arApMode: TrialBalanceArApMode;
  periodDiffersFromAsOf: boolean;
  previewCompareSource?: TrialBalancePreviewCompareSource;
}) {
  const [tableExpanded, setTableExpanded] = useState(false);
  const { formatCurrency } = useFormatCurrency();

  const compareLabels = useMemo(
    () =>
      trialBalancePreviewCompareLabels(previewCompareSource, {
        legacyEngineLabel: 'Legacy Trial Balance (accountingReportsService.getTrialBalance)',
        unifiedBasisLabel: UNIFIED_LEDGER_BASIS_LABELS[previewBasis],
      }),
    [previewCompareSource, previewBasis],
  );

  const exportPayload = useMemo(
    () => ({
      phase: '2.5',
      screen: 'trial_balance',
      startDate,
      endDate,
      branchLabel,
      previewBasis,
      arApMode,
      engineState,
      diff,
      previewMeta: previewResult?.meta ?? null,
      rpcScope: previewResult?.rpcScope ?? null,
      previewRowCount: previewResult?.rows.length ?? 0,
      exportedAt: new Date().toISOString(),
      note: 'Non-official preview compare — legacy table remains authoritative.',
    }),
    [startDate, endDate, branchLabel, previewBasis, arApMode, engineState, diff, previewResult]
  );

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4"
      data-trial-balance-preview-compare-source={previewCompareSource}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-amber-100">{compareLabels.panelTitle}</h3>
          <UnifiedLedgerPreviewBadge mode={engineState.mode} />
          {engineState.pilotEnabled ? (
            <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">pilot flag ON</span>
          ) : null}
          {!engineState.screenFlagEnabled ? (
            <span className="text-xs text-gray-500">screen flag OFF</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCompareJson(`phase2-compare-trial-balance-${Date.now()}.json`, exportPayload)
            }
            disabled={!diff}
          >
            Export preview JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-amber-200"
            onClick={() => {
              window.location.href = '/admin/unified-ledger-tieout';
            }}
          >
            <ExternalLink size={14} className="mr-1" />
            Open in Compare Center
          </Button>
        </div>
      </div>

      <UnifiedLedgerEngineBanner
        mode={engineState.mode}
        screenId={UNIFIED_LEDGER_SCREEN_IDS.TRIAL_BALANCE}
      />

      {engineState.killSwitchActive ? (
        <p className="text-sm text-red-300">
          Kill switch is active — unified preview is disabled on this screen (legacy data only).
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-400">Preview basis lens:</span>
        <select
          value={previewBasis}
          onChange={(e) => onPreviewBasisChange(e.target.value as UnifiedLedgerBasis)}
          className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white"
          disabled={engineState.killSwitchActive}
        >
          {PREVIEW_BASIS_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {unifiedBasisBannerLabel(b)} ({UNIFIED_LEDGER_BASIS_LABELS[b]})
            </option>
          ))}
        </select>
      </div>

      <ReportBasisBanner
        basis="official_gl"
        detail="Main table uses legacy period TB. Unified preview uses as-of end date (see scope note below)."
      />

      {periodDiffersFromAsOf ? (
        <p className="text-xs text-gray-500">
          Legacy sums activity from <strong className="text-gray-400">{startDate}</strong> to{' '}
          <strong className="text-gray-400">{endDate}</strong>. Unified RPC uses{' '}
          <strong className="text-gray-400">asOfDate = {endDate}</strong> only (admin compare parity).
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          Period: {startDate} to {endDate} · Branch: {branchLabel}. Unified RPC as-of: {endDate}.
        </p>
      )}

      {arApMode !== 'flat' ? (
        <p className="text-xs text-amber-400/90">
          AR/AP view is <strong>{arApMode}</strong> — legacy rows are reshaped for presentation. Unified RPC has no
          arApMode; compare uses on-screen legacy rows vs flat unified accounts.
        </p>
      ) : null}

      {searchActive ? (
        <p className="text-xs text-gray-500">
          Search / journal filters apply to the main table only. Compare uses full loaded legacy rows.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-gray-400">{compareLabels.loadingText}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {diff ? (
        <CompareSummaryCards
          oldBalance={diff.oldTotalDebit - diff.oldTotalCredit}
          newBalance={diff.newTotalDebit - diff.newTotalCredit}
          difference={diff.differenceDelta}
          pass={diff.pass}
          oldRowCount={diff.oldAccountCount}
          newRowCount={diff.newAccountCount}
          oldEngineName="Legacy getTrialBalance (on-screen)"
          newEngineName={`Unified RPC (${UNIFIED_LEDGER_BASIS_LABELS[previewBasis]})`}
          newQueryMs={previewResult?.meta.queryDurationMs}
          extra={
            <div className="text-sm text-gray-400 grid md:grid-cols-2 gap-2">
              <p>
                Old Dr/Cr: {diff.oldTotalDebit.toFixed(2)} / {diff.oldTotalCredit.toFixed(2)} (diff{' '}
                {diff.oldDifference.toFixed(2)})
              </p>
              <p>
                New Dr/Cr: {diff.newTotalDebit.toFixed(2)} / {diff.newTotalCredit.toFixed(2)} (diff{' '}
                {diff.newDifference.toFixed(2)})
              </p>
              <p className="col-span-2">
                Account diffs: {diff.accountDiffs.length}
                {diff.accountDiffs.length > 0 ? ' — see table below' : ' — none'}
                {!diff.totalsPass ? ' · Totals delta outside tolerance' : ''}
              </p>
            </div>
          }
        />
      ) : null}

      {diff && diff.accountDiffs.length > 0 ? (
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 py-2 bg-gray-900/80 text-sm font-medium">
            Account diffs ({diff.accountDiffs.length})
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left p-2">Code</th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Kind</th>
                  <th className="text-right p-2">Old net</th>
                  <th className="text-right p-2">New net</th>
                  <th className="text-right p-2">Diff</th>
                </tr>
              </thead>
              <tbody>
                {diff.accountDiffs.slice(0, 50).map((d, i) => (
                  <tr key={`${d.accountId}-${i}`} className="border-b border-gray-800/50">
                    <td className="p-2">{d.accountCode}</td>
                    <td className="p-2">{d.accountName}</td>
                    <td className="p-2">{d.kind}</td>
                    <td className="p-2 text-right">{d.oldNetBalance.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.newNetBalance.toFixed(2)}</td>
                    <td className="p-2 text-right">{d.difference.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {previewResult && previewResult.rows.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
            onClick={() => setTableExpanded((v) => !v)}
          >
            {tableExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {compareLabels.previewTableLabel}
          </button>
          {tableExpanded ? (
            <div className="relative rounded-xl border border-dashed border-amber-500/40 overflow-hidden">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] text-4xl font-bold rotate-[-12deg] text-amber-200 select-none">
                PREVIEW
              </div>
              <TrialBalancePreviewTable rows={previewResult.rows} formatCurrency={formatCurrency} />
            </div>
          ) : null}
        </div>
      ) : null}

      {previewResult?.blockedByKillSwitch ? (
        <p className="text-sm text-gray-500">No unified rows — preview blocked by kill switch.</p>
      ) : null}
    </div>
  );
}

function TrialBalancePreviewTable({
  rows,
  formatCurrency,
}: {
  rows: { account_code: string; account_name: string; account_type: string; debit: number; credit: number; balance: number }[];
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="overflow-x-auto max-h-80">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/80">
            <th className="text-left p-2">Code</th>
            <th className="text-left p-2">Account</th>
            <th className="text-left p-2">Type</th>
            <th className="text-right p-2">Dr</th>
            <th className="text-right p-2">Cr</th>
            <th className="text-right p-2">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={`${r.account_code}-${i}`} className="border-b border-gray-800/50">
              <td className="p-2 font-mono">{r.account_code}</td>
              <td className="p-2">{r.account_name}</td>
              <td className="p-2">{r.account_type}</td>
              <td className="p-2 text-right tabular-nums">{r.debit ? formatCurrency(r.debit) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{r.credit ? formatCurrency(r.credit) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{formatCurrency(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
