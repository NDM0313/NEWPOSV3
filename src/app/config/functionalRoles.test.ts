import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAppRole,
  mapAppRoleToEngineRole,
  mapAppRoleToUiRole,
  isPlatformOperatorAppRole,
  hasCompanyWideBranchAccess,
} from './functionalRoles.ts';

describe('functionalRoles', () => {
  it('normalizes worker aliases to salesman', () => {
    assert.equal(normalizeAppRole('staff'), 'salesman');
    assert.equal(normalizeAppRole('cashier'), 'salesman');
    assert.equal(normalizeAppRole('viewer'), 'salesman');
  });

  it('maps admin and owner to Admin UI role', () => {
    assert.equal(mapAppRoleToUiRole('admin'), 'Admin');
    assert.equal(mapAppRoleToUiRole('owner'), 'Admin');
    assert.equal(mapAppRoleToEngineRole('owner'), 'owner');
    assert.equal(mapAppRoleToEngineRole('admin'), 'admin');
  });

  it('maps salesman to user engine and Staff UI', () => {
    assert.equal(mapAppRoleToEngineRole('salesman'), 'user');
    assert.equal(mapAppRoleToUiRole('salesman'), 'Staff');
  });

  it('maps manager and accountant to manager engine', () => {
    assert.equal(mapAppRoleToEngineRole('manager'), 'manager');
    assert.equal(mapAppRoleToEngineRole('accountant'), 'manager');
    assert.equal(mapAppRoleToUiRole('manager'), 'Manager');
  });

  it('maps developer / super_admin to Admin UI and admin engine (ledger sidebar)', () => {
    assert.equal(isPlatformOperatorAppRole('developer'), true);
    assert.equal(isPlatformOperatorAppRole('super_admin'), true);
    assert.equal(normalizeAppRole('developer'), 'developer');
    assert.equal(mapAppRoleToUiRole('developer'), 'Admin');
    assert.equal(mapAppRoleToEngineRole('developer'), 'admin');
    assert.equal(mapAppRoleToUiRole('super_admin'), 'Admin');
    assert.equal(mapAppRoleToEngineRole('super_admin'), 'admin');
  });

  it('grants company-wide branch access to admin, owner, and platform operators', () => {
    assert.equal(hasCompanyWideBranchAccess('admin'), true);
    assert.equal(hasCompanyWideBranchAccess('owner'), true);
    assert.equal(hasCompanyWideBranchAccess('developer'), true);
    assert.equal(hasCompanyWideBranchAccess('super_admin'), true);
    assert.equal(hasCompanyWideBranchAccess('manager'), false);
    assert.equal(hasCompanyWideBranchAccess('salesman'), false);
  });
});
