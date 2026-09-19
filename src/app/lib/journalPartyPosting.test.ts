import { describe, expect, it } from 'vitest';
import {
  assertOrResolveJournalAccountId,
  assertPureJournalAccounts,
  attributePartyIdForJournalLine,
  classifyJournalGlComponent,
  journalPartyRoleHintFromContactType,
  listPartyJeAccountChoices,
  resolvePartyLinkedAccountId,
} from './journalPartyPosting';

const accounts = [
  {
    id: 'leg-dhl',
    code: '210007',
    linked_contact_id: 'c-dhl',
    isActive: true,
    name: 'DHL',
  },
  {
    id: 'ap-dhl',
    code: 'AP-SUPZHD0007',
    linked_contact_id: 'c-dhl',
    isActive: true,
    name: 'Payable — DHL',
  },
  {
    id: 'leg-ibrahim-inactive',
    code: '210026',
    linked_contact_id: null,
    isActive: false,
    name: 'IBRAHIM BNRS',
  },
  {
    id: 'ap-ibrahim',
    code: 'AP-SUPZHD0026',
    linked_contact_id: 'c-ibrahim',
    isActive: true,
    name: 'Payable — IBRAHIM',
  },
  {
    id: 'wa-worker',
    code: '1180',
    linked_contact_id: 'c-worker',
    isActive: true,
    name: 'Worker Advance',
  },
  {
    id: 'wp-worker',
    code: '2010',
    linked_contact_id: 'c-worker',
    isActive: true,
    name: 'Worker Payable',
  },
  {
    id: 'courier-leaf',
    code: '2030162',
    linked_contact_id: 'c-courier',
    isActive: true,
    name: 'DHL PK',
  },
  {
    id: 'cash',
    code: '1010',
    linked_contact_id: null,
    isActive: true,
  },
];

const ibrahimRemap = [
  { fromAccountId: 'leg-ibrahim-inactive', toAccountId: 'ap-ibrahim' },
];

describe('journalPartyPosting', () => {
  it('maps contact types to role hints without mutating contacts', () => {
    expect(journalPartyRoleHintFromContactType('supplier')).toBe('supplier_ap');
    expect(journalPartyRoleHintFromContactType('worker')).toBe('worker');
    expect(journalPartyRoleHintFromContactType('customer')).toBe('customer_ar');
  });

  it('lists role-labeled choices and refuses silent pick when multiple', () => {
    const choices = listPartyJeAccountChoices(accounts, 'c-dhl');
    expect(choices).toHaveLength(2);
    expect(choices.map((c) => c.component).sort()).toEqual(['ap_2000', 'legacy_2090']);
    expect(resolvePartyLinkedAccountId(accounts, 'c-dhl')).toBe('ap-dhl');
    expect(resolvePartyLinkedAccountId(accounts, 'c-worker')).toBeNull();
    expect(listPartyJeAccountChoices(accounts, 'c-worker')).toHaveLength(2);
  });

  it('classifies worker and courier components', () => {
    expect(classifyJournalGlComponent(accounts.find((a) => a.id === 'wa-worker')!)).toBe(
      'worker_1180',
    );
    expect(classifyJournalGlComponent(accounts.find((a) => a.id === 'courier-leaf')!)).toBe(
      'courier_2030',
    );
  });

  it('allows active legacy without forcing AP remap', () => {
    const r = assertOrResolveJournalAccountId(accounts, 'leg-dhl');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.accountId).toBe('leg-dhl');
      expect(r.resolvedFrom).toBeUndefined();
    }
  });

  it('resolves unlinked retired via verified remap only (not name)', () => {
    const noRemap = assertOrResolveJournalAccountId(accounts, 'leg-ibrahim-inactive');
    expect(noRemap.ok).toBe(false);

    const withRemap = assertOrResolveJournalAccountId(accounts, 'leg-ibrahim-inactive', {
      verifiedRemaps: ibrahimRemap,
    });
    expect(withRemap.ok).toBe(true);
    if (withRemap.ok) expect(withRemap.accountId).toBe('ap-ibrahim');
  });

  it('rejects inactive account with no mapping', () => {
    const r = assertOrResolveJournalAccountId(
      [{ id: 'dead', code: '210099', isActive: false, linked_contact_id: null }],
      'dead',
    );
    expect(r.ok).toBe(false);
  });

  it('allows cash + AP pure journal', () => {
    const r = assertPureJournalAccounts(accounts, 'ap-dhl', 'cash');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.debitAccountId).toBe('ap-dhl');
      expect(r.creditAccountId).toBe('cash');
    }
  });

  it('two linked party leaves can form a multi-party JE; each line attributes separately', () => {
    const multi = [
      ...accounts,
      {
        id: 'ap-kiran',
        code: 'AP-SUPZHD0036',
        linked_contact_id: 'c-kiran',
        isActive: true,
      },
    ];
    const r = assertPureJournalAccounts(multi, 'ap-dhl', 'ap-kiran');
    expect(r.ok).toBe(true);

    const contactByAccount = new Map([
      ['ap-dhl', 'c-dhl'],
      ['ap-kiran', 'c-kiran'],
    ]);
    expect(
      attributePartyIdForJournalLine({
        accountLinkedContactId: 'c-dhl',
        accountId: 'ap-dhl',
        contactIdByAccountId: contactByAccount,
      }).partyId,
    ).toBe('c-dhl');
    expect(
      attributePartyIdForJournalLine({
        accountLinkedContactId: 'c-kiran',
        accountId: 'ap-kiran',
        contactIdByAccountId: contactByAccount,
      }).partyId,
    ).toBe('c-kiran');
  });

  it('does not invent party from cash line', () => {
    const r = attributePartyIdForJournalLine({
      accountLinkedContactId: null,
      accountId: 'cash',
    });
    expect(r.partyId).toBeNull();
    expect(r.unresolved).toBe(true);
  });
});
