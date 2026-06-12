import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGlCorrectionDraftDryRun,
  GL_CORRECTION_CONFIRM_PHRASE,
  KNOWN_ORPHAN_AR_DEFECTS,
} from './glCorrectionDraftRepair';
import { computeDryRunHash } from './developerRepairHash';
import { classifyCorrectionReversalRow } from './actionableRepairClassifier';
import { isGlCorrectionRpcBusinessError } from './developerRepairSystemStatus';

/** Canonical hash for HQ-SL-0003 dry-run — must match SQL developer_repair_compute_dry_run_hash after migration. */
export const HQ_SL_0003_DRY_RUN_HASH = 'c19aee62';

test('GL correction dry-run is balanced Dr 1100 / Cr AR-CUS0000 Rs 150', () => {
  const preview = buildGlCorrectionDraftDryRun(KNOWN_ORPHAN_AR_DEFECTS[0]);
  assert.equal(preview.newCorrectionJePreview.balanced, true);
  assert.equal(preview.newCorrectionJePreview.totalDebit, 150);
  assert.equal(preview.newCorrectionJePreview.totalCredit, 150);
  const dr = preview.expectedCorrectionLines.find((l) => l.accountCode === '1100');
  const cr = preview.expectedCorrectionLines.find((l) => l.accountCode === 'AR-CUS0000');
  assert.equal(dr?.debit, 150);
  assert.equal(cr?.credit, 150);
});

test('HQ-SL-0003 dry-run hash is stable for SQL verification', () => {
  const preview = buildGlCorrectionDraftDryRun(KNOWN_ORPHAN_AR_DEFECTS[0]);
  assert.equal(preview.dryRunHash, HQ_SL_0003_DRY_RUN_HASH);
  const recomputed = computeDryRunHash(
    'gl.create_correction_draft',
    { defectId: 'hq-sl-0003-orphan-ar' },
    preview.before
  );
  assert.equal(recomputed, HQ_SL_0003_DRY_RUN_HASH);
});

test('wrong confirm phrase constant is not valid apply phrase', () => {
  assert.equal(GL_CORRECTION_CONFIRM_PHRASE, 'APPLY GL CORRECTION');
  assert.notEqual('apply gl correction', GL_CORRECTION_CONFIRM_PHRASE);
});

test('stale dry-run hash differs from current preview', () => {
  const preview = buildGlCorrectionDraftDryRun(KNOWN_ORPHAN_AR_DEFECTS[0]);
  assert.notEqual(preview.dryRunHash, 'deadbeef');
});

test('JE-0168 correction_reversal cannot use GL correction workflow', () => {
  const cls = classifyCorrectionReversalRow({ entryNo: 'JE-0168', referenceType: 'correction_reversal' });
  assert.equal(cls.status, 'audit_only');
  assert.equal(cls.canApply, false);
  assert.notEqual(cls.primaryButton, 'create_gl_correction_draft');
});

test('GL correction RPC probe recognizes business errors', () => {
  assert.equal(isGlCorrectionRpcBusinessError('Confirm phrase must be exactly: APPLY GL CORRECTION'), true);
  assert.equal(isGlCorrectionRpcBusinessError('Dry-run hash mismatch — re-run dry-run preview before apply'), true);
  assert.equal(isGlCorrectionRpcBusinessError('function not found'), false);
});
