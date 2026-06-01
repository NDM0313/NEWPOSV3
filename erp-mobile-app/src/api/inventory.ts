import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchInBatches } from '../lib/chunkInQuery';

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
  branchId?: string | null,
  options?: { accessibleBranchIds?: string[] },
): Promise<{ data: InventoryItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, min_stock, retail_price, cost_price, category_id, image_urls, has_variations, product_categories(name)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (productsError) return { data: [], error: productsError.message };
  if (!products?.length) return { data: [], error: null };

  const productIds = products.map((p: { id: string }) => p.id);
  let movements: { product_id: string; variation_id: string | null; quantity: number }[] = [];
  try {
    movements = await fetchInBatches(productIds, async (chunk) => {
      let movQ = supabase
        .from('stock_movements')
        .select('product_id, variation_id, quantity')
        .eq('company_id', companyId)
        .in('product_id', chunk);
      if (branchId && branchId !== 'all' && branchId !== 'default') {
        movQ = movQ.eq('branch_id', branchId);
      } else if (options?.accessibleBranchIds?.length) {
        movQ = movQ.in('branch_id', options.accessibleBranchIds);
      }
      const { data, error } = await movQ;
      if (error) throw error;
      return (data || []) as { product_id: string; variation_id: string | null; quantity: number }[];
    });
  } catch (e: unknown) {
    console.warn('[getInventory] stock_movements:', e instanceof Error ? e.message : String(e));
  }

  function stockMapFromMovements(
    rows: { product_id: string; variation_id: string | null; quantity: number }[]
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (const m of rows) {
      const key = m.variation_id ? `${m.product_id}_${m.variation_id}` : m.product_id;
      map[key] = (map[key] ?? 0) + (Number(m.quantity) || 0);
    }
    return map;
  }

  const stockByKey = stockMapFromMovements(movements);

  const withVariations = products.filter((r: { has_variations?: boolean }) => r.has_variations);
  const varProductIds = withVariations.map((r: { id: string }) => r.id);
  let varMap: Record<string, { id: string }[]> = {};
  if (varProductIds.length > 0) {
    let varData: { product_id: string; id: string }[] = [];
    try {
      varData = await fetchInBatches(varProductIds, async (chunk) => {
        const { data, error } = await supabase
          .from('product_variations')
          .select('id, product_id')
          .in('product_id', chunk)
          .eq('is_active', true);
        if (error) throw error;
        return (data || []) as { product_id: string; id: string }[];
      });
    } catch (e: unknown) {
      console.warn('[getInventory] product_variations:', e instanceof Error ? e.message : String(e));
    }
    for (const v of varData) {
      const pv = v as { product_id: string; id: string };
      if (!varMap[pv.product_id]) varMap[pv.product_id] = [];
      varMap[pv.product_id].push({ id: pv.id });
    }
  }

  const list: InventoryItem[] = products.map((r: Record<string, unknown>) => {
    const id = String(r.id ?? '');
    const hasVariations = r.has_variations === true;
    let stock: number;
    if (hasVariations) {
      const vars = varMap[id] ?? [];
      stock = vars.length > 0 ? vars.reduce((sum, v) => sum + (stockByKey[`${id}_${v.id}`] ?? 0), 0) : 0;
    } else {
      stock = stockByKey[id] ?? 0;
    }
    const minStock = Number(r.min_stock) ?? 0;
    const imgs = (r.image_urls as string[] | null) ?? [];
    const pc = r.product_categories as { name?: string } | { name?: string }[] | null | undefined;
    const categoryName = Array.isArray(pc) ? pc[0]?.name : pc?.name;
    return {
      id,
      sku: String(r.sku ?? '—'),
      name: String(r.name ?? '—'),
      stock,
      minStock,
      isLowStock: minStock > 0 && stock <= minStock,
      retailPrice: Number(r.retail_price) ?? 0,
      costPrice: Number(r.cost_price) ?? 0,
      category: categoryName ?? null,
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
  | 'opening'
  | 'production_in';

/** Lowercase movement_type from DB (e.g. SALE → sale, TRANSFER + qty sign → transfer_in/out). */
export function normalizeMovementType(raw: string, quantity?: number): StockMovementType {
  const t = String(raw || 'adjustment').trim().toLowerCase().replace(/-/g, '_');
  if (t === 'production_in' || t === 'production') return 'production_in';
  if (t === 'sell_return') return 'sale_return';
  if (t === 'transfer') {
    const q = Number(quantity ?? 0);
    return q < 0 ? 'transfer_out' : 'transfer_in';
  }
  const known: StockMovementType[] = [
    'purchase',
    'sale',
    'return',
    'sale_return',
    'purchase_return',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'opening',
    'production_in',
  ];
  return (known.includes(t as StockMovementType) ? t : 'adjustment') as StockMovementType;
}

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
  const studioProductionIds = new Set<string>();
  const branchIds = new Set<string>();
  for (const r of rows) {
    const rt = String(r.reference_type || '').toLowerCase();
    const rid = r.reference_id as string | null;
    if (!rid) continue;
    if (rt === 'studio_production') studioProductionIds.add(rid);
    else if (rt.includes('sale') && !rt.includes('return')) saleIds.add(rid);
    else if (rt.includes('purchase') && !rt.includes('return')) purchaseIds.add(rid);
    const bid = r.branch_id as string | null;
    if (bid) branchIds.add(bid);
  }

  const [salesMap, purchasesMap, studioMap, branchMap] = await Promise.all([
    fetchSaleRefs(saleIds),
    fetchPurchaseRefs(purchaseIds),
    fetchStudioProductionRefs(studioProductionIds),
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
      if (rt === 'studio_production' && studioMap[rid]) {
        refNo = studioMap[rid].refNo;
        partyName = studioMap[rid].partyName;
      } else if (rt.includes('sale') && !rt.includes('return') && salesMap[rid]) {
        refNo = salesMap[rid].invoiceNo;
        partyName = salesMap[rid].partyName;
      } else if (rt.includes('purchase') && !rt.includes('return') && purchasesMap[rid]) {
        refNo = purchasesMap[rid].invoiceNo;
        partyName = purchasesMap[rid].partyName;
      }
    }
    const bid = r.branch_id as string | null;
    const movementType = normalizeMovementType(String(r.movement_type ?? 'adjustment'), qty);
    return {
      id: String(r.id ?? ''),
      createdAt: String(r.created_at ?? ''),
      movementType,
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

export interface CreateStockTransferInput {
  companyId: string;
  productId: string;
  variationId?: string | null;
  fromBranchId: string;
  toBranchId: string;
  quantity: number;
  notes?: string | null;
  createdBy?: string | null;
  fromBranchName?: string | null;
  toBranchName?: string | null;
}

/** Branch-to-branch transfer: paired TRANSFER rows (negative at source, positive at destination). */
export async function createStockTransfer(
  input: CreateStockTransferInput,
): Promise<{ error: string | null; transferRefId?: string }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const {
    companyId,
    productId,
    variationId,
    fromBranchId,
    toBranchId,
    quantity,
    notes,
    createdBy,
    fromBranchName,
    toBranchName,
  } = input;

  const qty = Math.abs(Number(quantity));
  if (!companyId || !productId || !fromBranchId || !toBranchId) {
    return { error: 'Missing company, product, or branch.' };
  }
  if (qty <= 0) return { error: 'Quantity must be greater than zero.' };
  if (fromBranchId === toBranchId) {
    return { error: 'Source and destination branches must be different.' };
  }

  const stockKey = variationId ? `${productId}_${variationId}` : productId;
  const { fetchProductStockByKey } = await import('../utils/productStockFetch');
  const stockMap = await fetchProductStockByKey(
    companyId,
    [productId],
    [productId],
    variationId ? [productId] : [],
    fromBranchId,
  );
  const onHand = stockMap[stockKey] ?? stockMap[productId] ?? 0;
  if (qty > onHand) {
    return {
      error: `You cannot transfer more than available stock (on hand: ${onHand}).`,
    };
  }

  const transferRefId = crypto.randomUUID();
  const noteParts = [
    fromBranchName && toBranchName
      ? `Transfer: ${fromBranchName} → ${toBranchName}`
      : 'Branch transfer',
  ];
  if (notes?.trim()) noteParts.push(notes.trim());
  const noteText = noteParts.join(' — ');

  const base = {
    company_id: companyId,
    product_id: productId,
    variation_id: variationId ?? null,
    unit_cost: 0,
    total_cost: 0,
    reference_type: 'transfer',
    reference_id: transferRefId,
    notes: noteText,
    created_by: createdBy ?? null,
  };

  const { error: outErr } = await supabase.from('stock_movements').insert({
    ...base,
    branch_id: fromBranchId,
    movement_type: 'TRANSFER',
    quantity: -qty,
  });
  if (outErr) {
    const msg = outErr.message ?? 'Transfer failed.';
    if (/movement_type_check/i.test(msg)) {
      return { error: 'Stock transfer type is not enabled on the server. Contact your administrator.' };
    }
    return { error: msg };
  }

  const { error: inErr } = await supabase.from('stock_movements').insert({
    ...base,
    branch_id: toBranchId,
    movement_type: 'TRANSFER',
    quantity: qty,
  });
  if (inErr) {
    return {
      error: `Transfer in failed after stock left source branch. ${inErr.message} Review stock movements for reference ${transferRefId}.`,
      transferRefId,
    };
  }

  return { error: null, transferRefId };
}

async function fetchSaleRefs(
  ids: Set<string>
): Promise<Record<string, { invoiceNo: string; partyName: string | null }>> {
  if (!ids.size) return {};
  const { data } = await supabase
    .from('sales')
    .select('id, invoice_no, order_no, customer_name')
    .in('id', Array.from(ids));
  const map: Record<string, { invoiceNo: string; partyName: string | null }> = {};
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    const invoice = String(r.invoice_no ?? '').trim();
    const order = String(r.order_no ?? '').trim();
    const invoiceNo = invoice || order || '';
    const customer = String(r.customer_name ?? '').trim();
    map[String(r.id)] = {
      invoiceNo,
      partyName: customer || null,
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
    .select('id, po_no, supplier_name')
    .in('id', Array.from(ids));
  const map: Record<string, { invoiceNo: string; partyName: string | null }> = {};
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    const po = String(r.po_no ?? '').trim();
    const supplier = String(r.supplier_name ?? '').trim();
    map[String(r.id)] = {
      invoiceNo: po,
      partyName: supplier || null,
    };
  }
  return map;
}

async function fetchStudioProductionRefs(
  ids: Set<string>
): Promise<Record<string, { refNo: string; partyName: string | null }>> {
  if (!ids.size) return {};
  const { data: prodRows } = await supabase
    .from('studio_productions')
    .select('id, production_no, sale_id')
    .in('id', Array.from(ids));
  const saleIds = new Set<string>();
  for (const r of (prodRows || []) as Array<Record<string, unknown>>) {
    const sid = r.sale_id != null ? String(r.sale_id) : '';
    if (sid) saleIds.add(sid);
  }
  const salesMap = await fetchSaleRefs(saleIds);
  const map: Record<string, { refNo: string; partyName: string | null }> = {};
  for (const r of (prodRows || []) as Array<Record<string, unknown>>) {
    const id = String(r.id ?? '');
    const prodNo = String(r.production_no ?? '').trim();
    const saleId = r.sale_id != null ? String(r.sale_id) : '';
    const sale = saleId ? salesMap[saleId] : null;
    const saleInv = sale?.invoiceNo?.trim() ?? '';
    map[id] = {
      refNo: prodNo || saleInv || '',
      partyName: sale?.partyName ?? null,
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
