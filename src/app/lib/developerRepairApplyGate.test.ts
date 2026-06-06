import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionRequiresRelinkRpc, resolveRepairApplyBlockReasons } from './developerRepairApplyGate';

test('resolveRepairApplyBlockReasons dry_run_not_completed when no dryRun', () => {
  const { blocked, reasons } = resolveRepairApplyBlockReasons({
    canApply: true,
    dryRun: null,
    confirmPhrase: '',
    expectedPhrase: 'TEST-PHRASE',
    applying: false,
  });
  assert.equal(blocked, true);
  assert.ok(reasons.some((r) => r.code === 'dry_run_not_completed'));
});

test('resolveRepairApplyBlockReasons dry_run_not_eligible when dryRun blocked', () => {
  const { reasons } = resolveRepairApplyBlockReasons({
    canApply: true,
    dryRun: {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: 'Payment is voided',
    },
    confirmPhrase: 'X',
    expectedPhrase: 'X',
    applying: false,
  });
  assert.ok(reasons.some((r) => r.code === 'dry_run_not_eligible'));
  assert.ok(reasons.some((r) => r.message.includes('voided')));
});

test('resolveRepairApplyBlockReasons confirm phrase mismatch', () => {
  const { blocked, reasons } = resolveRepairApplyBlockReasons({
    canApply: true,
    dryRun: { ok: true, dryRunHash: 'abc', before: {}, afterPreview: {} },
    confirmPhrase: 'wrong',
    expectedPhrase: 'SYNC-SEQUENCE-TO-EFFECTIVE-MAX',
    applying: false,
  });
  assert.equal(blocked, true);
  assert.ok(reasons.some((r) => r.code === 'confirm_phrase_mismatch'));
});

test('resolveRepairApplyBlockReasons role_cannot_apply', () => {
  const { reasons } = resolveRepairApplyBlockReasons({
    canApply: false,
    dryRun: { ok: true, dryRunHash: 'abc', before: {}, afterPreview: {} },
    confirmPhrase: 'OK',
    expectedPhrase: 'OK',
    applying: false,
  });
  assert.ok(reasons.some((r) => r.code === 'role_cannot_apply'));
});

test('resolveRepairApplyBlockReasons migration_missing for relink action', () => {
  const { reasons } = resolveRepairApplyBlockReasons({
    canApply: true,
    dryRun: { ok: true, dryRunHash: 'abc', before: {}, afterPreview: {} },
    confirmPhrase: 'OK',
    expectedPhrase: 'OK',
    applying: false,
    actionRequiresRelinkRpc: true,
    relinkRpcAvailable: false,
  });
  assert.ok(reasons.some((r) => r.code === 'migration_missing'));
});

test('resolveRepairApplyBlockReasons not blocked when all gates pass', () => {
  const { blocked, reasons } = resolveRepairApplyBlockReasons({
    canApply: true,
    dryRun: { ok: true, dryRunHash: 'abc', before: {}, afterPreview: {} },
    confirmPhrase: 'EXACT-PHRASE',
    expectedPhrase: 'EXACT-PHRASE',
    applying: false,
    actionRequiresRelinkRpc: true,
    relinkRpcAvailable: true,
  });
  assert.equal(blocked, false);
  assert.equal(reasons.length, 0);
});

test('actionRequiresRelinkRpc only for payment relink', () => {
  assert.equal(actionRequiresRelinkRpc('payment.relink_payment_to_journal'), true);
  assert.equal(actionRequiresRelinkRpc('coa.update_description'), false);
});
