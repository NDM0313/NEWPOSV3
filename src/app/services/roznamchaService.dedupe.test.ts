import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeRoznamchaRows,
  roznamchaEntityKeys,
  type RoznamchaDedupeRow,
} from './roznamchaDedupe.ts';

function baseRow(overrides: Partial<RoznamchaDedupeRow>): RoznamchaDedupeRow {
  return {
    id: 'row-1',
    date: '2026-06-04',
    ref: 'RCV-0001',
    details: 'Test',
    direction: 'IN',
    amount: 10000,
    accountType: 'cash',
    accountLabel: 'Cash',
    paymentAccountId: 'cash-g140',
    ...overrides,
  };
}

describe('roznamcha dedupe', () => {
  it('keeps two same-day same-amount rows when sourcePaymentId differs', () => {
    const rows = dedupeRoznamchaRows([
      baseRow({ id: 'pay-a', sourcePaymentId: 'pay-a', paymentAccountId: 'acc-1' }),
      baseRow({ id: 'pay-b', sourcePaymentId: 'pay-b', paymentAccountId: 'acc-2', ref: 'RCV-0002' }),
    ]);
    assert.equal(rows.length, 2);
  });

  it('keeps two rows with same account/amount/date but different sourceJournalEntryId', () => {
    const rows = dedupeRoznamchaRows([
      baseRow({
        id: 'rp-a',
        ref: 'HQ-RCV-0005',
        sourceJournalEntryId: 'je-a',
        sourceRentalPaymentId: 'rp-a',
      }),
      baseRow({
        id: 'rp-b',
        ref: 'HQ-RCV-0006',
        sourceJournalEntryId: 'je-b',
        sourceRentalPaymentId: 'rp-b',
      }),
    ]);
    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.ref === 'HQ-RCV-0005'));
    assert.ok(rows.some((r) => r.ref === 'HQ-RCV-0006'));
  });

  it('keeps two rows with same account/amount/date but different sourceRentalPaymentId', () => {
    const rows = dedupeRoznamchaRows([
      baseRow({ id: 'rp-1', sourceRentalPaymentId: 'rp-1', sourceJournalEntryId: 'je-1' }),
      baseRow({ id: 'rp-2', sourceRentalPaymentId: 'rp-2', sourceJournalEntryId: 'je-2', ref: 'HQ-RCV-0006' }),
    ]);
    assert.equal(rows.length, 2);
  });

  it('HQ-RCV-0005 and HQ-RCV-0006 on same cash account both survive', () => {
    const rows = dedupeRoznamchaRows([
      baseRow({
        id: 'pay-5',
        ref: 'HQ-RCV-0005',
        sourcePaymentId: 'pay-5',
        sourceJournalEntryId: 'uuid-5',
        details: 'Rental advance',
      }),
      baseRow({
        id: 'pay-6',
        ref: 'HQ-RCV-0006',
        sourcePaymentId: 'pay-6',
        sourceJournalEntryId: 'uuid-6',
        details: 'Rental remaining payment — Inayat',
        journalEntryNo: 'JE-0012',
      }),
    ]);
    assert.equal(rows.length, 2);
    const refs = rows.map((r) => r.ref).sort();
    assert.deepEqual(refs, ['HQ-RCV-0005', 'HQ-RCV-0006']);
  });

  it('collapses duplicate sourcePaymentId', () => {
    const payment = baseRow({ id: 'pay-1', sourcePaymentId: 'pay-1' });
    const duplicate = baseRow({
      id: 'jel-99',
      sourcePaymentId: 'pay-1',
      sourceJournalEntryId: 'je-99',
    });
    const rows = dedupeRoznamchaRows([payment, duplicate]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sourcePaymentId, 'pay-1');
  });

  it('prefers payment source over rental and journal duplicates', () => {
    const journal = baseRow({
      id: 'jel-1',
      ref: 'JE-0001',
      sourceJournalEntryId: 'je-1',
    });
    const rental = baseRow({
      id: 'rp-1',
      ref: 'REN-0001-PAY',
      sourceRentalPaymentId: 'rp-1',
      sourceJournalEntryId: 'je-1',
    });
    const payment = baseRow({
      id: 'pay-1',
      ref: 'HQ-RCV-0006',
      sourcePaymentId: 'pay-1',
      sourceJournalEntryId: 'je-1',
    });
    const rows = dedupeRoznamchaRows([journal, rental, payment]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ref, 'HQ-RCV-0006');
  });

  it('prefers rental over orphan when same rental_payment_id', () => {
    const rental = baseRow({
      id: 'rp-10',
      ref: 'HQ-RCV-0007',
      sourceRentalPaymentId: 'rp-10',
      sourceJournalEntryId: 'je-10',
    });
    const orphan = baseRow({
      id: 'orphan-rp-je-10-line-1',
      ref: 'JE-0010',
      sourceJournalEntryId: 'je-10',
    });
    const rows = dedupeRoznamchaRows([orphan, rental]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].ref, 'HQ-RCV-0007');
  });

  it('keeps both payment legs of same transfer JE when both are roznamcha liquidity', () => {
    const rows = dedupeRoznamchaRows([
      baseRow({
        id: 'pay-out',
        ref: 'JE-0238',
        sourcePaymentId: 'pay-out',
        sourceJournalEntryId: 'je-1',
        paymentAccountId: 'usd-tt',
        direction: 'OUT',
        amount: 100,
        accountType: 'bank',
        accountName: 'USD TT Agent Clearing',
        accountLabel: 'USD TT Agent Clearing',
      }),
      baseRow({
        id: 'pay-in',
        ref: 'JE-0238',
        sourcePaymentId: 'pay-in',
        sourceJournalEntryId: 'je-1',
        paymentAccountId: 'fhd-wallet',
        direction: 'IN',
        amount: 100,
        accountType: 'wallet',
        accountName: 'FHD MZ Wallet',
        accountLabel: 'FHD MZ Wallet',
      }),
    ]);
    assert.equal(rows.length, 2);
  });

  it('bank OUT leg survives dedupe alone (WALI T/T excluded upstream by roznamcha filter)', () => {
    const rows = dedupeRoznamchaRows([
      baseRow({
        id: 'pay-out',
        ref: 'JE-0238',
        sourcePaymentId: 'pay-out',
        sourceJournalEntryId: 'je-1',
        paymentAccountId: 'usd-tt',
        direction: 'OUT',
        amount: 100,
        accountType: 'bank',
        accountName: 'USD TT Agent Clearing',
        accountLabel: 'USD TT Agent Clearing',
      }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].direction, 'OUT');
    assert.equal(rows[0].accountName, 'USD TT Agent Clearing');
  });

  it('exposes entity keys for payment rental and journal', () => {
    const keys = roznamchaEntityKeys(
      baseRow({
        sourcePaymentId: 'p1',
        sourceRentalPaymentId: 'r1',
        sourceJournalEntryId: 'j1',
        sourceEconomicEventId: 'e1',
      })
    );
    assert.deepEqual(keys.sort(), ['ee:e1', 'je:j1', 'pay:p1', 'rp:r1'].sort());
  });
});
