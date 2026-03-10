/**
 * Shipment Accounting Service
 *
 * Handles journal entry creation for courier shipments and courier-vendor management.
 *
 * CASE A — Customer charge (charged_to_customer > 0):
 *   Dr  Accounts Receivable (2000)   charged_to_customer
 *   Cr  Shipping Income      (4100)  charged_to_customer
 *
 * CASE B — Courier actual cost (actual_cost > 0):
 *   Dr  Shipping Expense (5100)   actual_cost
 *   Cr  Courier Payable  (2030)   actual_cost
 *
 * Each shipment generates ONE journal entry covering both legs (if applicable).
 * reference_type = 'shipment' / reference_id = shipment.id
 *
 * Duplicate protection: one entry per shipment id.
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureAccount(
  code: string,
  name: string,
  type: string,
  companyId: string
): Promise<{ id: string } | null> {
  const existing = await accountHelperService.getAccountByCode(code, companyId);
  if (existing?.id) return existing;

  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ company_id: companyId, code, name, type, balance: 0, is_active: true })
      .select('id')
      .single();
    if (!error && data?.id) {
      console.log(`[shipmentAccounting] Auto-created account ${code} (${name})`);
      return data;
    }
  } catch (e) {
    console.warn(`[shipmentAccounting] Could not create account ${code}:`, e);
  }
  return null;
}

async function shipmentJournalEntryExists(shipmentId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'shipment')
      .eq('reference_id', shipmentId)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Courier contact / payable ledger helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure a courier company exists in contacts as type='supplier'.
 * Returns the contact id.
 */
export async function ensureCourierContact(
  courierName: string,
  companyId: string
): Promise<string | null> {
  if (!courierName?.trim()) return null;

  // Check if already exists by name (case-insensitive) as supplier
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('company_id', companyId)
    .ilike('name', courierName.trim())
    .in('type', ['supplier', 'both'])
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  // Create the courier as a supplier contact
  try {
    const { data: created, error } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        type: 'supplier',
        name: courierName.trim(),
        notes: `Auto-created courier contact for ${courierName.trim()}`,
        is_active: true,
      })
      .select('id')
      .single();

    if (!error && created?.id) {
      console.log(`[shipmentAccounting] Auto-created courier contact: ${courierName}`);
      return created.id;
    }
  } catch (e) {
    console.warn(`[shipmentAccounting] Could not create courier contact "${courierName}":`, e);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shipment History Logger
// ─────────────────────────────────────────────────────────────────────────────

export async function logShipmentHistory(params: {
  shipmentId: string;
  companyId: string;
  status: string;
  trackingNumber?: string | null;
  courierName?: string | null;
  chargedToCustomer?: number;
  actualCost?: number;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  try {
    await supabase.from('shipment_history').insert({
      shipment_id: params.shipmentId,
      company_id: params.companyId,
      status: params.status,
      tracking_number: params.trackingNumber ?? null,
      courier_name: params.courierName ?? null,
      charged_to_customer: params.chargedToCustomer ?? 0,
      actual_cost: params.actualCost ?? 0,
      notes: params.notes ?? null,
      created_by: params.createdBy ?? null,
    });
  } catch (e) {
    console.warn('[shipmentAccounting] Failed to log shipment history:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main service
// ─────────────────────────────────────────────────────────────────────────────

export const shipmentAccountingService = {
  /**
   * Create journal entries for a shipment.
   *
   * Case A (charged_to_customer > 0):
   *   Dr Accounts Receivable (2000)  /  Cr Shipping Income (4100)
   *
   * Case B (actual_cost > 0):
   *   Dr Shipping Expense (5100)  /  Cr Courier Payable (2030)
   *
   * Both cases are written in a single journal entry.
   * Safe to call multiple times — duplicate is detected and skipped.
   */
  async createShipmentJournalEntry(params: {
    shipmentId: string;
    companyId: string;
    branchId?: string | null;
    chargedToCustomer: number;
    actualCost: number;
    courierName?: string | null;
    invoiceNo?: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const {
      shipmentId,
      companyId,
      branchId,
      chargedToCustomer,
      actualCost,
      courierName,
      invoiceNo,
      performedBy,
    } = params;

    if (!shipmentId || !companyId) return null;

    // Skip if nothing to record
    if ((chargedToCustomer ?? 0) <= 0 && (actualCost ?? 0) <= 0) return null;

    // Duplicate guard
    if (await shipmentJournalEntryExists(shipmentId)) {
      console.log(`[shipmentAccounting] Journal entry already exists for shipment ${shipmentId}`);
      return null;
    }

    // Fetch/create required accounts
    const [arAccount, shippingIncomeAccount, shippingExpenseAccount, courierPayableAccount] =
      await Promise.all([
        ensureAccount('2000', 'Accounts Receivable', 'Accounts Receivable', companyId),
        ensureAccount('4100', 'Shipping Income', 'Revenue', companyId),
        ensureAccount('5100', 'Shipping Expense', 'Expense', companyId),
        ensureAccount('2030', 'Courier Payable', 'Liability', companyId),
      ]);

    const lines: JournalEntryLine[] = [];
    const label = invoiceNo ? ` – ${invoiceNo}` : '';

    // Case A: customer charge
    if ((chargedToCustomer ?? 0) > 0) {
      if (!arAccount?.id || !shippingIncomeAccount?.id) {
        console.warn('[shipmentAccounting] Missing AR or Shipping Income account');
      } else {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: arAccount.id,
          debit: chargedToCustomer,
          credit: 0,
          description: `Shipping charged to customer${label}`,
        });
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: shippingIncomeAccount.id,
          debit: 0,
          credit: chargedToCustomer,
          description: `Shipping Income${label}`,
        });
      }
    }

    // Case B: courier cost
    if ((actualCost ?? 0) > 0) {
      if (!shippingExpenseAccount?.id || !courierPayableAccount?.id) {
        console.warn('[shipmentAccounting] Missing Shipping Expense or Courier Payable account');
      } else {
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: shippingExpenseAccount.id,
          debit: actualCost,
          credit: 0,
          description: `Shipping expense – ${courierName ?? 'Courier'}${label}`,
        });
        lines.push({
          id: '',
          journal_entry_id: '',
          account_id: courierPayableAccount.id,
          debit: 0,
          credit: actualCost,
          description: `Courier Payable – ${courierName ?? 'Courier'}${label}`,
        });
      }
    }

    if (lines.length === 0) return null;

    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: (branchId && branchId !== 'all') ? branchId : undefined,
      entry_no: `JE-SHIP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Shipment accounting${label}`,
      reference_type: 'shipment',
      reference_id: shipmentId,
      created_by: performedBy ?? undefined,
    };

    try {
      const result = await accountingService.createEntry(entry, lines);
      const jeId = (result as any)?.id ?? null;
      console.log(`[shipmentAccounting] Journal entry created for shipment ${shipmentId}: ${jeId}`);
      return jeId;
    } catch (err: any) {
      console.error('[shipmentAccounting] Failed to create journal entry:', err.message);
      return null;
    }
  },

  /**
   * Reverse a shipment journal entry (e.g. shipment cancelled / deleted).
   */
  async reverseShipmentJournalEntry(params: {
    shipmentId: string;
    companyId: string;
    branchId?: string | null;
    chargedToCustomer: number;
    actualCost: number;
    courierName?: string | null;
    invoiceNo?: string;
    performedBy?: string | null;
  }): Promise<string | null> {
    const {
      shipmentId, companyId, branchId,
      chargedToCustomer, actualCost, courierName, invoiceNo, performedBy,
    } = params;

    if (!shipmentId || !companyId) return null;
    if (!(await shipmentJournalEntryExists(shipmentId))) return null;

    const [arAccount, shippingIncomeAccount, shippingExpenseAccount, courierPayableAccount] =
      await Promise.all([
        ensureAccount('2000', 'Accounts Receivable', 'Accounts Receivable', companyId),
        ensureAccount('4100', 'Shipping Income', 'Revenue', companyId),
        ensureAccount('5100', 'Shipping Expense', 'Expense', companyId),
        ensureAccount('2030', 'Courier Payable', 'Liability', companyId),
      ]);

    const lines: JournalEntryLine[] = [];
    const label = invoiceNo ? ` – ${invoiceNo}` : '';

    if ((chargedToCustomer ?? 0) > 0 && arAccount?.id && shippingIncomeAccount?.id) {
      lines.push({
        id: '', journal_entry_id: '',
        account_id: shippingIncomeAccount.id, debit: chargedToCustomer, credit: 0,
        description: `Reversal Shipping Income${label}`,
      });
      lines.push({
        id: '', journal_entry_id: '',
        account_id: arAccount.id, debit: 0, credit: chargedToCustomer,
        description: `Reversal AR Shipping${label}`,
      });
    }

    if ((actualCost ?? 0) > 0 && shippingExpenseAccount?.id && courierPayableAccount?.id) {
      lines.push({
        id: '', journal_entry_id: '',
        account_id: courierPayableAccount.id, debit: actualCost, credit: 0,
        description: `Reversal Courier Payable – ${courierName ?? 'Courier'}${label}`,
      });
      lines.push({
        id: '', journal_entry_id: '',
        account_id: shippingExpenseAccount.id, debit: 0, credit: actualCost,
        description: `Reversal Shipping Expense${label}`,
      });
    }

    if (lines.length === 0) return null;

    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: (branchId && branchId !== 'all') ? branchId : undefined,
      entry_no: `JE-SHIP-REV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      entry_date: new Date().toISOString().split('T')[0],
      description: `Shipment reversal${label}`,
      reference_type: 'shipment_reversal',
      reference_id: shipmentId,
      created_by: performedBy ?? undefined,
    };

    try {
      const result = await accountingService.createEntry(entry, lines);
      return (result as any)?.id ?? null;
    } catch (err: any) {
      console.error('[shipmentAccounting] Failed to create reversal entry:', err.message);
      return null;
    }
  },

  /**
   * Get shipment history records for a shipment.
   */
  async getShipmentHistory(shipmentId: string) {
    const { data, error } = await supabase
      .from('shipment_history')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get courier balance summary (total payable per courier for a company).
   */
  async getCourierBalances(companyId: string): Promise<
    { courier_id: string | null; courier_name: string; total_payable: number; total_paid: number; balance: number }[]
  > {
    // Sum Courier Payable credits vs debits from journal_entry_lines
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('company_id', companyId)
      .eq('code', '2030')
      .limit(1)
      .maybeSingle();

    if (!accounts?.id) return [];

    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit, credit,
        journal_entry:journal_entries!inner(
          company_id, reference_type, reference_id
        )
      `)
      .eq('account_id', accounts.id);

    if (!lines?.length) return [];

    // Build courier payable totals by shipment then group by courier
    const shipmentIds = lines
      .filter((l: any) => l.journal_entry?.reference_type === 'shipment')
      .map((l: any) => l.journal_entry.reference_id)
      .filter(Boolean);

    if (!shipmentIds.length) return [];

    const { data: shipments } = await supabase
      .from('sale_shipments')
      .select('id, courier_id, courier_name')
      .in('id', [...new Set(shipmentIds)]);

    const shipmentMap = new Map(
      (shipments ?? []).map((s: any) => [s.id, { courier_id: s.courier_id, courier_name: s.courier_name }])
    );

    // Group credits/debits by courier
    const courierTotals: Record<string, { courier_id: string | null; courier_name: string; credit: number; debit: number }> = {};

    lines.forEach((l: any) => {
      const je = l.journal_entry;
      if (!je || je.company_id !== companyId || je.reference_type !== 'shipment') return;
      const shipment = shipmentMap.get(je.reference_id);
      if (!shipment) return;

      const key = shipment.courier_id ?? shipment.courier_name ?? 'unknown';
      if (!courierTotals[key]) {
        courierTotals[key] = {
          courier_id: shipment.courier_id ?? null,
          courier_name: shipment.courier_name ?? 'Unknown',
          credit: 0,
          debit: 0,
        };
      }
      courierTotals[key].credit += Number(l.credit) || 0;
      courierTotals[key].debit += Number(l.debit) || 0;
    });

    return Object.values(courierTotals).map((c) => ({
      courier_id: c.courier_id,
      courier_name: c.courier_name,
      total_payable: Math.round(c.credit * 100) / 100,
      total_paid: Math.round(c.debit * 100) / 100,
      balance: Math.round((c.credit - c.debit) * 100) / 100,
    }));
  },

  /**
   * Get shipment ledger entries for a company (from the shipment_ledger view).
   */
  async getShipmentLedger(companyId: string, courierId?: string) {
    let query = supabase
      .from('shipment_ledger')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (courierId) {
      query = query.eq('courier_id', courierId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
};
