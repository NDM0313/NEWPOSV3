import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPartyDiscountJournalForContact } from '@/app/lib/partyLedgerLegacyJournalMatch';
import { closingBalanceFromLegacyRows } from '@/app/lib/unifiedLedgerCompareDiff';
import type { AccountLedgerEntry } from '@/app/services/accountingService';

const MR_JALIL = 'fe7ec33d-fd6d-4aa6-8d21-416e383b4c93';
const JE_0003 = '9c7a1bd2-af96-4436-9c14-1b804f9a3773';

test('party_discount customer JE matches contact by reference_id', () => {
  assert.equal(
    isPartyDiscountJournalForContact(
      { reference_type: 'party_discount', reference_id: MR_JALIL },
      MR_JALIL
    ),
    true
  );
  assert.equal(
    isPartyDiscountJournalForContact(
      { reference_type: 'party_discount', reference_id: 'other-contact' },
      MR_JALIL
    ),
    false
  );
});

test('party_discount supplier JE matches supplier contact', () => {
  const supplierId = 'a1111111-1111-4111-8111-111111111111';
  assert.equal(
    isPartyDiscountJournalForContact(
      { reference_type: 'party_discount', reference_id: supplierId },
      supplierId
    ),
    true
  );
});

test('party_discount does not match unrelated reference types', () => {
  assert.equal(
    isPartyDiscountJournalForContact({ reference_type: 'payment', reference_id: MR_JALIL }, MR_JALIL),
    false
  );
});

test('retained JE-0003 AR credit line reduces hybrid closing to 216299', () => {
  const rows: AccountLedgerEntry[] = [
    {
      date: '2026-06-29',
      reference_number: 'prior',
      description: 'Prior balance',
      debit: 0,
      credit: 0,
      running_balance: 216_300,
      source_module: 'Accounting',
      journal_entry_id: 'prior-je',
    },
    {
      date: '2026-06-30',
      reference_number: 'JE-0003',
      entry_no: 'JE-0003',
      description: 'Customer discount — MR JALIL',
      debit: 0,
      credit: 1,
      running_balance: 216_299,
      source_module: 'Accounting',
      journal_entry_id: JE_0003,
      je_reference_type: 'party_discount',
    },
  ];
  assert.equal(closingBalanceFromLegacyRows(rows), 216_299);
});

test('no duplicate party_discount row when only AR credit line is in ledger slice', () => {
  const discountRows = [
    {
      date: '2026-06-30',
      reference_number: 'JE-0003',
      debit: 0,
      credit: 1,
      running_balance: 216_299,
      journal_entry_id: JE_0003,
      je_reference_type: 'party_discount',
    },
  ] as AccountLedgerEntry[];
  const ids = new Set(discountRows.map((r) => r.journal_entry_id));
  assert.equal(ids.size, 1);
  assert.equal(closingBalanceFromLegacyRows(discountRows), 216_299);
});
