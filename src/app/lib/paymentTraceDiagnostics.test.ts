import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPaymentTraceView } from './paymentTraceDiagnostics';
import type { TransactionTraceResult } from '@/app/services/accountingDeveloperCenterService';

function minimalTrace(overrides: Partial<TransactionTraceResult> = {}): TransactionTraceResult {
  return {
    query: 'HQ-RCV-0006',
    mode: 'auto',
    overall: 'clean',
    journals: [],
    entities: [],
    ruleHits: [],
    sourceDocNarrative: '',
    payments: [
      {
        id: 'pay-1',
        reference_number: 'HQ-RCV-0006',
        reference_type: 'rental',
        amount: 10000,
        payment_date: '2026-06-04',
        contact_id: 'c1',
        branch_id: 'b1',
        journal_entry_id: 'je-1',
        voided_at: null,
      },
    ],
    rentalPayments: [],
    branchChain: [],
    reportVisibility: [
      {
        roznamcha: {
          normal: { included: true, reason: 'payments stream' },
          audit: { included: true, reason: 'payments stream' },
        },
        accountStatement: {
          normal: { included: true, reason: 'party payment' },
          audit: { included: true, reason: 'party payment' },
        },
        customerSupplierStatement: {
          normal: { included: true, reason: 'party payment' },
          audit: { included: true, reason: 'party payment' },
        },
        dayBook: {
          normal: { included: true, reason: 'all JE lines' },
          audit: { included: true, reason: 'all JE lines' },
        },
        dashboard: { impacted: [], note: '' },
      },
    ],
    reportVisibilityByJournal: [],
    multipleEntryNoMatches: [],
    ...overrides,
  };
}

test('buildPaymentTraceView picks payment matching query', () => {
  const view = buildPaymentTraceView(minimalTrace(), 'HQ-RCV-0006');
  assert.equal(view.primaryPaymentRef, 'HQ-RCV-0006');
  assert.equal(view.sections[0].id, 'payment');
  assert.match(view.reportVisibilitySummary, /Roznamcha: 1\/1/);
});
