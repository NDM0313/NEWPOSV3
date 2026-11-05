import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEDGER_V2_EMPTY,
  parseTransferSettlementFromDescription,
  pickCounterAccountLabel,
  shortenLedgerPaymentLabel,
  shouldReplacePaymentMethod,
} from '@/app/lib/ledgerStatementV2Enrichment';

test('parseTransferSettlementFromDescription extracts destination after arrow', () => {
  assert.equal(
    parseTransferSettlementFromDescription('Transfer DIN FHD MZ → YAQOOB Courier'),
    'YAQOOB Courier',
  );
  assert.equal(
    parseTransferSettlementFromDescription('Transfer DIN FHD MZ to HBL Main Account'),
    'HBL Main Account',
  );
});

test('parseTransferSettlementFromDescription extracts via segment', () => {
  assert.equal(
    parseTransferSettlementFromDescription('Courier payment via HBL Faisalabad'),
    'HBL Faisalabad',
  );
});

test('parseTransferSettlementFromDescription returns null for unrelated text', () => {
  assert.equal(parseTransferSettlementFromDescription('Purchase accrual PO-1234'), null);
  assert.equal(parseTransferSettlementFromDescription(''), null);
});

test('pickCounterAccountLabel prefers liquidity accounts', () => {
  const label = pickCounterAccountLabel(
    [
      { lineId: 'l1', accountId: 'a1', name: 'YAQOOB Payable', code: '2031', type: 'liability' },
      { lineId: 'l2', accountId: 'a2', name: 'HBL Main', code: '1010', type: 'bank' },
    ],
    'l1',
    new Set(['a1']),
  );
  assert.equal(label, 'HBL Main (1010)');
});

test('pickCounterAccountLabel excludes viewed account id', () => {
  const label = pickCounterAccountLabel(
    [
      { lineId: 'l1', accountId: 'viewed', name: '2031 Payable', code: '2031', type: 'liability' },
      { lineId: 'l2', accountId: 'bank', name: 'Cash Desk', code: '1001', type: 'cash' },
    ],
    'l1',
    new Set(['viewed']),
  );
  assert.equal(label, 'Cash Desk (1001)');
});

test('shouldReplacePaymentMethod detects placeholder and party account labels', () => {
  const viewed = new Set(['YAQOOB Courier Payable', 'YAQOOB Courier Payable (2031)']);
  assert.equal(shouldReplacePaymentMethod(LEDGER_V2_EMPTY, viewed), true);
  assert.equal(shouldReplacePaymentMethod('YAQOOB Courier Payable (2031)', viewed), true);
  assert.equal(shouldReplacePaymentMethod('HBL Main (1010)', viewed), false);
});

test('shortenLedgerPaymentLabel strips Receivable prefix and AR sub-ledger code', () => {
  assert.equal(
    shortenLedgerPaymentLabel('Receivable — LAL MOHAMMAD (AR-F8FD5E)'),
    'LAL MOHAMMAD',
  );
});

test('shortenLedgerPaymentLabel strips Payable suffix and numeric COA code', () => {
  assert.equal(shortenLedgerPaymentLabel('YAQOOB Payable (2031)'), 'YAQOOB');
});

test('shortenLedgerPaymentLabel shortens bank name without changing plain labels', () => {
  assert.equal(shortenLedgerPaymentLabel('HBL Main (1010)'), 'HBL Main');
  assert.equal(shortenLedgerPaymentLabel('Cash'), 'Cash');
  assert.equal(shortenLedgerPaymentLabel(LEDGER_V2_EMPTY), LEDGER_V2_EMPTY);
});
