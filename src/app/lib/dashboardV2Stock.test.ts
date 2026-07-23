import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapOverviewToStockAlerts, classifyStockRow } from './dashboardV2Stock';
import type { InventoryOverviewRow } from '@/app/services/inventoryService';

function row(overrides: Partial<InventoryOverviewRow>): InventoryOverviewRow {
  return {
    id: '1',
    productId: 'p1',
    sku: 'SKU1',
    name: 'Widget',
    category: 'Cat',
    stock: 5,
    boxes: 0,
    pieces: 0,
    unit: 'pc',
    avgCost: 0,
    sellingPrice: 0,
    stockValue: 0,
    status: 'OK',
    movement: 'Medium',
    minStock: 10,
    reorderLevel: 10,
    ...overrides,
  };
}

test('classifyStockRow flags low when stock <= minStock', () => {
  const c = classifyStockRow(row({ stock: 10, minStock: 10 }));
  assert.equal(c?.status, 'low');
});

test('mapOverviewToStockAlerts count matches filtered list', () => {
  const alerts = mapOverviewToStockAlerts([
    row({ stock: 2, minStock: 5 }),
    row({ id: '2', productId: 'p2', stock: 50, minStock: 5 }),
    row({ id: '3', productId: 'p3', stock: 0, minStock: 1 }),
  ]);
  assert.equal(alerts.length, 2);
  assert.equal(alerts.filter((a) => a.status === 'out').length, 1);
});
