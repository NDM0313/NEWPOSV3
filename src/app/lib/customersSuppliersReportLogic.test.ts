import { describe, expect, it } from 'vitest';
import type { CustomersSuppliersReportRow } from '@/app/services/customersSuppliersReportService';
import {
  filterCustomersSuppliersRows,
  paginateRows,
  resolveVisibleColumns,
  sumCustomersSuppliersTotals,
} from './customersSuppliersReportLogic';

const sampleRows: CustomersSuppliersReportRow[] = [
  {
    contactId: '1',
    contactName: 'Alpha Co',
    contactType: 'customer',
    totalPurchase: 0,
    totalPurchaseReturn: 0,
    totalSale: 100,
    totalSellReturn: 0,
    payment: 80,
    totalDiscount: 5,
    openingBalanceDue: 10,
    due: 25,
  },
  {
    contactId: '2',
    contactName: 'Beta Supplies',
    contactType: 'supplier',
    totalPurchase: 500,
    totalPurchaseReturn: 20,
    totalSale: 0,
    totalSellReturn: 0,
    payment: 400,
    totalDiscount: 0,
    openingBalanceDue: 0,
    due: 80,
  },
  {
    contactId: '3',
    contactName: 'Gamma Both',
    contactType: 'both',
    totalPurchase: 50,
    totalPurchaseReturn: 0,
    totalSale: 75,
    totalSellReturn: 0,
    payment: 125,
    totalDiscount: 0,
    openingBalanceDue: 0,
    due: 0,
  },
];

describe('filterCustomersSuppliersRows', () => {
  it('filters by search term', () => {
    const filtered = filterCustomersSuppliersRows(sampleRows, 'beta');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].contactName).toBe('Beta Supplies');
  });
});

describe('resolveVisibleColumns', () => {
  it('hides purchase columns for customer filter', () => {
    const cols = resolveVisibleColumns('customer');
    expect(cols.totalPurchase).toBe(false);
    expect(cols.totalPurchaseReturn).toBe(false);
    expect(cols.totalSale).toBe(true);
  });

  it('hides sale columns for supplier filter', () => {
    const cols = resolveVisibleColumns('supplier');
    expect(cols.totalSale).toBe(false);
    expect(cols.totalSellReturn).toBe(false);
    expect(cols.totalPurchase).toBe(true);
  });

  it('shows all columns for both filter', () => {
    const cols = resolveVisibleColumns('both');
    expect(cols.totalPurchase).toBe(true);
    expect(cols.totalSale).toBe(true);
  });
});

describe('sumCustomersSuppliersTotals', () => {
  it('sums all currency columns', () => {
    const totals = sumCustomersSuppliersTotals(sampleRows);
    expect(totals.totalPurchase).toBe(550);
    expect(totals.totalSale).toBe(175);
    expect(totals.payment).toBe(605);
    expect(totals.due).toBe(105);
  });
});

describe('paginateRows', () => {
  it('returns correct slice and bounds', () => {
    const { slice, from, to, total, totalPages } = paginateRows(sampleRows, 1, 2);
    expect(slice).toHaveLength(2);
    expect(from).toBe(1);
    expect(to).toBe(2);
    expect(total).toBe(3);
    expect(totalPages).toBe(2);
  });
});
