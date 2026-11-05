import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyAccountEditSafety } from './coaHealthChecks';

test('COA structural edit blocked when journal lines exist', () => {
  const s = classifyAccountEditSafety({ id: '1', code: '5100', name: 'Rent', is_group: false }, 12);
  assert.equal(s.canArchive, false);
  assert.match(s.reason, /journal lines/i);
});
