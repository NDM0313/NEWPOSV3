import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateJournalLineUsage,
  findDuplicateCodes,
  findMissingSystemAccounts,
  classifyAccountEditSafety,
  inferModulesFromReferenceTypes,
  isNonVoidJournalEntry,
} from './coaHealthChecks';

test('findDuplicateCodes flags repeated codes', () => {
  const issues = findDuplicateCodes([
    { id: '1', code: '1100', name: 'AR' },
    { id: '2', code: '1100', name: 'AR duplicate' },
  ]);
  assert.equal(issues.length, 2);
  assert.equal(issues[0].checkId, 'DUPLICATE_CODE');
});

test('findMissingSystemAccounts flags absent canonical codes', () => {
  const issues = findMissingSystemAccounts([{ id: '1', code: '9999', name: 'Other' }]);
  assert.ok(issues.some((i) => i.checkId === 'MISSING_SYSTEM_ACCOUNT' && i.accountCode === '1000'));
});

test('classifyAccountEditSafety marks control accounts cannot touch', () => {
  const s = classifyAccountEditSafety({ id: '1', code: '1100', name: 'AR', is_group: false }, 5);
  assert.equal(s.cannotTouch, true);
  assert.equal(s.canArchive, false);
});

test('inferModulesFromReferenceTypes maps sale and payment', () => {
  const mods = inferModulesFromReferenceTypes(['sale', 'payment']);
  assert.ok(mods.includes('Sales'));
  assert.ok(mods.includes('Payments'));
});

test('isNonVoidJournalEntry treats null and false as active', () => {
  assert.equal(isNonVoidJournalEntry({ is_void: null }), true);
  assert.equal(isNonVoidJournalEntry({ is_void: false }), true);
  assert.equal(isNonVoidJournalEntry({ is_void: true }), false);
  assert.equal(isNonVoidJournalEntry(null), false);
});

test('aggregateJournalLineUsage excludes voided and foreign-company lines', () => {
  const agg = aggregateJournalLineUsage(
    [
      {
        debit: 100,
        credit: 0,
        journalEntry: {
          company_id: 'co-1',
          entry_date: '2026-01-15',
          reference_type: 'sale',
          is_void: false,
        },
      },
      {
        debit: 50,
        credit: 0,
        journalEntry: {
          company_id: 'co-1',
          entry_date: '2026-02-01',
          reference_type: 'payment',
          is_void: true,
        },
      },
      {
        debit: 25,
        credit: 0,
        journalEntry: {
          company_id: 'co-2',
          entry_date: '2026-02-02',
          reference_type: 'sale',
          is_void: false,
        },
      },
      {
        debit: 10,
        credit: 5,
        journalEntry: {
          company_id: 'co-1',
          entry_date: '2025-12-01',
          reference_type: 'rental',
          is_void: null,
        },
      },
    ],
    'co-1'
  );
  assert.equal(agg.lineCount, 2);
  assert.equal(agg.totalDebit, 110);
  assert.equal(agg.totalCredit, 5);
  assert.equal(agg.firstUsed, '2025-12-01');
  assert.equal(agg.lastUsed, '2026-01-15');
  assert.deepEqual(agg.referenceTypes.sort(), ['rental', 'sale']);
});
