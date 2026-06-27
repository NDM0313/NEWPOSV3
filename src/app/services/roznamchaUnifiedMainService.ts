/**
 * Roznamcha — unified engine main loader (Phase 2.14, parity fix Phase 2.15).
 * Uses payment+journal composite parity engine — not raw GL RPC row mapping.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { AccountFilter } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import type { RoznamchaResult } from '@/app/services/roznamchaService';
import { assembleRoznamchaUnifiedParityMain } from '@/app/services/roznamchaUnifiedParityAssembler';

export type RoznamchaUnifiedMainResult = RoznamchaResult & {
  unifiedRows: UnifiedLedgerRow[];
  parityEngine?: 'roznamcha_payment_journal_composite';
};

export async function loadRoznamchaUnifiedMain(params: {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
  paymentLedgerAccountId: string | null;
  paymentAccountOptions: Array<{ id: string; label: string }>;
  basis?: UnifiedLedgerBasis;
}): Promise<RoznamchaUnifiedMainResult> {
  return assembleRoznamchaUnifiedParityMain(params);
}
