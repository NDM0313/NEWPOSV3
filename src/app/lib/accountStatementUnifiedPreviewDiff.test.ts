import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AccountLedgerEntry } from '@/app/services/accountingService';
import {
  compareAccountStatementUnifiedPreview,
  defaultUnifiedBasisForAccountStatement,
} from './accountStatementUnifiedPreviewDiff';
import {
  MR_JALIL_CONTACT_ID,
  MR_JALIL_EXPECTED_BALANCE,
} from '@/app/lib/unifiedLedgerGoldenFixtures';

function entry(
  partial: Partial<AccountLedgerEntry> & Pick<AccountLedgerEntry, 'journal_entry_id' | 'running_balance'>
): AccountLedgerEntry {
  return {
    date: '2026-01-01',
    reference_number: 'JE-1',
    description: '—',
    debit: 0,
    credit: 0,
    source_module: 'Accounting',
    ...partial,
  };
}

test('defaultUnifiedBasisForAccountStatement uses official_gl for account target', () => {
  const basis = defaultUnifiedBasisForAccountStatement(
    { kind: 'account', accountId: 'a1', legacyLabel: 'gl' },
    'effective'
  );
  assert.equal(basis, 'official_gl');
});

test('defaultUnifiedBasisForAccountStatement uses audit_full_history in audit view', () => {
  const basis = defaultUnifiedBasisForAccountStatement(
    { kind: 'party', partyType: 'customer', partyId: 'c1', legacyLabel: 'hybrid' },
    'audit'
  );
  assert.equal(basis, 'audit_full_history');
});

test('compareAccountStatementUnifiedPreview passes when closing balances match', () => {
  const legacy = [entry({ journal_entry_id: 'je-1', running_balance: 100 })];
  const preview = [entry({ journal_entry_id: 'je-1', running_balance: 100 })];
  const diff = compareAccountStatementUnifiedPreview({ legacyEntries: legacy, previewEntries: preview });
  assert.equal(diff.pass, true);
  assert.equal(diff.difference, 0);
});

test('MR JALIL golden closing sets goldenPass', () => {
  const legacy = [entry({ journal_entry_id: 'je-1', running_balance: MR_JALIL_EXPECTED_BALANCE })];
  const preview = [entry({ journal_entry_id: 'je-1', running_balance: MR_JALIL_EXPECTED_BALANCE })];
  const diff = compareAccountStatementUnifiedPreview({
    legacyEntries: legacy,
    previewEntries: preview,
    statementType: 'customer',
    partyId: MR_JALIL_CONTACT_ID,
  });
  assert.equal(diff.goldenPass, true);
});
