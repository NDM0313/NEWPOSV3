/**
 * Developer-only: compare GL official statement vs operational document activity.
 * Does NOT affect official V2 balance.
 */
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { buildTransactionsWithOpeningBalance, type Transaction } from '@/app/services/customerLedgerTypes';
import {
  getSupplierOperationalLedgerData,
  getWorkerLedgerData,
} from '@/app/services/ledgerDataAdapters';
import type {
  LedgerDocumentComparisonRef,
  LedgerDocumentComparisonResult,
  LedgerStatementV2Filters,
  LedgerStatementV2Row,
  LedgerStatementV2Summary,
} from '@/app/features/ledger-statement-center-v2/types';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function rowKey(ref: string, date: string, debit: number, credit: number): string {
  return `${String(ref || '').trim().toLowerCase()}|${date}|${debit}|${credit}`;
}

function glRowToRef(r: LedgerStatementV2Row): LedgerDocumentComparisonRef {
  return {
    referenceNo: r.referenceNo,
    date: r.date,
    amount: round2(Math.max(r.debit, r.credit)),
    debit: r.debit,
    credit: r.credit,
    source: 'gl',
  };
}

function operationalRowToRef(t: Transaction): LedgerDocumentComparisonRef {
  return {
    referenceNo: t.referenceNo,
    date: t.date,
    amount: round2(Math.max(t.debit, t.credit)),
    debit: round2(t.debit),
    credit: round2(t.credit),
    source: 'document',
  };
}

async function loadOperationalTransactions(
  companyId: string,
  filters: LedgerStatementV2Filters,
  entityLabel: string,
): Promise<{ transactions: Transaction[]; closingBalance: number }> {
  const { statementType, entityId, fromDate, toDate } = filters;
  if (!entityId) return { transactions: [], closingBalance: 0 };

  if (statementType === 'customer') {
    const summary = await customerLedgerAPI.getLedgerSummary(entityId, companyId, fromDate, toDate, {
      branchId: null,
    });
    const txs = await customerLedgerAPI.getTransactions(entityId, companyId, fromDate, toDate, {
      branchId: null,
    });
    const opening = summary?.openingBalance ?? 0;
    const withOpening = buildTransactionsWithOpeningBalance(opening, txs || [], fromDate);
    const closing = withOpening.length ? withOpening[withOpening.length - 1].runningBalance : opening;
    return { transactions: withOpening, closingBalance: round2(closing) };
  }
  if (statementType === 'supplier') {
    const data = await getSupplierOperationalLedgerData(companyId, entityId, entityLabel, fromDate, toDate);
    const withOpening = buildTransactionsWithOpeningBalance(data.openingBalance, data.transactions, fromDate, {
      openingPerspective: 'payable',
    });
    const closing = withOpening.length ? withOpening[withOpening.length - 1].runningBalance : data.openingBalance;
    return { transactions: withOpening, closingBalance: round2(closing) };
  }
  if (statementType === 'worker') {
    const data = await getWorkerLedgerData(companyId, entityId, entityLabel, fromDate, toDate);
    const withOpening = buildTransactionsWithOpeningBalance(data.openingBalance, data.transactions, fromDate, {
      openingPerspective: 'payable',
    });
    const closing = withOpening.length ? withOpening[withOpening.length - 1].runningBalance : data.openingBalance;
    return { transactions: withOpening, closingBalance: round2(closing) };
  }
  return { transactions: [], closingBalance: 0 };
}

export async function compareGlWithDocumentsV2(
  companyId: string,
  filters: LedgerStatementV2Filters,
  entityLabel: string,
  glRows: LedgerStatementV2Row[],
  glSummary: LedgerStatementV2Summary,
): Promise<LedgerDocumentComparisonResult> {
  const glClosingBalance = round2(glSummary.closingBalance);

  if (filters.statementType === 'account') {
    return {
      glClosingBalance,
      documentClosingBalance: glClosingBalance,
      difference: 0,
      onlyInGl: [],
      onlyInDocuments: [],
      note: 'Account ledger is GL-only; no separate document statement.',
    };
  }

  const { transactions, closingBalance: documentClosingBalance } = await loadOperationalTransactions(
    companyId,
    filters,
    entityLabel,
  );

  const glRefs = glRows.filter((r) => r.id !== 'opening-balance').map(glRowToRef);
  const docRefs = transactions.filter((t) => t.id !== 'opening-balance').map(operationalRowToRef);

  const glKeys = new Set(glRefs.map((r) => rowKey(r.referenceNo, r.date, r.debit, r.credit)));
  const docKeys = new Set(docRefs.map((r) => rowKey(r.referenceNo, r.date, r.debit, r.credit)));

  const onlyInGl = glRefs.filter((r) => !docKeys.has(rowKey(r.referenceNo, r.date, r.debit, r.credit)));
  const onlyInDocuments = docRefs.filter((r) => !glKeys.has(rowKey(r.referenceNo, r.date, r.debit, r.credit)));

  return {
    glClosingBalance,
    documentClosingBalance: round2(documentClosingBalance),
    difference: round2(glClosingBalance - documentClosingBalance),
    onlyInGl,
    onlyInDocuments,
  };
}
