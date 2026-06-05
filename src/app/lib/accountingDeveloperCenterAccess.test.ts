import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessAccountingDeveloperCenter } from './accountingDeveloperCenterAccess';

test('admin and developer can access Developer Center', () => {
  assert.equal(canAccessAccountingDeveloperCenter('admin'), true);
  assert.equal(canAccessAccountingDeveloperCenter('developer'), true);
  assert.equal(canAccessAccountingDeveloperCenter('super_admin'), true);
  assert.equal(canAccessAccountingDeveloperCenter('accounting_auditor'), true);
});

test('staff cannot access Developer Center', () => {
  assert.equal(canAccessAccountingDeveloperCenter('staff'), false);
  assert.equal(canAccessAccountingDeveloperCenter('manager'), false);
  assert.equal(canAccessAccountingDeveloperCenter(null), false);
});
