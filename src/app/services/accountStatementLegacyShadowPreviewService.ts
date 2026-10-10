/**
 * Account Statement — legacy shadow preview loader (Phase 2.11).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 *
 * R8-R2 rehearsal: legacy main wrapper deleted; shadow retains underlying legacy APIs.
 */

import type { AccountingStatementMode } from '@/app/lib/accounting/statementEngineTypes';
import { nearestPartyControlAncestorId } from '@/app/lib/partyControlAccounts';
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import { contactService } from '@/app/services/contactService';

/** Matches AccountLedgerReportPage — all branches. */
const STATEMENT_ALL_BRANCHES_SCOPE = undefined;

export type AccountStatementLegacyLoadParams = {
  companyId: string;
  statementType: AccountingStatementMode;
  selectedContactId: string;
  selectedWorkerId: string;
  selectedAccountId: string;
  accounts: Array<{
    id: string;
    name?: string;
    code?: string;
    linked_contact_id?: string | null;
    parent_id?: string | null;
  }>;
  startDate: string;
  endDate: string;
};

export type AccountStatementLegacyShadowPreviewResult = {
  rows: AccountLedgerEntry[];
  closingBalance: number;
  compareSource: 'legacy_shadow';
};

function closingFromEntries(rows: AccountLedgerEntry[]): number {
  if (!rows.length) return 0;
  const last = rows[rows.length - 1];
  return Number(last.running_balance ?? (last as { balance?: number }).balance) || 0;
}

async function loadAccountStatementLegacyRows(
  params: AccountStatementLegacyLoadParams,
): Promise<AccountLedgerEntry[]> {
  const {
    companyId,
    statementType,
    selectedContactId,
    selectedWorkerId,
    selectedAccountId,
    accounts,
    startDate,
    endDate,
  } = params;

  if (statementType === 'customer') {
    if (!selectedContactId) return [];
    return (
      (await accountingService.getCustomerLedger(
        selectedContactId,
        companyId,
        STATEMENT_ALL_BRANCHES_SCOPE,
        startDate,
        endDate,
      )) || []
    );
  }

  if (statementType === 'supplier') {
    if (!selectedContactId) return [];
    return (
      (await accountingService.getSupplierApGlJournalLedger(
        selectedContactId,
        companyId,
        STATEMENT_ALL_BRANCHES_SCOPE,
        startDate,
        endDate,
      )) || []
    );
  }

  if (statementType === 'worker') {
    if (!selectedWorkerId) return [];
    return (
      (await accountingService.getWorkerPartyGlJournalLedger(
        selectedWorkerId,
        companyId,
        STATEMENT_ALL_BRANCHES_SCOPE,
        startDate,
        endDate,
      )) || []
    );
  }

  if (!selectedAccountId) return [];

  const accRow = accounts.find((x) => x.id === selectedAccountId);
  if (!accRow) return [];

  let lc = accRow.linked_contact_id ? String(accRow.linked_contact_id).trim() : '';
  const accountsByIdMap = new Map(accounts.map((a) => [a.id, a]));
  const ancestorId = nearestPartyControlAncestorId(accRow as any, accountsByIdMap as any);
  const ctrl = ancestorId ? accountsByIdMap.get(ancestorId) : undefined;
  const ctrlCode = String(ctrl?.code || '').trim();

  if (!lc && accRow.name && companyId) {
    if (ctrlCode === '2000') {
      const resolved = await contactService.resolveSupplierContactIdFromSubledgerAccountName(
        companyId,
        accRow.name,
      );
      if (resolved) lc = resolved;
    } else if (ctrlCode === '1100') {
      const resolved = await contactService.resolveCustomerContactIdFromSubledgerAccountName(
        companyId,
        accRow.name,
      );
      if (resolved) lc = resolved;
    }
  }

  if (lc && ctrl && (ctrlCode === '1100' || ctrlCode === '2000' || ctrlCode === '2010' || ctrlCode === '1180')) {
    if (ctrlCode === '2000') {
      return (
        (await accountingService.getSupplierApGlJournalLedger(
          lc,
          companyId,
          STATEMENT_ALL_BRANCHES_SCOPE,
          startDate,
          endDate,
        )) || []
      );
    }
    if (ctrlCode === '1100') {
      return (
        (await accountingService.getCustomerLedger(
          lc,
          companyId,
          STATEMENT_ALL_BRANCHES_SCOPE,
          startDate,
          endDate,
          undefined,
          'default',
        )) || []
      );
    }
    return (
      (await accountingService.getWorkerPartyGlJournalLedger(
        lc,
        companyId,
        STATEMENT_ALL_BRANCHES_SCOPE,
        startDate,
        endDate,
      )) || []
    );
  }

  return (
    (await accountingService.getAccountLedger(
      selectedAccountId,
      companyId,
      startDate,
      endDate,
      STATEMENT_ALL_BRANCHES_SCOPE,
    )) || []
  );
}

export async function loadAccountStatementLegacyShadowPreview(
  params: AccountStatementLegacyLoadParams,
): Promise<AccountStatementLegacyShadowPreviewResult> {
  const rows = await loadAccountStatementLegacyRows(params);
  return {
    rows,
    closingBalance: closingFromEntries(rows),
    compareSource: 'legacy_shadow',
  };
}
