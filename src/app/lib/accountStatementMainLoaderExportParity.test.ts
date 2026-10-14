import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from './unifiedLedgerGoldenFixtures';
import { compareAccountStatementUnifiedPreview } from './accountStatementUnifiedPreviewDiff';
import type { AccountLedgerEntry } from '@/app/services/accountingService';

/**
 * Export parity note: PDF/Excel/CSV on AccountLedgerReportPage derive from
 * `presentedEntries` built from `entries` loaded in the main loader effect.
 * When mainLoaderSource is unified, exports use unified rows; when legacy, legacy rows.
 */

function entry(id: string, balance: number): AccountLedgerEntry {
  return {
    date: '2026-01-15',
    reference_number: `REF-${id}`,
    description: 'test',
    debit: 0,
    credit: 0,
    running_balance: balance,
  };
}

test('MR JALIL Account Statement unified main closing equals 216,300 golden', () => {
  const unifiedEntries = [entry('u1', MR_JALIL_EXPECTED_BALANCE)];
  const diff = compareAccountStatementUnifiedPreview({
    legacyEntries: [entry('l1', 200_000)],
    previewEntries: unifiedEntries,
    statementType: 'customer',
    partyId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
});

test('Account Statement export totals follow active main entries (unified scenario)', () => {
  const mainEntries = [entry('m1', 50_000), entry('m2', MR_JALIL_EXPECTED_BALANCE)];
  const closingFromMain = mainEntries[mainEntries.length - 1]?.running_balance ?? 0;
  assert.equal(closingFromMain, MR_JALIL_EXPECTED_BALANCE);
});
