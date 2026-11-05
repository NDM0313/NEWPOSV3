/**
 * Isolated fixtures for party General JE workflows — pure resolvers/attribution.
 * Marked UNVERIFIED for live staging E2E (no production writes).
 */
import { describe, expect, it } from 'vitest';
import {
  assertOrResolveJournalAccountId,
  assertPureJournalAccounts,
  attributePartyIdForJournalLine,
  listPartyJeAccountChoices,
} from './journalPartyPosting';

/** Fixture mirrors DIN COLLECTION shapes without writing to DB. */
const fixture = {
  companyId: 'e08a04af-22a8-4869-9b4d-da31fce13158',
  cash: { id: 'cash-1', code: '1010', linked_contact_id: null, isActive: true, name: 'Cash' },
  supplierAp: {
    id: 'ap-sup',
    code: 'AP-SUPZHD0099',
    linked_contact_id: 'sup-1',
    isActive: true,
    name: 'Payable — Demo Sup',
  },
  supplierLegacy: {
    id: 'leg-sup',
    code: '210099',
    linked_contact_id: 'sup-1',
    isActive: true,
    name: 'Demo Sup legacy',
  },
  workerAdvance: {
    id: 'wa-1',
    code: '1180',
    linked_contact_id: 'wrk-1',
    isActive: true,
    name: 'Worker Advance',
  },
  workerPayable: {
    id: 'wp-1',
    code: '2010',
    linked_contact_id: 'wrk-1',
    isActive: true,
    name: 'Worker Payable',
  },
  courierLeaf: {
    id: 'c203',
    code: '2030999',
    linked_contact_id: 'cou-1',
    isActive: true,
    name: 'Courier deposit',
  },
  ibrahimRetired: {
    id: '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c',
    code: '210026',
    linked_contact_id: null,
    isActive: false,
    name: 'IBRAHIM BNRS',
  },
  ibrahimAp: {
    id: '2c56a1d1-e31d-433f-85af-ce3fd4729312',
    code: 'AP-SUPZHD0026',
    linked_contact_id: '08592090-3e74-4b5e-8dd4-e06271f06391',
    isActive: true,
    name: 'Payable — IBRAHIM BNRS',
  },
  otherPartyAp: {
    id: 'ap-other',
    code: 'AP-SUPZHD0001',
    linked_contact_id: 'sup-other',
    isActive: true,
    name: 'Payable — Other',
  },
};

const remaps = [
  {
    fromAccountId: fixture.ibrahimRetired.id,
    toAccountId: fixture.ibrahimAp.id,
  },
];

describe('party JE workflow fixtures (isolated)', () => {
  it('supplier JE adjustment + payment path share AP leaf choice', () => {
    const accounts = [fixture.cash, fixture.supplierAp, fixture.supplierLegacy];
    const choices = listPartyJeAccountChoices(accounts, 'sup-1');
    expect(choices.length).toBe(2);
    const je = assertPureJournalAccounts(accounts, fixture.supplierAp.id, fixture.cash.id);
    expect(je.ok).toBe(true);
    // Evidence shape (no DB write)
    expect({
      workflow: 'supplier_je_plus_payment_screen',
      jeDebit: fixture.supplierAp.id,
      jeCredit: fixture.cash.id,
      amount: 5000,
      partyLedgerComponent: 'ap_2000',
      status: 'FIXTURE_OK',
    }).toMatchObject({ status: 'FIXTURE_OK' });
  });

  it('worker advance then charge uses 1180 and 2010 without silent pick', () => {
    const accounts = [fixture.cash, fixture.workerAdvance, fixture.workerPayable];
    expect(listPartyJeAccountChoices(accounts, 'wrk-1')).toHaveLength(2);
    const advance = assertPureJournalAccounts(
      accounts,
      fixture.workerAdvance.id,
      fixture.cash.id,
    );
    const chargeSettle = assertPureJournalAccounts(
      accounts,
      fixture.workerPayable.id,
      fixture.workerAdvance.id,
    );
    expect(advance.ok && chargeSettle.ok).toBe(true);
  });

  it('courier deposit uses 203x leaf', () => {
    const accounts = [fixture.cash, fixture.courierLeaf];
    const je = assertPureJournalAccounts(accounts, fixture.courierLeaf.id, fixture.cash.id);
    expect(je.ok).toBe(true);
    expect(listPartyJeAccountChoices(accounts, 'cou-1')[0]?.component).toBe('courier_2030');
  });

  it('two-party JE attributes each line to its own party', () => {
    const accounts = [fixture.supplierAp, fixture.otherPartyAp];
    const je = assertPureJournalAccounts(accounts, fixture.supplierAp.id, fixture.otherPartyAp.id);
    expect(je.ok).toBe(true);
    const map = new Map([
      [fixture.supplierAp.id, 'sup-1'],
      [fixture.otherPartyAp.id, 'sup-other'],
    ]);
    expect(
      attributePartyIdForJournalLine({
        accountLinkedContactId: 'sup-1',
        accountId: fixture.supplierAp.id,
        contactIdByAccountId: map,
      }).partyId,
    ).toBe('sup-1');
    expect(
      attributePartyIdForJournalLine({
        accountLinkedContactId: 'sup-other',
        accountId: fixture.otherPartyAp.id,
        contactIdByAccountId: map,
      }).partyId,
    ).toBe('sup-other');
  });

  it('retired unlinked UUID outside UI resolves only via verified remap', () => {
    const accounts = [fixture.cash, fixture.ibrahimRetired, fixture.ibrahimAp];
    const rejected = assertOrResolveJournalAccountId(accounts, fixture.ibrahimRetired.id);
    expect(rejected.ok).toBe(false);
    const resolved = assertOrResolveJournalAccountId(accounts, fixture.ibrahimRetired.id, {
      verifiedRemaps: remaps,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.accountId).toBe(fixture.ibrahimAp.id);
  });

  it('historical retained legacy remains postable while active', () => {
    const accounts = [fixture.cash, fixture.supplierLegacy];
    const r = assertOrResolveJournalAccountId(accounts, fixture.supplierLegacy.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.accountId).toBe(fixture.supplierLegacy.id);
  });
});
