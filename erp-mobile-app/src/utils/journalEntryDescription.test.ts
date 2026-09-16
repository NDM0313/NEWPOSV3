import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeJournalEntryDescription } from './journalEntryDescription';

test('compose includes auto by default', () => {
  const s = composeJournalEntryDescription({
    auto: 'Journal entry · From-Dr A · To-Cr B',
    userNotes: 'extra',
    reference: 'V-1',
  });
  assert.match(s, /Journal entry/);
  assert.match(s, /extra/);
  assert.match(s, /Ref: V-1/);
});

test('compose omit auto when includeAuto false', () => {
  const s = composeJournalEntryDescription({
    auto: 'Journal entry · From-Dr A · To-Cr B',
    userNotes: 'manual only',
    reference: 'CHQ-9',
    includeAuto: false,
  });
  assert.equal(s.includes('From-Dr'), false);
  assert.match(s, /manual only/);
  assert.match(s, /Ref: CHQ-9/);
});

test('compose includeAuto false with empty notes/ref falls back', () => {
  const s = composeJournalEntryDescription({
    auto: 'Auto text',
    includeAuto: false,
  });
  assert.equal(s, 'Journal entry');
});
