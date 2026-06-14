import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveArApReconciliationAccess } from './arApReconciliationAccess.ts';

describe('arApReconciliationAccess', () => {
  it('allows relink mapping for admin and developer', () => {
    const admin = resolveArApReconciliationAccess('admin');
    assert.equal(admin.canApplyRelinkMapping, true);
    assert.equal(admin.canApplyGlRepair, false);
    assert.equal(admin.canUseHybridRepair, true);

    const dev = resolveArApReconciliationAccess('developer');
    assert.equal(dev.canApplyRelinkMapping, true);
    assert.equal(dev.canApplyGlRepair, false);
    assert.equal(dev.canUseHybridRepair, true);
  });

  it('denies relink mapping for auditor', () => {
    const aud = resolveArApReconciliationAccess('accounting auditor');
    assert.equal(aud.canApplyRelinkMapping, false);
    assert.equal(aud.readOnly, true);
  });

  it('denies staff access', () => {
    const staff = resolveArApReconciliationAccess('staff');
    assert.equal(staff.canAccess, false);
    assert.equal(staff.canApplyRelinkMapping, false);
  });
});
