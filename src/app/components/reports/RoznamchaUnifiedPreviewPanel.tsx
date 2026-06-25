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
  CompareDiffTable,
  CompareSummaryCards,
  downloadCompareJson,
} from '@/app/components/admin/unified-ledger-compare/CompareSummaryCards';
import { Button } from '@/app/components/ui/button';
import type { RoznamchaUnifiedPreviewDiff } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import type { RoznamchaUnifiedPreviewResult } from '@/app/services/roznamchaUnifiedPreviewService';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import type { AccountFilter } from '@/app/services/roznamchaService';
import type { RoznamchaPreviewRow } from '@/app/lib/roznamchaUnifiedMapper';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function RoznamchaUnifiedPreviewPanel({
  dateFrom,
  dateTo,
  branchLabel,
  accountFilter,
  includeVoidedReversed,
  paymentAccountFilterActive,
  previewResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
  displayFiltersActive,
}: {
  dateFrom: string;
  dateTo: string;
  branchLabel: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
  paymentAccountFilterActive: boolean;
  previewResult: RoznamchaUnifiedPreviewResult | null;
  diff: RoznamchaUnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
  displayFiltersActive: boolean;
}) {
  const [tableExpanded, setTableExpanded] = useState(false);
  const { formatCurrency } = useFormatCurrency();

  const exportPayload = useMemo(
    () => ({
      phase: '2.6',
      screen: 'roznamcha',
      dateFrom,
      dateTo,
      branchLabel,
      accountFilter,
      includeVoidedReversed,
      previewBasis,
      engineState,
      diff,
      previewMeta: previewResult?.meta ?? null,
      rpcScope: previewResult?.rpcScope ?? null,
      paymentAccountFilterApplied: previewResult?.paymentAccountFilterApplied ?? false,
      previewRowCount: previewResult?.rows.length ?? 0,
      exportedAt: new Date().toISOString(),
      note: 'Non-official preview compare — legacy Roznamcha table remains authoritative.',
    }),
    [
      dateFrom,
      dateTo,
      branchLabel,
      accountFilter,
      includeVoidedReversed,
      previewBasis,
      engineState,
      diff,
      previewResult,
    ]
  );

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4 no-print">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-amber-100">Unified engine preview (compare only)</h3>
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
            onClick={() => downloadCompareJson(`phase2-compare-roznamcha-${Date.now()}.json`, exportPayload)}
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

      <UnifiedLedgerEngineBanner mode={engineState.mode} screenId={UNIFIED_LEDGER_SCREEN_IDS.ROZNAMCHA} />

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
        basis={includeVoidedReversed ? 'audit_full' : 'effective_party'}
        detail="Main table uses legacy Roznamcha (payments + rental_payments). Unified preview uses GL liquidity legs — row keys differ by design."
      />

      <p className="text-xs text-gray-500">
        Period: {dateFrom} → {dateTo} · Branch: {branchLabel} · Liquidity: {accountFilter}
      </p>

      {paymentAccountFilterActive ? (
        <p className="text-xs text-amber-400/90">
          Single payment account selected — unified preview rows are filtered client-side by account code/name (RPC has
          no account-id param).
        </p>
      ) : null}

      {includeVoidedReversed ? (
        <p className="text-xs text-amber-400/90">
          Voided / reversal audit mode is ON — preview basis defaults to audit_full_history.
        </p>
      ) : null}

      {displayFiltersActive ? (
        <p className="text-xs text-gray-500">
          Search / sort / pagination apply to the main table only. Compare uses full loaded legacy rows.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-gray-400">Loading unified preview…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {diff ? (
        <CompareSummaryCards
          oldBalance={diff.oldClosing}
          newBalance={diff.newClosing}
          difference={diff.difference}
          pass={diff.pass}
          oldRowCount={diff.oldRowCount}
          newRowCount={diff.newRowCount}
          oldEngineName="Legacy getRoznamcha (on-screen)"
          newEngineName={`Unified RPC (${UNIFIED_LEDGER_BASIS_LABELS[previewBasis]})`}
          newQueryMs={previewResult?.meta.queryDurationMs}
          extra={
            <div className="text-sm text-gray-400 grid md:grid-cols-2 gap-2">
              <p>
                Opening: {diff.oldOpening.toFixed(2)} → {diff.newOpening.toFixed(2)}
              </p>
              <p>
                Cash in/out: {diff.oldCashIn.toFixed(2)} / {diff.oldCashOut.toFixed(2)} vs{' '}
                {diff.newCashIn.toFixed(2)} / {diff.newCashOut.toFixed(2)}
              </p>
              <p className="col-span-2">
                Row diffs: missing {diff.missingInNew.length}, extra {diff.extraInNew.length}, amount{' '}
                {diff.amountMismatches.length}
                {!diff.totalsPass ? ' · Totals delta outside tolerance' : ''}
              </p>
            </div>
          }
        />
      ) : null}

      {diff && (diff.missingInNew.length > 0 || diff.extraInNew.length > 0) ? (
        <div className="grid md:grid-cols-2 gap-3">
          <CompareDiffTable title="Missing in unified preview" rows={diff.missingInNew} />
          <CompareDiffTable title="Extra in unified preview" rows={diff.extraInNew} />
        </div>
      ) : null}

      {diff && diff.amountMismatches.length > 0 ? (
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 py-2 bg-gray-900/80 text-sm font-medium">
            Amount mismatches ({diff.amountMismatches.length})
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left p-2">Key</th>
                  <th className="text-right p-2">Old Dr/Cr</th>
                  <th className="text-right p-2">New Dr/Cr</th>
                </tr>
              </thead>
              <tbody>
                {diff.amountMismatches.slice(0, 30).map((m) => (
                  <tr key={m.key} className="border-b border-gray-800/50">
                    <td className="p-2">{m.old.entryNo || m.key}</td>
                    <td className="p-2 text-right">
                      {m.old.debit.toFixed(2)} / {m.old.credit.toFixed(2)}
                    </td>
                    <td className="p-2 text-right">
                      {m.new.debit.toFixed(2)} / {m.new.credit.toFixed(2)}
                    </td>
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
            Unified preview table (not official)
          </button>
          {tableExpanded ? (
            <div className="relative rounded-xl border border-dashed border-amber-500/40 overflow-hidden">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] text-4xl font-bold rotate-[-12deg] text-amber-200 select-none">
                PREVIEW
              </div>
              <RoznamchaPreviewTable rows={previewResult.rows} formatCurrency={formatCurrency} />
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

function RoznamchaPreviewTable({
  rows,
  formatCurrency,
}: {
  rows: RoznamchaPreviewRow[];
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="overflow-x-auto max-h-80">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800 bg-gray-900/80">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Ref</th>
            <th className="text-left p-2">Details</th>
            <th className="text-left p-2">Account</th>
            <th className="text-right p-2">In</th>
            <th className="text-right p-2">Out</th>
            <th className="text-right p-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r) => (
            <tr key={r.id} className="border-b border-gray-800/50">
              <td className="p-2 whitespace-nowrap">{r.date}</td>
              <td className="p-2">{r.ref}</td>
              <td className="p-2 max-w-xs truncate" title={r.details}>
                {r.details}
              </td>
              <td className="p-2">{r.accountLabel}</td>
              <td className="p-2 text-right tabular-nums">{r.cashIn ? formatCurrency(r.cashIn) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{r.cashOut ? formatCurrency(r.cashOut) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{formatCurrency(r.runningBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
