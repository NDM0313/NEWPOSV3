/**
 * Preview / Test mode for Physical Stock Count.
 * In-memory only — never calls post_stock_count_session or inserts stock_movements.
 */
import {
  applyDecrement,
  applyDirectEntry,
  applyIncrement,
  classifyCountStatus,
  computeDifference,
  confirmZero,
  startFormalRecount,
} from './stockCountMath';
import { compareBaselineToCurrent } from './stockCountDrift';

export const STOCK_COUNT_PREVIEW_BANNER =
  'PREVIEW / TEST MODE — changes stay in this browser only. No stock movements. No production posting.';

export type PreviewLine = {
  id: string;
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  variation_id: string | null;
  variation_sku: string | null;
  variation_label: string | null;
  item_kind: 'product' | 'variation';
  image_url: string | null;
  system_qty_baseline: number;
  baseline_at: string;
  current_system_qty: number;
  physical_qty: number | null;
  count_status: 'uncounted' | 'counted_zero' | 'counted_qty';
  active_pass_number: number;
  difference: number | null;
};

export type PreviewSession = {
  id: string;
  scope_type: 'single_branch' | 'all_branches';
  branch_id: string | null;
  status: 'draft' | 'in_progress' | 'pending_review';
  notes: string;
};

/** Deterministic fixture: baseline 3, current 8 (post-baseline purchases +5). */
export function createBaseline3Current8Fixture(branchId = 'preview-branch-a'): {
  session: PreviewSession;
  lines: PreviewLine[];
  movements: Array<{
    id: string;
    movement_type: string;
    quantity: number;
    created_at: string;
    reference_type: string;
    reference_id: string;
    running_balance: number;
  }>;
  stockMovementsCreated: number;
} {
  const baselineAt = '2026-10-01T10:00:00.000Z';
  const lines: PreviewLine[] = [
    {
      id: 'preview-line-1',
      branch_id: branchId,
      branch_name: 'Preview Shop A',
      product_id: 'preview-product-1',
      product_name: 'Preview Shirt',
      product_sku: 'PREV-SHIRT',
      variation_id: 'preview-var-m',
      variation_sku: 'PREV-SHIRT-M',
      variation_label: 'Size: M · Color: Blue',
      item_kind: 'variation',
      image_url: null,
      system_qty_baseline: 3,
      baseline_at: baselineAt,
      current_system_qty: 8,
      physical_qty: null,
      count_status: 'uncounted',
      active_pass_number: 1,
      difference: null,
    },
  ];
  const movements = [
    {
      id: 'm1',
      movement_type: 'purchase',
      quantity: 3,
      created_at: '2026-09-01T00:00:00.000Z',
      reference_type: 'purchase',
      reference_id: 'preview-purchase-open',
      running_balance: 3,
    },
    {
      id: 'm2',
      movement_type: 'purchase',
      quantity: 5,
      created_at: '2026-10-05T12:00:00.000Z',
      reference_type: 'purchase',
      reference_id: 'preview-purchase-after',
      running_balance: 8,
    },
  ];
  return {
    session: {
      id: 'preview-session-1',
      scope_type: 'single_branch',
      branch_id: branchId,
      status: 'in_progress',
      notes: STOCK_COUNT_PREVIEW_BANNER,
    },
    lines,
    movements,
    stockMovementsCreated: 0,
  };
}

export function createAllBranchesPreviewFixture(): {
  session: PreviewSession;
  lines: PreviewLine[];
  stockMovementsCreated: number;
} {
  const baselineAt = '2026-10-01T10:00:00.000Z';
  const mk = (
    id: string,
    branch_id: string,
    branch_name: string,
    baseline: number,
    current: number
  ): PreviewLine => ({
    id,
    branch_id,
    branch_name,
    product_id: 'preview-product-1',
    product_name: 'Preview Shirt',
    product_sku: 'PREV-SHIRT',
    variation_id: 'preview-var-m',
    variation_sku: 'PREV-SHIRT-M',
    variation_label: 'Size: M · Color: Blue',
    item_kind: 'variation',
    image_url: null,
    system_qty_baseline: baseline,
    baseline_at: baselineAt,
    current_system_qty: current,
    physical_qty: null,
    count_status: 'uncounted',
    active_pass_number: 1,
    difference: null,
  });
  return {
    session: {
      id: 'preview-session-all',
      scope_type: 'all_branches',
      branch_id: null,
      status: 'in_progress',
      notes: STOCK_COUNT_PREVIEW_BANNER,
    },
    lines: [
      mk('preview-line-a', 'preview-branch-a', 'Preview Shop A', 2, 2),
      mk('preview-line-b', 'preview-branch-b', 'Preview Shop B', 3, 3),
    ],
    stockMovementsCreated: 0,
  };
}

function touchLine(line: PreviewLine, physical: number | null, pass?: number): PreviewLine {
  return {
    ...line,
    physical_qty: physical,
    count_status: classifyCountStatus(physical),
    difference: computeDifference(physical, line.system_qty_baseline),
    active_pass_number: pass ?? line.active_pass_number,
  };
}

export type PreviewStore = {
  session: PreviewSession;
  lines: PreviewLine[];
  stockMovementsCreated: number;
  postAttempts: number;
  applyEvent: (
    lineId: string,
    event: 'increment' | 'decrement' | 'set' | 'confirm_zero' | 'start_recount',
    value?: number
  ) => PreviewLine;
  /** Preview post: validates drift rules but never creates movements. */
  previewPost: (opts?: {
    acknowledgeDriftLineIds?: string[];
  }) => {
    ok: boolean;
    blocked: string[];
    wouldCreateMovements: number;
    stockMovementsCreated: number;
  };
};

export function createPreviewStore(
  seed: 'baseline3_current8' | 'all_branches' = 'baseline3_current8'
): PreviewStore {
  const seeded =
    seed === 'all_branches'
      ? createAllBranchesPreviewFixture()
      : createBaseline3Current8Fixture();
  let lines = [...seeded.lines];
  let stockMovementsCreated = 0;
  let postAttempts = 0;

  return {
    get session() {
      return seeded.session;
    },
    get lines() {
      return lines;
    },
    get stockMovementsCreated() {
      return stockMovementsCreated;
    },
    get postAttempts() {
      return postAttempts;
    },
    applyEvent(lineId, event, value) {
      const idx = lines.findIndex((l) => l.id === lineId);
      if (idx < 0) throw new Error('Preview line not found');
      const line = lines[idx];
      let next: PreviewLine;
      if (event === 'increment') {
        next = touchLine(line, applyIncrement(line.physical_qty, value ?? 1));
      } else if (event === 'decrement') {
        next = touchLine(line, applyDecrement(line.physical_qty, value ?? 1));
      } else if (event === 'set') {
        next = touchLine(line, applyDirectEntry(value ?? 0));
      } else if (event === 'confirm_zero') {
        next = touchLine(line, confirmZero());
      } else {
        const recount = startFormalRecount(line.physical_qty);
        // Fresh baseline = current system stock at recount time
        next = {
          ...touchLine(line, recount.physicalQty, recount.nextPassNumber(line.active_pass_number)),
          system_qty_baseline: line.current_system_qty,
          baseline_at: new Date().toISOString(),
        };
        const snap = compareBaselineToCurrent(next.system_qty_baseline, next.current_system_qty);
        next = { ...next, difference: computeDifference(next.physical_qty, next.system_qty_baseline) };
        void snap;
      }
      lines = lines.map((l, i) => (i === idx ? next : l));
      return next;
    },
    previewPost(opts) {
      postAttempts += 1;
      const ack = new Set(opts?.acknowledgeDriftLineIds || []);
      const blocked: string[] = [];
      let wouldCreate = 0;
      for (const line of lines) {
        const drifted = Math.abs(line.current_system_qty - line.system_qty_baseline) > 0.0000001;
        if (
          drifted &&
          line.count_status !== 'uncounted' &&
          !ack.has(line.id) &&
          // recounted after drift: baseline already equals current
          Math.abs(line.system_qty_baseline - line.current_system_qty) > 0.0000001
        ) {
          blocked.push(line.id);
          continue;
        }
        if (line.physical_qty != null && line.count_status !== 'uncounted') {
          const delta = line.physical_qty - line.system_qty_baseline;
          if (Math.abs(delta) > 0.0000001) wouldCreate += 1;
        }
      }
      // Never write
      stockMovementsCreated = 0;
      return {
        ok: blocked.length === 0,
        blocked,
        wouldCreateMovements: wouldCreate,
        stockMovementsCreated,
      };
    },
  };
}
