import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkPermission, type UserPermissions } from './checkPermission.ts';

const staffBase: UserPermissions = {
  role: 'Staff',
  canCreateSale: false,
  canEditSale: false,
  canDeleteSale: false,
  canViewReports: false,
  canManageSettings: false,
  canManageUsers: false,
  canAccessAccounting: false,
  canMakePayments: false,
  canReceivePayments: false,
  canManageExpenses: false,
  canManageProducts: false,
  canManagePurchases: false,
  canManageRentals: false,
};

describe('checkPermission', () => {
  it('Admin bypass: any module/action returns true', () => {
    const admin: UserPermissions = {
      ...staffBase,
      role: 'Admin',
      canCreateSale: false,
    };
    assert.equal(checkPermission(admin, 'sales', 'delete'), true);
    assert.equal(checkPermission(admin, 'settings', 'view'), true);
    assert.equal(checkPermission(admin, 'accounting', 'edit'), true);
  });

  it('Staff: sales view is true when any sales capability is granted', () => {
    const p: UserPermissions = {
      ...staffBase,
      canViewSale: true,
    };
    assert.equal(checkPermission(p, 'sales', 'view'), true);
  });

  it('Staff: sales view is false when no sales flags', () => {
    assert.equal(checkPermission(staffBase, 'sales', 'view'), false);
  });

  it('Manager: accounting create/edit requires Manager role', () => {
    const manager: UserPermissions = {
      ...staffBase,
      role: 'Manager',
      canAccessAccounting: true,
    };
    assert.equal(checkPermission(manager, 'accounting', 'view'), true);
    assert.equal(checkPermission(manager, 'accounting', 'create'), true);

    const staffAcct: UserPermissions = {
      ...staffBase,
      canAccessAccounting: true,
    };
    assert.equal(checkPermission(staffAcct, 'accounting', 'view'), true);
    assert.equal(checkPermission(staffAcct, 'accounting', 'create'), false);
  });

  it('pos: requires canUsePos for view and use', () => {
    const p: UserPermissions = { ...staffBase, canUsePos: true };
    assert.equal(checkPermission(p, 'pos', 'view'), true);
    assert.equal(checkPermission(p, 'pos', 'use'), true);
    assert.equal(checkPermission(staffBase, 'pos', 'use'), false);
  });
});
