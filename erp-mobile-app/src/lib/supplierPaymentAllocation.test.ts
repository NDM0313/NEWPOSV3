import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeFifoPurchaseAllocationPlan,
  sortSuppliersByPayable,
  type OpenPurchaseForFifo,
} from '../lib/supplierPaymentAllocation';

test('computeFifoPurchaseAllocationPlan allocates FIFO and leaves remainder unallocated', () => {
  const open: OpenPurchaseForFifo[] = [
    { id: 'b2', po_no: 'PO-002', due_amount: 500, po_date: '2026-07-10' },
    { id: 'b1', po_no: 'PO-001', due_amount: 1000, po_date: '2026-07-01' },
  ];
  const plan = computeFifoPurchaseAllocationPlan(1200, open);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].purchaseId, 'b1');
  assert.equal(plan[0].amount, 1000);
  assert.equal(plan[1].purchaseId, 'b2');
  assert.equal(plan[1].amount, 200);
});

test('computeFifoPurchaseAllocationPlan skips zero-due rows', () => {
  const open: OpenPurchaseForFifo[] = [
    { id: 'b1', po_no: 'PO-001', due_amount: 0, po_date: '2026-07-01' },
    { id: 'b2', po_no: 'PO-002', due_amount: 300, po_date: '2026-07-02' },
  ];
  const plan = computeFifoPurchaseAllocationPlan(100, open);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].purchaseId, 'b2');
  assert.equal(plan[0].amount, 100);
});

test('sortSuppliersByPayable puts positive balances first then name', () => {
  const sorted = sortSuppliersByPayable([
    { name: 'Zeta', totalPayable: 0 },
    { name: 'Alpha', totalPayable: 500 },
    { name: 'Beta', totalPayable: 2000 },
    { name: 'Gamma', totalPayable: 0 },
  ]);
  assert.deepEqual(
    sorted.map((s) => s.name),
    ['Beta', 'Alpha', 'Gamma', 'Zeta'],
  );
});
