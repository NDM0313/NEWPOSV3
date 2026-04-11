import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useGlobalFilterOptional } from '@/app/context/GlobalFilterContext';
import { accountService, Account as SupabaseAccount } from '@/app/services/accountService';
import { accountingService, JournalEntryWithLines, JournalEntryLine } from '@/app/services/accountingService';
import {
  journalLineEmbeddedAccount,
  summarizeJournalLinesAccountPairs,
  withPartyContextForLine,
} from '@/app/lib/journalEntryAccountLabels';
import { pickCanonicalInventoryAssetAccount } from '@/app/lib/inventoryAccountRouting';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import { documentNumberService } from '@/app/services/documentNumberService';
import { generatePaymentReference } from '@/app/utils/paymentUtils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { canPostAccountingForSaleStatus } from '@/app/lib/postingStatusGate';
import { warnIfUsingStoredBalanceAsTruth } from '@/app/services/accountingCanonicalGuard';
import { CONTACT_BALANCES_REFRESH_EVENT } from '@/app/lib/contactBalancesRefresh';
import {
  buildPaymentChainIndex,
  paymentChainFlagsForJournalEntry,
  type PaymentChainIndex,
} from '@/app/lib/paymentChainMutability';
import {
  isPaymentChainHistoricalErrorMessage,
  stripPaymentChainHistoricalPrefix,
} from '@/app/services/paymentChainMutationGuard';

/** Leading numeric segment of account code (e.g. "1021-NDM" → "1021"). */
function accountCodeDigits(acc: { code?: string } | null): string {
  const raw = String(acc?.code || '').trim();
  if (!raw) return '';
  const head = raw.split(/[-–—\s]/)[0] ?? raw;
  return head.replace(/\D/g, '');
}

/** True if account is a payment account (Cash/Bank/Mobile Wallet) – used for Manual Entry → Roznamcha rule */
function isPaymentAccount(acc: { code?: string; type?: string; name?: string; accountType?: string } | null): boolean {
  if (!acc) return false;
  const code = (acc.code || '').trim();
  const digits = accountCodeDigits(acc);
  const type = (acc.type || acc.accountType || '').toLowerCase();
  const name = (acc.name || '').toLowerCase();
  if (['1000', '1010', '1020'].includes(code)) return true;
  // Sub-wallets under 102x (NDM Easy, etc.) — must count as payment so expense → payments row → Roznamcha
  if (digits.length >= 3 && digits.startsWith('102')) return true;
  if (['cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos'].includes(type)) return true;
  if (/cash|bank|mobile wallet|wallet|jazz|easypaisa|ndm|easy\s*paisa|mobicash|finja|upaisa|sadapay|nayapay/.test(name)) {
    return true;
  }
  return false;
}

/** Infer payments.payment_method from payment account (for manual payment/receipt) */
function paymentMethodFromAccount(acc: { code?: string; type?: string; name?: string; accountType?: string }): string {
  const code = (acc.code || '').trim();
  const digits = accountCodeDigits(acc);
  const type = (acc.type || acc.accountType || '').toLowerCase();
  const name = (acc.name || '').toLowerCase();
  if (code === '1000' || name.includes('cash') || type === 'cash' || type === 'pos') return 'cash';
  if (code === '1010' || name.includes('bank') || type === 'bank' || type === 'card') return 'bank';
  if (
    code === '1020' ||
    type === 'mobile_wallet' ||
    type === 'wallet' ||
    (digits.length >= 3 && digits.startsWith('102')) ||
    /wallet|jazz|easypaisa|ndm|mobicash|finja|upaisa|sadapay|nayapay/.test(name)
  ) {
    return 'mobile_wallet';
  }
  return 'other';
}

// ============================================
// 🎯 TYPES & INTERFACES
// ============================================

export type AccountType = 
  | 'Cash' 
  | 'Bank' 
  | 'Mobile Wallet' 
  | 'Accounts Receivable' 
  | 'Accounts Payable'
  | 'Worker Payable'
  | 'Security Deposit'
  | 'Rental Advance'
  | 'Sales Income'
  | 'Sales Revenue'
  | 'Rental Income'
  | 'Studio Sales Income'
  | 'Rental Damage Income'
  | 'Cost of Production'
  | 'Inventory'
  | 'Purchase Expense'
  | 'Expense';

export type TransactionSource = 
  | 'Sale' 
  | 'Sale_Return'
  | 'Rental' 
  | 'Studio' 
  | 'Expense' 
  | 'Payment'
  | 'Purchase'
  | 'Purchase_Return'
  | 'Manual'
  | 'Reversal';

export type PaymentMethod = 'Cash' | 'Bank' | 'Mobile Wallet';

export interface AccountingEntry {
  id: string;
  date: Date;
  source: TransactionSource;
  referenceNo: string;
  debitAccount: AccountType;
  creditAccount: AccountType;
  /** Leaf / concrete labels for workbench journal list (may include party suffix on AP/AR). */
  debitAccountDisplay?: string;
  creditAccountDisplay?: string;
  amount: number;
  description: string;
  createdBy: string;
  module: string;
  metadata?: {
    /** Raw journal_entries.reference_type (per row). */
    referenceType?: string;
    referenceId?: string;
    /** When set, JE is settlement / payment — exclude from by-document purchase/sale principal totals. */
    paymentId?: string;
    journalEntryId?: string;
    paymentMethod?: string;
    customerId?: string;
    customerName?: string;
    workerId?: string;
    workerName?: string;
    supplierId?: string;
    supplierName?: string;
    bookingId?: string;
    invoiceId?: string;
    purchaseId?: string;
    /** Explicit GL account for debit line (e.g. party AP id). */
    debitAccountId?: string;
    /** Explicit GL account for credit line (e.g. canonical inventory 1200). */
    creditAccountId?: string;
    purchaseReturnId?: string;
    /** Canonical sale return row — journal reference_id when source is Sale_Return. */
    saleReturnId?: string;
    stage?: string;
    /** Attachments for journal entry (saved to journal_entries.attachments). */
    attachments?: { url: string; name: string }[];
    /** Optional user reference (e.g. voucher no); saved with description, primary reference is always entry_no. */
    optionalReference?: string;
    /** Journal entry created_at for date+time display (ISO string). */
    createdAt?: string;
    /** PF-14.3B: Root document for grouping (e.g. sale_id so sale + sale_adjustment + payment_adjustment show as one row). */
    rootReferenceId?: string;
    rootReferenceType?: string;
    /** Journal + payment date (yyyy-MM-dd) when not using “today” (e.g. expense repost). */
    postingDate?: string;
    /** Compact Dr/Cr account text from all lines (multi-line JEs). */
    journalLinesSummary?: { debitLabel: string; creditLabel: string };
    journalLineCount?: number;
    /** journal_entries.action_fingerprint — PF-14 classification. */
    actionFingerprint?: string | null;
    /** journal_entries.economic_event_id */
    economicEventId?: string | null;
    /** Linked `payments.reference_type` when this row is a PF-14 `payment_adjustment` (supplier vs customer label). */
    linkedPaymentReferenceType?: string | null;
    /** PF-14 chain: this row is superseded by a later payment JE for the same `payments.id`. */
    paymentChainIsHistorical?: boolean;
    /** True when this JE is the latest active row for that payment (edit/reverse allowed). */
    paymentChainIsTail?: boolean;
    paymentChainTailJournalId?: string | null;
    paymentChainMemberCount?: number;
  };
}

export interface AccountBalance {
  accountType: AccountType;
  balance: number;
  lastUpdated: Date;
}

interface AccountingContextType {
  entries: AccountingEntry[];
  balances: Map<AccountType, number>;
  loading: boolean;
  
  // Core functions
  createEntry: (entry: Omit<AccountingEntry, 'id' | 'date' | 'createdBy'>) => Promise<boolean>;
  createReversalEntry: (originalJournalEntryId: string, reason?: string) => Promise<boolean>;
  undoLastPaymentMutation: (paymentId: string) => Promise<boolean>;
  refreshEntries: () => Promise<void>;
  getEntriesByReference: (referenceNo: string) => AccountingEntry[];
  getEntriesBySource: (source: TransactionSource) => AccountingEntry[];
  getAccountBalance: (accountType: AccountType) => number;
  
  // Query helpers
  getEntriesBySupplier: (supplierName: string, supplierId?: string) => AccountingEntry[];
  getEntriesByCustomer: (customerName: string, customerId?: string) => AccountingEntry[];
  getEntriesByWorker: (workerName: string, workerId?: string) => AccountingEntry[];
  getSupplierBalance: (supplierName: string, supplierId?: string) => number;
  getCustomerBalance: (customerName: string, customerId?: string) => number;
  getWorkerBalance: (workerName: string, workerId?: string) => number;
  
  // Module-specific functions
  recordSale: (params: SaleAccountingParams) => Promise<boolean>;
  recordSalePayment: (params: SalePaymentParams) => Promise<boolean>;
  recordRentalBooking: (params: RentalBookingParams) => Promise<boolean>;
  recordRentalDelivery: (params: RentalDeliveryParams) => Promise<boolean>;
  recordRentalCreditDelivery: (params: RentalDeliveryParams) => Promise<boolean>;
  recordRentalReturn: (params: RentalReturnParams) => Promise<boolean>;
  recordStudioSale: (params: StudioSaleParams) => Promise<boolean>;
  recordWorkerJobCompletion: (params: WorkerJobParams) => Promise<boolean>;
  recordWorkerPayment: (params: WorkerPaymentParams) => Promise<boolean | { referenceNumber: string }>;
  recordExpense: (params: ExpenseParams) => Promise<boolean>;
  recordPurchase: (params: PurchaseParams) => Promise<boolean>;
  recordPurchaseReturn: (params: PurchaseReturnParams) => Promise<boolean>;
  /** Sale return settlement — Dr Sales Revenue, Cr party AR (adjust) or Cr Cash/Bank; mirrors recordPurchaseReturn. */
  recordSaleReturn: (params: SaleReturnParams) => Promise<boolean>;
  recordSupplierPayment: (params: SupplierPaymentParams) => Promise<boolean>;
  /** On-account customer payment (no invoice): Dr Cash/Bank, Cr AR; ledger by customerId */
  recordOnAccountCustomerPayment: (params: OnAccountCustomerPaymentParams) => Promise<boolean>;
  
  // Account management
  accounts: Account[];
  getAccountsByType: (type: PaymentMethod) => Account[];
  getAccountById: (id: string) => Account | undefined;
}

// ============================================
// 🎯 PARAMETER INTERFACES
// ============================================

export interface SaleAccountingParams {
  saleId: string; // CRITICAL FIX: UUID of the sale (for reference_id)
  invoiceNo: string; // Invoice number (for referenceNo)
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  module: string;
}

export interface SalePaymentParams {
  saleId: string; // CRITICAL FIX: UUID of the sale (for reference_id)
  invoiceNo: string; // Invoice number (for referenceNo)
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  accountId?: string; // CRITICAL: Account ID for payment_account_id
}

export interface RentalBookingParams {
  bookingId: string;
  customerName: string;
  customerId?: string;
  advanceAmount: number;
  securityDepositAmount: number;
  securityDepositType: 'Cash' | 'Document';
  paymentMethod: PaymentMethod;
  /** When set, debit line posts to this payment account (cash/bank/wallet) — required for confirmed advances. */
  paymentAccountId?: string;
  /** Journal / payment date (YYYY-MM-DD). */
  paymentDate?: string;
}

export interface RentalDeliveryParams {
  bookingId: string;
  customerName: string;
  customerId?: string;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
  paymentAccountId?: string;
  paymentDate?: string;
}

export interface RentalReturnParams {
  bookingId: string;
  customerName: string;
  customerId?: string;
  securityDepositAmount: number;
  damageCharge?: number;
  paymentMethod?: PaymentMethod;
}

export interface StudioSaleParams {
  invoiceNo: string;
  customerName: string;
  customerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
}

export interface WorkerJobParams {
  invoiceNo: string;
  workerName: string;
  workerId?: string;
  stage: 'Dyeing' | 'Stitching' | 'Handwork';
  cost: number;
}

export interface WorkerPaymentParams {
  workerName: string;
  workerId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  /** Payment account (Cash/Bank) ID – required for canonical flow (payments row → Roznamcha). */
  paymentAccountId?: string;
  /** Ignored when using canonical worker payment service (ref generated there). */
  referenceNo?: string;
  /** When paying for a specific stage (Pay Now), pass stageId and optionally stageAmount (job amount) so full payment skips extra ledger row */
  stageId?: string;
  /** Job amount for this stage; when amount >= stageAmount we skip recordAccountingPaymentToLedger and rely on markStageLedgerPaid */
  stageAmount?: number;
}

export interface ExpenseParams {
  expenseId: string;
  category: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
  /** Expense document date for journal/payment posting (yyyy-MM-dd). */
  date?: string;
}

export interface PurchaseParams {
  purchaseId: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  purchaseType: 'Inventory' | 'Expense';
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  description: string;
}

export interface PurchaseReturnParams {
  returnId: string;
  returnNo: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  /** Credit account: reverse of purchase (default Inventory) */
  creditAccount?: 'Inventory' | 'Purchase Expense';
}

export interface SaleReturnParams {
  saleReturnId: string;
  returnNo: string;
  customerName: string;
  customerId?: string | null;
  amount: number;
  /** Linked sale UUID when return is against an invoice; optional for standalone returns. */
  originalSaleId?: string | null;
  refundMethod: 'cash' | 'bank' | 'adjust';
  /** GL account id for cash/bank refund leg (metadata.creditAccountId). */
  refundAccountId?: string | null;
  /**
   * Dr revenue line — prefer explicit id. When omitted, canonical **4000** (never name-loose match to rental).
   * Use 4200 only when the originating document is truly rental (caller must pass id for that case).
   */
  revenueDebitAccountId?: string | null;
  description: string;
  /** yyyy-MM-dd on return document */
  postingDate?: string;
}

export interface SupplierPaymentParams {
  purchaseId?: string;
  supplierName: string;
  supplierId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
}

export interface OnAccountCustomerPaymentParams {
  customerId?: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  accountId?: string;
  referenceNo: string;
  /** Row from `saleService.recordOnAccountPayment` — required so JE gets payment_id + reference_id (tie-out / GL / display ref). */
  paymentId: string;
}

// ============================================
// 🎯 ACCOUNT STRUCTURE
// ============================================

export interface Account {
  id: string;
  name: string;
  type: PaymentMethod;
  accountType: AccountType;
  balance: number;
  branch?: string;
  branchId?: string; // UUID for branch filter in payment dialog
  isActive: boolean;
  code?: string; // Add code for account lookup
  /** Chart hierarchy: child of canonical group (1000/1010/1020/1100/2000, etc.) */
  parent_id?: string | null;
  /** COA section header row (non-selectable as payment account). */
  is_group?: boolean;
  /** Party subledger FK (migration 20260364); enriched with contact name/type after load. */
  linked_contact_id?: string | null;
  linked_contact_name?: string | null;
  linked_contact_party_type?: string | null;
}

// ============================================
// 🎯 CONTEXT CREATION
// ============================================

const AccountingContext = createContext<AccountingContextType | undefined>(undefined);

// ============================================
// 🎯 PROVIDER COMPONENT
// ============================================

export const AccountingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [balances, setBalances] = useState<Map<AccountType, number>>(new Map());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { companyId, branchId, user, userRole } = useSupabase();
  const globalFilter = useGlobalFilterOptional();
const startDateISO = globalFilter?.startDate ?? (() => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return start.toISOString().slice(0, 10);
})();
const endDateISO = globalFilter?.endDate ?? new Date().toISOString().slice(0, 10);

  // Current user (from auth context)
  const currentUser = user?.email || 'Admin';
  const currentUserId = user?.id;

  // Convert Supabase account format to app format
  const convertFromSupabaseAccount = useCallback((supabaseAccount: any): Account => {
    // CRITICAL FIX: account_type doesn't exist in actual schema, use type instead
    const accountType = supabaseAccount.type || 'Cash';
    const lc = supabaseAccount.linked_contact_id;
    return {
      id: supabaseAccount.id,
      name: supabaseAccount.name || '',
      type: accountType as PaymentMethod,
      accountType: accountType, // Use type as accountType (no separate account_type column)
      // Stored accounts.balance / current_balance is not used for GL display (journal TB only).
      balance: 0,
      branch: supabaseAccount.branch_name || supabaseAccount.branch_id || '',
      branchId: supabaseAccount.branch_id || undefined, // For payment dialog branch filter
      isActive: supabaseAccount.is_active !== false,
      code: supabaseAccount.code || undefined, // CRITICAL FIX: Include code for account lookup
      parent_id: supabaseAccount.parent_id ?? null,
      is_group: supabaseAccount.is_group === true,
      linked_contact_id: lc != null && String(lc).trim() !== '' ? String(lc).trim() : null,
    };
  }, []);
  
  // Convert journal entry from Supabase to AccountingEntry format
  const convertFromJournalEntry = useCallback(
    (journalEntry: JournalEntryWithLines, chainIndex?: PaymentChainIndex | null): AccountingEntry => {
    const lines = journalEntry.lines || [];
    const activeLines = lines.filter((line: any) => Number(line?.debit || 0) > 0 || Number(line?.credit || 0) > 0);
    const debitLine = activeLines.find((line: any) => Number(line.debit || 0) > 0);
    const creditLine = activeLines.find((line: any) => Number(line.credit || 0) > 0);
    const payParty = (journalEntry as { _payment_contact_name?: string })._payment_contact_name;
    const purParty = (journalEntry as { _purchase_supplier_name?: string })._purchase_supplier_name;
    const saleRetParty = (journalEntry as { _sale_return_customer_name?: string })._sale_return_customer_name;
    const partyForContext = payParty || purParty || saleRetParty;

    // Determine source from reference_type (PF-14.3B: sale_adjustment/payment_adjustment show as Sale/Payment for grouping)
    const sourceMap: Record<string, TransactionSource> = {
      'sale': 'Sale',
      'sale_adjustment': 'Sale',
      'purchase': 'Purchase',
      'purchase_adjustment': 'Purchase',
      'purchase_return': 'Purchase',
      'purchase_reversal': 'Reversal',
      'sale_return': 'Sale_Return',
      'manual_payment': 'Payment',
      /** Customer manual receipt / contact receipt — must map to Payment so Journal “by document” sums with payment_adjustment. */
      'manual_receipt': 'Payment',
      /** Supplier on-account settlement rows post as on_account; treat as payment for module + grouping. */
      'on_account': 'Payment',
      'expense': 'Expense',
      'rental': 'Rental',
      'studio': 'Studio',
      'payment': 'Payment',
      'payment_adjustment': 'Payment',
      'worker_payment': 'Payment',
      'manual': 'Manual',
      'correction_reversal': 'Reversal',
    };

    const rtNorm = String(journalEntry.reference_type || 'manual')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');
    const source = sourceMap[rtNorm] || sourceMap[journalEntry.reference_type || 'manual'] || 'Manual';

    // Payment reference: no longer embedded in main query; use entry_no as primary
    const paymentRef = (journalEntry as any).payment ? (Array.isArray((journalEntry as any).payment) ? (journalEntry as any).payment[0]?.reference_number : (journalEntry as any).payment?.reference_number) : undefined;
    const paymentMethod = (journalEntry as any).payment ? (Array.isArray((journalEntry as any).payment) ? (journalEntry as any).payment[0]?.payment_method : (journalEntry as any).payment?.payment_method) : undefined;

    const drCount = activeLines.filter((l: any) => Number(l.debit || 0) > 0).length;
    const crCount = activeLines.filter((l: any) => Number(l.credit || 0) > 0).length;
    const useMultiSummary = activeLines.length > 2 || drCount > 1 || crCount > 1;
    const linesSummary = summarizeJournalLinesAccountPairs(activeLines, partyForContext);

    const sumDebits = activeLines.reduce((s, l: any) => s + Number(l.debit || 0), 0);
    const sumCredits = activeLines.reduce((s, l: any) => s + Number(l.credit || 0), 0);
    let resolvedAmount = Number(debitLine?.debit || 0) || Number(creditLine?.credit || 0) || 0;
    if (resolvedAmount === 0 && activeLines.length > 0) {
      resolvedAmount = Math.max(sumDebits, sumCredits);
    }

    let debitAccountDisplay = debitLine
      ? withPartyContextForLine(debitLine as any, partyForContext)
      : linesSummary.debitLabel;
    let creditAccountDisplay = creditLine
      ? withPartyContextForLine(creditLine as any, partyForContext)
      : linesSummary.creditLabel;
    if (useMultiSummary) {
      debitAccountDisplay = linesSummary.debitLabel;
      creditAccountDisplay = linesSummary.creditLabel;
    }

    const debitStable =
      journalLineEmbeddedAccount(debitLine as any)?.name ||
      (debitLine as any)?.account_name ||
      (Array.isArray((debitLine as any)?.account) ? (debitLine as any).account[0]?.name : (debitLine as any)?.account?.name) ||
      'Expense';
    const creditStable =
      journalLineEmbeddedAccount(creditLine as any)?.name ||
      (creditLine as any)?.account_name ||
      (Array.isArray((creditLine as any)?.account)
        ? (creditLine as any).account[0]?.name
        : (creditLine as any)?.account?.name) ||
      'Cash';

    // Extract metadata from description or reference (PF-14.3B: root for grouped Journal list)
    const raw = journalEntry as { root_reference_id?: string; root_reference_type?: string };
    const linkedPayRt =
      (journalEntry as { _linked_payment_reference_type?: string })._linked_payment_reference_type ?? undefined;

    const metadata: AccountingEntry['metadata'] = {
      journalEntryId: journalEntry.id,
      referenceId: journalEntry.reference_id,
      referenceType: journalEntry.reference_type,
      paymentId: journalEntry.payment_id,
      linkedPaymentReferenceType: linkedPayRt ?? undefined,
      paymentMethod: paymentMethod,
      createdAt: (journalEntry as { created_at?: string }).created_at ?? undefined,
      rootReferenceId: raw.root_reference_id ?? journalEntry.reference_id ?? undefined,
      rootReferenceType: raw.root_reference_type ?? journalEntry.reference_type ?? undefined,
      journalLinesSummary: linesSummary,
      journalLineCount: activeLines.length,
      actionFingerprint: (journalEntry as { action_fingerprint?: string | null }).action_fingerprint ?? undefined,
      economicEventId: (journalEntry as { economic_event_id?: string | null }).economic_event_id ?? undefined,
    };

    const chainFlags = paymentChainFlagsForJournalEntry(
      {
        id: journalEntry.id || '',
        payment_id: journalEntry.payment_id,
        reference_type: journalEntry.reference_type,
        reference_id: journalEntry.reference_id,
      },
      chainIndex ?? null
    );
    metadata.paymentChainIsHistorical = chainFlags.paymentChainIsHistorical;
    metadata.paymentChainIsTail = chainFlags.paymentChainIsTail;
    metadata.paymentChainTailJournalId = chainFlags.paymentChainTailJournalId ?? undefined;
    metadata.paymentChainMemberCount = chainFlags.paymentChainMemberCount;
    
    if (journalEntry.reference_id) {
      if (source === 'Sale') metadata.invoiceId = journalEntry.reference_id;
      if (source === 'Purchase') metadata.purchaseId = journalEntry.reference_id;
      if (source === 'Expense') metadata.expenseId = journalEntry.reference_id;
    }

    // Get reference number - prefer entry_no, then payment reference, then id
    const referenceNo = journalEntry.entry_no || paymentRef || journalEntry.id?.substring(0, 8) || 'N/A';

    const module =
      source === 'Sale'
        ? 'Sales'
        : source === 'Purchase'
          ? 'Purchases'
          : source === 'Payment'
            ? 'Payments'
            : source === 'Expense'
              ? 'Expenses'
              : source === 'Rental'
                ? 'Rental'
                : source === 'Studio'
                  ? 'Studio'
                  : 'Accounting';

    return {
      id: journalEntry.id || '',
      date: new Date(journalEntry.entry_date),
      source,
      referenceNo: referenceNo,
      debitAccount: (debitStable || 'Expense') as AccountType,
      creditAccount: (creditStable || 'Cash') as AccountType,
      debitAccountDisplay,
      creditAccountDisplay,
      amount: resolvedAmount,
      description: journalEntry.description,
      createdBy: journalEntry.created_by || 'System',
      module,
      metadata,
    };
  }, []);

  // Load accounts from database. Phase 7: Prefer balance from journal (single source of truth).
  const loadAccounts = useCallback(async () => {
    if (!companyId) return;

    const linkContactsToAccounts = async (list: Account[]): Promise<Account[]> => {
      const linkedIds = [...new Set(list.map((a) => a.linked_contact_id).filter(Boolean))] as string[];
      if (linkedIds.length === 0) return list;
      const { data: contactRows, error: cErr } = await supabase
        .from('contacts')
        .select('id, name, type')
        .eq('company_id', companyId)
        .in('id', linkedIds);
      if (cErr || !contactRows?.length) return list;
      const byId = new Map(contactRows.map((c: { id: string; name: string; type?: string }) => [c.id, c]));
      return list.map((acc) => {
        const cid = acc.linked_contact_id;
        if (!cid) return acc;
        const c = byId.get(cid);
        if (!c) return acc;
        return {
          ...acc,
          linked_contact_name: c.name || null,
          linked_contact_party_type: c.type != null ? String(c.type) : null,
        };
      });
    };

    try {
      const data = await accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined);
      const convertedAccounts = data.map(convertFromSupabaseAccount);
      const withParty = await linkContactsToAccounts(convertedAccounts);
      try {
        const asOf = new Date().toISOString().slice(0, 10);
        const journalBalances = await accountingReportsService.getAccountBalancesFromJournal(companyId, asOf, branchId === 'all' ? undefined : branchId);
        const merged = withParty.map((acc) => ({
          ...acc,
          balance: journalBalances[acc.id!] !== undefined ? journalBalances[acc.id!]! : 0,
        }));
        setAccounts(merged);
      } catch (jbErr) {
        warnIfUsingStoredBalanceAsTruth(
          'AccountingContext.loadAccounts',
          'balance',
          'Journal balance merge failed — COA balances shown as 0 (not stored accounts.balance)'
        );
        if (import.meta.env?.DEV) console.warn('[ACCOUNTING CONTEXT] Journal balances unavailable:', jbErr);
        setAccounts(withParty);
      }
      if (import.meta.env?.DEV) console.log('✅ Accounts loaded:', convertedAccounts.length);
    } catch (error) {
      console.error('[ACCOUNTING CONTEXT] Error loading accounts:', error);
      setAccounts([]);
    }
  }, [companyId, branchId, convertFromSupabaseAccount]);

  // Load journal entries from database
  const loadEntries = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // PF-14.1: Sync ledger with payments table (single source of truth). Any payment whose
      // payment_account_id differs from the effective debit account in JEs gets a backfilled
      // account-adjustment JE so Cash/Bank ledgers show correctly without per-screen fixes.
      try {
        const { syncPaymentAccountAdjustmentsForCompany } = await import('@/app/services/paymentAdjustmentService');
        const syncResult = await syncPaymentAccountAdjustmentsForCompany(companyId);
        const { synced } = syncResult;
        const { tracePaymentEditFlow } = await import('@/app/lib/paymentEditFlowTrace');
        tracePaymentEditFlow('AccountingContext.loadEntries.sync_payment_accounts', {
          companyId,
          synced,
          errors: syncResult.errors,
          skippedDuplicates: syncResult.skippedDuplicates,
          skippedAmbiguous: syncResult.skippedAmbiguous,
          skippedPf14Chain: syncResult.skippedPf14Chain,
        });
        if (synced > 0 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
        }
      } catch (syncErr) {
        if (import.meta.env?.DEV) console.warn('[ACCOUNTING CONTEXT] Payment account sync:', syncErr);
      }

      // Convert ISO strings back to Date objects only at call time — deps stay as stable primitives
      const startDate = startDateISO ? new Date(startDateISO) : null;
      const endDate = endDateISO ? new Date(endDateISO) : null;
      const data = await accountingService.getAllEntries(
        companyId, 
        branchId === 'all' ? undefined : branchId || undefined,
        startDate,
        endDate
      );
      const chainIndex = buildPaymentChainIndex(data as any[]);
      const convertedEntries = data.map((je) => convertFromJournalEntry(je as JournalEntryWithLines, chainIndex));
      setEntries(convertedEntries);
      if (import.meta.env?.DEV) console.log('✅ Journal entries loaded:', convertedEntries.length);
      
      // Recalculate balances from real entries
      recalculateBalances(convertedEntries);
    } catch (error) {
      console.error('[ACCOUNTING CONTEXT] Error loading journal entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, startDateISO, endDateISO, convertFromJournalEntry]);

  // Recalculate balances from entries
  const recalculateBalances = useCallback((entriesToUse: AccountingEntry[]) => {
    const newBalances = new Map<AccountType, number>();
    
    entriesToUse.forEach(entry => {
      // Update debit account
      const currentDebit = newBalances.get(entry.debitAccount) || 0;
      newBalances.set(entry.debitAccount, currentDebit + entry.amount);
      
      // Update credit account
      const currentCredit = newBalances.get(entry.creditAccount) || 0;
      newBalances.set(entry.creditAccount, currentCredit + entry.amount);
    });
    
    setBalances(newBalances);
  }, []);

  // Load accounts and entries on mount and when company/branch/date range changes
  useEffect(() => {
    if (companyId) {
      loadAccounts();
      loadEntries();
    }
  }, [companyId, branchId, startDateISO, endDateISO, loadAccounts, loadEntries]);

  // CRITICAL: Listen for purchase/sale delete events to refresh entries
  useEffect(() => {
    const handlePurchaseDelete = () => {
      console.log('[ACCOUNTING CONTEXT] Purchase deleted, refreshing entries...');
      loadEntries();
    };
    
    const handleSaleDelete = () => {
      console.log('[ACCOUNTING CONTEXT] Sale deleted, refreshing entries...');
      loadEntries();
    };

    window.addEventListener('purchaseDeleted', handlePurchaseDelete);
    window.addEventListener('saleDeleted', handleSaleDelete);
    
    return () => {
      window.removeEventListener('purchaseDeleted', handlePurchaseDelete);
      window.removeEventListener('saleDeleted', handleSaleDelete);
    };
  }, [loadEntries]);

  /** Journal / payment flows dispatch `accountingEntriesChanged` — keep context entries + accounts in sync without full reload. */
  useEffect(() => {
    if (!companyId) return;
    const bump = () => {
      void loadAccounts();
      void loadEntries();
      // Do not dispatch CONTACT_BALANCES_REFRESH here: callers already fire it where needed, and it retriggers
      // listeners (e.g. statement page journalRefreshTick) in the same turn as accountingEntriesChanged/paymentAdded.
    };
    /** Payments / receipts dispatch contact refresh without always firing accountingEntriesChanged — reload GL so COA balances match party RPCs. */
    const onContactBalancesRefresh = (ev: Event) => {
      const cid = (ev as CustomEvent<{ companyId?: string }>).detail?.companyId;
      if (cid && cid === companyId) {
        void loadAccounts();
        void loadEntries();
      }
    };
    window.addEventListener('accountingEntriesChanged', bump);
    window.addEventListener('paymentAdded', bump);
    window.addEventListener('ledgerUpdated', bump);
    window.addEventListener(CONTACT_BALANCES_REFRESH_EVENT, onContactBalancesRefresh);
    return () => {
      window.removeEventListener('accountingEntriesChanged', bump);
      window.removeEventListener('paymentAdded', bump);
      window.removeEventListener('ledgerUpdated', bump);
      window.removeEventListener(CONTACT_BALANCES_REFRESH_EVENT, onContactBalancesRefresh);
    };
  }, [companyId, loadAccounts, loadEntries]);

  // ============================================
  // 🎯 REAL DATA LOADING (NO DEMO DATA)
  // ============================================
  // All data is now loaded from database via loadEntries() and loadAccounts()
  // No demo/static initialization - all entries come from journal_entries table

  // ============================================
  // 🔧 HELPER: Generate unique ID
  // ============================================
  const generateId = () => {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // ============================================
  // 🔧 HELPER: Validate double entry
  // ============================================
  const validateEntry = (debitAccount: AccountType, creditAccount: AccountType, amount: number): boolean => {
    if (amount <= 0) {
      console.error('Amount must be positive');
      return false;
    }
    if (debitAccount === creditAccount) {
      console.error('Debit and Credit accounts cannot be the same');
      return false;
    }
    return true;
  };

  // ============================================
  // 🔧 HELPER: Update balances
  // ============================================
  const updateBalances = (debitAccount: AccountType, creditAccount: AccountType, amount: number) => {
    const newBalances = new Map(balances);
    
    // Update debit account
    const currentDebit = newBalances.get(debitAccount) || 0;
    newBalances.set(debitAccount, currentDebit + amount);
    
    // Update credit account
    const currentCredit = newBalances.get(creditAccount) || 0;
    newBalances.set(creditAccount, currentCredit + amount);
    
    setBalances(newBalances);
  };

  // ============================================
  // 🎯 CORE: Create Entry (SAVES TO DATABASE)
  // ============================================
  const createEntry = async (entry: Omit<AccountingEntry, 'id' | 'date' | 'createdBy'>): Promise<boolean> => {
    // [WORKER LEDGER DEBUG] Log createEntry input
    if (typeof window !== 'undefined' && (entry.debitAccount === 'Worker Payable' || entry.creditAccount === 'Worker Payable')) {
      console.log('[WORKER LEDGER DEBUG] createEntry input', {
        source: entry.source,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        amount: entry.amount,
        metadataWorkerId: entry.metadata?.workerId ?? null,
        metadataWorkerName: entry.metadata?.workerName ?? null,
      });
    }

    // CRITICAL FIX: Validate branchId - must be valid UUID or null, not "all"
    const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
    
    if (!companyId) {
      console.error('[ACCOUNTING] Cannot create entry: companyId missing');
      toast.error('Cannot create entry: Company not set');
      return false;
    }

    if (!validateEntry(entry.debitAccount, entry.creditAccount, entry.amount)) {
      return false;
    }

    // CRITICAL FIX: Declare variables outside try block to fix scope error
    let debitAccountObj: Account | undefined;
    let creditAccountObj: Account | undefined;
    let normalizedDebitAccount = '';
    let normalizedCreditAccount = '';

    try {
      // Map common account name variations to actual account names
      const accountNameMap: Record<string, string> = {
        'cash': 'Cash',
        'Cash': 'Cash',
        'bank': 'Bank',
        'Bank': 'Bank',
        'mobile wallet': 'Mobile Wallet',
        'Mobile Wallet': 'Mobile Wallet',
        'mobile_wallet': 'Mobile Wallet',
        'accounts receivable': 'Accounts Receivable',
        'Accounts Receivable': 'Accounts Receivable',
        'accounts payable': 'Accounts Payable',
        'Accounts Payable': 'Accounts Payable',
        'worker payable': 'Worker Payable',
        'Worker Payable': 'Worker Payable',
        'cost of production': 'Cost of Production',
        'Cost of Production': 'Cost of Production',
        'sales income': 'Sales Revenue',
        'Sales Income': 'Sales Revenue',
        'Sales Revenue': 'Sales Revenue',
        'rental income': 'Rental Income',
        'Rental Income': 'Rental Income',
        'rental damage income': 'Rental Damage Income',
        'Rental Damage Income': 'Rental Damage Income',
      };

      normalizedDebitAccount = accountNameMap[entry.debitAccount] || entry.debitAccount;
      normalizedCreditAccount = accountNameMap[entry.creditAccount] || entry.creditAccount;
      // Generate entry number
      const entryNo = `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const entryDate =
        (entry.metadata as { postingDate?: string } | undefined)?.postingDate?.slice(0, 10) ||
        new Date().toISOString().split('T')[0];

      // Find account IDs for debit and credit (case-insensitive)
      // When metadata.debitAccountId is set (e.g. on-account payment), use that for debit
      const debitAccountIdFromMeta = (entry.metadata as any)?.debitAccountId;
      if (debitAccountIdFromMeta) {
        debitAccountObj = accounts.find(acc => acc.id === debitAccountIdFromMeta);
      }
      const creditAccountIdFromMeta = (entry.metadata as any)?.creditAccountId;
      if (creditAccountIdFromMeta) {
        creditAccountObj = accounts.find(acc => acc.id === creditAccountIdFromMeta);
      }
      const invNorm = (s: string) => s === 'Inventory' || s.toLowerCase() === 'inventory';
      if (!debitAccountObj && invNorm(normalizedDebitAccount)) {
        debitAccountObj = pickCanonicalInventoryAssetAccount(accounts);
      }
      if (!creditAccountObj && invNorm(normalizedCreditAccount)) {
        creditAccountObj = pickCanonicalInventoryAssetAccount(accounts);
      }
      if (!debitAccountObj) {
        // CRITICAL FIX: accountType might not exist, use type, name, and code for lookup
        debitAccountObj = accounts.find((acc) => {
          if (invNorm(normalizedDebitAccount)) return false;
          const accType = acc.accountType || acc.type || '';
          const accName = acc.name || '';
          const accCode = acc.code || '';
          return (
            accType.toLowerCase() === normalizedDebitAccount.toLowerCase() ||
            accType.toLowerCase().replace(/_/g, ' ') === normalizedDebitAccount.toLowerCase() ||
            accName.toLowerCase() === normalizedDebitAccount.toLowerCase() ||
            accName.toLowerCase().includes(normalizedDebitAccount.toLowerCase()) ||
            (normalizedDebitAccount === 'Cash' && (accCode === '1000' || accName.toLowerCase().includes('cash'))) ||
            (normalizedDebitAccount === 'Bank' && (accCode === '1010' || accName.toLowerCase().includes('bank'))) ||
            (normalizedDebitAccount === 'Mobile Wallet' && (accCode === '1020' || accType.toLowerCase().includes('mobile') || accName.toLowerCase().includes('wallet'))) ||
            (normalizedDebitAccount === 'Accounts Receivable' && (accCode === '1100' || accName.toLowerCase().includes('receivable'))) ||
            (normalizedDebitAccount === 'Accounts Payable' && (accCode === '2000' || accName.toLowerCase().includes('payable'))) ||
            (normalizedDebitAccount === 'Worker Payable' && (accCode === '2010' || accName.toLowerCase().includes('worker'))) ||
            (normalizedDebitAccount === 'Sales Revenue' &&
              (accCode === '4000' ||
                accCode === '4010' ||
                (accName.toLowerCase().includes('sales') &&
                  (accName.toLowerCase().includes('revenue') || accName.toLowerCase().includes('income')) &&
                  !accName.toLowerCase().includes('rental')))) ||
            (normalizedDebitAccount === 'Expense' && (accCode === '5100' || accCode === '5200' || accCode === '6000' || accType.toLowerCase() === 'expense' || accName.toLowerCase().includes('expense')))
          );
        });
      }
      if (!creditAccountObj) {
        creditAccountObj = accounts.find((acc) => {
          if (invNorm(normalizedCreditAccount)) return false;
          const accType = acc.accountType || acc.type || '';
          const accName = acc.name || '';
          const accCode = acc.code || '';
          return (
            accType.toLowerCase() === normalizedCreditAccount.toLowerCase() ||
            accName.toLowerCase() === normalizedCreditAccount.toLowerCase() ||
            accName.toLowerCase().includes(normalizedCreditAccount.toLowerCase()) ||
            (normalizedCreditAccount === 'Cash' && (accCode === '1000' || accName.toLowerCase().includes('cash'))) ||
            (normalizedCreditAccount === 'Bank' && (accCode === '1010' || accName.toLowerCase().includes('bank'))) ||
            (normalizedCreditAccount === 'Mobile Wallet' && (accCode === '1020' || accType.toLowerCase().includes('mobile') || accName.toLowerCase().includes('wallet') || accName.toLowerCase().includes('jazz') || accName.toLowerCase().includes('easypaisa'))) ||
            (normalizedCreditAccount === 'Accounts Receivable' && (accCode === '1100' || accName.toLowerCase().includes('receivable'))) ||
            (normalizedCreditAccount === 'Accounts Payable' && (accCode === '2000' || accName.toLowerCase().includes('payable'))) ||
            (normalizedCreditAccount === 'Worker Payable' && (accCode === '2010' || accName.toLowerCase().includes('worker'))) ||
            (normalizedCreditAccount === 'Rental Income' &&
              (accCode === '4200' ||
                (accName.toLowerCase().includes('rental') &&
                  (accName.toLowerCase().includes('income') || accName.toLowerCase().includes('revenue'))))) ||
            (normalizedCreditAccount === 'Rental Damage Income' && (accName.toLowerCase().includes('rental') || accName.toLowerCase().includes('damage') || accName.toLowerCase().includes('income'))) ||
            (normalizedCreditAccount === 'Sales Revenue' &&
              (accCode === '4000' ||
                accCode === '4010' ||
                (accName.toLowerCase().includes('sales') &&
                  (accName.toLowerCase().includes('revenue') || accName.toLowerCase().includes('income')) &&
                  !accName.toLowerCase().includes('rental'))))
          );
        });
      }
      // Expense payment fallback: if credit (payment method) not found, use Cash (1000) so double-entry always completes
      if (!creditAccountObj && entry.debitAccount === 'Expense' && entry.source === 'Expense') {
        creditAccountObj = accounts.find(acc => acc.code === '1000' || (acc.name || '').toLowerCase().includes('cash'));
      }

      if (!debitAccountObj || !creditAccountObj) {
        console.error('[ACCOUNTING] Account not found:', { 
          debitAccount: entry.debitAccount, 
          normalizedDebit: normalizedDebitAccount,
          creditAccount: entry.creditAccount,
          normalizedCredit: normalizedCreditAccount,
          availableAccounts: accounts.map(a => ({ 
            id: a.id,
            name: a.name, 
            type: a.type,
            accountType: a.accountType 
          }))
        });
        
        // CRITICAL FIX: Ensure default accounts exist and reload (only admin/manager/accountant can INSERT per RLS)
        if (companyId) {
          try {
            const canCreateAccounts = ['admin', 'manager', 'accountant'].includes(String(userRole || '').toLowerCase());
            if (canCreateAccounts) {
              const { defaultAccountsService } = await import('@/app/services/defaultAccountsService');
              await defaultAccountsService.ensureDefaultAccounts(companyId);
            }
            // Reload accounts
            const refreshedData = await accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined);
            const refreshedAccounts = refreshedData.map((acc: any) => ({
              id: acc.id,
              name: acc.name || '',
              type: (acc.type || 'Cash') as PaymentMethod,
              accountType: acc.type || 'Cash',
              balance: parseFloat(acc.balance || 0),
              branch: acc.branch_name || acc.branch_id || '',
              isActive: acc.is_active !== false,
              code: acc.code || undefined, // CRITICAL FIX: Include code for account lookup
              is_group: acc.is_group === true,
              parent_id: acc.parent_id ?? null,
            }));
            setAccounts(refreshedAccounts);
            
            // Retry lookup with refreshed accounts (include code in search)
            const retryDebit = invNorm(normalizedDebitAccount)
              ? pickCanonicalInventoryAssetAccount(refreshedAccounts)
              : refreshedAccounts.find((acc) => {
                  const accType = (acc.accountType || acc.type || '').toString().toLowerCase();
                  const accName = (acc.name || '').toLowerCase();
                  const accCode = acc.code || '';
                  return (
                    accType === normalizedDebitAccount.toLowerCase() ||
                    accName === normalizedDebitAccount.toLowerCase() ||
                    accName.includes(normalizedDebitAccount.toLowerCase()) ||
                    (normalizedDebitAccount === 'Cash' && (accCode === '1000' || accName.includes('cash'))) ||
                    (normalizedDebitAccount === 'Bank' && (accCode === '1010' || accName.includes('bank'))) ||
                    (normalizedDebitAccount === 'Mobile Wallet' && (accCode === '1020' || accType.includes('mobile') || accName.includes('wallet'))) ||
                    (normalizedDebitAccount === 'Accounts Receivable' && (accCode === '1100' || accName.includes('receivable'))) ||
                    (normalizedDebitAccount === 'Accounts Payable' && (accCode === '2000' || accName.includes('payable'))) ||
                    (normalizedDebitAccount === 'Worker Payable' && (accCode === '2010' || accName.includes('worker')))
                  );
                });
            const retryCredit = invNorm(normalizedCreditAccount)
              ? pickCanonicalInventoryAssetAccount(refreshedAccounts)
              : refreshedAccounts.find((acc) => {
                  const accType = (acc.accountType || acc.type || '').toString().toLowerCase();
                  const accName = (acc.name || '').toLowerCase();
                  const accCode = acc.code || '';
                  return (
                    accType === normalizedCreditAccount.toLowerCase() ||
                    accName === normalizedCreditAccount.toLowerCase() ||
                    accName.includes(normalizedCreditAccount.toLowerCase()) ||
                    (normalizedCreditAccount === 'Cash' && (accCode === '1000' || accName.includes('cash'))) ||
                    (normalizedCreditAccount === 'Bank' && (accCode === '1010' || accName.includes('bank'))) ||
                    (normalizedCreditAccount === 'Accounts Receivable' && (accCode === '1100' || accName.includes('receivable'))) ||
                    (normalizedCreditAccount === 'Accounts Payable' && (accCode === '2000' || accName.includes('payable'))) ||
                    (normalizedCreditAccount === 'Worker Payable' && (accCode === '2010' || accName.includes('worker'))) ||
                    (normalizedCreditAccount === 'Sales Revenue' && (accCode === '4000' || accName.includes('sales') || accName.includes('revenue')))
                  );
                });
            
            if (retryDebit && retryCredit) {
              // Update the account objects for use in journal entry creation
              debitAccountObj = retryDebit;
              creditAccountObj = retryCredit;
              
              // Use retry accounts - continue with journal entry creation
              // Primary reference = auto entry_no; optional user ref in description
              let descRetry = entry.description || '';
              if (entry.metadata?.optionalReference?.trim()) {
                descRetry += (descRetry ? '\n' : '') + 'Ref: ' + entry.metadata.optionalReference.trim();
              }
      const isWorkerPaymentRetry = entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId;
      const prelinkedPayIdRetry =
        entry.source === 'Payment' && (entry.metadata as { paymentId?: string })?.paymentId
          ? String((entry.metadata as { paymentId?: string }).paymentId)
          : null;
      const journalEntry: JournalEntry = {
        company_id: companyId,
        branch_id: validBranchId,
        entry_no: `JE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        entry_date: new Date().toISOString().split('T')[0],
        description: descRetry || undefined,
        reference_type: isWorkerPaymentRetry ? 'worker_payment' : entry.source.toLowerCase(),
        reference_id: isWorkerPaymentRetry
          ? entry.metadata.workerId
          : (prelinkedPayIdRetry ||
              entry.metadata?.purchaseReturnId ||
              entry.metadata?.saleId ||
              entry.metadata?.purchaseId ||
              entry.metadata?.expenseId ||
              entry.metadata?.bookingId ||
              null),
        created_by: currentUserId || null,
        attachments: entry.metadata?.attachments && entry.metadata.attachments.length > 0 ? entry.metadata.attachments : undefined,
      };
      const lines: JournalEntryLine[] = [
        { account_id: retryDebit.id, debit: entry.amount, credit: 0, description: descRetry || entry.description },
        { account_id: retryCredit.id, debit: 0, credit: entry.amount, description: descRetry || entry.description },
      ];
      const paymentId = entry.metadata?.paymentId;
      const savedEntry = await accountingService.createEntry(journalEntry, lines, paymentId);
              if (typeof window !== 'undefined' && entry.debitAccount === 'Worker Payable') {
                console.log('[WORKER LEDGER DEBUG] (retry path) journal insert result', { journalEntryId: (savedEntry as any)?.id ?? null });
              }
              const retryPayNowFull =
                entry.metadata?.stageId != null &&
                entry.metadata?.stageAmount != null &&
                typeof entry.metadata.stageAmount === 'number' &&
                entry.amount >= entry.metadata.stageAmount;
              if (entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId && companyId && !retryPayNowFull) {
                if (typeof window !== 'undefined') {
                  console.log('[WORKER LEDGER DEBUG] (retry path) calling worker ledger sync', { workerId: entry.metadata.workerId });
                }
                try {
                  const { studioProductionService } = await import('@/app/services/studioProductionService');
                  await studioProductionService.recordAccountingPaymentToLedger({
                    companyId,
                    workerId: entry.metadata.workerId,
                    amount: entry.amount,
                    paymentReference: entry.referenceNo,
                    journalEntryId: (savedEntry as any)?.id,
                    notes: entry.description || `Payment to worker`,
                  });
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
                  }
                } catch (e) {
                  console.warn('[AccountingContext] Worker ledger entry failed (journal saved):', e);
                }
              } else if (entry.debitAccount === 'Worker Payable' && (retryPayNowFull || !entry.metadata?.workerId) && typeof window !== 'undefined') {
                if (retryPayNowFull) {
                  console.log('[WORKER LEDGER DEBUG] (retry path) Pay Now full payment – skip worker_ledger insert');
                  if (entry.metadata?.workerId) {
                    window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
                  }
                } else {
                  console.warn('[WORKER LEDGER DEBUG] (retry path) Worker Payable debit but no metadata.workerId');
                }
              }
              const convertedEntry = convertFromJournalEntry(savedEntry as JournalEntryWithLines);
              setEntries(prev => [convertedEntry, ...prev]);
              updateBalances(entry.debitAccount, entry.creditAccount, entry.amount);
              console.log('✅ Accounting Entry Created and Saved:', convertedEntry);
              toast.success('Accounting entry created successfully');
              return true;
            }
          } catch (ensureError: any) {
            console.error('[ACCOUNTING] Error ensuring default accounts:', ensureError);
          }
        }
        
        toast.error(`Account not found: ${!debitAccountObj ? normalizedDebitAccount : normalizedCreditAccount}. Please create the account first.`);
        return false;
      }

      // Canonical rule: if a transaction touches Cash/Bank/Wallet, create payments row so Roznamcha shows it
      let manualPaymentId: string | null = null;
      let manualRefType: string | null = null;
      const debitIsPayment = debitAccountObj ? isPaymentAccount(debitAccountObj) : false;
      const creditIsPayment = creditAccountObj ? isPaymentAccount(creditAccountObj) : false;

      if (entry.source === 'Manual' && debitAccountObj && creditAccountObj) {
        if (debitIsPayment && !creditIsPayment) {
          const refNo = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'customer_receipt').catch(() => generatePaymentReference(null));
          const { data: { user } } = await supabase.auth.getUser();
          const manualCustomerId = (entry.metadata as { customerId?: string } | undefined)?.customerId ?? null;
          const manualReceiptPayload: Record<string, unknown> = {
            company_id: companyId,
            branch_id: validBranchId,
            payment_type: 'received',
            reference_type: 'manual_receipt',
            reference_id: null,
            amount: entry.amount,
            payment_method: paymentMethodFromAccount(debitAccountObj),
            payment_account_id: debitAccountObj.id,
            payment_date: entryDate,
            reference_number: refNo,
            received_by: (user as any)?.id ?? null,
            created_by: currentUserId ?? null,
          };
          if (manualCustomerId) manualReceiptPayload.contact_id = manualCustomerId;
          const { data: row, error } = await supabase.from('payments').insert(manualReceiptPayload).select('id').single();
          if (!error && row) { manualPaymentId = (row as { id: string }).id; manualRefType = 'manual_receipt'; }
        } else if (!debitIsPayment && creditIsPayment) {
          const refNo = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'supplier_payment').catch(() => generatePaymentReference(null));
          const { data: { user } } = await supabase.auth.getUser();
          const manualPaymentPayload: Record<string, unknown> = {
            company_id: companyId,
            branch_id: validBranchId,
            payment_type: 'paid',
            reference_type: 'manual_payment',
            reference_id: null,
            amount: entry.amount,
            payment_method: paymentMethodFromAccount(creditAccountObj),
            payment_account_id: creditAccountObj.id,
            payment_date: entryDate,
            reference_number: refNo,
            received_by: (user as any)?.id ?? null,
            created_by: currentUserId ?? null,
          };
          // Supplier ledger: set contact_id when Dr AP (supplier payment) and supplier selected (real schema: payments.contact_id)
          const manualSupplierContactId = (entry.debitAccount === 'Accounts Payable' && (entry.metadata as any)?.contactId) ? (entry.metadata as any).contactId : null;
          if (manualSupplierContactId) manualPaymentPayload.contact_id = manualSupplierContactId;
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.debug('[SUPPLIER_LEDGER] Manual payment payload', { contact_id: manualSupplierContactId ?? null, reference_type: 'manual_payment', amount: manualPaymentPayload.amount });
          }
          const { data: row, error } = await supabase.from('payments').insert(manualPaymentPayload).select('id').single();
          if (!error && row) { manualPaymentId = (row as { id: string }).id; manualRefType = 'manual_payment'; }
        }
      }

      // Expense: Dr Expense Cr Cash/Bank → must create payments row (reference_type = expense) so Roznamcha shows it
      if (entry.source === 'Expense' && creditAccountObj && debitAccountObj && creditIsPayment) {
        const refNo = await documentNumberService.getNextDocumentNumber(companyId, validBranchId, 'expense').catch(() => generatePaymentReference(null));
        const { data: { user } } = await supabase.auth.getUser();
        const expenseId = (entry.metadata as any)?.expenseId ?? null;
        const { data: row, error } = await supabase.from('payments').insert({
          company_id: companyId,
          branch_id: validBranchId,
          payment_type: 'paid',
          reference_type: 'expense',
          reference_id: expenseId,
          amount: entry.amount,
          payment_method: paymentMethodFromAccount(creditAccountObj),
          payment_account_id: creditAccountObj.id,
          payment_date: entryDate,
          reference_number: refNo,
          received_by: (user as any)?.id ?? null,
          created_by: currentUserId ?? null,
        }).select('id').single();
        if (!error && row) { manualPaymentId = (row as { id: string }).id; manualRefType = 'expense'; }
      }

      // Primary reference is always auto (entry_no). Optional user reference saved in description.
      let descriptionToSave = entry.description || '';
      if (entry.metadata?.optionalReference?.trim()) {
        descriptionToSave += (descriptionToSave ? '\n' : '') + 'Ref: ' + entry.metadata.optionalReference.trim();
      }

      // Create journal entry (matching database schema)
      // CRITICAL FIX: Use null instead of undefined for optional UUID fields to prevent "undefinedundefined" error
      // CRITICAL FIX: Use validBranchId (not "all") to prevent UUID error
      // Worker payment: store worker_id in journal so ledger/backfill can trace (reference_type=worker_payment, reference_id=workerId)
      const isWorkerPayment = entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId;
      const prelinkedCustomerPaymentId =
        entry.source === 'Payment' && (entry.metadata as { paymentId?: string })?.paymentId
          ? String((entry.metadata as { paymentId?: string }).paymentId)
          : null;
      if (entry.source === 'Payment' && entry.creditAccount === 'Accounts Receivable' && !prelinkedCustomerPaymentId && import.meta.env?.DEV) {
        console.warn(
          '[ACCOUNTING] Customer on-account JE without metadata.paymentId — journal will not link to payments row (tie-out PAYMENT_WITHOUT_JE).'
        );
      }
      if (typeof window !== 'undefined' && entry.debitAccount === 'Worker Payable') {
        console.log('[WORKER LEDGER DEBUG] journal payload', {
          isWorkerPayment,
          reference_type: isWorkerPayment ? 'worker_payment' : entry.source.toLowerCase(),
          reference_id: isWorkerPayment ? entry.metadata?.workerId : null,
          debitAccountId: debitAccountObj?.id,
          creditAccountId: creditAccountObj?.id,
        });
      }
      const journalEntry: JournalEntry = {
        company_id: companyId,
        branch_id: validBranchId,
        entry_no: entryNo,
        entry_date: entryDate,
        description: descriptionToSave || undefined,
        reference_type: manualRefType || (isWorkerPayment ? 'worker_payment' : entry.source.toLowerCase()),
        reference_id: isWorkerPayment
          ? entry.metadata.workerId
          : manualRefType === 'manual_receipt' && (entry.metadata as { customerId?: string })?.customerId
            ? (entry.metadata as { customerId?: string }).customerId
            : (prelinkedCustomerPaymentId ||
                entry.metadata?.saleReturnId ||
                entry.metadata?.purchaseReturnId ||
                entry.metadata?.saleId ||
                entry.metadata?.purchaseId ||
                entry.metadata?.expenseId ||
                entry.metadata?.bookingId ||
                null),
        created_by: currentUserId || null,
        attachments: entry.metadata?.attachments && entry.metadata.attachments.length > 0 ? entry.metadata.attachments : undefined,
      };

      // Create journal entry lines (matching database schema - no account_name)
      const lines: JournalEntryLine[] = [
        {
          account_id: debitAccountObj.id,
          debit: entry.amount,
          credit: 0,
          description: descriptionToSave || entry.description,
        },
        {
          account_id: creditAccountObj.id,
          debit: 0,
          credit: entry.amount,
          description: descriptionToSave || entry.description,
        },
      ];

      // Save to database (link to payment when Manual entry involves payment account)
      const paymentIdToLink = manualPaymentId || (entry.metadata as any)?.paymentId;
      const savedEntry = await accountingService.createEntry(journalEntry, lines, paymentIdToLink);
      if (typeof window !== 'undefined' && entry.debitAccount === 'Worker Payable') {
        console.log('[WORKER LEDGER DEBUG] journal insert result', {
          journalEntryId: (savedEntry as any)?.id ?? null,
          entry_no: (savedEntry as any)?.entry_no ?? null,
        });
      }

      // Manual customer receipt (Dr cash/bank/wallet, Cr AR): FIFO allocate to open invoices — same as Add Entry V2.
      if (manualRefType === 'manual_receipt' && manualPaymentId && companyId) {
        const customerId = (entry.metadata as { customerId?: string } | undefined)?.customerId;
        const creditCode = String((creditAccountObj as { code?: string } | undefined)?.code ?? '');
        const creditName = String((creditAccountObj as { name?: string } | undefined)?.name ?? '').toLowerCase();
        const creditIsAr =
          entry.creditAccount === 'Accounts Receivable' ||
          creditCode === '1100' ||
          creditName.includes('receivable');
        if (customerId && creditIsAr && debitIsPayment) {
          try {
            const { data: payRow } = await supabase
              .from('payments')
              .select('reference_number, payment_date, amount')
              .eq('id', manualPaymentId)
              .single();
            const { applyManualReceiptAllocations } = await import('@/app/services/paymentAllocationService');
            await applyManualReceiptAllocations({
              companyId,
              branchId: validBranchId,
              paymentId: manualPaymentId,
              customerId,
              amount: Number(entry.amount) || 0,
              paymentDate: String((payRow as any)?.payment_date || entryDate),
              referenceNumber: String((payRow as any)?.reference_number || ''),
              createdBy: currentUserId ?? null,
              explicitAllocations: null,
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: customerId } }));
            }
          } catch (allocErr: any) {
            console.warn('[ACCOUNTING] Manual receipt saved but FIFO allocation failed:', allocErr?.message || allocErr);
            toast.error(allocErr?.message || 'Receipt saved; invoice allocation failed — check open invoices and migration 20260356.');
          }
        }
      }

      // Manual supplier payment (Dr AP, Cr cash/bank/wallet): FIFO allocate to open purchase bills — same as Add Entry V2.
      if (manualRefType === 'manual_payment' && manualPaymentId && companyId) {
        const supplierId = (entry.metadata as { contactId?: string } | undefined)?.contactId;
        const debitCode = String((debitAccountObj as { code?: string } | undefined)?.code ?? '');
        const debitName = String((debitAccountObj as { name?: string } | undefined)?.name ?? '').toLowerCase();
        const debitIsAp =
          entry.debitAccount === 'Accounts Payable' ||
          debitCode === '2000' ||
          debitName.includes('accounts payable') ||
          debitName.includes('payable');
        if (supplierId && debitIsAp && creditIsPayment) {
          try {
            const { data: payRow } = await supabase
              .from('payments')
              .select('reference_number, payment_date, amount')
              .eq('id', manualPaymentId)
              .single();
            const { applyManualSupplierPaymentAllocations } = await import('@/app/services/paymentAllocationService');
            await applyManualSupplierPaymentAllocations({
              companyId,
              branchId: validBranchId,
              paymentId: manualPaymentId,
              supplierId,
              amount: Number(entry.amount) || 0,
              paymentDate: String((payRow as any)?.payment_date || entryDate),
              referenceNumber: String((payRow as any)?.reference_number || ''),
              createdBy: currentUserId ?? null,
              explicitAllocations: null,
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
              window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: supplierId } }));
            }
          } catch (allocErr: any) {
            console.warn('[ACCOUNTING] Manual supplier payment saved but FIFO allocation failed:', allocErr?.message || allocErr);
            toast.error(allocErr?.message || 'Payment saved; bill allocation failed — check open bills and migration 20260361.');
          }
        } else if ((entry.metadata as any)?.contactId && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'supplier', entityId: (entry.metadata as any).contactId } })
          );
        }
      }

      // Worker Payable debit = worker payment → sync to worker_ledger_entries so worker ledger shows it (Journal already has reference_type=worker_payment, reference_id=workerId)
      // Pay Now (stageId): full payment (amount >= stageAmount) → skip ledger insert; caller will markStageLedgerPaid. Partial → add payment row.
      const isPayNowFullPayment =
        entry.metadata?.stageId != null &&
        entry.metadata?.stageAmount != null &&
        typeof entry.metadata.stageAmount === 'number' &&
        entry.amount >= entry.metadata.stageAmount;
      if (entry.debitAccount === 'Worker Payable' && entry.metadata?.workerId && companyId && !isPayNowFullPayment) {
        if (typeof window !== 'undefined') {
          console.log('[WORKER LEDGER DEBUG] calling worker ledger sync', {
            workerId: entry.metadata.workerId,
            amount: entry.amount,
            journalEntryId: (savedEntry as any)?.id,
            stageId: entry.metadata.stageId ?? null,
            stageAmount: entry.metadata.stageAmount ?? null,
            isPayNowFullPayment,
          });
        }
        try {
          const { studioProductionService } = await import('@/app/services/studioProductionService');
          await studioProductionService.recordAccountingPaymentToLedger({
            companyId,
            workerId: entry.metadata.workerId,
            amount: entry.amount,
            paymentReference: entry.referenceNo,
            journalEntryId: (savedEntry as any)?.id,
            notes: entry.description || `Payment to worker`,
          });
          if (typeof window !== 'undefined') {
            console.log('[WORKER LEDGER DEBUG] worker ledger sync OK', { workerId: entry.metadata.workerId });
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
          }
        } catch (e) {
          console.warn('[AccountingContext] Worker ledger entry failed (journal saved):', e);
          if (typeof window !== 'undefined') {
            console.error('[WORKER LEDGER DEBUG] worker ledger sync FAILED', { workerId: entry.metadata.workerId, error: e });
          }
        }
      } else if (entry.debitAccount === 'Worker Payable' && isPayNowFullPayment && typeof window !== 'undefined') {
        console.log('[WORKER LEDGER DEBUG] Pay Now full payment – skip worker_ledger insert; caller will markStageLedgerPaid', {
          workerId: entry.metadata?.workerId,
          amount: entry.amount,
          stageId: entry.metadata?.stageId,
        });
        if (entry.metadata?.workerId) {
          window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: entry.metadata.workerId } }));
        }
      } else if (entry.debitAccount === 'Worker Payable' && !entry.metadata?.workerId && typeof window !== 'undefined') {
        console.warn('[WORKER LEDGER DEBUG] Worker Payable debit but no metadata.workerId – entry will NOT appear in worker ledger. Use Pay Worker flow or select worker in Manual Entry.');
      }

      // Convert and add to local state
      const convertedEntry = convertFromJournalEntry(savedEntry as JournalEntryWithLines);
      setEntries(prev => [convertedEntry, ...prev]);
      
      // Update balances
    updateBalances(entry.debitAccount, entry.creditAccount, entry.amount);

      console.log('✅ Accounting Entry Created and Saved:', convertedEntry);
      toast.success('Accounting entry created successfully');
    return true;
    } catch (error: any) {
      console.error('[ACCOUNTING] Error creating entry:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        debitAccount: entry.debitAccount,
        creditAccount: entry.creditAccount,
        debitAccountObj: debitAccountObj?.id,
        creditAccountObj: creditAccountObj?.id,
        companyId,
        branchId
      });
      
      // Show user-friendly error message
      if (error?.code === 'PGRST205' || error?.message?.includes('does not exist')) {
        toast.error('Journal Entries table not found. Please run CREATE_JOURNAL_ENTRIES_TABLE.sql in Supabase SQL Editor.', {
          duration: 10000,
        });
      } else {
        toast.error(error?.message || 'Failed to create accounting entry');
      }
      return false;
    }
  };

  // ============================================
  // 📊 QUERY FUNCTIONS
  // ============================================
  
  const getEntriesByReference = (referenceNo: string): AccountingEntry[] => {
    return entries.filter(entry => entry.referenceNo === referenceNo);
  };

  const getEntriesBySource = (source: TransactionSource): AccountingEntry[] => {
    return entries.filter(entry => entry.source === source);
  };

  const getAccountBalance = (accountType: AccountType): number => {
    return balances.get(accountType) || 0;
  };

  // Query helpers for entities
  const getEntriesBySupplier = (supplierName: string, supplierId?: string): AccountingEntry[] => {
    return entries.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;
      return metadata.supplierName === supplierName || 
             (supplierId && metadata.supplierId === supplierId);
    });
  };

  const getEntriesByCustomer = (customerName: string, customerId?: string): AccountingEntry[] => {
    return entries.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;
      return metadata.customerName === customerName || 
             (customerId && metadata.customerId === customerId);
    });
  };

  const getEntriesByWorker = (workerName: string, workerId?: string): AccountingEntry[] => {
    return entries.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;
      return metadata.workerName === workerName || 
             (workerId && metadata.workerId === workerId);
    });
  };

  const getSupplierBalance = (supplierName: string, supplierId?: string): number => {
    const supplierEntries = getEntriesBySupplier(supplierName, supplierId);
    let balance = 0;
    supplierEntries.forEach(entry => {
      if (entry.debitAccount === 'Accounts Payable') {
        balance -= entry.amount; // Payment reduces balance
      } else if (entry.creditAccount === 'Accounts Payable') {
        balance += entry.amount; // Purchase increases balance
      }
    });
    return balance;
  };

  const getCustomerBalance = (customerName: string, customerId?: string): number => {
    const customerEntries = getEntriesByCustomer(customerName, customerId);
    let balance = 0;
    customerEntries.forEach(entry => {
      if (entry.debitAccount === 'Accounts Receivable') {
        balance += entry.amount; // Sale increases balance
      } else if (entry.creditAccount === 'Accounts Receivable') {
        balance -= entry.amount; // Payment reduces balance
      }
    });
    return balance;
  };

  const getWorkerBalance = (workerName: string, workerId?: string): number => {
    const workerEntries = getEntriesByWorker(workerName, workerId);
    let balance = 0;
    workerEntries.forEach(entry => {
      if (entry.debitAccount === 'Worker Payable') {
        balance -= entry.amount; // Payment reduces balance
      } else if (entry.creditAccount === 'Worker Payable') {
        balance += entry.amount; // Job completion increases balance
      }
    });
    return balance;
  };

  // ============================================
  // 💰 SALES MODULE → ACCOUNTING
  // ============================================
  
  const recordSale = async (params: SaleAccountingParams): Promise<boolean> => {
    const { saleId, invoiceNo, customerName, customerId, amount, paymentMethod, paidAmount, module } = params;

    // CRITICAL FIX: Map paymentMethod to correct account name
    const paymentAccountMap: Record<string, string> = {
      'cash': 'Cash',
      'Cash': 'Cash',
      'bank': 'Bank',
      'Bank': 'Bank',
      'card': 'Bank', // Card payments go to bank account
      'other': 'Bank',
    };
    const debitAccount = paymentAccountMap[paymentMethod as string] || paymentMethod || 'Cash';

    // Full payment
    if (paidAmount >= amount) {
      return await createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: debitAccount,
        creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
        amount: amount,
        description: `Sale to ${customerName} - Full Payment`,
        module: module,
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }
    
    // Partial or credit sale
    if (paidAmount > 0) {
      // Record payment
      await createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: debitAccount,
        creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
        amount: paidAmount,
        description: `Sale to ${customerName} - Partial Payment`,
        module: module,
        metadata: { customerId, customerName, saleId, invoiceNo }
      });

      // Record receivable
      return await createEntry({
        source: 'Sale',
        referenceNo: invoiceNo,
        debitAccount: 'Accounts Receivable',
        creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
        amount: amount - paidAmount,
        description: `Sale to ${customerName} - Credit`,
        module: module,
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }

    // Full credit
    return await createEntry({
      source: 'Sale',
      referenceNo: invoiceNo,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Sales Revenue', // CRITICAL FIX: Use "Sales Revenue" not "Sales Income"
      amount: amount,
      description: `Sale to ${customerName} - Credit`,
      module: module,
      metadata: { customerId, customerName, invoiceId: invoiceNo }
    });
  };

  const recordSalePayment = async (params: SalePaymentParams): Promise<boolean> => {
    const { saleId, invoiceNo, customerName, customerId, amount, paymentMethod, accountId } = params;

    const { data: saleGate } = await supabase.from('sales').select('status').eq('id', saleId).maybeSingle();
    if (!saleGate || !canPostAccountingForSaleStatus((saleGate as { status?: string }).status)) {
      console.warn('[ACCOUNTING] recordSalePayment skipped: payments / payment JEs only for Final sales', {
        saleId,
        status: (saleGate as { status?: string })?.status,
      });
      return true;
    }

    // CRITICAL FIX: Use provided accountId or find default account based on payment method
    let paymentAccountId = accountId;
    
    if (!paymentAccountId && companyId) {
      // Try to get default account by payment method
      const { accountHelperService } = await import('@/app/services/accountHelperService');
      paymentAccountId = await accountHelperService.getDefaultAccountByPaymentMethod(
        paymentMethod,
        companyId
      ) || null;
    }
    
    // If still no account, find from accounts list
    if (!paymentAccountId) {
      const paymentMethodToType: Record<string, 'Cash' | 'Bank' | 'Mobile Wallet'> = {
        'cash': 'Cash',
        'Cash': 'Cash',
        'bank': 'Bank',
        'Bank': 'Bank',
        'card': 'Bank',
        'cheque': 'Bank',
        'other': 'Bank',
        'mobile wallet': 'Mobile Wallet',
        'Mobile Wallet': 'Mobile Wallet',
      };
      
      const accountType = paymentMethodToType[paymentMethod as string] || 'Cash';
      
      const defaultAccount = accounts.find(acc => 
        (acc.type === accountType || acc.accountType === accountType) && 
        acc.isActive
      );
      
      if (defaultAccount) {
        paymentAccountId = defaultAccount.id;
      }
    }
    
    if (!paymentAccountId) {
      const errorMsg = `No account found for ${paymentMethod} payment. Please select an account or create a default account.`;
      console.error('[ACCOUNTING]', errorMsg);
      toast.error(errorMsg);
      return false;
    }

    // CRITICAL FIX: Payment journal entry is now created automatically by database trigger
    // DO NOT create duplicate journal entry here
    // The trigger `trigger_auto_create_payment_journal` handles this automatically
    // We only need to ensure the payment exists (which it does, from SalesContext.recordPayment)
    
    // Verify payment exists and trigger will create journal entry
    try {
      if (companyId && branchId) {
        const { supabase } = await import('@/lib/supabase');
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('reference_type', 'sale')
          .eq('reference_id', saleId)
          .eq('amount', amount)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (existingPayment?.id) {
          const { ensureSalePaymentJournalAfterInsert } = await import('@/app/services/saleAccountingService');
          const { assertActiveJournalForPaymentId } = await import('@/app/lib/paymentPostingInvariant');
          await ensureSalePaymentJournalAfterInsert(existingPayment.id as string);
          await assertActiveJournalForPaymentId(existingPayment.id as string, 'AccountingContext.recordSalePayment');
        } else {
          console.warn('[ACCOUNTING] recordSalePayment: no matching payments row yet for sale/amount — caller must insert payment first');
        }
      }
    } catch (error: any) {
      console.warn('[ACCOUNTING] Error verifying payment/journal entry (non-critical):', error);
    }
    
    // DO NOT call createEntry() here - trigger handles it automatically
    // This prevents duplicate journal entries
    return true;
  };

  // ============================================
  // 🏠 RENTAL MODULE → ACCOUNTING
  // ============================================

  const recordRentalBooking = async (params: RentalBookingParams): Promise<boolean> => {
    const {
      bookingId,
      customerName,
      customerId,
      advanceAmount,
      securityDepositAmount,
      securityDepositType,
      paymentMethod,
      paymentAccountId,
      paymentDate,
    } = params;

    const postingDate = paymentDate?.slice(0, 10) || new Date().toISOString().split('T')[0];
    const advanceMeta: Record<string, unknown> = {
      customerId,
      customerName,
      bookingId,
      postingDate,
      ...(paymentAccountId ? { debitAccountId: paymentAccountId } : {}),
    };

    // Record advance (debit = user-selected payment account when paymentAccountId set)
    const advanceSuccess = await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: (paymentAccountId ? 'Cash' : paymentMethod) as AccountType,
      creditAccount: 'Rental Advance',
      amount: advanceAmount,
      description: `Rental booking advance - ${customerName}`,
      module: 'Rental',
      metadata: advanceMeta,
    });

    // Record security deposit (only if cash)
    if (securityDepositType === 'Cash' && securityDepositAmount > 0) {
      const sdMeta: Record<string, unknown> = {
        customerId,
        customerName,
        bookingId,
        postingDate,
        ...(paymentAccountId ? { debitAccountId: paymentAccountId } : {}),
      };
      await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: (paymentAccountId ? 'Cash' : paymentMethod) as AccountType,
        creditAccount: 'Security Deposit',
        amount: securityDepositAmount,
        description: `Security deposit (Cash) - ${customerName}`,
        module: 'Rental',
        metadata: sdMeta,
      });
    }

    return advanceSuccess;
  };

  const recordRentalDelivery = async (params: RentalDeliveryParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, remainingAmount, paymentMethod, paymentAccountId, paymentDate } = params;

    const postingDate = paymentDate?.slice(0, 10) || new Date().toISOString().split('T')[0];
    // Use Sales Revenue (code 4000) - exists in default accounts; Rental Income falls back to it
    return await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: (paymentAccountId ? 'Cash' : paymentMethod) as AccountType,
      creditAccount: 'Sales Revenue',
      amount: remainingAmount,
      description: `Rental remaining payment - ${customerName}`,
      module: 'Rental',
      metadata: {
        customerId,
        customerName,
        bookingId,
        postingDate,
        ...(paymentAccountId ? { debitAccountId: paymentAccountId } : {}),
      },
    });
  };

  /** When delivering on credit: Debit AR, Credit Rental Income (customer owes) */
  const recordRentalCreditDelivery = async (params: RentalDeliveryParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, remainingAmount } = params;
    return await createEntry({
      source: 'Rental',
      referenceNo: bookingId,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Sales Revenue',
      amount: remainingAmount,
      description: `Rental credit - ${customerName}`,
      module: 'Rental',
      metadata: { customerId, customerName, bookingId }
    });
  };

  const recordRentalReturn = async (params: RentalReturnParams): Promise<boolean> => {
    const { bookingId, customerName, customerId, securityDepositAmount, damageCharge, paymentMethod } = params;

    if (damageCharge && damageCharge > 0) {
      // Damage charge: Debit Cash, Credit Sales Revenue (or Other Income)
      await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: (paymentMethod || 'Cash') as AccountType,
        creditAccount: 'Sales Revenue',
        amount: damageCharge,
        description: `Rental damage charge - ${customerName}`,
        module: 'Rental',
        metadata: { customerId, customerName, bookingId }
      });
    }

    // Release security deposit
    if (securityDepositAmount > 0) {
      return await createEntry({
        source: 'Rental',
        referenceNo: bookingId,
        debitAccount: 'Security Deposit',
        creditAccount: 'Cash',
        amount: securityDepositAmount,
        description: `Security deposit returned - ${customerName}`,
        module: 'Rental',
        metadata: { customerId, customerName, bookingId }
      });
    }

    return true;
  };

  // ============================================
  // 🎨 STUDIO MODULE → ACCOUNTING
  // ============================================

  const recordStudioSale = async (params: StudioSaleParams): Promise<boolean> => {
    const { invoiceNo, customerName, customerId, amount, paymentMethod, paidAmount } = params;

    // Full payment
    if (paidAmount >= amount) {
      return await createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Studio Sales Income',
        amount: amount,
        description: `Studio sale to ${customerName} - Full Payment`,
        module: 'Studio',
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }

    // Partial or credit
    if (paidAmount > 0) {
      await createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: paymentMethod as AccountType,
        creditAccount: 'Studio Sales Income',
        amount: paidAmount,
        description: `Studio sale to ${customerName} - Partial Payment`,
        module: 'Studio',
        metadata: { customerId, customerName, saleId, invoiceNo }
      });

      return await createEntry({
        source: 'Studio',
        referenceNo: invoiceNo,
        debitAccount: 'Accounts Receivable',
        creditAccount: 'Studio Sales Income',
        amount: amount - paidAmount,
        description: `Studio sale to ${customerName} - Credit`,
        module: 'Studio',
        metadata: { customerId, customerName, saleId, invoiceNo }
      });
    }

    // Full credit
    return await createEntry({
      source: 'Studio',
      referenceNo: invoiceNo,
      debitAccount: 'Accounts Receivable',
      creditAccount: 'Studio Sales Income',
      amount: amount,
      description: `Studio sale to ${customerName} - Credit`,
      module: 'Studio',
      metadata: { customerId, customerName, invoiceId: invoiceNo }
    });
  };

  const recordWorkerJobCompletion = async (params: WorkerJobParams): Promise<boolean> => {
    const { invoiceNo, workerName, workerId, stage, cost } = params;

    return await createEntry({
      source: 'Studio',
      referenceNo: invoiceNo,
      debitAccount: 'Cost of Production',
      creditAccount: 'Worker Payable',
      amount: cost,
      description: `${stage} job completed by ${workerName}`,
      module: 'Studio',
      metadata: { workerId, workerName, invoiceId: invoiceNo, stage }
    });
  };

  const recordWorkerPayment = async (params: WorkerPaymentParams): Promise<boolean | { referenceNumber: string }> => {
    const { workerName, workerId, amount, paymentMethod, paymentAccountId, referenceNo, stageId, stageAmount } = params;
    const effectiveWorkerId = workerId ?? null;
    const workerPaymentBranchId = (branchId && branchId !== 'all') ? branchId : null;

    // Canonical path: one payments row (Roznamcha) + journal + worker_ledger_entries (Phase-2)
    if (companyId && effectiveWorkerId && paymentAccountId) {
      try {
        const { createWorkerPayment } = await import('@/app/services/workerPaymentService');
        const result = await createWorkerPayment({
          companyId,
          branchId: workerPaymentBranchId,
          workerId: effectiveWorkerId,
          workerName,
          amount,
          paymentMethod: paymentMethod as string,
          paymentAccountId,
          stageId: stageId ?? null,
          stageAmount: stageAmount ?? null,
        });
        if (typeof window !== 'undefined' && effectiveWorkerId) {
          window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'worker', entityId: effectiveWorkerId } }));
        }
        return { referenceNumber: result.referenceNumber };
      } catch (e: any) {
        console.error('[AccountingContext] recordWorkerPayment (canonical) failed:', e);
        toast.error(e?.message || 'Worker payment failed');
        return false;
      }
    }

    // Fallback: journal + worker_ledger only (no payments row – will not show in Roznamcha)
    const fallbackRef = referenceNo || `PAY-${Date.now()}`;
    const success = await createEntry({
      source: 'Payment',
      referenceNo: fallbackRef,
      debitAccount: 'Worker Payable',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `Payment to worker ${workerName}`,
      module: 'Accounting',
      metadata: { workerId: effectiveWorkerId, workerName, stageId, stageAmount }
    });
    return success;
  };

  // ============================================
  // 💸 EXPENSE MODULE → ACCOUNTING
  // ============================================

  const recordExpense = async (params: ExpenseParams): Promise<boolean> => {
    const { expenseId, category, amount, paymentMethod, description, date } = params;

    return await createEntry({
      source: 'Expense',
      referenceNo: expenseId,
      debitAccount: 'Expense',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `${category} - ${description}`,
      module: 'Expenses',
      metadata: { expenseId, ...(date ? { postingDate: date.slice(0, 10) } : {}) },
    });
  };

  const recordPurchase = async (params: PurchaseParams): Promise<boolean> => {
    const { purchaseId, supplierName, supplierId, amount, purchaseType, paidAmount, paymentMethod, description } = params;

    // Full payment
    if (paidAmount && paidAmount >= amount) {
      return await createEntry({
        source: 'Purchase',
        referenceNo: purchaseId,
        debitAccount: paymentMethod as AccountType,
        creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
        amount: amount,
        description: `Purchase from ${supplierName} - Full Payment`,
        module: 'Purchases',
        metadata: { supplierId, supplierName, purchaseId }
      });
    }
    
    // Partial or credit purchase
    if (paidAmount && paidAmount > 0) {
      // Record payment
      await createEntry({
        source: 'Purchase',
        referenceNo: purchaseId,
        debitAccount: paymentMethod as AccountType,
        creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
        amount: paidAmount,
        description: `Purchase from ${supplierName} - Partial Payment`,
        module: 'Purchases',
        metadata: { supplierId, supplierName, purchaseId }
      });

      // Record payable
      return await createEntry({
        source: 'Purchase',
        referenceNo: purchaseId,
        debitAccount: 'Accounts Payable',
        creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
        amount: amount - paidAmount,
        description: `Purchase from ${supplierName} - Credit`,
        module: 'Purchases',
        metadata: { supplierId, supplierName, purchaseId }
      });
    }

    // Full credit
    return await createEntry({
      source: 'Purchase',
      referenceNo: purchaseId,
      debitAccount: 'Accounts Payable',
      creditAccount: purchaseType === 'Inventory' ? 'Inventory' : 'Purchase Expense',
      amount: amount,
      description: `Purchase from ${supplierName} - Credit`,
      module: 'Purchases',
      metadata: { supplierId, supplierName, purchaseId }
    });
  };

  /** Issue 12: Purchase return — Dr party AP (reduce payable), Cr Inventory. `source` lowercases to `purchase_return` on JE. */
  const recordPurchaseReturn = async (params: PurchaseReturnParams): Promise<boolean> => {
    const { returnId, returnNo, supplierName, supplierId, amount, creditAccount = 'Inventory' } = params;
    if (!amount || amount <= 0) return true;
    let debitAccountId: string | undefined;
    if (companyId && supplierId) {
      try {
        const { resolvePayablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
        debitAccountId = (await resolvePayablePostingAccountId(companyId, supplierId)) || undefined;
      } catch {
        debitAccountId = undefined;
      }
    }
    let creditAccountId: string | undefined;
    if (companyId && (creditAccount === 'Inventory' || !creditAccount)) {
      try {
        const { accountHelperService } = await import('@/app/services/accountHelperService');
        const inv = await accountHelperService.getAccountByCode('1200', companyId);
        creditAccountId = inv?.id;
      } catch {
        creditAccountId = undefined;
      }
    }
    return await createEntry({
      source: 'Purchase_Return',
      referenceNo: returnNo,
      debitAccount: 'Accounts Payable',
      creditAccount,
      amount,
      description: `Purchase Return ${returnNo} - ${supplierName}`,
      module: 'Purchases',
      metadata: {
        supplierId,
        supplierName,
        purchaseReturnId: returnId,
        ...(debitAccountId ? { debitAccountId } : {}),
        ...(creditAccountId ? { creditAccountId } : {}),
      },
    });
  };

  /** Dr Sales Revenue, Cr party AR (adjust) or Cr liquidity — same party subledger pattern as recordPurchaseReturn. */
  const recordSaleReturn = async (params: SaleReturnParams): Promise<boolean> => {
    const {
      saleReturnId,
      returnNo,
      customerName,
      customerId,
      amount,
      originalSaleId,
      refundMethod,
      refundAccountId,
      revenueDebitAccountId,
      description,
      postingDate,
    } = params;
    if (!amount || amount <= 0) return true;

    let debitAccountId: string | undefined = revenueDebitAccountId || undefined;
    if (!debitAccountId && companyId) {
      try {
        const { accountHelperService } = await import('@/app/services/accountHelperService');
        debitAccountId = (await accountHelperService.getAccountByCode('4000', companyId))?.id || undefined;
      } catch {
        debitAccountId = undefined;
      }
    }

    let creditAccount: AccountType = 'Accounts Receivable';
    if (refundMethod === 'cash') creditAccount = 'Cash';
    else if (refundMethod === 'bank') creditAccount = 'Bank';

    let creditAccountId: string | undefined;
    if (refundMethod === 'adjust' && companyId && customerId) {
      try {
        const { resolveReceivablePostingAccountId } = await import('@/app/services/partySubledgerAccountService');
        creditAccountId = (await resolveReceivablePostingAccountId(companyId, customerId)) || undefined;
      } catch {
        creditAccountId = undefined;
      }
    } else if ((refundMethod === 'cash' || refundMethod === 'bank') && refundAccountId) {
      creditAccountId = refundAccountId;
    }

    return await createEntry({
      source: 'Sale_Return',
      referenceNo: returnNo,
      debitAccount: 'Sales Revenue',
      creditAccount,
      amount,
      description,
      module: 'sales',
      metadata: {
        customerId: customerId || undefined,
        customerName,
        saleReturnId,
        ...(originalSaleId ? { saleId: originalSaleId } : {}),
        ...(debitAccountId ? { debitAccountId } : {}),
        ...(creditAccountId ? { creditAccountId } : {}),
        ...(postingDate ? { postingDate } : {}),
      },
    });
  };

  const recordSupplierPayment = async (params: SupplierPaymentParams): Promise<boolean> => {
    const { purchaseId, supplierName, supplierId, amount, paymentMethod, referenceNo } = params;

    // STEP 2 FIX: Use 'purchase' as reference_type to match payment record
    return await createEntry({
      source: 'Purchase', // Changed from 'Payment' to 'Purchase' to match payment record reference_type
      referenceNo: referenceNo,
      debitAccount: 'Accounts Payable',
      creditAccount: paymentMethod as AccountType,
      amount: amount,
      description: `Payment to supplier ${supplierName}`,
      module: 'Purchases',
      metadata: { supplierId, supplierName, purchaseId }
    });
  };

  /**
   * On-account customer payment JE — idempotent. Prefer saleService.recordOnAccountPayment (posts payment + JE).
   * Kept for callers that already inserted payments and only need the journal.
   */
  const recordOnAccountCustomerPayment = async (params: OnAccountCustomerPaymentParams): Promise<boolean> => {
    const { customerName, accountId, paymentId } = params;
    if (!accountId) {
      toast.error('Payment account is required for on-account payment.');
      return false;
    }
    if (!paymentId) {
      toast.error('Payment record is missing — save the payment first, then post to the ledger.');
      return false;
    }
    const { ensureOnAccountCustomerJournalIfMissing } = await import('@/app/services/saleAccountingService');
    const jeId = await ensureOnAccountCustomerJournalIfMissing(paymentId, customerName || 'customer');
    if (!jeId) {
      toast.error('Could not create or verify on-account journal entry.');
      return false;
    }
    return true;
  };

  // ============================================
  // 🎯 CONTEXT VALUE
  // ============================================

  // Refresh both accounts and entries
  const refreshEntries = useCallback(async () => {
    await Promise.all([loadAccounts(), loadEntries()]);
  }, [loadAccounts, loadEntries]);

  /** Safe manual correction: create a reversal JE for the given journal entry (PF-07). */
  const createReversalEntry = useCallback(async (originalJournalEntryId: string, reason?: string): Promise<boolean> => {
    if (!companyId) {
      toast.error('Company not set');
      return false;
    }
    const validBranchId = (branchId && branchId !== 'all') ? branchId : null;
    const { data: { user } } = await supabase.auth.getUser();
    const createdBy = (user as any)?.id ?? null;
    try {
      const result = await accountingService.createReversalEntry(
        companyId,
        validBranchId,
        originalJournalEntryId,
        createdBy,
        reason
      );
      if (result) {
        await refreshEntries();
        if (!result.alreadyExisted) {
          toast.success('Reversal entry created');
        }
        return true;
      }
      toast.error('Could not create reversal (entry not found or wrong company)');
      return false;
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (isPaymentChainHistoricalErrorMessage(msg)) {
        toast.error(stripPaymentChainHistoricalPrefix(msg));
        return false;
      }
      console.error('[ACCOUNTING] createReversalEntry failed:', e);
      toast.error(e?.message || 'Failed to create reversal');
      return false;
    }
  }, [companyId, branchId, refreshEntries]);

  const undoLastPaymentMutation = useCallback(async (paymentId: string): Promise<boolean> => {
    if (!companyId) {
      toast.error('Company not set');
      return false;
    }
    try {
      const { undoLastPaymentMutation: undoFn } = await import('@/app/services/paymentLifecycleService');
      const result = await undoFn({ companyId, paymentId });
      if (result) {
        await refreshEntries();
        toast.success(`Undo ${result.mutationType}: restored previous state`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('paymentAdded'));
          window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: {} }));
        }
        return true;
      }
      toast.error('No undoable mutation found for this payment');
      return false;
    } catch (e: any) {
      console.error('[ACCOUNTING] undoLastPaymentMutation failed:', e);
      toast.error(e?.message || 'Failed to undo last mutation');
      return false;
    }
  }, [companyId, refreshEntries]);

  const getAccountsByType = useCallback((type: PaymentMethod) => accounts.filter(account => account.type === type), [accounts]);
  const getAccountById = useCallback((id: string) => accounts.find(account => account.id === id), [accounts]);

  const value = useMemo<AccountingContextType>(() => ({
    entries,
    balances,
    loading,
    createEntry,
    createReversalEntry,
    undoLastPaymentMutation,
    refreshEntries,
    getEntriesByReference,
    getEntriesBySource,
    getAccountBalance,
    getEntriesBySupplier,
    getEntriesByCustomer,
    getEntriesByWorker,
    getSupplierBalance,
    getCustomerBalance,
    getWorkerBalance,
    recordSale,
    recordSalePayment,
    recordRentalBooking,
    recordRentalDelivery,
    recordRentalCreditDelivery,
    recordRentalReturn,
    recordStudioSale,
    recordWorkerJobCompletion,
    recordWorkerPayment,
    recordExpense,
    recordPurchase,
    recordPurchaseReturn,
    recordSaleReturn,
    recordSupplierPayment,
    recordOnAccountCustomerPayment,
    accounts,
    getAccountsByType,
    getAccountById,
  }), [
    entries, balances, loading, accounts,
    createEntry, createReversalEntry, undoLastPaymentMutation, refreshEntries, getEntriesByReference, getEntriesBySource,
    getAccountBalance, getEntriesBySupplier, getEntriesByCustomer, getEntriesByWorker,
    getSupplierBalance, getCustomerBalance, getWorkerBalance,
    recordSale, recordSalePayment, recordRentalBooking, recordRentalDelivery,
    recordRentalCreditDelivery, recordRentalReturn, recordStudioSale,
    recordWorkerJobCompletion, recordWorkerPayment, recordExpense, recordPurchase,
    recordPurchaseReturn, recordSaleReturn, recordSupplierPayment, recordOnAccountCustomerPayment, getAccountsByType, getAccountById,
  ]);

  return (
    <AccountingContext.Provider value={value}>
      {children}
    </AccountingContext.Provider>
  );
};

// ============================================
// 🎯 HOOK
// ============================================

export const useAccounting = () => {
  const context = useContext(AccountingContext);
  if (!context) {
    throw new Error('useAccounting must be used within AccountingProvider');
  }
  return context;
};

/** Optional accounting context (returns undefined when outside provider). Use when consumer may render before provider or during HMR. */
export const useAccountingOptional = (): AccountingContextType | undefined => {
  return useContext(AccountingContext);
};