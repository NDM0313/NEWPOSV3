import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareCashFlowUnifiedPreview } from './cashFlowUnifiedPreviewDiff';

test('compareCashFlowUnifiedPreview passes on matching summary', () => {
  const summary = {
    opening: 1000,
    cashIn: 500,
    cashOut: 200,
    netMovement: 300,
    closing: 1300,
  };
  const diff = compareCashFlowUnifiedPreview({
    legacy: {
      rows: [{ id: '1' } as never, { id: '2' } as never],
      summary,
      auditMode: false,
    },
    preview: {
      previewOnly: true,
      needsFinanceGoldenApproval: true,
      summary,
      rowCount: 2,
      sourceModuleFilter: 'all',
      auditMode: false,
      accountingRuleNotes: [],
    },
  });
  assert.equal(diff.pass, true);
  assert.equal(diff.cashInDelta, 0);
  assert.equal(diff.closingDelta, 0);
});

test('compareCashFlowUnifiedPreview detects cash in delta', () => {
  const diff = compareCashFlowUnifiedPreview({
    legacy: {
      rows: [],
      summary: { opening: 0, cashIn: 100, cashOut: 0, netMovement: 100, closing: 100 },
      auditMode: false,
    },
    preview: {
      previewOnly: true,
      needsFinanceGoldenApproval: true,
      summary: { opening: 0, cashIn: 90, cashOut: 0, netMovement: 90, closing: 90 },
      rowCount: 0,
      sourceModuleFilter: 'all',
      auditMode: false,
      accountingRuleNotes: [],
    },
  });
  assert.equal(diff.pass, false);
  assert.equal(diff.cashInDelta, 10);
});
