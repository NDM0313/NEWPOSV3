/**
 * Shipment Accounting Service
 *
 * Real courier-ledger accounting:
 *
 * CASE A — Customer shipping charge:
 *   Dr  Accounts Receivable (2000)   charged_to_customer
 *   Cr  Shipping Income      (4100)  charged_to_customer
 *
 * CASE B — Courier expense (per-courier sub-ledger 2031, 2032, …):
 *   Dr  Shipping Expense (5100)   actual_cost
 *   Cr  Courier Payable (TCS/Leopard/…)  actual_cost  ← specific account per courier
 *
 * CASE C — Pay Courier:
 *   Dr  Courier Payable (specific courier)   amount
 *   Cr  Cash / Bank                          amount
 *
 * reference_type = 'shipment' | 'courier_payment'
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

/**
 * Get or create the courier payable sub-ledger account (2031, 2032, …) for this contact.
 * Uses DB function get_or_create_courier_payable_account.
 */
async function getOrCreateCourierPayableAccount(
  companyId: string,
  contactId: string | null,
  contactName: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_or_create_courier_payable_account', {
      p_company_id: companyId,
      p_contact_id: contactId,
      p_contact_name: contactName || 'Courier',
    });
    if (error) {
      console.warn('[shipmentAccounting] get_or_create_courier_payable_account RPC error:', error.message);
      return null;
    }
    return data ?? null;
  } catch (e) {
    console.warn('[shipmentAccounting] getOrCreateCourierPayableAccount:', e);
    return null;
  }
}

/**
 * Find the courier payable account_id that was credited in the shipment's journal entry (for reversal).
 */
async function getCourierPayableAccountIdForShipment(shipmentId: string): Promise<string | null> {
  const { data: je } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'shipment')
    .eq('reference_id', shipmentId)
    .limit(1)
    .maybeSingle();
  if (!je?.id) return null;

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, credit')
    .eq('journal_entry_id', je.id);
  if (!lines?.length) return null;

  const creditLine = lines.find((l: any) => Number(l.credit) > 0);
  if (!creditLine) return null;

  const { data: acc } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('id', creditLine.account_id)
    .limit(1)
    .maybeSingle();
  if (acc?.code && /^203[0-9]+$/.test(acc.code)) return acc.id;
  return null;
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
    courierId?: string | null;
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
      courierId,
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

    const label = invoiceNo ? ` – ${invoiceNo}` : '';
    const [arAccount, shippingIncomeAccount, shippingExpenseAccount] = await Promise.all([
      ensureAccount('2000', 'Accounts Receivable', 'Accounts Receivable', companyId),
      ensureAccount('4100', 'Shipping Income', 'Revenue', companyId),
      ensureAccount('5100', 'Shipping Expense', 'Expense', companyId),
    ]);

    // Case B: per-courier payable account (2031, 2032, …)
    let courierPayableAccountId: string | null = null;
    if ((actualCost ?? 0) > 0) {
      courierPayableAccountId = await getOrCreateCourierPayableAccount(
        companyId,
        courierId ?? null,
        courierName ?? 'Courier'
      );
    }

    const lines: JournalEntryLine[] = [];

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

    // Case B: courier cost → Cr specific courier payable account
    if ((actualCost ?? 0) > 0) {
      if (!shippingExpenseAccount?.id || !courierPayableAccountId) {
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
          account_id: courierPayableAccountId,
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

    const [arAccount, shippingIncomeAccount, shippingExpenseAccount, courierPayableAccountId] =
      await Promise.all([
        ensureAccount('2000', 'Accounts Receivable', 'Accounts Receivable', companyId),
        ensureAccount('4100', 'Shipping Income', 'Revenue', companyId),
        ensureAccount('5100', 'Shipping Expense', 'Expense', companyId),
        getCourierPayableAccountIdForShipment(shipmentId),
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

    if ((actualCost ?? 0) > 0 && shippingExpenseAccount?.id && courierPayableAccountId) {
      lines.push({
        id: '', journal_entry_id: '',
        account_id: courierPayableAccountId, debit: actualCost, credit: 0,
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
   * Get courier balance summary (total expense, paid, balance per courier) from courier_summary view.
   */
  async getCourierBalances(companyId: string): Promise<
    { courier_id: string | null; courier_name: string; total_payable: number; total_paid: number; balance: number; total_shipments?: number }[]
  > {
    const { data, error } = await supabase
      .from('courier_summary')
      .select('courier_id, courier_name, total_expense, total_paid, balance_due, total_shipments')
      .eq('company_id', companyId);

    if (error) {
      console.warn('[shipmentAccounting] getCourierBalances (courier_summary):', error.message);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      courier_id: r.courier_id ?? null,
      courier_name: r.courier_name ?? 'Unknown',
      total_payable: Number(r.total_expense) || 0,
      total_paid: Number(r.total_paid) || 0,
      balance: Number(r.balance_due) || 0,
      total_shipments: r.total_shipments ?? 0,
    }));
  },

  /**
   * Get courier ledger (date, description, debit, credit, balance) from courier_ledger view.
   */
  async getCourierLedger(
    companyId: string,
    courierId?: string,
    options?: { limit?: number; offset?: number }
  ) {
    let query = supabase
      .from('courier_ledger')
      .select('company_id, date, courier_name, account_id, courier_id, shipment_id, reference_type, description, debit, credit, balance', { count: 'exact' })
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (courierId) query = query.eq('courier_id', courierId);
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Get shipment-level ledger from shipment_ledger view (income/expense/payable per shipment).
   */
  async getShipmentLedger(
    companyId: string,
    courierId?: string,
    options?: { limit?: number; offset?: number }
  ) {
    let query = supabase
      .from('shipment_ledger')
      .select('shipment_id, company_id, courier_id, courier_name, date, shipping_income, shipping_expense, courier_payable, journal_entry_id, entry_no', { count: 'exact' })
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (courierId) query = query.eq('courier_id', courierId);
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Record courier payment: Dr Courier Payable (specific courier) / Cr Cash or Bank.
   * reference_type = 'courier_payment', reference_id = courier contact_id.
   */
  async recordCourierPayment(params: {
    companyId: string;
    branchId?: string | null;
    courierContactId: string;
    courierName: string;
    amount: number;
    paymentMethod: 'cash' | 'bank' | string;
    paymentDate?: string;
    notes?: string | null;
    performedBy?: string | null;
  }): Promise<string | null> {
    const {
      companyId,
      branchId,
      courierContactId,
      courierName,
      amount,
      paymentMethod,
      paymentDate,
      notes,
      performedBy,
    } = params;

    if (!companyId || !courierContactId || amount <= 0) return null;

    const courierAccountId = await getOrCreateCourierPayableAccount(
      companyId,
      courierContactId,
      courierName
    );
    if (!courierAccountId) {
      console.warn('[shipmentAccounting] Could not get courier payable account');
      return null;
    }

    const cashOrBankAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
      paymentMethod === 'bank' ? 'bank' : 'cash',
      companyId
    );
    if (!cashOrBankAccountId) {
      console.warn('[shipmentAccounting] Cash/Bank account not found');
      return null;
    }

    const entryDate = (paymentDate || new Date().toISOString().split('T')[0]).slice(0, 10);
    const entry: JournalEntry = {
      id: '',
      company_id: companyId,
      branch_id: (branchId && branchId !== 'all') ? branchId : undefined,
      entry_no: `JE-COUR-PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      entry_date: entryDate,
      description: notes ?? `Courier payment – ${courierName}`,
      reference_type: 'courier_payment',
      reference_id: courierContactId,
      created_by: performedBy ?? undefined,
    };

    const lines: JournalEntryLine[] = [
      {
        id: '', journal_entry_id: '',
        account_id: courierAccountId,
        debit: amount, credit: 0,
        description: `Courier payment – ${courierName}`,
      },
      {
        id: '', journal_entry_id: '',
        account_id: cashOrBankAccountId,
        debit: 0, credit: amount,
        description: `Payment to ${courierName}`,
      },
    ];

    try {
      const result = await accountingService.createEntry(entry, lines);
      const jeId = (result as any)?.id ?? null;
      console.log(`[shipmentAccounting] Courier payment recorded for ${courierName}: ${jeId}`);
      return jeId;
    } catch (err: any) {
      console.error('[shipmentAccounting] Failed to record courier payment:', err.message);
      return null;
    }
  },
};
