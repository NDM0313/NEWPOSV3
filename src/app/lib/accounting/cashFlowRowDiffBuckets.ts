/**
 * Phase 3B-F — row-keyed diff buckets for Cash Flow diagnostic export.
 */

import type { NormalizedCashFlowDiagnosticRow } from '@/app/lib/accounting/cashFlowRowNormalizer';

export type CashFlowRowMatchTier = 'exact' | 'strong' | 'weak' | 'unmatched';

export type CashFlowRowMatch = {
  tier: CashFlowRowMatchTier;
  legacy: NormalizedCashFlowDiagnosticRow;
  preview: NormalizedCashFlowDiagnosticRow;
};

export type CashFlowDiffBucketSummary = {
  bucketId: string;
  label: string;
  rowCount: number;
  cashInTotal: number;
  cashOutTotal: number;
  netImpact: number;
  closingImpact: number | null;
  sampleRefs: string[];
  ruleConfirmationQuestionId: string | null;
};

export type CashFlowRowKeyedDiffResult = {
  exactMatches: CashFlowRowMatch[];
  strongMatches: CashFlowRowMatch[];
  weakMatches: CashFlowRowMatch[];
  legacyOnly: NormalizedCashFlowDiagnosticRow[];
  previewOnly: NormalizedCashFlowDiagnosticRow[];
  bucketOnlyUnmatched: {
    legacy: NormalizedCashFlowDiagnosticRow[];
    preview: NormalizedCashFlowDiagnosticRow[];
  };
  thematicBuckets: CashFlowDiffBucketSummary[];
};

function sumRows(rows: NormalizedCashFlowDiagnosticRow[]) {
  const cashInTotal = rows.reduce((s, r) => s + r.cashIn, 0);
  const cashOutTotal = rows.reduce((s, r) => s + r.cashOut, 0);
  return {
    rowCount: rows.length,
    cashInTotal: Math.round(cashInTotal * 100) / 100,
    cashOutTotal: Math.round(cashOutTotal * 100) / 100,
    netImpact: Math.round((cashInTotal - cashOutTotal) * 100) / 100,
    closingImpact: Math.round((cashInTotal - cashOutTotal) * 100) / 100,
  };
}

function sampleRefs(rows: NormalizedCashFlowDiagnosticRow[], n = 5): string[] {
  return rows.slice(0, n).map((r) => {
    const ref = r.journalEntryLineId || r.paymentId || r.referenceType || r.rawPointer;
    return `${r.date} ${ref} in=${r.cashIn} out=${r.cashOut}`;
  });
}

function bucketSummary(
  bucketId: string,
  label: string,
  rows: NormalizedCashFlowDiagnosticRow[],
  questionId: string | null
): CashFlowDiffBucketSummary {
  const t = sumRows(rows);
  return {
    bucketId,
    label,
    ...t,
    sampleRefs: sampleRefs(rows),
    ruleConfirmationQuestionId: questionId,
  };
}

function matchTier(
  legacy: NormalizedCashFlowDiagnosticRow,
  preview: NormalizedCashFlowDiagnosticRow
): CashFlowRowMatchTier | null {
  if (
    legacy.journalEntryLineId &&
    preview.journalEntryLineId &&
    legacy.journalEntryLineId === preview.journalEntryLineId
  ) {
    return 'exact';
  }
  if (
    legacy.stableRowKey === preview.stableRowKey &&
    legacy.keyConfidence !== 'BUCKET_ONLY' &&
    legacy.keyConfidence !== 'UNMATCHABLE_NEEDS_EXPORT_FIELD'
  ) {
    if (legacy.keyConfidence === 'EXACT_KEY') return 'exact';
    if (legacy.keyConfidence === 'STRONG_KEY') return 'strong';
    if (legacy.keyConfidence === 'WEAK_KEY') return 'weak';
  }
  if (
    legacy.journalEntryId &&
    preview.journalEntryId &&
    legacy.journalEntryId === preview.journalEntryId &&
    legacy.cashIn === preview.cashIn &&
    legacy.cashOut === preview.cashOut
  ) {
    return 'strong';
  }
  if (
    legacy.date === preview.date &&
    legacy.cashIn === preview.cashIn &&
    legacy.cashOut === preview.cashOut &&
    (legacy.referenceType || '') === (preview.referenceType || '')
  ) {
    return 'weak';
  }
  return null;
}

export function buildCashFlowRowKeyedDiff(
  legacyRows: NormalizedCashFlowDiagnosticRow[],
  previewRows: NormalizedCashFlowDiagnosticRow[]
): CashFlowRowKeyedDiffResult {
  const exactMatches: CashFlowRowMatch[] = [];
  const strongMatches: CashFlowRowMatch[] = [];
  const weakMatches: CashFlowRowMatch[] = [];
  const usedPreview = new Set<number>();
  const legacyOnly: NormalizedCashFlowDiagnosticRow[] = [];
  const bucketOnlyLegacy: NormalizedCashFlowDiagnosticRow[] = [];

  for (const leg of legacyRows) {
    let bestIdx = -1;
    let bestTier: CashFlowRowMatchTier | null = null;
    for (let i = 0; i < previewRows.length; i += 1) {
      if (usedPreview.has(i)) continue;
      const tier = matchTier(leg, previewRows[i]);
      if (!tier) continue;
      const rank = tier === 'exact' ? 3 : tier === 'strong' ? 2 : 1;
      const bestRank =
        bestTier === 'exact' ? 3 : bestTier === 'strong' ? 2 : bestTier === 'weak' ? 1 : 0;
      if (rank > bestRank) {
        bestTier = tier;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestTier) {
      usedPreview.add(bestIdx);
      const match: CashFlowRowMatch = { tier: bestTier, legacy: leg, preview: previewRows[bestIdx] };
      if (bestTier === 'exact') exactMatches.push(match);
      else if (bestTier === 'strong') strongMatches.push(match);
      else weakMatches.push(match);
    } else if (leg.keyConfidence === 'BUCKET_ONLY' || leg.keyConfidence === 'UNMATCHABLE_NEEDS_EXPORT_FIELD') {
      bucketOnlyLegacy.push(leg);
      legacyOnly.push(leg);
    } else {
      legacyOnly.push(leg);
    }
  }

  const previewOnly: NormalizedCashFlowDiagnosticRow[] = [];
  const bucketOnlyPreview: NormalizedCashFlowDiagnosticRow[] = [];
  previewRows.forEach((p, i) => {
    if (usedPreview.has(i)) return;
    if (p.keyConfidence === 'BUCKET_ONLY' || p.keyConfidence === 'UNMATCHABLE_NEEDS_EXPORT_FIELD') {
      bucketOnlyPreview.push(p);
    }
    previewOnly.push(p);
  });

  const transferLeg = [...legacyOnly, ...previewOnly].filter(
    (r) => r.transferClass !== 'not_transfer' || r.rowSide.startsWith('transfer')
  );
  const openingBal = [...legacyOnly, ...previewOnly].filter((r) => r.openingBalance);
  const reversalVoid = [...legacyOnly, ...previewOnly].filter(
    (r) => r.visibility === 'reversal' || r.visibility === 'void' || r.visibility === 'correction'
  );
  const bySource = (mod: string) =>
    [...legacyOnly, ...previewOnly].filter((r) => r.sourceModule === mod || r.referenceType === mod);

  const thematicBuckets: CashFlowDiffBucketSummary[] = [
    bucketSummary('legacy_only', 'Legacy-only rows', legacyOnly, 'Q7'),
    bucketSummary('preview_only', 'Preview-only rows', previewOnly, 'Q7'),
    bucketSummary('transfer_leg', 'Transfer leg bucket', transferLeg, 'Q5'),
    bucketSummary('opening_balance', 'Opening balance bucket', openingBal, 'Q4'),
    bucketSummary('reversal_void', 'Reversal/void/correction bucket', reversalVoid, 'Q3'),
    bucketSummary('source_transfers', 'Source module — transfers', bySource('transfers'), 'Q5'),
    bucketSummary('source_sales', 'Source module — sales_receipts', bySource('sales_receipts'), 'Q6'),
    bucketSummary('ref_opening', 'Reference opening_balance_account', previewOnly.filter((r) => (r.referenceType || '').includes('opening_balance')), 'Q4'),
    bucketSummary('ref_transfer', 'Reference transfer', previewOnly.filter((r) => r.referenceType === 'transfer'), 'Q5'),
    bucketSummary('party_mapping', 'Party-mapping weak keys', previewOnly.filter((r) => r.keyConfidence === 'WEAK_KEY'), 'Q2'),
    bucketSummary('branch_scope', 'Branch-scope rows', previewOnly.filter((r) => Boolean(r.branchId)), null),
    bucketSummary('date_boundary', 'Date-boundary weak/unmatched', [...legacyOnly, ...previewOnly].filter((r) => r.keyConfidence === 'UNMATCHABLE_NEEDS_EXPORT_FIELD'), null),
  ].filter((b) => b.rowCount > 0);

  return {
    exactMatches,
    strongMatches,
    weakMatches,
    legacyOnly,
    previewOnly,
    bucketOnlyUnmatched: { legacy: bucketOnlyLegacy, preview: bucketOnlyPreview },
    thematicBuckets,
  };
}
