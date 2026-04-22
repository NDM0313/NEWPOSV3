import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  isLowStock: boolean;
  retailPrice: number;
  costPrice: number;
  category?: string | null;
  imageUrl?: string | null;
}

/** Stock from stock_movements (no current_stock column dependency). Optional branch = branch-scoped qty. */
export async function getInventory(
  companyId: string,
  branchId?: string | null
): Promise<{ data: InventoryItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, min_stock, retail_price, cost_price, category, image_urls')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (productsError) return { data: [], error: productsError.message };
  if (!products?.length) return { data: [], error: null };

  const productIds = products.map((p: { id: string }) => p.id);
  let movQ = supabase
    .from('stock_movements')
    .select('product_id, quantity')
    .eq('company_id', companyId)
    .in('product_id', productIds);
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    movQ = movQ.eq('branch_id', branchId);
  }
  const { data: movements } = await movQ;

  const stockByProductId: Record<string, number> = {};
  (movements || []).forEach((m: { product_id: string; quantity: number }) => {
    const id = m.product_id;
    stockByProductId[id] = (stockByProductId[id] ?? 0) + Number(m.quantity ?? 0);
  });

  const list: InventoryItem[] = products.map((r: Record<string, unknown>) => {
    const id = String(r.id ?? '');
    const stock = stockByProductId[id] ?? 0;
    const minStock = Number(r.min_stock) ?? 0;
    const imgs = (r.image_urls as string[] | null) ?? [];
    return {
      id,
      sku: String(r.sku ?? '—'),
      name: String(r.name ?? '—'),
      stock,
      minStock,
      isLowStock: minStock > 0 && stock <= minStock,
      retailPrice: Number(r.retail_price) ?? 0,
      costPrice: Number(r.cost_price) ?? 0,
      category: (r.category as string | null) ?? null,
      imageUrl: imgs[0] ?? null,
    };
  });
  return { data: list, error: null };
}

// ============================================================
// Product stock history (mirrors web's FullStockLedgerView source)
// ============================================================

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'return'
  | 'sale_return'
  | 'purchase_return'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'opening';

export interface StockMovementEntry {
  id: string;
  createdAt: string;
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  totalCost: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  partyName: string | null;
  branchId: string | null;
  branchName: string | null;
  notes: string | null;
  runningBalance: number;
}

export interface ProductHistoryOptions {
  branchId?: string | null;
  from?: string | null;
  to?: string | null;
  types?: StockMovementType[];
}

/** All movements for a product with running balance, party name, and reference number. */
export async function getProductStockMovements(
  companyId: string,
  productId: string,
  opts: ProductHistoryOptions = {}
): Promise<{ data: StockMovementEntry[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  let q = supabase
    .from('stock_movements')
    .select(
      'id, created_at, movement_type, quantity, unit_cost, total_cost, reference_type, reference_id, notes, branch_id'
    )
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (opts.branchId && opts.branchId !== 'all') q = q.eq('branch_id', opts.branchId);
  if (opts.from) q = q.gte('created_at', opts.from);
  if (opts.to) q = q.lte('created_at', opts.to);
  if (opts.types?.length) q = q.in('movement_type', opts.types);

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };

  const rows = (data || []) as Array<Record<string, unknown>>;
  const saleIds = new Set<string>();
  const purchaseIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const r of rows) {
    const rt = String(r.reference_type || '').toLowerCase();
    const rid = r.reference_id as string | null;
    if (!rid) continue;
    if (rt.includes('sale')) saleIds.add(rid);
    else if (rt.includes('purchase')) purchaseIds.add(rid);
    const bid = r.branch_id as string | null;
    if (bid) branchIds.add(bid);
  }

  const [salesMap, purchasesMap, branchMap] = await Promise.all([
    fetchSaleRefs(saleIds),
    fetchPurchaseRefs(purchaseIds),
    fetchBranches(branchIds),
  ]);

  let running = 0;
  const list: StockMovementEntry[] = rows.map((r) => {
    const qty = Number(r.quantity ?? 0);
    running += qty;
    const rid = r.reference_id as string | null;
    const rt = String(r.reference_type || '').toLowerCase();
    let refNo: string | null = null;
    let partyName: string | null = null;
    if (rid) {
      if (rt.includes('sale') && salesMap[rid]) {
        refNo = salesMap[rid].invoiceNo;
        partyName = salesMap[rid].partyName;
      } else if (rt.includes('purchase') && purchasesMap[rid]) {
        refNo = purchasesMap[rid].invoiceNo;
        partyName = purchasesMap[rid].partyName;
      }
    }
    const bid = r.branch_id as string | null;
    return {
      id: String(r.id ?? ''),
      createdAt: String(r.created_at ?? ''),
      movementType: String(r.movement_type ?? 'adjustment') as StockMovementType,
      quantity: qty,
      unitCost: Number(r.unit_cost ?? 0),
      totalCost: Number(r.total_cost ?? 0),
      referenceType: (r.reference_type as string | null) ?? null,
      referenceId: rid,
      referenceNumber: refNo,
      partyName,
      branchId: bid,
      branchName: bid ? branchMap[bid] ?? null : null,
      notes: (r.notes as string | null) ?? null,
      runningBalance: running,
    };
  });

  return { data: list, error: null };
}

export interface CreateStockAdjustmentInput {
  companyId: string;
  branchId?: string | null;
  productId: string;
  variationId?: string | null;
  quantityDelta: number;
  notes?: string | null;
  /** Prefer `users.id` (profile); falls back when missing. */
  createdBy?: string | null;
}

/** Insert adjustment movement (same semantics as web `productService.createStockMovement` / inventory dashboard). */
export async function createStockAdjustment(input: CreateStockAdjustmentInput): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const {
    companyId,
    productId,
    variationId,
    quantityDelta,
    notes,
    createdBy,
    branchId: branchIdIn,
  } = input;

  if (!companyId || !productId || !quantityDelta || quantityDelta === 0) {
    return { error: !quantityDelta ? 'Quantity cannot be zero.' : 'Missing company or product.' };
  }

  let branch_id =
    branchIdIn && branchIdIn !== 'all' && branchIdIn !== 'default' ? branchIdIn : null;
  if (!branch_id) {
    const { data: br } = await supabase.from('branches').select('id').eq('company_id', companyId).limit(1).maybeSingle();
    branch_id = br?.id ?? null;
  }

  const payload: Record<string, unknown> = {
    company_id: companyId,
    branch_id,
    product_id: productId,
    variation_id: variationId ?? null,
    movement_type: 'adjustment',
    quantity: quantityDelta,
    unit_cost: 0,
    total_cost: 0,
    reference_type: 'adjustment',
    reference_id: null,
    notes: notes ?? null,
    created_by: createdBy ?? null,
  };

  const { error } = await supabase.from('stock_movements').insert(payload);
  return { error: error?.message ?? null };
}

async function fetchSaleRefs(
  ids: Set<string>
): Promise<Record<string, { invoiceNo: string; partyName: string | null }>> {
  if (!ids.size) return {};
  const { data } = await supabase
    .from('sales')
    .select('id, invoice_no, customers(name)')
    .in('id', Array.from(ids));
  const map: Record<string, { invoiceNo: string; partyName: string | null }> = {};
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    const c = r.customers as { name?: string } | null;
    map[String(r.id)] = {
      invoiceNo: String(r.invoice_no ?? ''),
      partyName: c?.name ?? null,
    };
  }
  return map;
}

async function fetchPurchaseRefs(
  ids: Set<string>
): Promise<Record<string, { invoiceNo: string; partyName: string | null }>> {
  if (!ids.size) return {};
  const { data } = await supabase
    .from('purchases')
    .select('id, po_no, suppliers(name)')
    .in('id', Array.from(ids));
  const map: Record<string, { invoiceNo: string; partyName: string | null }> = {};
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    const s = r.suppliers as { name?: string } | null;
    map[String(r.id)] = {
      invoiceNo: String(r.po_no ?? ''),
      partyName: s?.name ?? null,
    };
  }
  return map;
}

async function fetchBranches(ids: Set<string>): Promise<Record<string, string>> {
  if (!ids.size) return {};
  const { data } = await supabase.from('branches').select('id, name').in('id', Array.from(ids));
  const map: Record<string, string> = {};
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    map[String(r.id)] = String(r.name ?? '');
  }
  return map;
}
