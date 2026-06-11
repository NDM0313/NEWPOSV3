import type { LedgerLine } from '../api/reports';
import { formatReferenceTypeLabel } from './formatReferenceTypeLabel';
import type { MobileLedgerStatementRow } from '../components/shared/MobileLedgerStatementPdf';

export function ledgerLineToStatementRow(
  line: LedgerLine,
  displayReference: (entryNo: string, refType?: string) => string,
): MobileLedgerStatementRow {
  return {
    date: line.date,
    referenceNo: displayReference(line.entryNo, line.referenceType),
    transactionType: line.transactionType ?? formatReferenceTypeLabel(line.referenceType),
    description: line.description,
    branch: line.branch,
    debit: line.debit,
    credit: line.credit,
    runningBalance: line.runningBalance,
    paymentMethod: line.paymentMethod,
    createdBy: line.createdBy,
    hasAttachment: line.hasAttachments,
  };
}

export function ledgerLinesToStatementRows(
  lines: LedgerLine[],
  displayReference: (entryNo: string, refType?: string) => string,
): MobileLedgerStatementRow[] {
  return lines.map((l) => ledgerLineToStatementRow(l, displayReference));
}
