import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAccountStatementPreviewTarget } from './accountStatementUnifiedPreviewTarget';
import { MR_JALIL_CONTACT_ID } from '@/app/lib/unifiedLedgerGoldenFixtures';

const accounts = [
  { id: 'acc-ar', code: '1100-CUS', name: 'AR Customer', linked_contact_id: MR_JALIL_CONTACT_ID, parent_id: 'ctrl-1100' },
  { id: 'ctrl-1100', code: '1100', name: 'Accounts Receivable', linked_contact_id: null, parent_id: null },
  { id: 'acc-cash', code: '1010', name: 'Cash', linked_contact_id: null, parent_id: null },
];

test('customer mode resolves party hybrid target', () => {
  const t = resolveAccountStatementPreviewTarget({
    statementType: 'customer',
    selectedContactId: MR_JALIL_CONTACT_ID,
    selectedWorkerId: '',
    selectedAccountId: '',
    accounts,
  });
  assert.equal(t.kind, 'party');
  if (t.kind === 'party') {
    assert.equal(t.partyType, 'customer');
    assert.equal(t.partyId, MR_JALIL_CONTACT_ID);
    assert.match(t.legacyLabel, /hybrid/i);
  }
});

test('gl cash account resolves account ledger target', () => {
  const t = resolveAccountStatementPreviewTarget({
    statementType: 'gl',
    selectedContactId: '',
    selectedWorkerId: '',
    selectedAccountId: 'acc-cash',
    accounts,
  });
  assert.equal(t.kind, 'account');
  if (t.kind === 'account') {
    assert.equal(t.accountId, 'acc-cash');
  }
});

test('gl AR subledger with linked contact routes to customer party', () => {
  const t = resolveAccountStatementPreviewTarget({
    statementType: 'gl',
    selectedContactId: '',
    selectedWorkerId: '',
    selectedAccountId: 'acc-ar',
    accounts,
  });
  assert.equal(t.kind, 'party');
  if (t.kind === 'party') {
    assert.equal(t.partyType, 'customer');
    assert.equal(t.partyId, MR_JALIL_CONTACT_ID);
  }
});

test('missing contact returns none', () => {
  const t = resolveAccountStatementPreviewTarget({
    statementType: 'customer',
    selectedContactId: '',
    selectedWorkerId: '',
    selectedAccountId: '',
    accounts,
  });
  assert.equal(t.kind, 'none');
});
