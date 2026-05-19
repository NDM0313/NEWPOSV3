import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAppRole,
  mapAppRoleToEngineRole,
  mapAppRoleToUiRole,
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
});
