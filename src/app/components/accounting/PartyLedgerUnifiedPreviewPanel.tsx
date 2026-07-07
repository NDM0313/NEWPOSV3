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
import type { PartyLedgerUnifiedPreviewDiff } from '@/app/lib/partyLedgerUnifiedPreviewDiff';
import type { PartyLedgerUnifiedPreviewResult } from '@/app/services/partyLedgerUnifiedPreviewService';
import {
  partyLedgerPreviewCompareLabels,
  type PartyLedgerPreviewCompareSource,
} from '@/app/lib/resolvePartyLedgerPreviewCompareSource';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import type { PartyLedgerPreviewRow } from '@/app/lib/partyLedgerUnifiedMapper';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function PartyLedgerUnifiedPreviewPanel({
  dateFrom,
  dateTo,
  partyType,
  contactName,
  mode,
  showReversals,
  previewResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
  displayFiltersActive,
  previewCompareSource = 'unified_compare',
}: {
  dateFrom: string;
  dateTo: string;
  partyType: 'customer' | 'supplier';
  contactName: string;
  mode: 'effective' | 'audit';
  showReversals: boolean;
  previewResult: PartyLedgerUnifiedPreviewResult | null;
  diff: PartyLedgerUnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
  displayFiltersActive: boolean;
  previewCompareSource?: PartyLedgerPreviewCompareSource;
}) {
  const [tableExpanded, setTableExpanded] = useState(false);
  const { formatCurrency } = useFormatCurrency();

  const compareLabels = useMemo(
    () =>
      partyLedgerPreviewCompareLabels(previewCompareSource, {
        legacyEngineLabel: 'Legacy Party Ledger (loadEffectivePartyLedger)',
        unifiedBasisLabel: UNIFIED_LEDGER_BASIS_LABELS[previewBasis],
      }),
    [previewCompareSource, previewBasis],
  );

  const exportPayload = useMemo(
    () => ({
      phase: '2.7',
      screen: 'party_ledger',
      dateFrom,
      dateTo,
      partyType,
      contactName,
      mode,
      showReversals,
      previewBasis,
      engineState,
      diff,
      previewMeta: previewResult?.meta ?? null,
      rpcScope: previewResult?.rpcScope ?? null,
      previewRowCount: previewResult?.rows.length ?? 0,
      exportedAt: new Date().toISOString(),
      note: 'Non-official preview compare — effective Party Ledger table remains authoritative.',
    }),
    [
      dateFrom,
      dateTo,
      partyType,
      contactName,
      mode,
      showReversals,
      previewBasis,
      engineState,
      diff,
      previewResult,
    ]
  );

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4 mx-6 mt-2"
      data-party-ledger-preview-compare-source={previewCompareSource}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-amber-100">{compareLabels.panelTitle}</h3>
          <UnifiedLedgerPreviewBadge mode={engineState.mode} />
          {engineState.pilotEnabled ? (
            <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">pilot flag ON</span>
          ) : null}
          {!engineState.screenFlagEnabled ? (
            <span className="text-xs text-muted-foreground">screen flag OFF</span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => downloadCompareJson(`phase2-compare-party-ledger-${Date.now()}.json`, exportPayload)}
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

      <UnifiedLedgerEngineBanner mode={engineState.mode} screenId={UNIFIED_LEDGER_SCREEN_IDS.PARTY_LEDGER} />

      {engineState.killSwitchActive ? (
        <p className="text-sm text-red-300">
          Kill switch is active — unified preview is disabled on this screen (legacy data only).
        </p>
      ) : null}

      <p className="text-xs text-amber-400/90">
        Compares on-screen <strong>effective</strong> party ledger (mutation-collapse) vs unified GL RPC. Admin Compare
        Center Party tab uses GL hybrid as the old side — row diffs here are expected.
      </p>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Preview basis lens:</span>
        <select
          value={previewBasis}
          onChange={(e) => onPreviewBasisChange(e.target.value as UnifiedLedgerBasis)}
          className="rounded border border-border bg-card px-2 py-1 text-sm text-foreground"
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
        basis={mode === 'audit' ? 'audit_full' : 'effective_party'}
        detail="Main table uses effective party collapse. Unified preview uses GL party ledger RPC."
      />

      <p className="text-xs text-muted-foreground">
        Period: {dateFrom} → {dateTo} · Party: {contactName || '—'} ({partyType}) · Branch: all (effective loader
        ignores branch filter today).
      </p>

      {displayFiltersActive ? (
        <p className="text-xs text-muted-foreground">
          Type/search/mode filters apply to the main table only. Compare uses full loaded effective rows.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">{compareLabels.loadingText}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {diff ? (
        <CompareSummaryCards
          oldBalance={diff.oldClosing}
          newBalance={diff.newClosing}
          difference={diff.difference}
          pass={diff.pass}
          oldRowCount={diff.oldRowCount}
          newRowCount={diff.newRowCount}
          oldEngineName={compareLabels.oldEngineName}
          newEngineName={compareLabels.newEngineName}
          newQueryMs={previewResult?.meta.queryDurationMs}
          extra={
            <div className="text-sm text-muted-foreground grid md:grid-cols-2 gap-2">
              <p>
                Opening: {diff.oldOpening.toFixed(2)} → {diff.newOpening.toFixed(2)}
              </p>
              {diff.goldenPass !== undefined ? (
                <p className={diff.goldenPass ? 'text-emerald-400' : 'text-amber-400'}>
                  MR JALIL unified golden: {diff.goldenPass ? 'PASS (PKR 216,300)' : 'FAIL'} — effective closing may
                  differ
                </p>
              ) : null}
              <p className="col-span-2">
                Row diffs: missing {diff.missingInNew.length}, extra {diff.extraInNew.length}, amount{' '}
                {diff.amountMismatches.length}
                {!diff.totalsPass ? ' · Closing/opening delta outside tolerance' : ''}
              </p>
            </div>
          }
        />
      ) : null}

      {diff && (diff.missingInNew.length > 0 || diff.extraInNew.length > 0) ? (
        <div className="grid md:grid-cols-2 gap-3">
          <CompareDiffTable title={compareLabels.missingInNewTitle} rows={diff.missingInNew} />
          <CompareDiffTable title={compareLabels.extraInNewTitle} rows={diff.extraInNew} />
        </div>
      ) : null}

      {diff && diff.amountMismatches.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-card text-sm font-medium">
            Amount mismatches ({diff.amountMismatches.length})
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left p-2">Key</th>
                  <th className="text-right p-2">Old Dr/Cr</th>
                  <th className="text-right p-2">New Dr/Cr</th>
                </tr>
              </thead>
              <tbody>
                {diff.amountMismatches.slice(0, 30).map((m) => (
                  <tr key={m.key} className="border-b border-border">
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
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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
              <PartyLedgerPreviewTable rows={previewResult.rows} formatCurrency={formatCurrency} />
            </div>
          ) : null}
        </div>
      ) : null}

      {previewResult?.blockedByKillSwitch ? (
        <p className="text-sm text-muted-foreground">No unified rows — preview blocked by kill switch.</p>
      ) : null}
    </div>
  );
}

function PartyLedgerPreviewTable({
  rows,
  formatCurrency,
}: {
  rows: PartyLedgerPreviewRow[];
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="overflow-x-auto max-h-80">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border bg-card">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Ref</th>
            <th className="text-left p-2">Description</th>
            <th className="text-right p-2">Dr</th>
            <th className="text-right p-2">Cr</th>
            <th className="text-right p-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r) => (
            <tr key={r.id} className="border-b border-border">
              <td className="p-2 whitespace-nowrap">{r.date}</td>
              <td className="p-2">{r.referenceNo}</td>
              <td className="p-2 max-w-xs truncate" title={r.description}>
                {r.description}
              </td>
              <td className="p-2 text-right tabular-nums">{r.debit ? formatCurrency(r.debit) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{r.credit ? formatCurrency(r.credit) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{formatCurrency(r.runningBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
