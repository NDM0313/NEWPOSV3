import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';
import {
  compareLedgerV2UnifiedPreview,
  defaultUnifiedBasisForV2Type,
} from './ledgerStatementV2UnifiedPreviewDiff';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from '@/app/lib/unifiedLedgerGoldenFixtures';

function v2Row(
  partial: Partial<LedgerStatementV2Row> & Pick<LedgerStatementV2Row, 'id' | 'runningBalance'>
): LedgerStatementV2Row {
  return {
    date: '2026-01-01',
    referenceNo: 'JE-1',
    transactionType: 'journal',
    description: '—',
    branch: '—',
    debit: 0,
    credit: 0,
    paymentMethod: '—',
    createdBy: '—',
    hasAttachments: false,
    sourceKind: 'journal',
    ...partial,
  };
}

test('defaultUnifiedBasisForV2Type uses effective_party for parties and official_gl for account', () => {
  assert.equal(defaultUnifiedBasisForV2Type('customer'), 'effective_party');
  assert.equal(defaultUnifiedBasisForV2Type('supplier'), 'effective_party');
  assert.equal(defaultUnifiedBasisForV2Type('account'), 'official_gl');
});

test('compareLedgerV2UnifiedPreview passes when closing balances match', () => {
  const legacy = [v2Row({ id: 'a', runningBalance: 100 })];
  const preview = [v2Row({ id: 'a', runningBalance: 100 })];
  const diff = compareLedgerV2UnifiedPreview({ legacyRows: legacy, previewRows: preview });
  assert.equal(diff.pass, true);
  assert.equal(diff.difference, 0);
  assert.equal(diff.missingInNew.length, 0);
  assert.equal(diff.extraInNew.length, 0);
});

test('compareLedgerV2UnifiedPreview detects balance and row diffs', () => {
  const legacy = [
    v2Row({ id: 'a', runningBalance: 100, debit: 100 }),
    v2Row({ id: 'b', runningBalance: 200, debit: 100 }),
  ];
  const preview = [v2Row({ id: 'a', runningBalance: 150, debit: 150 })];
  const diff = compareLedgerV2UnifiedPreview({ legacyRows: legacy, previewRows: preview });
  assert.equal(diff.pass, false);
  assert.equal(diff.oldClosing, 200);
  assert.equal(diff.newClosing, 150);
  assert.equal(diff.missingInNew.length, 1);
  assert.equal(diff.extraInNew.length, 0);
});

test('MR JALIL golden closing sets goldenPass when preview matches 216300', () => {
  const legacy = [v2Row({ id: 'x', runningBalance: MR_JALIL_EXPECTED_BALANCE })];
  const preview = [v2Row({ id: 'x', runningBalance: MR_JALIL_EXPECTED_BALANCE })];
  const diff = compareLedgerV2UnifiedPreview({
    legacyRows: legacy,
    previewRows: preview,
    statementType: 'customer',
    entityId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.goldenPass, true);
  assert.equal(diff.pass, true);
});
