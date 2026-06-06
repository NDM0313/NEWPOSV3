import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDeveloperRepairSystemStatus,
  deriveRepairSystemOverallState,
  isMissingSchemaObjectError,
  isRelinkRpcBusinessError,
  type DeveloperRepairSystemProbe,
} from './developerRepairSystemStatus';

function baseProbe(overrides: Partial<DeveloperRepairSystemProbe> = {}): DeveloperRepairSystemProbe {
  return {
    companyIdPresent: true,
    auditTableAvailable: true,
    relinkRpcAvailable: true,
    canApply: true,
    userRoleLabel: 'developer',
    ...overrides,
  };
}

test('deriveRepairSystemOverallState blocked when audit table missing', () => {
  assert.equal(
    deriveRepairSystemOverallState(baseProbe({ auditTableAvailable: false })),
    'blocked_missing_migration'
  );
});

test('deriveRepairSystemOverallState blocked when relink RPC missing', () => {
  assert.equal(
    deriveRepairSystemOverallState(baseProbe({ relinkRpcAvailable: false })),
    'blocked_missing_migration'
  );
});

test('deriveRepairSystemOverallState blocked_view_only when infra ok but cannot apply', () => {
  assert.equal(
    deriveRepairSystemOverallState(baseProbe({ canApply: false })),
    'blocked_view_only'
  );
});

test('deriveRepairSystemOverallState ready_for_apply when all gates pass', () => {
  assert.equal(deriveRepairSystemOverallState(baseProbe()), 'ready_for_apply');
});

test('deriveRepairSystemOverallState ready_for_dry_run when company missing but infra ok', () => {
  assert.equal(
    deriveRepairSystemOverallState(baseProbe({ companyIdPresent: false, canApply: false })),
    'blocked_view_only'
  );
});

test('buildDeveloperRepairSystemStatus includes checklist rows', () => {
  const status = buildDeveloperRepairSystemStatus(
    baseProbe({ canApply: false, userRoleLabel: 'admin' })
  );
  assert.equal(status.overallState, 'blocked_view_only');
  assert.equal(status.checklist.length, 4);
  assert.equal(status.checklist.find((r) => r.id === 'apply_role')?.ok, false);
});

test('isMissingSchemaObjectError detects PostgREST codes', () => {
  assert.equal(isMissingSchemaObjectError('schema cache', 'PGRST205'), true);
  assert.equal(isMissingSchemaObjectError('Could not find the function', 'PGRST202'), true);
  assert.equal(isMissingSchemaObjectError('Payment not found'), false);
});

test('isRelinkRpcBusinessError detects payment not found', () => {
  assert.equal(isRelinkRpcBusinessError('Payment not found: uuid'), true);
  assert.equal(isRelinkRpcBusinessError('function does not exist'), false);
});
