/**
 * V2-only: prefetch transaction detail before opening TransactionDetailModal.
 * Read-only — uses existing accountingService lookups (same priority as modal).
 */
import { accountingService } from '@/app/services/accountingService';
import { resolveLedgerTransactionOpenRef } from '@/app/lib/ledgerTransactionOpenRef';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PrefetchLedgerRowResult =
  | { ok: true; referenceNumber: string; journalEntryIdHint?: string }
  | { ok: false };

function resolveOpenRef(row: LedgerStatementV2Row): { referenceNumber: string; journalEntryIdHint?: string } {
  if (row.glEntry) {
    const ref = resolveLedgerTransactionOpenRef(row.glEntry);
    return {
      referenceNumber: ref.referenceNumber,
      journalEntryIdHint: ref.journalEntryId,
    };
  }
  const refNo = row.referenceNo || row.id;
  return {
    referenceNumber: refNo,
    journalEntryIdHint: row.journalEntryId,
  };
}

export async function prefetchLedgerRowTransaction(
  companyId: string,
  row: LedgerStatementV2Row,
): Promise<PrefetchLedgerRowResult> {
  const { referenceNumber, journalEntryIdHint } = resolveOpenRef(row);
  if (!referenceNumber || referenceNumber === 'Opening Balance') {
    return { ok: false };
  }

  const hintId = String(journalEntryIdHint || '').trim();
  const hintIsUuid = UUID_RE.test(hintId);
  const isUUID = UUID_RE.test(referenceNumber);
  let data = null;

  if (hintIsUuid) {
    data = await accountingService.getEntryById(hintId, companyId);
  }
  if (!data && isUUID) {
    data = await accountingService.getEntryById(referenceNumber, companyId);
  }
  if (!data) {
    data = await accountingService.getEntryByReference(referenceNumber, companyId, {
      journalEntryIdHint: hintIsUuid ? hintId : undefined,
    });
  }

  if (!data) return { ok: false };

  return {
    ok: true,
    referenceNumber,
    journalEntryIdHint: hintIsUuid ? hintId : data.id || journalEntryIdHint,
  };
}
