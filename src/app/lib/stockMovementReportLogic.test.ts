import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildExportRows,
  buildIntegritySummary,
  buildMovementReportRows,
  buildPrintSnapshotFromSections,
  buildProductSummary,
  computeOpeningStock,
  computePeriodTotals,
  computeRunningBalances,
  deriveStockStatus,
  filterMovementsInPeriod,
  matchesMovementTypeFilter,
  normalizeMovementType,
  validateFilters,
  type ProductReportSection,
  type RawStockMovement,
} from './stockMovementReportLogic';

const mk = (
  id: string,
  created_at: string,
  quantity: number,
  movement_type: string,
  extra: Partial<RawStockMovement> = {},
): RawStockMovement => ({
  id,
  created_at,
  quantity,
  movement_type,
  ...extra,
});

test('1. specific product with movements — running balance and period totals', () => {
  const movements: RawStockMovement[] = [
    mk('1', '2025-01-01T10:00:00.000Z', 100, 'adjustment', { reference_type: 'opening_balance' }),
    mk('2', '2025-01-15T12:00:00.000Z', 50, 'purchase'),
    mk('3', '2025-01-20T14:00:00.000Z', -20, 'sale'),
  ];
  const opening = computeOpeningStock(movements, '2025-01-10');
  assert.equal(opening, 100);
  const period = filterMovementsInPeriod(movements, '2025-01-10', '2025-01-31');
  assert.equal(period.length, 2);
  const rows = buildMovementReportRows(period, opening, {});
  assert.equal(rows[0].runningBalance, 150);
  assert.equal(rows[1].runningBalance, 130);
  const totals = computePeriodTotals(movements, '2025-01-10', '2025-01-31');
  assert.equal(totals.totalIn, 50);
  assert.equal(totals.totalOut, 20);
});

test('2. specific product with no movements (Case B)', () => {
  const summary = buildProductSummary(
    { productId: 'p1', productName: 'Widget', sku: 'W-1' },
    [],
    [],
    '2025-01-01',
    '2025-01-31',
    0,
    false,
  );
  assert.equal(summary.status, 'no_movement');
  assert.equal(summary.movementCountInPeriod, 0);
  const section: ProductReportSection = { summary, rows: [], isEmpty: true };
  const exportRows = buildExportRows([section]);
  assert.ok(exportRows.some((r) => r.rowType === 'DETAIL' && String(r.notes).includes('No stock movement')));
});

test('3. all products + include zero stock — integrity counts', () => {
  const summaries = [
    buildProductSummary(
      { productId: 'a', productName: 'A', sku: 'A1' },
      [mk('1', '2025-01-05T00:00:00.000Z', 10, 'purchase')],
      [mk('1', '2025-01-05T00:00:00.000Z', 10, 'purchase')],
      '2025-01-01',
      '2025-01-31',
      10,
      true,
    ),
    buildProductSummary(
      { productId: 'b', productName: 'B', sku: 'B1' },
      [],
      [],
      '2025-01-01',
      '2025-01-31',
      0,
      false,
    ),
  ];
  const integrity = buildIntegritySummary(summaries);
  assert.equal(integrity.noMovementCount, 1);
  assert.equal(integrity.zeroStockCount, 0);
});

test('4. zero current stock + past transactions (Case A)', () => {
  const movements = [
    mk('1', '2025-01-01T00:00:00.000Z', 50, 'purchase'),
    mk('2', '2025-01-10T00:00:00.000Z', -50, 'sale'),
  ];
  const status = deriveStockStatus(0, movements.length > 0);
  assert.equal(status, 'zero_stock');
});

test('5. no inventory_balance row — missingBalanceRow flag', () => {
  const summary = buildProductSummary(
    { productId: 'p', productName: 'P', sku: 'P1' },
    [mk('1', '2025-01-01T00:00:00.000Z', 5, 'purchase')],
    [mk('1', '2025-01-01T00:00:00.000Z', 5, 'purchase')],
    '2025-01-01',
    '2025-01-31',
    5,
    false,
  );
  assert.equal(summary.missingBalanceRow, true);
});

test('6. opening stock before date range', () => {
  const movements = [
    mk('1', '2024-12-01T00:00:00.000Z', 200, 'adjustment', { reference_type: 'opening_balance' }),
    mk('2', '2025-02-01T00:00:00.000Z', 10, 'purchase'),
  ];
  assert.equal(computeOpeningStock(movements, '2025-01-01'), 200);
});

test('7. running balance after each row', () => {
  const period = [
    mk('a', '2025-01-01T00:00:00.000Z', 10, 'purchase'),
    mk('b', '2025-01-02T00:00:00.000Z', -3, 'sale'),
    mk('c', '2025-01-03T00:00:00.000Z', 2, 'return'),
  ];
  const balances = computeRunningBalances(5, period);
  assert.equal(balances.get('a'), 15);
  assert.equal(balances.get('b'), 12);
  assert.equal(balances.get('c'), 14);
});

test('8. movement type filter — opening_balance reference', () => {
  assert.equal(normalizeMovementType('adjustment', 'opening_balance'), 'opening_stock');
  assert.equal(matchesMovementTypeFilter('adjustment', 'opening_balance', 'opening_stock'), true);
  assert.equal(matchesMovementTypeFilter('SALE', null, 'sale'), true);
});

test('9. export row shape — summary + detail markers', () => {
  const summary = buildProductSummary(
    { productId: 'x', productName: 'X', sku: 'X1' },
    [mk('1', '2025-01-01T00:00:00.000Z', 1, 'purchase')],
    [mk('1', '2025-01-01T00:00:00.000Z', 1, 'purchase')],
    '2025-01-01',
    '2025-01-31',
    1,
    true,
  );
  const rows = buildMovementReportRows(summary.movementCountInPeriod ? [mk('1', '2025-01-01T00:00:00.000Z', 1, 'purchase')] : [], 0);
  const exportRows = buildExportRows([{ summary, rows, isEmpty: false }]);
  assert.equal(exportRows[0].rowType, 'SUMMARY');
  assert.equal(exportRows[1].rowType, 'DETAIL');
});

test('10. print snapshot builder does not throw on empty data', () => {
  const snap = buildPrintSnapshotFromSections([]);
  assert.deepEqual(snap.rows, []);
  assert.ok(Array.isArray(snap.columns));
});

test('validateFilters rejects from > to', () => {
  assert.equal(validateFilters('2025-02-01', '2025-01-01'), 'From date cannot be after To date.');
  assert.equal(validateFilters('2025-01-01', '2025-01-31'), null);
});
