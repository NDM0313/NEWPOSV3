import { describe, expect, it } from 'vitest';
import {
  buildBalanceBasisGuideRow,
  computeHiddenCredit,
  computeOperationalClamped,
  filterBalanceBasisGuideRows,
  mergeControlTotals,
  rowHasGap,
  sumBalanceBasisGuideTotals,
  sumSupplierBusinessGlExposure,
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
      businessGlNet: -200000,
    });
    expect(row.operationalPayable).toBe(0);
    expect(row.hiddenCreditAp).toBe(-200000);
    expect(row.businessGlNet).toBe(-200000);
    expect(rowHasGap(row)).toBe(true);
  });

  it('ARIF golden: Official AP 0 + Business GL 39937; visible with hide-zero', () => {
    const arif = buildBalanceBasisGuideRow({
      contactId: '21e1ac76-b911-44a1-87dd-6283969efa4c',
      contactName: 'ARIF LHR',
      contactCode: 'SUP-ZHD-0017',
      contactType: 'supplier',
      subledgerAccountHint: '210017',
      glArSigned: 0,
      glApSigned: 0,
      glWorkerSigned: 0,
      businessGlNet: 39937,
    });
    expect(arif.glApSigned).toBe(0);
    expect(arif.operationalPayable).toBe(0);
    expect(arif.businessGlNet).toBe(39937);
    const filtered = filterBalanceBasisGuideRows([arif], { hideZeroOperational: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].contactName).toBe('ARIF LHR');
  });

  it('CLEAN_AP_ONLY: Business GL reconciles to Official AP', () => {
    const row = buildBalanceBasisGuideRow({
      contactId: 'c',
      contactName: 'ALAM BNRS',
      contactCode: 'SUP-ZHD-0149',
      contactType: 'supplier',
      glArSigned: 0,
      glApSigned: 1105100,
      glWorkerSigned: 0,
      businessGlNet: 1105100,
    });
    expect(row.businessGlNet).toBe(row.glApSigned);
  });

  it('ZERO_HISTORY supplier both zero', () => {
    const row = buildBalanceBasisGuideRow({
      contactId: 'z',
      contactName: 'BANZIR LHR',
      contactCode: 'SUP-ZHD-0019',
      contactType: 'supplier',
      glArSigned: 0,
      glApSigned: 0,
      glWorkerSigned: 0,
      businessGlNet: 0,
    });
    expect(row.businessGlNet).toBe(0);
    expect(filterBalanceBasisGuideRows([row], { hideZeroOperational: true })).toHaveLength(0);
  });

  it('worker/courier Business GL column is null (—)', () => {
    const worker = buildBalanceBasisGuideRow({
      contactId: 'w',
      contactName: 'Worker',
      contactCode: null,
      contactType: 'worker',
      glArSigned: 0,
      glApSigned: 0,
      glWorkerSigned: 5000,
      businessGlNet: null,
    });
    const courier = buildBalanceBasisGuideRow({
      contactId: 'c',
      contactName: 'DHL',
      contactCode: 'SUP-ZHD-0007',
      contactType: 'courier',
      glArSigned: 0,
      glApSigned: 0,
      glWorkerSigned: 0,
      businessGlNet: null,
    });
    expect(worker.businessGlNet).toBeNull();
    expect(courier.businessGlNet).toBeNull();
  });

  it('sumSupplierBusinessGlExposure ignores null roles and does not affect Official AP totals', () => {
    const rows = [
      buildBalanceBasisGuideRow({
        contactId: '1',
        contactName: 'ARIF',
        contactCode: null,
        contactType: 'supplier',
        glArSigned: 0,
        glApSigned: 0,
        glWorkerSigned: 0,
        businessGlNet: 39937,
      }),
      buildBalanceBasisGuideRow({
        contactId: '2',
        contactName: 'Worker',
        contactCode: null,
        contactType: 'worker',
        glArSigned: 0,
        glApSigned: 0,
        glWorkerSigned: 100,
        businessGlNet: null,
      }),
    ];
    expect(sumSupplierBusinessGlExposure(rows)).toBe(39937);
    const official = sumBalanceBasisGuideTotals(rows);
    expect(official.payablesPartySigned).toBe(100);
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
        businessGlNet: 109309,
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
        businessGlNet: 0,
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
        businessGlNet: 0,
      }),
    ];
    const filtered = filterBalanceBasisGuideRows(rows, { showOnlyWithGap: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].contactName).toBe('Has gap');
  });
});
