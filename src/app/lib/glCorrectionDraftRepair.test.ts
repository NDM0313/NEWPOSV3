import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildGlCorrectionDraftDryRun,
  buildRental1100LeakageDryRun,
  GL_CORRECTION_CONFIRM_PHRASE,
  isRental1100LeakageDefectId,
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

test('GL correction RPC probe recognizes parametric rental targets', () => {
  assert.equal(isGlCorrectionRpcBusinessError('Unknown or unsupported repair target: rental-1100-leakage:abc'), true);
  assert.equal(
    isGlCorrectionRpcBusinessError('Rental 1100 leakage source line not found or contact missing: rental-1100-leakage:abc'),
    true
  );
  assert.equal(isGlCorrectionRpcBusinessError('Confirm phrase must be exactly: APPLY GL CORRECTION'), true);
  assert.equal(isGlCorrectionRpcBusinessError('Dry-run hash mismatch — re-run dry-run preview before apply'), true);
  assert.equal(isGlCorrectionRpcBusinessError('function not found'), false);
});

test('rental revenue leakage (debit on 1100) corrects Dr party / Cr 1100', () => {
  const preview = buildRental1100LeakageDryRun({
    defectId: 'rental-1100-leakage:00000000-0000-0000-0000-000000000001',
    saleInvoiceNo: 'REN-0001',
    saleJeNo: 'JE-100',
    reversalJeNo: 'JE-100',
    partyArAccountCode: 'AR-CUS0052',
    wrongCreditAccountCode: '1100',
    orphanAmount: 20000,
    direction: 'debit_on_control',
    sourceLineId: '00000000-0000-0000-0000-000000000001',
    sourceEntryNo: 'JE-100',
  });
  assert.equal(preview.newCorrectionJePreview.balanced, true);
  const drParty = preview.expectedCorrectionLines.find((l) => l.accountCode === 'AR-CUS0052');
  const crControl = preview.expectedCorrectionLines.find((l) => l.accountCode === '1100');
  assert.equal(drParty?.debit, 20000);
  assert.equal(crControl?.credit, 20000);
});

test('rental payment leakage (credit on 1100) corrects Dr 1100 / Cr party', () => {
  const preview = buildRental1100LeakageDryRun({
    defectId: 'rental-1100-leakage:00000000-0000-0000-0000-000000000002',
    saleInvoiceNo: 'REN-0002',
    saleJeNo: 'JE-200',
    reversalJeNo: 'JE-200',
    partyArAccountCode: 'AR-CUS0058',
    wrongCreditAccountCode: '1100',
    orphanAmount: 60000,
    direction: 'credit_on_control',
    sourceLineId: '00000000-0000-0000-0000-000000000002',
    sourceEntryNo: 'JE-200',
  });
  const drControl = preview.expectedCorrectionLines.find((l) => l.accountCode === '1100');
  const crParty = preview.expectedCorrectionLines.find((l) => l.accountCode === 'AR-CUS0058');
  assert.equal(drControl?.debit, 60000);
  assert.equal(crParty?.credit, 60000);
});

test('isRental1100LeakageDefectId detects parametric defect ids', () => {
  assert.equal(isRental1100LeakageDefectId('rental-1100-leakage:abc'), true);
  assert.equal(isRental1100LeakageDefectId('hq-sl-0003-orphan-ar'), false);
});

test('rental leakage dry-run produces hash for apply path', () => {
  const preview = buildRental1100LeakageDryRun({
    defectId: 'rental-1100-leakage:00000000-0000-0000-0000-000000000099',
    saleInvoiceNo: 'REN-0099',
    saleJeNo: 'JE-099',
    reversalJeNo: 'JE-099',
    partyArAccountCode: 'AR-CUS0099',
    wrongCreditAccountCode: '1100',
    orphanAmount: 15000,
    direction: 'debit_on_control',
    sourceLineId: '00000000-0000-0000-0000-000000000099',
    sourceEntryNo: 'JE-099',
    sourceJeId: '00000000-0000-0000-0000-000000000088',
  });
  assert.equal(preview.ok, true);
  assert.ok(preview.dryRunHash.length >= 8);
  assert.equal(preview.before.defectId, 'rental-1100-leakage:00000000-0000-0000-0000-000000000099');
});
