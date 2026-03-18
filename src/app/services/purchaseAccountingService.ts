/**
 * Purchase Accounting Service (Phase 5: one contract)
 *
 * Source lock: journal_entries + journal_entry_lines + accounts only.
 * COA: 1200 Inventory, 2000 AP, 5210 Discount Received, freight/labor/extra → Dr Inventory Cr AP.
 * Payment isolation: document JEs never touch payment_id; payment has its own flow.
 *
 * Purchase create: in PurchaseContext – Dr Inventory (1200), Cr AP (2000); discount → Dr AP Cr Discount Received (5210); other charges → Dr Inventory Cr AP.
 * Purchase edit: delta JEs only (subtotal, discount, otherCharges); no blanket reversal; payment untouched unless payment changed.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';

export type PurchaseAccountingSnapshot = {
  total: number;
  subtotal: number;
  discount: number;
  /** Sum of charges that are NOT discount (freight, labor, extra, etc.) */
  otherCharges: number;
};

/** Sum amounts from charges by type. */
function sumCharges(
  charges: { charge_type?: string; chargeType?: string; amount?: number }[],
  predicate: (t: string) => boolean
): number {
  return (charges || []).reduce((sum, c) => {
    const t = ((c.charge_type ?? c.chargeType) ?? '').toLowerCase();
    const amt = Number(c.amount ?? 0) || 0;
    return predicate(t) ? sum + amt : sum;
  }, 0);
}

/** Build accounting snapshot from purchase row + charges for delta comparison. */
export function getPurchaseAccountingSnapshot(purchase: {
  total?: number;
  subtotal?: number;
  discount_amount?: number;
  discount?: number;
  charges?: { charge_type?: string; chargeType?: string; amount?: number }[];
  purchase_charges?: { charge_type?: string; chargeType?: string; amount?: number }[];
}): PurchaseAccountingSnapshot {
  const total = Number(purchase?.total ?? 0) || 0;
  const charges = Array.isArray(purchase?.charges) ? purchase.charges : (Array.isArray((purchase as any).purchase_charges) ? (purchase as any).purchase_charges : []);
  const discount = Number(purchase?.discount_amount ?? purchase?.discount ?? 0) || sumCharges(charges, t => t === 'discount');
  const otherCharges = sumCharges(charges, t => t !== 'discount');
  const subtotal = Number(purchase?.subtotal ?? 0) || total + discount - otherCharges;
  if (subtotal <= 0 && total > 0) {
    return { total, subtotal: total + discount - otherCharges, discount, otherCharges };
  }
  return { total, subtotal, discount, otherCharges };
}

/** Check if a purchase journal entry already exists for this purchase (duplicate guard). */
async function purchaseJournalEntryExists(purchaseId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .limit(1)
    .maybeSingle();
  if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) return false;
  return !!data;
}

async function postPurchaseAdjustmentJE(
  companyId: string,
  branchId: string | undefined,
  purchaseId: string,
  entryDate: string,
  createdBy: string | null,
  description: string,
  lines: { accountId: string; debit: number; credit: number; description: string }[]
): Promise<void> {
  const exists = await accountingService.hasExistingPurchaseAdjustmentByDescription(companyId, purchaseId, description);
  if (exists) {
    if (import.meta.env?.DEV) console.log('[purchaseAccountingService] Skipping duplicate purchase_adjustment JE:', description.slice(0, 60));
    return;
  }
  const entryNo = `JE-PUR-ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const fingerprint = `purchase_adjustment:${companyId}:${purchaseId}:${description}`;
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId,
    entry_no: entryNo,
    entry_date: entryDate,
    description,
    reference_type: 'purchase_adjustment',
    reference_id: purchaseId,
    created_by: createdBy || undefined,
    action_fingerprint: fingerprint,
  };
  const lineRows: JournalEntryLine[] = lines.map((l) => ({
    id: '',
    journal_entry_id: '',
    account_id: l.accountId,
    debit: l.debit,
    credit: l.credit,
    description: l.description,
  }));
  await accountingService.createEntry(entry, lineRows);
}

/**
 * Post component-level adjustment JEs for a purchase edit. Original purchase JE is NOT deleted.
 * Only posts deltas for: items subtotal, discount, other charges (freight/labor/extra).
 * Payment is NEVER touched (handled by payments table + supplierPaymentService).
 */
export async function postPurchaseEditAdjustments(params: {
  companyId: string;
  branchId: string | null;
  purchaseId: string;
  poNo: string;
  entryDate: string;
  createdBy: string | null;
  oldSnapshot: PurchaseAccountingSnapshot;
  newSnapshot: PurchaseAccountingSnapshot;
  supplierName: string;
}): Promise<{ adjustmentCount: number }> {
  const { companyId, branchId, purchaseId, poNo, entryDate, createdBy, oldSnapshot, newSnapshot, supplierName } = params;
  let adjustmentCount = 0;

  const branchIdSafe = branchId && branchId !== 'all' ? branchId : undefined;

  // Phase 3: Payment isolation – only document deltas (inventory, AP, discount); never touch payment_id JEs.
  // Resolve accounts once. Phase 2: Inventory canonical = 1200; fallback 1500 then name.
  let inventoryAccountId: string | null = null;
  let apAccountId: string | null = null;
  let discountAccountId: string | null = null;
  const { data: invRows } = await supabase.from('accounts').select('id, code').eq('company_id', companyId).eq('is_active', true).or('code.eq.1200,code.eq.1500,name.ilike.%Inventory%,name.ilike.%Stock%');
  const invList = (invRows || []) as { id: string; code: string }[];
  const inv1200 = invList.find((a) => a.code === '1200');
  const inv1500 = invList.find((a) => a.code === '1500');
  inventoryAccountId = (inv1200 ?? inv1500 ?? invList[0])?.id ?? null;
  if (!inventoryAccountId) {
    const { data: asset } = await supabase.from('accounts').select('id').eq('company_id', companyId).eq('type', 'asset').limit(1);
    inventoryAccountId = asset?.[0]?.id ?? null;
  }
  const { data: apRows } = await supabase.from('accounts').select('id, code').eq('company_id', companyId).eq('is_active', true).or('name.ilike.%Accounts Payable%,code.eq.2000');
  const apList = (apRows || []) as { id: string; code: string }[];
  apAccountId = apList.find((a) => a.code === '2000')?.id ?? apList[0]?.id ?? null;
  const { data: discRows } = await supabase.from('accounts').select('id, code').eq('company_id', companyId).eq('is_active', true).or('code.eq.5210,name.ilike.%Discount Received%,name.ilike.%Purchase Discount%,name.ilike.%Operating Expense%');
  const discList = (discRows || []) as { id: string; code: string }[];
  discountAccountId = discList.find((a) => a.code === '5210')?.id ?? discList[0]?.id ?? null;

  if (!inventoryAccountId || !apAccountId) {
    console.warn('[purchaseAccountingService] Missing Inventory or AP account, skipping adjustments');
    return { adjustmentCount };
  }

  const fmt = (n: number) => Number(n).toLocaleString();

  // 1) Items subtotal delta (purchase value) – Dr Inventory Cr AP (or reverse)
  const deltaSubtotal = Math.round((newSnapshot.subtotal - oldSnapshot.subtotal) * 100) / 100;
  if (deltaSubtotal !== 0) {
    const desc = `Purchase adjustment – value change (was Rs ${fmt(oldSnapshot.subtotal)}, now Rs ${fmt(newSnapshot.subtotal)}) – ${poNo}`;
    if (deltaSubtotal > 0) {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: inventoryAccountId, debit: deltaSubtotal, credit: 0, description: `Inventory – ${poNo}` },
        { accountId: apAccountId, debit: 0, credit: deltaSubtotal, description: `Payable – ${supplierName}` },
      ]);
      adjustmentCount++;
    } else {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: apAccountId, debit: -deltaSubtotal, credit: 0, description: `Payable reversal – ${poNo}` },
        { accountId: inventoryAccountId, debit: 0, credit: -deltaSubtotal, description: `Inventory reversal – ${poNo}` },
      ]);
      adjustmentCount++;
    }
  }

  // 2) Discount delta – Dr AP Cr Discount Received (or reverse)
  const deltaDiscount = Math.round((newSnapshot.discount - oldSnapshot.discount) * 100) / 100;
  if (deltaDiscount !== 0 && discountAccountId) {
    const desc = `Purchase adjustment – discount change (was Rs ${fmt(oldSnapshot.discount)}, now Rs ${fmt(newSnapshot.discount)}) – ${poNo}`;
    if (deltaDiscount > 0) {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: apAccountId, debit: deltaDiscount, credit: 0, description: `Purchase discount – ${poNo}` },
        { accountId: discountAccountId, debit: 0, credit: deltaDiscount, description: `Discount received – ${poNo}` },
      ]);
      adjustmentCount++;
    } else {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: discountAccountId, debit: -deltaDiscount, credit: 0, description: `Discount reversal – ${poNo}` },
        { accountId: apAccountId, debit: 0, credit: -deltaDiscount, description: `Payable reversal – ${poNo}` },
      ]);
      adjustmentCount++;
    }
  }

  // 3) Other charges (freight/labor/extra) – Dr Inventory Cr AP (or reverse)
  const deltaOther = Math.round((newSnapshot.otherCharges - oldSnapshot.otherCharges) * 100) / 100;
  if (deltaOther !== 0) {
    const desc = `Purchase adjustment – freight/expense change (was Rs ${fmt(oldSnapshot.otherCharges)}, now Rs ${fmt(newSnapshot.otherCharges)}) – ${poNo}`;
    if (deltaOther > 0) {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: inventoryAccountId, debit: deltaOther, credit: 0, description: `Freight/expense – ${poNo}` },
        { accountId: apAccountId, debit: 0, credit: deltaOther, description: `Payable – ${poNo}` },
      ]);
      adjustmentCount++;
    } else {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: apAccountId, debit: -deltaOther, credit: 0, description: `Payable reversal – ${poNo}` },
        { accountId: inventoryAccountId, debit: 0, credit: -deltaOther, description: `Freight/expense reversal – ${poNo}` },
      ]);
      adjustmentCount++;
    }
  }

  return { adjustmentCount };
}

export const purchaseAccountingService = {
  getPurchaseAccountingSnapshot,
  postPurchaseEditAdjustments,
  purchaseJournalEntryExists,
};
