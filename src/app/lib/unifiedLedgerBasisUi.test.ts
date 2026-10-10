import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  reportBasisToUnifiedBasis,
  unifiedBasisToReportBasis,
  unifiedBasisBannerLabel,
} from './unifiedLedgerBasisUi';

test('audit_full maps to audit_full_history and back', () => {
  assert.equal(reportBasisToUnifiedBasis('audit_full'), 'audit_full_history');
  assert.equal(unifiedBasisToReportBasis('audit_full_history'), 'audit_full');
});

test('official_gl and effective_party round-trip', () => {
  for (const basis of ['official_gl', 'effective_party'] as const) {
    assert.equal(unifiedBasisToReportBasis(reportBasisToUnifiedBasis(basis)), basis);
  }
});

test('unified basis banner labels are non-empty', () => {
  for (const basis of ['official_gl', 'effective_party', 'audit_full_history'] as const) {
    const label = unifiedBasisBannerLabel(basis);
    assert.ok(label.length > 0);
  }
});
