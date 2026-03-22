/**
 * Legacy duplicate supplier/user subledger tables have been removed from the app.
 * Supplier/user UI uses purchases + payments + contacts; GL uses journal_entries only.
 * These exports stay as no-ops / empty reads so existing call sites do not write duplicate rows.
 */

export type LedgerType = 'supplier' | 'user';

export interface LedgerMaster {
  id: string;
  company_id: string;
  ledger_type: LedgerType;
  entity_id: string;
  entity_name: string | null;
  opening_balance: number;
  created_at?: string;
  updated_at?: string;
}

export interface LedgerEntryRow {
  id: string;
  company_id: string;
  ledger_id: string;
  entry_date: string;
  debit: number;
  credit: number;
  balance_after: number | null;
  source: string;
  reference_no: string | null;
  reference_id: string | null;
  remarks: string | null;
  created_at?: string;
}

export async function getOrCreateLedger(
  _companyId: string,
  _type: LedgerType,
  _entityId: string,
  _entityName?: string
): Promise<LedgerMaster | null> {
  return null;
}

export interface AddLedgerEntryParams {
  companyId: string;
  ledgerId: string;
  entryDate: string;
  debit: number;
  credit: number;
  source: string;
  referenceNo?: string;
  referenceId?: string;
  remarks?: string;
}

export async function addLedgerEntry(_params: AddLedgerEntryParams): Promise<LedgerEntryRow | null> {
  return null;
}

export async function getLedgerEntries(
  _ledgerId: string,
  _fromDate?: string,
  _toDate?: string
): Promise<LedgerEntryRow[]> {
  return [];
}

export async function getLedgerById(_ledgerId: string): Promise<LedgerMaster | null> {
  return null;
}

/** Opening balances live on contacts (customer/supplier fields). */
export async function updateLedgerOpeningBalance(_ledgerId: string, _openingBalance: number): Promise<boolean> {
  return true;
}

export async function getSupplierLedgersWithBalance(_companyId: string): Promise<Array<{ id: string; name: string; balance: number }>> {
  return [];
}

export async function getUserLedgersWithBalance(_companyId: string): Promise<Array<{ id: string; name: string; balance: number }>> {
  return [];
}
