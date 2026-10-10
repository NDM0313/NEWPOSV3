import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterAutoApplyCandidates, type HybridRepairCandidate } from '@/app/lib/hybridRepairEngineLogic';
import {
  isRental1100LeakageDefectId,
  KNOWN_ORPHAN_AR_DEFECTS,
} from '@/app/lib/glCorrectionDraftRepair';
import { mergeHybridRepairProbe, resolveArApReconciliationAccess } from '@/app/lib/arApReconciliationAccess';

function orphanDefectToHybridId(defectId: string): string {
  return `orphan-ar:${defectId}`;
}

function hybridIdToOrphanDefectId(hybridId: string): string | null {
  const prefix = 'orphan-ar:';
  if (!hybridId.startsWith(prefix)) return null;
  return hybridId.slice(prefix.length) || null;
}

function mockCandidate(partial: Partial<HybridRepairCandidate>): HybridRepairCandidate {
  return {
    id: 'test',
    category: 'expense_payment_sync',
    title: 'Test',
    amount: 100,
    riskLevel: 'low',
    canAutoApply: true,
    canManualApply: true,
    params: {},
    ...partial,
  };
}

describe('hybridRepairEngine', () => {
  it('filterAutoApplyCandidates excludes diagnostic and blocked rows', () => {
    const rows = [
      mockCandidate({ id: 'a', canAutoApply: true }),
      mockCandidate({ id: 'b', diagnosticOnly: true, canAutoApply: false }),
      mockCandidate({ id: 'c', blockedReason: 'JE mismatch', canAutoApply: false }),
      mockCandidate({ id: 'd', canManualApply: false, canAutoApply: false }),
    ];
    const eligible = filterAutoApplyCandidates(rows);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, 'a');
  });

  it('orphan hybrid id round-trips', () => {
    const id = orphanDefectToHybridId('hq-sl-0003-orphan-ar');
    assert.equal(hybridIdToOrphanDefectId(id), 'hq-sl-0003-orphan-ar');
  });

  it('lists known orphan defects', () => {
    assert.ok(KNOWN_ORPHAN_AR_DEFECTS.some((d) => d.defectId === 'hq-sl-0003-orphan-ar'));
  });

  it('mergeHybridRepairProbe enables GL apply when RPC available', () => {
    const base = resolveArApReconciliationAccess('admin');
    assert.equal(base.canApplyGlRepair, false);
    const merged = mergeHybridRepairProbe(base, { glCorrectionRpcAvailable: true });
    assert.equal(merged.canApplyGlRepair, true);
  });

  it('parametric rental defect id is recognized', () => {
    const defectId = 'rental-1100-leakage:00000000-0000-0000-0000-000000000099';
    assert.equal(isRental1100LeakageDefectId(defectId), true);
    assert.equal(hybridIdToOrphanDefectId(orphanDefectToHybridId(defectId)), defectId);
  });

  it('manager cannot use hybrid repair', () => {
    const access = resolveArApReconciliationAccess('manager');
    assert.equal(access.canUseHybridRepair, false);
    assert.equal(access.canAccess, false);
  });
});
