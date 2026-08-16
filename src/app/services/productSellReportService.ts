/**
 * Product Sell Report — line-level final sales for a period (SKU, customer, invoice, etc.).
 * Uses sales + sales_items (fallback sale_items) like accountingReportsService.
 */

import { supabase } from '@/lib/supabase';
import { readSaleBillRef } from '@/app/utils/saleBillRef';

const MAX_SALES = 4000;
const CHUNK = 180;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Load line rows without fragile nested selects (avoids PostgREST 400 on schema drift). */
async function fetchItemsForSaleIds(saleIds: string[]): Promise<any[]> {
  if (saleIds.length === 0) return [];
  const all: any[] = [];

  for (const ids of chunk(saleIds, CHUNK)) {
    const { data, error } = await supabase.from('sales_items').select('*').in('sale_id', ids);
    if (!error && data != null) {
      if (data.length) all.push(...data);
      continue;
    }
    if (error) {
      console.warn('[productSellReportService] sales_items * fallback to sale_items:', error.message || error);
    }
    const { data: legacy, error: legErr } = await supabase.from('sale_items').select('*').in('sale_id', ids);
    if (legErr) {
      console.warn('[productSellReportService] sale_items:', legErr.message || legErr);
      continue;
    }
    for (const row of legacy || []) {
      all.push({
        ...row,
        product_name: row.product_name ?? row.name,
        sku: row.sku ?? '',
        discount_amount: row.discount_amount ?? row.discount ?? 0,
        tax_amount: row.tax_amount ?? row.tax ?? 0,
        unit_price: row.unit_price ?? row.price,
      });
    }
  }

  const productIds = [...new Set(all.map((r) => r.product_id).filter(Boolean))] as string[];
  const productMap = await fetchProductsEnrichmentMap(productIds);
  return all.map((row) => ({
    ...row,
    product: productMap.get(String(row.product_id)) ?? null,
  }));
}

async function fetchProductsEnrichmentMap(productIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (productIds.length === 0) return map;

  for (const ids of chunk(productIds, 120)) {
    let { data, error } = await supabase
      .from('products')
      .select('id, name, sku, cost_price, cost, category_id, brand_id, category:product_categories(name)')
      .in('id', ids);

    if (error) {
      const r2 = await supabase
        .from('products')
        .select('id, name, sku, cost_price, cost, category_id, brand_id')
        .in('id', ids);
      data = r2.data;
      error = r2.error;
    }
    if (error || !data) continue;

    const categoryIds = [...new Set((data as any[]).map((p) => p.category_id).filter(Boolean))] as string[];
    const categoryNameById = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: cats, error: cErr } = await supabase
        .from('product_categories')
        .select('id, name')
        .in('id', categoryIds);
      if (!cErr && cats) {
        for (const c of cats) {
          categoryNameById.set(String((c as any).id), String((c as any).name || ''));
        }
      }
    }

    const brandIds = [...new Set((data as any[]).map((p) => p.brand_id).filter(Boolean))] as string[];
    const brandNameById = new Map<string, string>();
    if (brandIds.length > 0) {
      const { data: brands, error: bErr } = await supabase.from('brands').select('id, name').in('id', brandIds);
      if (!bErr && brands) {
        for (const b of brands) {
          brandNameById.set(String((b as any).id), String((b as any).name || ''));
        }
      }
    }

    for (const p of data as any[]) {
      const cid = p.category_id ? String(p.category_id) : '';
      const cname =
        (p.category && typeof p.category === 'object' && (p.category as any).name) ||
        (cid ? categoryNameById.get(cid) : '') ||
        '';
      const bid = p.brand_id ? String(p.brand_id) : '';
      const brandName = bid ? brandNameById.get(bid) || '' : '';
      map.set(String(p.id), {
        ...p,
        category: cname ? { name: cname } : null,
        brand: brandName ? { name: brandName } : null,
      });
    }
  }
  return map;
}

export type ProductSellReportLine = {
  rowKey: string;
  saleId: string;
  lineId: string;
  date: string;
  customerName: string;
  invoiceNo: string;
  billNo: string;
  branchName: string;
  salesmanName: string;
  sku: string;
  productName: string;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
  priceIncTaxPerUnit: number;
  paymentMethod: string;
  contactId: string;
  contactCode: string;
  contactNumber: string;
  contactEmail: string;
  categoryName: string;
  brandName: string;
  unitCost: number;
  lineCost: number;
  lineMargin: number;
};

export type ProductSellReportResult = {
  lines: ProductSellReportLine[];
  truncated: boolean;
  saleCount: number;
};

/** Normalize raw Supabase row so readSaleBillRef sees camelCase aliases like SalesContext. */
function normalizeSaleForBillRef(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    customerBillRef: raw.customer_bill_ref ?? raw.customerBillRef,
  };
}

/** Same bill ref logic as SalesPage notes/Bill column. */
function billNoFromSale(s: Record<string, unknown>): string {
  const normalized = normalizeSaleForBillRef(s);
  const ref = readSaleBillRef(normalized, {
    isStudio: !!(normalized.is_studio ?? normalized.is_studio_sale ?? normalized.isStudioSale),
  });
  if (ref) return ref;
  const orderNo = String(normalized.order_no ?? '').trim();
  if (orderNo) return orderNo;
  return '—';
}

async function fetchSalesmanNameMap(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;

  for (const batch of chunk(unique, 120)) {
    const { data: byId } = await supabase
      .from('users')
      .select('id, auth_user_id, full_name, email')
      .in('id', batch);
    for (const u of byId || []) {
      const name = String((u as any).full_name || (u as any).email || '').trim();
      if (!name) continue;
      if ((u as any).id) map.set(String((u as any).id), name);
      if ((u as any).auth_user_id) map.set(String((u as any).auth_user_id), name);
    }
    const missing = batch.filter((id) => !map.has(id));
    if (missing.length === 0) continue;
    const { data: byAuth } = await supabase
      .from('users')
      .select('id, auth_user_id, full_name, email')
      .in('auth_user_id', missing);
    for (const u of byAuth || []) {
      const name = String((u as any).full_name || (u as any).email || '').trim();
      if (!name) continue;
      if ((u as any).id) map.set(String((u as any).id), name);
      if ((u as any).auth_user_id) map.set(String((u as any).auth_user_id), name);
    }
  }
  return map;
}

async function fetchBranchNameMap(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  for (const batch of chunk(unique, 120)) {
    const { data } = await supabase.from('branches').select('id, name').in('id', batch);
    for (const b of data || []) {
      map.set(String((b as any).id), String((b as any).name || '—'));
    }
  }
  return map;
}

function qtyDisplay(qty: number, unit?: string | null, row?: any): string {
  const u = (unit || row?.packing_unit || row?.packing_type || '').toString().trim();
  const n = Number(qty) || 0;
  const s = n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return u ? `${s} ${u}` : s;
}

export async function fetchProductSellReport(
  companyId: string,
  startDate: string,
  endDate: string,
  branchId?: string | null
): Promise<ProductSellReportResult> {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);

  const baseSaleFields =
    'id, invoice_no, order_no, invoice_date, customer_id, customer_name, contact_number, payment_method, subtotal, discount_amount, tax_amount, total, paid_amount, branch_id, salesman_id';
  const selectAttempts = [
    `${baseSaleFields}, customer_bill_ref, notes, reference, ref_no, bill_ref, is_studio, is_studio_sale`,
    `${baseSaleFields}, customer_bill_ref, notes, is_studio, is_studio_sale`,
    `${baseSaleFields}, customer_bill_ref, notes`,
    `${baseSaleFields}, notes`,
    '*',
  ];

  async function runSaleQuery(fields: string) {
    let q = supabase
      .from('sales')
      .select(fields)
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('invoice_date', start)
      .lte('invoice_date', end)
      .order('invoice_date', { ascending: false })
      .limit(MAX_SALES + 1);
    const uuid = /^[0-9a-f-]{36}$/i;
    if (branchId && branchId !== 'all' && uuid.test(String(branchId).trim())) {
      q = q.eq('branch_id', branchId.trim());
    }
    return q;
  }

  let saleRowsRaw: any[] | null = null;
  let saleErr: { message?: string } | null = null;
  for (const fields of selectAttempts) {
    const result = await runSaleQuery(fields);
    if (!result.error) {
      saleRowsRaw = result.data;
      saleErr = null;
      break;
    }
    saleErr = result.error;
    console.warn('[productSellReportService] sales select fallback:', fields, result.error.message || result.error);
  }
  if (saleErr || !saleRowsRaw) {
    console.error('[productSellReportService] sales:', saleErr);
    return { lines: [], truncated: false, saleCount: 0 };
  }

  const saleRows = (saleRowsRaw || []).slice(0, MAX_SALES);
  const truncated = (saleRowsRaw || []).length > MAX_SALES;
  if (saleRows.length === 0) {
    return { lines: [], truncated, saleCount: 0 };
  }

  const saleById = new Map<string, any>();
  saleRows.forEach((s: any) => saleById.set(s.id, s));
  const saleIds = saleRows.map((s: any) => s.id);

  const customerIds = [...new Set(saleRows.map((s: any) => s.customer_id).filter(Boolean))] as string[];
  const branchIds = saleRows.map((s: any) => s.branch_id).filter(Boolean) as string[];
  const salesmanIds = saleRows.map((s: any) => s.salesman_id).filter(Boolean) as string[];

  const [contactById, branchNameById, salesmanNameById] = await Promise.all([
    (async () => {
      const map = new Map<string, { code?: string; email?: string; phone?: string; mobile?: string }>();
      for (const ids of chunk(customerIds, 120)) {
        if (ids.length === 0) continue;
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, code, email, phone, mobile')
          .in('id', ids);
        for (const c of contacts || []) {
          map.set((c as any).id, {
            code: (c as any).code,
            email: (c as any).email,
            phone: (c as any).phone,
            mobile: (c as any).mobile,
          });
        }
      }
      return map;
    })(),
    fetchBranchNameMap(branchIds),
    fetchSalesmanNameMap(salesmanIds),
  ]);

  const itemRows = await fetchItemsForSaleIds(saleIds);
  const lines: ProductSellReportLine[] = [];

  for (const it of itemRows) {
    const sale = saleById.get(it.sale_id);
    if (!sale) continue;

    const qty = Number(it.quantity ?? it.qty) || 0;
    const unitPrice = Number(it.unit_price ?? it.price) || 0;
    const lineDiscount = Number(it.discount_amount ?? it.discount) || 0;
    const lineTax = Number(it.tax_amount ?? it.tax) || 0;
    let lineTotal = Number(it.total) || 0;
    if (!lineTotal && qty && unitPrice) {
      lineTotal = Math.round((qty * unitPrice - lineDiscount + lineTax) * 100) / 100;
    }

    const prod = it.product;
    const unitCost = Number(prod?.cost_price ?? prod?.cost) || 0;
    const lineCost = Math.round(unitCost * qty * 100) / 100;
    const lineMargin = Math.round((lineTotal - lineCost) * 100) / 100;
    const priceIncTaxPerUnit =
      qty > 0 ? Math.round((unitPrice + lineTax / qty) * 100) / 100 : unitPrice;

    const catName =
      prod?.category && typeof prod.category === 'object'
        ? String((prod.category as any).name || '')
        : '';
    const brandName =
      prod?.brand && typeof prod.brand === 'object' ? String((prod.brand as any).name || '') : '';

    const cid = String(sale.customer_id || '');
    const cmeta = cid ? contactById.get(cid) : undefined;
    const phone = String(sale.contact_number || cmeta?.phone || cmeta?.mobile || '').trim();

    lines.push({
      rowKey: `${it.sale_id}-${it.id}`,
      saleId: it.sale_id,
      lineId: String(it.id),
      date: String(sale.invoice_date || '').slice(0, 10),
      customerName: String(sale.customer_name || '—'),
      invoiceNo: String(sale.invoice_no || '—'),
      billNo: billNoFromSale(sale as Record<string, unknown>),
      branchName: sale.branch_id
        ? branchNameById.get(String(sale.branch_id)) || '—'
        : '—',
      salesmanName: sale.salesman_id
        ? salesmanNameById.get(String(sale.salesman_id)) || '—'
        : '—',
      sku: String(it.sku || prod?.sku || '—'),
      productName: String(it.product_name || it.name || prod?.name || '—'),
      quantity: qty,
      unitLabel: qtyDisplay(qty, it.unit, it),
      unitPrice,
      lineDiscount,
      lineTax,
      lineTotal,
      priceIncTaxPerUnit,
      paymentMethod: String(sale.payment_method || '—').replace(/_/g, ' '),
      contactId: cid,
      contactCode: String(cmeta?.code || '—'),
      contactNumber: phone || '—',
      contactEmail: String(cmeta?.email || '').trim() || '—',
      categoryName: catName || '—',
      brandName: brandName || '—',
      unitCost,
      lineCost,
      lineMargin,
    });
  }

  lines.sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return a.invoiceNo.localeCompare(b.invoiceNo);
  });

  return { lines, truncated, saleCount: saleRows.length };
}
