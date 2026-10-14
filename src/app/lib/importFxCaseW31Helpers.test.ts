import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  operationalStatusLabels,
  purposeRequiresWave,
  sumDistributionUsd,
  supplierAsIntermediaryWarning,
  validateRoutingAllocation,
  W31_HOLDING_NOT_AP_COPY,
  W31_REQUIRES_W5_COPY,
} from './importFxCaseW31Helpers.ts';

test('W3.1 agent/company/third-party full hold validation', () => {
  assert.equal(
    validateRoutingAllocation({
      routingMode: 'COMPANY_WALLET',
      acquiredUsd: 50000,
      retainedUsd: 50000,
      distributionRows: [],
      destinationWalletId: 'w1',
    }).ok,
    true
  );
  assert.equal(
    validateRoutingAllocation({
      routingMode: 'AGENT_CUSTODY',
      acquiredUsd: 50000,
      retainedUsd: 50000,
      distributionRows: [],
    }).ok,
    true
  );
  assert.equal(
    validateRoutingAllocation({
      routingMode: 'THIRD_PARTY_CUSTODY',
      acquiredUsd: 50000,
      retainedUsd: 50000,
      distributionRows: [],
      holderContactId: 'tp1',
      agentContactId: 'ag1',
    }).ok,
    true
  );
});

test('W3.1 split 10+8+5+27 validates; over-allocation rejects', () => {
  const rows = [
    { recipient_contact_id: 'a', purpose: 'SUPPLIER_INVOICE_SETTLEMENT' as const, usd_qty: 10000, linked_purchase_id: 'p1' },
    { recipient_contact_id: 'b', purpose: 'SUPPLIER_INVOICE_SETTLEMENT' as const, usd_qty: 8000, linked_purchase_id: 'p2' },
    { recipient_contact_id: 'c', purpose: 'THIRD_PARTY_CUSTODY' as const, usd_qty: 5000 },
  ];
  assert.equal(sumDistributionUsd(rows), 23000);
  const ok = validateRoutingAllocation({
    routingMode: 'SPLIT_HOLD_AND_DISTRIBUTE',
    acquiredUsd: 50000,
    retainedUsd: 27000,
    distributionRows: rows,
    holderContactId: 'ag1',
    agentContactId: 'ag1',
  });
  assert.equal(ok.ok, true);
  const bad = validateRoutingAllocation({
    routingMode: 'SPLIT_HOLD_AND_DISTRIBUTE',
    acquiredUsd: 50000,
    retainedUsd: 27000,
    distributionRows: [...rows, { recipient_contact_id: 'x', purpose: 'OTHER_REVIEW_REQUIRED', usd_qty: 1 }],
  });
  assert.equal(bad.ok, false);
});

test('W3.1 direct distribution must fully allocate', () => {
  const res = validateRoutingAllocation({
    routingMode: 'DIRECT_DISTRIBUTION',
    acquiredUsd: 100,
    retainedUsd: 0,
    distributionRows: [{ recipient_contact_id: 'a', purpose: 'THIRD_PARTY_CUSTODY', usd_qty: 40 }],
  });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, 'UNALLOCATED_USD');
});

test('W3.1 supplier settlement purpose requires linked purchase; intermediary warning', () => {
  const miss = validateRoutingAllocation({
    routingMode: 'DIRECT_DISTRIBUTION',
    acquiredUsd: 10,
    retainedUsd: 0,
    distributionRows: [{ recipient_contact_id: 's1', purpose: 'SUPPLIER_INVOICE_SETTLEMENT', usd_qty: 10 }],
  });
  assert.equal(miss.ok, false);
  assert.equal(
    supplierAsIntermediaryWarning({ recipientIsSupplier: true, purpose: 'THIRD_PARTY_CUSTODY' }),
    W31_HOLDING_NOT_AP_COPY
  );
  assert.equal(
    supplierAsIntermediaryWarning({ recipientIsSupplier: true, purpose: 'SUPPLIER_INVOICE_SETTLEMENT' }),
    W31_REQUIRES_W5_COPY
  );
  assert.equal(purposeRequiresWave('SUPPLIER_INVOICE_SETTLEMENT'), 'W5');
  assert.equal(purposeRequiresWave('CONVERSION_COUNTERPARTY'), 'W4');
  assert.equal(purposeRequiresWave('THIRD_PARTY_CUSTODY'), null);
});

test('W3.1 operational status labels', () => {
  const labels = operationalStatusLabels({
    routingMode: 'AGENT_CUSTODY',
    distributedUsd: 0,
    retainedUsd: 50000,
  });
  assert.ok(labels.includes('Acquired'));
  assert.ok(labels.includes('Held by Agent'));
  const split = operationalStatusLabels({
    routingMode: 'SPLIT_HOLD_AND_DISTRIBUTE',
    distributedUsd: 23000,
    retainedUsd: 27000,
  });
  assert.ok(split.includes('Partially Distributed'));
  assert.ok(split.includes('Requires W5 Supplier Settlement'));
});
