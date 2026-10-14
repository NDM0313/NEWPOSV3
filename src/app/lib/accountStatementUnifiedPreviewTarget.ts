/**
 * Resolve Account Statement preview RPC target from applied filters (Phase 2.4).
 * Mirrors AccountLedgerReportPage legacy load branching (sync subset).
 */

import type { AccountingStatementMode } from '@/app/lib/accounting/statementEngineTypes';
import { nearestPartyControlAncestorId } from '@/app/lib/partyControlAccounts';
import type { UnifiedPartyType } from '@/app/services/unifiedLedgerService';

export type AccountStatementPreviewTarget =
  | {
      kind: 'party';
      partyType: UnifiedPartyType;
      partyId: string;
      legacyLabel: string;
    }
  | {
      kind: 'account';
      accountId: string;
      legacyLabel: string;
    }
  | {
      kind: 'none';
      reason: string;
    };

type AccountRow = {
  id: string;
  name?: string;
  code?: string;
  linked_contact_id?: string | null;
  parent_id?: string | null;
};

export function resolveAccountStatementPreviewTarget(params: {
  statementType: AccountingStatementMode;
  selectedContactId: string;
  selectedWorkerId: string;
  selectedAccountId: string;
  accounts: AccountRow[];
  /** When page async-resolved contact from subledger account name. */
  resolvedLinkedContactId?: string;
}): AccountStatementPreviewTarget {
  const { statementType } = params;

  if (statementType === 'customer') {
    if (!params.selectedContactId) {
      return { kind: 'none', reason: 'Select a customer contact.' };
    }
    return {
      kind: 'party',
      partyType: 'customer',
      partyId: params.selectedContactId,
      legacyLabel: 'getCustomerLedger (hybrid)',
    };
  }

  if (statementType === 'supplier') {
    if (!params.selectedContactId) {
      return { kind: 'none', reason: 'Select a supplier contact.' };
    }
    return {
      kind: 'party',
      partyType: 'supplier',
      partyId: params.selectedContactId,
      legacyLabel: 'getSupplierApGlJournalLedger',
    };
  }

  if (statementType === 'worker') {
    if (!params.selectedWorkerId) {
      return { kind: 'none', reason: 'Select a worker.' };
    }
    return {
      kind: 'party',
      partyType: 'worker',
      partyId: params.selectedWorkerId,
      legacyLabel: 'getWorkerPartyGlJournalLedger',
    };
  }

  if (!params.selectedAccountId) {
    return { kind: 'none', reason: 'Select an account.' };
  }

  const accRow = params.accounts.find((a) => a.id === params.selectedAccountId);
  if (!accRow) {
    return { kind: 'none', reason: 'Account not found.' };
  }

  const accountsById = new Map(params.accounts.map((a) => [a.id, a]));
  const lc =
    (params.resolvedLinkedContactId || accRow.linked_contact_id || '').trim() || '';
  const ancestorId = nearestPartyControlAncestorId(accRow as any, accountsById as any);
  const ctrl = ancestorId ? accountsById.get(ancestorId) : undefined;
  const ctrlCode = String(ctrl?.code || '').trim();

  if (lc && ctrl && (ctrlCode === '1100' || ctrlCode === '2000' || ctrlCode === '2010' || ctrlCode === '1180')) {
    if (ctrlCode === '2000') {
      return {
        kind: 'party',
        partyType: 'supplier',
        partyId: lc,
        legacyLabel: 'getSupplierApGlJournalLedger (party-routed GL)',
      };
    }
    if (ctrlCode === '1100') {
      return {
        kind: 'party',
        partyType: 'customer',
        partyId: lc,
        legacyLabel: 'getCustomerLedger (hybrid, party-routed GL)',
      };
    }
    return {
      kind: 'party',
      partyType: 'worker',
      partyId: lc,
      legacyLabel: 'getWorkerPartyGlJournalLedger (party-routed GL)',
    };
  }

  return {
    kind: 'account',
    accountId: params.selectedAccountId,
    legacyLabel: 'accountingService.getAccountLedger',
  };
}
