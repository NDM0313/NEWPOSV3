import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasModuleAction,
  canViewModule,
  setRolePermission,
  canUseFullAccounting,
  canViewCustomerLedger,
  canViewSupplierLedger,
  shouldScopeStudioToOwnOnly,
  type RolePermissionRow,
} from './permissions.ts';

describe('hasModuleAction', () => {
  it('matches exact module.action when allowed', () => {
    const perms: RolePermissionRow[] = [
      { role: 'user', module: 'sales', action: 'create', allowed: true },
    ];
    assert.equal(hasModuleAction(perms, 'sales', 'create'), true);
    assert.equal(hasModuleAction(perms, 'sales', 'delete'), false);
  });

  it('treats view as satisfied by scoped view actions for contacts', () => {
    const perms: RolePermissionRow[] = [
      { role: 'user', module: 'contacts', action: 'view_branch', allowed: true },
    ];
    assert.equal(hasModuleAction(perms, 'contacts', 'view'), true);
  });

  it('treats view as satisfied by view_company for studio', () => {
    const perms: RolePermissionRow[] = [
      { role: 'user', module: 'studio', action: 'view_company', allowed: true },
    ];
    assert.equal(hasModuleAction(perms, 'studio', 'view'), true);
  });
});

describe('canViewModule', () => {
  it('returns false when permission list is empty (v2)', () => {
    assert.equal(canViewModule([], 'sales'), false);
  });

  it('allows sales when view_own is allowed', () => {
    const perms: RolePermissionRow[] = [
      { role: 'user', module: 'sales', action: 'view_own', allowed: true },
    ];
    assert.equal(canViewModule(perms, 'sales'), true);
  });

  it('allows pos when use is allowed', () => {
    const perms: RolePermissionRow[] = [
      { role: 'user', module: 'pos', action: 'use', allowed: true },
    ];
    assert.equal(canViewModule(perms, 'pos'), true);
  });
});

describe('ledger and studio scope helpers', () => {
  const userPerms: RolePermissionRow[] = [
    { role: 'user', module: 'ledger', action: 'view_customer', allowed: true },
    { role: 'user', module: 'ledger', action: 'view_full_accounting', allowed: false },
    { role: 'user', module: 'studio', action: 'view_own', allowed: true },
    { role: 'user', module: 'studio', action: 'view_company', allowed: false },
  ];

  it('user role: party ledger only, studio own scope', () => {
    assert.equal(canUseFullAccounting(userPerms, false), false);
    assert.equal(canViewCustomerLedger(userPerms, false), true);
    assert.equal(canViewSupplierLedger(userPerms, false), false);
    assert.equal(shouldScopeStudioToOwnOnly(userPerms, false), true);
  });

  it('admin bypasses ledger and studio scope', () => {
    assert.equal(canUseFullAccounting(userPerms, true), true);
    assert.equal(shouldScopeStudioToOwnOnly(userPerms, true), false);
  });
});

describe('setRolePermission (mobile guard)', () => {
  it('rejects owner role without calling supabase', async () => {
    const res = await setRolePermission('owner', 'sales', 'view', true);
    assert.equal(res.error, 'This role can only be edited in Web ERP.');
  });
});
