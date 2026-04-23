import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'final';

export interface CreatePurchaseInput {
  companyId: string;
  branchId: string;
  supplierId: string | null;
  supplierName: string;
  contactNumber?: string;
  status?: PurchaseStatus;
  paidAmount?: number;
  paymentMethod?: 'cash' | 'bank' | 'card' | 'other';
  paymentAccountId?: string | null;
  items: {
    productId: string;
    variationId?: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
    packingDetails?: { total_boxes?: number; total_pieces?: number };
  }[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  notes?: string;
  userId: string;
}

/**
 * Get next PO number from server – ATOMIC, same engine as Web (Settings → Numbering Rules).
 * Uses generate_document_number via getNextDocumentNumber. Never generate locally.
 */
async function getNextPONumber(companyId: string, branchId: string): Promise<string> {
  const { getNextDocumentNumber } = await import('./documentNumber');
  return getNextDocumentNumber(companyId, branchId, 'purchase');
}

export async function createPurchase(
  input: CreatePurchaseInput
): Promise<{ data: { id: string; poNo: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'App not configured.' };
  }

  const {
    companyId,
    branchId,
    supplierId,
    supplierName,
    contactNumber,
    items,
    subtotal,
    discountAmount,
    taxAmount,
    shippingCost,
    total,
    notes,
    userId,
    status = 'ordered',
    paidAmount = 0,
    paymentMethod = 'cash',
    paymentAccountId,
  } = input;

  if (!companyId || !branchId || !userId) {
    return { data: null, error: 'Missing company, branch, or user.' };
  }
  if (!items.length) {
    return { data: null, error: 'No items in purchase.' };
  }

  let poNo: string;
  try {
    poNo = await getNextPONumber(companyId, branchId);
  } catch (err) {
    return { data: null, error: (err as Error).message ?? 'Failed to get PO number' };
  }

  const paid = Math.max(0, Math.min(Number(paidAmount) || 0, Number(total) || 0));
  const due = Math.max(0, (Number(total) || 0) - paid);
  const paymentStatus = paid <= 0 ? 'unpaid' : paid >= (Number(total) || 0) ? 'paid' : 'partial';

  const purchaseRow = {
    company_id: companyId,
    branch_id: branchId,
    po_no: poNo,
    po_date: new Date().toISOString(),
    supplier_id: supplierId || null,
    supplier_name: supplierName || 'Unknown',
    contact_number: contactNumber || null,
    status: status as string,
    payment_status: paymentStatus,
    subtotal: Number(subtotal) || 0,
    discount_amount: Number(discountAmount) || 0,
    tax_amount: Number(taxAmount) || 0,
    shipping_cost: Number(shippingCost) || 0,
    total: Number(total) || 0,
    paid_amount: paid,
    due_amount: due,
    notes: notes || null,
    created_by: userId,
  };

  const { data: purchaseData, error: purchaseError } = await supabase
    .from('purchases')
    .insert(purchaseRow)
    .select('id')
    .single();

  if (purchaseError) {
    return { data: null, error: purchaseError.message };
  }

  const purchaseId = purchaseData.id;
  const itemsWithPurchaseId = items.map((item) => {
    const row: Record<string, unknown> = {
      purchase_id: purchaseId,
      product_id: item.productId,
      variation_id: item.variationId || null,
      product_name: item.productName,
      sku: item.sku || '—',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    };
    if (item.packingDetails && (item.packingDetails.total_boxes != null || item.packingDetails.total_pieces != null)) {
      row.packing_details = item.packingDetails;
    }
    return row;
  });

  const { error: itemsError } = await supabase.from('purchase_items').insert(itemsWithPurchaseId);

  if (itemsError) {
    await supabase.from('purchases').delete().eq('id', purchaseId);
    return { data: null, error: `Failed to save items: ${itemsError.message}` };
  }

  // Accounting: post journal entry for the purchase (Dr Inventory/Tax,
  // Cr AP supplier sub-account). Idempotent RPC; soft-warn on error.
  try {
    const { data: postData, error: postErr } = await supabase.rpc(
      'record_purchase_with_accounting',
      { p_purchase_id: purchaseId },
    );
    if (postErr) {
      console.warn('[PURCHASES API] record_purchase_with_accounting failed:', postErr);
    } else if (postData && typeof postData === 'object' && (postData as { success?: boolean }).success === false) {
      console.warn('[PURCHASES API] record_purchase_with_accounting returned error:', postData);
    }
  } catch (err) {
    console.warn('[PURCHASES API] record_purchase_with_accounting threw:', err);
  }

  // Record payment when goods are in hand (received/final) and paid > 0.
  if ((status === 'final' || status === 'received') && paid > 0 && paymentAccountId) {
    const { recordSupplierPayment } = await import('./accounts');
    const payRes = await recordSupplierPayment({
      companyId,
      branchId,
      purchaseId,
      amount: paid,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentAccountId,
      paymentMethod,
      userId,
    });
    if (payRes.error) {
      console.warn('[PURCHASES API] Payment record failed:', payRes.error);
    }
  }

  return {
    data: { id: purchaseId, poNo },
    error: null,
  };
}

/** Update purchase status (e.g. ordered → final). Uses DB enum value (lowercase 'final'). */
export async function updatePurchaseStatus(
  companyId: string,
  purchaseId: string,
  status: PurchaseStatus
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  // purchase_status enum: typically 'draft'|'ordered'|'received'|'final' (lowercase). Send only status to avoid 400 from missing columns.
  const { error } = await supabase
    .from('purchases')
    .update({ status })
    .eq('id', purchaseId)
    .eq('company_id', companyId);
  return { error: error?.message ?? null };
}

/**
 * Cancel a purchase (full void): reverses stock, creates purchase_reversal journal entry,
 * sets status='cancelled'. Idempotent via cancel_purchase_full_void RPC.
 */
export async function cancelPurchase(
  companyId: string,
  purchaseId: string,
  opts?: { userId?: string | null; reason?: string | null },
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { data, error } = await supabase.rpc('cancel_purchase_full_void', {
    p_purchase_id: purchaseId,
    p_user_id: opts?.userId ?? null,
    p_reason: opts?.reason ?? null,
  });
  if (error) return { error: error.message };
  const res = data as { success?: boolean; error?: string } | null;
  if (res && res.success === false) return { error: res.error ?? 'Cancel failed' };
  // Silence unused parameter lint
  void companyId;
  return { error: null };
}

export interface PurchaseListItem {
  id: string;
  poNo: string;
  vendor: string;
  vendorPhone: string;
  total: number;
  subtotal: number;
  discount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  paymentStatus: string;
  date: string;
  /** Friendly date e.g. "Today, 12:30 pm" */
  dateDisplay?: string;
  itemCount: number;
  created_by_name?: string;
  branchId?: string | null;
}

async function enrichPurchasesWithCreatorNames(rows: Record<string, unknown>[]): Promise<void> {
  const ids = [...new Set((rows || []).map((r) => r.created_by as string).filter(Boolean))];
  if (ids.length === 0) return;
  const { data: users } = await supabase.from('users').select('id, full_name').in('id', ids);
  const nameById = new Map<string, string>();
  (users || []).forEach((u: Record<string, unknown>) => {
    if (u?.id && u?.full_name) nameById.set(u.id as string, u.full_name as string);
  });
  rows.forEach((r) => {
    const uid = r.created_by as string;
    if (uid) (r as Record<string, unknown>).created_by_name = nameById.get(uid) || null;
  });
}

/** Match web: paid / due from actual payment rows (company-wide link by reference_id), exclude voided. */
async function enrichPurchasesPaidFromPayments(companyId: string, rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;
  const ids = rows.map((r) => r.id as string).filter(Boolean);
  const { data: payData } = await supabase
    .from('payments')
    .select('reference_id, amount')
    .eq('reference_type', 'purchase')
    .eq('company_id', companyId)
    .in('reference_id', ids)
    .is('voided_at', null);
  const byPurchase: Record<string, number> = {};
  for (const p of payData || []) {
    const refId = String((p as Record<string, unknown>).reference_id || '');
    if (refId) byPurchase[refId] = (byPurchase[refId] || 0) + Number((p as Record<string, unknown>).amount ?? 0);
  }
  rows.forEach((r) => {
    const id = String(r.id || '');
    const total = Number(r.total) || 0;
    const paid = byPurchase[id] ?? (Number(r.paid_amount) || 0);
    const due = Math.max(0, total - paid);
    r.paid_amount = paid;
    r.due_amount = due;
    r.payment_status = paid <= 0 ? 'unpaid' : paid >= total - 0.005 ? 'paid' : 'partial';
  });
}

export async function getPurchases(
  companyId: string,
  branchId?: string | null
): Promise<{ data: PurchaseListItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let query = supabase
    .from('purchases')
    .select('id, po_no, supplier_name, contact_number, total, subtotal, discount_amount, paid_amount, due_amount, status, payment_status, po_date, created_by, branch_id')
    .eq('company_id', companyId)
    // Keep cancelled POs visible with a "Cancelled" badge (web parity). Filtering removed.
    .order('po_date', { ascending: false })
    .limit(50);
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    query = query.eq('branch_id', branchId);
  }
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const rows = (data || []) as Record<string, unknown>[];
  await enrichPurchasesWithCreatorNames(rows);
  await enrichPurchasesPaidFromPayments(companyId, rows);

  const ids = rows.map((r) => r.id as string);
  const itemCountMap: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: itemsData } = await supabase
      .from('purchase_items')
      .select('purchase_id')
      .in('purchase_id', ids);
    for (const row of itemsData || []) {
      const pid = (row as { purchase_id: string }).purchase_id;
      itemCountMap[pid] = (itemCountMap[pid] || 0) + 1;
    }
  }

  const list = rows.map((r) => {
    const poDate = r.po_date as string | undefined;
    const dateStr = poDate ? new Date(poDate).toISOString().slice(0, 10) : '—';
    const dateObj = poDate ? new Date(poDate) : new Date();
    const isToday = dateObj.toDateString() === new Date().toDateString();
    const isYesterday = dateObj.toDateString() === new Date(Date.now() - 864e5).toDateString();
    let dateDisplay = dateObj.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
    if (isToday) dateDisplay = `Today, ${dateDisplay}`;
    else if (isYesterday) dateDisplay = `Yesterday, ${dateDisplay}`;
    else dateDisplay = dateObj.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
    return {
      id: r.id as string,
      poNo: (r.po_no as string) || `PUR-${(r.id as string).slice(0, 8)}`,
      vendor: (r.supplier_name as string) || '—',
      vendorPhone: (r.contact_number as string) || '—',
      total: Number(r.total) || 0,
      subtotal: Number(r.subtotal) || 0,
      discount: Number(r.discount_amount) || 0,
      paidAmount: Number(r.paid_amount) || 0,
      dueAmount: Number(r.due_amount) || 0,
      status: String(r.status || 'ordered'),
      paymentStatus: String(r.payment_status || 'unpaid'),
      date: dateStr,
      dateDisplay,
      itemCount: itemCountMap[r.id as string] || 0,
      created_by_name: (r.created_by_name as string) || undefined,
      branchId: (r.branch_id as string) ?? null,
    };
  });
  return { data: list, error: null };
}

export interface PurchaseDetail {
  id: string;
  poNo: string;
  vendor: string;
  vendorPhone: string;
  branchId?: string | null;
  items: { id: string; productName: string; quantity: number; unitPrice: number; total: number; packingDetails?: { total_boxes?: number; total_pieces?: number; total_meters?: number; packs?: number; units_per_pack?: number } }[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  paymentStatus: string;
  orderDate: string;
  expectedDeliveryDate?: string;
}

export async function getPurchaseById(
  companyId: string,
  purchaseId: string
): Promise<{ data: PurchaseDetail | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('id, po_no, supplier_name, contact_number, branch_id, subtotal, discount_amount, total, paid_amount, due_amount, status, payment_status, po_date')
    .eq('id', purchaseId)
    .eq('company_id', companyId)
    .single();
  if (purchaseError || !purchase) return { data: null, error: purchaseError?.message || 'Not found' };

  const { data: items, error: itemsError } = await supabase
    .from('purchase_items')
    .select('id, product_name, quantity, unit_price, total, packing_details')
    .eq('purchase_id', purchaseId);
  if (itemsError) return { data: null, error: itemsError.message };

  const p = purchase as Record<string, unknown>;
  await enrichPurchasesPaidFromPayments(companyId, [p]);

  return {
    data: {
      id: p.id as string,
      poNo: (p.po_no as string) || '—',
      vendor: (p.supplier_name as string) || '—',
      vendorPhone: (p.contact_number as string) || '—',
      items: (items || []).map((i: Record<string, unknown>) => {
        const pd = i.packing_details as Record<string, unknown> | null | undefined;
        const packs = pd && (pd.packs ?? pd.total_boxes) != null ? Number(pd.packs ?? pd.total_boxes) : undefined;
        const unitsPerPack = pd && (pd.units_per_pack != null || (pd.total_pieces != null && (pd.total_boxes ?? pd.packs) != null))
          ? (pd.units_per_pack != null ? Number(pd.units_per_pack) : (Number(pd.total_boxes ?? pd.packs) || 0) > 0 ? Math.round(Number(pd.total_pieces) / Number(pd.total_boxes ?? pd.packs)) : undefined)
          : undefined;
        return {
          id: i.id as string,
          productName: (i.product_name as string) || '—',
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unit_price) || 0,
          total: Number(i.total) || 0,
          packingDetails: pd ? { total_boxes: pd.total_boxes as number | undefined, total_pieces: pd.total_pieces as number | undefined, total_meters: pd.total_meters as number | undefined, packs, units_per_pack: unitsPerPack } : undefined,
        };
      }),
      branchId: (p.branch_id as string) ?? null,
      subtotal: Number(p.subtotal) || 0,
      discount: Number(p.discount_amount) || 0,
      total: Number(p.total) || 0,
      paidAmount: Number(p.paid_amount) || 0,
      dueAmount: Number(p.due_amount) || 0,
      status: String(p.status || 'ordered'),
      paymentStatus: String(p.payment_status || 'unpaid'),
      orderDate: p.po_date ? new Date(p.po_date as string).toISOString().slice(0, 10) : '—',
    },
    error: null,
  };
}

export type PurchasePaymentRow = {
  id: string;
  date: string;
  amount: number;
  method: string;
  referenceNo: string;
  attachments?: { url: string; name: string }[];
};

/** Get payment history for a purchase (backend/database linked) */
export async function getPurchasePayments(purchaseId: string): Promise<{
  data: PurchasePaymentRow[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('payments')
    .select('id, payment_date, reference_number, amount, payment_method, attachments')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .is('voided_at', null)
    .order('payment_date', { ascending: false });
  if (error) return { data: [], error: error.message };
  const list: PurchasePaymentRow[] = (data || []).map((p: Record<string, unknown>) => {
    let attachments: { url: string; name: string }[] | undefined;
    const raw = p.attachments;
    if (Array.isArray(raw) && raw.length > 0) {
      attachments = raw.map((a: unknown) => {
        const o = a as Record<string, unknown>;
        return { url: String(o?.url ?? ''), name: String(o?.name ?? 'Attachment') };
      }).filter((a) => a.url);
    }
    return {
      id: String(p.id ?? ''),
      date: p.payment_date ? new Date(String(p.payment_date)).toLocaleDateString('en-PK') : '—',
      amount: Number(p.amount ?? 0),
      method: String(p.payment_method ?? '—'),
      referenceNo: String(p.reference_number ?? '—'),
      attachments: attachments?.length ? attachments : undefined,
    };
  });
  return { data: list, error: null };
}
