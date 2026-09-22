/**
 * Node:test — party role routing (no name heuristics).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterWorkerJeChoicesByIntent,
  isMerchandiseSupplierContactType,
  isWorkerOrCourierContactType,
  partyAccountingRoleFromContactType,
  workerGlComponentForIntent,
  workerLeafIntentLabel,
} from './partyRoleAccountRouting.ts';

describe('partyRoleAccountRouting', () => {
  it('maps explicit contact types without name heuristics', () => {
    assert.equal(partyAccountingRoleFromContactType('worker'), 'worker');
    assert.equal(partyAccountingRoleFromContactType('courier'), 'courier');
    assert.equal(partyAccountingRoleFromContactType('supplier'), 'supplier');
    assert.equal(partyAccountingRoleFromContactType('both'), 'supplier');
    assert.equal(partyAccountingRoleFromContactType('money_exchange'), 'money_exchange');
    assert.equal(partyAccountingRoleFromContactType('customer'), 'customer');
  });

  it('does not invent roles from display names', () => {
    assert.equal(partyAccountingRoleFromContactType('supplier'), 'supplier');
    assert.equal(isMerchandiseSupplierContactType('supplier'), true);
    assert.equal(isWorkerOrCourierContactType('supplier'), false);
  });

  it('requires explicit worker intent for WA vs WP', () => {
    assert.equal(workerGlComponentForIntent(null), null);
    assert.equal(workerGlComponentForIntent('ambiguous'), null);
    assert.equal(workerGlComponentForIntent('advance'), 'worker_1180');
    assert.equal(workerGlComponentForIntent('payable'), 'worker_2010');
    assert.match(workerLeafIntentLabel('ambiguous'), /choose/i);
  });

  it('filters JE choices by worker intent', () => {
    const choices = [
      { component: 'worker_1180', accountId: 'wa' },
      { component: 'worker_2010', accountId: 'wp' },
    ];
    assert.deepEqual(filterWorkerJeChoicesByIntent(choices, 'advance'), [
      { component: 'worker_1180', accountId: 'wa' },
    ]);
    assert.equal(filterWorkerJeChoicesByIntent(choices, null).length, 2);
  });
});
