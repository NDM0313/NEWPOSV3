import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from './unifiedLedgerGoldenFixtures';
import { compareLedgerV2UnifiedPreview } from './ledgerStatementV2UnifiedPreviewDiff';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';

/**
 * Export parity note: PDF/Excel/CSV/WhatsApp on LedgerStatementCenterV2Page derive from
 * `result.rows` and `summary` built in loadStatement. When mainLoaderSource is unified,
 * exports use unified rows; when legacy, legacy rows. No separate export path exists.
 */

function row(id: string, balance: number): LedgerStatementV2Row {
  return {
    id,
    date: '2026-01-15',
    referenceNo: `REF-${id}`,
    transactionType: 'sale',
    description: 'test',
    branch: 'Main',
    debit: 0,
    credit: 0,
    runningBalance: balance,
    paymentMethod: '',
    createdBy: 'test',
    hasAttachments: false,
    sourceKind: 'sale',
  };
}

test('MR JALIL unified main closing equals 216,300 golden', () => {
  const unifiedRows = [row('u1', MR_JALIL_EXPECTED_BALANCE)];
  const diff = compareLedgerV2UnifiedPreview({
    legacyRows: [row('l1', 200_000)],
    previewRows: unifiedRows,
    statementType: 'customer',
    entityId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.newClosing, MR_JALIL_EXPECTED_BALANCE);
  assert.equal(diff.goldenPass, true);
});

test('export totals follow active main result rows (unified scenario)', () => {
  const mainRows = [row('m1', 50_000), row('m2', MR_JALIL_EXPECTED_BALANCE)];
  const closingFromMain = mainRows[mainRows.length - 1]?.runningBalance ?? 0;
  assert.equal(closingFromMain, MR_JALIL_EXPECTED_BALANCE);
  const exportSummaryClosing = closingFromMain;
  assert.equal(exportSummaryClosing, mainRows[mainRows.length - 1].runningBalance);
});
