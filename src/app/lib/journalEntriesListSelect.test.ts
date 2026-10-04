import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ENTRIES_FETCH_LIMIT,
  ENTRIES_FETCH_LIMIT_ON_TIMEOUT,
  JOURNAL_ENTRIES_LIST_SELECT,
} from './journalEntriesListSelect';

describe('journalEntriesListSelect', () => {
  it('exports an explicit lean header list (not star, no nested lines)', () => {
    assert.notEqual(JOURNAL_ENTRIES_LIST_SELECT.trim(), '*');
    assert.ok(!JOURNAL_ENTRIES_LIST_SELECT.includes('journal_entry_lines'));
    assert.ok(!JOURNAL_ENTRIES_LIST_SELECT.includes('*'));
    const cols = JOURNAL_ENTRIES_LIST_SELECT.split(',');
    for (const col of [
      'id',
      'entry_no',
      'entry_date',
      'created_at',
      'description',
      'reference_type',
      'reference_id',
      'total_debit',
      'total_credit',
      'is_void',
      'payment_id',
      'branch_id',
      'company_id',
      'action_fingerprint',
      'economic_event_id',
    ]) {
      assert.ok(cols.includes(col), `missing column ${col}`);
    }
    assert.ok(!cols.includes('notes'), 'notes is not a journal_entries column');
    assert.ok(
      !cols.includes('reference_number'),
      'reference_number is not a journal_entries column'
    );
  });

  it('uses adaptive page sizes (100 default, 50 on timeout)', () => {
    assert.equal(ENTRIES_FETCH_LIMIT, 100);
    assert.equal(ENTRIES_FETCH_LIMIT_ON_TIMEOUT, 50);
    assert.ok(ENTRIES_FETCH_LIMIT_ON_TIMEOUT < ENTRIES_FETCH_LIMIT);
  });
});
