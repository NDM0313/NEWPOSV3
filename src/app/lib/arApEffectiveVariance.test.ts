import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeEffectiveGlAr,
  computeEffectiveVariance,
  sumAuditOnlyPartyGlNet,
} from './arApEffectiveVariance';

test('AR-CUS0000 audit-only lines net to raw orphan; effective GL becomes zero', () => {
  const walkInLines = [
    { jeReferenceType: 'sale', linkedSaleStatus: 'cancelled', netDrMinusCr: 150 },
    { jeReferenceType: 'sale', linkedSaleStatus: 'cancelled', netDrMinusCr: 150 },
    { jeReferenceType: 'sale', linkedSaleStatus: 'cancelled', netDrMinusCr: 400 },
    { jeReferenceType: 'sale_reversal', linkedSaleStatus: 'cancelled', netDrMinusCr: -400 },
    { jeReferenceType: 'sale_reversal', linkedSaleStatus: 'cancelled', netDrMinusCr: -150 },
    {
      jeReferenceType: 'gl_correction',
      jeActionFingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
      linkedSaleStatus: 'cancelled',
      netDrMinusCr: -150,
    },
    { jeReferenceType: 'correction_reversal', paymentVoidedAt: '2026-06-02', netDrMinusCr: 1 },
    { jeReferenceType: 'sale', linkedSaleStatus: 'final', netDrMinusCr: 40000 },
    { jeReferenceType: 'payment', linkedSaleStatus: 'final', netDrMinusCr: -40000 },
  ];

  const auditOnly = sumAuditOnlyPartyGlNet(walkInLines);
  assert.equal(auditOnly, 1);

  const rawGl = 1;
  const effectiveGl = computeEffectiveGlAr(rawGl, auditOnly);
  assert.equal(effectiveGl, 0);

  const operational = 0;
  assert.equal(computeEffectiveVariance(operational, effectiveGl), 0);
  assert.equal(computeEffectiveVariance(operational, rawGl), -1);
});

test('final sale + payment pair stays in effective GL totals', () => {
  const lines = [
    { jeReferenceType: 'sale', linkedSaleStatus: 'final', netDrMinusCr: 15000 },
    { jeReferenceType: 'payment', linkedSaleStatus: 'final', netDrMinusCr: -15000 },
  ];
  assert.equal(sumAuditOnlyPartyGlNet(lines), 0);
});
