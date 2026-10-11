import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGeneralJournalAutoDescription,
  composeJournalEntryDescription,
} from './journalEntryDescription';

test('general auto is From-Dr · To-Cr without Journal entry or By', () => {
  const s = buildGeneralJournalAutoDescription({
    debitName: 'Cash',
    debitCode: '1000',
    creditName: 'Accounts Receivable',
    creditCode: '1100',
    addedByName: 'Nadeem Khan',
  });
  assert.equal(s, 'From-Dr Cash (1000) · To-Cr Accounts Receivable (1100)');
  assert.equal(s.includes('Journal entry'), false);
  assert.equal(s.includes('By '), false);
});

test('compose matches formula auto | notes | Ref', () => {
  const s = composeJournalEntryDescription({
    auto: 'From-Dr WALI T/T (1202) · To-Cr NDM MZ (DC0159)',
    userNotes: 'New test',
    reference: '435345',
  });
  assert.equal(
    s,
    'From-Dr WALI T/T (1202) · To-Cr NDM MZ (DC0159) | New test | Ref: 435345',
  );
});

test('compose omit auto when includeAuto false', () => {
  const s = composeJournalEntryDescription({
    auto: 'From-Dr A · To-Cr B',
    userNotes: 'manual only',
    reference: 'CHQ-9',
    includeAuto: false,
  });
  assert.equal(s.includes('From-Dr'), false);
  assert.match(s, /manual only/);
  assert.match(s, /Ref: CHQ-9/);
});

test('compose includeAuto false with empty notes/ref returns empty', () => {
  const s = composeJournalEntryDescription({
    auto: 'Auto text',
    includeAuto: false,
  });
  assert.equal(s, '');
});
