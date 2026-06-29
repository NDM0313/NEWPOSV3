/**
 * Phase 3B-F — normalize legacy / preview Cash Flow rows for diagnostic export.
 */

import type { CashFlowRow } from '@/app/services/cashFlowReportService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { inferCashFlowSourceModule } from '@/app/lib/cashFlowReportLogic';
import {
  buildCashFlowStableRowKey,
  classifyRowSide,
  classifyTransfer,
  classifyVisibility,
  type CashFlowRowKeyConfidence,
  type CashFlowRowSide,
  type CashFlowTransferClass,
  type CashFlowVisibilityClass,
  hashDescription,
  parseLegacyJournalLineId,
} from '@/app/lib/accounting/cashFlowRowKey';

export type NormalizedCashFlowDiagnosticRow = {
  side: 'legacy' | 'preview';
  companyId: string | null;
  stableRowKey: string;
  keyConfidence: CashFlowRowKeyConfidence;
  date: string;
  cashIn: number;
  cashOut: number;
  signedAmount: number;
  rowSide: CashFlowRowSide;
  sourceModule: string;
  referenceType: string | null;
  referenceId: string | null;
  journalEntryId: string | null;
  journalEntryLineId: string | null;
  paymentId: string | null;
  accountId: string | null;
  accountName: string | null;
  branchId: string | null;
  branchName: string | null;
  party: string | null;
  visibility: CashFlowVisibilityClass;
  transferClass: CashFlowTransferClass;
  openingBalance: boolean;
  bucketClass: string;
  descriptionHash: string;
  rawPointer: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeLegacyCashFlowRow(
  row: CashFlowRow,
  companyId: string | null,
  auditMode: boolean
): NormalizedCashFlowDiagnosticRow {
  const keyInput = {
    journalEntryLineId: parseLegacyJournalLineId({ legacyRowId: row.id }),
    journalEntryId: row.sourceJournalEntryId,
    paymentId: row.sourcePaymentId,
    legacyRowId: row.id,
    date: row.date,
    referenceType: row.referenceType,
    sourceModule: row.sourceModule,
    cashIn: row.cashIn,
    cashOut: row.cashOut,
    accountName: row.cashAccount,
    description: row.details,
    status: row.status,
  };
  const { stableRowKey, keyConfidence } = buildCashFlowStableRowKey(keyInput);
  const rowSide = classifyRowSide(keyInput);
  const cashIn = round2(row.cashIn);
  const cashOut = round2(row.cashOut);

  return {
    side: 'legacy',
    companyId,
    stableRowKey,
    keyConfidence,
    date: row.date,
    cashIn,
    cashOut,
    signedAmount: round2(cashIn - cashOut),
    rowSide,
    sourceModule: row.sourceModule,
    referenceType: row.referenceType,
    referenceId: row.sourcePaymentId || row.sourceJournalEntryId || row.id,
    journalEntryId: row.sourceJournalEntryId,
    journalEntryLineId: parseLegacyJournalLineId({ legacyRowId: row.id }),
    paymentId: row.sourcePaymentId,
    accountId: null,
    accountName: row.cashAccount,
    branchId: row.branchId,
    branchName: row.branchName,
    party: row.party,
    visibility: classifyVisibility(keyInput, auditMode),
    transferClass: classifyTransfer(keyInput),
    openingBalance: rowSide === 'opening',
    bucketClass: row.sourceModule,
    descriptionHash: hashDescription(row.details),
    rawPointer: `legacy:${row.id}`,
  };
}

export function normalizePreviewCashFlowRow(
  row: UnifiedLedgerRow,
  companyId: string | null,
  auditMode: boolean
): NormalizedCashFlowDiagnosticRow {
  const sourceModule = inferCashFlowSourceModule({
    rowType: row.referenceType || 'journal',
    referenceType: row.referenceType,
    rowId: row.journalEntryLineId || row.journalEntryId,
  });
  const cashIn = round2(row.debit);
  const cashOut = round2(row.credit);
  const keyInput = {
    journalEntryLineId: row.journalEntryLineId,
    journalEntryId: row.journalEntryId,
    paymentId: row.paymentId,
    date: row.entryDate,
    referenceType: row.referenceType,
    sourceModule,
    cashIn,
    cashOut,
    accountCode: row.accountCode,
    accountName: row.accountName,
    description: row.description,
    status: null,
  };
  const { stableRowKey, keyConfidence } = buildCashFlowStableRowKey(keyInput);
  const rowSide = classifyRowSide(keyInput);

  return {
    side: 'preview',
    companyId,
    stableRowKey,
    keyConfidence,
    date: row.entryDate,
    cashIn,
    cashOut,
    signedAmount: round2(cashIn - cashOut),
    rowSide,
    sourceModule,
    referenceType: row.referenceType,
    referenceId: row.paymentId || row.journalEntryId || row.journalEntryLineId,
    journalEntryId: row.journalEntryId,
    journalEntryLineId: row.journalEntryLineId || null,
    paymentId: row.paymentId,
    accountId: row.accountCode,
    accountName: row.accountName,
    branchId: row.branchId,
    branchName: row.branchName,
    party: row.partyResolved,
    visibility: classifyVisibility(keyInput, auditMode),
    transferClass: classifyTransfer(keyInput),
    openingBalance: rowSide === 'opening',
    bucketClass: sourceModule,
    descriptionHash: hashDescription(row.description),
    rawPointer: `preview:jel:${row.journalEntryLineId}`,
  };
}
