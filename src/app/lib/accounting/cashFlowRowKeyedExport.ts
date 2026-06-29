/**
 * Phase 3B-F — build row-keyed Cash Flow diagnostic export payload (preview-only).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { CashFlowUnifiedPreviewDiff } from '@/app/lib/accounting/cashFlowUnifiedPreviewDiff';
import type { CashFlowReportResult } from '@/app/services/cashFlowReportService';
import type { CashFlowUnifiedPreviewLoadResult } from '@/app/services/cashFlowUnifiedPreviewService';
import {
  normalizeLegacyCashFlowRow,
  normalizePreviewCashFlowRow,
} from '@/app/lib/accounting/cashFlowRowNormalizer';
import { buildCashFlowRowKeyedDiff } from '@/app/lib/accounting/cashFlowRowDiffBuckets';
import { redactExportSecrets } from '@/app/lib/accounting/cashFlowRowKey';

export type CashFlowRowKeyedExportPayload = {
  phase: '3B-F';
  screen: 'cash_flow';
  diagnosticOnly: true;
  previewOnly: true;
  needsFinanceGoldenApproval: true;
  companyId: string | null;
  dateFrom: string;
  dateTo: string;
  branchLabel: string;
  auditMode: boolean;
  previewBasis: UnifiedLedgerBasis;
  diff: CashFlowUnifiedPreviewDiff | null;
  legacyRowsNormalized: ReturnType<typeof normalizeLegacyCashFlowRow>[];
  previewRowsNormalized: ReturnType<typeof normalizePreviewCashFlowRow>[];
  rowKeyedDiff: ReturnType<typeof buildCashFlowRowKeyedDiff>;
  preview: CashFlowUnifiedPreviewLoadResult['preview'];
  roznamchaMeta: CashFlowUnifiedPreviewLoadResult['roznamchaPreview']['meta'] | null;
  accountingRuleNotes: string[];
  exportedAt: string;
  note: string;
};

export function buildCashFlowRowKeyedExport(args: {
  companyId: string | null;
  dateFrom: string;
  dateTo: string;
  branchLabel: string;
  auditMode: boolean;
  previewBasis: UnifiedLedgerBasis;
  legacy: CashFlowReportResult;
  loadResult: CashFlowUnifiedPreviewLoadResult | null;
  diff: CashFlowUnifiedPreviewDiff | null;
}): CashFlowRowKeyedExportPayload {
  const unifiedRows = args.loadResult?.roznamchaPreview?.unifiedRows ?? [];
  const legacyRowsNormalized = args.legacy.rows.map((r) =>
    normalizeLegacyCashFlowRow(r, args.companyId, args.auditMode)
  );
  const previewRowsNormalized = unifiedRows.map((r) =>
    normalizePreviewCashFlowRow(r, args.companyId, args.auditMode)
  );
  const rowKeyedDiff = buildCashFlowRowKeyedDiff(legacyRowsNormalized, previewRowsNormalized);

  const payload: CashFlowRowKeyedExportPayload = {
    phase: '3B-F',
    screen: 'cash_flow',
    diagnosticOnly: true,
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    companyId: args.companyId,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    branchLabel: args.branchLabel,
    auditMode: args.auditMode,
    previewBasis: args.previewBasis,
    diff: args.diff,
    legacyRowsNormalized,
    previewRowsNormalized,
    rowKeyedDiff,
    preview: args.loadResult?.preview ?? null,
    roznamchaMeta: args.loadResult?.roznamchaPreview?.meta ?? null,
    accountingRuleNotes: [
      ...(args.loadResult?.preview?.accountingRuleNotes ?? []),
      'Phase 3B-F row-keyed diagnostic export — legacy Cash Flow remains authoritative.',
      'NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.',
    ],
    exportedAt: new Date().toISOString(),
    note: 'PREVIEW_ONLY diagnostic export — legacy Cash Flow table remains authoritative. NEEDS_FINANCE_GOLDEN_APPROVAL.',
  };

  return redactExportSecrets(payload);
}
