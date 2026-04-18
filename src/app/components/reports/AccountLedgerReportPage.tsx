import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, FileSpreadsheet, Filter, RotateCcw, Eye, Pencil } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { accountService } from '@/app/services/accountService';
import { exportToPDF, exportToExcel, ExportData } from '@/app/utils/exportUtils';
import { supabase } from '@/lib/supabase';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import { contactService } from '@/app/services/contactService';
import { studioService } from '@/app/services/studioService';
import { StatementScopeBanner } from '@/app/components/reports/StatementScopeBanner';
import {
  accountingStatementExportSlug,
  accountingStatementModeLabel,
  type AccountingStatementMode,
} from '@/app/lib/accounting/statementEngineTypes';
import { nearestPartyControlAncestorId } from '@/app/lib/partyControlAccounts';
import { CONTACT_BALANCES_REFRESH_EVENT } from '@/app/lib/contactBalancesRefresh';
import {
  journalEntryPresentationFromHeader,
  presentationLabel,
  type JournalLinePresentationKind,
} from '@/app/lib/journalLinePresentation';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { cn } from '@/app/components/ui/utils';
import {
  deriveFromToForLedgerLine,
  netEconomicMeaning,
  editTargetTypeLabel,
} from '@/app/lib/accountFlowPresentation';

/** AR / AP running balance sign: highlight “inverted” party positions so refunds / prepaids are obvious. */
const PARTY_BAL_EPS = 0.005;

type PartyBalanceAttention = 'none' | 'customer_ar_credit' | 'supplier_ap_credit';

function partyBalanceAttention(mode: AccountingStatementMode, balance: number): PartyBalanceAttention {
  const b = Number(balance);
  if (!Number.isFinite(b)) return 'none';
  if (mode === 'customer' && b < -PARTY_BAL_EPS) return 'customer_ar_credit';
  if (mode === 'supplier' && b < -PARTY_BAL_EPS) return 'supplier_ap_credit';
  return 'none';
}

function partyBalanceAttentionTitle(kind: PartyBalanceAttention): string | undefined {
  if (kind === 'customer_ar_credit') {
    return 'Credit (negative) receivable: you may owe the customer — refund due, advance, or unapplied credit. Review receipts and AR.';
  }
  if (kind === 'supplier_ap_credit') {
    return 'Negative payables: prepaid supplier, supplier credit, or net recoverable — review whether collection or offset applies.';
  }
  return undefined;
}

function formatLiquidityAccountLabel(a: { name?: string | null; code?: string | null }): string {
  const name = String(a.name || '').trim();
  const code = String(a.code || '').trim();
  if (!name) return '';
  return code ? `${name} (${code})` : name;
}

type SettlementColumnOpts = {
  /** Selected statement account (GL / cash_bank / account_contact). */
  viewedAccountId?: string;
  /** payments.id → payments.payment_account_id */
  paymentLiquidityAccountIdByPaymentId?: Record<string, string>;
};

/**
 * Supplier/AP: liquidity from payment; cash/bank book: if this row IS the payment liquidity book, show **offset** (AP/party),
 * not a duplicate of CASH G140 / Mobile Wallet.
 */
function settlementAccountForRow(
  e: AccountLedgerEntry,
  settlementByPaymentId: Record<string, string>,
  opts?: SettlementColumnOpts
): { primary: string; glLineNote?: string } {
  const line = String(e.account_name || '').trim();
  const counter = String(e.counter_account || '').trim();
  const pid = e.payment_id;
  const liqId = pid && opts?.paymentLiquidityAccountIdByPaymentId?.[pid];
  const viewed = opts?.viewedAccountId;

  if (pid && viewed && liqId && liqId === viewed) {
    const s = settlementByPaymentId[pid];
    if (counter) {
      return {
        primary: counter,
        glLineNote: s ? `This book: ${s}` : line ? `GL line: ${line}` : undefined,
      };
    }
    if (s) return { primary: s, glLineNote: line && line !== s ? line : undefined };
    return { primary: line || '—' };
  }

  if (pid) {
    const s = settlementByPaymentId[pid];
    if (s) {
      return line && line !== s ? { primary: s, glLineNote: line } : { primary: s };
    }
  }
  if (counter) return { primary: counter };
  return { primary: line || '—' };
}

function settlementAccountExportString(
  e: AccountLedgerEntry,
  settlementByPaymentId: Record<string, string>,
  opts?: SettlementColumnOpts
): string {
  const sd = settlementAccountForRow(e, settlementByPaymentId, opts);
  return sd.glLineNote ? `${sd.primary} · ${sd.glLineNote}` : sd.primary;
}

/** PF-14 rows (JE-0039…) vs primary cash JE (JE-0032) — same payment, different entry_no. */
function referenceExportWithCashVoucher(
  e: AccountLedgerEntry,
  primaryCashJeByPaymentId: Record<string, string>
): string {
  const cur = String(e.reference_number || '').trim();
  const cashJe = e.payment_id ? primaryCashJeByPaymentId[e.payment_id] : '';
  if (cashJe && cashJe !== cur) return `${cur} (cash/bank ${cashJe})`;
  return cur;
}

type StatementType = AccountingStatementMode;

type ContactType = 'customer' | 'supplier';
type FiltersState = {
  statementType: StatementType;
  selectedCategory: string;
  selectedAccountId: string;
  selectedContactType: ContactType | 'all';
  selectedContactId: string;
  selectedWorkerId: string;
  sourceModuleFilter: string;
  transactionTypeFilter: string;
  searchTerm: string;
  polarity: 'all' | 'debit' | 'credit';
  includeReversals: boolean;
  includeManualEntries: boolean;
  includeAdjustments: boolean;
};

type PresentedLedgerRow = AccountLedgerEntry & {
  displayDebit: number;
  displayCredit: number;
  displayRunningBalance: number;
  displayStatus: string;
  presentationKind: JournalLinePresentationKind;
};

function presentationForLedgerEntry(e: AccountLedgerEntry): JournalLinePresentationKind {
  if (e.ledger_kind === 'reversal' || normalizeLower(e.document_type).includes('reversal')) return 'reversal';
  return journalEntryPresentationFromHeader(
    e.je_reference_type ?? e.document_type ?? null,
    e.je_action_fingerprint ?? null
  );
}

const ACCOUNT_CATEGORY_ORDER = [
  'Assets',
  'Liabilities',
  'Equity',
  'Revenue',
  'Expenses',
  'Inventory',
  'Cash / Bank / Wallet',
  'Customer / Receivables',
  'Supplier / Payables',
  'Worker / Payroll',
  'Rental',
  'Courier / Shipping',
  'Other',
] as const;

function normalizeLower(x: unknown): string {
  return String(x || '').toLowerCase().trim();
}

function classifyAccountCategory(a: { code?: string; name?: string; type?: string }): (typeof ACCOUNT_CATEGORY_ORDER)[number] {
  const code = String(a.code || '').trim();
  const type = normalizeLower(a.type);
  const name = normalizeLower(a.name);

  if (
    type.includes('cash') ||
    type.includes('bank') ||
    type.includes('wallet') ||
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('wallet')
  ) return 'Cash / Bank / Wallet';

  if (code === '1100' || name.includes('receivable') || name.includes('customer subledger')) return 'Customer / Receivables';
  if (code === '2000' || name.includes('payable') || name.includes('supplier subledger')) return 'Supplier / Payables';
  if (code.startsWith('12') || name.includes('inventory') || type.includes('inventory')) return 'Inventory';
  if (code.startsWith('20') && (name.includes('worker') || name.includes('payroll'))) return 'Worker / Payroll';
  if (name.includes('rental')) return 'Rental';
  if (name.includes('courier') || name.includes('shipping')) return 'Courier / Shipping';
  if (type.includes('asset') || code.startsWith('1')) return 'Assets';
  if (type.includes('liability') || code.startsWith('2')) return 'Liabilities';
  if (type.includes('equity') || code.startsWith('3')) return 'Equity';
  if (type.includes('revenue') || type.includes('income') || code.startsWith('4')) return 'Revenue';
  if (type.includes('expense') || type.includes('cost') || code.startsWith('5') || code.startsWith('6')) return 'Expenses';
  return 'Other';
}

function isAdjustmentRow(e: AccountLedgerEntry): boolean {
  const d = normalizeLower(e.description);
  const t = normalizeLower(e.document_type);
  return d.includes('adjust') || t.includes('adjust');
}

function isReversalRow(e: AccountLedgerEntry): boolean {
  const d = normalizeLower(e.description);
  const t = normalizeLower(e.document_type);
  return e.ledger_kind === 'reversal' || d.includes('reversal') || t.includes('reversal');
}

function isManualRow(e: AccountLedgerEntry): boolean {
  const d = normalizeLower(e.description);
  return d.includes('manual') || normalizeLower(e.source_module) === 'accounting';
}

/** Same row set as summary cards — opening rows are immune to filters so balances stay aligned. */
function isStatementOpeningRow(e: AccountLedgerEntry): boolean {
  const d = normalizeLower(e.description);
  const t = normalizeLower(e.document_type || '');
  return d.includes('opening balance') || t.includes('opening balance');
}

function isPaymentLikeRow(e: AccountLedgerEntry): boolean {
  const d = normalizeLower(e.description);
  const t = normalizeLower(e.document_type);
  return d.includes('payment') || t.includes('payment') || Boolean(e.payment_id);
}

function extractDocumentRefToken(e: AccountLedgerEntry): string {
  const fromDesc = String(e.description || '').match(/\b(PUR|SAL|INV|RNT|REN|PO|SO)-\d+\b/i)?.[0];
  if (fromDesc) return fromDesc.toUpperCase();
  const fromRef = String(e.reference_number || '').match(/\b(PUR|SAL|INV|RNT|REN|PO|SO)-\d+\b/i)?.[0];
  if (fromRef) return fromRef.toUpperCase();
  return '';
}

function adjustmentSubtypeLabel(e: AccountLedgerEntry): string {
  const d = normalizeLower(e.description);
  if (d.includes('cargo')) return 'Cargo Expense';
  if (d.includes('loading')) return 'Loading Expense';
  if (d.includes('stitch')) return 'Stitching Expense';
  if (d.includes('discount')) return 'Discount';
  if (d.includes('rate')) return 'Rate Correction';
  if (d.includes('quantity') || d.includes('qty')) return 'Quantity Adjustment';
  if (d.includes('value')) return 'Value Adjustment';
  if (d.includes('round')) return 'Rounding Adjustment';
  if (d.includes('expense')) return 'Extra Expense';
  return 'Adjustment';
}

function compactEffectiveDescription(base: string, parts: string[]): string {
  const compact = [...new Set(parts)].join(' + ');
  if (!compact) return `${base} — final adjusted value`;
  return `${base} (includes ${compact})`;
}

function effectiveGroupKey(e: AccountLedgerEntry): string {
  const token = extractDocumentRefToken(e);
  if (token) return `${normalizeLower(e.source_module)}::doc:${token}`;
  const ref = String(e.reference_number || '').trim();
  if (ref && !isPaymentLikeRow(e)) return `${normalizeLower(e.source_module)}::ref:${ref}`;
  return '';
}

function sortDayMs(e: AccountLedgerEntry): number {
  const d = (e.date || '').toString().slice(0, 10);
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
}

function sortTimeMs(e: AccountLedgerEntry): number {
  if (e.created_at) {
    const t = Date.parse(e.created_at);
    if (!Number.isNaN(t)) return t;
  }
  return sortDayMs(e);
}

function movementOf(e: AccountLedgerEntry): number {
  return Number(e.debit || 0) - Number(e.credit || 0);
}

function normalizePaymentTargetText(description: string): string {
  const d = normalizeLower(description);
  return d
    .replace(/^reversal of:\s*/i, '')
    .replace(/^reversal\s*-\s*/i, '')
    .replace(/^reversal\s*/i, '')
    .trim();
}

/**
 * Recompute the balance column from row 0 so rollups and filters still chain correctly.
 * Supplier AP (getSupplierApGlJournalLedger): liability running_balance += credit − debit.
 * Customer AR / cash GL: asset-style += debit − credit.
 */
function alignRunningBalances(rows: PresentedLedgerRow[], apLiabilityStyle: boolean): PresentedLedgerRow[] {
  if (!rows.length) return rows;
  const out: PresentedLedgerRow[] = [];
  let prevBal = Number(rows[0].displayRunningBalance ?? rows[0].running_balance ?? 0);
  out.push({ ...rows[0], displayRunningBalance: prevBal });
  for (let idx = 1; idx < rows.length; idx++) {
    const row = rows[idx];
    const d = Number(row.displayDebit || 0);
    const c = Number(row.displayCredit || 0);
    prevBal = apLiabilityStyle ? prevBal + c - d : prevBal + d - c;
    out.push({ ...row, displayRunningBalance: prevBal });
  }
  return out;
}

export const AccountLedgerReportPage: React.FC<{
  startDate: string;
  endDate: string;
  branchId?: string | null;
  /** Human-readable branch line for the scope banner (e.g. “All branches” or a name). */
  branchScopeLabel?: string;
}> = ({ startDate, endDate, branchId, branchScopeLabel }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [accounts, setAccounts] = useState<
    { id: string; name: string; code?: string; type?: string; linked_contact_id?: string | null; parent_id?: string | null }[]
  >([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; contact_type?: string }[]>([]);
  const [statementType, setStatementType] = useState<StatementType>('gl');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedContactType, setSelectedContactType] = useState<ContactType | 'all'>('all');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [workers, setWorkers] = useState<{ id: string; name: string; is_active?: boolean }[]>([]);
  const [sourceModuleFilter, setSourceModuleFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [polarity, setPolarity] = useState<'all' | 'debit' | 'credit'>('all');
  const [includeReversals, setIncludeReversals] = useState(true);
  const [includeManualEntries, setIncludeManualEntries] = useState(true);
  const [includeAdjustments, setIncludeAdjustments] = useState(true);
  const [applied, setApplied] = useState<FiltersState>({
    statementType: 'gl',
    selectedCategory: 'all',
    selectedAccountId: '',
    selectedContactType: 'all',
    selectedContactId: '',
    selectedWorkerId: '',
    sourceModuleFilter: 'all',
    transactionTypeFilter: 'all',
    searchTerm: '',
    polarity: 'all',
    includeReversals: true,
    includeManualEntries: true,
    includeAdjustments: true,
  });
  const [entries, setEntries] = useState<AccountLedgerEntry[]>([]);
  const [partyByKey, setPartyByKey] = useState<Record<string, { name: string; contactId: string }>>({});
  /** payment_id → label from payments.payment_account_id (cash / bank / wallet). */
  const [paymentSettlementById, setPaymentSettlementById] = useState<Record<string, string>>({});
  /** payments.payment_account_id UUID per payment — detect “viewing this liquidity book” vs offset. */
  const [paymentLiquidityAccountIdByPaymentId, setPaymentLiquidityAccountIdByPaymentId] = useState<Record<string, string>>(
    {}
  );
  /** payment_id → oldest non–payment_adjustment JE entry_no (e.g. JE-0032 / Cash G140 voucher). */
  const [primaryCashVoucherByPaymentId, setPrimaryCashVoucherByPaymentId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [journalRefreshTick, setJournalRefreshTick] = useState(0);

  useEffect(() => {
    const bump = () => setJournalRefreshTick((n) => n + 1);
    window.addEventListener('accountingEntriesChanged', bump);
    window.addEventListener('paymentAdded', bump);
    window.addEventListener('ledgerUpdated', bump);
    window.addEventListener(CONTACT_BALANCES_REFRESH_EVENT, bump);
    return () => {
      window.removeEventListener('accountingEntriesChanged', bump);
      window.removeEventListener('paymentAdded', bump);
      window.removeEventListener('ledgerUpdated', bump);
      window.removeEventListener(CONTACT_BALANCES_REFRESH_EVENT, bump);
    };
  }, []);

  const isPartyStatement = applied.statementType === 'supplier' || applied.statementType === 'customer';
  const viewMode: 'effective' | 'audit' = (!applied.includeAdjustments && !applied.includeReversals) ? 'effective' : 'audit';
  /** When false, PF-14 transfer / amount-delta rows are visually de-emphasized (same idea as Day Book). */
  const [statementPresentationAudit, setStatementPresentationAudit] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoadingAccounts(true);
    accountService
      .getAllAccounts(companyId, branchId)
      .then((list: any[]) => {
        const active = (list || []).filter((a) => a.is_active !== false);
        setAccounts(
          active.map((a: any) => ({
            id: a.id,
            name: a.name,
            code: a.code,
            type: a.type,
            linked_contact_id: a.linked_contact_id ?? null,
            parent_id: a.parent_id ?? null,
          }))
        );
        if (active.length > 0 && !selectedAccountId) {
          setSelectedAccountId(active[0].id);
          setApplied((prev) => ({ ...prev, selectedAccountId: active[0].id }));
        }
      })
      .finally(() => setLoadingAccounts(false));
  }, [companyId, branchId, journalRefreshTick]);

  useEffect(() => {
    if (!companyId) return;
    contactService
      .getAllContacts(companyId)
      .then((rows) => {
        const normalized = (rows || [])
          .filter((c: any) => c?.name && c?.id)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            // Contacts schema uses `type` as canonical column.
            contact_type: c.contact_type || c.type || '',
          }));
        setContacts(normalized);
      })
      .catch(() => setContacts([]));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setWorkers([]);
      return;
    }
    studioService
      .getAllWorkers(companyId)
      .then((list) => {
        setWorkers(
          (list || []).map((w) => ({
            id: w.id,
            name: w.name || w.id,
            is_active: w.is_active,
          }))
        );
      })
      .catch(() => setWorkers([]));
  }, [companyId]);

  useEffect(() => {
    if (statementType !== 'worker') {
      setSelectedWorkerId('');
    }
  }, [statementType]);

  useEffect(() => {
    if (statementType !== 'worker' || !workers.length) return;
    if (selectedWorkerId) return;
    const first = workers.find((w) => w.is_active !== false)?.id || workers[0].id;
    if (first) setSelectedWorkerId(first);
  }, [statementType, workers, selectedWorkerId]);

  useEffect(() => {
    if (!companyId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        let loaded: AccountLedgerEntry[] = [];
        if (applied.statementType === 'customer') {
          if (!applied.selectedContactId) {
            setEntries([]);
            return;
          }
          loaded = await accountingService.getCustomerLedger(
            applied.selectedContactId,
            companyId,
            branchId,
            startDate,
            endDate
          );
        } else if (applied.statementType === 'supplier') {
          if (!applied.selectedContactId) {
            setEntries([]);
            return;
          }
          loaded = await accountingService.getSupplierApGlJournalLedger(
            applied.selectedContactId,
            companyId,
            branchId || undefined,
            startDate,
            endDate
          );
        } else if (applied.statementType === 'worker') {
          if (!applied.selectedWorkerId) {
            setEntries([]);
            return;
          }
          loaded = await accountingService.getWorkerPartyGlJournalLedger(
            applied.selectedWorkerId,
            companyId,
            branchId || undefined,
            startDate,
            endDate
          );
        } else {
          if (!applied.selectedAccountId) {
            setEntries([]);
            return;
          }
          const accRow = accounts.find((x) => x.id === applied.selectedAccountId);
          let lc = accRow?.linked_contact_id ? String(accRow.linked_contact_id).trim() : '';
          const accountsByIdMap = new Map(accounts.map((a) => [a.id, a]));
          const ancestorId = accRow ? nearestPartyControlAncestorId(accRow, accountsByIdMap as any) : null;
          const ctrl = ancestorId ? accountsByIdMap.get(ancestorId) : undefined;
          const ctrlCode = String(ctrl?.code || '').trim();

          if (!lc && accRow?.name && companyId) {
            if (ctrlCode === '2000') {
              const resolved = await contactService.resolveSupplierContactIdFromSubledgerAccountName(
                companyId,
                accRow.name
              );
              if (resolved) lc = resolved;
            } else if (ctrlCode === '1100') {
              const resolved = await contactService.resolveCustomerContactIdFromSubledgerAccountName(
                companyId,
                accRow.name
              );
              if (resolved) lc = resolved;
            }
          }

          if (lc && ctrl && (ctrlCode === '1100' || ctrlCode === '2000' || ctrlCode === '2010' || ctrlCode === '1180')) {
            if (ctrlCode === '2000') {
              loaded = await accountingService.getSupplierApGlJournalLedger(
                lc,
                companyId,
                branchId || undefined,
                startDate,
                endDate
              );
            } else if (ctrlCode === '1100') {
              loaded = await accountingService.getCustomerArGlJournalLedger(
                lc,
                companyId,
                branchId || undefined,
                startDate,
                endDate
              );
            } else {
              loaded = await accountingService.getWorkerPartyGlJournalLedger(
                lc,
                companyId,
                branchId || undefined,
                startDate,
                endDate
              );
            }
          } else {
            loaded = await accountingService.getAccountLedger(
              applied.selectedAccountId,
              companyId,
              startDate,
              endDate,
              branchId || undefined
            );
          }
        }
        setEntries(loaded || []);
        console.log('[STATEMENT_FILTER_TRACE] fetch', {
          statementType: applied.statementType,
          contactType: applied.selectedContactType,
          selectedContactId: applied.selectedContactId,
          selectedWorkerId: applied.selectedWorkerId,
          selectedAccountId: applied.selectedAccountId,
          sourceModuleFilter: applied.sourceModuleFilter,
          transactionTypeFilter: applied.transactionTypeFilter,
          polarity: applied.polarity,
          includeReversals: applied.includeReversals,
          includeManualEntries: applied.includeManualEntries,
          includeAdjustments: applied.includeAdjustments,
          rowsReturned: (loaded || []).length,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, applied, startDate, endDate, branchId, accounts, journalRefreshTick]);

  useEffect(() => {
    const paymentIds = [...new Set(entries.map((e) => e.payment_id).filter(Boolean))] as string[];
    if (!paymentIds.length) {
      setPartyByKey({});
      setPaymentSettlementById({});
      setPaymentLiquidityAccountIdByPaymentId({});
      setPrimaryCashVoucherByPaymentId({});
      return;
    }
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from('payments')
        .select('id, contact_id, payment_account_id, contact:contacts(name)')
        .in('id', paymentIds);
      const map: Record<string, { name: string; contactId: string }> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = {
          name: p.contact?.name || '',
          contactId: String(p.contact_id || ''),
        };
      });
      setPartyByKey(map);

      const accIds = [...new Set((data || []).map((p: any) => p.payment_account_id).filter(Boolean))] as string[];
      const settlement: Record<string, string> = {};
      if (accIds.length) {
        const { data: accs } = await supabase
          .from('accounts')
          .select('id, name, code')
          .in('id', accIds)
          .eq('company_id', companyId);
        const accById = new Map<string, { name: string; code: string }>();
        (accs || []).forEach((a: any) =>
          accById.set(a.id, { name: String(a.name || ''), code: String(a.code || '') })
        );
        (data || []).forEach((p: any) => {
          if (!p.payment_account_id) return;
          const a = accById.get(p.payment_account_id);
          const label = a ? formatLiquidityAccountLabel(a) : '';
          if (label) settlement[p.id] = label;
        });
      }
      const liqIds: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        if (p.payment_account_id) liqIds[p.id] = String(p.payment_account_id);
      });
      setPaymentLiquidityAccountIdByPaymentId(liqIds);
      setPaymentSettlementById(settlement);
    })();
  }, [entries, companyId]);

  const settlementColumnOpts = useMemo((): SettlementColumnOpts => {
    const st = applied.statementType;
    const showViewed =
      (st === 'gl' || st === 'cash_bank' || st === 'account_contact') && applied.selectedAccountId
        ? applied.selectedAccountId
        : undefined;
    return {
      viewedAccountId: showViewed,
      paymentLiquidityAccountIdByPaymentId,
    };
  }, [applied.statementType, applied.selectedAccountId, paymentLiquidityAccountIdByPaymentId]);

  useEffect(() => {
    const paymentIds = [...new Set(entries.map((e) => e.payment_id).filter(Boolean))] as string[];
    if (!paymentIds.length || !companyId) {
      setPrimaryCashVoucherByPaymentId({});
      return;
    }
    (async () => {
      const best = new Map<string, { no: string; t: number }>();
      const chunk = 120;
      for (let i = 0; i < paymentIds.length; i += chunk) {
        const slice = paymentIds.slice(i, i + chunk);
        const { data } = await supabase
          .from('journal_entries')
          .select('payment_id, entry_no, created_at')
          .eq('company_id', companyId)
          .in('payment_id', slice)
          .or('is_void.is.null,is_void.eq.false')
          .neq('reference_type', 'payment_adjustment');
        for (const row of data || []) {
          const pid = String((row as { payment_id?: string }).payment_id || '');
          const eno = String((row as { entry_no?: string }).entry_no || '').trim();
          if (!pid || !eno) continue;
          const t = new Date((row as { created_at?: string }).created_at || 0).getTime();
          const prev = best.get(pid);
          if (!prev || t < prev.t) best.set(pid, { no: eno, t });
        }
      }
      const map: Record<string, string> = {};
      for (const [pid, v] of best) map[pid] = v.no;
      setPrimaryCashVoucherByPaymentId(map);
    })();
  }, [entries, companyId]);

  /** Default statement order: calendar date, then time-of-day (created_at), then stable id. */
  const sortedEntries = useMemo(() => {
    const base = [...entries].filter((e) => {
      // Always keep synthetic opening rows so summary cards match the running-balance column (filters could drop them before).
      if (isStatementOpeningRow(e)) return true;

      if (applied.sourceModuleFilter !== 'all' && normalizeLower(e.source_module) !== applied.sourceModuleFilter) return false;
      if (applied.transactionTypeFilter !== 'all' && normalizeLower(e.document_type) !== applied.transactionTypeFilter) return false;
      if (applied.polarity === 'debit' && Number(e.debit || 0) <= 0) return false;
      if (applied.polarity === 'credit' && Number(e.credit || 0) <= 0) return false;
      if (applied.searchTerm.trim()) {
        const q = applied.searchTerm.toLowerCase();
        const party = e.payment_id ? (partyByKey[e.payment_id]?.name || '') : '';
        const settle =
          e.payment_id && paymentSettlementById[e.payment_id] ? paymentSettlementById[e.payment_id] : '';
        const cashV = e.payment_id ? primaryCashVoucherByPaymentId[e.payment_id] || '' : '';
        const hay = `${e.reference_number || ''} ${e.description || ''} ${e.source_module || ''} ${party} ${settle} ${cashV} ${e.counter_account || ''} ${e.account_name || ''}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Customer / supplier / worker statements are already scoped by getCustomerLedger / getSupplierApGlJournalLedger /
      // getWorkerPartyGlJournalLedger — do not second-filter by payments.contact_id (purchase-linked payments can omit or
      // mismatch contact_id while still belonging to the party via purchase graph).
      if (applied.statementType === 'account_contact' && applied.selectedContactId) {
        if (e.payment_id) {
          const linked = partyByKey[e.payment_id]?.contactId || '';
          if (linked && linked !== applied.selectedContactId) return false;
        }
      }
      return true;
    });

    return base.sort((a, b) => {
      const da = sortDayMs(a);
      const db = sortDayMs(b);
      if (da !== db) return da - db;
      const ta = sortTimeMs(a);
      const tb = sortTimeMs(b);
      if (ta !== tb) return ta - tb;
      const ra = String(a.reference_number || '');
      const rb = String(b.reference_number || '');
      if (ra !== rb) return ra.localeCompare(rb);
      return (a.journal_entry_id || '').localeCompare(b.journal_entry_id || '');
    });
  }, [
    entries,
    applied,
    contacts,
    partyByKey,
    paymentSettlementById,
    primaryCashVoucherByPaymentId,
  ]);

  const accountById = useMemo(() => {
    const m = new Map<string, { id: string; name: string; code?: string; type?: string }>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

  const groupedAccounts = useMemo(() => {
    const filtered = accounts.filter((a) => {
      const cat = classifyAccountCategory(a);
      if (selectedCategory !== 'all' && cat !== selectedCategory) return false;
      if (statementType === 'cash_bank') return cat === 'Cash / Bank / Wallet';
      return true;
    });
    const out: Record<string, { id: string; name: string; code?: string; type?: string }[]> = {};
    ACCOUNT_CATEGORY_ORDER.forEach((k) => { out[k] = []; });
    filtered.forEach((a) => {
      const cat = classifyAccountCategory(a);
      if (!out[cat]) out[cat] = [];
      out[cat].push(a);
    });
    Object.keys(out).forEach((k) => out[k].sort((a, b) => `${a.code || ''}${a.name}`.localeCompare(`${b.code || ''}${b.name}`)));
    return out;
  }, [accounts, selectedCategory, statementType]);

  const visibleContacts = useMemo(() => {
    if (statementType === 'customer') return contacts.filter((c) => normalizeLower(c.contact_type).includes('customer') || normalizeLower(c.contact_type).includes('both'));
    if (statementType === 'supplier') return contacts.filter((c) => normalizeLower(c.contact_type).includes('supplier') || normalizeLower(c.contact_type).includes('both'));
    if (selectedContactType === 'all') return contacts;
    return contacts.filter((c) => normalizeLower(c.contact_type).includes(selectedContactType) || normalizeLower(c.contact_type).includes('both'));
  }, [contacts, statementType, selectedContactType]);

  useEffect(() => {
    if (statementType === 'customer') {
      setSelectedContactType('customer');
      setSelectedAccountId('');
      setSelectedContactId('');
      // Party statements default to effective view (subledger-friendly).
      setIncludeAdjustments(false);
      setIncludeReversals(false);
      setApplied((prev) => ({ ...prev, includeAdjustments: false, includeReversals: false }));
      return;
    }
    if (statementType === 'supplier') {
      setSelectedContactType('supplier');
      setSelectedAccountId('');
      setSelectedContactId('');
      // Party statements default to effective view (subledger-friendly).
      setIncludeAdjustments(false);
      setIncludeReversals(false);
      setApplied((prev) => ({ ...prev, includeAdjustments: false, includeReversals: false }));
      return;
    }
    if (statementType === 'worker') {
      setSelectedAccountId('');
      setSelectedContactId('');
      setIncludeAdjustments(false);
      setIncludeReversals(false);
      setApplied((prev) => ({ ...prev, includeAdjustments: false, includeReversals: false }));
      return;
    }
    if (statementType === 'cash_bank') {
      const firstCash = accounts.find((a) => classifyAccountCategory(a) === 'Cash / Bank / Wallet');
      if (firstCash?.id) setSelectedAccountId(firstCash.id);
    }
  }, [statementType, accounts]);

  // Primary selector auto-fetch: statement/account/contact fields update applied state immediately.
  useEffect(() => {
    setApplied((prev) => ({
      ...prev,
      statementType,
      selectedAccountId,
      selectedContactType,
      selectedContactId,
      selectedWorkerId,
    }));
  }, [statementType, selectedAccountId, selectedContactType, selectedContactId, selectedWorkerId]);

  const selectedAccount = accountById.get(applied.selectedAccountId || selectedAccountId);
  // Use applied party (contact or worker), never draft-only UI selection for row display labels.
  const selectedPartyName =
    applied.statementType === 'worker'
      ? workers.find((w) => w.id === applied.selectedWorkerId)?.name || ''
      : contacts.find((c) => c.id === applied.selectedContactId)?.name || '';

  const branchScopeResolved =
    branchScopeLabel ||
    (!branchId || branchId === 'all'
      ? 'All branches (global COA rows included; journal lines use service branch rules)'
      : 'Branch filter applied (current session branch)');

  const openStatementTransaction = (referenceNumber: string, autoLaunchUnifiedEdit: boolean) => {
    if (typeof window === 'undefined' || !referenceNumber) return;
    window.dispatchEvent(
      new CustomEvent('openTransactionDetail', {
        detail: { referenceNumber, autoLaunchUnifiedEdit },
      })
    );
  };

  const presentedEntries = useMemo<PresentedLedgerRow[]>(() => {
    const base = sortedEntries.filter((e) => {
      if (!applied.includeManualEntries && isManualRow(e)) return false;
      return true;
    });
    if (!base.length) return [];

    const reversalRows = base.filter((e) => isReversalRow(e));
    const reversalTextTargets = reversalRows
      .map((e) => normalizePaymentTargetText(String(e.description || '')))
      .filter(Boolean);
    const reversalPaymentIds = new Set(reversalRows.map((e) => String(e.payment_id || '')).filter(Boolean));
    const hasReversalTwin = (row: AccountLedgerEntry) => {
      if (!isPaymentLikeRow(row) || isReversalRow(row)) return false;
      if (row.payment_id && reversalPaymentIds.has(String(row.payment_id))) return true;
      const rowText = normalizeLower(row.description || '');
      if (reversalTextTargets.some((t) => t && rowText.includes(t))) return true;
      const rowMove = movementOf(row);
      return reversalRows.some((rev) => {
        const revMove = movementOf(rev);
        return Math.abs(rowMove + revMove) < 0.0001 && sortDayMs(row) <= sortDayMs(rev);
      });
    };

    if (viewMode === 'audit') {
      const auditRows = base
        .filter((e) => (applied.includeAdjustments ? true : !isAdjustmentRow(e)))
        .filter((e) => (applied.includeReversals ? true : !isReversalRow(e)))
        .map((e) => {
          const adjustmentLabel = isAdjustmentRow(e) ? adjustmentSubtypeLabel(e) : '';
          return {
            ...e,
            description: adjustmentLabel ? `${adjustmentLabel}: ${e.description}` : e.description,
            displayDebit: Number(e.debit || 0),
            displayCredit: Number(e.credit || 0),
            displayRunningBalance: Number(e.running_balance || 0),
            displayStatus: hasReversalTwin(e)
              ? 'Reversed'
              : (e.document_type || e.ledger_kind || (isReversalRow(e) ? 'Reversal' : '—')),
            presentationKind: presentationForLedgerEntry(e),
          };
        });
      return alignRunningBalances(auditRows, applied.statementType === 'supplier');
    }

    // Effective GL-like mode: hide adjustment/reversal detail, keep line-level movements.
    if (!isPartyStatement) {
      let prevBalance: number | null = null;
      const effectiveGlRows = base
        .filter((e) => !isAdjustmentRow(e) && !isReversalRow(e) && !hasReversalTwin(e))
        .map((e) => {
          const curBal = Number(e.running_balance || 0);
          let delta = 0;
          if (prevBalance == null) {
            delta = Number(e.debit || 0) - Number(e.credit || 0);
          } else {
            delta = curBal - prevBalance;
          }
          prevBalance = curBal;
          return {
            ...e,
            displayDebit: delta > 0 ? delta : 0,
            displayCredit: delta < 0 ? Math.abs(delta) : 0,
            displayRunningBalance: Number(e.running_balance || 0),
            displayStatus: e.document_type || '—',
            presentationKind: presentationForLedgerEntry(e),
          };
        });
      return alignRunningBalances(effectiveGlRows, false);
    }

    // Effective party mode: supplier/customer statements collapse business documents.
    const rowsWithIndex = base.map((row, index) => ({ row, index }));
    const rollupGroups = new Map<string, { indices: number[]; rows: AccountLedgerEntry[] }>();

    rowsWithIndex.forEach(({ row, index }) => {
      const key = effectiveGroupKey(row);
      if (!key) return;
      if (isPaymentLikeRow(row)) return;
      const g = rollupGroups.get(key) || { indices: [], rows: [] };
      g.indices.push(index);
      g.rows.push(row);
      rollupGroups.set(key, g);
    });

    const hiddenByMode = (e: AccountLedgerEntry): boolean => isAdjustmentRow(e) || isReversalRow(e);

    const rowAtIndex = new Map<number, PresentedLedgerRow>();
    const consumedIndices = new Set<number>();

    rollupGroups.forEach((g) => {
      if (g.rows.length <= 1) return;
      const sorted = [...g.rows].sort((a, b) => {
        const ta = new Date(a.created_at || a.date).getTime();
        const tb = new Date(b.created_at || b.date).getTime();
        if (ta !== tb) return ta - tb;
        return (a.journal_entry_id || '').localeCompare(b.journal_entry_id || '');
      });
      const representative = sorted[sorted.length - 1];
      const repIdx = g.indices[g.indices.length - 1];
      const net = g.rows.reduce((s, r) => s + (Number(r.debit || 0) - Number(r.credit || 0)), 0);
      const totalDebit = net > 0 ? net : 0;
      const totalCredit = net < 0 ? Math.abs(net) : 0;
      const partLabels = g.rows
        .filter((r) => isAdjustmentRow(r) || isReversalRow(r))
        .map((r) => {
          if (isReversalRow(r)) return 'Reversal';
          return adjustmentSubtypeLabel(r);
        });
      const baseLine = sorted.find((r) => !isAdjustmentRow(r) && !isReversalRow(r)) || representative;
      rowAtIndex.set(repIdx, {
        ...representative,
        date: representative.date || baseLine.date,
        created_at: representative.created_at || baseLine.created_at,
        description: compactEffectiveDescription(baseLine.description, partLabels),
        displayDebit: totalDebit,
        displayCredit: totalCredit,
        displayRunningBalance: Number(representative.running_balance || 0),
        displayStatus: representative.document_type || '—',
        presentationKind: presentationForLedgerEntry(representative),
      });
      g.indices.forEach((idx) => consumedIndices.add(idx));
    });

    const out: PresentedLedgerRow[] = [];
    rowsWithIndex.forEach(({ row, index }) => {
      if (rowAtIndex.has(index)) {
        out.push(rowAtIndex.get(index)!);
        return;
      }
      if (consumedIndices.has(index)) return;
      if (hiddenByMode(row)) return;
      if (hasReversalTwin(row)) return;
      out.push({
        ...row,
        displayDebit: Number(row.debit || 0),
        displayCredit: Number(row.credit || 0),
        displayRunningBalance: Number(row.running_balance || 0),
        displayStatus: row.document_type || row.ledger_kind || '—',
        presentationKind: presentationForLedgerEntry(row),
      });
    });
    return alignRunningBalances(out, applied.statementType === 'supplier');
  }, [
    sortedEntries,
    applied.includeManualEntries,
    applied.includeAdjustments,
    applied.includeReversals,
    applied.statementType,
    viewMode,
    isPartyStatement,
  ]);

  const summary = useMemo(() => {
    const apLiabilityStyle = applied.statementType === 'supplier';
    if (!presentedEntries.length) {
      return { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0, netMovement: 0, txCount: 0 };
    }

    const openingIdx = presentedEntries.findIndex(isStatementOpeningRow);
    const rowsNoOpening = presentedEntries.filter((e) => !isStatementOpeningRow(e));

    // Supplier/AP liability: running balance uses credit − debit on each row (see getSupplierApGlJournalLedger).
    // Summary cards use the SAME presented row set as the table after alignRunningBalances — no second formula for closing.
    const openingBalance =
      openingIdx >= 0
        ? Number(presentedEntries[openingIdx].displayRunningBalance ?? presentedEntries[openingIdx].running_balance ?? 0)
        : Number(presentedEntries[0].displayRunningBalance ?? presentedEntries[0].running_balance ?? 0) -
          (apLiabilityStyle
            ? Number(presentedEntries[0].displayCredit || 0) - Number(presentedEntries[0].displayDebit || 0)
            : Number(presentedEntries[0].displayDebit || 0) - Number(presentedEntries[0].displayCredit || 0));

    const totalDebit = rowsNoOpening.reduce((s, e) => s + Number(e.displayDebit || 0), 0);
    const totalCredit = rowsNoOpening.reduce((s, e) => s + Number(e.displayCredit || 0), 0);

    const last = presentedEntries[presentedEntries.length - 1];
    const closingBalance = Number(last.displayRunningBalance ?? last.running_balance ?? 0);
    const netMovement = closingBalance - openingBalance;

    return { openingBalance, totalDebit, totalCredit, closingBalance, netMovement, txCount: rowsNoOpening.length };
  }, [presentedEntries, applied.statementType]);

  const openingBalanceAttention = partyBalanceAttention(applied.statementType, summary.openingBalance);
  const closingBalanceAttention = partyBalanceAttention(applied.statementType, summary.closingBalance);

  const sourceModules = useMemo(
    () => ['all', ...Array.from(new Set(entries.map((e) => normalizeLower(e.source_module)).filter(Boolean)))],
    [entries]
  );
  const transactionTypes = useMemo(
    () => ['all', ...Array.from(new Set(entries.map((e) => normalizeLower(e.document_type)).filter(Boolean)))],
    [entries]
  );

  const toExport = (): ExportData => {
    const slug = accountingStatementExportSlug(applied.statementType);
    return {
      title: `${slug} | ${startDate} to ${endDate} | ${branchScopeResolved}`,
      headers: [
        'Date',
        'Reference',
        'Branch',
        'Module',
        'Presentation',
        'Contact',
        'Description',
        'Counter account (GL)',
        'From account',
        'To account',
        'Economic meaning',
        'Economic event id',
        'JE link type (human + raw code)',
        'Settlement / payment account',
        'Debit',
        'Credit',
        'Balance',
        'Document type',
      ],
      rows: presentedEntries.map((e) => {
        const flow = deriveFromToForLedgerLine(e);
        return [
          e.date,
          referenceExportWithCashVoucher(e, primaryCashVoucherByPaymentId),
          e.branch_name || e.branch_id || '',
          e.source_module || '',
          presentationLabel(e.presentationKind),
          e.payment_id ? (partyByKey[e.payment_id]?.name || '') : '',
          e.description,
          e.counter_account || '',
          flow.from,
          flow.to,
          netEconomicMeaning(e, e.presentationKind),
          e.economic_event_id ? String(e.economic_event_id) : '',
          (() => {
            const raw = String(e.je_reference_type || '').trim();
            const human = editTargetTypeLabel(e.je_reference_type);
            if (!raw) return human;
            if (raw === human || human === '—') return raw;
            return `${human} (${raw})`;
          })(),
          settlementAccountExportString(e, paymentSettlementById, settlementColumnOpts),
          e.displayDebit,
          e.displayCredit,
          e.displayRunningBalance,
          e.displayStatus,
        ];
      }),
    };
  };
  const handleExportPDF = () => exportToPDF(toExport(), accountingStatementExportSlug(applied.statementType));
  const handleExportExcel = () => exportToExcel(toExport(), accountingStatementExportSlug(applied.statementType));

  const resetFilters = () => {
    setSelectedCategory('all');
    setSourceModuleFilter('all');
    setTransactionTypeFilter('all');
    setSearchTerm('');
    setPolarity('all');
    setIncludeReversals(true);
    setIncludeManualEntries(true);
    setIncludeAdjustments(true);
    setSelectedContactId('');
    setSelectedWorkerId('');
    setApplied((prev) => ({
      ...prev,
      selectedCategory: 'all',
      sourceModuleFilter: 'all',
      transactionTypeFilter: 'all',
      searchTerm: '',
      polarity: 'all',
      includeReversals: true,
      includeManualEntries: true,
      includeAdjustments: true,
      selectedContactId: '',
      selectedWorkerId: '',
    }));
  };

  const prevAppliedRef = React.useRef(applied);
  useEffect(() => {
    prevAppliedRef.current = applied;
  }, [applied]);

  const applyFilters = () => {
    console.log('[STATEMENT_FILTER_TRACE] apply_click', {
      statementType,
      contactType: selectedContactType,
      selectedContactId,
      selectedWorkerId,
      selectedAccountId,
      selectedCategory,
      sourceModuleFilter,
      transactionTypeFilter,
      polarity,
      includeReversals,
      includeManualEntries,
      includeAdjustments,
    });
    setApplied({
      // Primary selectors are auto-applied; Apply controls only secondary/advanced filters.
      statementType: prevAppliedRef.current.statementType,
      selectedCategory: selectedCategory,
      selectedAccountId: prevAppliedRef.current.selectedAccountId,
      selectedContactType: prevAppliedRef.current.selectedContactType,
      selectedContactId: prevAppliedRef.current.selectedContactId,
      selectedWorkerId: prevAppliedRef.current.selectedWorkerId,
      sourceModuleFilter,
      transactionTypeFilter,
      searchTerm,
      polarity,
      includeReversals,
      includeManualEntries,
      includeAdjustments,
    });
  };

  useEffect(() => {
    const distinctPartyContactIds = Array.from(
      new Set(
        sortedEntries
          .map((e) => (e.payment_id ? (partyByKey[e.payment_id]?.contactId || '') : ''))
          .filter(Boolean)
      )
    );
    console.log('[STATEMENT_FILTER_TRACE] render', {
      appliedStatementType: applied.statementType,
      appliedContactType: applied.selectedContactType,
      appliedContactId: applied.selectedContactId,
      appliedWorkerId: applied.selectedWorkerId,
      sortedRows: sortedEntries.length,
      presentedRows: presentedEntries.length,
      distinctPartyContactIds,
      usedSelectedContactFallbackInRows: false,
      viewMode,
    });
  }, [applied, sortedEntries, presentedEntries, partyByKey, contacts, viewMode]);

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-gray-400">Statement Type</label>
            <select
              value={statementType}
              onChange={(e) => setStatementType(e.target.value as StatementType)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
            >
              <option value="gl">General Ledger Statement</option>
              <option value="customer">Customer Statement</option>
              <option value="supplier">Supplier Statement</option>
              <option value="cash_bank">Cash / Bank Statement</option>
              <option value="account_contact">Account + Contact Statement</option>
              <option value="worker">Worker Statement (WP / WA GL)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
            >
              <option value="all">All categories</option>
              {ACCOUNT_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {(statementType === 'gl' || statementType === 'cash_bank' || statementType === 'account_contact') && (
            <div className="lg:col-span-2">
              <label className="text-xs text-gray-400">Account (grouped)</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
              >
                <option value="">Select account</option>
                {ACCOUNT_CATEGORY_ORDER.map((cat) => {
                  const list = groupedAccounts[cat] || [];
                  if (!list.length) return null;
                  return (
                    <optgroup key={cat} label={cat}>
                      {list.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ? `${a.code} - ` : ''}{a.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          )}
          {(statementType === 'customer' || statementType === 'supplier' || statementType === 'account_contact') && (
            <>
              <div>
                <label className="text-xs text-gray-400">Contact Type</label>
                <select
                  value={selectedContactType}
                  onChange={(e) => setSelectedContactType(e.target.value as ContactType | 'all')}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
                  disabled={statementType === 'customer' || statementType === 'supplier'}
                >
                  <option value="all">All</option>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Contact</label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
                >
                  <option value="">Select contact</option>
                  {visibleContacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {statementType === 'worker' && (
            <div className="lg:col-span-2">
              <label className="text-xs text-gray-400">Worker</label>
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white"
              >
                <option value="">Select worker</option>
                {workers
                  .filter((w) => w.id)
                  .map((w) => (
                  <option key={w.id} value={w.id!}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400">Source module</label>
            <select value={sourceModuleFilter} onChange={(e) => setSourceModuleFilter(e.target.value)} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white">
              {sourceModules.map((m) => <option key={m} value={m}>{m === 'all' ? 'All' : m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Transaction type</label>
            <select value={transactionTypeFilter} onChange={(e) => setTransactionTypeFilter(e.target.value)} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white">
              {transactionTypes.map((m) => <option key={m} value={m}>{m === 'all' ? 'All' : m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Polarity</label>
            <select value={polarity} onChange={(e) => setPolarity(e.target.value as any)} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white">
              <option value="all">All</option>
              <option value="debit">Only debit</option>
              <option value="credit">Only credit</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Search</label>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Reference / description / party" className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-white" />
          </div>
          <label className="text-xs text-gray-300 flex items-center gap-2"><input type="checkbox" checked={includeReversals} onChange={(e) => setIncludeReversals(e.target.checked)} /> Include reversals</label>
          <label className="text-xs text-gray-300 flex items-center gap-2"><input type="checkbox" checked={includeManualEntries} onChange={(e) => setIncludeManualEntries(e.target.checked)} /> Include manual</label>
          <label className="text-xs text-gray-300 flex items-center gap-2"><input type="checkbox" checked={includeAdjustments} onChange={(e) => setIncludeAdjustments(e.target.checked)} /> Include adjustments</label>
        </div>

        <div className="flex flex-wrap items-center gap-3 py-1 border-t border-gray-800/80 pt-3">
          <div className="flex items-center gap-2">
            <Switch
              id="statement-pres-audit"
              checked={statementPresentationAudit}
              onCheckedChange={setStatementPresentationAudit}
            />
            <Label htmlFor="statement-pres-audit" className="text-xs text-gray-300 cursor-pointer">
              Row presentation: audit (full weight)
            </Label>
          </div>
          {!statementPresentationAudit && (
            <p className="text-xs text-amber-200/85 max-w-2xl">
              Effective: PF-14 <strong className="text-gray-200">transfer</strong> /{' '}
              <strong className="text-gray-200">amount delta</strong> rows are dimmed — same economic receipt, not duplicate
              business events. Turn audit on to emphasize every voucher equally.
            </p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1"><RotateCcw size={14} /> Reset</Button>
          <Button variant="outline" size="sm" onClick={applyFilters} className="gap-1"><Filter size={14} /> Apply</Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1"><FileText size={14} /> PDF</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1"><FileSpreadsheet size={14} /> Excel</Button>
        </div>
      </div>

      <StatementScopeBanner
        statementLabel={accountingStatementModeLabel(applied.statementType)}
        periodLabel={`${startDate} → ${endDate}`}
        branchScopeLabel={branchScopeResolved}
        basisLabel={
          applied.statementType === 'supplier'
            ? 'Supplier statement: GL on Accounts Payable (code 2000 and linked AP accounts) for this supplier — purchases, payments, openings, reversals per accountingService; summary uses the same rows as the table.'
            : viewMode === 'effective'
              ? 'Effective — rollup rules hide some reversals/adjustments; balance follows posted GL.'
              : 'Audit — shows reversals/adjustments when the include checkboxes allow.'
        }
      />

      <p className="text-sm text-gray-400">
        {selectedAccount && `${selectedAccount.code || ''} ${selectedAccount.name}`.trim()}
        {selectedPartyName
          ? applied.statementType === 'worker'
            ? ` · Worker: ${selectedPartyName}`
            : ` · Party: ${selectedPartyName}`
          : ''}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <p className="text-xs text-gray-400">Opening Balance</p>
          <p
            className={cn(
              'text-lg font-semibold',
              openingBalanceAttention !== 'none' ? 'text-rose-300' : 'text-white'
            )}
            title={partyBalanceAttentionTitle(openingBalanceAttention)}
          >
            {formatCurrency(summary.openingBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"><p className="text-xs text-gray-400">Total Debit</p><p className="text-lg font-semibold text-emerald-400">{formatCurrency(summary.totalDebit)}</p></div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"><p className="text-xs text-gray-400">Total Credit</p><p className="text-lg font-semibold text-rose-400">{formatCurrency(summary.totalCredit)}</p></div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <p className="text-xs text-gray-400">Closing Balance</p>
          <p
            className={cn(
              'text-lg font-semibold',
              closingBalanceAttention !== 'none' ? 'text-rose-300' : 'text-white'
            )}
            title={partyBalanceAttentionTitle(closingBalanceAttention)}
          >
            {formatCurrency(summary.closingBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3"><p className="text-xs text-gray-400">Transaction Count</p><p className="text-lg font-semibold text-white">{summary.txCount}</p></div>
      </div>

      <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900/50">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800 bg-gray-800/50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-300">Date</th>
                <th className="p-3 text-left font-medium text-gray-300">Reference</th>
                <th className="p-3 text-left font-medium text-gray-300">Branch</th>
                <th className="p-3 text-left font-medium text-gray-300 max-w-[7rem]" title="Which product area posted this line (sales, purchases, accounting, …).">
                  Module
                </th>
                <th className="p-3 text-left font-medium text-gray-300 w-36">Presentation</th>
                <th className="p-3 text-left font-medium text-gray-300">Contact / Party</th>
                <th className="p-3 text-left font-medium text-gray-300 min-w-[20rem] w-[24rem] max-w-[32rem]">
                  Description
                </th>
                <th className="p-3 text-left font-medium text-gray-300 max-w-[9rem]">Counter (GL)</th>
                <th className="p-3 text-left font-medium text-gray-300 max-w-[10rem]">From → To</th>
                <th className="p-3 text-left font-medium text-gray-300 max-w-[10rem]">Economic meaning</th>
                <th className="p-3 text-left font-medium text-gray-300">Economic event</th>
                <th
                  className="p-3 text-left font-medium text-gray-300 max-w-[9rem]"
                  title="What business record this journal line is tied to (same information as the former “Source type” + “Edit target” columns, shown once)."
                >
                  JE link type
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-300 max-w-[14rem]"
                  title="Cash, bank, or wallet from the linked payment record; if none, the offsetting GL account."
                >
                  Settlement / payment account
                </th>
                <th className="p-3 text-right font-medium text-gray-300">Debit</th>
                <th className="p-3 text-right font-medium text-gray-300">Credit</th>
                <th
                  className="p-3 text-right font-medium text-gray-300"
                  title={
                    applied.statementType === 'customer'
                      ? 'Positive: customer owes you (normal AR). Red row: negative balance — credit in customer’s favour (you may owe them).'
                      : applied.statementType === 'supplier'
                        ? 'Positive: you owe supplier (normal AP). Red row: negative — prepaid or net credit from supplier (recoverable / review).'
                        : undefined
                  }
                >
                  Balance
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-300 max-w-[10rem]"
                  title="Journal document_type / row state (e.g. Reversed in audit mode). Not the same as Module or JE link type."
                >
                  Document type
                </th>
                <th className="p-3 text-right font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {presentedEntries.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-6 text-center text-gray-500">
                    No transactions in this period.
                  </td>
                </tr>
              ) : (
                presentedEntries.map((e, i) => {
                  const rowBalAtt = partyBalanceAttention(applied.statementType, e.displayRunningBalance);
                  return (
                  <tr
                    key={`${e.journal_entry_id}-${i}`}
                    className={cn(
                      'hover:bg-gray-800/30',
                      !statementPresentationAudit &&
                        (e.presentationKind === 'liquidity_transfer' || e.presentationKind === 'amount_delta') &&
                        'opacity-60'
                    )}
                  >
                    <td className="p-3 text-gray-300">{e.created_at ? <DateTimeDisplay date={e.created_at} /> : e.date}</td>
                    <td className="p-3 font-mono text-gray-300 align-top">
                      <div className="flex flex-col gap-0.5 items-start max-w-[14rem]">
                        {e.journal_entry_id ? (
                          <button
                            type="button"
                            className="text-left text-sky-400 hover:text-sky-300 hover:underline"
                            onClick={() =>
                              openStatementTransaction(String(e.entry_no || '').trim() || e.journal_entry_id, false)
                            }
                          >
                            {e.reference_number}
                          </button>
                        ) : (
                          e.reference_number
                        )}
                        {(() => {
                          const cashJe = e.payment_id ? primaryCashVoucherByPaymentId[e.payment_id] : '';
                          const cur = String(e.entry_no || e.reference_number || '').trim();
                          if (!cashJe || !cur || cashJe === cur) return null;
                          return (
                            <span
                              className="text-[11px] text-sky-300/90 font-sans leading-snug"
                              title="Primary payment journal (bank/cash side). PF-14 adjustment lines show a different voucher for the same payment."
                            >
                              Cash/bank voucher: {cashJe}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="p-3 text-gray-400 text-xs">{e.branch_name || e.branch_id || '—'}</td>
                    <td className="p-3 text-gray-300 max-w-[7rem] break-words" title={e.source_module || undefined}>
                      {e.source_module || '—'}
                    </td>
                    <td className="p-3 text-[11px]">
                      <span
                        className={cn(
                          'inline-block rounded px-2 py-0.5 border text-gray-300',
                          e.presentationKind === 'liquidity_transfer' && 'border-sky-600/50 text-sky-300/95',
                          e.presentationKind === 'amount_delta' && 'border-amber-600/50 text-amber-200/90',
                          e.presentationKind === 'business_primary' && 'border-emerald-700/50 text-emerald-200/90',
                          e.presentationKind === 'reversal' && 'border-rose-700/50 text-rose-200/90',
                          !['liquidity_transfer', 'amount_delta', 'business_primary', 'reversal'].includes(e.presentationKind) &&
                            'border-gray-700 text-gray-400'
                        )}
                      >
                        {presentationLabel(e.presentationKind)}
                      </span>
                    </td>
                    <td className="p-3 text-white">{e.payment_id ? (partyByKey[e.payment_id]?.name || '—') : '—'}</td>
                    <td className="p-3 text-white min-w-[20rem] w-[24rem] max-w-[32rem] whitespace-normal break-words align-top leading-snug">
                      {e.description}
                    </td>
                    <td className="p-3 text-xs text-gray-400 max-w-[9rem] leading-snug">{e.counter_account || '—'}</td>
                    <td className="p-3 text-xs text-gray-300 max-w-[10rem] leading-snug">
                      {(() => {
                        const flow = deriveFromToForLedgerLine(e);
                        return (
                          <>
                            <span className="text-gray-500">From </span>
                            {flow.from}
                            <span className="text-gray-600 mx-1">→</span>
                            {flow.to}
                          </>
                        );
                      })()}
                    </td>
                    <td className="p-3 text-[11px] text-gray-400 max-w-[10rem] leading-snug">
                      {netEconomicMeaning(e, e.presentationKind)}
                    </td>
                    <td className="p-3 text-[10px] font-mono text-gray-500" title={e.economic_event_id ? String(e.economic_event_id) : ''}>
                      {e.economic_event_id ? `${String(e.economic_event_id).slice(0, 8)}…` : '—'}
                    </td>
                    <td
                      className="p-3 text-[11px] text-gray-300 max-w-[9rem] align-top leading-snug"
                      title={
                        e.je_reference_type
                          ? `Raw journal reference type: ${e.je_reference_type}`
                          : 'No journal reference type on this line'
                      }
                    >
                      <span className="text-gray-200">{editTargetTypeLabel(e.je_reference_type)}</span>
                      {e.je_reference_type &&
                      editTargetTypeLabel(e.je_reference_type).replace(/\s/g, '_').toLowerCase() !==
                        e.je_reference_type.toLowerCase() ? (
                        <div className="text-[10px] font-mono text-gray-500 mt-0.5 break-all">{e.je_reference_type}</div>
                      ) : null}
                    </td>
                    <td className="p-3 max-w-[14rem]">
                      {(() => {
                        const sd = settlementAccountForRow(e, paymentSettlementById, settlementColumnOpts);
                        return (
                          <div title={sd.glLineNote ? `GL line: ${sd.glLineNote}` : undefined}>
                            <div className="text-white font-medium leading-snug">{sd.primary}</div>
                            {sd.glLineNote ? (
                              <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">GL line: {sd.glLineNote}</div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3 text-right text-gray-300">{e.displayDebit ? formatCurrency(e.displayDebit) : '—'}</td>
                    <td className="p-3 text-right text-gray-300">{e.displayCredit ? formatCurrency(e.displayCredit) : '—'}</td>
                    <td
                      className={cn(
                        'p-3 text-right tabular-nums',
                        rowBalAtt === 'none'
                          ? 'font-medium text-white'
                          : 'font-semibold text-rose-300 bg-rose-950/35'
                      )}
                      title={partyBalanceAttentionTitle(rowBalAtt)}
                    >
                      {formatCurrency(e.displayRunningBalance)}
                    </td>
                    <td className="p-3 text-gray-400 text-xs">{e.displayStatus}</td>
                    <td className="p-3 text-right">
                      {e.journal_entry_id ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-gray-300 hover:text-white"
                            onClick={() =>
                              openStatementTransaction(String(e.entry_no || '').trim() || e.journal_entry_id, false)
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-sky-400 hover:text-sky-300"
                            onClick={() => openStatementTransaction(e.journal_entry_id, true)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {e.payment_id ? 'Edit payment' : 'Edit'}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <h4 className="text-sm font-semibold text-white mb-2">Grand Totals</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><p className="text-gray-400">Period Debit Total</p><p className="text-emerald-400 font-semibold">{formatCurrency(summary.totalDebit)}</p></div>
          <div><p className="text-gray-400">Period Credit Total</p><p className="text-rose-400 font-semibold">{formatCurrency(summary.totalCredit)}</p></div>
          <div><p className="text-gray-400">Net Movement</p><p className="text-white font-semibold">{formatCurrency(summary.netMovement)}</p></div>
          <div>
            <p className="text-gray-400">Closing Balance</p>
            <p
              className={cn(
                'font-semibold',
                closingBalanceAttention !== 'none' ? 'text-rose-300' : 'text-white'
              )}
              title={partyBalanceAttentionTitle(closingBalanceAttention)}
            >
              {formatCurrency(summary.closingBalance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
