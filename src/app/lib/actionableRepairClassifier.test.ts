import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyCancelledSaleTrail,
  classifyCorrectionReversalRow,
  classifyExpensePaymentMismatch,
  classifyOrphanArReversalDefect,
  classifyUnmappedJournalLine,
  classifyUnpostedDocument,
  resolveBlockedGlRepairReason,
} from './actionableRepairClassifier';
import { buildGlCorrectionDraftDryRun, KNOWN_ORPHAN_AR_DEFECTS } from './glCorrectionDraftRepair';
import { shouldIncludeCancelledSaleActivityInNormalStatement } from './reportVisibilityContract';
import { actionRequiresGlCorrectionRpc, resolveRepairApplyBlockReasons } from './developerRepairApplyGate';

test('JE-0161-class orphan AR defect is classified as GL correction draft required', () => {
  const defect = KNOWN_ORPHAN_AR_DEFECTS[0];
  const cls = classifyOrphanArReversalDefect(defect);
  assert.equal(cls.status, 'needs_gl_correction_draft');
  assert.equal(cls.primaryButton, 'create_gl_correction_draft');
  assert.equal(cls.canApply, true);
  assert.match(cls.whyDetected, /JE-0161/);
  assert.match(cls.whyDetected, /1100/);

  const dry = buildGlCorrectionDraftDryRun(defect);
  assert.equal(dry.ok, true);
  assert.equal(dry.newCorrectionJePreview.balanced, true);
  assert.equal(dry.newCorrectionJePreview.totalDebit, 150);
  assert.match(dry.blockedApplyReason, /RPC/i);
});

test('correction_reversal JE-0168 is audit-only, no GL repair', () => {
  const cls = classifyCorrectionReversalRow({ entryNo: 'JE-0168', referenceType: 'correction_reversal' });
  assert.equal(cls.status, 'audit_only');
  assert.equal(cls.primaryButton, 'view_audit');
  assert.equal(cls.canApply, false);
  assert.match(cls.blockReason || '', /Audit-only/i);
});

test('cancelled sale trails hidden from normal reports remain hidden', () => {
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  const cls = classifyCancelledSaleTrail({
    saleInvoiceNo: 'HQ-SL-0003',
    saleStatus: 'cancelled',
    jeReferenceType: 'sale',
  });
  assert.ok(cls);
  assert.equal(cls!.status, 'audit_only');
  assert.equal(cls!.primaryButton, 'mark_reviewed');
});

test('expense payment mismatch remains payment-only repair when JE matches expense', () => {
  const cls = classifyExpensePaymentMismatch({
    expenseId: 'e1',
    expenseNo: 'EXP-0021',
    expenseAmount: 7000,
    paymentAmount: 13500,
    jeLiquidityAmount: 7000,
    canApplyRepair: true,
  });
  assert.equal(cls.status, 'fixable_now');
  assert.equal(cls.category, 'payment_source_sync');
  assert.equal(cls.primaryButton, 'sync_payment_amount');
  assert.ok(cls.whatWillNeverChange.some((x) => x.includes('journal_entry_lines')));
});

test('expense payment mismatch blocked when JE differs from expense', () => {
  const cls = classifyExpensePaymentMismatch({
    expenseId: 'e2',
    expenseNo: 'EXP-0099',
    expenseAmount: 7000,
    paymentAmount: 13500,
    jeLiquidityAmount: 13500,
    canApplyRepair: false,
    blockReason: 'JE liquidity amount differs from expense',
  });
  assert.equal(cls.status, 'blocked_unsafe');
  assert.equal(cls.primaryButton, 'blocked_explain');
});

test('source document rows return Open Source Document only', () => {
  const cls = classifyUnpostedDocument(
    {
      source_type: 'sale',
      source_id: 's1',
      document_no: 'SL-0005',
      contact_id: null,
      contact_name: 'Patras',
      amount: 96000,
      branch_id: null,
      document_date: '2026-06-01',
      company_id: 'co',
      reason: 'No sale JE',
    },
    {
      isPostable: false,
      isNonFinal: true,
      documentStatus: 'order',
      label: 'Non-final',
      queueReason: 'Order stage',
      suggestedAction: 'Finalize sale',
      riskLevel: 'low',
    }
  );
  assert.equal(cls.status, 'needs_source_document');
  assert.equal(cls.primaryButton, 'open_source_document');
  assert.equal(cls.canApply, false);
});

test('metadata-only Fix Link still does not change GL', () => {
  const cls = classifyUnmappedJournalLine(
    {
      journal_entry_id: 'je1',
      journal_line_id: 'jl1',
      entry_no: 'RCV-0008',
      entry_date: '2026-01-01',
      reference_type: 'payment',
      account_code: 'AR-CUS0058',
      account_name: 'AR',
      debit: 0,
      credit: 100,
      control_bucket: 'AR',
      ap_sub_bucket: null,
      contact_mapping_status: 'unclassified_reference',
      reason: 'Heuristic unmapped',
      company_id: 'co',
    },
    {
      isLikelyFalsePositive: true,
      falsePositiveReason: 'Likely mapped',
      isMetadataReviewOnly: false,
      metadataReviewReason: null,
      queueReason: 'test',
      suggestedAction: 'Fix Link',
      riskLevel: 'low',
    }
  );
  assert.equal(cls.category, 'metadata_only');
  assert.equal(cls.primaryButton, 'fix_link');
  assert.ok(cls.whatWillNeverChange.some((x) => x.toLowerCase().includes('gl')));
});

test('blocked GL repair clearly reports reason if apply is disabled', () => {
  const reason = resolveBlockedGlRepairReason(false);
  assert.match(reason, /disabled/i);

  const { reasons } = resolveRepairApplyBlockReasons({
    canApply: true,
    dryRun: { ok: true, dryRunHash: 'abc', before: {}, afterPreview: {} },
    confirmPhrase: 'APPLY GL CORRECTION',
    expectedPhrase: 'APPLY GL CORRECTION',
    applying: false,
    actionRequiresGlCorrectionRpc: true,
    glCorrectionRpcAvailable: false,
  });
  assert.ok(reasons.some((r) => r.code === 'gl_correction_apply_disabled'));
  assert.equal(actionRequiresGlCorrectionRpc('gl.create_correction_draft'), true);
});
