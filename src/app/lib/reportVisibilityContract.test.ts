import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dayBookIncludeInNormalMode,
  isCorrectionReversalReferenceType,
  isGlCorrectionReferenceType,
  partyEffectiveRowAuditLabel,
  partyStatementGlCorrectionAuditLabel,
  shouldIncludeCancelledSaleActivityInNormalStatement,
  shouldIncludeGlCorrectionInNormalStatement,
  shouldIncludeInNormalCashMovement,
  shouldIncludePartyEffectiveRow,
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

test('voided payment and cancelled-sale payment hidden from effective statement', () => {
  assert.equal(
    shouldIncludePartyEffectiveRow({
      jeReferenceType: 'payment',
      linkedSaleStatus: 'cancelled',
    }),
    false
  );
  assert.equal(
    shouldIncludePartyEffectiveRow({
      jeReferenceType: 'payment',
      paymentVoidedAt: '2026-06-02T00:00:00Z',
      linkedSaleStatus: 'final',
    }),
    false
  );
  assert.equal(
    shouldIncludePartyEffectiveRow({
      jeReferenceType: 'payment',
      linkedSaleStatus: 'final',
    }),
    true
  );
  assert.equal(
    partyEffectiveRowAuditLabel({
      jeReferenceType: 'sale',
      linkedSaleStatus: 'cancelled',
    }),
    'Cancelled sale trail — audit only'
  );
});

test('cancelled sale chain does not create negative effective balance', () => {
  type Row = {
    jeReferenceType: string;
    jeActionFingerprint?: string;
    linkedSaleStatus?: string;
    paymentVoidedAt?: string;
    debit: number;
    credit: number;
  };
  const arCusRows: Row[] = [
    { jeReferenceType: 'sale', linkedSaleStatus: 'cancelled', debit: 150, credit: 0 },
    { jeReferenceType: 'sale', linkedSaleStatus: 'cancelled', debit: 150, credit: 0 },
    { jeReferenceType: 'sale', linkedSaleStatus: 'cancelled', debit: 400, credit: 0 },
    { jeReferenceType: 'sale_reversal', linkedSaleStatus: 'cancelled', debit: 0, credit: 400 },
    { jeReferenceType: 'sale_reversal', linkedSaleStatus: 'cancelled', debit: 0, credit: 150 },
    {
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
      debit: 0,
      credit: 150,
    },
    {
      jeReferenceType: 'correction_reversal',
      paymentVoidedAt: '2026-06-02',
      debit: 1,
      credit: 0,
    },
  ];

  const normalEffectiveRows = arCusRows.filter((r) => {
    if (
      !shouldIncludePartyEffectiveRow({
        jeReferenceType: r.jeReferenceType,
        jeActionFingerprint: r.jeActionFingerprint,
        linkedSaleStatus: r.linkedSaleStatus,
        paymentVoidedAt: r.paymentVoidedAt,
      })
    ) {
      return false;
    }
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
