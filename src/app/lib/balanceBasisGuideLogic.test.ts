import { describe, expect, it } from 'vitest';
import {
  buildBalanceBasisGuideRow,
  computeHiddenCredit,
  computeOperationalClamped,
  filterBalanceBasisGuideRows,
  mergeControlTotals,
  rowHasGap,
  sumBalanceBasisGuideTotals,
} from './balanceBasisGuideLogic';

describe('balanceBasisGuideLogic', () => {
  it('computeOperationalClamped hides negatives', () => {
    expect(computeOperationalClamped(100)).toBe(100);
    expect(computeOperationalClamped(-547191)).toBe(0);
    expect(computeOperationalClamped(0)).toBe(0);
  });

  it('computeHiddenCredit is signed minus operational', () => {
    expect(computeHiddenCredit(-547191, 0)).toBe(-547191);
    expect(computeHiddenCredit(50, 50)).toBe(0);
  });

  it('buildBalanceBasisGuideRow combines AP and worker for operational payable', () => {
    const row = buildBalanceBasisGuideRow({
      contactId: '1',
      contactName: 'Supplier X',
      contactCode: 'SUP001',
      contactType: 'supplier',
      glArSigned: 0,
      glApSigned: -200000,
      glWorkerSigned: 0,
    });
    expect(row.operationalPayable).toBe(0);
    expect(row.hiddenCreditAp).toBe(-200000);
    expect(rowHasGap(row)).toBe(true);
  });

  it('sumBalanceBasisGuideTotals matches footer math', () => {
    const rows = [
      buildBalanceBasisGuideRow({
        contactId: '1',
        contactName: 'A',
        contactCode: null,
        contactType: 'customer',
        glArSigned: 100,
        glApSigned: 0,
        glWorkerSigned: 0,
      }),
      buildBalanceBasisGuideRow({
        contactId: '2',
        contactName: 'B',
        contactCode: null,
        contactType: 'supplier',
        glArSigned: -50,
        glApSigned: 109309,
        glWorkerSigned: 0,
      }),
    ];
    const sums = sumBalanceBasisGuideTotals(rows);
    expect(sums.receivablesOperational).toBe(100);
    expect(sums.receivablesPartySigned).toBe(50);
    expect(sums.receivablesOperationalVsSigned).toBe(50);
    expect(sums.payablesOperational).toBe(109309);
    expect(sums.payablesPartySigned).toBe(109309);
  });

  it('mergeControlTotals computes party vs control variance', () => {
    const rowSums = sumBalanceBasisGuideTotals([
      buildBalanceBasisGuideRow({
        contactId: '1',
        contactName: 'S',
        contactCode: null,
        contactType: 'supplier',
        glArSigned: 0,
        glApSigned: -547191,
        glWorkerSigned: 0,
      }),
    ]);
    const totals = mergeControlTotals(rowSums, {
      receivablesControl: 1000,
      payablesControl: -547191,
      workerPayablesControl: 0,
    });
    expect(totals.payablesPartyVsControl).toBe(0);
    expect(totals.receivablesPartyVsControl).toBe(-1000);
  });

  it('filterBalanceBasisGuideRows showOnlyWithGap', () => {
    const rows = [
      buildBalanceBasisGuideRow({
        contactId: '1',
        contactName: 'No gap',
        contactCode: null,
        contactType: 'customer',
        glArSigned: 100,
        glApSigned: 0,
        glWorkerSigned: 0,
      }),
      buildBalanceBasisGuideRow({
        contactId: '2',
        contactName: 'Has gap',
        contactCode: null,
        contactType: 'supplier',
        glArSigned: 0,
        glApSigned: -1000,
        glWorkerSigned: 0,
      }),
    ];
    const filtered = filterBalanceBasisGuideRows(rows, { showOnlyWithGap: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].contactName).toBe('Has gap');
  });
});
