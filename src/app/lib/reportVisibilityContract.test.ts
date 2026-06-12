import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayBookIncludeInNormalMode,
  isCorrectionReversalReferenceType,
  isGlCorrectionReferenceType,
  partyStatementGlCorrectionAuditLabel,
  shouldIncludeCancelledSaleActivityInNormalStatement,
  shouldIncludeGlCorrectionInNormalStatement,
  shouldIncludeInNormalCashMovement,
  shouldIncludePartyStatementRowInNormal,
} from './reportVisibilityContract';

test('JE-0168 class correction_reversal excluded from normal cash movement', () => {
  assert.equal(isCorrectionReversalReferenceType('correction_reversal'), true);
  assert.equal(
    shouldIncludeInNormalCashMovement({ referenceType: 'correction_reversal', journalIsVoid: false }),
    false
  );
  assert.equal(dayBookIncludeInNormalMode('correction_reversal'), false);
});

test('cancelled sale activity hidden from normal party statement', () => {
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale_reversal',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(
    shouldIncludeCancelledSaleActivityInNormalStatement({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'final',
    }),
    true
  );
});

test('cancelled-sale orphan gl_correction hidden from normal party statement', () => {
  assert.equal(isGlCorrectionReferenceType('gl_correction'), true);
  assert.equal(
    shouldIncludeGlCorrectionInNormalStatement({
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(
    shouldIncludeGlCorrectionInNormalStatement({
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:other-repair',
      linkedSaleStatus: 'final',
    }),
    true
  );
  assert.equal(
    shouldIncludeGlCorrectionInNormalStatement({
      jeReferenceType: 'gl_correction',
      linkedSaleStatus: 'cancelled',
    }),
    true
  );
});

test('AR-CUS0000 normal effective balance Rs 0 after HQ-SL-0003 repair visibility', () => {
  type Row = {
    jeReferenceType: string;
    jeActionFingerprint?: string;
    linkedSaleStatus?: string;
    debit: number;
    credit: number;
  };
  const arCusRows: Row[] = [
    {
      jeReferenceType: 'sale',
      linkedSaleStatus: 'cancelled',
      debit: 150,
      credit: 0,
    },
    {
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
      debit: 0,
      credit: 150,
    },
    {
      jeReferenceType: 'correction_reversal',
      debit: 1,
      credit: 0,
    },
  ];

  const normalEffectiveRows = arCusRows.filter((r) => {
    if (
      !shouldIncludePartyStatementRowInNormal({
        jeReferenceType: r.jeReferenceType,
        jeActionFingerprint: r.jeActionFingerprint,
        linkedSaleStatus: r.linkedSaleStatus,
      })
    ) {
      return false;
    }
    // Party effective mode also hides correction_reversal (JE-0168) — audit-only.
    if (r.jeReferenceType === 'correction_reversal') return false;
    return true;
  });
  assert.equal(normalEffectiveRows.length, 0);

  const rawBalance = arCusRows.reduce((s, r) => s + r.debit - r.credit, 0);
  assert.equal(rawBalance, 1);

  const normalBalance = normalEffectiveRows.reduce((s, r) => s + r.debit - r.credit, 0);
  assert.equal(normalBalance, 0);

  const auditIncludesCancelledAndCorrection = arCusRows.some(
    (r) => r.jeReferenceType === 'sale' && r.linkedSaleStatus === 'cancelled'
  );
  assert.equal(auditIncludesCancelledAndCorrection, true);
  assert.equal(
    arCusRows.some(
      (r) =>
        r.jeReferenceType === 'gl_correction' &&
        r.jeActionFingerprint === 'developer_repair:gl_correction:hq-sl-0003-orphan-ar'
    ),
    true
  );
  assert.equal(partyStatementGlCorrectionAuditLabel(), 'GL Correction / Audit');
});

test('active payment still included in normal cash movement', () => {
  assert.equal(
    shouldIncludeInNormalCashMovement({
      referenceType: 'payment',
      journalIsVoid: false,
      paymentVoidedAt: null,
    }),
    true
  );
});
