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
import { pickCanonicalInventoryAssetAccount } from '@/app/lib/inventoryAccountRouting';
import { canPostAccountingForPurchaseStatus } from '@/app/lib/postingStatusGate';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';
import { resolvePayablePostingAccountId } from './partySubledgerAccountService';

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

/**
 * Canonical purchase document JE:
 * - reference_type = 'purchase'
 * - reference_id = purchase id
 * - payment_id IS NULL
 * - not void
 */
export function purchaseDocumentJournalFingerprint(companyId: string, purchaseId: string): string {
  return `purchase_document:${companyId}:${purchaseId}`;
}

export async function findActiveCanonicalPurchaseDocumentJournalEntryId(purchaseId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .is('payment_id', null)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) return null;
  if (error) return null;
  const row = (data as { id: string }[] | null)?.[0];
  return row?.id ?? null;
}

export async function listActiveCanonicalPurchaseDocumentJournalEntryIds(purchaseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, is_void')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId)
    .is('payment_id', null)
    .or('is_void.is.null,is_void.eq.false');
  if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) return [];
  if (error || !data?.length) return [];
  return (data as { id: string; is_void?: boolean | null }[])
    .filter((r) => r.is_void !== true)
    .map((r) => r.id)
    .filter(Boolean);
}

/** Backward-compatible boolean guard used by context flows. */
async function purchaseJournalEntryExists(purchaseId: string): Promise<boolean> {
  const id = await findActiveCanonicalPurchaseDocumentJournalEntryId(purchaseId);
  return !!id;
}

async function assertPurchaseEligibleForDocumentJournal(purchaseId: string, poNo: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, status, po_no')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error || !data) {
    console.warn('[purchaseAccountingService] Cannot load purchase for accounting guard:', purchaseId, error?.message);
    return false;
  }
  const status = (data as { status?: string }).status;
  const dbPo = String((data as { po_no?: string }).po_no ?? '').trim() || poNo;
  if (!canPostAccountingForPurchaseStatus(status)) {
    console.warn(
      `[purchaseAccountingService] Blocked document JE for ${dbPo}: purchase status is "${status}" (only final/received may post inventory/AP document).`
    );
    return false;
  }
  if (!dbPo) {
    console.warn(
      `[purchaseAccountingService] Blocked document JE for purchase ${purchaseId}: posted status but po_no is empty — assign final PO number before posting.`
    );
    return false;
  }
  return true;
}

/** Posting inventory asset: canonical leaf **1200** (never chart group **1090**). */
async function resolveInventoryGlAccountIdForPurchase(companyId: string): Promise<string | null> {
  const { data: invRows, error } = await supabase
    .from('accounts')
    .select('id, code, type, name, is_group, is_active')
    .eq('company_id', companyId)
    .or('code.eq.1200,code.eq.1500,type.eq.inventory');
  if (error) {
    console.warn('[purchaseAccountingService] resolveInventoryGlAccountId:', error.message);
    return null;
  }
  const rows = (invRows || []).map(
    (a: { id: string; code?: string; type?: string; name?: string; is_group?: boolean; is_active?: boolean }) => ({
      id: a.id,
      code: a.code,
      type: a.type,
      name: a.name,
      is_group: a.is_group === true,
      isActive: a.is_active !== false,
    })
  );
  return pickCanonicalInventoryAssetAccount(rows)?.id ?? null;
}

export async function createPurchaseJournalEntry(params: {
  purchaseId: string;
  companyId: string;
  branchId?: string | null;
  total: number;
  subtotal?: number;
  poNo: string;
  supplierName: string;
  entryDate?: string;
  charges?: Array<{ charge_type?: string; chargeType?: string; amount?: number }>;
  createdBy?: string | null;
}): Promise<string | null> {
  const {
    purchaseId,
    companyId,
    branchId,
    total,
    subtotal,
    poNo,
    supplierName,
    entryDate,
    charges = [],
    createdBy,
  } = params;
  if (!purchaseId || !companyId) return null;
  if ((Number(total) || 0) <= 0) return null;

  const eligible = await assertPurchaseEligibleForDocumentJournal(purchaseId, poNo);
  if (!eligible) return null;

  const existingId = await findActiveCanonicalPurchaseDocumentJournalEntryId(purchaseId);
  if (existingId) {
    console.log(`[purchaseAccountingService] Canonical purchase document JE already exists for ${poNo}, reusing ${existingId}`);
    return existingId;
  }

  const { data: purRow } = await supabase.from('purchases').select('supplier_id').eq('id', purchaseId).maybeSingle();
  const supplierContactId = (purRow as { supplier_id?: string | null } | null)?.supplier_id ?? null;

  let inventoryAccountId: string | null = await resolveInventoryGlAccountIdForPurchase(companyId);
  let apAccountId: string | null = null;
  let discountAccountId: string | null = null;
  if (!inventoryAccountId) {
    console.warn('[purchaseAccountingService] No canonical inventory (1200) for company', companyId);
    return null;
  }
  const { data: apRows } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('name.ilike.%Accounts Payable%,code.eq.2000');
  const apList = (apRows || []) as { id: string; code: string }[];
  apAccountId = apList.find((a) => a.code === '2000')?.id ?? apList[0]?.id ?? null;
  const apPartyCreate = await resolvePayablePostingAccountId(companyId, supplierContactId || undefined);
  if (apPartyCreate) apAccountId = apPartyCreate;
  const { data: discRows } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('code.eq.5210,name.ilike.%Discount Received%,name.ilike.%Purchase Discount%,name.ilike.%Operating Expense%');
  const discList = (discRows || []) as { id: string; code: string }[];
  discountAccountId = discList.find((a) => a.code === '5210')?.id ?? discList[0]?.id ?? null;
  if (!inventoryAccountId || !apAccountId) return null;

  const itemsSubtotal = Number(subtotal ?? 0) || Number(total) || 0;
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: `JE-PUR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    entry_date: entryDate || new Date().toISOString().slice(0, 10),
    description: `Purchase ${poNo} from ${supplierName}`,
    reference_type: 'purchase',
    reference_id: purchaseId,
    created_by: createdBy || undefined,
    action_fingerprint: purchaseDocumentJournalFingerprint(companyId, purchaseId),
  };

  const lines: JournalEntryLine[] = [];
  if (itemsSubtotal > 0) {
    lines.push(
      { id: '', journal_entry_id: '', account_id: inventoryAccountId, debit: itemsSubtotal, credit: 0, description: `Inventory purchase ${poNo}` },
      { id: '', journal_entry_id: '', account_id: apAccountId, debit: 0, credit: itemsSubtotal, description: `Payable to ${supplierName}` },
    );
  }
  for (const c of charges) {
    const amount = Number(c?.amount ?? 0);
    const type = String(c?.charge_type ?? c?.chargeType ?? '').toLowerCase();
    if (amount <= 0) continue;
    if (type === 'discount' && discountAccountId) {
      lines.push(
        { id: '', journal_entry_id: '', account_id: apAccountId, debit: amount, credit: 0, description: 'Purchase discount' },
        { id: '', journal_entry_id: '', account_id: discountAccountId, debit: 0, credit: amount, description: 'Discount received' },
      );
    } else {
      lines.push(
        { id: '', journal_entry_id: '', account_id: inventoryAccountId, debit: amount, credit: 0, description: `${type || 'charge'} (purchase)` },
        { id: '', journal_entry_id: '', account_id: apAccountId, debit: 0, credit: amount, description: `Payable - ${type || 'charge'}` },
      );
    }
  }
  if (!lines.length) return null;
  const result = await accountingService.createEntry(entry, lines);
  return (result as { id?: string } | null)?.id ?? null;
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

  const { data: purSupplier } = await supabase.from('purchases').select('supplier_id').eq('id', purchaseId).maybeSingle();
  const supplierContactId = (purSupplier as { supplier_id?: string | null } | null)?.supplier_id ?? null;

  // Phase 3: Payment isolation – only document deltas (inventory, AP, discount); never touch payment_id JEs.
  let inventoryAccountId: string | null = await resolveInventoryGlAccountIdForPurchase(companyId);
  let apAccountId: string | null = null;
  let discountAccountId: string | null = null;
  const { data: apRows } = await supabase.from('accounts').select('id, code').eq('company_id', companyId).eq('is_active', true).or('name.ilike.%Accounts Payable%,code.eq.2000');
  const apList = (apRows || []) as { id: string; code: string }[];
  apAccountId = apList.find((a) => a.code === '2000')?.id ?? apList[0]?.id ?? null;
  const apPartyId = await resolvePayablePostingAccountId(companyId, supplierContactId || undefined);
  const effectiveApId = apPartyId || apAccountId;
  const { data: discRows } = await supabase.from('accounts').select('id, code').eq('company_id', companyId).eq('is_active', true).or('code.eq.5210,name.ilike.%Discount Received%,name.ilike.%Purchase Discount%,name.ilike.%Operating Expense%');
  const discList = (discRows || []) as { id: string; code: string }[];
  discountAccountId = discList.find((a) => a.code === '5210')?.id ?? discList[0]?.id ?? null;

  if (!inventoryAccountId || !effectiveApId) {
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
        { accountId: effectiveApId!, debit: 0, credit: deltaSubtotal, description: `Payable – ${supplierName}` },
      ]);
      adjustmentCount++;
    } else {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: effectiveApId!, debit: -deltaSubtotal, credit: 0, description: `Payable reversal – ${poNo}` },
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
        { accountId: effectiveApId!, debit: deltaDiscount, credit: 0, description: `Purchase discount – ${poNo}` },
        { accountId: discountAccountId, debit: 0, credit: deltaDiscount, description: `Discount received – ${poNo}` },
      ]);
      adjustmentCount++;
    } else {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: discountAccountId, debit: -deltaDiscount, credit: 0, description: `Discount reversal – ${poNo}` },
        { accountId: effectiveApId!, debit: 0, credit: -deltaDiscount, description: `Payable reversal – ${poNo}` },
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
        { accountId: effectiveApId!, debit: 0, credit: deltaOther, description: `Payable – ${poNo}` },
      ]);
      adjustmentCount++;
    } else {
      await postPurchaseAdjustmentJE(companyId, branchIdSafe, purchaseId, entryDate, createdBy, desc, [
        { accountId: effectiveApId!, debit: -deltaOther, credit: 0, description: `Payable reversal – ${poNo}` },
        { accountId: inventoryAccountId, debit: 0, credit: -deltaOther, description: `Freight/expense reversal – ${poNo}` },
      ]);
      adjustmentCount++;
    }
  }

  return { adjustmentCount };
}

/**
 * Cancel of posted purchase: mirror canonical document JE lines into purchase_reversal (original document JE kept for audit).
 * Idempotent: returns existing active reversal JE id if present.
 */
export async function reversePurchaseDocumentJournalEntry(params: {
  purchaseId: string;
  companyId: string;
  branchId?: string | null;
  poNo: string;
  performedBy?: string | null;
}): Promise<string | null> {
  const { purchaseId, companyId, branchId, poNo, performedBy } = params;
  if (!purchaseId || !companyId) return null;

  const { data: revExisting } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'purchase_reversal')
    .eq('reference_id', purchaseId)
    .is('payment_id', null)
    .or('is_void.is.null,is_void.eq.false')
    .limit(1);
  const revRow = (revExisting as { id: string }[] | null)?.[0];
  if (revRow?.id) return revRow.id;

  const docId = await findActiveCanonicalPurchaseDocumentJournalEntryId(purchaseId);
  if (!docId) {
    console.log(`[purchaseAccountingService] No canonical purchase document JE for ${poNo}, skipping reversal`);
    return null;
  }

  const { data: lines, error: linesErr } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit, credit, description')
    .eq('journal_entry_id', docId);
  if (linesErr || !lines?.length) {
    console.warn('[purchaseAccountingService] Could not load lines for purchase reversal:', linesErr?.message);
    return null;
  }

  const entryNo = `JE-PUR-REV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const entryDate = new Date().toISOString().split('T')[0];
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchId && branchId !== 'all' ? branchId : undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Purchase cancelled – reversal of ${poNo}`,
    reference_type: 'purchase_reversal',
    reference_id: purchaseId,
    created_by: performedBy || undefined,
  };

  const lineRows: JournalEntryLine[] = (lines as { account_id: string; debit: number; credit: number; description?: string }[]).map(
    (l) => ({
      id: '',
      journal_entry_id: '',
      account_id: l.account_id,
      debit: Number(l.credit) || 0,
      credit: Number(l.debit) || 0,
      description: l.description ? `Reversal: ${l.description}` : `Reversal – ${poNo}`,
    })
  );

  try {
    const result = await accountingService.createEntry(entry, lineRows);
    return (result as { id?: string })?.id ?? null;
  } catch (e: any) {
    console.error('[purchaseAccountingService] Failed to create purchase reversal JE:', e?.message);
    return null;
  }
}

export const purchaseAccountingService = {
  getPurchaseAccountingSnapshot,
  postPurchaseEditAdjustments,
  purchaseJournalEntryExists,
  createPurchaseJournalEntry,
  findActiveCanonicalPurchaseDocumentJournalEntryId,
  listActiveCanonicalPurchaseDocumentJournalEntryIds,
  purchaseDocumentJournalFingerprint,
  reversePurchaseDocumentJournalEntry,
};
