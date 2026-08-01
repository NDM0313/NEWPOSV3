/**
 * Map unified party RPC rows → EffectiveLedgerResult for main loader (Phase 2.13).
 */

import type {
  EffectiveLedgerResult,
  EffectiveLedgerRow,
  EffectiveLedgerSummary,
} from '@/app/services/effectivePartyLedgerService';
import type { UnifiedLedgerResult, UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

const TYPE_LABELS: Record<EffectiveLedgerRow['type'], string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  payment: 'Payment',
  receipt: 'Receipt',
  opening: 'Opening',
  return: 'Return',
  reversal: 'Reversal',
  expense: 'Expense',
  adjustment: 'Adjustment',
  journal: 'Journal',
};

function mapReferenceTypeToLedgerType(ref: string | null): EffectiveLedgerRow['type'] {
  const r = (ref || '').toLowerCase();
  if (r.includes('opening')) return 'opening';
  if (r.includes('sale_return') || r.includes('sales_return')) return 'return';
  if (r.includes('purchase_return')) return 'return';
  if (r.includes('reversal') || r.includes('void')) return 'reversal';
  if (r.includes('sale')) return 'sale';
  if (r.includes('purchase')) return 'purchase';
  if (r.includes('receipt')) return 'receipt';
  if (r.includes('payment')) return 'payment';
  if (r.includes('expense')) return 'expense';
  if (r.includes('adjust')) return 'adjustment';
  return 'journal';
}

export function mapUnifiedRowToEffectiveRow(row: UnifiedLedgerRow): EffectiveLedgerRow {
  const type = mapReferenceTypeToLedgerType(row.referenceType);
  const effectiveAmount = Math.max(row.debit, row.credit);
  return {
    id: row.journalEntryLineId || row.journalEntryId,
    date: row.entryDate,
    referenceNo: row.entryNo || '—',
    type,
    typeLabel: TYPE_LABELS[type],
    description: row.description || '—',
    effectiveAmount,
    effectiveAccountName: row.accountName,
    effectiveAccountCode: row.accountCode,
    debit: row.debit,
    credit: row.credit,
    runningBalance: row.runningBalance,
    status: 'active',
    paymentId: row.paymentId,
    sourceDocumentId: null,
    sourceDocumentType: row.referenceType,
    mutationCount: 1,
    mutations: [],
    journalEntryNos: row.entryNo ? [row.entryNo] : [],
    isCollapsed: false,
  };
}

function buildSummary(
  unified: UnifiedLedgerResult,
  rows: EffectiveLedgerRow[],
  partyType: 'customer' | 'supplier',
): EffectiveLedgerSummary {
  let totalDebit = 0;
  let totalCredit = 0;
  let totalSales = 0;
  let totalReceived = 0;
  let totalPurchases = 0;
  let totalPaid = 0;

  for (const row of rows) {
    totalDebit += row.debit;
    totalCredit += row.credit;
    if (row.type === 'sale') totalSales += row.effectiveAmount;
    if (row.type === 'receipt' || row.type === 'payment') {
      if (partyType === 'customer' && row.type === 'receipt') totalReceived += row.effectiveAmount;
      if (partyType === 'supplier' && row.type === 'payment') totalPaid += row.effectiveAmount;
    }
    if (row.type === 'purchase') totalPurchases += row.effectiveAmount;
  }

  return {
    openingBalance: unified.meta.periodOpeningBalance,
    totalDebit,
    totalCredit,
    closingBalance: unified.closingBalance,
    totalSales,
    totalReceived,
    totalPurchases,
    totalPaid,
  };
}

export function mapUnifiedToEffectiveLedgerResult(args: {
  unified: UnifiedLedgerResult;
  partyName: string;
  partyType: 'customer' | 'supplier';
}): EffectiveLedgerResult & { unifiedRows: UnifiedLedgerRow[] } {
  const rows = args.unified.rows.map(mapUnifiedRowToEffectiveRow);
  return {
    rows,
    summary: buildSummary(args.unified, rows, args.partyType),
    partyName: args.partyName,
    partyType: args.partyType,
    unifiedRows: args.unified.rows,
  };
}
