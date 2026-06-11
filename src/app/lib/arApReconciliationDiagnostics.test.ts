import { describe, expect, it } from 'vitest';
import {
  diagnoseUnmappedLine,
  diagnoseUnpostedRow,
  isLikelyPaymentOnAccountFalsePositive,
} from './arApReconciliationDiagnostics';
import type { UnmappedJournalRow, UnpostedDocumentRow } from '@/app/services/arApReconciliationCenterService';

const baseUnposted = (over: Partial<UnpostedDocumentRow>): UnpostedDocumentRow => ({
  source_type: 'sale',
  source_id: 'id-1',
  document_no: 'SL-0005',
  contact_id: null,
  contact_name: 'Walk-in',
  amount: 1000,
  branch_id: null,
  document_date: '2026-01-01',
  company_id: 'co-1',
  reason: 'missing je',
  ...over,
});

const baseUnmapped = (over: Partial<UnmappedJournalRow>): UnmappedJournalRow => ({
  journal_entry_id: 'je-1',
  entry_no: 'JV-001',
  entry_date: '2026-01-01',
  company_id: 'co-1',
  branch_id: null,
  journal_line_id: 'jl-1',
  account_id: 'acc-1',
  account_code: 'AR-CUS0001',
  account_name: 'Walk-in Customer',
  debit: 0,
  credit: 1000,
  reference_type: 'payment',
  reference_id: 'pay-1',
  control_bucket: 'AR',
  contact_mapping_status: 'reference_whitelist_no_party_on_line',
  reason: 'unmapped',
  ...over,
});

describe('diagnoseUnpostedRow', () => {
  it('labels order-stage sales as non-final', () => {
    const d = diagnoseUnpostedRow(baseUnposted({ document_no: 'SL-0005' }), 'order');
    expect(d.isNonFinal).toBe(true);
    expect(d.isPostable).toBe(false);
    expect(d.label).toBe('Non-final / not postable');
    expect(d.riskLevel).toBe('low');
  });

  it('labels final sales missing JE as postable preview', () => {
    const d = diagnoseUnpostedRow(baseUnposted({ document_no: 'SL-9999' }), 'final');
    expect(d.isNonFinal).toBe(false);
    expect(d.isPostable).toBe(true);
    expect(d.label).toBe('Final — missing posting');
  });
});

describe('isLikelyPaymentOnAccountFalsePositive', () => {
  it('detects RCV-style payment on_account with matching AR contact', () => {
    expect(
      isLikelyPaymentOnAccountFalsePositive({
        jeReferenceType: 'payment',
        paymentReferenceType: 'on_account',
        arLinkedContactId: 'c-walkin',
        paymentContactId: 'c-walkin',
      })
    ).toBe(true);
  });

  it('rejects when contacts differ', () => {
    expect(
      isLikelyPaymentOnAccountFalsePositive({
        jeReferenceType: 'payment',
        paymentReferenceType: 'on_account',
        arLinkedContactId: 'c-a',
        paymentContactId: 'c-b',
      })
    ).toBe(false);
  });
});

describe('diagnoseUnmappedLine', () => {
  it('flags likely false positive for payment/on_account/matching contact', () => {
    const row = baseUnmapped({ entry_no: 'RCV-0017' });
    const d = diagnoseUnmappedLine(row, { reference_type: 'on_account', contact_id: 'c-walkin' }, 'c-walkin');
    expect(d.isLikelyFalsePositive).toBe(true);
    expect(d.riskLevel).toBe('low');
  });
});
