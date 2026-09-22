'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { AccountingStatementMode } from '@/app/lib/accounting/statementEngineTypes';
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
import type { AccountStatementUnifiedPreviewDiff } from '@/app/lib/accountStatementUnifiedPreviewDiff';
import type { AccountStatementUnifiedPreviewResult } from '@/app/services/accountStatementUnifiedPreviewService';
import type { AccountStatementPreviewTarget } from '@/app/lib/accountStatementUnifiedPreviewTarget';
import {
  accountStatementPreviewCompareLabels,
  type AccountStatementPreviewCompareSource,
} from '@/app/lib/resolveAccountStatementPreviewCompareSource';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';
import type { AccountLedgerEntry } from '@/app/services/accountingService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function AccountStatementUnifiedPreviewPanel({
  statementType,
  entityLabel,
  previewTarget,
  previewResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
  displayFiltersActive,
  legacyEngineLabel,
  viewMode,
  previewCompareSource = 'unified_compare',
}: {
  statementType: AccountingStatementMode;
  entityLabel: string;
  previewTarget: AccountStatementPreviewTarget;
  previewResult: AccountStatementUnifiedPreviewResult | null;
  diff: AccountStatementUnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
  displayFiltersActive: boolean;
  legacyEngineLabel: string;
  viewMode: 'effective' | 'audit';
  previewCompareSource?: AccountStatementPreviewCompareSource;
}) {
  const [tableExpanded, setTableExpanded] = useState(false);
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();

  const compareLabels = useMemo(
    () =>
      accountStatementPreviewCompareLabels(previewCompareSource, {
        legacyEngineLabel,
        unifiedBasisLabel: unifiedBasisBannerLabel(previewBasis),
      }),
    [previewCompareSource, legacyEngineLabel, previewBasis],
  );

  const exportPayload = useMemo(
    () => ({
      phase: '2.4',
      screen: 'account_statement',
      statementType,
      entityLabel,
      previewTarget,
      previewBasis,
      engineState,
      diff,
      previewMeta: previewResult?.meta ?? null,
      previewRowCount: previewResult?.rows.length ?? 0,
      exportedAt: new Date().toISOString(),
      note: 'Non-official preview compare — legacy table remains authoritative.',
    }),
    [statementType, entityLabel, previewTarget, previewBasis, engineState, diff, previewResult]
  );

  const isPartyStatement =
    statementType === 'customer' ||
    statementType === 'supplier' ||
    statementType === 'worker' ||
    (previewTarget.kind === 'party' && statementType !== 'worker');

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4"
      data-account-statement-preview-compare-source={previewCompareSource}
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
            onClick={() =>
              downloadCompareJson(`phase2-compare-account-statement-${Date.now()}.json`, exportPayload)
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
        screenId={UNIFIED_LEDGER_SCREEN_IDS.ACCOUNT_STATEMENT}
      />

      {engineState.killSwitchActive ? (
        <p className="text-sm text-red-300">
          Kill switch is active — unified preview is disabled on this screen (legacy data only).
        </p>
      ) : null}

      {previewTarget.kind === 'none' ? (
        <p className="text-sm text-muted-foreground">{previewTarget.reason}</p>
      ) : null}

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

      {(statementType === 'customer' || statementType === 'supplier' || isPartyStatement) && (
        <ReportBasisBanner
          basis={viewMode === 'effective' ? 'effective_party' : 'audit_full'}
          detail={
            viewMode === 'effective'
              ? 'Party preview uses effective-party lens. Legacy customer path may use hybrid loader — compare shows on-screen legacy vs unified.'
              : 'Audit lens — includes reversals/adjustments when legacy include checkboxes allow.'
          }
        />
      )}

      {previewTarget.kind === 'account' ? (
        <ReportBasisBanner
          basis="official_gl"
          detail="Account preview uses official GL lens. Main table remains legacy getAccountLedger loader."
        />
      ) : null}

      {displayFiltersActive ? (
        <p className="text-xs text-muted-foreground">
          Display filters (search, polarity, include flags, etc.) apply to the main table only. Compare uses full loaded
          entries.
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
            diff.goldenPass !== undefined ? (
              <p className={`text-sm ${diff.goldenPass ? 'text-emerald-400' : 'text-amber-400'}`}>
                MR JALIL golden check: {diff.goldenPass ? 'PASS (PKR 216,300)' : 'FAIL'}
              </p>
            ) : null
          }
        />
      ) : null}

      {diff && (diff.missingInNew.length > 0 || diff.extraInNew.length > 0) ? (
        <div className="grid md:grid-cols-2 gap-3">
          <CompareDiffTable title={compareLabels.missingInNewTitle} rows={diff.missingInNew} />
          <CompareDiffTable title={compareLabels.extraInNewTitle} rows={diff.extraInNew} />
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
              <AccountStatementPreviewTable rows={previewResult.rows} formatCurrency={formatCurrency} formatDate={formatDate} />
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

function AccountStatementPreviewTable({
  rows,
  formatCurrency,
  formatDate,
}: {
  rows: AccountLedgerEntry[];
  formatCurrency: (n: number) => string;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="overflow-x-auto max-h-80">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border bg-card">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Reference</th>
            <th className="text-left p-2">Description</th>
            <th className="text-right p-2">Dr</th>
            <th className="text-right p-2">Cr</th>
            <th className="text-right p-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((r, i) => (
            <tr key={`${r.journal_entry_id}-${r.journal_line_id || i}`} className="border-b border-border">
              <td className="p-2 whitespace-nowrap">{r.date ? formatDate(r.date) : '—'}</td>
              <td className="p-2">{r.reference_number || r.entry_no || '—'}</td>
              <td className="p-2 max-w-xs truncate" title={r.description}>
                {r.description || '—'}
              </td>
              <td className="p-2 text-right tabular-nums">{r.debit ? formatCurrency(r.debit) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{r.credit ? formatCurrency(r.credit) : '—'}</td>
              <td className="p-2 text-right tabular-nums">{formatCurrency(r.running_balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
