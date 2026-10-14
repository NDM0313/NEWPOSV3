import type {
  CustomersSuppliersColumnKey,
  CustomersSuppliersReportRow,
} from '@/app/services/customersSuppliersReportService';
import { CUSTOMERS_SUPPLIERS_COLUMN_KEYS } from '@/app/services/customersSuppliersReportService';

export type ContactTypeFilter = 'both' | 'customer' | 'supplier';
export type BalanceStatus = 'all' | 'has_due' | 'cleared';

export type CustomersSuppliersFilterState = {
  contactType: ContactTypeFilter;
  balanceStatus: BalanceStatus;
};

export type CustomersSuppliersSortKey =
  | 'contactName'
  | 'totalPurchase'
  | 'totalPurchaseReturn'
  | 'totalSale'
  | 'totalSellReturn'
  | 'payment'
  | 'totalDiscount'
  | 'openingBalanceDue'
  | 'due'
  | 'advanceGl';

export type SortDirection = 'asc' | 'desc';

export type CustomersSuppliersTotals = {
  totalPurchase: number;
  totalPurchaseReturn: number;
  totalSale: number;
  totalSellReturn: number;
  payment: number;
  totalDiscount: number;
  openingBalanceDue: number;
  due: number;
  advanceGl: number;
};

/** Columns hidden by default for each contact-type filter. */
const HIDDEN_BY_CONTACT_TYPE: Record<ContactTypeFilter, CustomersSuppliersColumnKey[]> = {
  both: [],
  customer: ['totalPurchase', 'totalPurchaseReturn'],
  supplier: ['totalSale', 'totalSellReturn'],
};

export function resolveVisibleColumns(
  contactType: ContactTypeFilter,
  manualOverrides?: Partial<Record<CustomersSuppliersColumnKey, boolean>>
): Record<string, boolean> {
  const hidden = new Set(HIDDEN_BY_CONTACT_TYPE[contactType]);
  const out: Record<string, boolean> = {};
  for (const key of CUSTOMERS_SUPPLIERS_COLUMN_KEYS) {
    if (key === 'contact') {
      out[key] = true;
      continue;
    }
    if (manualOverrides && key in manualOverrides) {
      out[key] = manualOverrides[key] !== false;
    } else {
      out[key] = !hidden.has(key);
    }
  }
  return out;
}

export function filterCustomersSuppliersRows(
  rows: CustomersSuppliersReportRow[],
  search: string
): CustomersSuppliersReportRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.contactName.toLowerCase().includes(q));
}

export function sortCustomersSuppliersRows(
  rows: CustomersSuppliersReportRow[],
  sortKey: CustomersSuppliersSortKey,
  direction: SortDirection
): CustomersSuppliersReportRow[] {
  const sorted = [...rows];
  const mult = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (sortKey === 'contactName') {
      return mult * a.contactName.localeCompare(b.contactName);
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return 0;
    return mult * (av < bv ? -1 : 1);
  });

  return sorted;
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number
): { slice: T[]; totalPages: number; from: number; to: number; total: number } {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return { slice, totalPages, from, to, total };
}

export function sumCustomersSuppliersTotals(rows: CustomersSuppliersReportRow[]): CustomersSuppliersTotals {
  return rows.reduce(
    (acc, r) => ({
      totalPurchase: acc.totalPurchase + r.totalPurchase,
      totalPurchaseReturn: acc.totalPurchaseReturn + r.totalPurchaseReturn,
      totalSale: acc.totalSale + r.totalSale,
      totalSellReturn: acc.totalSellReturn + r.totalSellReturn,
      payment: acc.payment + r.payment,
      totalDiscount: acc.totalDiscount + r.totalDiscount,
      openingBalanceDue: acc.openingBalanceDue + r.openingBalanceDue,
      due: acc.due + r.due,
      advanceGl: acc.advanceGl + r.advanceGl,
    }),
    {
      totalPurchase: 0,
      totalPurchaseReturn: 0,
      totalSale: 0,
      totalSellReturn: 0,
      payment: 0,
      totalDiscount: 0,
      openingBalanceDue: 0,
      due: 0,
      advanceGl: 0,
    }
  );
}

export function visibleColumnKeysFromMap(
  visibleColumns: Record<string, boolean>
): CustomersSuppliersColumnKey[] {
  return CUSTOMERS_SUPPLIERS_COLUMN_KEYS.filter((k) => visibleColumns[k] !== false);
}
