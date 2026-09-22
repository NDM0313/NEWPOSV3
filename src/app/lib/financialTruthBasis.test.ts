import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyTieOutDifference,
  effectivePartyIncludesRow,
  officialGlIncludesJournalEntry,
  reportBasisLabel,
} from './financialTruthBasis';

test('official GL includes correction_reversal and gl_correction when not void', () => {
  assert.equal(officialGlIncludesJournalEntry({ isVoid: false, referenceType: 'correction_reversal' }), true);
  assert.equal(officialGlIncludesJournalEntry({ isVoid: false, referenceType: 'gl_correction' }), true);
  assert.equal(officialGlIncludesJournalEntry({ isVoid: true, referenceType: 'sale' }), false);
});

test('effective party hides cancelled sale orphan gl_correction', () => {
  assert.equal(
    effectivePartyIncludesRow({
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
});

test('effective party includes normal sale rows', () => {
  assert.equal(
    effectivePartyIncludesRow({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'finalized',
    }),
    true
  );
});

test('classify tie-out difference detects audit-only adjustment pattern', () => {
  const cat = classifyTieOutDifference({
    amount: 1,
    leftLabel: 'Official Posted GL — AR-CUS sum',
    rightLabel: 'Effective operational — AR-CUS sum',
    auditOnlyAdjustment: 1,
  });
  assert.equal(cat, 'cancelled_audit_hidden_from_effective');
});

test('report basis labels match contract wording', () => {
  assert.match(reportBasisLabel('official_gl'), /Official Posted GL/i);
  assert.match(reportBasisLabel('effective_party'), /Effective operational/i);
  assert.match(reportBasisLabel('audit_full'), /Audit basis/i);
});
