/**
 * Party Ledger — legacy shadow preview loader (Phase 2.13).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 */

import type { EffectiveLedgerResult } from '@/app/services/effectivePartyLedgerService';
import {
  loadPartyLedgerLegacyMain,
  type PartyLedgerLegacyMainParams,
} from '@/app/services/partyLedgerLegacyMainService';

export type PartyLedgerLegacyShadowPreviewResult = {
  legacy: EffectiveLedgerResult;
  closingBalance: number;
  openingBalance: number;
  compareSource: 'legacy_shadow';
};

export async function loadPartyLedgerLegacyShadowPreview(
  params: PartyLedgerLegacyMainParams & {
    partyName: string;
  },
): Promise<PartyLedgerLegacyShadowPreviewResult> {
  const legacy = await loadPartyLedgerLegacyMain(params);
  return {
    legacy,
    closingBalance: legacy.summary.closingBalance,
    openingBalance: legacy.summary.openingBalance,
    compareSource: 'legacy_shadow',
  };
}
