import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCorrectionReversalReferenceType } from './reportVisibilityContract';

describe('reportVisibilityContract (mobile)', () => {
  it('detects correction_reversal reference type', () => {
    assert.equal(isCorrectionReversalReferenceType('correction_reversal'), true);
    assert.equal(isCorrectionReversalReferenceType('journal'), false);
    assert.equal(isCorrectionReversalReferenceType(null), false);
  });
});
