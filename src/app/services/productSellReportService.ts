/**
 * Product Sell Report — line-level final sales for a period (SKU, customer, invoice, etc.).
 * Uses sales + sales_items (fallback sale_items) like accountingReportsService.
 */

import { supabase } from '@/lib/supabase';

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

function billNoFromSale(s: any): string {
  const o = String(s?.order_no ?? '').trim();
  if (o) return o;
  const inv = String(s?.invoice_no ?? '').trim();
  if (inv) return inv;
  const id = String(s?.id ?? '');
  return id.length >= 8 ? id.slice(0, 8) : id;
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

  let saleQuery = supabase
    .from('sales')
    .select(
      'id, invoice_no, order_no, invoice_date, customer_id, customer_name, contact_number, payment_method, subtotal, discount_amount, tax_amount, total, paid_amount, branch_id'
    )
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', start)
    .lte('invoice_date', end)
    .order('invoice_date', { ascending: false })
    .limit(MAX_SALES + 1);

  const uuid = /^[0-9a-f-]{36}$/i;
  if (branchId && branchId !== 'all' && uuid.test(String(branchId).trim())) {
    saleQuery = saleQuery.eq('branch_id', branchId.trim());
  }

  const { data: saleRowsRaw, error: saleErr } = await saleQuery;
  if (saleErr) {
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
  const contactById = new Map<string, { code?: string; email?: string; phone?: string; mobile?: string }>();
  for (const ids of chunk(customerIds, 120)) {
    if (ids.length === 0) continue;
    const { data: contacts } = await supabase.from('contacts').select('id, code, email, phone, mobile').in('id', ids);
    for (const c of contacts || []) {
      contactById.set((c as any).id, {
        code: (c as any).code,
        email: (c as any).email,
        phone: (c as any).phone,
        mobile: (c as any).mobile,
      });
    }
  }

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
      billNo: billNoFromSale(sale),
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
