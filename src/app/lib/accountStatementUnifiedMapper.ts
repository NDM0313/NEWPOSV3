/**
 * Map unified RPC rows → Account Statement preview row shape (Phase 2.4).
 * Preview rows are read-only — no payment enrichment or drill-down.
 */

import type { AccountLedgerEntry } from '@/app/services/accountingService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

export function mapUnifiedRowToAccountStatement(row: UnifiedLedgerRow): AccountLedgerEntry {
  const refType = row.referenceType ?? 'journal';
  return {
    date: row.entryDate,
    reference_number: row.entryNo || '—',
    entry_no: row.entryNo,
    description: row.description || '—',
    debit: row.debit,
    credit: row.credit,
    running_balance: row.runningBalance,
    source_module: 'Accounting',
    journal_entry_id: row.journalEntryId,
    je_reference_type: refType,
    journal_line_id: row.journalEntryLineId || null,
    branch_name: row.branchName ?? undefined,
    account_name: row.accountName ?? undefined,
    counter_account: row.accountName ?? undefined,
    document_type: refType,
  };
}

export function mapUnifiedRowsToAccountStatement(rows: UnifiedLedgerRow[]): AccountLedgerEntry[] {
  return rows.map(mapUnifiedRowToAccountStatement);
}
