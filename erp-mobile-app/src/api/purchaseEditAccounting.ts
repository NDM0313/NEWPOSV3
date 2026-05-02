/**
 * After mobile purchase save: rebuild lines on the **canonical purchase document** JE in place
 * (same contract as web `PurchaseContext` — no extra `purchase_adjustment` rows).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type PurchaseAcctSnapshot = {
  total: number;
  subtotal: number;
  discount: number;
  otherCharges: number;
};

export type PurchaseLedgerSyncSkipReason =
  | 'not_configured'
  | 'snap_unchanged'
  | 'no_document_je'
  | 'missing_inventory_or_ap';

export type PurchaseLedgerSyncResult = {
  updated: boolean;
  error: string | null;
  skipReason?: PurchaseLedgerSyncSkipReason;
};

function sumCharges(
  charges: { charge_type?: string; chargeType?: string; amount?: number }[],
  pred: (t: string) => boolean,
): number {
  let s = 0;
  for (const c of charges || []) {
    const t = String(c.charge_type ?? c.chargeType ?? '')
      .toLowerCase()
      .trim();
    if (pred(t)) s += Number(c.amount) || 0;
  }
  return s;
}

/** Match web `getPurchaseAccountingSnapshot`. */
export function purchaseAccountingSnapshotFromRow(purchase: Record<string, unknown>): PurchaseAcctSnapshot {
  const total = Number(purchase?.total ?? 0) || 0;
  const charges = Array.isArray(purchase?.charges)
    ? (purchase.charges as { charge_type?: string; chargeType?: string; amount?: number }[])
    : Array.isArray(purchase?.purchase_charges)
      ? (purchase.purchase_charges as { charge_type?: string; chargeType?: string; amount?: number }[])
      : [];
  const discount = Number(purchase?.discount_amount ?? purchase?.discount ?? 0) || sumCharges(charges, (t) => t === 'discount');
  const shippingCost = Number(purchase?.shipping_cost ?? 0) || 0;
  const chargesOther = sumCharges(charges, (t) => t !== 'discount');
  const otherCharges = chargesOther + shippingCost;
  let subtotal = Number(purchase?.subtotal ?? 0) || total + discount - otherCharges;
  if (subtotal <= 0 && total > 0) {
    subtotal = total + discount - otherCharges;
  }
  return { total, subtotal, discount, otherCharges };
}

async function accountIdByCode(companyId: string, code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function fallbackInventoryAccountId(companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('accounts')
    .select('id, name, type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('type.eq.inventory,name.ilike.%inventory%')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function resolveApAccountId(companyId: string, supplierId: string | null | undefined): Promise<string | null> {
  const controlId = (await accountIdByCode(companyId, '2000')) || (await accountIdByCode(companyId, '2100'));
  const fallbackControlId = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or('name.ilike.%payable%,type.eq.liability')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  };
  const effectiveControlId = controlId || (await fallbackControlId());
  if (!effectiveControlId) return null;
  if (!supplierId) return effectiveControlId;
  const { data: sub } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_contact_id', supplierId)
    .eq('parent_id', effectiveControlId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return (sub as { id?: string } | null)?.id ?? effectiveControlId;
}

async function findCanonicalPurchaseDocumentJe(
  companyId: string,
  purchaseId: string,
  poNo?: string | null,
): Promise<{ id: string; description: string } | null> {
  const selectCols = 'id, description, is_void, updated_at, created_at';
  const { data, error } = await supabase
    .from('journal_entries')
    .select(selectCols)
    .eq('company_id', companyId)
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .is('payment_id', null)
    .order('updated_at', { ascending: false })
    .limit(8);
  const rows = (data || []) as { id: string; description: string | null; is_void?: boolean | null }[];
  const active = rows.find((r) => r.is_void !== true);
  if (!error && active) return { id: active.id, description: active.description || '' };

  // Fallback for legacy/dirty data where reference_id link is missing but description carries PO number.
  if (poNo) {
    const { data: byDesc } = await supabase
      .from('journal_entries')
      .select(selectCols)
      .eq('company_id', companyId)
      .eq('reference_type', 'purchase')
      .is('payment_id', null)
      .ilike('description', `%${poNo}%`)
      .order('updated_at', { ascending: false })
      .limit(8);
    const activeByDesc = ((byDesc || []) as { id: string; description: string | null; is_void?: boolean | null }[]).find(
      (r) => r.is_void !== true,
    );
    if (activeByDesc) return { id: activeByDesc.id, description: activeByDesc.description || '' };
  }
  return null;
}

export async function syncPurchaseDocumentJournalInPlaceMobile(params: {
  companyId: string;
  purchaseId: string;
  supplierId: string | null | undefined;
  supplierName: string;
  poNo: string;
  oldSnapshot: PurchaseAcctSnapshot;
  newSnapshot: PurchaseAcctSnapshot;
}): Promise<PurchaseLedgerSyncResult> {
  if (!isSupabaseConfigured || !params.companyId) {
    return { updated: false, error: null, skipReason: 'not_configured' };
  }

  const { companyId, purchaseId, supplierId, supplierName, poNo, oldSnapshot, newSnapshot } = params;

  const snapSame =
    oldSnapshot.total === newSnapshot.total &&
    oldSnapshot.subtotal === newSnapshot.subtotal &&
    oldSnapshot.discount === newSnapshot.discount &&
    oldSnapshot.otherCharges === newSnapshot.otherCharges;
  if (snapSame) return { updated: false, error: null, skipReason: 'snap_unchanged' };

  const purJe = await findCanonicalPurchaseDocumentJe(companyId, purchaseId, poNo);
  if (!purJe) return { updated: false, error: null, skipReason: 'no_document_je' };

  const jeId = purJe.id;

  try {
    const inventoryId = (await accountIdByCode(companyId, '1200')) || (await fallbackInventoryAccountId(companyId));
    const discountId = (await accountIdByCode(companyId, '5210')) || (await accountIdByCode(companyId, '6100'));
    const apAccountId = await resolveApAccountId(companyId, supplierId ?? null);
    if (!inventoryId || !apAccountId) {
      return { updated: false, error: null, skipReason: 'missing_inventory_or_ap' };
    }

    const itemsSubtotal = newSnapshot.subtotal;
    const freight = newSnapshot.otherCharges;
    const discount = newSnapshot.discount;

    await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', jeId);

    const newLines: { journal_entry_id: string; account_id: string; debit: number; credit: number; description: string }[] = [];
    if (itemsSubtotal > 0) {
      newLines.push({
        journal_entry_id: jeId,
        account_id: inventoryId,
        debit: itemsSubtotal,
        credit: 0,
        description: `Inventory purchase ${poNo}`,
      });
      newLines.push({
        journal_entry_id: jeId,
        account_id: apAccountId,
        debit: 0,
        credit: itemsSubtotal,
        description: `Payable — ${supplierName || 'Supplier'}`,
      });
    }
    if (freight > 0) {
      newLines.push(
        { journal_entry_id: jeId, account_id: inventoryId, debit: freight, credit: 0, description: `Freight (purchase)` },
        { journal_entry_id: jeId, account_id: apAccountId, debit: 0, credit: freight, description: `Payable — freight` },
      );
    }
    if (discount > 0 && discountId) {
      newLines.push(
        { journal_entry_id: jeId, account_id: apAccountId, debit: discount, credit: 0, description: `Purchase discount` },
        { journal_entry_id: jeId, account_id: discountId, debit: 0, credit: discount, description: `Discount received` },
      );
    }
    if (newLines.length > 0) {
      const { error: insErr } = await supabase.from('journal_entry_lines').insert(newLines);
      if (insErr) return { updated: false, error: insErr.message };
    }

    // Keep JE header totals consistent with rebuilt lines (reports may read header first).
    const totalDebit = newLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = newLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    const { error: totalsErr } = await supabase
      .from('journal_entries')
      .update({
        total_debit: totalDebit,
        total_credit: totalCredit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jeId);
    if (totalsErr) return { updated: false, error: totalsErr.message };

    const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
    const editLog = `[Edited ${ts}: Total Rs ${oldSnapshot.total.toLocaleString()} → Rs ${newSnapshot.total.toLocaleString()}]`;
    const baseDesc = (purJe.description || '').replace(/\s*\[Edited[^\]]*\]/g, '').trim();
    await supabase
      .from('journal_entries')
      .update({ description: `${baseDesc} ${editLog}`.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', jeId);

    return { updated: true, error: null };
  } catch (e) {
    return { updated: false, error: (e as Error)?.message ?? String(e) };
  }
}
