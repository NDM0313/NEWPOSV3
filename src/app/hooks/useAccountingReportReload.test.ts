import '../test/domEventPolyfill.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchDataInvalidated } from '../lib/dataInvalidationBus.ts';
import { subscribeAccountingReportReload } from './useAccountingReportReload.ts';

test('subscribeAccountingReportReload bumps on accounting domain invalidation', async () => {
  let count = 0;
  const unsub = subscribeAccountingReportReload(() => {
    count += 1;
  }, { debounceMs: 50 });

  dispatchDataInvalidated({ domain: 'accounting', companyId: 'co-1', reason: 'test-accounting' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(count, 1);

  dispatchDataInvalidated({ domain: 'inventory', companyId: 'co-1', reason: 'test-inventory' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(count, 1);

  dispatchDataInvalidated({ domain: 'reports', companyId: 'co-1', reason: 'test-reports' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(count, 2);

  unsub();
});

test('subscribeAccountingReportReload respects company filter', async () => {
  let count = 0;
  const unsub = subscribeAccountingReportReload(
    () => {
      count += 1;
    },
    { companyId: 'co-a', debounceMs: 50 },
  );

  dispatchDataInvalidated({ domain: 'accounting', companyId: 'co-b', reason: 'other-company' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(count, 0);

  dispatchDataInvalidated({ domain: 'accounting', companyId: 'co-a', reason: 'same-company' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(count, 1);

  unsub();
});
