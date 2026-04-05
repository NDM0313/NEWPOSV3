import { supabase } from '@/lib/supabase';
import { fetchCustomerLedgerSalesForRange, ledgerSalesRpcBranchId } from '@/app/services/customerLedgerApi';

export interface JournalEntry {
  id?: string;
  company_id: string;
  branch_id?: string;
  entry_no?: string;
  entry_date: string;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  payment_id?: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Optional attachments (same as payments: [{ url, name }]). Requires journal_entries.attachments column. */
  attachments?: { url: string; name: string }[] | null;
  /** PF-14.5B: Logical action fingerprint for duplicate prevention; same fingerprint must not create multiple active JEs. */
  action_fingerprint?: string | null;
}

export interface JournalEntryLine {
  id?: string;
  journal_entry_id?: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
  created_at?: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
}

export interface AccountLedgerEntry {
  date: string;
  /** ISO datetime for sort/display (from journal_entries.created_at) */
  created_at?: string;
  reference_number: string;
  entry_no?: string | null; // Actual entry_no from database (for lookup)
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  source_module: string;
  created_by?: string;
  journal_entry_id: string;
  payment_id?: string;
  sale_id?: string;
  rental_id?: string;
  branch_id?: string;
  branch_name?: string;
  account_name?: string; // Payment Account name (from account_id)
  /** Other account(s) in this double-entry (e.g. "Bank ABC" when viewing Cash ledger) */
  counter_account?: string;
  notes?: string; // User notes/narration (separate from description)
  document_type?: string; // Document Type (Sale, Payment, etc.)
  /** GL account code on the viewed line (e.g. 2000, 2010) for multi-account party views */
  gl_account_code?: string;
  /** correction_reversal rows; UI can style distinctly */
  ledger_kind?: 'standard' | 'reversal';
}

/**
 * Some postings create two AR credit lines for the same receipt (e.g. `reference_type=payment` plus
 * a `sale` JE with `payment_id` set). That double-counts running balance and statements — keep one line per payment.
 */
function journalLineNormalizedPaymentId(line: { journal_entry?: any; credit?: number }): string | null {
  const entry = line.journal_entry;
  if (!entry) return null;
  const credit = Number(line.credit || 0);
  if (credit <= 0) return null;
  if (entry.payment_id) return String(entry.payment_id);
  if (entry.reference_type === 'payment' && entry.reference_id) return String(entry.reference_id);
  return null;
}

/**
 * Customer receipts: Dr Cash/Bank, Cr AR. Supplier payments: Dr AP, Cr Bank.
 * Remap the aggregated debit line to payment_account_id only when that debit is a liquidity (cash/bank/wallet) line
 * left stale after a payment-method edit. If we remap AP or expense debits, the modal shows the same bank on both sides.
 */
function isLiquidityDebitForPaymentRemap(account: { code?: string; name?: string; type?: string } | null | undefined): boolean {
  if (!account) return false;
  const code = String(account.code ?? '').trim();
  const name = (account.name ?? '').toLowerCase();
  const type = (account.type ?? '').toLowerCase();
  if (type.includes('liability') || type.includes('payable')) return false;
  if (type.includes('expense') || type.includes('cost')) return false;
  if (name.includes('payable') && !name.includes('receivable')) return false;
  if (name.includes('receivable') && (name.includes('account') || name.includes('customer'))) return false;
  if (type.includes('cash') || type.includes('bank') || type.includes('wallet')) return true;
  if (
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('wallet') ||
    name.includes('easypaisa') ||
    name.includes('jazzcash')
  )
    return true;
  const codeNum = parseInt(code, 10);
  if (!Number.isNaN(codeNum) && codeNum >= 1000 && codeNum <= 1099) return true;
  return false;
}

function dedupeCustomerArPaymentCreditLines(sortedLines: any[]): any[] {
  const byPayment = new Map<string, any[]>();
  for (const line of sortedLines) {
    const pid = journalLineNormalizedPaymentId(line);
    if (!pid) continue;
    const g = byPayment.get(pid) || [];
    g.push(line);
    byPayment.set(pid, g);
  }
  const skip = new Set<any>();
  for (const [, lines] of byPayment) {
    if (lines.length <= 1) continue;
    const preferred =
      lines.find((l: any) => l.journal_entry?.reference_type === 'payment') ||
      lines.find((l: any) => Boolean(l.journal_entry?.payment_id)) ||
      lines[0];
    for (const l of lines) {
      if (l !== preferred) skip.add(l);
    }
  }
  return sortedLines.filter((l) => !skip.has(l));
}

/**
 * Whether an AR journal line belongs to this customer (before correction_reversal handling).
 * Used by getCustomerLedger; reversal rows are included separately when they reverse such a line.
 */
function arJournalLineMatchesCustomer(
  line: any,
  customerId: string,
  salesMap: Map<string, any>,
  paymentIds: string[],
  paymentDetailsMap: Map<string, any>
): boolean {
  const entry = line.journal_entry;
  if (!entry) return false;

  const desc = entry.description?.toLowerCase() || '';
  if (desc.includes('commission')) return false;

  if ((entry.reference_type === 'sale' || entry.reference_type === 'sale_adjustment') && entry.reference_id) {
    const sale = salesMap.get(entry.reference_id);
    if (sale && sale.customer_id === customerId) return true;
  }

  if (entry.reference_type === 'payment' && entry.reference_id) {
    if (paymentIds.includes(entry.reference_id)) return true;
    const payment = paymentDetailsMap.get(entry.reference_id);
    if (payment && payment.reference_id) {
      const sale = salesMap.get(payment.reference_id);
      if (sale && sale.customer_id === customerId) return true;
    }
  }

  if (entry.reference_type === 'sale' && entry.payment_id) {
    if (paymentIds.includes(entry.payment_id)) return true;
    if (entry.reference_id) {
      const sale = salesMap.get(entry.reference_id);
      if (sale && sale.customer_id === customerId) return true;
    }
  }

  if (entry.reference_type === 'manual_receipt' && entry.payment_id && paymentIds.includes(entry.payment_id)) {
    return true;
  }
  if (entry.reference_type === 'manual_receipt' && entry.reference_id && String(entry.reference_id) === String(customerId)) {
    return true;
  }
  if (
    entry.reference_type === 'opening_balance_contact_ar' &&
    entry.reference_id &&
    String(entry.reference_id) === String(customerId)
  ) {
    return true;
  }
  if (entry.reference_type === 'rental') {
    return false;
  }
  return false;
}

function supplierApJournalLineMatchesSupplier(
  line: any,
  supplierId: string,
  supplierPurchaseIds: Set<string>,
  supplierPaymentIds: Set<string>
): boolean {
  const entry = line.journal_entry;
  if (!entry) return false;
  const rt = String(entry.reference_type || '').toLowerCase();
  const rid = entry.reference_id;
  if (
    ['purchase', 'purchase_return', 'purchase_adjustment', 'purchase_reversal'].includes(rt) &&
    rid &&
    supplierPurchaseIds.has(rid)
  ) {
    return true;
  }
  if (entry.payment_id && supplierPaymentIds.has(entry.payment_id)) return true;
  if (rt === 'payment' && rid && supplierPaymentIds.has(rid)) return true;
  if (rt === 'on_account' && rid && String(rid) === String(supplierId)) return true;
  if (rt === 'manual_payment' && rid && String(rid) === String(supplierId)) return true;
  if (rt === 'opening_balance_contact_ap' && rid && String(rid) === String(supplierId)) return true;
  return false;
}

function workerGlLineMatchesWorker(line: any, workerId: string, workerPaymentIds: Set<string>): boolean {
  const entry = line.journal_entry;
  if (!entry) return false;
  const rt = String(entry.reference_type || '').toLowerCase();
  const rid = entry.reference_id;
  if ((rt === 'worker_payment' || rt === 'worker_advance_settlement') && rid && String(rid) === String(workerId)) {
    return true;
  }
  if (rt === 'opening_balance_contact_worker' && rid && String(rid) === String(workerId)) {
    return true;
  }
  if (entry.payment_id && workerPaymentIds.has(entry.payment_id)) return true;
  return false;
}

export const accountingService = {
  // Get all journal entries with lines
  // CRITICAL: Filter out entries for deleted purchases/sales
  async getAllEntries(companyId: string, branchId?: string, startDate?: string | Date, endDate?: string | Date) {
    try {
      // Normalize dates to ISO YYYY-MM-DD so PostgREST accepts them (Date objects get serialized incorrectly otherwise).
      const startStr = startDate == null ? undefined : typeof startDate === 'string' ? startDate.slice(0, 10) : startDate.toISOString().slice(0, 10);
      const endStr = endDate == null ? undefined : typeof endDate === 'string' ? endDate.slice(0, 10) : endDate.toISOString().slice(0, 10);

      // SOURCE LOCK (Phase 1): journal_entries + journal_entry_lines only for GL.
      // Embed account name per line for display; avoid payment embed so query works when payment_id column is missing.
      let query = supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            id,
            journal_entry_id,
            account_id,
            debit,
            credit,
            description,
            account:accounts(name, code, type)
          )
        `)
        .eq('company_id', companyId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Include company-wide JEs (NULL branch) when a branch is selected — matches TB / party GL readers.
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      if (startStr) {
        query = query.gte('entry_date', startStr);
      }

      if (endStr) {
        query = query.lte('entry_date', endStr);
      }

      const { data, error } = await query;
      
      // Handle missing table gracefully
      if (error && (error.code === 'PGRST205' || error.message?.includes('does not exist'))) {
        console.warn('[ACCOUNTING SERVICE] journal_entries table does not exist, returning empty array');
        return [];
      }
      
      if (error) {
        console.error('[ACCOUNTING SERVICE] Error fetching journal entries:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // PF-14.4: Exclude voided entries from business ledgers/reports (audit can show all via raw query).
      const dataFiltered = (data as any[]).filter((e: any) => e.is_void !== true);

      // CRITICAL: Filter out entries for deleted purchases/sales
      const purchaseIds = dataFiltered
        .filter(e => e.reference_type === 'purchase' && e.reference_id)
        .map(e => e.reference_id) as string[];
      
      const saleIds = dataFiltered
        .filter((e: any) => (e.reference_type === 'sale' || e.reference_type === 'sale_adjustment') && e.reference_id)
        .map((e: any) => e.reference_id) as string[];
      
      const paymentIds = dataFiltered
        .filter((e: any) => (e.reference_type === 'payment' || e.reference_type === 'payment_adjustment') && e.reference_id)
        .map((e: any) => e.reference_id) as string[];
      const uniquePaymentIds = [...new Set(paymentIds)];

      // Check which purchases/sales still exist
      let existingPurchases: Set<string> = new Set();
      let existingSales: Set<string> = new Set();
      let validPayments: Set<string> = new Set();
      let paymentsList: { id: string; reference_type?: string; reference_id?: string }[] = [];

      if (purchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('id')
          .in('id', purchaseIds);
        
        if (purchases) {
          existingPurchases = new Set(purchases.map((p: any) => p.id));
        }
      }

      if (saleIds.length > 0) {
        const { data: sales } = await supabase
          .from('sales')
          .select('id')
          .in('id', saleIds);
        
        if (sales) {
          existingSales = new Set(sales.map((s: any) => s.id));
        }
      }

      // For payments, check if the referenced purchase/sale exists (payment + payment_adjustment both use payment id)
      if (uniquePaymentIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('id, reference_type, reference_id')
          .in('id', uniquePaymentIds);
        
        if (payments) {
          paymentsList = payments;
          const purchaseRefs = payments
            .filter((p: any) => p.reference_type === 'purchase' && p.reference_id)
            .map((p: any) => p.reference_id) as string[];
          
          const saleRefs = payments
            .filter((p: any) => p.reference_type === 'sale' && p.reference_id)
            .map((p: any) => p.reference_id) as string[];

          // Check if referenced purchases exist
          if (purchaseRefs.length > 0) {
            const { data: purchaseChecks } = await supabase
              .from('purchases')
              .select('id')
              .in('id', purchaseRefs);
            
            if (purchaseChecks) {
              const validPurchaseIds = new Set(purchaseChecks.map((p: any) => p.id));
              payments
                .filter((p: any) => p.reference_type === 'purchase' && validPurchaseIds.has(p.reference_id))
                .forEach((p: any) => validPayments.add(p.id));
            }
          }

          // Check if referenced sales exist
          if (saleRefs.length > 0) {
            const { data: saleChecks } = await supabase
              .from('sales')
              .select('id')
              .in('id', saleRefs);
            
            if (saleChecks) {
              const validSaleIds = new Set(saleChecks.map((s: any) => s.id));
              payments
                .filter((p: any) => p.reference_type === 'sale' && validSaleIds.has(p.reference_id))
                .forEach((p: any) => validPayments.add(p.id));
            }
          }

          // Payments without reference_type or with other types are valid
          payments
            .filter((p: any) => !p.reference_type || (p.reference_type !== 'purchase' && p.reference_type !== 'sale'))
            .forEach((p: any) => validPayments.add(p.id));
        }
      }

      // Filter entries: only include if purchase/sale/payment still exists (no per-entry logging on load)
      let validEntries = dataFiltered.filter((entry: any) => {
        if (entry.reference_type === 'purchase' && entry.reference_id && !existingPurchases.has(entry.reference_id)) return false;
        if (entry.reference_type === 'purchase_adjustment' && entry.reference_id && !existingPurchases.has(entry.reference_id)) return false;
        if (entry.reference_type === 'sale' && entry.reference_id && !existingSales.has(entry.reference_id)) return false;
        if (entry.reference_type === 'sale_adjustment' && entry.reference_id && !existingSales.has(entry.reference_id)) return false;
        if (entry.reference_type === 'payment' && entry.reference_id && !validPayments.has(entry.reference_id)) return false;
        if (entry.reference_type === 'payment_adjustment' && entry.reference_id && !validPayments.has(entry.reference_id)) return false;
        return true;
      });

      if (import.meta.env?.DEV && validEntries.length !== dataFiltered.length) {
        console.log(`[ACCOUNTING SERVICE] Filtered ${dataFiltered.length} entries to ${validEntries.length} valid entries`);
      }

      // Party name on payment row → journal list / workbench can show "AP — Supplier" without extra round-trips in UI.
      const payIds = [...new Set(validEntries.map((e: any) => e.payment_id).filter(Boolean))] as string[];
      const paymentContactNameByPaymentId = new Map<string, string>();
      if (payIds.length > 0) {
        const { data: payPartyRows } = await supabase
          .from('payments')
          .select('id, contact_id, contact:contacts(name)')
          .in('id', payIds);
        (payPartyRows || []).forEach((p: any) => {
          const c = Array.isArray(p.contact) ? p.contact[0] : p.contact;
          const nm = c?.name && String(c.name).trim();
          if (nm) paymentContactNameByPaymentId.set(String(p.id), nm);
        });
      }
      validEntries = validEntries.map((e: any) => ({
        ...e,
        _payment_contact_name: e.payment_id ? paymentContactNameByPaymentId.get(String(e.payment_id)) : undefined,
      }));

      const purchaseIdsForParty = [
        ...new Set(
          validEntries
            .filter((e: any) => String(e.reference_type || '').toLowerCase() === 'purchase' && e.reference_id)
            .map((e: any) => String(e.reference_id))
        ),
      ] as string[];
      const purchaseSupplierNameByPurchaseId = new Map<string, string>();
      if (purchaseIdsForParty.length > 0) {
        const { data: purs } = await supabase
          .from('purchases')
          .select('id, supplier_id')
          .in('id', purchaseIdsForParty);
        const supIds = [...new Set((purs || []).map((p: any) => p.supplier_id).filter(Boolean))] as string[];
        if (supIds.length > 0) {
          const { data: supContacts } = await supabase.from('contacts').select('id, name').in('id', supIds);
          const nmBySup = new Map((supContacts || []).map((c: any) => [String(c.id), String(c.name || '').trim()]));
          (purs || []).forEach((p: any) => {
            const nm = p.supplier_id ? nmBySup.get(String(p.supplier_id)) : '';
            if (nm) purchaseSupplierNameByPurchaseId.set(String(p.id), nm);
          });
        }
      }
      validEntries = validEntries.map((e: any) => ({
        ...e,
        _purchase_supplier_name:
          String(e.reference_type || '').toLowerCase() === 'purchase' && e.reference_id
            ? purchaseSupplierNameByPurchaseId.get(String(e.reference_id))
            : undefined,
      }));

      // PF-14.3B: Root-document grouping – attach root_reference_type and root_reference_id so Journal list can show one logical row per sale
      const paymentIdToRoot = new Map<string, { root_reference_type: string; root_reference_id: string }>();
      paymentsList.forEach((p: any) => {
          if (p.reference_type === 'sale' && p.reference_id) {
            paymentIdToRoot.set(p.id, { root_reference_type: 'sale', root_reference_id: p.reference_id });
          }
          if (p.reference_type === 'purchase' && p.reference_id) {
            paymentIdToRoot.set(p.id, { root_reference_type: 'purchase', root_reference_id: p.reference_id });
          }
      });
      const enrichedEntries = validEntries.map((entry: any) => {
        const out = { ...entry };
        if (entry.reference_type === 'sale' || entry.reference_type === 'sale_adjustment') {
          if (entry.reference_id) {
            out.root_reference_type = 'sale';
            out.root_reference_id = entry.reference_id;
          }
        } else if (entry.reference_type === 'payment' || entry.reference_type === 'payment_adjustment') {
          if (entry.reference_id) {
            const root = paymentIdToRoot.get(entry.reference_id);
            if (root) {
              out.root_reference_type = root.root_reference_type;
              out.root_reference_id = root.root_reference_id;
            }
          }
        } else if ((entry.reference_type === 'purchase' || entry.reference_type === 'purchase_adjustment') && entry.reference_id) {
          out.root_reference_type = 'purchase';
          out.root_reference_id = entry.reference_id;
        }
        return out;
      });

      return enrichedEntries;
    } catch (error: any) {
      console.warn('[ACCOUNTING SERVICE] Error:', error.message);
      return [];
    }
  },

  // Get single journal entry with lines
  async getEntry(id: string) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * PF-14.4: Idempotency – check if a sale_adjustment JE already exists for this sale with the same description.
   * Prevents duplicate JEs when postSaleEditAdjustments is called multiple times for the same logical edit.
   */
  async hasExistingSaleAdjustmentByDescription(
    companyId: string,
    saleId: string,
    description: string
  ): Promise<boolean> {
    if (!companyId || !saleId || !description?.trim()) return false;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale_adjustment')
      .eq('reference_id', saleId)
      .eq('description', description)
      .or('is_void.is.null,is_void.eq.false')
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  },

  /**
   * PF-COMPONENT: Idempotency for purchase_adjustment JEs (component-level edit engine).
   */
  async hasExistingPurchaseAdjustmentByDescription(
    companyId: string,
    purchaseId: string,
    description: string
  ): Promise<boolean> {
    if (!companyId || !purchaseId || !description?.trim()) return false;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'purchase_adjustment')
      .eq('reference_id', purchaseId)
      .eq('description', description)
      .or('is_void.is.null,is_void.eq.false')
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  },

  /**
   * PF-14.4: Idempotency – check if a payment_adjustment JE already exists for this payment with same amount edit.
   * Matches description pattern "was Rs X, now Rs Y" so duplicate amount edits do not create extra JEs.
   */
  async hasExistingPaymentAmountAdjustment(
    companyId: string,
    paymentId: string,
    oldAmount: number,
    newAmount: number
  ): Promise<boolean> {
    if (!companyId || !paymentId) return false;
    const o = Number(oldAmount);
    const n = Number(newAmount);
    const needle1 = `was Rs ${o.toLocaleString()}, now Rs ${n.toLocaleString()}`;
    const needle2 = `was Rs ${o}, now Rs ${n}`;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, description')
      .eq('company_id', companyId)
      .eq('reference_type', 'payment_adjustment')
      .eq('reference_id', paymentId)
      .or('is_void.is.null,is_void.eq.false');
    if (error || !data?.length) return false;
    return data.some((row: { description?: string }) => {
      const d = row.description || '';
      return d.includes(needle1) || d.includes(needle2);
    });
  },

  /**
   * PF-14.4: Idempotency – check if a payment_adjustment JE already exists for this payment moving
   * the same amount from oldAccountId to newAccountId (Dr new, Cr old). Prevents duplicate
   * "Payment account changed" JEs from syncPaymentAccountAdjustmentsForCompany or repeated UI saves.
   */
  async hasExistingPaymentAccountAdjustment(
    companyId: string,
    paymentId: string,
    oldAccountId: string,
    newAccountId: string,
    amount: number
  ): Promise<boolean> {
    if (!companyId || !paymentId || !oldAccountId || !newAccountId || amount <= 0) return false;
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'payment_adjustment')
      .eq('reference_id', paymentId)
      .ilike('description', '%Payment account changed%')
      .or('is_void.is.null,is_void.eq.false');
    if (error || !entries?.length) return false;
    const jeIds = entries.map((e: { id: string }) => e.id);
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id, account_id, debit, credit')
      .in('journal_entry_id', jeIds);
    if (!lines?.length) return false;
    const amountRounded = Math.round(amount * 100) / 100;
    const byJe = new Map<string, { debit: Map<string, number>; credit: Map<string, number> }>();
    for (const line of lines as { journal_entry_id: string; account_id: string; debit: number; credit: number }[]) {
      if (!byJe.has(line.journal_entry_id)) {
        byJe.set(line.journal_entry_id, { debit: new Map(), credit: new Map() });
      }
      const rec = byJe.get(line.journal_entry_id)!;
      const d = (rec.debit.get(line.account_id) ?? 0) + Number(line.debit ?? 0);
      const c = (rec.credit.get(line.account_id) ?? 0) + Number(line.credit ?? 0);
      rec.debit.set(line.account_id, d);
      rec.credit.set(line.account_id, c);
    }
    for (const [, rec] of byJe) {
      const newDebit = rec.debit.get(newAccountId) ?? 0;
      const oldCredit = rec.credit.get(oldAccountId) ?? 0;
      if (Math.abs(newDebit - amountRounded) < 0.02 && Math.abs(oldCredit - amountRounded) < 0.02) return true;
    }
    return false;
  },

  /**
   * Create a safe reversal journal entry for manual correction (PF-07).
   * Creates a new JE with same accounts but swapped debit/credit; links via reference_type
   * 'correction_reversal' and reference_id = original JE id. No deletes; reports stay consistent.
   *
   * Idempotent: at most one active correction_reversal per original JE (race-safe with DB unique index).
   */
  async createReversalEntry(
    companyId: string,
    branchId: string | null,
    originalJournalEntryId: string,
    createdBy?: string | null,
    reason?: string
  ): Promise<{ id: string; alreadyExisted: boolean } | null> {
    console.log('[PAYMENT_REVERSAL_TRACE]', JSON.stringify({ phase: 'start', companyId, originalJournalEntryId }));
    const findActiveReversal = async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'correction_reversal')
        .eq('reference_id', originalJournalEntryId)
        .or('is_void.is.null,is_void.eq.false')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return (data as { id: string }).id;
    };

    const existingId = await findActiveReversal();
    if (existingId) {
      console.log('[PAYMENT_REVERSAL_TRACE]', JSON.stringify({ phase: 'already_exists', originalJournalEntryId, reversalId: existingId }));
      return { id: existingId, alreadyExisted: true };
    }

    const original = await this.getEntry(originalJournalEntryId).catch(() => null);
    if (!original || (original as any).company_id !== companyId) {
      return null;
    }
    const lines = (original as any).lines;
    if (!Array.isArray(lines) || lines.length === 0) {
      return null;
    }
    const entryNo = `JE-REV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const entryDate = new Date().toISOString().split('T')[0];
    const description = reason?.trim()
      ? `Reversal: ${reason}`
      : `Reversal of: ${(original as any).description || (original as any).entry_no || 'Journal entry'}`;
    const reversalEntry: JournalEntry = {
      company_id: companyId,
      branch_id: branchId || undefined,
      entry_no: entryNo,
      entry_date: entryDate,
      description,
      reference_type: 'correction_reversal',
      reference_id: originalJournalEntryId,
      created_by: createdBy || null,
    };
    const reversalLines: JournalEntryLine[] = lines.map((line: any) => ({
      account_id: line.account_id,
      debit: line.credit || 0,
      credit: line.debit || 0,
      description: line.description ? `Reversal: ${line.description}` : undefined,
    }));
    try {
      const result = await this.createEntry(reversalEntry, reversalLines);
      if (!result) return null;
      console.log('[PAYMENT_REVERSAL_TRACE]', JSON.stringify({ phase: 'reversal_je_created', originalJournalEntryId, reversalId: (result as any).id }));
      // Live customer ledger: reversing the posted receipt/payment JE voids linked operational payment rows
      // (manual_receipt / on_account) so FIFO allocations clear and sale due recomputes.
      try {
        const pid = (original as any).payment_id as string | null | undefined;
        if (pid) {
          const { data: prow } = await supabase
            .from('payments')
            .select('id, reference_type, voided_at')
            .eq('id', pid)
            .eq('company_id', companyId)
            .maybeSingle();
          const rt = String((prow as any)?.reference_type || '');
          if (
            prow &&
            !(prow as any).voided_at &&
            (rt === 'manual_receipt' || rt === 'on_account' || rt === 'manual_payment')
          ) {
            const { voidPaymentAfterJournalReversal } = await import('@/app/services/paymentLifecycleService');
            await voidPaymentAfterJournalReversal({ companyId, paymentId: pid });
            console.log('[PAYMENT_REVERSAL_TRACE]', JSON.stringify({ phase: 'payment_voided', paymentId: pid, reference_type: rt }));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('paymentAdded'));
              if (rt === 'manual_payment') {
                const cid = (prow as any).contact_id as string | null | undefined;
                window.dispatchEvent(
                  new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: cid || undefined } })
                );
              } else {
                window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer' } }));
              }
            }
          }
        }
      } catch (voidErr: any) {
        console.warn('[ACCOUNTING] Reversal posted but linked payment void failed:', voidErr?.message || voidErr);
      }
      // Rental module: rental_payments rows (not in payments table) — void + recompute paid/due
      try {
        const { rentalService } = await import('@/app/services/rentalService');
        const rv = await rentalService.voidRentalPaymentByReversedJournal(companyId, originalJournalEntryId);
        if (rv && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rentalPaymentsChanged'));
        }
      } catch (rentalVoidErr: any) {
        console.warn('[ACCOUNTING] Reversal posted but rental payment void failed:', rentalVoidErr?.message || rentalVoidErr);
      }
      return { id: (result as any).id, alreadyExisted: false };
    } catch (e: any) {
      const dup =
        e?.code === '23505' ||
        String(e?.message || '').toLowerCase().includes('duplicate') ||
        String(e?.message || '').toLowerCase().includes('unique');
      if (dup) {
        const again = await findActiveReversal();
        if (again) return { id: again, alreadyExisted: true };
      }
      throw e;
    }
  },

  // Get journal entry by reference number
  // Get journal entry by ID (PRIMARY METHOD - NO GUESSING)
  async getEntryById(journalEntryId: string, companyId: string) {
    if (!journalEntryId || !companyId) {
      console.error('[ACCOUNTING SERVICE] getEntryById: Missing journalEntryId or companyId');
      return null;
    }

    console.log('[ACCOUNTING SERVICE] getEntryById:', { journalEntryId, companyId });

    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(id, name, code, type)
        ),
        payment:payments(id, reference_number, amount, payment_method, payment_date, contact_id, payment_account_id),
        branch:branches(id, name, code)
      `)
      .eq('id', journalEntryId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('[ACCOUNTING SERVICE] getEntryById error:', error);
      return null;
    }

    if (!data) {
      console.warn('[ACCOUNTING SERVICE] getEntryById: No entry found for ID:', journalEntryId);
      return null;
    }

    // CRITICAL FIX: Fetch sale data separately if reference_type is 'sale'
    if (data.reference_type === 'sale' && data.reference_id) {
      try {
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .select('id, invoice_no, customer_name, total, paid_amount, due_amount, customer_id')
          .eq('id', data.reference_id)
          .single();
        
        if (!saleError && saleData) {
          (data as any).sale = saleData;
        }
      } catch (saleErr) {
        console.warn('[ACCOUNTING SERVICE] Could not fetch sale data:', saleErr);
      }
    }

    console.log('[ACCOUNTING SERVICE] getEntryById SUCCESS:', { entry_no: data.entry_no, id: data.id });
    return data;
  },

  /**
   * Effective journal lines for a payment: original payment JE + any payment_adjustment JEs,
   * aggregated by account so the modal shows the correct accounts (e.g. Bank after edit from Cash).
   * If currentPaymentAccountId is provided and the stored JEs still show a different **liquidity** debit account
   * (customer receipt: Dr Bank was wrong ID until adjustment posts), returns synthetic lines with the current
   * payment account. Supplier payments (Dr AP, Cr Bank) must not use this path — see isLiquidityDebitForPaymentRemap.
   */
  async getEffectiveJournalLinesForPayment(
    paymentId: string,
    companyId: string,
    currentPaymentAccountId?: string | null
  ): Promise<{ id: string; account_id: string; account: { id: string; name: string; code?: string; type?: string }; debit: number; credit: number }[]> {
    if (!paymentId || !companyId) return [];
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select(`
        id,
        reference_type,
        is_void,
        lines:journal_entry_lines(
          id,
          account_id,
          debit,
          credit,
          account:accounts(id, name, code, type)
        )
      `)
      .eq('company_id', companyId)
      .or(`payment_id.eq.${paymentId},and(reference_type.eq.payment_adjustment,reference_id.eq.${paymentId})`);

    if (error || !entries?.length) return [];
    // PF-14.5B: Exclude voided JEs from effective lines
    const nonVoidEntries = (entries as any[]).filter((e: any) => e.is_void !== true);
    if (nonVoidEntries.length === 0) return [];

    const byAccount = new Map<string, { debit: number; credit: number; account: any }>();
    for (const je of nonVoidEntries) {
      const lines = (je as any).lines ?? [];
      for (const line of lines) {
        const acc = line.account ?? {};
        const aid = line.account_id ?? '';
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);
        if (!byAccount.has(aid)) {
          byAccount.set(aid, { debit: 0, credit: 0, account: { id: acc.id, name: acc.name ?? 'Unknown', code: acc.code, type: acc.type } });
        }
        const row = byAccount.get(aid)!;
        row.debit += debit;
        row.credit += credit;
      }
    }

    let result = Array.from(byAccount.entries())
      .filter(([, row]) => row.debit > 0 || row.credit > 0)
      .map(([account_id, row]) => ({
        id: '',
        account_id,
        account: row.account,
        debit: Math.round(row.debit * 100) / 100,
        credit: Math.round(row.credit * 100) / 100,
      }));

    if (currentPaymentAccountId && result.length >= 2) {
      const debitAccountRow = result.find((r) => r.debit > 0);
      if (
        debitAccountRow &&
        debitAccountRow.account_id !== currentPaymentAccountId &&
        isLiquidityDebitForPaymentRemap(debitAccountRow.account)
      ) {
        const { data: accRow } = await supabase
          .from('accounts')
          .select('id, name, code, type')
          .eq('id', currentPaymentAccountId)
          .single();
        const name = (accRow as any)?.name ?? 'Account';
        const code = (accRow as any)?.code;
        result = [
          { id: '', account_id: currentPaymentAccountId, account: { id: currentPaymentAccountId, name, code, type: (accRow as any)?.type }, debit: debitAccountRow.debit, credit: 0 },
          ...result.filter((r) => r.credit > 0),
        ];
      }
    }
    return result;
  },

  // CRITICAL FIX: Lookup by entry_no, payment reference_number, or invoice_no (FALLBACK ONLY)
  async getEntryByReference(referenceNumber: string, companyId: string) {
    if (!referenceNumber || !companyId) {
      console.error('[ACCOUNTING SERVICE] getEntryByReference: Missing referenceNumber or companyId');
      return null;
    }

    // CRITICAL: Don't force uppercase - preserve original case for exact match
    // But use uppercase for ilike search (case-insensitive)
    const cleanRef = referenceNumber.trim();
    const cleanRefUpper = cleanRef.toUpperCase();
    
    // STEP 1: Try to find by journal_entries.entry_no (primary lookup)
    let { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_entry_lines(
          *,
          account:accounts(id, name, code, type)
        ),
        payment:payments(id, reference_number, amount, payment_method, payment_date, payment_account_id),
        branch:branches(id, name, code)
      `)
      .eq('company_id', companyId)
      .ilike('entry_no', cleanRefUpper) // Use uppercase for case-insensitive search
      .maybeSingle();
    
    // STEP 2: If not found by entry_no, try payment reference_number
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: paymentData } = await supabase
        .from('payments')
        .select('id')
        .eq('company_id', companyId)
        .ilike('reference_number', cleanRef)
        .maybeSingle();

      if (paymentData) {
        const { data: jeData, error: jeError } = await supabase
          .from('journal_entries')
          .select(`
            *,
            lines:journal_entry_lines(
              *,
              account:accounts(id, name, code, type)
            ),
            payment:payments(id, reference_number, amount, payment_method, payment_date, payment_account_id),
            branch:branches(id, name, code)
          `)
          .eq('company_id', companyId)
          .eq('payment_id', paymentData.id)
          .maybeSingle();
        
        if (jeData) {
          data = jeData;
          error = null;
        } else if (jeError && jeError.code !== 'PGRST116') {
          error = jeError;
        }
      }
    }

    // STEP 3: If still not found, try invoice_no (for sales)
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: saleData } = await supabase
        .from('sales')
        .select('id')
        .eq('company_id', companyId)
        .ilike('invoice_no', cleanRef)
        .maybeSingle();

      if (saleData) {
        const { data: jeData, error: jeError } = await supabase
          .from('journal_entries')
          .select(`
            *,
            lines:journal_entry_lines(
              *,
              account:accounts(id, name, code, type)
            ),
          payment:payments(id, reference_number, amount, payment_method, payment_date, payment_account_id),
          sale:sales(id, invoice_no, customer_name, total, paid_amount, due_amount),
            branch:branches(id, name, code)
          `)
          .eq('company_id', companyId)
          .eq('reference_type', 'sale')
          .eq('reference_id', saleData.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (jeData) {
          data = jeData;
          error = null;
          // CRITICAL FIX: Fetch sale data separately if needed
          if (jeData.reference_type === 'sale' && jeData.reference_id) {
            try {
              const { data: saleData } = await supabase
                .from('sales')
                .select('id, invoice_no, customer_name, total, paid_amount, due_amount')
                .eq('id', jeData.reference_id)
                .single();
              if (saleData) (data as any).sale = saleData;
            } catch {}
          }
        } else if (jeError && jeError.code !== 'PGRST116') {
          error = jeError;
        }
      }
    }

    // STEP 4: If still not found, try exact match on entry_no (case-sensitive)
    if (!data && (!error || error.code === 'PGRST116')) {
      const { data: exactData, error: exactError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:accounts(id, name, code, type)
          ),
          payment:payments(id, reference_number, amount, payment_method, payment_date, payment_account_id),
          branch:branches(id, name, code)
        `)
        .eq('company_id', companyId)
        .eq('entry_no', referenceNumber.trim()) // Exact match (case-sensitive)
        .maybeSingle();
      
      if (exactData) {
        data = exactData;
        error = null;
      } else if (exactError && exactError.code !== 'PGRST116') {
        error = exactError;
      }
    }

    // STEP 5: If still not found and reference looks like JE-XXXX (generated from ID),
    // try to find by matching the pattern in entry_no
    if (!data && (!error || error.code === 'PGRST116')) {
      // Try partial match - if reference is JE-0066, try to find entries with entry_no containing this
      const { data: patternData, error: patternError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(
            *,
            account:accounts(id, name, code, type)
          ),
          payment:payments(id, reference_number, amount, payment_method, payment_date, payment_account_id),
          branch:branches(id, name, code)
        `)
        .eq('company_id', companyId)
        .ilike('entry_no', '%' + cleanRefUpper + '%')
        .limit(1)
        .maybeSingle();
      
      if (patternData) {
        data = patternData;
        error = null;
      } else if (patternError && patternError.code !== 'PGRST116') {
        error = patternError;
      }
    }

    // Log if not found
    if (!data && error && error.code !== 'PGRST116') {
      console.error('[ACCOUNTING SERVICE] Error finding entry by reference:', error);
      console.error('[ACCOUNTING SERVICE] Reference searched:', cleanRef, 'Original:', referenceNumber);
    }

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  },

  // Get account ledger entries
  async getAccountLedger(
    accountId: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
    branchId?: string,
    searchTerm?: string
  ): Promise<AccountLedgerEntry[]> {
    try {
      // Get all journal entry lines for this account, scoped to this company via inner join
      // Sort by Date ASC, then ID ASC (as per requirements)
      let query = supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entry:journal_entries!inner(
            id,
            entry_no,
            entry_date,
            description,
            reference_type,
            reference_id,
            payment_id,
            branch_id,
            created_by,
            created_at,
            company_id,
            is_void,
            branch:branches(id, name, code)
          )
        `)
        .eq('account_id', accountId)
        .eq('journal_entries.company_id', companyId)
        .order('created_at', { ascending: true });

      const { data: lines, error } = await query;

      if (error) {
        console.error('[ACCOUNTING SERVICE] Error fetching ledger:', error);
        return [];
      }

      if (!lines || lines.length === 0) {
        return [];
      }

      // Phase 7: Current balance from journal only (single source of truth). Exclude voided JEs.
      const currentBalance = (lines as any[]).reduce((sum: number, line: any) => {
        const entry = line.journal_entry;
        if (!entry || (entry as any).is_void === true) return sum;
        return sum + ((line.debit || 0) - (line.credit || 0));
      }, 0);

      // Get payment references for entries that need them (batch fetch)
      const paymentIds = lines
        .map((line: any) => line.journal_entry?.payment_id)
        .filter((id: string | undefined) => id) as string[];
      
      const paymentRefsMap = new Map<string, string>();
      if (paymentIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments')
          .select('id, reference_number')
          .in('id', paymentIds);
        
        if (payments) {
          payments.forEach((p: any) => {
            if (p.reference_number) {
              paymentRefsMap.set(p.id, p.reference_number);
            }
          });
        }
      }

      // Build ledger entries with running balance
      // First filter, then sort by Date ASC, ID ASC (as per requirements)
      // PF-14.5B: Exclude voided JEs from business ledger
      const filteredLines = lines.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        if ((entry as any).is_void === true) return false;
        
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        
        // Include NULL branch_id JEs when a branch is selected (company-wide openings).
        if (branchId && entry.branch_id != null && entry.branch_id !== '' && entry.branch_id !== branchId) {
          return false;
        }
        
        // Apply search filter if provided
        if (searchTerm && searchTerm.trim()) {
          const search = searchTerm.toLowerCase().trim();
          const entryNo = entry.entry_no?.toLowerCase() || '';
          const description = (entry.description || line.description || '').toLowerCase();
          const amount = ((line.debit || 0) + (line.credit || 0)).toString();
          
          if (!entryNo.includes(search) && 
              !description.includes(search) && 
              !amount.includes(search)) {
            return false;
          }
        }
        
        return true;
      });

      // Sort by posting date ASC, then created_at (time) ASC, then JE id (stable)
      filteredLines.sort((a: any, b: any) => {
        const dateA = new Date(a.journal_entry?.entry_date || 0).getTime();
        const dateB = new Date(b.journal_entry?.entry_date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const tA = a.journal_entry?.created_at ? new Date(a.journal_entry.created_at).getTime() : 0;
        const tB = b.journal_entry?.created_at ? new Date(b.journal_entry.created_at).getTime() : 0;
        if (tA !== tB) return tA - tB;
        const idA = a.journal_entry?.id || '';
        const idB = b.journal_entry?.id || '';
        return idA.localeCompare(idB);
      });

      // Fetch counter-account names (other side of double-entry) for each journal entry
      const jeIds = [...new Set(filteredLines.map((l: any) => l.journal_entry?.id).filter(Boolean))] as string[];
      const counterAccountMap = new Map<string, string>();
      if (jeIds.length > 0) {
        const { data: otherLines } = await supabase
          .from('journal_entry_lines')
          .select('journal_entry_id, account_id, account:accounts(name)')
          .in('journal_entry_id', jeIds)
          .neq('account_id', accountId);
        for (const ol of otherLines || []) {
          const name = (ol as any).account?.name ?? 'Unknown';
          const arr = counterAccountMap.get(ol.journal_entry_id) ? `${counterAccountMap.get(ol.journal_entry_id)}, ${name}` : name;
          counterAccountMap.set(ol.journal_entry_id, arr);
        }
      }

      // Reversal rows: resolve original JE entry_no for clear pairing (avoids "duplicate" confusion)
      const reversalTargetIds = [
        ...new Set(
          filteredLines
            .map((l: any) => l.journal_entry)
            .filter(
              (e: any) =>
                e && String(e.reference_type || '').toLowerCase() === 'correction_reversal' && e.reference_id
            )
            .map((e: any) => e.reference_id as string)
        ),
      ];
      const reversedEntryNoByJeId = new Map<string, string>();
      if (reversalTargetIds.length > 0) {
        const { data: origJes } = await supabase
          .from('journal_entries')
          .select('id, entry_no')
          .eq('company_id', companyId)
          .in('id', reversalTargetIds);
        (origJes || []).forEach((r: any) => {
          if (r?.id) reversedEntryNoByJeId.set(r.id, String(r.entry_no || '').trim() || r.id.slice(0, 8));
        });
      }

      // Expense documents: show EXP-no · JE-no so two postings for same expense are distinguishable
      const expenseDocIds = [
        ...new Set(
          filteredLines
            .map((l: any) => l.journal_entry)
            .filter((e: any) => {
              const rt = String(e?.reference_type || '').toLowerCase();
              return e?.reference_id && (rt === 'expense' || rt === 'extra_expense');
            })
            .map((e: any) => e.reference_id as string)
        ),
      ];
      const expenseNoById = new Map<string, string>();
      if (expenseDocIds.length > 0) {
        const { data: exRows } = await supabase
          .from('expenses')
          .select('id, expense_no')
          .eq('company_id', companyId)
          .in('id', expenseDocIds);
        (exRows || []).forEach((r: any) => {
          if (r?.id && r.expense_no) expenseNoById.set(r.id, String(r.expense_no).trim());
        });
      }

      // Opening balance = current balance minus sum of movements in this range (so running balance is correct for each row)
      const totalMovementInRange = filteredLines.reduce(
        (sum: number, line: any) => sum + ((line.debit || 0) - (line.credit || 0)),
        0
      );
      let runningBalance = currentBalance - totalMovementInRange;

      const isUuidOrBad = (s: string | null | undefined) => {
        if (!s || !s.trim()) return true;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim())) return true;
        return false;
      };

      const ledgerEntries: AccountLedgerEntry[] = filteredLines.map((line: any) => {
          const entry = line.journal_entry;
          runningBalance += (line.debit || 0) - (line.credit || 0);

          const refType = String(entry.reference_type || '').toLowerCase();
          let ledgerKind: 'standard' | 'reversal' | undefined;

          let sourceModule = 'Accounting';
          if (refType === 'sale') {
            sourceModule = 'Sales';
          } else if (refType === 'correction_reversal') {
            sourceModule = 'Reversal';
          } else if (entry.payment_id) {
            sourceModule = 'Payment';
          }

          let referenceNumber = entry.entry_no;
          const isUUID = referenceNumber && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referenceNumber);
          const isShortFormat = referenceNumber && /^[A-Z]+-[0-9]+$/.test(referenceNumber);

          if (refType === 'correction_reversal') {
            ledgerKind = 'reversal';
            const origNo = entry.reference_id ? reversedEntryNoByJeId.get(entry.reference_id) : '';
            const selfJe =
              entry.entry_no && /^[A-Z]+-[0-9]+$/i.test(String(entry.entry_no))
                ? String(entry.entry_no)
                : `JE-${String(entry.id).slice(0, 4).toUpperCase()}`;
            referenceNumber = origNo ? `REV of ${origNo}` : `${selfJe} (reversal)`;
          } else if (!referenceNumber || referenceNumber.length > 20 || isUUID || !isShortFormat) {
            if (entry.payment_id && paymentRefsMap.has(entry.payment_id)) {
              referenceNumber = paymentRefsMap.get(entry.payment_id)!;
            } else if (refType === 'expense' || refType === 'extra_expense') {
              referenceNumber = `EXP-${entry.id.substring(0, 4).toUpperCase()}`;
            } else if (refType === 'sale') {
              referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
            } else {
              referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
            }
          }

          if ((refType === 'expense' || refType === 'extra_expense') && entry.reference_id) {
            const expNo = expenseNoById.get(entry.reference_id);
            const jeNo =
              entry.entry_no && /^[A-Z]+-[0-9]+$/i.test(String(entry.entry_no)) ? String(entry.entry_no) : null;
            if (expNo && jeNo) {
              referenceNumber = `${expNo} · ${jeNo}`;
            } else if (expNo) {
              referenceNumber = expNo;
            }
          }

          let description = entry.description || line.description || '';
          if (refType === 'correction_reversal') {
            const origNo = entry.reference_id ? reversedEntryNoByJeId.get(entry.reference_id) : '';
            const base = (entry.description || line.description || '').trim();
            if (origNo) {
              description = base.toLowerCase().includes('reversal of')
                ? base
                : `Reversal of ${origNo}${base ? ` — ${base}` : ''}`;
            } else if (isUuidOrBad(description)) {
              description = `Reversal ${referenceNumber}`;
            }
          } else if (isUuidOrBad(description)) {
            if (refType === 'payment') description = `Payment ${referenceNumber}`;
            else if (refType === 'sale' || refType === 'sale_adjustment') description = `Sale ${referenceNumber}`;
            else if (refType === 'purchase') description = `Purchase ${referenceNumber}`;
            else if (refType === 'expense' || refType === 'extra_expense') description = `Expense ${referenceNumber}`;
            else if (refType === 'rental') description = `Rental ${referenceNumber}`;
            else description = `Journal entry ${referenceNumber}`;
          }

          const branch = (entry as any).branch;
          const branchName = branch ? (branch.code ? `${branch.code} | ${branch.name}` : branch.name) : null;
          const counterAccount = counterAccountMap.get(entry.id) || null;

          return {
            date: entry.entry_date,
            created_at: (entry as any).created_at,
            reference_number: referenceNumber,
            entry_no: entry.entry_no,
            description,
            debit: line.debit || 0,
            credit: line.credit || 0,
            running_balance: runningBalance,
            source_module: sourceModule,
            created_by: entry.created_by,
            journal_entry_id: entry.id,
            payment_id: entry.payment_id,
            sale_id: entry.reference_id,
            branch_id: entry.branch_id,
            branch_name: branchName,
            counter_account: counterAccount ?? undefined,
            ledger_kind: ledgerKind,
          };
        });

      // PHASE 5: LOG FINAL RESULTS
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - FINAL RESULT:', {
        totalEntries: ledgerEntries.length,
        totalDebit: ledgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0),
        totalCredit: ledgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0),
        sampleEntries: ledgerEntries.slice(0, 3).map(e => ({
          reference: e.reference_number,
          debit: e.debit,
          credit: e.credit,
          journal_entry_id: e.journal_entry_id
        }))
      });

      return ledgerEntries;
    } catch (error: any) {
      console.error('[ACCOUNTING SERVICE] Error getting account ledger:', error);
      return [];
    }
  },

  // Get account transactions (simplified view)
  async getAccountTransactions(accountId: string, companyId: string) {
    const ledger = await this.getAccountLedger(accountId, companyId);
    return ledger.map(entry => ({
      date: entry.date,
      reference: entry.reference_number,
      description: entry.description,
      amount: entry.debit > 0 ? entry.debit : -entry.credit,
      type: entry.debit > 0 ? 'Debit' : 'Credit',
      balance: entry.running_balance,
    }));
  },

  // Get customer ledger from journal_entries (filtered by Accounts Receivable account)
  /**
   * @param ledgerMode `gl_journal_only` — AR journal lines for this customer only; no document/RPC merge into running balance.
   */
  async getCustomerLedger(
    customerId: string,
    companyId: string,
    branchId?: string,
    startDate?: string,
    endDate?: string,
    searchTerm?: string,
    ledgerMode: 'default' | 'gl_journal_only' = 'default'
  ): Promise<AccountLedgerEntry[]> {
    const glJournalOnly = ledgerMode === 'gl_journal_only';
    try {
      // Accounts Receivable only: canonical code 1100. Exclude 2000 (Accounts Payable).
      const { data: rawAr } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .or('code.eq.1100,name.ilike.%Accounts Receivable%');

      const allArAccounts = (rawAr || []).filter((a: any) => a.code !== '2000');
      if (allArAccounts.length === 0) {
        console.warn('[ACCOUNTING SERVICE] Accounts Receivable account not found');
        return [];
      }

      const arAccountIds = allArAccounts.map((a: any) => a.id);
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - AR Account IDs:', arAccountIds.length, allArAccounts.map((a: any) => a.code));

      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 1: Starting with customerId:', customerId);

      // Get journal entry lines for AR accounts only (1100; never 2000 = AP)
      const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          account:accounts(id, name, code),
          journal_entry:journal_entries(
            id,
            entry_no,
            entry_date,
            description,
            reference_type,
            reference_id,
            payment_id,
            branch_id,
            created_by,
            created_at,
            branch:branches(id, name, code)
          )
        `)
        .in('account_id', arAccountIds)
        .order('created_at', { ascending: true });
      
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 1: Total AR journal entry lines:', lines?.length || 0);

      // RPC-first: journal error par bhi return [] mat karo – RPC + synthetic se ledger bharo
      if (error) {
        console.error('[ACCOUNTING SERVICE] Error fetching journal lines (continuing with RPC/synthetic):', error);
      }
      // PF-14.4: Exclude lines from voided JEs (business ledger must not show them).
      const linesToUse = (lines || []).filter((l: any) => (l.journal_entry && (l.journal_entry as any).is_void) !== true);

      // PHASE 2: Get ALL sales and payments for this customer (RPC – always run so we can show ledger when no journal entries)
      // Use RPC get_customer_ledger_sales so we get sales regardless of branch (SECURITY DEFINER bypasses RLS)
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 2: Fetching sales via RPC', { customerId, companyId });
      
      // All final sales for party (same reader as customer statement); date scope for synthetic rows applied below.
      const customerSales = await fetchCustomerLedgerSalesForRange(
        companyId,
        customerId,
        undefined,
        undefined,
        ledgerSalesRpcBranchId(branchId)
      );
      const saleIds = customerSales.map((s: any) => s.id);
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Customer sales (canonical fetch):', saleIds.length);
      
      // Get payments via RPC so we get them regardless of branch (SECURITY DEFINER bypasses RLS)
      let customerPayments: any[] = [];
      if (saleIds.length > 0) {
        const rpcPay = await supabase.rpc('get_customer_ledger_payments', {
          p_company_id: companyId,
          p_sale_ids: saleIds,
          p_from_date: glJournalOnly ? null : startDate || null,
          p_to_date: glJournalOnly ? null : endDate || null,
        });
        if (!rpcPay.error) customerPayments = rpcPay.data ?? [];
      }
      // Normalize to include reference_type for downstream (RPC does not return it)
      customerPayments = customerPayments.map((p: any) => ({ ...p, reference_type: 'sale' }));

      // On-account payments: same contact, not linked to a sale — must be included for correct ledger
      let onAccountPayments: any[] = [];
      const { data: onAccountData } = await supabase
        .from('payments')
        .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id, payment_account_id')
        .eq('company_id', companyId)
        .eq('contact_id', customerId)
        .eq('reference_type', 'on_account')
        .is('voided_at', null);
      if (onAccountData?.length) {
        const dateFiltered = glJournalOnly
          ? (onAccountData as any[])
          : (onAccountData as any[]).filter((p: any) => {
              const d = (p.payment_date || '').toString().slice(0, 10);
              if (startDate && d < startDate) return false;
              if (endDate && d > endDate) return false;
              return true;
            });
        onAccountPayments = dateFiltered.map((p: any) => ({ ...p, reference_type: 'on_account', reference_id: p.reference_id ?? null }));
      }
      // Add Entry V2: manual_receipt (customer receipt) — same contact, must appear in customer ledger
      let manualReceiptPayments: any[] = [];
      const { data: manualReceiptData } = await supabase
        .from('payments')
        .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id, payment_account_id')
        .eq('company_id', companyId)
        .eq('contact_id', customerId)
        .eq('reference_type', 'manual_receipt')
        .is('voided_at', null);
      if (manualReceiptData?.length) {
        const dateFiltered = glJournalOnly
          ? (manualReceiptData as any[])
          : (manualReceiptData as any[]).filter((p: any) => {
              const d = (p.payment_date || '').toString().slice(0, 10);
              if (startDate && d < startDate) return false;
              if (endDate && d > endDate) return false;
              return true;
            });
        manualReceiptPayments = dateFiltered.map((p: any) => ({ ...p, reference_type: 'manual_receipt', reference_id: p.reference_id ?? null }));
      }
      const existingPaymentIds = new Set(customerPayments.map((p: any) => p.id));
      onAccountPayments.forEach((p: any) => {
        if (!existingPaymentIds.has(p.id)) {
          customerPayments.push(p);
          existingPaymentIds.add(p.id);
        }
      });
      manualReceiptPayments.forEach((p: any) => {
        if (!existingPaymentIds.has(p.id)) {
          customerPayments.push(p);
          existingPaymentIds.add(p.id);
        }
      });
      
      const accountMap = new Map<string, string>();

      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Payments found (RPC):', customerPayments.length);
      if (customerPayments && customerPayments.length > 0) {
        console.log('[ACCOUNTING SERVICE] getCustomerLedger - Sample payment:', {
          id: customerPayments[0].id,
          reference_id: customerPayments[0].reference_id,
          reference_number: customerPayments[0].reference_number
        });
      }

      const paymentIds = customerPayments?.map(p => p.id) || [];
      const paymentRefsMap = new Map<string, string>();
      const paymentDetailsMap = new Map<string, any>();
      customerPayments?.forEach((p: any) => {
        if (p.reference_number) {
          paymentRefsMap.set(p.id, p.reference_number);
        }
        // Add account name to payment details
        if (p.payment_account_id && accountMap.has(p.payment_account_id)) {
          p.payment_account = { name: accountMap.get(p.payment_account_id) };
        }
        paymentDetailsMap.set(p.id, p);
      });
      
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Payments found:', paymentIds.length);

      // Sales already from RPC above (customerSales). Build salesMap for journal entry matching.
      const salesMap = new Map();
      customerSales.forEach((sale: any) => {
        salesMap.set(sale.id, { id: sale.id, invoice_no: sale.invoice_no, customer_id: customerId });
      });
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Sales map size:', salesMap.size);

      // PHASE 2b: Get rentals and rental_payments for this customer (for customer sub-ledger)
      // Pass null dates to RPC so we get ALL rentals; date filtering happens in merge
      let customerRentals: any[] = [];
      let customerRentalPayments: any[] = [];
      try {
        const rpcRentals = await supabase.rpc('get_customer_ledger_rentals', {
          p_company_id: companyId,
          p_customer_id: customerId,
          p_from_date: null,
          p_to_date: null,
        });
        if (!rpcRentals.error) {
          customerRentals = rpcRentals.data ?? [];
        } else {
          // Fallback: direct query if RPC missing
          const { data: directRentals } = await supabase
            .from('rentals')
            .select('id, booking_no, booking_date, pickup_date, return_date, total_amount, paid_amount, due_amount, status, created_at')
            .eq('company_id', companyId)
            .eq('customer_id', customerId);
          customerRentals = directRentals ?? [];
        }
        const rentalIds = customerRentals.map((r: any) => r.id);
        if (rentalIds.length > 0) {
          const { data: rpData } = await supabase
            .from('rental_payments')
            .select('id, rental_id, amount, method, payment_date, created_at')
            .in('rental_id', rentalIds);
          customerRentalPayments = rpData ?? [];
        }
      } catch (e) {
        console.warn('[ACCOUNTING SERVICE] getCustomerLedger - Rental fetch failed (non-critical):', e);
      }
      const rentalsMap = new Map(customerRentals.map((r: any) => [r.id, r]));
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - Rentals:', customerRentals.length, 'Payments:', customerRentalPayments.length);

      // PHASE 3: Filter by customer ID (from sales.customer_id OR payments via sales OR rentals)
      // MUST include BOTH sales (debit) AND payments (credit) entries
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 3: Filtering lines', {
        totalLines: linesToUse.length,
        paymentIds: paymentIds.length,
        customerSalesCount: salesMap.size,
        customerId,
        salesMapKeys: Array.from(salesMap.keys()).slice(0, 5)
      });

      let saleMatchCount = 0;
      let paymentMatchCount = 0;

      const customerLines = linesToUse.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;

        // PF-07: correction_reversal JEs reference the original JE id — include AR lines when the original belonged to this customer
        if (entry.reference_type === 'correction_reversal' && entry.reference_id) {
          const origId = String(entry.reference_id);
          return linesToUse.some((ol: any) => {
            const oe = ol.journal_entry;
            if (!oe || String(oe.id) !== origId) return false;
            return arJournalLineMatchesCustomer(ol, customerId, salesMap, paymentIds, paymentDetailsMap);
          });
        }

        const ok = arJournalLineMatchesCustomer(line, customerId, salesMap, paymentIds, paymentDetailsMap);
        if (ok && entry.reference_type === 'sale') saleMatchCount++;
        if (ok && (entry.reference_type === 'payment' || entry.payment_id)) paymentMatchCount++;
        return ok;
      });

      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 3: Filter results:', {
        saleMatches: saleMatchCount,
        paymentMatches: paymentMatchCount,
        totalCustomerLines: customerLines.length,
        sampleNoMatches: linesToUse.filter((l: any) => {
          const e = l.journal_entry;
          if (!e) return false;
          if (e.reference_type === 'sale' && e.reference_id && !salesMap.get(e.reference_id)) return true;
          return false;
        }).slice(0, 3).map((l: any) => ({
          entry_no: l.journal_entry?.entry_no,
          ref_type: l.journal_entry?.reference_type,
          ref_id: l.journal_entry?.reference_id
        }))
      });

      // Filter by branch: keep company-wide (NULL branch) JEs in every branch view
      const branchFiltered = branchId
        ? customerLines.filter((line: any) => {
            const bid = line.journal_entry?.branch_id;
            return bid == null || bid === '' || bid === branchId;
          })
        : customerLines;

      const compareJournalLines = (a: any, b: any) => {
        const dateA = (a.journal_entry?.entry_date || '').toString();
        const dateB = (b.journal_entry?.entry_date || '').toString();
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const createdA = (a.journal_entry?.created_at || a.created_at || '').toString();
        const createdB = (b.journal_entry?.created_at || b.created_at || '').toString();
        return createdA.localeCompare(createdB);
      };

      const dedupedBranch = dedupeCustomerArPaymentCreditLines([...branchFiltered].sort(compareJournalLines));

      // Opening balance = sum of (debit - credit) for ALL lines BEFORE startDate (after payment-line dedupe)
      let openingBalance = 0;
      if (startDate) {
        dedupedBranch.forEach((line: any) => {
          const entry = line.journal_entry;
          if (!entry || entry.entry_date >= startDate) return;
          openingBalance += (line.debit || 0) - (line.credit || 0);
        });
      }

      // Lines to display: only those within date range [startDate, endDate] (already sorted)
      const rangeLines = dedupedBranch.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });

      let runningBalance = openingBalance;

      // PHASE 4: Build ledger entries with running balance (from rangeLines only)
      console.log('[ACCOUNTING SERVICE] getCustomerLedger - PHASE 4: Building ledger entries', {
        rangeLines: rangeLines.length,
        openingBalance,
        sampleEntries: rangeLines.slice(0, 3).map((l: any) => ({
          entry_no: l.journal_entry?.entry_no,
          ref_type: l.journal_entry?.reference_type,
          ref_id: l.journal_entry?.reference_id,
          payment_id: l.journal_entry?.payment_id,
          debit: l.debit,
          credit: l.credit
        }))
      });

      const ledgerEntriesFromRange: AccountLedgerEntry[] = rangeLines.map((line: any) => {
        const entry = line.journal_entry;
        
        // STEP 3: BACKEND JOURNAL ENTRY RULE - Verify debit/credit are mutually exclusive
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        
        // STEP 4: SQL VERIFICATION - Log if both debit and credit are non-zero (DATA CORRUPTION)
        if (debit > 0 && credit > 0) {
          console.error('[ACCOUNTING SERVICE] DATA CORRUPTION: Both debit and credit > 0:', {
            journal_entry_id: entry.id,
            entry_no: entry.entry_no,
            debit,
            credit,
            description: entry.description
          });
        }
        
        // STEP 6: Running Balance Formula for ASSET account: balance = previous + debit - credit
        runningBalance += debit - credit;

        // Determine source module and document type
        let sourceModule = 'Accounting';
        let documentType = 'Journal Entry';
        if (entry.reference_type === 'sale') {
          sourceModule = 'Sales';
          documentType = 'Sale Invoice';
        } else if (entry.reference_type === 'correction_reversal') {
          sourceModule = 'Accounting';
          documentType = 'Reversal';
        } else if (entry.reference_type === 'rental') {
          sourceModule = 'Rental';
          documentType = 'Rental';
        } else if (entry.payment_id) {
          sourceModule = 'Payment';
          documentType = 'Payment';
        } else if (entry.reference_type === 'expense') {
          sourceModule = 'Expense';
          documentType = 'Expense';
        }

        // Get Payment Account name (from journal_entry_lines.account or payment.payment_account)
        let accountName = '';
        // First try: Get from journal_entry_lines.account (for AR entries, this is the AR account itself)
        // For payment entries, we need the OTHER side (Cash/Bank account)
        if (entry.payment_id) {
          const payment = paymentDetailsMap.get(entry.payment_id);
          if (payment?.payment_account?.name) {
            accountName = payment.payment_account.name;
          } else if (payment?.payment_account_id && accountMap.has(payment.payment_account_id)) {
            accountName = accountMap.get(payment.payment_account_id) || '';
          } else if (payment?.payment_method) {
            // Fallback to payment_method if account not found
            accountName = payment.payment_method;
          }
        } else if (line.account) {
          // For non-payment entries, use the account from journal_entry_lines
          accountName = line.account.name || '';
        }

        // Get Notes (from payment.notes, separate from description)
        let notes = '';
        if (entry.payment_id) {
          const payment = paymentDetailsMap.get(entry.payment_id);
          if (payment?.notes) {
            notes = payment.notes;
          }
        }

        // CRITICAL FIX: Use entry_no from database as PRIMARY reference
        // Only generate fallback if entry_no is truly missing or invalid
        let referenceNumber = entry.entry_no;
        
        // Check if entry_no is missing, empty, or looks like UUID
        const isInvalidEntryNo = !referenceNumber || 
                                  referenceNumber.trim() === '' || 
                                  (referenceNumber.includes('-') && referenceNumber.length === 36) ||
                                  referenceNumber.length > 50;
        
        if (isInvalidEntryNo) {
          // Generate short reference based on type (FALLBACK ONLY)
          const sale = entry.reference_id ? salesMap.get(entry.reference_id) : null;
          const rental = entry.reference_type === 'rental' && entry.reference_id ? rentalsMap.get(entry.reference_id) : null;
          if (entry.reference_type === 'sale' && sale?.invoice_no) {
            referenceNumber = sale.invoice_no;
          } else if (entry.reference_type === 'rental' && rental?.booking_no) {
            referenceNumber = rental.booking_no;
          } else if (entry.payment_id && paymentRefsMap.has(entry.payment_id)) {
            referenceNumber = paymentRefsMap.get(entry.payment_id)!;
          } else if (entry.payment_id) {
            referenceNumber = `PAY-${entry.payment_id.substring(0, 4).toUpperCase()}`;
          } else if (entry.reference_type === 'expense') {
            referenceNumber = `EXP-${entry.id.substring(0, 4).toUpperCase()}`;
          } else {
            // Last resort: Use entry ID substring (but this won't match database lookup)
            referenceNumber = `JE-${entry.id.substring(0, 4).toUpperCase()}`;
          }
        }
        
        // Get branch info from joined data
        const branch = (entry as any).branch;
        const branchName = branch ? (branch.code ? `${branch.code} | ${branch.name}` : branch.name) : null;

        // STEP 2: DATA SOURCE CONFIRMATION - Ensure debit/credit are properly set
        const finalDebit = debit;
        const finalCredit = credit;
        
        // Verify: Dono aik sath non-zero NA hon
        if (finalDebit > 0 && finalCredit > 0) {
          console.warn('[ACCOUNTING SERVICE] Invalid entry: Both debit and credit non-zero:', {
            entry_id: entry.id,
            entry_no: entry.entry_no,
            debit: finalDebit,
            credit: finalCredit
          });
        }

        return {
          date: entry.entry_date,
          reference_number: referenceNumber,
          // CRITICAL: Store actual entry_no from database (for lookup)
          // If entry_no exists in DB, use it. Otherwise, use referenceNumber (which is generated from entry_no or UUID)
          entry_no: entry.entry_no || null, // Keep actual DB entry_no, don't fallback to generated referenceNumber
          description: entry.description || line.description || 'Journal Entry',
          // STEP 1: DIRECT mapping - NO Math.abs(), NO conditionals
          debit: finalDebit,
          credit: finalCredit,
          running_balance: runningBalance,
          source_module: sourceModule,
          document_type: documentType,
          account_name: accountName,
          notes: notes,
          created_by: entry.created_by,
          journal_entry_id: entry.id, // Use journal_entry_id as fallback if entry_no is missing
          payment_id:
            entry.payment_id ||
            (entry.reference_type === 'payment' && entry.reference_id ? String(entry.reference_id) : undefined),
          sale_id: entry.reference_type === 'sale' ? entry.reference_id : undefined,
          rental_id: entry.reference_type === 'rental' ? entry.reference_id : undefined,
          branch_id: entry.branch_id,
          branch_name: branchName,
          ledger_kind: entry.reference_type === 'correction_reversal' ? ('reversal' as const) : undefined,
        };
      });

      // Fallback: no journal entries but we have sales/payments/rentals – build ledger from RPC data (operational only — never in gl_journal_only)
      if (
        !glJournalOnly &&
        ledgerEntriesFromRange.length === 0 &&
        (customerSales.length > 0 || customerPayments.length > 0 || customerRentals.length > 0)
      ) {
        const items: { date: string; reference_number: string; description: string; debit: number; credit: number; sale_id?: string; payment_id?: string; rental_id?: string; source_module: string; document_type: string }[] = [];
        customerSales.forEach((s: any) => {
          const d = (s.invoice_date || '').toString();
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          const saleTotal = (Number(s.total) || 0) + (Number(s.shipment_charges) ?? 0);
          items.push({
            date: d,
            reference_number: (s.invoice_no || `SALE-${s.id?.slice(0, 8)}`).toString(),
            description: 'Sale',
            debit: saleTotal,
            credit: 0,
            sale_id: s.id,
            source_module: 'Sales',
            document_type: (s.invoice_no || '').toString().toUpperCase().startsWith('STD-') || (s.invoice_no || '').toString().toUpperCase().startsWith('ST-') ? 'Studio Sale' : 'Sale Invoice',
          });
        });
        customerPayments.forEach((p: any) => {
          const d = (p.payment_date || '').toString();
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          items.push({
            date: d,
            reference_number: (p.reference_number || `PAY-${p.id?.slice(0, 8)}`).toString(),
            description: 'Payment',
            debit: 0,
            credit: Number(p.amount) || 0,
            payment_id: p.id,
            source_module: 'Payment',
            document_type: 'Payment',
          });
        });
        // Rental charges (debit – customer owes)
        customerRentals.forEach((r: any) => {
          const rawDate = r.pickup_date || r.booking_date || r.created_at;
          const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
          if (!d) return;
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          const total = Number(r.total_amount) || 0;
          if (total <= 0) return;
          items.push({
            date: d,
            reference_number: (r.booking_no || `RN-${r.id?.slice(0, 8)}`).toString(),
            description: 'Rental Charge',
            debit: total,
            credit: 0,
            rental_id: r.id,
            source_module: 'Rental',
            document_type: 'Rental Invoice',
          });
        });
        // Rental payments (credit – customer paid)
        customerRentalPayments.forEach((p: any) => {
          const rawDate = p.payment_date || p.created_at;
          const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
          if (!d) return;
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          items.push({
            date: d,
            reference_number: (rentalsMap.get(p.rental_id)?.booking_no || `RN-${p.rental_id?.slice(0, 8)}`) + `-PAY`,
            description: 'Rental Payment',
            debit: 0,
            credit: Number(p.amount) || 0,
            rental_id: p.rental_id,
            source_module: 'Rental',
            document_type: 'Rental Payment',
          });
        });
        items.sort((a, b) => a.date.localeCompare(b.date) || 0);
        let runBal = 0;
        const syntheticEntries: AccountLedgerEntry[] = items.map((item) => {
          runBal += item.debit - item.credit;
          return {
            date: item.date,
            reference_number: item.reference_number,
            entry_no: null,
            description: item.description,
            debit: item.debit,
            credit: item.credit,
            running_balance: runBal,
            source_module: item.source_module,
            document_type: item.document_type,
            journal_entry_id: '',
            account_name: '',
            notes: '',
            sale_id: item.sale_id,
            payment_id: item.payment_id,
            rental_id: item.rental_id,
          };
        });
        const withOpening: AccountLedgerEntry[] = startDate
          ? [
              { date: startDate, reference_number: '-', entry_no: null, description: 'Opening Balance', debit: 0, credit: 0, running_balance: 0, source_module: 'Accounting', journal_entry_id: '', document_type: 'Opening Balance', account_name: '', notes: '' },
              ...syntheticEntries,
            ]
          : syntheticEntries;
        console.log('[ACCOUNTING SERVICE] getCustomerLedger - Using synthetic ledger from sales/payments (no journal entries):', syntheticEntries.length);
        return withOpening;
      }

      // MERGE: Add any sales/payments/rentals that have no journal line (rentals never hit AR, so always add synthetic)
      const saleIdsInJournal = new Set((ledgerEntriesFromRange.map((e: AccountLedgerEntry) => e.sale_id).filter(Boolean)) as string[]);
      const paymentIdsInJournal = new Set((ledgerEntriesFromRange.map((e: AccountLedgerEntry) => e.payment_id).filter(Boolean)) as string[]);
      const rentalIdsInJournal = new Set((ledgerEntriesFromRange.map((e: AccountLedgerEntry) => e.rental_id).filter(Boolean)) as string[]);
      const missingSales = customerSales.filter((s: any) => !saleIdsInJournal.has(s.id));
      const missingPayments = customerPayments.filter((p: any) => !paymentIdsInJournal.has(p.id));
      const hasRentalsToAdd = customerRentals.length > 0 || customerRentalPayments.length > 0;
      if (!glJournalOnly && (missingSales.length > 0 || missingPayments.length > 0 || hasRentalsToAdd)) {
        const mergeItems: { date: string; reference_number: string; description: string; debit: number; credit: number; sale_id?: string; payment_id?: string; rental_id?: string; source_module: string; document_type: string }[] = [];
        missingSales.forEach((s: any) => {
          const d = (s.invoice_date || '').toString();
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          const saleTotal = (Number(s.total) || 0) + (Number(s.shipment_charges) ?? 0);
          mergeItems.push({
            date: d,
            reference_number: (s.invoice_no || `SALE-${s.id?.slice(0, 8)}`).toString(),
            description: 'Sale',
            debit: saleTotal,
            credit: 0,
            sale_id: s.id,
            source_module: 'Sales',
            document_type: (s.invoice_no || '').toString().toUpperCase().startsWith('STD-') || (s.invoice_no || '').toString().toUpperCase().startsWith('ST-') ? 'Studio Sale' : 'Sale Invoice',
          });
        });
        missingPayments.forEach((p: any) => {
          const d = (p.payment_date || '').toString();
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          mergeItems.push({
            date: d,
            reference_number: (p.reference_number || `PAY-${p.id?.slice(0, 8)}`).toString(),
            description: 'Payment',
            debit: 0,
            credit: Number(p.amount) || 0,
            payment_id: p.id,
            source_module: 'Payment',
            document_type: 'Payment',
          });
        });
        // Rentals: always add synthetic (journal entries use Cash/Revenue, not AR)
        customerRentals.forEach((r: any) => {
          const rawDate = r.pickup_date || r.booking_date || r.created_at;
          const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
          if (!d) return;
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          const total = Number(r.total_amount) || 0;
          if (total <= 0) return;
          mergeItems.push({
            date: d,
            reference_number: (r.booking_no || `RN-${r.id?.slice(0, 8)}`).toString(),
            description: 'Rental Charge',
            debit: total,
            credit: 0,
            rental_id: r.id,
            source_module: 'Rental',
            document_type: 'Rental Invoice',
          });
        });
        customerRentalPayments.forEach((p: any) => {
          const rawDate = p.payment_date || p.created_at;
          const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
          if (!d) return;
          if (startDate && d < startDate) return;
          if (endDate && d > endDate) return;
          mergeItems.push({
            date: d,
            reference_number: (rentalsMap.get(p.rental_id)?.booking_no || `RN-${p.rental_id?.slice(0, 8)}`) + `-PAY`,
            description: 'Rental Payment',
            debit: 0,
            credit: Number(p.amount) || 0,
            rental_id: p.rental_id,
            source_module: 'Rental',
            document_type: 'Rental Payment',
          });
        });
        if (mergeItems.length > 0) {
          const syntheticMissing: AccountLedgerEntry[] = mergeItems.map((item) => ({
            date: item.date,
            reference_number: item.reference_number,
            entry_no: null,
            description: item.description,
            debit: item.debit,
            credit: item.credit,
            running_balance: 0,
            source_module: item.source_module,
            document_type: item.document_type,
            journal_entry_id: '',
            account_name: '',
            notes: '',
            sale_id: item.sale_id,
            payment_id: item.payment_id,
            rental_id: item.rental_id,
          }));
          const combined = [...ledgerEntriesFromRange, ...syntheticMissing].sort((a, b) => a.date.localeCompare(b.date) || 0);
          let runBal = openingBalance;
          combined.forEach((e) => {
            runBal += (e.debit || 0) - (e.credit || 0);
            e.running_balance = runBal;
          });
          console.log('[ACCOUNTING SERVICE] getCustomerLedger - Merged', syntheticMissing.length, 'missing sales/payments into ledger');
          const ledgerEntries: AccountLedgerEntry[] = startDate
            ? [{ date: startDate, reference_number: '-', entry_no: null, description: 'Opening Balance', debit: 0, credit: 0, running_balance: openingBalance, source_module: 'Accounting', journal_entry_id: '', document_type: 'Opening Balance', account_name: '', notes: '' }, ...combined]
            : combined;
          return ledgerEntries;
        }
      }

      // When date range is applied, prepend opening balance row so UI/PDF/Print show it and totals are correct
      const ledgerEntries: AccountLedgerEntry[] = startDate
        ? [
            {
              date: startDate,
              reference_number: '-',
              entry_no: null,
              description: 'Opening Balance',
              debit: 0,
              credit: 0,
              running_balance: openingBalance,
              source_module: 'Accounting',
              journal_entry_id: '',
              document_type: 'Opening Balance',
              account_name: '',
              notes: '',
            },
            ...ledgerEntriesFromRange,
          ]
        : ledgerEntriesFromRange;

      return ledgerEntries;
    } catch (error: any) {
      console.error('[ACCOUNTING SERVICE] Error getting customer ledger:', error);
      return [];
    }
  },

  /**
   * Supplier AP only: journal lines on Accounts Payable (2000) for this supplier — no purchase/payment document merge.
   * Running balance = cumulative (credit − debit) on AP (liability: credit increases what we owe).
   */
  async getSupplierApGlJournalLedger(
    supplierId: string,
    companyId: string,
    branchId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AccountLedgerEntry[]> {
    try {
      const { data: rawAp } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .or('code.eq.2000,name.ilike.%Accounts Payable%');
      const apAccounts = (rawAp || []).filter((a: any) => String(a.code).trim() !== '1100');
      if (apAccounts.length === 0) return [];
      const apAccountIds = apAccounts.map((a: any) => a.id);

      const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          *,
          account:accounts(id, name, code),
          journal_entry:journal_entries(
            id, entry_no, entry_date, description, reference_type, reference_id, payment_id,
            branch_id, created_by, created_at, is_void,
            branch:branches(id, name, code)
          )
        `
        )
        .in('account_id', apAccountIds)
        .order('created_at', { ascending: true });

      if (error) console.error('[ACCOUNTING SERVICE] getSupplierApGlJournalLedger lines error:', error);
      const linesToUse = (lines || []).filter((l: any) => (l.journal_entry && (l.journal_entry as any).is_void) !== true);

      const { data: purchases } = await supabase
        .from('purchases')
        .select('id')
        .eq('company_id', companyId)
        .eq('supplier_id', supplierId);
      const supplierPurchaseIds = new Set((purchases || []).map((p: { id: string }) => p.id));

      const { data: payRows } = await supabase
        .from('payments')
        .select('id, contact_id, reference_type, reference_id')
        .eq('company_id', companyId);
      const supplierPaymentIds = new Set<string>();
      (payRows || []).forEach((p: any) => {
        if (p.contact_id === supplierId) supplierPaymentIds.add(p.id);
        if (String(p.reference_type).toLowerCase() === 'purchase' && p.reference_id && supplierPurchaseIds.has(p.reference_id)) {
          supplierPaymentIds.add(p.id);
        }
      });

      const supplierLines = linesToUse.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        const rt = String(entry.reference_type || '').toLowerCase();
        if (rt === 'correction_reversal' && entry.reference_id) {
          const origId = String(entry.reference_id);
          return linesToUse.some((ol: any) => {
            const oe = ol.journal_entry;
            if (!oe || String(oe.id) !== origId) return false;
            return supplierApJournalLineMatchesSupplier(ol, supplierId, supplierPurchaseIds, supplierPaymentIds);
          });
        }
        return supplierApJournalLineMatchesSupplier(line, supplierId, supplierPurchaseIds, supplierPaymentIds);
      });

      const branchFiltered = branchId
        ? supplierLines.filter((line: any) => {
            const bid = line.journal_entry?.branch_id;
            return bid == null || bid === '' || bid === branchId;
          })
        : supplierLines;

      let openingBalance = 0;
      if (startDate) {
        branchFiltered.forEach((line: any) => {
          const entry = line.journal_entry;
          if (!entry || entry.entry_date >= startDate) return;
          openingBalance += (line.credit || 0) - (line.debit || 0);
        });
      }

      const rangeLines = branchFiltered.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });

      rangeLines.sort((a: any, b: any) => {
        const dateA = String(a.journal_entry?.entry_date || '');
        const dateB = String(b.journal_entry?.entry_date || '');
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const createdA = String(a.journal_entry?.created_at || a.created_at || '');
        const createdB = String(b.journal_entry?.created_at || b.created_at || '');
        return createdA.localeCompare(createdB);
      });

      let runningBalance = openingBalance;
      const ledgerEntriesFromRange: AccountLedgerEntry[] = rangeLines.map((line: any) => {
        const entry = line.journal_entry;
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        runningBalance += credit - debit;
        const code = line.account?.code != null ? String(line.account.code) : '';
        return {
          date: entry.entry_date,
          created_at: entry.created_at,
          reference_number: entry.entry_no || entry.id?.slice(0, 8) || '—',
          entry_no: entry.entry_no,
          description: entry.description || line.description || '—',
          debit,
          credit,
          running_balance: runningBalance,
          source_module: 'Accounting',
          journal_entry_id: entry.id,
          payment_id: entry.payment_id,
          branch_id: entry.branch_id,
          branch_name: entry.branch?.name,
          account_name: line.account?.name || '',
          gl_account_code: code,
          document_type: 'AP Journal',
        };
      });

      const ledgerEntries: AccountLedgerEntry[] = startDate
        ? [
            {
              date: startDate,
              reference_number: '—',
              entry_no: undefined,
              description: 'Opening Balance (AP GL)',
              debit: 0,
              credit: 0,
              running_balance: openingBalance,
              source_module: 'Accounting',
              journal_entry_id: '',
              document_type: 'Opening Balance',
              account_name: '',
            },
            ...ledgerEntriesFromRange,
          ]
        : ledgerEntriesFromRange;

      return ledgerEntries;
    } catch (e) {
      console.error('[ACCOUNTING SERVICE] getSupplierApGlJournalLedger:', e);
      return [];
    }
  },

  /**
   * Worker party: journal lines on Worker Payable (2010) and Worker Advance (1180) only — no worker_ledger_entries merge.
   * running_balance = net GL exposure (WP liability credit−debit minus WA asset debit−credit), same basis as get_contact_party_gl_balances worker slice.
   */
  async getWorkerPartyGlJournalLedger(
    workerId: string,
    companyId: string,
    branchId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AccountLedgerEntry[]> {
    try {
      const { data: accts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .or('code.eq.2010,code.eq.1180,name.ilike.%Worker Payable%,name.ilike.%Worker Advance%');
      const wpWa = (accts || []).filter((a: any) => {
        const c = String(a.code || '').trim();
        return c === '2010' || c === '1180';
      });
      if (wpWa.length === 0) return [];
      const accountIds = wpWa.map((a: any) => a.id);
      const codeById = new Map(wpWa.map((a: any) => [a.id, String(a.code || '').trim()]));
      const nameById = new Map(wpWa.map((a: any) => [a.id, String(a.name || '')]));

      const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          *,
          account:accounts(id, name, code),
          journal_entry:journal_entries(
            id, entry_no, entry_date, description, reference_type, reference_id, payment_id,
            branch_id, created_by, created_at, is_void,
            branch:branches(id, name, code)
          )
        `
        )
        .in('account_id', accountIds)
        .order('created_at', { ascending: true });

      if (error) console.error('[ACCOUNTING SERVICE] getWorkerPartyGlJournalLedger lines error:', error);
      const linesToUse = (lines || []).filter((l: any) => (l.journal_entry && (l.journal_entry as any).is_void) !== true);

      const { data: workerPayments } = await supabase
        .from('payments')
        .select('id')
        .eq('company_id', companyId)
        .eq('contact_id', workerId);
      const workerPaymentIds = new Set((workerPayments || []).map((p: { id: string }) => p.id));

      const workerLines = linesToUse.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        const rt = String(entry.reference_type || '').toLowerCase();
        if (rt === 'correction_reversal' && entry.reference_id) {
          const origId = String(entry.reference_id);
          return linesToUse.some((ol: any) => {
            const oe = ol.journal_entry;
            if (!oe || String(oe.id) !== origId) return false;
            return workerGlLineMatchesWorker(ol, workerId, workerPaymentIds);
          });
        }
        return workerGlLineMatchesWorker(line, workerId, workerPaymentIds);
      });

      const branchFiltered = branchId
        ? workerLines.filter((line: any) => {
            const bid = line.journal_entry?.branch_id;
            return bid == null || bid === '' || bid === branchId;
          })
        : workerLines;

      let openWp = 0;
      let openWa = 0;
      if (startDate) {
        branchFiltered.forEach((line: any) => {
          const entry = line.journal_entry;
          if (!entry || entry.entry_date >= startDate) return;
          const aid = line.account_id;
          const code = codeById.get(aid) || '';
          const debit = line.debit || 0;
          const credit = line.credit || 0;
          if (code === '2010') openWp += credit - debit;
          else if (code === '1180') openWa += debit - credit;
        });
      }
      let openingNet = openWp - openWa;

      const rangeLines = branchFiltered.filter((line: any) => {
        const entry = line.journal_entry;
        if (!entry) return false;
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });

      rangeLines.sort((a: any, b: any) => {
        const dateA = String(a.journal_entry?.entry_date || '');
        const dateB = String(b.journal_entry?.entry_date || '');
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const createdA = String(a.journal_entry?.created_at || a.created_at || '');
        const createdB = String(b.journal_entry?.created_at || b.created_at || '');
        return createdA.localeCompare(createdB);
      });

      let wpRun = openWp;
      let waRun = openWa;
      let runningBalance = openingNet;

      const ledgerEntriesFromRange: AccountLedgerEntry[] = rangeLines.map((line: any) => {
        const entry = line.journal_entry;
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        const aid = line.account_id;
        const code = codeById.get(aid) || String(line.account?.code || '').trim();
        if (code === '2010') wpRun += credit - debit;
        else if (code === '1180') waRun += debit - credit;
        runningBalance = wpRun - waRun;
        return {
          date: entry.entry_date,
          created_at: entry.created_at,
          reference_number: entry.entry_no || entry.id?.slice(0, 8) || '—',
          entry_no: entry.entry_no,
          description: `${nameById.get(aid) || line.account?.name || code} — ${entry.description || line.description || '—'}`,
          debit,
          credit,
          running_balance: runningBalance,
          source_module: 'Accounting',
          journal_entry_id: entry.id,
          payment_id: entry.payment_id,
          branch_id: entry.branch_id,
          branch_name: entry.branch?.name,
          account_name: line.account?.name || '',
          gl_account_code: code,
          document_type: code === '2010' ? 'Worker Payable' : 'Worker Advance',
        };
      });

      const ledgerEntries: AccountLedgerEntry[] = startDate
        ? [
            {
              date: startDate,
              reference_number: '—',
              entry_no: undefined,
              description: 'Opening Balance (WP/WA GL net)',
              debit: 0,
              credit: 0,
              running_balance: openingNet,
              source_module: 'Accounting',
              journal_entry_id: '',
              document_type: 'Opening Balance',
              account_name: '',
            },
            ...ledgerEntriesFromRange,
          ]
        : ledgerEntriesFromRange;

      return ledgerEntries;
    } catch (e) {
      console.error('[ACCOUNTING SERVICE] getWorkerPartyGlJournalLedger:', e);
      return [];
    }
  },

  /**
   * Create journal entry with lines.
   * Canonical rule: when the entry touches Cash/Bank/Wallet (payment account), callers must create
   * a payments row first and pass paymentId so Roznamcha shows the transaction.
   */
  async createEntry(entry: JournalEntry, lines: JournalEntryLine[], paymentId?: string) {
    // Validate double-entry: total_debit must equal total_credit
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      const isExpense = entry.reference_type === 'expense' || entry.reference_type === 'extra_expense';
      if (typeof window !== 'undefined' && isExpense) {
        console.error('[ACCOUNTING] Unbalanced expense entry blocked:', {
          reference_type: entry.reference_type,
          totalDebit,
          totalCredit,
          lineCount: lines.length,
        });
      }
      throw new Error(`Double-entry validation failed: Debit (${totalDebit}) must equal Credit (${totalCredit})`);
    }

    // Create journal entry (database doesn't have total_debit/total_credit columns)
    // CRITICAL FIX: Only include fields that are not null/undefined to prevent "undefinedundefined" UUID error
    const insertData: any = {
      company_id: entry.company_id,
      entry_no: entry.entry_no,
      entry_date: entry.entry_date,
      description: entry.description,
      reference_type: entry.reference_type,
    };
    
    // Only add optional UUID fields if they have valid values (not null/undefined)
    // CRITICAL FIX: Validate branch_id - must be valid UUID, not "all"
    if (entry.branch_id && entry.branch_id !== 'all') {
      insertData.branch_id = entry.branch_id;
    }
    if (entry.reference_id) {
      insertData.reference_id = entry.reference_id;
    }
    if (entry.created_by) {
      insertData.created_by = entry.created_by;
    }
    // CRITICAL: Link journal entry to payment if provided
    if (paymentId) {
      insertData.payment_id = paymentId;
    }
    // Payment contract (Phase 5): mirror payments.id onto reference_id when unset (except document-root JEs and
    // manual_receipt, which may use contact_id on reference_id for customer ledger matching).
    if (paymentId && !insertData.reference_id) {
      const rt = String(entry.reference_type || '').toLowerCase();
      if (rt !== 'sale' && rt !== 'purchase' && rt !== 'manual_receipt') {
        insertData.reference_id = paymentId;
      }
    }
    // Standalone payment / payment_adjustment rows: always keep reference_id = payment_id when linked
    if (paymentId) {
      const rt = String(entry.reference_type || '').toLowerCase();
      if (rt === 'payment' || rt === 'payment_adjustment') {
        insertData.reference_id = paymentId;
      }
    }
    if (entry.attachments !== undefined && entry.attachments != null && Array.isArray(entry.attachments) && entry.attachments.length > 0) {
      insertData.attachments = JSON.parse(JSON.stringify(entry.attachments));
    }
    if (entry.action_fingerprint) {
      insertData.action_fingerprint = entry.action_fingerprint;
    }

    // STEP 2 FIX: Fix journal_entries query - use proper select instead of select()
    let result = await supabase.from('journal_entries').insert(insertData).select('*').single();
    let entryData = result.data;
    let entryError = result.error;
    if (entryError && entryError.code === 'PGRST204' && entryError.message?.includes('attachments')) {
      delete insertData.attachments;
      result = await supabase.from('journal_entries').insert(insertData).select('*').single();
      entryData = result.data;
      entryError = result.error;
    }

    // CRITICAL FIX: Handle missing table error with helpful message
    if (entryError && (entryError.code === 'PGRST205' || entryError.message?.includes('does not exist'))) {
      const errorMessage = `❌ Journal Entries table not found!\n\nThe 'journal_entries' table doesn't exist in your database. Please run this SQL in your Supabase SQL Editor:\n\nCREATE TABLE IF NOT EXISTS journal_entries (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,\n  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,\n  entry_no VARCHAR(100),\n  entry_date DATE NOT NULL,\n  description TEXT,\n  reference_type VARCHAR(50),\n  reference_id UUID,\n  created_by UUID REFERENCES users(id) ON DELETE SET NULL,\n  created_at TIMESTAMPTZ DEFAULT NOW(),\n  updated_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE TABLE IF NOT EXISTS journal_entry_lines (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,\n  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,\n  debit DECIMAL(15,2) DEFAULT 0,\n  credit DECIMAL(15,2) DEFAULT 0,\n  description TEXT,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nSee: supabase-extract/migrations/03_frontend_driven_schema.sql for complete schema.`;
      throw new Error(errorMessage);
    }

    // Idempotent recovery: duplicate key / 409 (e.g. idx_journal_entries_fingerprint_active or parallel sale JE)
    const dup =
      entryError &&
      (entryError.code === '23505' ||
        (entryError as { status?: number }).status === 409 ||
        String(entryError.message || '').toLowerCase().includes('duplicate') ||
        String(entryError.message || '').toLowerCase().includes('unique'));
    // Canonical document sale JE only (payment receipts also use reference_type=sale + payment_id).
    if (
      dup &&
      entry.reference_type === 'sale' &&
      entry.reference_id &&
      !insertData.payment_id
    ) {
      const { data: existingRows } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('reference_type', 'sale')
        .eq('reference_id', entry.reference_id)
        .is('payment_id', null)
        .or('is_void.is.null,is_void.eq.false')
        .order('created_at', { ascending: true })
        .limit(1);
      const existing = (existingRows as Record<string, unknown>[] | null)?.[0] as
        | { id: string; is_void?: boolean }
        | undefined;
      if (existing?.id && existing.is_void !== true) {
        if (import.meta.env?.DEV) {
          console.warn('[accountingService] Duplicate canonical sale JE insert — returning existing row:', existing.id);
        }
        return { ...existing, lines: [] };
      }
    }
    if (
      dup &&
      entry.reference_type === 'purchase' &&
      entry.reference_id &&
      !insertData.payment_id
    ) {
      const { data: existingRows } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('reference_type', 'purchase')
        .eq('reference_id', entry.reference_id)
        .is('payment_id', null)
        .or('is_void.is.null,is_void.eq.false')
        .order('created_at', { ascending: true })
        .limit(1);
      const existing = (existingRows as Record<string, unknown>[] | null)?.[0] as
        | { id: string; is_void?: boolean }
        | undefined;
      if (existing?.id && existing.is_void !== true) {
        if (import.meta.env?.DEV) {
          console.warn('[accountingService] Duplicate canonical purchase JE insert — returning existing row:', existing.id);
        }
        return { ...existing, lines: [] };
      }
    }
    if (dup && entry.reference_type === 'correction_reversal' && insertData.reference_id) {
      const { data: existingRows } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', entry.company_id)
        .eq('reference_type', 'correction_reversal')
        .eq('reference_id', insertData.reference_id)
        .or('is_void.is.null,is_void.eq.false')
        .order('created_at', { ascending: true })
        .limit(1);
      const existing = (existingRows as Record<string, unknown>[] | null)?.[0] as
        | { id: string; is_void?: boolean }
        | undefined;
      if (existing?.id && existing.is_void !== true) {
        if (import.meta.env?.DEV) {
          console.warn('[accountingService] Duplicate correction_reversal — returning existing row:', existing.id);
        }
        return { ...existing, lines: [] };
      }
    }
    if (dup && insertData.action_fingerprint) {
      const { data: fpRow } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('company_id', entry.company_id)
        .eq('action_fingerprint', insertData.action_fingerprint)
        .limit(1)
        .maybeSingle();
      if (fpRow?.id && (fpRow as { is_void?: boolean }).is_void !== true) {
        if (import.meta.env?.DEV) {
          console.warn('[accountingService] Duplicate fingerprint JE — returning existing:', fpRow.id);
        }
        return { ...fpRow, lines: [] };
      }
    }

    if (entryError) throw entryError;

    // Insert journal entry lines
    const linesData = lines.map(line => ({
      journal_entry_id: entryData.id,
      account_id: line.account_id,
      debit: line.debit || 0,
      credit: line.credit || 0,
      description: line.description,
    }));

    const { error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(linesData);

    if (linesError) throw linesError;

    // Return entry with lines
    return {
      ...entryData,
      lines: linesData.map((l, idx) => ({
        ...l,
        id: `temp-${idx}`,
      })),
    };
  },

  /**
   * Expense: update latest active expense JE (+ lines) and latest expense payment date — no reversal.
   * Use for HEADER_ONLY edits (same-month date move, description-only) after document row is updated.
   */
  async patchExpensePostingPresentation(params: {
    companyId: string;
    expenseId: string;
    entryDate?: string;
    journalDescription?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const { companyId, expenseId, entryDate, journalDescription } = params;
    if (!journalDescription && !entryDate) return { ok: true };

    const { data: jeRows, error: jeSelErr } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'expense')
      .eq('reference_id', expenseId)
      .or('is_void.is.null,is_void.eq.false')
      .order('created_at', { ascending: false })
      .limit(1);

    if (jeSelErr) return { ok: false, error: jeSelErr.message };
    const jeId = (jeRows as { id: string }[] | null)?.[0]?.id;
    if (!jeId) return { ok: false, error: 'No active expense journal for this document' };

    const jePatch: Record<string, unknown> = {};
    if (entryDate) jePatch.entry_date = String(entryDate).slice(0, 10);
    if (journalDescription !== undefined) jePatch.description = journalDescription;
    if (Object.keys(jePatch).length > 0) {
      const { error: jeUpdErr } = await supabase
        .from('journal_entries')
        .update(jePatch)
        .eq('id', jeId)
        .eq('company_id', companyId);
      if (jeUpdErr) return { ok: false, error: jeUpdErr.message };
    }

    if (journalDescription !== undefined) {
      const { error: lineErr } = await supabase
        .from('journal_entry_lines')
        .update({ description: journalDescription })
        .eq('journal_entry_id', jeId);
      if (lineErr) return { ok: false, error: lineErr.message };
    }

    const payDate = entryDate ? String(entryDate).slice(0, 10) : null;
    if (payDate) {
      const { data: payRows, error: paySelErr } = await supabase
        .from('payments')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'expense')
        .eq('reference_id', expenseId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (paySelErr) return { ok: false, error: paySelErr.message };
      const payId = (payRows as { id: string }[] | null)?.[0]?.id;
      if (payId) {
        const { error: payUpdErr } = await supabase
          .from('payments')
          .update({ payment_date: payDate })
          .eq('id', payId)
          .eq('company_id', companyId);
        if (payUpdErr) return { ok: false, error: payUpdErr.message };
      }
    }

    return { ok: true };
  },

  /**
   * Pure manual journal (reference_type = journal): update header and/or replace lines. Does not touch created_at.
   */
  async updateManualJournalEntry(
    companyId: string,
    journalEntryId: string,
    patch: {
      entry_date?: string;
      description?: string | null;
      lines?: { account_id: string; debit: number; credit: number; description?: string | null }[];
    }
  ): Promise<{ ok: boolean; error?: string }> {
    const { data: row, error: selErr } = await supabase
      .from('journal_entries')
      .select('id, reference_type, is_void')
      .eq('company_id', companyId)
      .eq('id', journalEntryId)
      .maybeSingle();

    if (selErr) return { ok: false, error: selErr.message };
    if (!row) return { ok: false, error: 'Journal not found' };
    if ((row as { is_void?: boolean }).is_void) return { ok: false, error: 'Void journal cannot be edited' };
    const rt = String((row as { reference_type?: string }).reference_type || '').toLowerCase();
    if (rt !== 'journal') {
      return { ok: false, error: 'Only manual (journal) entries can be edited here; use Edit source for posted documents.' };
    }

    if (patch.entry_date !== undefined || patch.description !== undefined) {
      const header: Record<string, unknown> = {};
      if (patch.entry_date !== undefined) header.entry_date = String(patch.entry_date).slice(0, 10);
      if (patch.description !== undefined) header.description = patch.description;
      const { error: up } = await supabase
        .from('journal_entries')
        .update(header)
        .eq('id', journalEntryId)
        .eq('company_id', companyId);
      if (up) return { ok: false, error: up.message };
    }

    if (patch.lines && patch.lines.length > 0) {
      const td = patch.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const tc = patch.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      if (Math.abs(td - tc) > 0.02) return { ok: false, error: 'Journal lines are not balanced' };
      const { error: delErr } = await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', journalEntryId);
      if (delErr) return { ok: false, error: delErr.message };
      const inserts = patch.lines.map((l) => ({
        journal_entry_id: journalEntryId,
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description ?? null,
      }));
      const { error: insErr } = await supabase.from('journal_entry_lines').insert(inserts);
      if (insErr) return { ok: false, error: insErr.message };
    }

    return { ok: true };
  },
};
