import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapJournalAccountGuardError } from './mapJournalAccountGuardError.ts';

describe('mapJournalAccountGuardError', () => {
  it('maps wrong-company without leaking privilege codes', () => {
    const s = mapJournalAccountGuardError({
      message: 'JOURNAL_ACCOUNT_WRONG_COMPANY: account 1000 belongs to another company.',
    });
    assert.match(s, /another company/i);
    assert.doesNotMatch(s, /42501/);
  });

  it('maps retired without remap actionably', () => {
    const s = mapJournalAccountGuardError({
      message:
        'JOURNAL_ACCOUNT_RETIRED: account ZZ-GATE-NOMAP is inactive/retired and has no verified remap.',
    });
    assert.match(s, /retired/i);
    assert.match(s, /verified remap/i);
  });

  it('passes through non-guard messages', () => {
    assert.equal(mapJournalAccountGuardError({ message: 'Journal lines are not balanced' }), 'Journal lines are not balanced');
  });
});
