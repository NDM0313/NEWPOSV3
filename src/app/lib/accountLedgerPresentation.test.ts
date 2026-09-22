import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alignLedgerRunningBalances,
  buildReversalTwinMatcher,
  filterAuditRowsForReversals,
  shouldPreserveRpcRunningBalancesForAudit,
  type LedgerPresentationRow,
} from './accountLedgerPresentation.ts';

function row(
  partial: Partial<LedgerPresentationRow> & Pick<LedgerPresentationRow, 'debit' | 'credit' | 'running_balance'>,
): LedgerPresentationRow {
  return {
    date: '2026-07-15',
    description: 'Payment',
    payment_id: 'pay-1',
    ...partial,
  };
}

test('include reversals OFF hides reversal row and its payment twin', () => {
  const base = [
    row({ debit: 0, credit: 200_000, running_balance: 4_109_458, description: 'Receipt RCV-0326' }),
    row({
      debit: 200_000,
      credit: 0,
      running_balance: 4_309_458,
      description: 'Reversal of: Receipt RCV-0326',
      je_reference_type: 'correction_reversal',
      ledger_kind: 'reversal',
    }),
  ];
  const matcher = buildReversalTwinMatcher(base);
  const filtered = filterAuditRowsForReversals(base, false, matcher);
  assert.equal(filtered.length, 0);
});

test('include reversals ON keeps both legs with unchanged RPC running balances', () => {
  const base = [
    row({ debit: 0, credit: 200_000, running_balance: 3_909_458, description: 'Receipt RCV-0326' }),
    row({
      debit: 200_000,
      credit: 0,
      running_balance: 3_909_458,
      description: 'Reversal of: Receipt RCV-0326',
      je_reference_type: 'correction_reversal',
      ledger_kind: 'reversal',
    }),
  ];
  const matcher = buildReversalTwinMatcher(base);
  const filtered = filterAuditRowsForReversals(base, true, matcher);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[1].running_balance, 3_909_458);
  assert.equal(shouldPreserveRpcRunningBalancesForAudit(true, true), true);
});

test('OFF and ON closing parity after realign on hidden pair', () => {
  const opening = 3_709_458;
  const base = [
    row({
      debit: 200_000,
      credit: 0,
      running_balance: 3_909_458,
      description: 'Earlier receipt',
      payment_id: 'pay-0',
    }),
    row({ debit: 0, credit: 200_000, running_balance: 3_709_458, description: 'Receipt RCV-0326' }),
    row({
      debit: 200_000,
      credit: 0,
      running_balance: 3_909_458,
      description: 'Reversal of: Receipt RCV-0326',
      je_reference_type: 'correction_reversal',
      ledger_kind: 'reversal',
    }),
  ];
  const matcher = buildReversalTwinMatcher(base);

  const offRows = filterAuditRowsForReversals(base, false, matcher).map((e) => ({
    ...e,
    displayDebit: e.debit,
    displayCredit: e.credit,
    displayRunningBalance: e.running_balance,
  }));
  const offAligned = alignLedgerRunningBalances(offRows, false);
  const offClosing = offAligned[offAligned.length - 1]?.displayRunningBalance ?? opening;

  const onRows = filterAuditRowsForReversals(base, true, matcher).map((e) => ({
    ...e,
    displayDebit: e.debit,
    displayCredit: e.credit,
    displayRunningBalance: e.running_balance,
  }));
  const onClosing = onRows[onRows.length - 1]?.running_balance ?? opening;

  assert.equal(offClosing, 3_909_458);
  assert.equal(onClosing, 3_909_458);
});

test('unpaired reversal stays visible when include reversals OFF', () => {
  const base = [
    row({ debit: 100, credit: 0, running_balance: 100, description: 'Normal receipt', payment_id: 'pay-ok' }),
    row({
      debit: 0,
      credit: 50,
      running_balance: 50,
      description: 'Orphan reversal',
      je_reference_type: 'correction_reversal',
      ledger_kind: 'reversal',
      payment_id: 'pay-orphan',
    }),
  ];
  const matcher = buildReversalTwinMatcher(base);
  const filtered = filterAuditRowsForReversals(base, false, matcher);
  assert.equal(filtered.length, 2);
});
