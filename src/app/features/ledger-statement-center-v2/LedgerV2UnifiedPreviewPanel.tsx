'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { LedgerStatementV2Row, LedgerStatementV2Type } from '@/app/features/ledger-statement-center-v2/types';
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
import { LedgerTable } from './LedgerTable';
import { Button } from '@/app/components/ui/button';
import type {
  LedgerV2UnifiedPreviewDiff,
} from '@/app/lib/ledgerStatementV2UnifiedPreviewDiff';
import type { LedgerV2UnifiedPreviewResult } from '@/app/services/ledgerStatementCenterV2UnifiedPreviewService';
import { UNIFIED_LEDGER_SCREEN_IDS } from '@/app/lib/unifiedLedgerScreenFlags';

const PREVIEW_BASIS_OPTIONS: UnifiedLedgerBasis[] = [
  'effective_party',
  'official_gl',
  'audit_full_history',
];

export function LedgerV2UnifiedPreviewPanel({
  statementType,
  entityLabel,
  previewResult,
  diff,
  loading,
  error,
  engineState,
  previewBasis,
  onPreviewBasisChange,
  displayFiltersActive,
  legacyEngineLabel,
}: {
  statementType: LedgerStatementV2Type;
  entityLabel: string;
  previewResult: LedgerV2UnifiedPreviewResult | null;
  diff: LedgerV2UnifiedPreviewDiff | null;
  loading: boolean;
  error: string | null;
  engineState: UnifiedLedgerEngineState;
  previewBasis: UnifiedLedgerBasis;
  onPreviewBasisChange: (basis: UnifiedLedgerBasis) => void;
  displayFiltersActive: boolean;
  legacyEngineLabel: string;
}) {
  const [tableExpanded, setTableExpanded] = useState(false);

  const exportPayload = useMemo(
    () => ({
      phase: '2.3',
      screen: 'ledger_v2',
      statementType,
      entityLabel,
      previewBasis,
      engineState,
      diff,
      previewMeta: previewResult?.meta ?? null,
      previewRowCount: previewResult?.rows.length ?? 0,
      exportedAt: new Date().toISOString(),
      note: 'Non-official preview compare — legacy table remains authoritative.',
    }),
    [statementType, entityLabel, previewBasis, engineState, diff, previewResult],
  );

  const noopRow = (_row: LedgerStatementV2Row) => {};

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-4">
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
            onClick={() =>
              downloadCompareJson(
                `phase2-compare-ledger-v2-${Date.now()}.json`,
                exportPayload,
              )
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

      <UnifiedLedgerEngineBanner mode={engineState.mode} screenId={UNIFIED_LEDGER_SCREEN_IDS.LEDGER_V2} />

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
        basis={statementType === 'account' ? 'official_gl' : 'effective_party'}
        detail={
          statementType === 'account'
            ? 'Account preview uses official GL lens. Main table remains legacy GL loader.'
            : 'Party preview uses effective-party lens. Legacy customer path may use hybrid loader — compare shows on-screen legacy vs unified.'
        }
      />

      {displayFiltersActive ? (
        <p className="text-xs text-gray-500">
          Display filters (search / transaction type) apply to the main table only. Compare uses full loaded rows.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-400">Loading unified preview…</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {diff ? (
        <CompareSummaryCards
          oldBalance={diff.oldClosing}
          newBalance={diff.newClosing}
          difference={diff.difference}
          pass={diff.pass}
          oldRowCount={diff.oldRowCount}
          newRowCount={diff.newRowCount}
          oldEngineName={legacyEngineLabel}
          newEngineName={`Unified RPC (${UNIFIED_LEDGER_BASIS_LABELS[previewBasis]})`}
          oldQueryMs={undefined}
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
          <CompareDiffTable title="Missing in unified preview" rows={diff.missingInNew} />
          <CompareDiffTable title="Extra in unified preview" rows={diff.extraInNew} />
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
            <div className="relative rounded-xl border border-dashed border-amber-500/40 p-1">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] text-4xl font-bold rotate-[-12deg] text-amber-200 select-none">
                PREVIEW
              </div>
              <LedgerTable
                rows={previewResult.rows}
                loading={false}
                rowActionsDisabled
                onOpenRow={noopRow}
                onWhatsAppRow={noopRow}
                onPreviewAttachments={noopRow}
              />
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
