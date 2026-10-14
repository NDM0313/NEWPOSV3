import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectTransactionTraceRepairCandidates } from './transactionTraceRepairDiagnostics';

const baseJe = {
  id: 'je-1',
  entry_no: 'JE-001',
  entry_date: '2026-01-15',
  description: null,
  reference_type: 'sale',
  reference_id: 'sale-1',
  company_id: 'co-1',
  branch_id: null,
  is_void: false,
  payment_id: null,
  lines: [{ account_code: '1000', account_name: 'Cash', debit: 500, credit: 0 }],
};

test('detectTransactionTraceRepairCandidates suggests payment relink when JE matches orphan payment', () => {
  const candidates = detectTransactionTraceRepairCandidates({
    query: 'RCV-001',
    mode: 'auto',
    overall: 'warn',
    entities: [],
    journals: [baseJe],
    ruleHits: [],
    sourceDocNarrative: '',
    payments: [
      {
        id: 'pay-1',
        reference_number: 'RCV-001',
        amount: 500,
        payment_date: '2026-01-15',
        journal_entry_id: null,
        voided_at: null,
        branch_id: null,
      },
    ],
    rentalPayments: [],
    branchChain: [],
    reportVisibility: [],
    reportVisibilityByJournal: [],
    multipleEntryNoMatches: [],
  });
  const relink = candidates.find((c) => c.queueItem?.actionId === 'payment.relink_payment_to_journal');
  assert.ok(relink?.canQueue);
  assert.equal(relink?.queueItem?.params.paymentId, 'pay-1');
});

test('detectTransactionTraceRepairCandidates suggests branch sync when document branch exists', () => {
  const candidates = detectTransactionTraceRepairCandidates({
    query: 'SL-001',
    mode: 'auto',
    overall: 'info',
    entities: [],
    journals: [{ ...baseJe, branch_id: null }],
    ruleHits: [],
    sourceDocNarrative: '',
    payments: [
      {
        id: 'pay-2',
        reference_number: 'RCV-002',
        amount: 100,
        payment_date: '2026-01-15',
        branch_id: null,
        voided_at: null,
      },
    ],
    rentalPayments: [],
    branchChain: [{ layer: 'sale document', branchId: 'branch-a', label: 'HQ' }],
    reportVisibility: [],
    reportVisibilityByJournal: [],
    multipleEntryNoMatches: [],
  });
  assert.ok(candidates.some((c) => c.queueItem?.actionId === 'payment.sync_branch_from_document'));
});
