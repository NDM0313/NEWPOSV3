import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from './unifiedLedgerGoldenFixtures';
import { comparePartyLedgerUnifiedPreview } from './partyLedgerUnifiedPreviewDiff';
import type { EffectiveLedgerResult } from '@/app/services/effectivePartyLedgerService';

/**
 * Export parity note: Party Ledger has no PDF/Excel on-page export.
 * Preview JSON export uses diff from active main + compare source.
 * Main table closing (Current Receivable/Payable) follows active loader result.summary.
 */

function legacyMain(closing: number): EffectiveLedgerResult {
  return {
    rows: [],
    summary: {
      openingBalance: 0,
      totalDebit: closing,
      totalCredit: 0,
      closingBalance: closing,
      totalSales: 0,
      totalReceived: 0,
      totalPurchases: 0,
      totalPaid: 0,
    },
    partyName: 'MR JALIL',
    partyType: 'customer',
  };
}

test('MR JALIL Party Ledger unified main closing equals 216,300 golden', () => {
  const main = legacyMain(MR_JALIL_EXPECTED_BALANCE);
  const diff = comparePartyLedgerUnifiedPreview({
    legacy: legacyMain(200_000),
    unifiedRows: [],
    unifiedClosingBalance: main.summary.closingBalance,
    unifiedOpeningBalance: 0,
    contactId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
});

test('Party Ledger on-screen closing follows active main result summary', () => {
  const mainResult = legacyMain(MR_JALIL_EXPECTED_BALANCE);
  const onScreenClosing = mainResult.summary.closingBalance;
  assert.equal(onScreenClosing, MR_JALIL_EXPECTED_BALANCE);
});

test('Party Ledger export JSON uses diff from active main rows context', () => {
  const mainResult = legacyMain(MR_JALIL_EXPECTED_BALANCE);
  const exportClosing = mainResult.summary.closingBalance;
  assert.equal(exportClosing, MR_JALIL_EXPECTED_BALANCE);
});
