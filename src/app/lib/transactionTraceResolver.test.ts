import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPaymentTraceView } from './paymentTraceDiagnostics';
import type { TransactionTraceResult } from '@/app/services/accountingDeveloperCenterService';

/** Resolver chain smoke: payment ref → payment row → JE link in composed view. */
test('payment ref resolves to primary payment and linked JE section', () => {
  const trace: TransactionTraceResult = {
    query: 'PAY-0042',
    mode: 'payment_ref',
    overall: 'clean',
    sourceDocNarrative: '',
    journals: [
      {
        id: 'je-42',
        entry_no: 'JE-0042',
        entry_date: '2026-06-01',
        reference_type: 'payment',
        reference_id: 'pay-42',
        payment_id: 'pay-42',
        company_id: 'co-1',
        branch_id: null,
        is_void: false,
        description: null,
        lines: [],
      },
    ],
    entities: [{ kind: 'payment', id: 'pay-42', label: 'PAY-0042' }],
    ruleHits: [],
    payments: [
      {
        id: 'pay-42',
        reference_number: 'PAY-0042',
        reference_type: 'expense',
        amount: 5000,
        payment_date: '2026-06-01',
        journal_entry_id: 'je-42',
      },
    ],
    rentalPayments: [],
    branchChain: [],
    reportVisibility: [],
    reportVisibilityByJournal: [],
    multipleEntryNoMatches: [],
  };
  const view = buildPaymentTraceView(trace, 'PAY-0042');
  assert.equal(view.primaryPaymentId, 'pay-42');
  const journalSection = view.sections.find((s) => s.id === 'journals');
  assert.ok(journalSection);
  assert.ok(journalSection!.rows.some((r) => r.value === 'JE-0042'));
});
