import { supabase } from '@/lib/supabase';
import { getDocumentConversionSchemaFlags } from '@/app/lib/documentConversionSchema';
import { canPostAccountingForPurchaseStatus, wasPurchasePostedForReversal } from '@/app/lib/postingStatusGate';
import { activityLogService } from '@/app/services/activityLogService';
import { createSupplierPayment } from '@/app/services/supplierPaymentService';
import { PURCHASE_HEADER_COLUMNS } from '@/app/lib/purchaseDbConstants';
import { postPurchaseDocumentAccounting, reversePurchaseDocumentAccounting } from '@/app/services/documentPostingEngine';
import { documentNumberService } from '@/app/services/documentNumberService';

function purchaseRowNeedsPostedPoAllocation(row: Record<string, unknown>): boolean {
  const po = String(row.po_no ?? '').trim();
  if (!po) return true;
  return /^(PDR-|POR-)/i.test(po);
}

/** Allocate PUR po_no when purchase becomes posted if missing or still PDR/POR in po_no. */
async function ensurePostedPurchasePoNoAllocated(purchaseId: string, row: Record<string, unknown>) {
  if (!purchaseRowNeedsPostedPoAllocation(row)) return row;
  const companyId = String(row.company_id ?? '');
  if (!companyId) throw new Error('Cannot post purchase: company_id missing.');
  let nextNo: string;
  try {
    nextNo = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'PUR');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot post purchase: could not allocate PO number (PUR). ${msg}`);
  }
  const { data: patched, error } = await supabase
    .from('purchases')
    .update({ po_no: nextNo })
    .eq('id', purchaseId)
    .select(PURCHASE_HEADER_COLUMNS)
    .single();
  if (error) throw new Error(`Cannot post purchase: failed to save po_no: ${error.message}`);
  return (patched ?? { ...row, po_no: nextNo }) as Record<string, unknown>;
}

/** Enrich purchases with creator full_name. purchases.created_by = auth.users.id; resolve via users.auth_user_id. */
async function enrichPurchasesWithCreatorNames(purchases: any[]): Promise<void> {
  const ids = [...new Set((purchases || []).map((p: any) => p.created_by).filter(Boolean))] as string[];
  if (ids.length === 0) return;
  const nameByCreatedBy = new Map<string, string>();
  const { data: usersByAuth } = await supabase.from('users').select('auth_user_id, full_name, email').in('auth_user_id', ids);
  (usersByAuth || []).forEach((u: any) => {
    if (u?.auth_user_id) nameByCreatedBy.set(u.auth_user_id, u.full_name || u.email || '');
  });
  const missing = ids.filter((id) => !nameByCreatedBy.has(id));
  if (missing.length > 0) {
    const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
    (usersById || []).forEach((u: any) => {
      if (u?.id) nameByCreatedBy.set(u.id, u.full_name || u.email || '');
    });
  }
  purchases.forEach((p: any) => {
    const uid = p.created_by;
    if (uid && typeof uid === 'string') {
      const name = nameByCreatedBy.get(uid) || null;
      p.created_by_user = { full_name: name, email: null };
    }
  });
}

export interface Purchase {
  id?: string;
  company_id: string;
  branch_id: string;
  po_no?: string | null;
  /** Same-row lifecycle: draft stage number; po_no is final-only. */
  draft_no?: string | null;
  order_no?: string | null;
  po_date: string;
  supplier_id?: string;
  supplier_name: string;
  status: 'draft' | 'ordered' | 'received' | 'final' | 'cancelled'; // Database enum values only
  payment_status: 'paid' | 'partial' | 'unpaid';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_cost: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  notes?: string;
  attachments?: { url: string; name: string }[] | null;
  created_by: string;
}

export interface PurchaseItem {
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string; // Required in DB
  quantity: number;
  unit?: string;
  unit_price: number;
  /** Only discount_amount is stored in DB; percentage is UI-only. */
  discount_amount?: number;
  tax_amount?: number;
  total: number;
  // Packing fields
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB
  notes?: string;
}

/** One row per charge (freight, loading, discount, etc.) for audit-ready ledger. */
export interface PurchaseChargeInsert {
  charge_type: string;
  amount: number;
  ledger_account_id?: string | null;
}

/** Allowed columns for purchases insert. DB has discount_amount only (no discount_percentage). */
const PURCHASE_INSERT_KEYS = [
  'company_id', 'branch_id', 'po_no', 'draft_no', 'order_no', 'po_date', 'supplier_id', 'supplier_name',
  'status', 'payment_status', 'subtotal', 'discount_amount', 'tax_amount', 'shipping_cost',
  'total', 'paid_amount', 'due_amount', 'notes', 'attachments', 'created_by',
] as const;

function pickPurchaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PURCHASE_INSERT_KEYS) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

/** Build purchase row for insert. Only discount_amount is stored; percentage is UI-only and never sent. */
function buildPurchaseInsertRow(purchase: Purchase): Record<string, unknown> {
  const discountAmount = Number((purchase as any).discount_amount ?? (purchase as any).discount ?? 0) || 0;
  const posted = canPostAccountingForPurchaseStatus(purchase.status);
  return pickPurchaseRow({
    company_id: purchase.company_id,
    branch_id: purchase.branch_id,
    po_no: posted ? purchase.po_no ?? null : null,
    draft_no: purchase.draft_no ?? null,
    order_no: purchase.order_no ?? null,
    po_date: purchase.po_date,
    supplier_id: purchase.supplier_id ?? null,
    supplier_name: purchase.supplier_name,
    status: purchase.status,
    payment_status: purchase.payment_status,
    subtotal: purchase.subtotal ?? 0,
    discount_amount: discountAmount,
    tax_amount: purchase.tax_amount ?? 0,
    shipping_cost: purchase.shipping_cost ?? 0,
    total: purchase.total ?? 0,
    paid_amount: purchase.paid_amount ?? 0,
    due_amount: purchase.due_amount ?? 0,
    notes: purchase.notes ?? null,
    attachments: purchase.attachments ?? null,
    created_by: purchase.created_by,
  });
}

/** Allowed columns for purchase_items insert (DB has no discount_percentage/tax_percentage). */
const PURCHASE_ITEM_INSERT_KEYS = [
  'purchase_id', 'product_id', 'variation_id', 'product_name', 'sku', 'quantity', 'unit',
  'unit_price', 'discount_amount', 'tax_amount', 'total',
  'packing_type', 'packing_quantity', 'packing_unit', 'packing_details', 'notes',
] as const;

function pickPurchaseItemRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PURCHASE_ITEM_INSERT_KEYS) {
    if (row[k] !== undefined) out[k] = row[k];
  }
  return out;
}

/** Build purchase_items row (full schema: discount_amount, tax_amount, sku, unit). No discount_percentage/tax_percentage. */
function buildPurchaseItemInsertRow(item: PurchaseItem, purchaseId: string): Record<string, unknown> {
  const discountVal = Number(item.discount_amount ?? (item as any).discount ?? 0) || 0;
  const taxVal = Number(item.tax_amount ?? (item as any).tax ?? 0) || 0;
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unit_price) || 0;
  const total = Number(item.total) || 0;
  return pickPurchaseItemRow({
    purchase_id: purchaseId,
    product_id: String(item.product_id || '').trim() || null,
    variation_id: item.variation_id ?? null,
    product_name: String(item.product_name || '').trim() || 'Unknown',
    sku: item.sku ?? 'N/A',
    quantity,
    unit: item.unit ?? 'pcs',
    unit_price: unitPrice,
    discount_amount: discountVal,
    tax_amount: taxVal,
    total,
    packing_type: item.packing_type ?? null,
    packing_quantity: item.packing_quantity != null ? Number(item.packing_quantity) : null,
    packing_unit: item.packing_unit ?? null,
    packing_details: item.packing_details != null ? item.packing_details : null,
    notes: item.notes ?? null,
  });
}

/** Build purchase_items row for older schema (discount, tax; no sku, unit). Use when full schema insert returns 400. */
function buildPurchaseItemInsertRowMinimal(item: PurchaseItem, purchaseId: string): Record<string, unknown> {
  const discountVal = Number(item.discount_amount ?? (item as any).discount ?? 0) || 0;
  const taxVal = Number(item.tax_amount ?? (item as any).tax ?? 0) || 0;
  return {
    purchase_id: purchaseId,
    product_id: String(item.product_id || '').trim() || null,
    variation_id: item.variation_id ?? null,
    product_name: String(item.product_name || '').trim() || 'Unknown',
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    discount: discountVal,
    tax: taxVal,
    total: Number(item.total) || 0,
    packing_type: item.packing_type ?? null,
    packing_quantity: item.packing_quantity != null ? Number(item.packing_quantity) : null,
    packing_unit: item.packing_unit ?? null,
    packing_details: item.packing_details != null ? item.packing_details : null,
    notes: item.notes ?? null,
  };
}

export const purchaseService = {
  // Create purchase with items and optional per-line charges (for line-by-line ledger)
  async createPurchase(
    purchase: Purchase,
    items: PurchaseItem[],
    charges?: PurchaseChargeInsert[],
    _options?: Record<string, never>
  ) {
    const purchaseRow = buildPurchaseInsertRow(purchase);

    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchaseRow)
      .select('*')
      .single();

    if (purchaseError) {
      console.error('[PURCHASE SERVICE] Error creating purchase:', purchaseError);
      throw purchaseError;
    }

    const itemsWithPurchaseId = items.map(item => buildPurchaseItemInsertRow(item, purchaseData.id));

    let itemsError: any = null;
    let res = await supabase.from('purchase_items').insert(itemsWithPurchaseId);
    itemsError = res.error;

    // If 400 (e.g. column does not exist), retry with minimal schema (discount/tax, no sku/unit)
    if (itemsError && (itemsError.code === '400' || itemsError.status === 400)) {
      const minimalItems = items.map(item => buildPurchaseItemInsertRowMinimal(item, purchaseData.id));
      res = await supabase.from('purchase_items').insert(minimalItems);
      itemsError = res.error;
    }

    if (itemsError) {
      await supabase.from('purchases').delete().eq('id', purchaseData.id);
      throw itemsError;
    }

    // Insert purchase_charges (one row per extra expense / discount) for line-by-line accounting
    if (charges && charges.length > 0) {
      const chargeRows = charges
        .filter((c) => c.amount > 0)
        .map((c) => ({
          purchase_id: purchaseData.id,
          charge_type: c.charge_type,
          ledger_account_id: c.ledger_account_id ?? null,
          amount: Number(c.amount),
          created_by: purchase.created_by ?? null,
        }));
      if (chargeRows.length > 0) {
        const { error: chargesError } = await supabase.from('purchase_charges').insert(chargeRows);
        if (chargesError) {
          console.warn('[PURCHASE SERVICE] purchase_charges insert failed (table may not exist):', chargesError);
          // Do not rollback purchase; header/items are saved. Accounting can use header totals as fallback.
        }
      }
    }

    return purchaseData;
  },

  // Get all purchases (no created_by_user:users join – production DB may have no FK purchases→users; PGRST200)
  async getAllPurchases(
    companyId: string,
    branchId?: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<any[] | { data: any[]; total: number }> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const purchaseSelect = `
        *,
        supplier:contacts(name, phone),
        branch:branches(id, name, code),
        items:purchase_items(
          *,
          product:products(name)
        )
      `;
    const schemaFlags = await getDocumentConversionSchemaFlags();
    const runPurchList = (hideConverted: boolean) => {
      let q = supabase
        .from('purchases')
        .select(purchaseSelect, opts ? { count: 'exact' } : undefined)
        .eq('company_id', companyId)
        .order('po_date', { ascending: false });
      if (hideConverted && schemaFlags.purchasesConvertedColumn) q = q.eq('converted', false);
      if (branchId) q = q.eq('branch_id', branchId);
      if (opts) q = q.range(offset, offset + limit - 1);
      return q;
    };

    let { data, error, count } = await runPurchList(true);
    if (error && schemaFlags.purchasesConvertedColumn) {
      const retry = await runPurchList(false);
      if (!retry.error) {
        data = retry.data;
        error = retry.error;
        count = retry.count;
      }
    }

    if (error && opts) throw error;

    // If error is about po_date column not existing, retry with created_at
    if (error && error.code === '42703' && error.message?.includes('po_date')) {
      const retryQuery = supabase
        .from('purchases')
        .select(`
          *,
          supplier:contacts(name, phone),
          branch:branches(id, name, code),
          items:purchase_items(
            *,
            product:products(name)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (branchId) {
        retryQuery.eq('branch_id', branchId);
      }
      
      const { data: retryData, error: retryError } = await retryQuery;
      if (!retryError && retryData?.length) await enrichPurchasesWithCreatorNames(retryData);
      if (retryError) {
        // If created_at also doesn't exist, try without ordering
        const finalQuery = supabase
          .from('purchases')
        .select(`
          *,
          supplier:contacts(name, phone),
          branch:branches(id, name, code),
          items:purchase_items(
            *,
            product:products(name)
          )
        `);
        
        if (branchId) {
          finalQuery.eq('branch_id', branchId);
        }
        
        const { data: finalData, error: finalError } = await finalQuery;
        if (finalError) throw finalError;
        if (finalData?.length) await enrichPurchasesWithCreatorNames(finalData);
        return finalData;
      }
      return retryData;
    }
    
    // If error is about foreign key relationship or other issues, try without nested selects
    if (error && (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST116')) {
      // Try simpler query without nested relationships
      let simpleQuery = supabase
        .from('purchases')
        .select(`
          *
        `)
        .order('created_at', { ascending: false });
      
      if (branchId) {
        simpleQuery = simpleQuery.eq('branch_id', branchId);
      }
      
      const { data: simpleData, error: simpleError } = await simpleQuery;
      
      // If created_at doesn't exist, try without ordering
      if (simpleError && simpleError.code === '42703' && simpleError.message?.includes('created_at')) {
        let noOrderQuery = supabase
          .from('purchases')
          .select(`
            *
          `);
        
        if (branchId) {
          noOrderQuery = noOrderQuery.eq('branch_id', branchId);
        }
        
        const { data: noOrderData, error: noOrderError } = await noOrderQuery;
        if (noOrderError) throw noOrderError;
        if (noOrderData?.length) await enrichPurchasesWithCreatorNames(noOrderData);
        return noOrderData;
      }
      
      if (simpleError) throw simpleError;
      if (simpleData?.length) await enrichPurchasesWithCreatorNames(simpleData);
      return simpleData;
    }
    
    if (error) throw error;

    await enrichPurchasesWithCreatorNames(data || []);

    // 🔒 LOCK CHECK: Add hasReturn and returnCount to each purchase
    if (data && data.length > 0) {
      const purchaseIds = data.map((p: any) => p.id);
      const { data: allReturns } = await supabase
        .from('purchase_returns')
        .select('original_purchase_id')
        .in('original_purchase_id', purchaseIds)
        .eq('status', 'final');
      
      const returnsMap = new Map<string, number>();
      (allReturns || []).forEach((r: any) => {
        const count = returnsMap.get(r.original_purchase_id) || 0;
        returnsMap.set(r.original_purchase_id, count + 1);
      });
      
      data.forEach((purchase: any) => {
        purchase.hasReturn = returnsMap.has(purchase.id);
        purchase.returnCount = returnsMap.get(purchase.id) || 0;
      });
    }

    if (opts) return { data: data || [], total: count ?? 0 };
    return data;
  },

  // Get single purchase (include attachments + purchase_charges for line-level extra expenses on edit)
  // Use explicit column lists for product/variation to avoid requesting current_stock (column may not exist).
  /** When embeds fail (PGRST204/400) or `*, attachments` duplicate broke PostgREST, load header + related rows separately. */
  async getPurchaseSplit(id: string): Promise<any> {
    const [{ data: header, error: hErr }, attRes] = await Promise.all([
      supabase.from('purchases').select(PURCHASE_HEADER_COLUMNS).eq('id', id).single(),
      supabase.from('purchases').select('attachments').eq('id', id).maybeSingle(),
    ]);
    if (hErr) throw hErr;
    const attachments =
      !attRes.error && attRes.data ? ((attRes.data as { attachments?: unknown }).attachments ?? null) : null;

    const supplierId = (header as any)?.supplier_id as string | null | undefined;
    const [{ data: itemsRaw }, chargesRes, supplierRes] = await Promise.all([
      supabase.from('purchase_items').select('*').eq('purchase_id', id),
      supabase.from('purchase_charges').select('*').eq('purchase_id', id),
      supplierId
        ? supabase.from('contacts').select('id, name, phone').eq('id', supplierId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const charges = chargesRes.error ? [] : chargesRes.data || [];

    const itemsList = itemsRaw || [];
    const productIds = [...new Set(itemsList.map((r: any) => r.product_id).filter(Boolean))] as string[];
    const variationIds = [...new Set(itemsList.map((r: any) => r.variation_id).filter(Boolean))] as string[];

    let productsById: Record<string, any> = {};
    if (productIds.length > 0) {
      const prodsRes = await supabase
        .from('products')
        .select('id, name, sku, cost_price, has_variations, unit_id, category_id, min_stock, max_stock')
        .in('id', productIds);
      if (!prodsRes.error && prodsRes.data) {
        (prodsRes.data as any[]).forEach((p: any) => {
          if (p?.id) productsById[p.id] = p;
        });
      } else {
        const minimal = await supabase.from('products').select('id, name, sku').in('id', productIds);
        (minimal.data || []).forEach((p: any) => {
          if (p?.id) productsById[p.id] = p;
        });
      }
    }

    let varsById: Record<string, any> = {};
    if (variationIds.length > 0) {
      const { data: vars } = await supabase
        .from('product_variations')
        .select('id, product_id, sku, attributes')
        .in('id', variationIds);
      (vars || []).forEach((v: any) => {
        if (v?.id) varsById[v.id] = v;
      });
    }

    const items = itemsList.map((row: any) => ({
      ...row,
      product: row.product_id ? productsById[row.product_id] ?? null : null,
      variation: row.variation_id ? varsById[row.variation_id] ?? null : null,
    }));

    const data: any = {
      ...(header as any),
      attachments,
      supplier: supplierRes?.data ?? null,
      items,
      purchase_charges: charges || [],
    };

    const { data: returns } = await supabase
      .from('purchase_returns')
      .select('id')
      .eq('original_purchase_id', id)
      .eq('status', 'final')
      .limit(1);

    data.hasReturn = (returns && returns.length > 0) || false;
    data.returnCount = returns?.length || 0;
    data.charges = Array.isArray(data.purchase_charges) ? data.purchase_charges : [];

    return data;
  },

  async getPurchase(id: string) {
    // NOTE: Do not list `attachments` after `*` — duplicate field in select often yields PostgREST 400 (`select=*` requests).
    const embeddedSelect = `
        *,
        supplier:contacts(id, name, phone),
        items:purchase_items(
          *,
          product:products(id, name, sku, cost_price, has_variations, unit_id, category_id, min_stock, max_stock),
          variation:product_variations(id, product_id, sku, attributes)
        ),
        purchase_charges(*)
      `;

    const { data, error } = await supabase.from('purchases').select(embeddedSelect).eq('id', id).single();

    if (error) {
      const code = (error as any).code;
      const msg = String((error as any).message || '');
      const retry =
        code === 'PGRST200' ||
        code === 'PGRST204' ||
        code === '42703' ||
        (error as any).status === 400 ||
        msg.toLowerCase().includes('column') ||
        msg.toLowerCase().includes('relationship');
      console.warn('[PURCHASE SERVICE] getPurchase embedded failed; retrying split fetch:', error);
      if (retry) {
        return this.getPurchaseSplit(id);
      }
      throw error;
    }

    // 🔒 LOCK CHECK: Check if purchase has returns (prevents editing)
    const { data: returns } = await supabase
      .from('purchase_returns')
      .select('id')
      .eq('original_purchase_id', id)
      .eq('status', 'final')
      .limit(1);

    if (data) {
      (data as any).hasReturn = (returns && returns.length > 0) || false;
      (data as any).returnCount = returns?.length || 0;
      (data as any).charges = Array.isArray((data as any).purchase_charges) ? (data as any).purchase_charges : [];
    }

    return data;
  },

  /** Replace all purchase_charges for a purchase (delete existing + insert). Used on edit to persist line-level expenses. */
  async replacePurchaseCharges(purchaseId: string, charges: PurchaseChargeInsert[], createdBy?: string | null) {
    const { error: delError } = await supabase
      .from('purchase_charges')
      .delete()
      .eq('purchase_id', purchaseId);
    if (delError) {
      console.warn('[PURCHASE SERVICE] replacePurchaseCharges delete failed:', delError);
      throw delError;
    }
    const chargeRows = (charges || [])
      .filter((c) => c.amount > 0)
      .map((c) => ({
        purchase_id: purchaseId,
        charge_type: c.charge_type,
        ledger_account_id: c.ledger_account_id ?? null,
        amount: Number(c.amount),
        created_by: createdBy ?? null,
      }));
    if (chargeRows.length > 0) {
      const { error: insError } = await supabase.from('purchase_charges').insert(chargeRows);
      if (insError) {
        console.warn('[PURCHASE SERVICE] replacePurchaseCharges insert failed:', insError);
        throw insError;
      }
    }
  },

  /** Cancel purchase (final/received): reverses stock, sets status=cancelled. */
  async cancelPurchase(id: string, _options?: { reason?: string; performedBy?: string }) {
    await this.updatePurchaseStatus(id, 'cancelled');
  },

  // Update purchase status (when 'cancelled': create PURCHASE_CANCELLED stock reversals, then update status)
  async updatePurchaseStatus(id: string, status: Purchase['status']) {
    if (status === 'cancelled') {
      const { data: purchaseRow } = await supabase.from('purchases').select('id, po_no, branch_id, company_id, status').eq('id', id).single();
      if (!purchaseRow) throw new Error('Purchase not found');
      const poNo = (purchaseRow as any).po_no || `PUR-${id.substring(0, 8)}`;
      const priorPosted = wasPurchasePostedForReversal((purchaseRow as any).status);

      // Draft / ordered: no stock reversal (inventory was never posted for this PO)
      if (!priorPosted) {
        const { data, error } = await supabase
          .from('purchases')
          .update({ status })
          .eq('id', id)
          .select(PURCHASE_HEADER_COLUMNS)
          .single();
        if (error) throw error;
        return data;
      }

      const { data: existingReversal } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id)
        .eq('movement_type', 'PURCHASE_CANCELLED')
        .limit(1);
      if (existingReversal && existingReversal.length > 0) {
        const { data, error } = await supabase
          .from('purchases')
          .update({ status })
          .eq('id', id)
          .select(PURCHASE_HEADER_COLUMNS)
          .single();
        if (error) throw error;
        reversePurchaseDocumentAccounting(id).catch((err: any) =>
          console.warn('[purchaseService] Document accounting reversal failed (non-critical):', err?.message)
        );
        return data;
      }

      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, box_change, piece_change')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id)
        .eq('movement_type', 'purchase');

      if (stockMovements && stockMovements.length > 0) {
        for (const m of stockMovements) {
          const reverseMovement: Record<string, unknown> = {
            company_id: m.company_id,
            branch_id: m.branch_id,
            product_id: m.product_id,
            variation_id: m.variation_id ?? null,
            movement_type: 'PURCHASE_CANCELLED',
            quantity: -(Number(m.quantity) || 0),
            unit_cost: Number(m.unit_cost) || 0,
            total_cost: -(Number(m.total_cost) || 0),
            reference_type: 'purchase',
            reference_id: id,
            notes: `Reversal of ${poNo} (Cancelled)`,
          };
          if (m.box_change != null) (reverseMovement as any).box_change = -(Number(m.box_change) || 0);
          if (m.piece_change != null) (reverseMovement as any).piece_change = -(Number(m.piece_change) || 0);
          const { error: insertErr } = await supabase.from('stock_movements').insert(reverseMovement);
          if (insertErr) throw insertErr;
        }
      }

      const { data, error } = await supabase
        .from('purchases')
        .update({ status })
        .eq('id', id)
        .select(PURCHASE_HEADER_COLUMNS)
        .single();
      if (error) throw error;
      reversePurchaseDocumentAccounting(id).catch((err: any) =>
        console.warn('[purchaseService] Document accounting reversal failed (non-critical):', err?.message)
      );
      return data;
    }

    const { data: priorRow } = await supabase.from('purchases').select('status').eq('id', id).maybeSingle();
    const prevStatus = (priorRow as { status?: string } | null)?.status;
    if (String(prevStatus).toLowerCase() === 'cancelled') {
      throw new Error(
        'Cannot change status from cancelled. Use Restore to Draft or Order from the purchases list first.'
      );
    }

    let { data, error } = await supabase
      .from('purchases')
      .update({ status })
      .eq('id', id)
      .select(PURCHASE_HEADER_COLUMNS)
      .single();

    // Auto-fix: if update failed and we sent 'final', try all common enum casings (DB may use final/FINAL/Final).
    if (error && status === 'final') {
      const variants: Array<'final' | 'FINAL' | 'Final'> = ['final', 'FINAL', 'Final'];
      for (const value of variants) {
        let { data: retryData, error: retryError } = await supabase
          .from('purchases')
          .update({ status: value })
          .eq('id', id)
          .select(PURCHASE_HEADER_COLUMNS)
          .single();
        if (!retryError && retryData) {
          const newSt = (retryData as { status?: string }).status;
          if (canPostAccountingForPurchaseStatus(newSt) && !canPostAccountingForPurchaseStatus(prevStatus)) {
            try {
              retryData = (await ensurePostedPurchasePoNoAllocated(
                id,
                retryData as Record<string, unknown>
              )) as typeof retryData;
            } catch (allocErr: unknown) {
              const msg = allocErr instanceof Error ? allocErr.message : String(allocErr);
              await supabase
                .from('purchases')
                .update({ status: (prevStatus as Purchase['status'] | undefined) ?? 'draft' })
                .eq('id', id);
              throw new Error(msg);
            }
            postPurchaseDocumentAccounting(id).catch((err: any) =>
              console.warn('[purchaseService] Document posting engine failed (non-critical):', err?.message)
            );
          }
          return retryData;
        }
      }
    }
    if (error) throw error;
    const newSt = (data as { status?: string }).status ?? status;
    if (canPostAccountingForPurchaseStatus(newSt) && !canPostAccountingForPurchaseStatus(prevStatus)) {
      try {
        data = (await ensurePostedPurchasePoNoAllocated(id, data as Record<string, unknown>)) as typeof data;
      } catch (allocErr: unknown) {
        const msg = allocErr instanceof Error ? allocErr.message : String(allocErr);
        await supabase
          .from('purchases')
          .update({ status: (prevStatus as Purchase['status'] | undefined) ?? 'draft' })
          .eq('id', id);
        throw new Error(msg);
      }
      postPurchaseDocumentAccounting(id).catch((err: any) =>
        console.warn('[purchaseService] Document posting engine failed (non-critical):', err?.message)
      );
    }
    return data;
  },

  /**
   * QA / repair: if status is received/final but po_no is empty or still PDR/POR, allocate PUR and persist.
   * Does not change status or re-run document posting.
   */
  async repairMissingPostedPurchasePoNo(id: string) {
    const { data: row, error } = await supabase.from('purchases').select('*').eq('id', id).maybeSingle();
    if (error || !row) throw new Error('Purchase not found');
    if (!canPostAccountingForPurchaseStatus((row as { status?: string }).status)) {
      throw new Error('Repair PO number only applies to received/final (posted) purchases.');
    }
    if (!purchaseRowNeedsPostedPoAllocation(row as Record<string, unknown>)) {
      return row;
    }
    return ensurePostedPurchasePoNoAllocated(id, row as Record<string, unknown>);
  },

  /**
   * Move a cancelled PO back to draft or ordered (unposted). Historical reversals remain for audit.
   */
  async restoreCancelledPurchase(id: string, target: 'draft' | 'ordered', companyId: string) {
    const { data: row, error: fetchErr } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !row) throw new Error('Purchase not found');
    if (String((row as { status?: string }).status).toLowerCase() !== 'cancelled') {
      throw new Error('Only cancelled purchase orders can be restored.');
    }

    const r = row as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      status: target,
      po_no: null,
    };
    if (target === 'draft' && !(r.draft_no && String(r.draft_no).trim())) {
      patch.draft_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'PDR');
    }
    if (target === 'ordered' && !(r.order_no && String(r.order_no).trim())) {
      patch.order_no = await documentNumberService.getNextDocumentNumberGlobal(companyId, 'POR');
    }

    const { error } = await supabase.from('purchases').update(patch).eq('id', id).eq('status', 'cancelled');
    if (error) throw error;
  },

  // Update purchase. Only DB columns (discount_amount, no discount_percentage). Map app 'discount' → discount_amount.
  async updatePurchase(id: string, updates: Partial<Purchase>) {
    // 🔒 CANCELLED: No updates allowed on cancelled purchases
    const { data: existingPurchase } = await supabase.from('purchases').select('status').eq('id', id).single();
    if (existingPurchase && (existingPurchase as any).status === 'cancelled') {
      throw new Error('Cannot edit a cancelled purchase order.');
    }
    // 🔒 LOCK CHECK: Prevent editing if purchase has returns
    const { data: returns } = await supabase
      .from('purchase_returns')
      .select('id')
      .eq('original_purchase_id', id)
      .eq('status', 'final')
      .limit(1);
    
    if (returns && returns.length > 0) {
      throw new Error('Cannot edit purchase: This purchase has a return and is locked. Returns cannot be edited or deleted.');
    }

    const raw = updates as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    const allowed = new Set(PURCHASE_INSERT_KEYS);
    for (const key of Object.keys(raw)) {
      if (key === 'discount' && raw.discount !== undefined) {
        sanitized.discount_amount = Number(raw.discount) || 0;
      } else if (key === 'purchaseNo' && raw.purchaseNo !== undefined) {
        sanitized.po_no = raw.purchaseNo;
      } else if (allowed.has(key as any)) {
        sanitized[key] = raw[key];
      }
    }

    const { data, error } = await supabase
      .from('purchases')
      .update(sanitized)
      .eq('id', id)
      .select(PURCHASE_HEADER_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  },

  // Delete purchase with complete cascade delete
  // CRITICAL: This deletes ALL related data in correct order
  // Order: Payments → Journal Entries → Stock Movements → Ledger Entries → Activity Logs → Purchase Items → Purchase
  async deletePurchase(id: string) {
    // 🔒 CANCELLED: No delete allowed on cancelled purchases
    const { data: existingPurchase } = await supabase.from('purchases').select('status').eq('id', id).single();
    if (existingPurchase && (existingPurchase as any).status === 'cancelled') {
      throw new Error('Cannot delete a cancelled purchase order.');
    }
    console.log('[PURCHASE SERVICE] Starting cascade delete for purchase:', id);
    
    try {
      // STEP 1: Delete all payments for this purchase (and their journal entries)
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id);

      if (payments && payments.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${payments.length} payments to delete`);
        for (const payment of payments) {
          try {
            // Delete payment using the existing deletePaymentDirect method
            await this.deletePaymentDirect(payment.id, id);
          } catch (paymentError: any) {
            console.error(`[PURCHASE SERVICE] Error deleting payment ${payment.id}:`, paymentError);
            // Continue with other deletions even if one payment fails
          }
        }
      }

      // STEP 2: Delete stock movements (to reverse stock)
      // CRITICAL: Include variation_id for proper stock reversal
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, box_change, piece_change')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id);

      if (stockMovements && stockMovements.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${stockMovements.length} stock movements to reverse`);
        // Create reverse stock movements before deleting (STEP 3: Reverse, not hide)
        for (const movement of stockMovements) {
          try {
            // Create reverse movement (negative quantity to reverse stock)
            // CRITICAL: Include variation_id for variation-specific stock reversal
            const reverseMovement: Record<string, unknown> = {
              company_id: movement.company_id,
              branch_id: movement.branch_id,
              product_id: movement.product_id,
              variation_id: movement.variation_id || null,
              movement_type: 'adjustment',
              quantity: -(Number(movement.quantity) || 0),
              unit_cost: Number(movement.unit_cost) || 0,
              total_cost: -(Number(movement.total_cost) || 0),
              reference_type: 'purchase',
              reference_id: id,
              notes: `Reverse stock from deleted purchase ${id}`,
            };
            if (movement.box_change != null) reverseMovement.box_change = -(Number(movement.box_change) || 0);
            if (movement.piece_change != null) reverseMovement.piece_change = -(Number(movement.piece_change) || 0);
            
            console.log('[PURCHASE SERVICE] Creating reverse stock movement:', {
              product_id: reverseMovement.product_id,
              variation_id: reverseMovement.variation_id,
              quantity: reverseMovement.quantity
            });
            
            const { data: reverseData, error: reverseError } = await supabase
              .from('stock_movements')
              .insert(reverseMovement)
              .select()
              .single();
            
            if (reverseError) {
              console.error('[PURCHASE SERVICE] ❌ Failed to create reverse stock movement:', reverseError);
              throw reverseError; // Don't allow silent failure
            }
            
            console.log('[PURCHASE SERVICE] ✅ Reverse stock movement created:', reverseData?.id);
          } catch (reverseError: any) {
            console.error('[PURCHASE SERVICE] ❌ CRITICAL: Could not create reverse stock movement:', reverseError);
            throw new Error(`Failed to reverse stock movement: ${reverseError.message || reverseError}`);
          }
        }
        
        // Delete original stock movements
        const { error: stockError } = await supabase
          .from('stock_movements')
          .delete()
          .eq('reference_type', 'purchase')
          .eq('reference_id', id);

        if (stockError) {
          console.error('[PURCHASE SERVICE] Error deleting stock movements:', stockError);
          // Continue with other deletions
        }
      }

      // STEP 3: Delete ledger entries (supplier ledger)
      // CRITICAL: Delete ALL entries related to this purchase (purchase, payment, discount, cargo)
      const { data: ledgerEntries } = await supabase
        .from('ledger_entries')
        .select('id, source, reference_no')
        .or(`and(source.eq.purchase,reference_id.eq.${id}),and(source.eq.payment,reference_id.eq.${id})`)
        .like('reference_no', `%${id}%`); // Also match by reference_no pattern

      // More comprehensive: Delete by reference_id regardless of source
      const { data: allLedgerEntries } = await supabase
        .from('ledger_entries')
        .select('id, source, reference_no, reference_id')
        .eq('reference_id', id);

      const entriesToDelete = allLedgerEntries || ledgerEntries || [];
      
      if (entriesToDelete.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${entriesToDelete.length} ledger entries to delete:`, entriesToDelete.map(e => ({ source: e.source, ref: e.reference_no })));
        
        // Delete by reference_id (catches all entries linked to this purchase)
        const { error: ledgerError } = await supabase
          .from('ledger_entries')
          .delete()
          .eq('reference_id', id);

        if (ledgerError) {
          console.error('[PURCHASE SERVICE] Error deleting ledger entries:', ledgerError);
          // Try alternative: delete by source and reference_no pattern
          const purchaseNo = entriesToDelete[0]?.reference_no;
          if (purchaseNo) {
            const { error: altError } = await supabase
              .from('ledger_entries')
              .delete()
              .eq('reference_no', purchaseNo);
            
            if (altError) {
              console.error('[PURCHASE SERVICE] Alternative ledger delete also failed:', altError);
            } else {
              console.log('[PURCHASE SERVICE] ✅ Deleted ledger entries by reference_no');
            }
          }
        } else {
          console.log('[PURCHASE SERVICE] ✅ Deleted ledger entries by reference_id');
        }
      }

      // STEP 4: Delete journal entries directly linked to purchase (if any)
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id);

      if (journalEntries && journalEntries.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${journalEntries.length} journal entries to delete`);
        for (const entry of journalEntries) {
          // Delete journal entry lines first
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);

          if (lineError) {
            console.error('[PURCHASE SERVICE] Error deleting journal entry lines:', lineError);
          }

          // Then delete journal entry
          const { error: entryError } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', entry.id);

          if (entryError) {
            console.error('[PURCHASE SERVICE] Error deleting journal entry:', entryError);
          }
        }
      }

      // STEP 5: Delete activity logs
      const { error: activityError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('module', 'purchase')
        .eq('entity_id', id);

      if (activityError) {
        console.warn('[PURCHASE SERVICE] Error deleting activity logs (non-critical):', activityError);
        // Activity logs deletion failure is non-critical
      }

      // STEP 6: Delete purchase items (cascade should handle this, but explicit for safety)
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', id);

      if (itemsError) {
        console.error('[PURCHASE SERVICE] Error deleting purchase items:', itemsError);
        // Continue - purchase deletion will cascade
      }

      // STEP 7: Finally delete the purchase record itself
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);

      if (purchaseError) {
        console.error('[PURCHASE SERVICE] Error deleting purchase:', purchaseError);
        throw purchaseError;
      }

      console.log('[PURCHASE SERVICE] ✅ Cascade delete completed successfully for purchase:', id);
    } catch (error: any) {
      console.error('[PURCHASE SERVICE] ❌ Cascade delete failed for purchase:', id, error);
      throw new Error(`Failed to delete purchase: ${error.message || 'Unknown error'}`);
    }
  },

  // Record payment – allowed only when purchase status is final or received (DB enum — no `completed`).
  // Uses canonical supplierPaymentService: one payments row + one journal entry (no duplicate JE).
  async recordPayment(purchaseId: string, amount: number, paymentMethod: string, accountId: string, companyId: string, branchId?: string | null, _referenceNumber?: string | null, options?: { notes?: string; attachments?: any }) {
    const { data: purchase, error: fetchError } = await supabase
      .from('purchases')
      .select('id, status, branch_id')
      .eq('id', purchaseId)
      .single();

    if (fetchError || !purchase) {
      throw new Error('Purchase not found');
    }
    const status = (purchase as any).status;
    if (status === 'cancelled') {
      throw new Error('Cannot record payment on a cancelled purchase order.');
    }
    if (!canPostAccountingForPurchaseStatus(status)) {
      throw new Error('Payment not allowed until purchase is Received or Final. Current status: ' + (status || 'unknown'));
    }
    const purchaseBranchId = (purchase as any).branch_id;
    const validBranchId = (purchaseBranchId && purchaseBranchId !== 'all') ? purchaseBranchId : (branchId && branchId !== 'all') ? branchId : null;
    if (!accountId) {
      throw new Error('Payment account is required. Please select an account.');
    }

    const result = await createSupplierPayment({
      companyId,
      branchId: validBranchId,
      amount,
      paymentMethod,
      paymentAccountId: accountId,
      purchaseId,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: options?.notes,
      attachments: options?.attachments,
    });

    activityLogService.logActivity({
      companyId,
      module: 'purchase',
      entityId: purchaseId,
      action: 'payment_added',
      amount,
      paymentMethod: paymentMethod as string,
      description: `Payment of Rs ${Number(amount).toLocaleString()} recorded for purchase`,
    }).catch((err) => console.warn('[PURCHASE SERVICE] Activity log failed:', err));

    return { id: result.paymentId, reference_number: result.referenceNumber };
  },

  /**
   * Record on-account payment (direct supplier payment without bill).
   * Uses canonical supplierPaymentService: one payments row + one journal entry (Dr AP, Cr Cash/Bank).
   */
  async recordOnAccountPayment(
    contactId: string,
    contactName: string,
    amount: number,
    paymentMethod: string,
    accountId: string,
    companyId: string,
    branchId: string,
    paymentDate?: string,
    options?: { notes?: string; attachments?: any }
  ) {
    if (!accountId || !companyId || !branchId) {
      throw new Error('Account, company and branch are required for on-account payment.');
    }
    const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
    const result = await createSupplierPayment({
      companyId,
      branchId: validBranchId,
      amount,
      paymentMethod,
      paymentAccountId: accountId,
      contactId,
      supplierName: contactName,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      notes: options?.notes,
      attachments: options?.attachments,
    });
    return { id: result.paymentId, reference_number: result.referenceNumber };
  },

  // Update payment (Phase 3: isolated — post only payment delta JEs, never touch document JEs)
  async updatePayment(
    paymentId: string,
    purchaseId: string,
    updates: {
      amount?: number;
      paymentMethod?: string;
      accountId?: string;
      paymentDate?: string;
      referenceNumber?: string;
      notes?: string;
      attachments?: any;
    }
  ) {
    try {
      // Phase 3: Capture current payment before update (for amount/account adjustment JEs)
      let oldAmount: number | null = null;
      let oldAccountId: string | null = null;
      let paymentAccountId: string | null = null;
      let companyId: string | null = null;
      let branchId: string | null = null;
      let paymentDate: string | null = null;
      const needPreState = updates.amount !== undefined || updates.accountId !== undefined || updates.paymentMethod !== undefined;
      if (needPreState) {
        const { data: current } = await supabase
          .from('payments')
          .select('amount, payment_account_id, company_id, branch_id, payment_date')
          .eq('id', paymentId)
          .single();
        if (current) {
          const c = current as any;
          oldAmount = Number(c.amount ?? 0) || 0;
          oldAccountId = c.payment_account_id ?? null;
          paymentAccountId = c.payment_account_id ?? null;
          companyId = c.company_id ?? null;
          branchId = c.branch_id ?? null;
          paymentDate = c.payment_date ?? null;
        }
      }

      // Normalize payment method if provided
      let normalizedPaymentMethod = updates.paymentMethod;
      if (updates.paymentMethod) {
        const normalized = updates.paymentMethod.toLowerCase().trim();
        const paymentMethodMap: Record<string, string> = {
          'cash': 'cash',
          'Cash': 'cash',
          'bank': 'bank',
          'Bank': 'bank',
          'card': 'card',
          'Card': 'card',
          'cheque': 'other',
          'Cheque': 'other',
          'mobile wallet': 'other',
          'Mobile Wallet': 'other',
          'mobile_wallet': 'other',
          'wallet': 'other',
          'Wallet': 'other',
        };
        normalizedPaymentMethod = paymentMethodMap[updates.paymentMethod] || paymentMethodMap[normalized] || 'cash';
      }

      // Build update data
      const updateData: any = {};
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (normalizedPaymentMethod) updateData.payment_method = normalizedPaymentMethod;
      if (updates.accountId) updateData.payment_account_id = updates.accountId;
      if (updates.paymentDate) updateData.payment_date = updates.paymentDate;
      if (updates.referenceNumber !== undefined) updateData.reference_number = updates.referenceNumber;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      if (updates.attachments !== undefined) updateData.attachments = updates.attachments;

      const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (error) {
        console.error('[PURCHASE SERVICE] Error updating payment:', error);
        throw error;
      }

      const newAmount = updates.amount !== undefined ? Number(updates.amount) : oldAmount;

      // Phase 3: Post payment amount adjustment JE when amount changed (original payment JE stays untouched)
      if (
        oldAmount != null &&
        newAmount != null &&
        oldAmount !== newAmount &&
        companyId &&
        paymentAccountId
      ) {
        try {
          const purchaseRow = await this.getPurchase(purchaseId).catch(() => null);
          const poNo = (purchaseRow as any)?.po_no ?? `PUR-${purchaseId.substring(0, 8)}`;
          const { postPaymentAmountAdjustment } = await import('@/app/services/paymentAdjustmentService');
          const { data: { user } } = await supabase.auth.getUser();
          await postPaymentAmountAdjustment({
            context: 'purchase',
            companyId,
            branchId,
            paymentId,
            referenceId: purchaseId,
            oldAmount,
            newAmount,
            paymentAccountId: updates.accountId ?? paymentAccountId,
            invoiceNoOrRef: poNo,
            entryDate: (updates.paymentDate || paymentDate || new Date().toISOString().split('T')[0]).toString().slice(0, 10),
            createdBy: (user as any)?.id ?? null,
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          }
        } catch (adjErr: any) {
          console.warn('[PURCHASE SERVICE] Payment amount adjustment JE failed:', adjErr?.message || adjErr);
        }
      }

      // Phase 3: When only payment account/method changed, post JE: Dr new account, Cr old account
      const newAccountId = (data as any)?.payment_account_id ?? updates.accountId ?? null;
      if (
        companyId &&
        oldAccountId != null &&
        newAccountId != null &&
        oldAccountId !== newAccountId &&
        (newAmount != null && newAmount > 0)
      ) {
        try {
          const purchaseRow = await this.getPurchase(purchaseId).catch(() => null);
          const poNo = (purchaseRow as any)?.po_no ?? `PUR-${purchaseId.substring(0, 8)}`;
          const { postPaymentAccountAdjustment } = await import('@/app/services/paymentAdjustmentService');
          const { data: { user } } = await supabase.auth.getUser();
          await postPaymentAccountAdjustment({
            context: 'purchase',
            companyId,
            branchId,
            paymentId,
            referenceId: purchaseId,
            oldAccountId,
            newAccountId,
            amount: newAmount,
            invoiceNoOrRef: poNo,
            entryDate: (updates.paymentDate || paymentDate || (data as any)?.payment_date || new Date().toISOString().split('T')[0]).toString().slice(0, 10),
            createdBy: (user as any)?.id ?? null,
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          }
        } catch (accErr: any) {
          console.warn('[PURCHASE SERVICE] Payment account adjustment JE failed:', accErr?.message || accErr);
        }
      }

      console.log('[PURCHASE SERVICE] Payment updated successfully');
      return data;
    } catch (error: any) {
      console.error('[PURCHASE SERVICE] Error updating payment:', error);
      throw error;
    }
  },

  // Get purchase payments (STEP 2 FIX: Like Sale module)
  async getPurchasePayments(purchaseId: string) {
    console.log('[PURCHASE SERVICE] getPurchasePayments called with purchaseId:', purchaseId);
    
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        payment_date,
        reference_number,
        amount,
        payment_method,
        payment_account_id,
        notes,
        attachments,
        created_at,
        updated_at,
        account:accounts(id, name)
      `)
      .eq('reference_type', 'purchase')
      .eq('reference_id', purchaseId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    console.log('[PURCHASE SERVICE] Payment query result:', { 
      dataCount: data?.length || 0, 
      error: error?.message,
      purchaseId 
    });

    if (error) {
      console.error('[PURCHASE SERVICE] Error fetching payments:', error);
      // Don't throw - return empty array and log warning
    }

    // 🔒 GOLDEN RULE: Payment history = payments table ONLY (no fallback to paid_amount)
    if (data && data.length > 0) {
      console.log('[PURCHASE SERVICE] Found', data.length, 'payments for purchase:', purchaseId);
      return data.map((p: any) => ({
        id: p.id,
        date: p.payment_date || p.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        referenceNo: p.reference_number || '',
        amount: parseFloat(p.amount || 0),
        method: p.payment_method || 'cash',
        accountId: p.payment_account_id,
        accountName: p.account?.name || '',
        notes: p.notes || '',
        attachments: p.attachments || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at ?? p.created_at,
      }));
    }

    // 🔒 GOLDEN RULE: Return empty array if no payments found (never fallback to paid_amount)
    console.log('[PURCHASE SERVICE] No payments found in payments table for purchase:', purchaseId);
    return [];

    return [];
  },

  // Delete payment (similar to saleService.deletePayment)
  // Tries RPC delete_payment first; if 404 or missing, uses direct deletion.
  async deletePayment(paymentId: string, purchaseId: string) {
    const tryRpc = async () => {
      const { error } = await supabase.rpc('delete_payment', {
        p_payment_id: paymentId,
        p_reference_id: purchaseId
      });
      return error;
    };

    try {
      const rpcError = await tryRpc();
      if (!rpcError) return; // RPC success
      // RPC failed (e.g. 404 function not found) → use direct delete
      return await this.deletePaymentDirect(paymentId, purchaseId);
    } catch (err: any) {
      // RPC request can throw (e.g. 404) → use direct delete
      return await this.deletePaymentDirect(paymentId, purchaseId);
    }
  },

  // Direct delete fallback (if RPC not available)
  async deletePaymentDirect(paymentId: string, purchaseId: string) {
    try {
      // Fetch payment details before deletion
      const { data: paymentData, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError || !paymentData) {
        throw new Error('Payment not found');
      }

      // Delete related journal entries first
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('payment_id', paymentId);

      if (journalEntries && journalEntries.length > 0) {
        // Delete journal entry lines first
        for (const entry of journalEntries) {
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);
          
          if (lineError) {
            console.error('[PURCHASE SERVICE] Error deleting journal entry lines:', lineError);
          }
        }

        // Then delete journal entries
        const { error: entryError } = await supabase
          .from('journal_entries')
          .delete()
          .eq('payment_id', paymentId);
        
        if (entryError) {
          console.error('[PURCHASE SERVICE] Error deleting journal entries:', entryError);
        }
      }

      // Finally delete the payment
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        throw deleteError;
      }
    } catch (error: any) {
      console.error('[PURCHASE SERVICE] Error in deletePaymentDirect:', error);
      throw error;
    }
  },
};
