import { describe, expect, it } from 'vitest';
import {
  classifyControlTieOut,
  classifyUnpostedDocument,
  DIVERGENCE_LABELS,
  KNOWN_TRACE_CASES,
} from './financialTraceClassification';
import type { UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

describe('financialTraceClassification', () => {
  it('labels order-stage sales as D2', () => {
    const row: UnpostedDocumentRow = {
      source_type: 'sale',
      source_id: 'x',
      document_no: 'SL-0005',
      contact_id: null,
      contact_name: 'Patras',
      amount: 96000,
      branch_id: null,
      document_date: '2026-06-01',
      company_id: 'co',
      reason: 'No sale JE',
    };
    const cls = classifyUnpostedDocument(row, 'order');
    expect(cls.code).toBe('D2');
    expect(cls.basis).toBe('operational');
  });

  it('flags 1100 vs AR-CUS gap as D1/D7', () => {
    const { codes, warnings } = classifyControlTieOut({
      control1100Net: -166650,
      arCusSubledgerSum: 2423601,
      glArNet: 2216951,
      operationalDue: 288000,
    });
    expect(codes).toContain('D1');
    expect(codes).toContain('D7');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('includes known Phase 1 cases', () => {
    expect(KNOWN_TRACE_CASES.some((c) => c.id === 'inayat-ren-0002')).toBe(true);
    expect(KNOWN_TRACE_CASES.some((c) => c.id === 'saqib-rcv-0008')).toBe(true);
    expect(KNOWN_TRACE_CASES.some((c) => c.id === 'hq-sl-0003-orphan-ar')).toBe(true);
    expect(DIVERGENCE_LABELS.D3).toMatch(/Metadata/);
  });
});
