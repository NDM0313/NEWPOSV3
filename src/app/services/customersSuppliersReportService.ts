/**
 * Customers & Suppliers operational summary report.
 * Data source: get_customers_suppliers_report RPC (period document totals + period-end due).
 */

import { supabase } from '@/lib/supabase';
import type { ExportData } from '@/app/utils/exportUtils';
import type { BalanceStatus, ContactTypeFilter } from '@/app/lib/customersSuppliersReportLogic';

export type CustomersSuppliersContactType = 'customer' | 'supplier' | 'both' | 'worker';

export type CustomersSuppliersReportRow = {
  contactId: string;
  contactName: string;
  contactType: CustomersSuppliersContactType;
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

export type CustomersSuppliersReportParams = {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  contactType?: ContactTypeFilter;
  balanceStatus?: BalanceStatus;
};

export type CustomersSuppliersReportResult = {
  rows: CustomersSuppliersReportRow[];
  error: string | null;
  source: 'rpc';
};

export const CUSTOMERS_SUPPLIERS_COLUMN_KEYS = [
  'contact',
  'totalPurchase',
  'totalPurchaseReturn',
  'totalSale',
  'totalSellReturn',
  'payment',
  'totalDiscount',
  'openingBalanceDue',
  'due',
  'advanceGl',
] as const;

export type CustomersSuppliersColumnKey = (typeof CUSTOMERS_SUPPLIERS_COLUMN_KEYS)[number];

export const CUSTOMERS_SUPPLIERS_COLUMN_LABELS: Record<CustomersSuppliersColumnKey, string> = {
  contact: 'Contact',
  totalPurchase: 'Total Purchase',
  totalPurchaseReturn: 'Total Purchase Return',
  totalSale: 'Total Sale',
  totalSellReturn: 'Total Sell Return',
  payment: 'Payment',
  totalDiscount: 'Total Discount',
  openingBalanceDue: 'Opening Balance Due',
  due: 'Due (GL)',
  advanceGl: 'Advance (GL)',
};

function safeBranchUuid(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all') return null;
  const u = String(branchId).trim();
  return /^[0-9a-f-]{36}$/i.test(u) ? u : null;
}

type RpcRow = {
  contact_id: string;
  contact_name: string;
  contact_type: string;
  total_purchase: number | string | null;
  total_purchase_return: number | string | null;
  total_sale: number | string | null;
  total_sell_return: number | string | null;
  payment: number | string | null;
  total_discount: number | string | null;
  opening_balance_due: number | string | null;
  due: number | string | null;
  advance_gl: number | string | null;
};

function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRpcRow(row: RpcRow): CustomersSuppliersReportRow {
  const t = String(row.contact_type || 'customer') as CustomersSuppliersContactType;
  return {
    contactId: String(row.contact_id),
    contactName: String(row.contact_name || row.contact_id),
    contactType: t,
    totalPurchase: num(row.total_purchase),
    totalPurchaseReturn: num(row.total_purchase_return),
    totalSale: num(row.total_sale),
    totalSellReturn: num(row.total_sell_return),
    payment: num(row.payment),
    totalDiscount: num(row.total_discount),
    openingBalanceDue: num(row.opening_balance_due),
    due: num(row.due),
    advanceGl: num(row.advance_gl),
  };
}

export async function loadCustomersSuppliersReport(
  params: CustomersSuppliersReportParams
): Promise<CustomersSuppliersReportResult> {
  if (!params.companyId) {
    return { rows: [], error: null, source: 'rpc' };
  }

  const { data, error } = await supabase.rpc('get_customers_suppliers_report', {
    p_company_id: params.companyId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_branch_id: safeBranchUuid(params.branchId),
    p_contact_type: params.contactType ?? 'both',
    p_balance_status: params.balanceStatus ?? 'all',
  });

  if (error) {
    return { rows: [], error: error.message, source: 'rpc' };
  }

  const rows = ((data as RpcRow[] | null) ?? []).map(mapRpcRow);
  return { rows, error: null, source: 'rpc' };
}

export function rowsToExportData(
  rows: CustomersSuppliersReportRow[],
  visibleColumnKeys: CustomersSuppliersColumnKey[],
  formatCurrency: (n: number) => string,
  useRawNumbers = false
): ExportData {
  const headers = visibleColumnKeys.map((k) => CUSTOMERS_SUPPLIERS_COLUMN_LABELS[k]);

  const exportRows = rows.map((r) =>
    visibleColumnKeys.map((k) => {
      if (k === 'contact') return r.contactName;
      const val = r[k as keyof CustomersSuppliersReportRow];
      if (typeof val === 'number') {
        return useRawNumbers ? val : formatCurrency(val);
      }
      return String(val);
    })
  );

  return {
    title: 'Customers & Suppliers Report',
    headers,
    rows: exportRows,
  };
}
