/**
 * Shared vocabulary for Accounting “statement center” surfaces (GL, party, cash/bank, worker).
 * Runtime data stays on journal_entries / journal_entry_lines / accounts / payments (canonical).
 */

export const ACCOUNTING_STATEMENT_MODES = [
  'gl',
  'customer',
  'supplier',
  'cash_bank',
  'account_contact',
  'worker',
] as const;

export type AccountingStatementMode = (typeof ACCOUNTING_STATEMENT_MODES)[number];

export function accountingStatementModeLabel(mode: AccountingStatementMode): string {
  switch (mode) {
    case 'gl':
      return 'General Ledger Statement';
    case 'customer':
      return 'Customer Statement';
    case 'supplier':
      return 'Supplier Statement';
    case 'cash_bank':
      return 'Cash / Bank Statement';
    case 'account_contact':
      return 'Account + Contact Statement';
    case 'worker':
      return 'Worker Statement (WP / WA GL)';
    default:
      return mode;
  }
}

/** Short label for export filenames / PDF titles. */
export function accountingStatementExportSlug(mode: AccountingStatementMode): string {
  return accountingStatementModeLabel(mode).replace(/\s+/g, '_').replace(/[()/]/g, '');
}
