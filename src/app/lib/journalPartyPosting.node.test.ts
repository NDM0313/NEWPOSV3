/**
 * Node:test coverage for Add Entry V2 party JE helpers (no vitest).
 * Mirrors client assert/list path used before PostgREST persistence.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertOrResolveJournalAccountId,
  assertPureJournalAccounts,
  listPartyJeAccountChoices,
  resolvePartyLinkedAccountId,
} from './journalPartyPosting.ts';

const accounts = [
  { id: 'cash', code: '1010', linked_contact_id: null, isActive: true, name: 'Cash' },
  {
    id: 'ap-ibrahim',
    code: 'AP-SUPZHD0026',
    linked_contact_id: 'c-ibrahim',
    isActive: true,
    name: 'Payable — IBRAHIM',
  },
  {
    id: 'leg-ibrahim',
    code: '210026',
    linked_contact_id: null,
    isActive: false,
    name: 'IBRAHIM BNRS',
  },
  {
    id: 'nomap',
    code: 'ZZ-NOMAP',
    linked_contact_id: null,
    isActive: false,
    name: 'retired no map',
  },
  {
    id: 'wp',
    code: '2010',
    linked_contact_id: 'c-worker',
    isActive: true,
    name: 'Worker Payable',
  },
  {
    id: 'wa',
    code: '1180',
    linked_contact_id: 'c-worker',
    isActive: true,
    name: 'Worker Advance',
  },
  {
    id: 'courier',
    code: '2030999',
    linked_contact_id: 'c-courier',
    isActive: true,
    name: 'Courier',
  },
  {
    id: 'leg-active-dhl',
    code: '210007',
    linked_contact_id: 'c-dhl',
    isActive: true,
    name: 'DHL legacy active',
  },
  {
    id: 'ap-dhl',
    code: 'AP-SUPZHD0007',
    linked_contact_id: 'c-dhl',
    isActive: true,
    name: 'Payable — DHL',
  },
];

const remaps = [{ fromAccountId: 'leg-ibrahim', toAccountId: 'ap-ibrahim' }];

describe('Add Entry V2 client journal party guards', () => {
  it('Case B: party assist prefers canonical AP for Ibrahim contact', () => {
    const id = resolvePartyLinkedAccountId(accounts, 'c-ibrahim', { preferCanonical: true });
    assert.equal(id, 'ap-ibrahim');
    const choices = listPartyJeAccountChoices(accounts, 'c-ibrahim');
    assert.equal(choices.length, 1);
    assert.equal(choices[0].code, 'AP-SUPZHD0026');
  });

  it('Case C: verified remap resolves retired Ibrahim leaf', () => {
    const r = assertOrResolveJournalAccountId(accounts, 'leg-ibrahim', { verifiedRemaps: remaps });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.accountId, 'ap-ibrahim');
      assert.equal(r.resolvedFrom, 'leg-ibrahim');
    }
  });

  it('Case D: retired without remap returns actionable error', () => {
    const r = assertOrResolveJournalAccountId(accounts, 'nomap', { verifiedRemaps: remaps });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /inactive or retired/i);
      assert.match(r.error, /no verified remap/i);
      assert.doesNotMatch(r.error, /42501|permission denied for function/i);
    }
  });

  it('Case G: worker multi-leaf requires explicit pick; courier allowed', () => {
    assert.equal(listPartyJeAccountChoices(accounts, 'c-worker').length, 2);
    assert.equal(resolvePartyLinkedAccountId(accounts, 'c-worker'), null);
    const pure = assertPureJournalAccounts(accounts, 'cash', 'courier');
    assert.equal(pure.ok, true);
  });

  it('active legacy DHL is allowed (not AP-only)', () => {
    const r = assertOrResolveJournalAccountId(accounts, 'leg-active-dhl');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.accountId, 'leg-active-dhl');
  });
});
