import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findDuplicateCodes,
  findMissingSystemAccounts,
  classifyAccountEditSafety,
  inferModulesFromReferenceTypes,
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
