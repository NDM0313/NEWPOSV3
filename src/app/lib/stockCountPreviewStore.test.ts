import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createBaseline3Current8Fixture,
  createPreviewStore,
  STOCK_COUNT_PREVIEW_BANNER,
} from './stockCountPreviewStore';
import { compareBaselineToCurrent } from './stockCountDrift';

describe('stockCountPreviewStore — no stock writes', () => {
  it('fixture exposes baseline 3 and current 8 separately', () => {
    const f = createBaseline3Current8Fixture();
    const line = f.lines[0];
    const snap = compareBaselineToCurrent(line.system_qty_baseline, line.current_system_qty);
    assert.equal(snap.countBaseline, 3);
    assert.equal(snap.currentSystemStock, 8);
    assert.equal(f.movements[f.movements.length - 1].running_balance, 8);
    assert.ok(f.session.notes.includes('PREVIEW'));
    assert.ok(STOCK_COUNT_PREVIEW_BANNER.includes('No stock movements'));
  });

  it('draft edits and preview post create zero stock movements', () => {
    const store = createPreviewStore('baseline3_current8');
    store.applyEvent('preview-line-1', 'increment');
    store.applyEvent('preview-line-1', 'increment');
    store.applyEvent('preview-line-1', 'increment');
    assert.equal(store.lines[0].physical_qty, 3);
    assert.equal(store.lines[0].difference, 0);
    assert.equal(store.stockMovementsCreated, 0);

    // Drift blocks without ack
    const blocked = store.previewPost();
    assert.equal(blocked.ok, false);
    assert.equal(blocked.stockMovementsCreated, 0);
    assert.equal(store.stockMovementsCreated, 0);

    const ack = store.previewPost({ acknowledgeDriftLineIds: ['preview-line-1'] });
    assert.equal(ack.ok, true);
    assert.equal(ack.wouldCreateMovements, 0); // physical 3 − baseline 3
    assert.equal(ack.stockMovementsCreated, 0);
    assert.equal(store.stockMovementsCreated, 0);
  });

  it('confirm zero stays distinct from uncounted; recount refreshes baseline', () => {
    const store = createPreviewStore('baseline3_current8');
    assert.equal(store.lines[0].physical_qty, null);
    store.applyEvent('preview-line-1', 'confirm_zero');
    assert.equal(store.lines[0].physical_qty, 0);
    assert.equal(store.lines[0].count_status, 'counted_zero');

    store.applyEvent('preview-line-1', 'start_recount');
    assert.equal(store.lines[0].physical_qty, null);
    assert.equal(store.lines[0].count_status, 'uncounted');
    assert.equal(store.lines[0].system_qty_baseline, 8); // refreshed to current
    assert.equal(store.lines[0].active_pass_number, 2);
    assert.equal(store.stockMovementsCreated, 0);
  });

  it('retrying preview post never duplicates movements', () => {
    const store = createPreviewStore('baseline3_current8');
    store.applyEvent('preview-line-1', 'set', 8);
    const a = store.previewPost({ acknowledgeDriftLineIds: ['preview-line-1'] });
    const b = store.previewPost({ acknowledgeDriftLineIds: ['preview-line-1'] });
    assert.equal(a.wouldCreateMovements, 1); // 8 − 3
    assert.equal(b.wouldCreateMovements, 1);
    assert.equal(store.stockMovementsCreated, 0);
    assert.equal(store.postAttempts, 2);
  });

  it('all-branches preview keeps per-branch lines', () => {
    const store = createPreviewStore('all_branches');
    assert.equal(store.session.scope_type, 'all_branches');
    assert.equal(store.lines.length, 2);
    store.applyEvent('preview-line-a', 'set', 3);
    store.applyEvent('preview-line-b', 'set', 2);
    assert.equal(store.lines[0].difference, 1);
    assert.equal(store.lines[1].difference, -1);
    assert.equal(store.stockMovementsCreated, 0);
  });
});
