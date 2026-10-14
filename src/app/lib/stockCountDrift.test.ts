import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareBaselineToCurrent,
  explainBaseline3Current8Case,
  ledgerRunningBalanceFromMovements,
  movementsAfterBaseline,
  postingCreatesMovement,
  shouldBlockPostForDrift,
  sumMovementsAfterBaseline,
} from './stockCountDrift';
import { summarizeStockMovements } from './stockLedgerSummary';

describe('stockCountDrift — baseline vs current', () => {
  it('baseline 3 / current 8 are separate; posting uses baseline', () => {
    const explained = explainBaseline3Current8Case(3);
    assert.equal(explained.snapshot.countBaseline, 3);
    assert.equal(explained.snapshot.currentSystemStock, 8);
    assert.equal(explained.snapshot.movementSinceBaseline, 5);
    assert.equal(explained.snapshot.drifted, true);
    assert.equal(explained.differenceVsBaseline, 0);
    assert.equal(explained.differenceVsCurrent, -5);
    assert.equal(explained.postingDeltaIfAccepted, 0);
    assert.equal(explained.labels.current, 'Current System Stock');
    assert.equal(explained.labels.baseline, 'Count Baseline');
  });

  it('never labels baseline as current when they differ', () => {
    const s = compareBaselineToCurrent(3, 8);
    assert.notEqual(s.countBaseline, s.currentSystemStock);
    assert.equal(s.drifted, true);
  });

  it('sum of post-baseline movements explains drift', () => {
    const baselineAt = '2026-10-01T10:00:00.000Z';
    const moves = [
      { quantity: 3, created_at: '2026-09-01T00:00:00.000Z', movement_type: 'purchase' },
      { quantity: 5, created_at: '2026-10-05T00:00:00.000Z', movement_type: 'purchase' },
    ];
    assert.equal(sumMovementsAfterBaseline(moves, baselineAt), 5);
    assert.equal(movementsAfterBaseline(moves, baselineAt).length, 1);
    assert.equal(ledgerRunningBalanceFromMovements(moves), 8);
  });

  it('count history running balance agrees with ledger summarizer currentBalance', () => {
    const moves = [
      { movement_type: 'purchase', quantity: 3 },
      { movement_type: 'purchase', quantity: 5 },
      { movement_type: 'sale', quantity: -1 },
      { movement_type: 'rental_out', quantity: -2 },
      { movement_type: 'rental_in', quantity: 1 },
    ];
    const ledgerBal = ledgerRunningBalanceFromMovements(moves);
    const summary = summarizeStockMovements(moves);
    assert.equal(ledgerBal, summary.currentBalance);
    assert.equal(ledgerBal, 6); // 3+5-1-2+1
  });

  it('blocks post when drifted and counted without ack/recount', () => {
    const blocked = shouldBlockPostForDrift({
      drifted: true,
      countStatus: 'counted_qty',
    });
    assert.equal(blocked.block, true);
    assert.ok(blocked.reason);

    assert.equal(
      shouldBlockPostForDrift({
        drifted: true,
        countStatus: 'uncounted',
      }).block,
      false
    );
    assert.equal(
      shouldBlockPostForDrift({
        drifted: true,
        countStatus: 'counted_qty',
        driftAcknowledged: true,
      }).block,
      false
    );
  });

  it('zero variance vs baseline creates no movement even if current is 8', () => {
    assert.equal(postingCreatesMovement(3, 3), false);
    assert.equal(postingCreatesMovement(8, 3), true);
  });
});
