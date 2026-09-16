import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EffectiveLedgerResult } from '@/app/services/effectivePartyLedgerService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { comparePartyLedgerUnifiedPreview } from './partyLedgerUnifiedPreviewDiff';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from '@/app/lib/unifiedLedgerGoldenFixtures';

function legacyFixture(closing = 216300): EffectiveLedgerResult {
  return {
    rows: [
      {
        id: 'opening',
        date: '2026-01-01',
        referenceNo: 'OPEN',
        type: 'opening',
        typeLabel: 'Opening',
        description: 'Opening',
        effectiveAmount: 0,
        effectiveAccountName: null,
        effectiveAccountCode: null,
        debit: 0,
        credit: 0,
        runningBalance: 0,
        status: 'active',
        paymentId: null,
        sourceDocumentId: null,
        sourceDocumentType: null,
        mutationCount: 0,
        mutations: [],
        journalEntryNos: [],
        isCollapsed: false,
      },
    ],
    summary: {
      openingBalance: 0,
      totalDebit: 0,
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

test('comparePartyLedgerUnifiedPreview sets goldenPass for MR JALIL unified closing', () => {
  const diff = comparePartyLedgerUnifiedPreview({
    legacy: legacyFixture(200000),
    unifiedRows: [] as UnifiedLedgerRow[],
    unifiedClosingBalance: MR_JALIL_EXPECTED_BALANCE,
    unifiedOpeningBalance: 0,
    contactId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.goldenPass, true);
  assert.equal(diff.totalsPass, false);
});

test('comparePartyLedgerUnifiedPreview totals pass when closing matches', () => {
  const diff = comparePartyLedgerUnifiedPreview({
    legacy: legacyFixture(1000),
    unifiedRows: [] as UnifiedLedgerRow[],
    unifiedClosingBalance: 1000,
    unifiedOpeningBalance: 0,
    contactId: 'other-contact',
  });
  assert.equal(diff.totalsPass, true);
  assert.equal(diff.difference, 0);
});
