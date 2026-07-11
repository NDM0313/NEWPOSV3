import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { 
  Receipt, 
  Wallet,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Download,
  Filter,
  Plus,
  DollarSign,
  CreditCard,
  Shield,
  Wrench,
  FileText,
  BarChart3,
  Edit,
  XCircle,
  Star,
  List,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronRight,
  X,
  BookMarked,
  Truck,
  ArrowLeftRight,
  RotateCcw,
  Scale,
  ShieldAlert,
  ExternalLink,
  Undo2,
  Search,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { Badge } from '@/app/components/ui/badge';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { cn } from '@/app/components/ui/utils';
import { useAccounting } from '@/app/context/AccountingContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import type { AccountingEntry } from '@/app/context/AccountingContext';
import { journalRowPresentation } from '@/app/lib/accountingJournalRowPresentation';
import { ManualEntryDialog } from './ManualEntryDialog';
import { AccountLedgerView } from './AccountLedgerView';
import { AccountLedgerPage } from './AccountLedgerPage';
import { TransactionDetailModal } from './TransactionDetailModal';
import { TransactionConfirmDialog } from './TransactionConfirmDialog';
import { AttachmentViewer } from '@/app/components/shared/AttachmentViewer';
import {
  collectEntryAttachments,
  collectGroupAttachments,
  entryHasAttachments,
  groupEntryHasAttachments,
  type TransactionAttachment,
} from '@/app/utils/transactionAttachments';
import { AddAccountDrawer } from './AddAccountDrawer';
import { LedgerStatementCenterV2Page } from '@/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page';
import type { LedgerStatementV2Initial } from '@/app/features/ledger-statement-center-v2/types';
import { PayCourierModal } from './PayCourierModal';
import { useSettings } from '@/app/context/SettingsContext';
import { AccountingTestPage } from '@/app/components/test/AccountingTestPage';
import { AddEntryV2Host, dispatchOpenAddEntryV2 } from './AddEntryV2Host';
import { useSupabase } from '@/app/context/SupabaseContext';
import { INTEGRITY_LAB_SESSION_KEY } from '@/app/lib/integrityLabConstants';
import { syncArApDiagnosticsHubTabToUrl } from '@/app/lib/arApDiagnosticsHubTabs';
import {
  safeSessionStorageGetItem,
  safeSessionStorageRemoveItem,
  safeSessionStorageSetItem,
} from '@/app/lib/safeBrowserStorage';
import { ControlAccountBreakdownDrawer } from './ControlAccountBreakdownDrawer';
import type { ControlAccountBreakdownResult, PartyGlRow } from '@/app/services/controlAccountBreakdownService';
import { fetchControlAccountBreakdown } from '@/app/services/controlAccountBreakdownService';

/** Add Entry: V2 = new default (typed, theme-matched). Set false to use legacy AccountingTestPage. */
const USE_ADD_ENTRY_V2 = true;
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { formatLocalDateYYYYMMDD, localNowDateString } from '@/app/utils/localDate';
import { accountService } from '@/app/services/accountService';
import { contactService } from '@/app/services/contactService';
import { CONTACT_BALANCES_REFRESH_EVENT } from '@/app/lib/contactBalancesRefresh';
import {
  DATA_INVALIDATED_EVENT,
  type DataInvalidationDetail,
  shouldAcceptInvalidation,
} from '@/app/lib/dataInvalidationBus';
import { toast } from 'sonner';
import { getControlAccountKind } from '@/app/lib/accountControlKind';
import { AccountsHierarchyList } from '@/app/components/accounting/AccountsHierarchyList';
import { ControlLinkedPartiesSheet } from '@/app/components/accounting/ControlLinkedPartiesSheet';
import { useAccountsHierarchyModel } from '@/app/components/accounting/useAccountsHierarchyModel';
import { AccountingDashboardAccountRowMenu } from '@/app/components/accounting/AccountingDashboardAccountRowMenu';
import { ChartOfAccountsPartyDropdown } from '@/app/components/accounting/ChartOfAccountsPartyDropdown';
import { ReportBasisBanner } from '@/app/components/accounting/ReportBasisBanner';
import { accountingReportsService } from '@/app/services/accountingReportsService';
import {
  allowsGenericAccountingUnifiedEdit,
  getJournalEntrySourceDocumentOpenTarget,
  journalReversalBlockedReason,
} from '@/app/lib/journalEntryEditPolicy';
import { isTransactionActionPanelEnabled } from '@/app/lib/transactionActionRules';
import { JournalRowTransactionActions } from '@/app/components/accounting/JournalRowTransactionActions';
import { useJournalTransactionActionHandlers } from '@/app/hooks/useJournalTransactionActionHandlers';

const StudioCostsTab = lazy(() => import('./StudioCostsTab').then((m) => ({ default: m.StudioCostsTab })));
const DepositsTab = lazy(() => import('./DepositsTab').then((m) => ({ default: m.DepositsTab })));
const CourierReportsTab = lazy(() => import('./CourierReportsTab').then((m) => ({ default: m.CourierReportsTab })));
const DayBookReport = lazy(() => import('@/app/components/reports/DayBookReport').then((m) => ({ default: m.DayBookReport })));
const RoznamchaReport = lazy(() => import('@/app/components/reports/RoznamchaReport').then((m) => ({ default: m.RoznamchaReport })));
const CashFlowReportPage = lazy(() => import('@/app/components/reports/CashFlowReportPage').then((m) => ({ default: m.CashFlowReportPage })));
const AccountLedgerReportPage = lazy(() => import('@/app/components/reports/AccountLedgerReportPage').then((m) => ({ default: m.AccountLedgerReportPage })));
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { AdaptiveCurrencyValue } from '@/app/components/shared/AdaptiveCurrencyValue';
import { useCheckPermission } from '@/app/hooks/useCheckPermission';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';

function controlKindDisplayLabel(kind: ControlAccountBreakdownResult['controlKind']): string {
  switch (kind) {
    case 'ar':
      return 'Accounts receivable';
    case 'ap':
      return 'Accounts payable';
    case 'worker_payable':
      return 'Worker payable';
    case 'worker_advance':
      return 'Worker advance';
    case 'suspense':
      return 'Suspense';
    default:
      return 'GL';
  }
}

/** Reference type badge color mapping for journal entries. */
const REF_TYPE_COLORS: Record<string, string> = {
  sale: 'bg-blue-900/50 text-blue-300',
  sale_adjustment: 'bg-blue-900/30 text-blue-400',
  sale_return: 'bg-orange-900/50 text-orange-300',
  sale_reversal: 'bg-red-900/40 text-red-300',
  purchase: 'bg-purple-900/50 text-purple-300',
  purchase_adjustment: 'bg-purple-900/30 text-purple-400',
  purchase_return: 'bg-pink-900/50 text-pink-300',
  purchase_reversal: 'bg-red-900/30 text-red-400',
  payment: 'bg-green-900/50 text-green-300',
  payment_adjustment: 'bg-green-900/30 text-[var(--erp-money-positive)]',
  shipment: 'bg-amber-900/50 text-amber-300',
  stock_adjustment: 'bg-yellow-900/40 text-yellow-300',
  opening_balance_contact_ar: 'bg-cyan-900/40 text-cyan-300',
  opening_balance_contact_ap: 'bg-cyan-900/40 text-cyan-300',
  opening_balance_account: 'bg-cyan-900/40 text-cyan-300',
  opening_balance_inventory: 'bg-cyan-900/40 text-cyan-300',
  opening_balance_contact_worker: 'bg-cyan-900/40 text-cyan-300',
  commission_batch: 'bg-teal-900/50 text-teal-300',
  manual: 'bg-muted text-muted-foreground',
};

function refTypeBadgeLabel(rt: string): string {
  return rt.replace(/_/g, ' ').replace(/opening balance /g, 'OB ');
}

/** Voucher column label: show JE-xx for standalone accounting rows even when list referenceNo is operational. */
function journalVoucherLabel(entry: AccountingEntry): string {
  const meta = entry.metadata as { documentNo?: string; journalEntryNo?: string; referenceType?: string } | undefined;
  const rt = String(meta?.referenceType || '').toLowerCase();
  const standalone =
    entry.module === 'Accounting' ||
    ['manual', 'general', 'transfer', 'pure_journal', 'internal_transfer'].includes(rt);
  if (standalone && meta?.journalEntryNo) return meta.journalEntryNo;
  return meta?.documentNo || entry.referenceNo || 'N/A';
}

function normalizeSearchValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function buildJournalSearchHaystack(entry: AccountingEntry): string {
  const meta = (entry.metadata || {}) as Record<string, unknown>;
  const tokens = [
    entry.id,
    entry.referenceNo,
    entry.description,
    entry.module,
    entry.debitAccount,
    entry.creditAccount,
    entry.createdBy,
    entry.source,
    meta.referenceType,
    meta.rootReferenceType,
    meta.referenceId,
    meta.reference_id,
    meta.paymentId,
    meta.paymentMethod,
    meta.documentNo,
    meta.sourceModule,
  ];
  return tokens
    .map((part) => normalizeSearchValue(part))
    .filter(Boolean)
    .join(' ');
}

/** Sale cancel audit badges for General Entries (original sale JE + sale_reversal pair). */
function saleCancellationJournalBadge(entry: AccountingEntry): React.ReactNode {
  const meta = entry.metadata as {
    referenceType?: string;
    linkedSaleStatus?: string;
    documentNo?: string;
  } | undefined;
  const rt = String(meta?.referenceType || '').toLowerCase();
  const inv = meta?.documentNo;
  if (rt === 'sale_reversal') {
    return (
      <Badge className="ml-2 bg-amber-500/15 text-amber-300 border-amber-500/35 text-[10px] whitespace-nowrap">
        Cancellation reversal{inv ? ` · ${inv}` : ''}
      </Badge>
    );
  }
  if (rt === 'sale' && String(meta?.linkedSaleStatus || '').toLowerCase() === 'cancelled') {
    return (
      <Badge className="ml-2 bg-amber-500/15 text-amber-300 border-amber-500/35 text-[10px] whitespace-nowrap">
        Sale cancelled
      </Badge>
    );
  }
  return null;
}

/** Journal list Account column: leaf names + party from convertFromJournalEntry; grouped = compact union. */
function journalEntryAccountPair(entry: AccountingEntry): { debit: string; credit: string } {
  return {
    debit: entry.debitAccountDisplay ?? entry.debitAccount,
    credit: entry.creditAccountDisplay ?? entry.creditAccount,
  };
}

function journalGroupAccountPair(group: { primary: AccountingEntry; entries: AccountingEntry[] }): {
  debit: string;
  credit: string;
} {
  if (group.entries.length <= 1) return journalEntryAccountPair(group.primary);
  const dr = new Set<string>();
  const cr = new Set<string>();
  for (const e of group.entries) {
    dr.add(e.debitAccountDisplay ?? e.debitAccount);
    cr.add(e.creditAccountDisplay ?? e.creditAccount);
  }
  const compact = (labels: Set<string>) => {
    const a = [...labels].filter(Boolean);
    if (a.length <= 2) return a.join(' · ');
    return `${a.slice(0, 2).join(' · ')} +${a.length - 2} more`;
  };
  return { debit: compact(dr), credit: compact(cr) };
}

/**
 * Stable key so manual_receipt + payment_adjustment for the same payment_id group as one document row.
 */
function journalDocumentGroupKey(entry: AccountingEntry, reversedJournalTargetIds: Set<string>): string {
  const meta = entry.metadata;
  const rt = String(meta?.referenceType || '').toLowerCase();
  const rid = meta?.referenceId ? String(meta.referenceId).trim() : '';
  if (rt === 'correction_reversal' && rid) {
    return `jePair:${rid}`;
  }
  const jeId = String(meta?.journalEntryId || entry.id || '').trim();
  if (jeId && reversedJournalTargetIds.has(jeId)) {
    return `jePair:${jeId}`;
  }
  const pid = meta?.paymentId ? String(meta.paymentId).trim() : '';
  if (pid) {
    return `payment:${pid}`;
  }
  if (rt === 'payment_adjustment' && rid) {
    return `payment:${rid}`;
  }
  const rootT = meta?.rootReferenceType ?? meta?.referenceType;
  const rootI = meta?.rootReferenceId ?? meta?.referenceId;
  if (rootT && rootI) {
    return `${rootT}:${rootI}`;
  }
  return `single:${entry.id}`;
}

/**
 * By-document row amount: sum document principal + value adjustments only.
 * Supplier payment JEs use reference_type=purchase (see supplierPaymentService) but carry payment_id — they must NOT add to purchase total.
 * Same guard for sale+payment_id if ever mis-tagged.
 * jePair:* groups net original + correction_reversal for a single economic row amount.
 */
function groupedDocumentDisplayAmount(group: {
  rootKey: string;
  primary: AccountingEntry;
  entries: AccountingEntry[];
}): number {
  if (group.rootKey.startsWith('jePair:')) {
    return group.entries.reduce((s, e) => {
      const ert = String(e.metadata?.referenceType || '').toLowerCase();
      const a = Number(e.amount) || 0;
      return ert === 'correction_reversal' ? s - a : s + a;
    }, 0);
  }
  const mod = group.primary.module;
  if (mod === 'Payments') {
    return group.entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }
  const refTypes =
    mod === 'Purchases'
      ? new Set(['purchase', 'purchase_adjustment'])
      : mod === 'Sales'
        ? new Set(['sale', 'sale_adjustment'])
        : null;
  if (refTypes) {
    return group.entries
      .filter((e) => {
        const rt = String(e.metadata?.referenceType || '').toLowerCase();
        if (!refTypes.has(rt)) return false;
        const pid = e.metadata?.paymentId;
        if (pid && (rt === 'purchase' || rt === 'sale')) return false;
        return true;
      })
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }
  return Number(group.primary.amount) || 0;
}

// Account type sets used for summary card calculations (module-level constants)
const INCOME_ACCOUNTS = new Set([
  'Sales Income', 'Rental Income', 'Studio Sales Income', 'Rental Damage Income',
  'Sales Revenue', 'Revenue', 'Sales',
]);
const EXPENSE_ACCOUNTS = new Set([
  'Expense', 'Purchase Expense', 'Cost of Production', 'Worker Expense',
]);
const AR_ACCOUNTS = new Set(['Accounts Receivable']);
const AP_ACCOUNTS = new Set(['Accounts Payable', 'Worker Payable']);

const ReportTabSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    <span className="text-sm">{label}</span>
  </div>
);

export const AccountingDashboard = () => {
  const { canAccessAccounting, canPostAccounting } = useCheckPermission();
  const { modules: settingsModules } = useSettings();
  const accounting = useAccounting();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const { openDrawer, setCurrentView, accountStatementV2Initial, setAccountStatementV2Initial, accountingTabInitial, setAccountingTabInitial } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { setCurrentModule, startDate: globalStartDate, endDate: globalEndDate } = useGlobalFilter();
  const {
    busy,
    transactionReference,
    transactionJournalEntryIdHint,
    selectedGroupEntries,
    transactionDetailAutoEdit,
    transactionDetailAutoOpenTrace,
    transactionDetailScrollToAudit,
    clearTransactionDetail,
    setTransactionDetailAutoEdit,
    setTransactionDetailAutoOpenTrace,
    setTransactionDetailScrollToAudit,
    runJournalMutation,
    handleOpenJournalSourceDocument,
    openJournalEntryDetail,
    openJournalEntryDetailFromEntry,
    handleJournalUndoLastChange,
    handleJournalCancelPayment,
    handleJournalCancelEntry,
    handleJournalCancelOrphan,
    pendingConfirm,
    dismissPendingConfirm,
    confirmPendingJournalAction,
  } = useJournalTransactionActionHandlers();
  const { formatCurrency } = useFormatCurrency();

  useEffect(() => {
    void accounting.ensureEntriesLoaded();
  }, [accounting.ensureEntriesLoaded]);

  useEffect(() => {
    setCurrentModule('accounting');
  }, [setCurrentModule]);

  const [activeTab, setActiveTab] = useState<'journal_entries' | 'daybook' | 'roznamcha' | 'cash_flow' | 'accounts' | 'receivables' | 'payables' | 'courier' | 'deposits' | 'studio' | 'account_statements'>('journal_entries');
  /** Align Account Statements period with global header filter when set (same idea as Day Book / Roznamcha). */
  const reportStartDate = useMemo(() => {
    const g = globalStartDate && String(globalStartDate).trim();
    if (g) return g.slice(0, 10);
    const d = new Date();
    d.setDate(1);
    return formatLocalDateYYYYMMDD(d);
  }, [globalStartDate]);
  const reportEndDate = useMemo(() => {
    const g = globalEndDate && String(globalEndDate).trim();
    if (g) return g.slice(0, 10);
    return localNowDateString();
  }, [globalEndDate]);

  /** Account Statements tab: editable period (initialized from global filter; re-syncs when global dates change). */
  const [accountStatementStart, setAccountStatementStart] = useState(() => reportStartDate);
  const [accountStatementEnd, setAccountStatementEnd] = useState(() => reportEndDate);
  /** Set from Accounts row ⋮ → Statement; pre-selects that GL account on Account Statements tab. */
  const [accountStatementPreselectId, setAccountStatementPreselectId] = useState<string | null>(null);

  const accountStatementV2Entity = useMemo((): LedgerStatementV2Initial | null => {
    if (accountStatementV2Initial?.entityId) return accountStatementV2Initial;
    if (accountStatementPreselectId) {
      return { entityId: accountStatementPreselectId, statementType: 'account' };
    }
    return null;
  }, [accountStatementV2Initial, accountStatementPreselectId]);

  useEffect(() => {
    if (accountingTabInitial === 'account_statements') {
      setActiveTab('account_statements');
      setAccountingTabInitial(null);
    }
  }, [accountingTabInitial, setAccountingTabInitial]);
  useEffect(() => {
    setAccountStatementStart(reportStartDate);
    setAccountStatementEnd(reportEndDate);
  }, [reportStartDate, reportEndDate]);

  const accountStatementBranchLabel =
    'All branches (per-row Branch column; header branch filter does not apply)';
  
  // UI-only view mode: Operational (day-to-day accounts) vs Professional (full Chart of Accounts)
  const [accountsViewMode, setAccountsViewMode] = useState<'operational' | 'professional'>('operational');
  const [showSubAccounts, setShowSubAccounts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  
  // Add Entry flow — opened via openAddEntryV2 event (AddEntryV2Host)
  // Legacy manual-entry-only dialog (kept for any direct use)
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  
  // 🎯 Account Management State
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [payCourierOpen, setPayCourierOpen] = useState(false);
  /** Parent row id → collapsed (children hidden). Seeded when Accounts tab opens (all collapsed). */
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  // 🎯 Ledger & Transaction State
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);
  const [controlBreakdown, setControlBreakdown] = useState<{
    account: { id: string; name: string; code?: string };
    kind: ControlAccountBreakdownResult['controlKind'];
  } | null>(null);
  /** Chart of Accounts: inline party list under selected control / linked sub-account row */
  const [coaPartyPanelAccountId, setCoaPartyPanelAccountId] = useState<string | null>(null);
  const [coaPartyFetch, setCoaPartyFetch] = useState<{
    loading: boolean;
    error: string | null;
    rows: PartyGlRow[];
    note?: string;
    controlLabel?: string;
    panelAccountId?: string | null;
    controlGlBalance?: number | null;
    partyAttributedSumFull?: number | null;
    residualAmount?: number | null;
    subtreeTbDrMinusCr?: number | null;
    controlCodeLabel?: string;
    unmappedTop?: { referenceType: string; amount: number }[];
  }>({ loading: false, error: null, rows: [] });
  const useTransactionActionPanel = isTransactionActionPanelEnabled();
  /** PF-14.3B: Default = grouped (one logical row per sale); audit = all raw JEs. */
  const [journalViewMode, setJournalViewMode] = useState<'grouped' | 'audit'>('grouped');
  const [attachmentsDialogList, setAttachmentsDialogList] = useState<TransactionAttachment[] | null>(null);
  
  /** Account Statements: standard = embedded V2 UI; advanced = effective/audit filters (legacy engine). */
  const [accountStatementsViewMode, setAccountStatementsViewMode] = useState<'standard' | 'advanced'>('standard');
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Journal table sort: default by date+time descending (newest first)
  type JournalSortKey = 'date' | 'reference' | 'module' | 'description' | 'type' | 'paymentMethod' | 'amount' | 'source';
  const [journalSortKey, setJournalSortKey] = useState<JournalSortKey>('date');
  const [journalSortDir, setJournalSortDir] = useState<'asc' | 'desc'>('desc');

  // 🎯 Use real entries from AccountingContext
  const transactions = useMemo(() => {
    return accounting.entries;
  }, [accounting.entries]);

  // Calculate summary stats from journal entries (uses module-level account sets above)
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let arDebit = 0;
    let arCredit = 0;
    let apCredit = 0;
    let apDebit = 0;

    transactions.forEach(t => {
      // Income: credit side is a revenue account
      if (INCOME_ACCOUNTS.has(t.creditAccount)) totalIncome += t.amount;

      // Expense: debit side is an expense account
      if (EXPENSE_ACCOUNTS.has(t.debitAccount)) totalExpense += t.amount;

      // Receivable: track both sides (sale adds debit AR, payment adds credit AR)
      if (AR_ACCOUNTS.has(t.debitAccount)) arDebit += t.amount;
      if (AR_ACCOUNTS.has(t.creditAccount)) arCredit += t.amount;

      // Payable: track both sides (purchase adds credit AP, payment reduces AP)
      if (AP_ACCOUNTS.has(t.creditAccount)) apCredit += t.amount;
      if (AP_ACCOUNTS.has(t.debitAccount)) apDebit += t.amount;
    });

    // Net outstanding receivable (what customers owe)
    const totalReceivable = Math.max(0, arDebit - arCredit);
    // Net outstanding payable (what we owe)
    const totalPayable = Math.max(0, apCredit - apDebit);

    return {
      totalIncome,
      totalExpense,
      totalReceivable,
      totalPayable,
      netProfit: totalIncome - totalExpense,
    };
  }, [transactions]);

  /** Official Posted GL — same source as Trial Balance / P&L (void excluded, corrections included). */
  const [canonicalGlSummary, setCanonicalGlSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    totalReceivable: number;
    totalPayable: number;
    netProfit: number;
  } | null>(null);

  useEffect(() => {
    if (!companyId) {
      setCanonicalGlSummary(null);
      return;
    }
    let cancelled = false;
    const end = new Date().toISOString().slice(0, 10);
    const start = `${end.slice(0, 4)}-01-01`;
    const branch = branchId && branchId !== 'all' ? branchId : undefined;
    (async () => {
      try {
        const [pl, snap] = await Promise.all([
          accountingReportsService.getProfitLoss(companyId, start, end, branch),
          accountingReportsService.getArApGlSnapshot(companyId, end, branch),
        ]);
        if (cancelled) return;
        const arNet = snap.ar ? snap.ar.debit - snap.ar.credit : 0;
        const apNet = snap.apNetCredit ?? 0;
        setCanonicalGlSummary({
          totalIncome: pl.revenue.total,
          totalExpense: pl.costOfSales.total + pl.expenses.total,
          totalReceivable: Math.max(0, arNet),
          totalPayable: Math.max(0, apNet),
          netProfit: pl.netProfit,
        });
      } catch {
        if (!cancelled) setCanonicalGlSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, accounting.entries.length]);

  const displaySummary = canonicalGlSummary ?? summary;

  const [partyGlByContactId, setPartyGlByContactId] = useState<
    Awaited<ReturnType<typeof contactService.getContactPartyGlBalancesMap>>
  >(null);
  const [linkedPartiesControlId, setLinkedPartiesControlId] = useState<string | null>(null);
  /** Bumps on accountingEntriesChanged so party GL map refreshes even when entry count is unchanged (e.g. void/repost). */
  const [partyGlEpoch, setPartyGlEpoch] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setPartyGlEpoch((n) => n + 1);
      }, 180);
    };
    const onInvalidated = (ev: Event) => {
      const detail = (ev as CustomEvent<DataInvalidationDetail>).detail;
      if (
        !shouldAcceptInvalidation(detail, {
          domain: ['accounting', 'contacts', 'sales', 'purchases'],
          companyId,
          branchId: branchId === 'all' ? null : branchId ?? null,
        })
      ) {
        return;
      }
      bump();
    };
    window.addEventListener('accountingEntriesChanged', bump);
    window.addEventListener('paymentAdded', bump);
    window.addEventListener('ledgerUpdated', bump);
    window.addEventListener(CONTACT_BALANCES_REFRESH_EVENT, bump);
    window.addEventListener(DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('accountingEntriesChanged', bump);
      window.removeEventListener('paymentAdded', bump);
      window.removeEventListener('ledgerUpdated', bump);
      window.removeEventListener(CONTACT_BALANCES_REFRESH_EVENT, bump);
      window.removeEventListener(DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    };
  }, [branchId, companyId]);

  useEffect(() => {
    let cancelled = false;
    if (!companyId) {
      setPartyGlByContactId(null);
      return;
    }
    contactService
      .getContactPartyGlBalancesMap(companyId, branchId === 'all' ? null : branchId)
      .then((m) => {
        if (!cancelled) setPartyGlByContactId(m);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, partyGlEpoch]);

  const linkedPartiesControl = useMemo(
    () =>
      linkedPartiesControlId
        ? accounting.accounts.find((a) => a.id === linkedPartiesControlId) ?? null
        : null,
    [linkedPartiesControlId, accounting.accounts]
  );

  const { hierarchyRows, parentIdsWithChildren } = useAccountsHierarchyModel(
    accounting.accounts,
    transactions,
    accountsViewMode,
    showSubAccounts,
    collapsedGroupIds,
    setCollapsedGroupIds,
    partyGlByContactId,
    accountsViewMode === 'operational'
  );

  const parentCollapseKey = useMemo(
    () => [...parentIdsWithChildren].sort().join(','),
    [parentIdsWithChildren]
  );

  useEffect(() => {
    if (activeTab !== 'accounts') return;
    setCollapsedGroupIds(new Set(parentIdsWithChildren));
  }, [activeTab, parentCollapseKey, accountsViewMode, showSubAccounts]);

  useEffect(() => {
    if (!coaPartyPanelAccountId || !companyId) {
      setCoaPartyFetch({ loading: false, error: null, rows: [] });
      return;
    }
    const acc = accounting.accounts.find((a) => a.id === coaPartyPanelAccountId);
    if (!acc?.id) return;
    const ck = getControlAccountKind({ name: acc.name, code: (acc as { code?: string }).code });
    if (!ck) {
      setCoaPartyFetch({ loading: false, error: null, rows: [] });
      return;
    }
    const label = controlKindDisplayLabel(ck);
    let cancelled = false;
    setCoaPartyFetch({
      loading: true,
      error: null,
      rows: [],
      note: undefined,
      controlLabel: label,
      panelAccountId: acc.id,
      controlGlBalance: undefined,
      partyAttributedSumFull: undefined,
      residualAmount: undefined,
      subtreeTbDrMinusCr: undefined,
      controlCodeLabel: undefined,
      unmappedTop: undefined,
    });
    fetchControlAccountBreakdown({
      companyId,
      branchId: branchId === 'all' ? null : branchId,
      accountId: acc.id,
      accountCode: String((acc as { code?: string }).code || ''),
      accountName: acc.name || '',
      controlKind: ck,
    })
      .then((r) => {
        if (cancelled) return;
        const partyFallback = r.partyRows.reduce((s, x) => s + x.glAmount, 0);
        const partyFull = r.partyAttributedGlSum ?? partyFallback;
        const code = String((acc as { code?: string }).code || '').trim() || '—';
        const unmappedTop = [...(r.unmappedGlByReference || [])]
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
          .slice(0, 6);
        setCoaPartyFetch({
          loading: false,
          error: null,
          rows: r.partyRows,
          note: r.partySectionNote,
          controlLabel: label,
          panelAccountId: acc.id,
          controlGlBalance: r.glAccountBalance,
          partyAttributedSumFull: partyFull,
          residualAmount: r.unmappedGlResidual,
          subtreeTbDrMinusCr: r.glSubtreeDrMinusCr,
          controlCodeLabel: code,
          unmappedTop: unmappedTop.length ? unmappedTop : undefined,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setCoaPartyFetch({
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load parties',
          rows: [],
          controlLabel: label,
          panelAccountId: acc.id,
          controlGlBalance: undefined,
          partyAttributedSumFull: undefined,
          residualAmount: undefined,
          subtreeTbDrMinusCr: undefined,
          controlCodeLabel: undefined,
          unmappedTop: undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [coaPartyPanelAccountId, companyId, branchId, accounting.accounts, partyGlEpoch]);

  // Tab configuration: Journal Entries | Day Book | Roznamcha | Accounts | Ledger | Receivables | Payables | Studio Costs | Account Statements
  const allTabs = [
    { key: 'journal_entries', label: 'Journal Entries', icon: Receipt },
    { key: 'daybook', label: 'Day Book', icon: List },
    { key: 'roznamcha', label: 'Roznamcha', icon: BookMarked },
    { key: 'cash_flow', label: 'Cash Flow', icon: ArrowLeftRight },
    { key: 'accounts', label: 'Accounts', icon: Wallet },
    { key: 'receivables', label: 'Receivables', icon: TrendingUp },
    { key: 'payables', label: 'Payables', icon: TrendingDown },
    { key: 'courier', label: 'Courier Reports', icon: Truck },
    { key: 'deposits', label: 'Deposits', icon: Shield, isHidden: !settingsModules.rentalModuleEnabled },
    { key: 'studio', label: 'Studio Costs', icon: Wrench, isHidden: !settingsModules.studioModuleEnabled },
    { key: 'account_statements', label: 'Account Statements', icon: BarChart3 },
  ];
  const tabs = allTabs.filter((t) => !('isHidden' in t) || !(t as any).isHidden);

  // Reset activeTab if current tab becomes hidden (e.g. rental/studio disabled)
  useEffect(() => {
    if (activeTab === 'deposits' && !settingsModules.rentalModuleEnabled) setActiveTab('journal_entries');
    if (activeTab === 'studio' && !settingsModules.studioModuleEnabled) setActiveTab('journal_entries');
  }, [activeTab, settingsModules.rentalModuleEnabled, settingsModules.studioModuleEnabled]);

  /** Accounting Integrity Lab: deep-link to tab + optional search focus */
  useEffect(() => {
    try {
      const raw = safeSessionStorageGetItem(INTEGRITY_LAB_SESSION_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as {
        tab?: typeof activeTab | 'ledger';
        focusAccountId?: string;
        searchTerm?: string;
      };
      if (o.tab === 'integrity_lab') {
        safeSessionStorageRemoveItem(INTEGRITY_LAB_SESSION_KEY);
        syncArApDiagnosticsHubTabToUrl('journal-hygiene');
        setCurrentView('ar-ap-reconciliation-center');
        return;
      }
      const tab = o.tab === 'ledger' ? 'account_statements' : o.tab;
      if (tab) setActiveTab(tab);
      if (o.focusAccountId) {
        setAccountStatementPreselectId(o.focusAccountId);
        setAccountStatementsViewMode('standard');
      }
      if (o.searchTerm) setSearchTerm(o.searchTerm);
      safeSessionStorageRemoveItem(INTEGRITY_LAB_SESSION_KEY);
      if (o.searchTerm) {
        toast.info(`Filtered journal search: ${o.searchTerm.slice(0, 8)}…`);
      }
    } catch {
      safeSessionStorageRemoveItem(INTEGRITY_LAB_SESSION_KEY);
    }
  }, [setCurrentView]);

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Type filter — supports both source-based and reference_type-based filtering.
    if (typeFilter !== 'all') {
      filtered = filtered.filter(txn => {
        const ref = ((txn.metadata as any)?.referenceType || '').toLowerCase();
        if (typeFilter === 'sale') return ref === 'sale' || ref === 'sale_adjustment' || txn.source === 'Sale';
        if (typeFilter === 'sale_return') return ref === 'sale_return' || ref === 'sale_reversal';
        if (typeFilter === 'purchase') return ref === 'purchase' || ref === 'purchase_adjustment' || txn.source === 'Purchase';
        if (typeFilter === 'purchase_return') return ref === 'purchase_return';
        if (typeFilter === 'payment') return ref === 'payment' || ref === 'payment_adjustment' || (txn.metadata as any)?.paymentId || txn.source === 'Payment';
        if (typeFilter === 'opening') return ref.startsWith('opening_balance');
        if (typeFilter === 'shipment') return ref === 'shipment';
        if (typeFilter === 'expense') return txn.source === 'Expense' || ref === 'expense';
        if (typeFilter === 'cancel') return ref === 'sale_reversal' || ref === 'purchase_reversal' || ref.includes('cancel');
        if (typeFilter === 'adjustment') return ref.includes('adjustment');
        return true;
      });
    }

    // Multi-field search filter.
    const normalizedSearch = normalizeSearchValue(searchTerm);
    if (normalizedSearch) {
      filtered = filtered.filter((txn) => buildJournalSearchHaystack(txn).includes(normalizedSearch));
    }

    return filtered;
  }, [transactions, searchTerm, typeFilter]);

  // PF-14.3B: Group journal entries by root document so one sale (original + adjustments) = one logical row
  type JournalGroup = { rootKey: string; primary: AccountingEntry; entries: AccountingEntry[] };
  const getEntrySortValue = (entry: AccountingEntry, key: JournalSortKey): string | number => {
    const meta = entry.metadata as { createdAt?: string; paymentMethod?: string } | undefined;
    switch (key) {
      case 'date':
        return new Date(meta?.createdAt ?? entry.date).getTime();
      case 'reference':
        return (entry.referenceNo || (meta as any)?.paymentId?.substring(0, 8) || entry.id?.substring(0, 8) || '').toLowerCase();
      case 'module':
        return (entry.module || 'Accounting').toLowerCase();
      case 'description':
        return (entry.description || '').toLowerCase();
      case 'type':
        return (entry.amount ?? 0) >= 0 ? 'income' : 'expense';
      case 'paymentMethod':
        return ((meta?.paymentMethod ?? '') || 'N/A').toString().toLowerCase();
      case 'amount':
        return Math.abs(entry.amount ?? 0);
      case 'source':
        return (entry.source || 'Manual').toLowerCase();
      default:
        return '';
    }
  };
  const groupedJournalRows = useMemo(() => {
    const reversedJournalTargetIds = new Set<string>();
    for (const t of filteredTransactions) {
      const crt = String(t.metadata?.referenceType || '').toLowerCase();
      const crid = t.metadata?.referenceId ? String(t.metadata.referenceId).trim() : '';
      if (crt === 'correction_reversal' && crid) reversedJournalTargetIds.add(crid);
    }

    const keyToEntries = new Map<string, AccountingEntry[]>();
    for (const t of filteredTransactions) {
      const key = journalDocumentGroupKey(t, reversedJournalTargetIds);
      if (!keyToEntries.has(key)) keyToEntries.set(key, []);
      keyToEntries.get(key)!.push(t);
    }
    const groups: JournalGroup[] = [];
    keyToEntries.forEach((entries, rootKey) => {
      const chron = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const primary =
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'sale') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'purchase') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'manual_receipt') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'on_account') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'manual_payment') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'payment') ??
        chron.find((e) => String(e.metadata?.referenceType || '').toLowerCase() !== 'correction_reversal') ??
        chron[0];
      groups.push({ rootKey, primary, entries });
    });
    groups.sort((a, b) => new Date(b.primary.date).getTime() - new Date(a.primary.date).getTime());
    return groups;
  }, [filteredTransactions]);

  // Sorted list for display: default date+time desc; column header sort applies to both grouped and audit
  const sortedGroupedRows = useMemo(() => {
    const dir = journalSortDir === 'asc' ? 1 : -1;
    return [...groupedJournalRows].sort((a, b) => {
      const va =
        journalSortKey === 'amount'
          ? Math.abs(groupedDocumentDisplayAmount(a))
          : getEntrySortValue(a.primary, journalSortKey);
      const vb =
        journalSortKey === 'amount'
          ? Math.abs(groupedDocumentDisplayAmount(b))
          : getEntrySortValue(b.primary, journalSortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * dir;
    });
  }, [groupedJournalRows, journalSortKey, journalSortDir]);
  const sortedFlatEntries = useMemo(() => {
    const dir = journalSortDir === 'asc' ? 1 : -1;
    return [...filteredTransactions].sort((a, b) => {
      const va = getEntrySortValue(a, journalSortKey);
      const vb = getEntrySortValue(b, journalSortKey);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * dir;
    });
  }, [filteredTransactions, journalSortKey, journalSortDir]);

  // Journal entries pagination: 50 per page (grouped = by group, audit = by raw entry); use sorted lists
  const JOURNAL_PAGE_SIZE = 50;
  const listForPagination = journalViewMode === 'grouped' ? sortedGroupedRows : sortedFlatEntries;
  const totalJournalPages = Math.max(1, Math.ceil(listForPagination.length / JOURNAL_PAGE_SIZE));
  const paginatedJournalEntries = useMemo(() => {
    const start = (currentPage - 1) * JOURNAL_PAGE_SIZE;
    return Array.isArray(listForPagination)
      ? listForPagination.slice(start, start + JOURNAL_PAGE_SIZE)
      : [];
  }, [listForPagination, currentPage, JOURNAL_PAGE_SIZE]);
  useEffect(() => {
    if (currentPage > totalJournalPages && totalJournalPages >= 1) setCurrentPage(1);
  }, [currentPage, totalJournalPages]);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, journalViewMode]);

  // Permission gate – Accounting restricted to authorized roles
  if (!canAccessAccounting) {
    return (
      <div className="h-screen flex items-center justify-center bg-secondary">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 mx-auto text-amber-500/60 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-muted-foreground text-sm">You do not have permission to view Accounting. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Ledger full screen removed — use Party Ledger (sidebar) or Account Statements tab.

  return (
    <div className="flex flex-col bg-secondary min-h-0 min-w-0 w-full max-w-full">
      {/* Page Header — no h-screen/overflow-hidden so outer main can scroll the full page */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-muted/40">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Financial transactions and reporting</p>
          </div>
          {canAccessAccounting && canPostAccounting && (
            <Button
              onClick={() => {
                setActiveTab('journal_entries');
                dispatchOpenAddEntryV2();
              }}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2 shadow-lg shadow-blue-900/30"
            >
              <Plus size={16} />
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-6 py-4 bg-muted/40 border-b border-border min-w-0">
        <ReportBasisBanner
          basis="official_gl"
          detail="Top cards use Official Posted GL (same as Trial Balance / P&L): void excluded, correction journals included. Operational document due is on Receivables / Payables tabs."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-3">
          {/* Total Income */}
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Income</p>
                <AdaptiveCurrencyValue value={displaySummary.totalIncome} className="text-2xl font-bold text-[var(--erp-money-positive)] mt-1" as="p" />
                <p className="text-xs text-muted-foreground mt-1">Official Posted GL basis</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp size={24} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Total Expense */}
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Expense</p>
                <AdaptiveCurrencyValue value={displaySummary.totalExpense} className="text-2xl font-bold text-red-400 mt-1" as="p" />
                <p className="text-xs text-muted-foreground mt-1">Official Posted GL basis</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <TrendingDown size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Net Profit</p>
                <AdaptiveCurrencyValue
                  value={displaySummary.netProfit}
                  className={cn(
                    'text-2xl font-bold mt-1',
                    displaySummary.netProfit >= 0 ? 'text-[var(--erp-money-positive)]' : 'text-red-400'
                  )}
                  as="p"
                />
                <p className="text-xs text-muted-foreground mt-1">Official Posted GL basis</p>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                displaySummary.netProfit >= 0 ? "bg-green-500/10" : "bg-red-500/10"
              )}>
                <DollarSign size={24} className={displaySummary.netProfit >= 0 ? "text-green-500" : "text-red-500"} />
              </div>
            </div>
          </div>

          {/* Receivables */}
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Receivables</p>
                <AdaptiveCurrencyValue value={displaySummary.totalReceivable} className="text-2xl font-bold text-blue-400 mt-1" as="p" />
                <p className="text-xs text-muted-foreground mt-1">AR control 1100 — Official GL</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users size={24} className="text-blue-500" />
              </div>
            </div>
          </div>

          {/* Payables */}
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Payables</p>
                <AdaptiveCurrencyValue value={displaySummary.totalPayable} className="text-2xl font-bold text-orange-400 mt-1" as="p" />
                <p className="text-xs text-muted-foreground mt-1">AP control 2000 — Official GL</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Building2 size={24} className="text-orange-500" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 max-w-6xl leading-relaxed">
          <span className="font-medium text-muted-foreground">Semantics map — </span>
          Top cards load from <code className="text-muted-foreground">accountingReportsService</code> (Trial Balance / P&amp;L source). Operational follow-up uses{' '}
          <span className="text-muted-foreground">Receivables / Payables</span> tabs and AR/AP Reconciliation (effective vs raw GL). See{' '}
          <span className="text-muted-foreground">Financial Truth Center → Tie-out</span> for company-wide differences.
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 border-b border-border min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain">
        <div className="flex gap-1 -mb-px flex-nowrap w-max min-w-full">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2",
                  activeTab === tab.key
                    ? "text-blue-400 border-blue-400"
                    : "text-muted-foreground border-transparent hover:text-muted-foreground hover:border-border"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content — journal table uses its own 2-axis scroll viewport */}
      <div className="px-6 py-4 bg-secondary min-w-0">
        {activeTab === 'journal_entries' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-foreground">Journal Entries</h3>
                <p className="text-sm text-muted-foreground">
                  {journalViewMode === 'grouped'
                    ? 'One row per document (e.g. sale); open a row to see original + edit adjustments.'
                    : 'All raw journal entries – audit view.'}
                  {' '}(50 per page).
                  {canPostAccounting
                    ? ' Use Cancel Payment or Cancel Entry on eligible rows, or Manual Entry for adjustments.'
                    : ' Posting and corrections require Manager or Admin role.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">View:</span>
                <Button
                  variant={journalViewMode === 'grouped' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setJournalViewMode('grouped')}
                >
                  By document
                </Button>
                <Button
                  variant={journalViewMode === 'audit' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setJournalViewMode('audit')}
                >
                  All entries (audit)
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[260px] max-w-[680px]">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by reference, description, account, model/type, module..."
                  className="pl-9 pr-10 h-9 bg-card/70 border-border text-sm text-gray-100 placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-blue-500/50"
                />
                {searchTerm.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-gray-200 hover:bg-muted/80"
                    aria-label="Clear journal search"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
              <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                {listForPagination.length} result{listForPagination.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {/* Filter pills by transaction type */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: 'All', color: 'bg-muted' },
                { key: 'sale', label: 'Sales', color: 'bg-blue-900/60' },
                { key: 'sale_return', label: 'Sale Returns', color: 'bg-orange-900/60' },
                { key: 'purchase', label: 'Purchases', color: 'bg-purple-900/60' },
                { key: 'purchase_return', label: 'Purchase Returns', color: 'bg-pink-900/60' },
                { key: 'payment', label: 'Payments', color: 'bg-green-900/60' },
                { key: 'opening', label: 'Opening Balance', color: 'bg-cyan-900/60' },
                { key: 'shipment', label: 'Shipment', color: 'bg-amber-900/60' },
                { key: 'adjustment', label: 'Adjustments', color: 'bg-yellow-900/60' },
                { key: 'cancel', label: 'Cancelled', color: 'bg-red-900/60' },
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTypeFilter(f.key)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-all',
                    typeFilter === f.key
                      ? `${f.color} text-foreground ring-1 ring-white/20`
                      : 'bg-muted/50 text-muted-foreground hover:text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f.label}
                  {typeFilter === 'all' || typeFilter === f.key ? '' : ''}
                </button>
              ))}
            </div>

            {/* Journal Entries Table with pagination */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {accounting.loading && filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading journal entries…</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-muted-foreground mb-3" />
                  {searchTerm.trim() || typeFilter !== 'all' ? (
                    <>
                      <p className="text-muted-foreground text-sm font-medium">No journal entries match your filters</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Try a different keyword, clear search, or switch transaction type.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm font-medium">No journal entries in this period</p>
                      <p className="text-muted-foreground text-xs mt-1 max-w-md mx-auto">
                        The list follows the <span className="text-muted-foreground">date range in the top header</span>. Widen it (e.g. From
                        start or Last 90 days) if you expect older data. Embedded previews can use different saved filters than your
                        main browser.
                      </p>
                      <p className="text-muted-foreground text-xs mt-2">If the range is already wide, create a sale, record a payment, or add a manual entry.</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                {accounting.backgroundSync ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-blue-400 border-b border-border">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Refreshing journal entries…
                  </div>
                ) : null}
                <div className="overflow-auto max-h-[calc(100dvh-18rem)] overscroll-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]">
                  <table className="w-full min-w-[1280px] border-collapse">
                    <thead className="bg-card border-b border-border sticky top-0 z-10 shadow-[0_1px_0_0_rgba(31,41,55,1)]">
                      <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {(['date', 'reference', 'module', 'description', 'type', 'paymentMethod', 'amount', 'source'] as const).map((key) => {
                          const label = key === 'paymentMethod' ? 'Payment Method' : key.charAt(0).toUpperCase() + key.slice(1);
                          const isActive = journalSortKey === key;
                          const alignRight = key === 'amount';
                          return (
                            <th key={key} className={cn('px-4 py-3', alignRight ? 'text-right' : 'text-left')}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (journalSortKey === key) {
                                    setJournalSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                                  } else {
                                    setJournalSortKey(key);
                                    setJournalSortDir('desc');
                                  }
                                }}
                                className="flex items-center gap-1 w-full group hover:text-muted-foreground transition-colors focus:outline-none focus:ring-0"
                                style={alignRight ? { justifyContent: 'flex-end' } : undefined}
                              >
                                {label}
                                {isActive ? (
                                  journalSortDir === 'desc' ? <ChevronDown size={14} className="shrink-0 opacity-80" /> : <ChevronUp size={14} className="shrink-0 opacity-80" />
                                ) : (
                                  <ChevronsUpDown size={14} className="shrink-0 opacity-50 group-hover:opacity-70" />
                                )}
                              </button>
                            </th>
                          );
                        })}
                        <th className="px-4 py-3 text-left">Lines</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Account</th>
                        {canPostAccounting && <th className="px-4 py-3 text-left">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {journalViewMode === 'grouped'
                        ? (paginatedJournalEntries as JournalGroup[]).map((group) => {
                            const entry = group.primary;
                            const voucherLabel = journalVoucherLabel(entry);
                            const module = entry.module || 'Accounting';
                            const amount = groupedDocumentDisplayAmount(group);
                            const paymentMethod = (entry.metadata as any)?.paymentMethod || 'N/A';
                            const pres = journalRowPresentation(entry);
                            const isReversal = entry.source === 'Reversal';
                            const adjustmentCount = group.entries.length > 1 ? group.entries.length - 1 : 0;
                            const acPair = journalGroupAccountPair(group);
                            const allowUnifiedEdit = allowsGenericAccountingUnifiedEdit(entry);
                            const sourceOpen = getJournalEntrySourceDocumentOpenTarget(entry);
                            const chainTailEntry = group.entries.find((e) => e.metadata?.paymentChainIsTail);
                            const lockPaymentChainReverse =
                              Boolean(chainTailEntry) && group.primary.id !== chainTailEntry.id;
                            const journalReverseBlockReason = journalReversalBlockedReason(
                              {
                                reference_type: entry.metadata?.referenceType,
                                reference_id: entry.metadata?.referenceId,
                                payment_id: entry.metadata?.paymentId,
                                is_void: entry.metadata?.journalEntryVoid,
                                payment_chain_is_historical: entry.metadata?.paymentChainIsHistorical,
                                hasActiveCorrectionReversal: entry.metadata?.hasActiveCorrectionReversal,
                              },
                              undefined
                            );
                            const allowJournalReversalUi = !journalReverseBlockReason;
                            return (
                              <tr
                                key={group.rootKey}
                                className="border-b border-border hover:bg-accent/30 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (busy) return;
                                  openJournalEntryDetailFromEntry(entry, group.entries);
                                }}
                              >
                                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                  {entry.date ? (
                                    <div className="flex flex-col gap-0.5">
                                      <DateTimeDisplay date={entry.date} dateOnly className="text-muted-foreground" />
                                      {(entry.metadata as { createdAt?: string } | undefined)?.createdAt ? (
                                        <span className="text-[10px] text-muted-foreground">
                                          Posted{' '}
                                          {new Date(
                                            (entry.metadata as { createdAt?: string }).createdAt!
                                          ).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    'N/A'
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (busy) return;
                                        openJournalEntryDetailFromEntry(entry, group.entries);
                                      }}
                                      className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium disabled:opacity-40"
                                    >
                                      {voucherLabel}
                                      {adjustmentCount > 0 && (
                                        <span className="ml-1.5 text-muted-foreground font-normal">(+{adjustmentCount})</span>
                                      )}
                                    </button>
                                    {groupEntryHasAttachments(group.entries) ? (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAttachmentsDialogList(collectGroupAttachments(group.entries));
                                        }}
                                        className="text-amber-400 hover:text-amber-300 disabled:opacity-40 shrink-0"
                                        title="View attachment"
                                      >
                                        <Paperclip size={14} />
                                      </button>
                                    ) : null}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                    {module}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                                  <span className="truncate inline-flex items-center max-w-full">
                                    {entry.description || 'No description'}
                                    {saleCancellationJournalBadge(entry)}
                                  </span>
                                  {adjustmentCount > 0 && (
                                    <span className="text-muted-foreground ml-1">(edit trail)</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={pres.badgeClass}>
                                    {pres.typeLabel}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{paymentMethod}</td>
                                <td className={cn('px-4 py-3 text-sm font-semibold text-right tabular-nums', pres.amountClass)}>
                                  {formatCurrency(Math.abs(amount))}
                                </td>
                                <td className="px-4 py-3">
                                  {(() => { const rt = ((entry.metadata as any)?.referenceType || entry.source || 'manual').toLowerCase(); return <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${REF_TYPE_COLORS[rt] || 'bg-muted text-muted-foreground'}`}>{refTypeBadgeLabel(rt)}</span>; })()}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">{group.entries.length}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <Badge
                                      className={
                                        isReversal
                                          ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 text-xs'
                                          : entry.metadata?.isOrphanReceipt
                                            ? 'bg-orange-500/15 text-orange-200 border-orange-500/30 text-xs'
                                            : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25 text-xs'
                                      }
                                    >
                                      {isReversal
                                        ? 'Reversal'
                                        : entry.metadata?.isOrphanReceipt
                                          ? 'Orphan / Posting failed'
                                          : 'Posted'}
                                    </Badge>
                                    {entry.metadata?.paymentChainIsHistorical ? (
                                      <Badge className="bg-muted/80 text-muted-foreground border-gray-600 text-[10px]">
                                        Historical
                                      </Badge>
                                    ) : null}
                                    {entry.metadata?.paymentChainIsTail && (entry.metadata?.paymentChainMemberCount ?? 0) > 1 ? (
                                      <Badge className="bg-emerald-900/50 text-emerald-200 border-emerald-700/40 text-[10px]">
                                        Latest
                                      </Badge>
                                    ) : null}
                                  </div>
                                </td>
                                <td
                                  className="px-4 py-3 text-xs text-muted-foreground max-w-[min(280px,40vw)]"
                                  title={`Debit: ${acPair.debit} → Credit: ${acPair.credit}`}
                                >
                                  <span className="text-muted-foreground">Debit:</span>{' '}
                                  <span className="text-gray-200">{acPair.debit}</span>
                                  <span className="text-muted-foreground mx-1">→</span>
                                  <span className="text-blue-400 font-medium">Credit: {acPair.credit}</span>
                                </td>
                                {canPostAccounting && (
                                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    {useTransactionActionPanel && !isReversal ? (
                                      <JournalRowTransactionActions
                                        entry={entry}
                                        busy={busy}
                                        isReversal={isReversal}
                                        lockPaymentChainReverse={lockPaymentChainReverse}
                                        allowUnifiedEdit={allowUnifiedEdit}
                                        onView={() => openJournalEntryDetailFromEntry(entry, group.entries)}
                                        onEdit={() => openJournalEntryDetailFromEntry(entry, group.entries, { autoEdit: true })}
                                        onOpenSourceDocument={handleOpenJournalSourceDocument}
                                        onUndoLastChange={handleJournalUndoLastChange}
                                        onCancelPayment={(id) => {
                                          const chainMembers = entry.metadata?.paymentChainMemberCount ?? 0;
                                          handleJournalCancelPayment(
                                            id,
                                            chainMembers > 1 && !!entry.metadata?.paymentId,
                                          );
                                        }}
                                        onCancelOrphan={handleJournalCancelOrphan}
                                        onCancelEntry={handleJournalCancelEntry}
                                        onViewTrace={() =>
                                          openJournalEntryDetailFromEntry(entry, group.entries, { autoTrace: true })
                                        }
                                        onViewAudit={() =>
                                          openJournalEntryDetailFromEntry(entry, group.entries, { scrollAudit: true })
                                        }
                                      />
                                    ) : (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {!isReversal && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                            disabled={busy}
                                            onClick={() => {
                                              if (busy) return;
                                              openJournalEntryDetailFromEntry(entry, group.entries);
                                            }}
                                            title="Open journal detail (read-only)"
                                          >
                                            <Eye className="w-4 h-4 mr-1" />
                                            View
                                          </Button>
                                          {allowUnifiedEdit ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                              disabled={busy}
                                              onClick={() => {
                                                if (busy) return;
                                                openJournalEntryDetailFromEntry(entry, group.entries, { autoEdit: true });
                                              }}
                                              title="Open unified editor (same as transaction detail)"
                                            >
                                              <Edit className="w-4 h-4 mr-1" />
                                              Edit
                                            </Button>
                                          ) : sourceOpen ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                                              disabled={busy}
                                              onClick={() =>
                                                runJournalMutation('Opening...', () =>
                                                  handleOpenJournalSourceDocument(entry),
                                                )
                                              }
                                              title="Open sale, purchase, return, or rental in its module"
                                            >
                                              <ExternalLink className="w-4 h-4 mr-1" />
                                              Open source
                                            </Button>
                                          ) : null}
                                          {(() => {
                                            const chainPaymentId = entry.metadata?.paymentId || null;
                                            const chainMembers = entry.metadata?.paymentChainMemberCount ?? 0;
                                            const isMultiMemberChain = chainMembers > 1 && chainPaymentId;
                                            const chainReverseDisabled =
                                              lockPaymentChainReverse || !allowJournalReversalUi || busy;
                                            return (
                                              <>
                                                {isMultiMemberChain ? (
                                                  <>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-8 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 disabled:opacity-40"
                                                      disabled={chainReverseDisabled}
                                                      title={
                                                        journalReverseBlockReason ||
                                                        'Undo last edit — voids the latest adjustment JE and restores previous payment state'
                                                      }
                                                      onClick={() =>
                                                        runJournalMutation('Undoing edit...', async () => {
                                                          if (
                                                            !window.confirm(
                                                              'Undo the last edit on this payment? This voids the latest adjustment and restores the previous state.',
                                                            )
                                                          ) {
                                                            return;
                                                          }
                                                          await accounting.undoLastPaymentMutation(chainPaymentId);
                                                        })
                                                      }
                                                    >
                                                      <Undo2 className="w-4 h-4 mr-1" />
                                                      Undo edit
                                                    </Button>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                                                      disabled={chainReverseDisabled}
                                                      title={
                                                        journalReverseBlockReason ||
                                                        'Cancel full payment — voids entire chain (all edits + original)'
                                                      }
                                                      onClick={() =>
                                                        runJournalMutation('Cancelling payment...', async () => {
                                                          if (
                                                            !window.confirm(
                                                              'Cancel this payment entirely? This voids the original posting plus every edit in the chain. Cannot be undone.',
                                                            )
                                                          ) {
                                                            return;
                                                          }
                                                          await accounting.createReversalEntry(entry.id);
                                                        })
                                                      }
                                                    >
                                                      <RotateCcw className="w-4 h-4 mr-1" />
                                                      Cancel payment
                                                    </Button>
                                                  </>
                                                ) : (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                                                    disabled={chainReverseDisabled}
                                                    title={
                                                      journalReverseBlockReason ||
                                                      (lockPaymentChainReverse
                                                        ? 'This row is not the latest payment journal line — reverse the Latest row instead.'
                                                        : 'Create reversal (manual correction)')
                                                    }
                                                    onClick={() =>
                                                      runJournalMutation('Reversing...', async () => {
                                                        if (
                                                          !window.confirm(
                                                            'Create a reversal entry for this journal entry? This will post a new entry that offsets the original.',
                                                          )
                                                        ) {
                                                          return;
                                                        }
                                                        await accounting.createReversalEntry(entry.id);
                                                      })
                                                    }
                                                  >
                                                    <RotateCcw className="w-4 h-4 mr-1" />
                                                    Reverse
                                                  </Button>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        : (paginatedJournalEntries as AccountingEntry[]).map((entry) => {
                            const voucherLabel = journalVoucherLabel(entry);
                            const module = entry.module || 'Accounting';
                            const amount = entry.amount || 0;
                            const paymentMethod = (entry.metadata as any)?.paymentMethod || 'N/A';
                            const pres = journalRowPresentation(entry);
                            const isReversal = entry.source === 'Reversal';
                            const acFlat = journalEntryAccountPair(entry);
                            const allowUnifiedEditFlat = allowsGenericAccountingUnifiedEdit(entry);
                            const sourceOpenFlat = getJournalEntrySourceDocumentOpenTarget(entry);
                            const journalReverseBlockReasonFlat = journalReversalBlockedReason(
                              {
                                reference_type: entry.metadata?.referenceType,
                                reference_id: entry.metadata?.referenceId,
                                payment_id: entry.metadata?.paymentId,
                                is_void: entry.metadata?.journalEntryVoid,
                                payment_chain_is_historical: entry.metadata?.paymentChainIsHistorical,
                                hasActiveCorrectionReversal: entry.metadata?.hasActiveCorrectionReversal,
                              },
                              undefined
                            );
                            const allowJournalReversalUiFlat = !journalReverseBlockReasonFlat;
                            const lockFlatPaymentChainReverse = Boolean(entry.metadata?.paymentChainIsHistorical);
                            return (
                              <tr
                                key={entry.id}
                                className="border-b border-border hover:bg-accent/30 transition-colors cursor-pointer"
                                onClick={() => {
                                  if (busy) return;
                                  openJournalEntryDetailFromEntry(entry, null);
                                }}
                              >
                                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                  {entry.date ? (
                                    <div className="flex flex-col gap-0.5">
                                      <DateTimeDisplay date={entry.date} dateOnly className="text-muted-foreground" />
                                      {(entry.metadata as { createdAt?: string } | undefined)?.createdAt ? (
                                        <span className="text-[10px] text-muted-foreground">
                                          Posted{' '}
                                          {new Date(
                                            (entry.metadata as { createdAt?: string }).createdAt!
                                          ).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : (
                                    'N/A'
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (busy) return;
                                        openJournalEntryDetailFromEntry(entry, null);
                                      }}
                                      className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium"
                                    >
                                      {voucherLabel}
                                    </button>
                                    {entryHasAttachments(entry) ? (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAttachmentsDialogList(collectEntryAttachments(entry));
                                        }}
                                        className="text-amber-400 hover:text-amber-300 disabled:opacity-40 shrink-0"
                                        title="View attachment"
                                      >
                                        <Paperclip size={14} />
                                      </button>
                                    ) : null}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                    {module}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs">
                                  <span className="truncate inline-flex items-center max-w-full">
                                    {entry.description || 'No description'}
                                    {saleCancellationJournalBadge(entry)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={pres.badgeClass}>
                                    {pres.typeLabel}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{paymentMethod}</td>
                                <td className={cn('px-4 py-3 text-sm font-semibold text-right tabular-nums', pres.amountClass)}>
                                  {formatCurrency(Math.abs(amount))}
                                </td>
                                <td className="px-4 py-3">
                                  {(() => { const rt = ((entry.metadata as any)?.referenceType || entry.source || 'manual').toLowerCase(); return <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${REF_TYPE_COLORS[rt] || 'bg-muted text-muted-foreground'}`}>{refTypeBadgeLabel(rt)}</span>; })()}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">1</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <Badge
                                      className={
                                        isReversal
                                          ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 text-xs'
                                          : entry.metadata?.isOrphanReceipt
                                            ? 'bg-orange-500/15 text-orange-200 border-orange-500/30 text-xs'
                                            : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25 text-xs'
                                      }
                                    >
                                      {isReversal
                                        ? 'Reversal'
                                        : entry.metadata?.isOrphanReceipt
                                          ? 'Orphan / Posting failed'
                                          : 'Posted'}
                                    </Badge>
                                    {entry.metadata?.paymentChainIsHistorical ? (
                                      <Badge className="bg-muted/80 text-muted-foreground border-gray-600 text-[10px]">
                                        Historical
                                      </Badge>
                                    ) : null}
                                    {entry.metadata?.paymentChainIsTail &&
                                    (entry.metadata?.paymentChainMemberCount ?? 0) > 1 ? (
                                      <Badge className="bg-emerald-900/50 text-emerald-200 border-emerald-700/40 text-[10px]">
                                        Latest
                                      </Badge>
                                    ) : null}
                                  </div>
                                </td>
                                <td
                                  className="px-4 py-3 text-xs text-muted-foreground max-w-[min(280px,40vw)]"
                                  title={`Debit: ${acFlat.debit} → Credit: ${acFlat.credit}`}
                                >
                                  <span className="text-muted-foreground">Debit:</span>{' '}
                                  <span className="text-gray-200">{acFlat.debit}</span>
                                  <span className="text-muted-foreground mx-1">→</span>
                                  <span className="text-blue-400 font-medium">Credit: {acFlat.credit}</span>
                                </td>
                                {canPostAccounting && (
                                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    {useTransactionActionPanel && !isReversal ? (
                                      <JournalRowTransactionActions
                                        entry={entry}
                                        busy={busy}
                                        isReversal={isReversal}
                                        lockPaymentChainReverse={lockFlatPaymentChainReverse}
                                        allowUnifiedEdit={allowUnifiedEditFlat}
                                        onView={() => openJournalEntryDetailFromEntry(entry, null)}
                                        onEdit={() => openJournalEntryDetailFromEntry(entry, null, { autoEdit: true })}
                                        onOpenSourceDocument={handleOpenJournalSourceDocument}
                                        onUndoLastChange={handleJournalUndoLastChange}
                                        onCancelPayment={(id) => {
                                          const chainMembers = entry.metadata?.paymentChainMemberCount ?? 0;
                                          handleJournalCancelPayment(
                                            id,
                                            chainMembers > 1 && !!entry.metadata?.paymentId,
                                          );
                                        }}
                                        onCancelOrphan={handleJournalCancelOrphan}
                                        onCancelEntry={handleJournalCancelEntry}
                                        onViewTrace={() => openJournalEntryDetailFromEntry(entry, null, { autoTrace: true })}
                                        onViewAudit={() => openJournalEntryDetailFromEntry(entry, null, { scrollAudit: true })}
                                      />
                                    ) : (
                                    <div className="flex flex-wrap items-center gap-1">
                                      {!isReversal && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                            disabled={busy}
                                            onClick={() => {
                                              if (busy) return;
                                              openJournalEntryDetailFromEntry(entry, null);
                                            }}
                                            title="Open journal detail (read-only)"
                                          >
                                            <Eye className="w-4 h-4 mr-1" />
                                            View
                                          </Button>
                                          {allowUnifiedEditFlat ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                              disabled={busy}
                                              onClick={() => {
                                                if (busy) return;
                                                openJournalEntryDetailFromEntry(entry, null, { autoEdit: true });
                                              }}
                                              title="Open unified editor (same as transaction detail)"
                                            >
                                              <Edit className="w-4 h-4 mr-1" />
                                              Edit
                                            </Button>
                                          ) : sourceOpenFlat ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                                              disabled={busy}
                                              onClick={() =>
                                                runJournalMutation('Opening...', () =>
                                                  handleOpenJournalSourceDocument(entry),
                                                )
                                              }
                                              title="Open sale, purchase, return, or rental in its module"
                                            >
                                              <ExternalLink className="w-4 h-4 mr-1" />
                                              Open source
                                            </Button>
                                          ) : null}
                                          {(() => {
                                            const flatChainPaymentId = entry.metadata?.paymentId || null;
                                            const flatChainMembers = entry.metadata?.paymentChainMemberCount ?? 0;
                                            const isFlatMultiChain = flatChainMembers > 1 && flatChainPaymentId;
                                            const flatChainReverseDisabled =
                                              lockFlatPaymentChainReverse || !allowJournalReversalUiFlat || busy;
                                            return isFlatMultiChain ? (
                                              <>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 disabled:opacity-40"
                                                  disabled={flatChainReverseDisabled}
                                                  title={
                                                    journalReverseBlockReasonFlat ||
                                                    'Undo last edit — voids the latest adjustment JE and restores previous payment state'
                                                  }
                                                  onClick={() =>
                                                    runJournalMutation('Undoing edit...', async () => {
                                                      if (
                                                        !window.confirm(
                                                          'Undo the last edit on this payment? This voids the latest adjustment and restores the previous state.',
                                                        )
                                                      ) {
                                                        return;
                                                      }
                                                      await accounting.undoLastPaymentMutation(flatChainPaymentId);
                                                    })
                                                  }
                                                >
                                                  <Undo2 className="w-4 h-4 mr-1" />
                                                  Undo edit
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                                                  disabled={flatChainReverseDisabled}
                                                  title={
                                                    journalReverseBlockReasonFlat ||
                                                    'Cancel full payment — voids entire chain (all edits + original)'
                                                  }
                                                  onClick={() =>
                                                    runJournalMutation('Cancelling payment...', async () => {
                                                      if (
                                                        !window.confirm(
                                                          'Cancel this payment entirely? This voids the original posting plus every edit in the chain. Cannot be undone.',
                                                        )
                                                      ) {
                                                        return;
                                                      }
                                                      await accounting.createReversalEntry(entry.id);
                                                    })
                                                  }
                                                >
                                                  <RotateCcw className="w-4 h-4 mr-1" />
                                                  Cancel payment
                                                </Button>
                                              </>
                                            ) : (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                                                disabled={flatChainReverseDisabled}
                                                title={
                                                  journalReverseBlockReasonFlat ||
                                                  (lockFlatPaymentChainReverse
                                                    ? 'This row is not the latest payment journal line — reverse the Latest row instead.'
                                                    : 'Create reversal (manual correction)')
                                                }
                                                onClick={() =>
                                                  runJournalMutation('Reversing...', async () => {
                                                    if (
                                                      !window.confirm(
                                                        'Create a reversal entry for this journal entry? This will post a new entry that offsets the original.',
                                                      )
                                                    ) {
                                                      return;
                                                    }
                                                    await accounting.createReversalEntry(entry.id);
                                                  })
                                                }
                                              >
                                                <RotateCcw className="w-4 h-4 mr-1" />
                                                Reverse
                                              </Button>
                                            );
                                          })()}
                                        </>
                                      )}
                                    </div>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
                {totalJournalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-border bg-card">
                    <p className="text-xs text-muted-foreground">
                      Showing {(currentPage - 1) * JOURNAL_PAGE_SIZE + 1}–{Math.min(currentPage * JOURNAL_PAGE_SIZE, listForPagination.length)} of {listForPagination.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-border text-muted-foreground"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalJournalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalJournalPages || Math.abs(p - currentPage) <= 2)
                        .map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
                            <button
                              type="button"
                              className={cn(
                                'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                                p === currentPage ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted'
                              )}
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-border text-muted-foreground"
                        disabled={currentPage >= totalJournalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalJournalPages, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'daybook' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">Day Book (Journal)</h3>
            <p className="text-sm text-muted-foreground mb-4">Click voucher number to open transaction detail</p>
            <Suspense fallback={<ReportTabSuspenseFallback label="Loading day book…" />}>
              <DayBookReport
                onVoucherClick={(voucher) => {
                  openJournalEntryDetail(voucher, null);
                }}
                onEditJournalEntry={(journalEntryId) => {
                  openJournalEntryDetail(journalEntryId, journalEntryId, null, { autoEdit: true });
                }}
                globalStartDate={globalStartDate}
                globalEndDate={globalEndDate}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'roznamcha' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Roznamcha (Daily Cash Book)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Filter by date, branch, liquidity (cash/bank/wallet), a specific ledger account, row order, and page size.
                Party lines show customer, supplier, or expense context next to each reference.
              </p>
            </div>
            <Suspense fallback={<ReportTabSuspenseFallback label="Loading roznamcha…" />}>
              <RoznamchaReport
                globalStartDate={globalStartDate}
                globalEndDate={globalEndDate}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'cash_flow' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Cash Flow</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Operational cash and bank movements by source module. Read-only — use Normal mode for live balances;
                Audit mode for voided and reversal trails.
              </p>
            </div>
            <Suspense fallback={<ReportTabSuspenseFallback label="Loading cash flow…" />}>
              <CashFlowReportPage
                globalStartDate={globalStartDate}
                globalEndDate={globalEndDate}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            <ReportBasisBanner basis="official_gl" detail="Chart of Accounts balances use Official Posted GL (void excluded, corrections included)." />
            {/* Header with Mode Toggle & Create Button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  {accountsViewMode === 'operational'
                    ? 'Operational View: Cash, Bank, Wallet, expense/income, AR/AP, worker payables & advances, Committees & Dasti (1170), partner equity (3003/3005) — expand rows with the chevron'
                    : 'Professional View: Full Chart of Accounts'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                  <button
                    onClick={() => setAccountsViewMode('operational')}
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded transition-colors",
                      accountsViewMode === 'operational'
                        ? "bg-blue-600 text-white"
                        : "text-muted-foreground hover:text-muted-foreground"
                    )}
                  >
                    Operational
                  </button>
                  <button
                    onClick={() => setAccountsViewMode('professional')}
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded transition-colors",
                      accountsViewMode === 'professional'
                        ? "bg-blue-600 text-white"
                        : "text-muted-foreground hover:text-muted-foreground"
                    )}
                  >
                    Professional
                  </button>
                  {accountsViewMode === 'professional' && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSubAccounts}
                        onChange={(e) => setShowSubAccounts(e.target.checked)}
                        className="rounded border-gray-600 bg-muted text-blue-500"
                      />
                      Show sub-accounts
                    </label>
                  )}
                </div>
                {canPostAccounting && (
                  <Button
                    onClick={() => setIsAddAccountOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
                  >
                    <Plus size={16} /> Create New Account
                  </Button>
                )}
              </div>
            </div>

            {accounting.accounts.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/40 text-center py-12">
                <Wallet size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No accounts found</p>
                <p className="text-muted-foreground text-xs mt-1">Create your first account to get started</p>
                <Button
                  onClick={() => setIsAddAccountOpen(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <Plus size={16} className="mr-2" /> Create Account
                </Button>
              </div>
            ) : (
              <AccountsHierarchyList
                rows={hierarchyRows}
                accountsViewMode={accountsViewMode}
                formatCurrency={formatCurrency}
                onOpenLinkedParties={(row) => {
                  if (row.account.id) setLinkedPartiesControlId(row.account.id);
                }}
                renderRowInlineExtra={(row) => {
                  const account = row.account;
                  const ck = getControlAccountKind({ name: account.name, code: (account as { code?: string }).code });
                  const linkedName = (account as { linked_contact_name?: string | null }).linked_contact_name;
                  const showPartyToggle = Boolean(account.id && (ck || linkedName));
                  const hasSheetParties =
                    typeof row.coaLinkedPartyCount === 'number' && row.coaLinkedPartyCount > 0;
                  const breakdownBtn =
                    ck && account.id ? (
                      <button
                        type="button"
                        title="Control breakdown (GL / operational / party)"
                        onClick={(e) => {
                          e.stopPropagation();
                          setControlBreakdown({
                            account: {
                              id: account.id!,
                              name: account.name || '',
                              code: (account as { code?: string }).code,
                            },
                            kind: ck,
                          });
                        }}
                        className="p-1 rounded-md text-blue-300 hover:bg-blue-500/15 border border-blue-500/25 shrink-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : null;
                  const partyBtn =
                    showPartyToggle && !hasSheetParties ? (
                      <button
                        type="button"
                        title={
                          coaPartyPanelAccountId === account.id
                            ? 'Hide linked parties'
                            : 'Show linked parties & suppliers'
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setCoaPartyPanelAccountId((id) => (id === account.id ? null : account.id!));
                        }}
                        className={cn(
                          'p-1 rounded-md border shrink-0 transition-colors',
                          coaPartyPanelAccountId === account.id
                            ? 'text-violet-200 bg-violet-500/20 border-violet-500/40'
                            : 'text-muted-foreground hover:bg-muted hover:text-violet-200 border-border/80'
                        )}
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    ) : null;
                  if (!partyBtn && !breakdownBtn) return null;
                  return (
                    <div className="flex items-center gap-1 shrink-0">
                      {partyBtn}
                      {breakdownBtn}
                    </div>
                  );
                }}
                renderPartyDropdownBelowRow={(row) => {
                  if (!row.account.id || coaPartyPanelAccountId !== row.account.id) return null;
                  const acc = row.account as {
                    linked_contact_name?: string | null;
                    linked_contact_party_type?: string | null;
                    code?: string;
                    name?: string;
                  };
                  const ck = getControlAccountKind({ name: acc.name, code: acc.code });
                  if (ck) {
                    const parity =
                      !coaPartyFetch.loading &&
                      coaPartyFetch.panelAccountId === row.account.id &&
                      coaPartyFetch.controlGlBalance != null &&
                      coaPartyFetch.partyAttributedSumFull != null
                        ? {
                            coaRowDisplayBalance: row.displayBalance,
                            controlTrialBalance: coaPartyFetch.controlGlBalance,
                            partyAttributedSumFull: coaPartyFetch.partyAttributedSumFull,
                            residualAmount: coaPartyFetch.residualAmount ?? null,
                            subtreeTrialBalanceDrMinusCr: coaPartyFetch.subtreeTbDrMinusCr ?? null,
                            controlCodeLabel: coaPartyFetch.controlCodeLabel || '—',
                            unmappedTop: coaPartyFetch.unmappedTop,
                          }
                        : null;
                    return (
                      <ChartOfAccountsPartyDropdown
                        formatCurrency={formatCurrency}
                        onCollapse={() => setCoaPartyPanelAccountId(null)}
                        loading={coaPartyFetch.loading}
                        error={coaPartyFetch.error}
                        partyRows={coaPartyFetch.rows}
                        partySectionNote={coaPartyFetch.note}
                        scopeLabel={coaPartyFetch.controlLabel}
                        glParity={parity}
                        drillDown={{
                          onOpenContacts: () => {
                            setCoaPartyPanelAccountId(null);
                            setCurrentView('contacts');
                          },
                          onOpenTrialBalance: () => {
                            setCoaPartyPanelAccountId(null);
                            setCurrentView('reports');
                          },
                          onOpenUnmapped: () => {
                            setCoaPartyPanelAccountId(null);
                            setControlBreakdown({
                              account: {
                                id: row.account.id!,
                                name: row.account.name || '',
                                code: (row.account as { code?: string }).code,
                              },
                              kind: ck,
                            });
                          },
                        }}
                      />
                    );
                  }
                  if (acc.linked_contact_name) {
                    return (
                      <ChartOfAccountsPartyDropdown
                        formatCurrency={formatCurrency}
                        onCollapse={() => setCoaPartyPanelAccountId(null)}
                        linkedContactName={acc.linked_contact_name}
                        linkedContactPartyType={acc.linked_contact_party_type ?? undefined}
                      />
                    );
                  }
                  return null;
                }}
                renderRowMenu={(row) => (
                  <AccountingDashboardAccountRowMenu
                    row={row}
                    accountsViewMode={accountsViewMode}
                    accounting={accounting}
                    setLedgerAccount={setLedgerAccount}
                    setControlBreakdown={setControlBreakdown}
                    setEditingAccount={setEditingAccount}
                    setIsEditAccountOpen={setIsEditAccountOpen}
                    setCurrentView={setCurrentView}
                    canPostAccounting={canPostAccounting}
                    onTransferBalance={(accountId) => {
                      setActiveTab('journal_entries');
                      dispatchOpenAddEntryV2({
                        entryType: 'pure_journal',
                        fromAccountId: accountId,
                      });
                    }}
                    onOpenAccountStatements={(accountId) => {
                      setAccountStatementPreselectId(accountId);
                      setActiveTab('account_statements');
                    }}
                  />
                )}
              />
            )}
            <ControlLinkedPartiesSheet
              open={linkedPartiesControlId != null}
              onOpenChange={(o) => {
                if (!o) setLinkedPartiesControlId(null);
              }}
              control={linkedPartiesControl}
              allAccounts={accounting.accounts as any}
              partyGlByContactId={partyGlByContactId}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {activeTab === 'receivables' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-border text-[11px] text-muted-foreground space-y-0.5">
              <p>
                <span className="text-muted-foreground">Operational receivables</span> — unpaid sales invoices / customer due for collection follow-up (not GL 1100).
              </p>
              <p>Opening balances &amp; GL truth: Accounts, Account Statements, Contacts GL, TB / BS.</p>
            </div>
            {sales.sales.filter(s => s.due > 0).length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No receivables</p>
                <p className="text-muted-foreground text-xs mt-1">All customers are paid up</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-card border-b border-border">
                    <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Invoice No</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Total Amount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.sales
                      .filter(s => s.due > 0)
                      .map((sale) => (
                        <tr 
                          key={sale.id} 
                          className="border-b border-border hover:bg-accent/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-muted-foreground font-medium">
                            {sale.customerName}
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-400 font-mono">
                            {sale.invoiceNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(sale.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--erp-money-positive)] text-right">
                            {formatCurrency(sale.paid)}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400 font-semibold text-right">
                            {formatCurrency(sale.due)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge className={
                              sale.paymentStatus === 'paid' 
                                ? 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/30'
                                : sale.paymentStatus === 'partial'
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }>
                              {sale.paymentStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'payables' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm text-muted-foreground">Supplier & Courier payables</span>
              {canPostAccounting && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-muted-foreground hover:bg-muted hover:text-foreground gap-1.5"
                  onClick={() => setPayCourierOpen(true)}
                >
                  <Truck size={14} />
                  Pay Courier
                </Button>
              )}
            </div>
            <div className="px-4 py-2 border-b border-border text-[11px] text-muted-foreground space-y-0.5">
              <p>
                <span className="text-muted-foreground">Operational payables</span> — unpaid purchase bills / supplier due for payment scheduling (not GL 2000).
              </p>
              <p>Opening balances &amp; GL truth: Accounts, Account Statements, Contacts GL, TB / BS.</p>
            </div>
            {purchases.purchases.filter(p => p.due > 0).length === 0 ? (
              <div className="text-center py-12">
                <TrendingDown size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">No payables</p>
                <p className="text-muted-foreground text-xs mt-1">All suppliers are paid up</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-card border-b border-border">
                    <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-left">PO No</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Total Amount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.purchases
                      .filter(p => p.due > 0)
                      .map((purchase) => (
                        <tr 
                          key={purchase.id} 
                          className="border-b border-border hover:bg-accent/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-muted-foreground font-medium">
                            {purchase.supplierName}
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-400 font-mono">
                            {purchase.purchaseNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {new Date(purchase.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                            {formatCurrency(purchase.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--erp-money-positive)] text-right">
                            {formatCurrency(purchase.paid)}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400 font-semibold text-right">
                            {formatCurrency(purchase.due)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge className={
                              purchase.paymentStatus === 'paid' 
                                ? 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/30'
                                : purchase.paymentStatus === 'partial'
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                                : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }>
                              {purchase.paymentStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'courier' && (
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>}>
            <CourierReportsTab />
          </Suspense>
        )}

        {activeTab === 'deposits' && settingsModules.rentalModuleEnabled && (
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>}>
            <DepositsTab />
          </Suspense>
        )}

        {activeTab === 'studio' && (
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>}>
            <StudioCostsTab />
          </Suspense>
        )}

        {activeTab === 'account_statements' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Account Statements</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  GL statements — print, PDF, share. Use <strong className="text-muted-foreground font-medium">Advanced</strong> for effective/audit filters and control-account rollup rules.
                </p>
              </div>
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    accountStatementsViewMode === 'standard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-card text-muted-foreground hover:text-gray-200'
                  )}
                  onClick={() => setAccountStatementsViewMode('standard')}
                >
                  Standard (PDF / share)
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium transition-colors border-l border-border',
                    accountStatementsViewMode === 'advanced'
                      ? 'bg-amber-700/80 text-foreground'
                      : 'bg-card text-muted-foreground hover:text-gray-200'
                  )}
                  onClick={() => setAccountStatementsViewMode('advanced')}
                >
                  Advanced (effective / audit)
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4 pt-1">
              <div className="space-y-1">
                <Label htmlFor="account-statement-from" className="text-xs text-muted-foreground">
                  From
                </Label>
                <DatePicker
                  value={accountStatementStart}
                  onChange={(v) => setAccountStatementStart(v)}
                  maxDate={accountStatementEnd ? new Date(accountStatementEnd + 'T12:00:00') : undefined}
                  className="w-[11.5rem]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="account-statement-to" className="text-xs text-muted-foreground">
                  To
                </Label>
                <DatePicker
                  value={accountStatementEnd}
                  onChange={(v) => setAccountStatementEnd(v)}
                  minDate={accountStatementStart ? new Date(accountStatementStart + 'T12:00:00') : undefined}
                  className="w-[11.5rem]"
                />
              </div>
              <p className="text-xs text-muted-foreground pb-2">
                Standard and Advanced use these dates. Global filter updates the defaults. Statements include{' '}
                <strong className="text-muted-foreground font-medium">all branches</strong> — use the Branch column on each row.
              </p>
            </div>
            {accountStatementsViewMode === 'standard' ? (
              <LedgerStatementCenterV2Page
                embedded
                moduleContext="accounting"
                periodStart={accountStatementStart}
                periodEnd={accountStatementEnd}
                periodLabel={`${accountStatementStart} → ${accountStatementEnd}`}
                initialLedgerEntity={accountStatementV2Entity}
                onInitialLedgerConsumed={() => {
                  setAccountStatementV2Initial(null);
                  setAccountStatementPreselectId(null);
                }}
              />
            ) : (
              <Suspense fallback={<ReportTabSuspenseFallback label="Loading account statement…" />}>
                <AccountLedgerReportPage
                  startDate={accountStatementStart}
                  endDate={accountStatementEnd}
                  branchId={branchId}
                  branchScopeLabel={accountStatementBranchLabel}
                  initialAccountId={accountStatementPreselectId}
                />
              </Suspense>
            )}
          </div>
        )}

      </div>
      
      <AddEntryV2Host />

      {/* Manual Entry Dialog (legacy) */}
      <ManualEntryDialog 
        isOpen={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
      />

      {/* Pay Courier Modal */}
      <PayCourierModal
        open={payCourierOpen}
        onClose={() => setPayCourierOpen(false)}
        companyId={companyId ?? ''}
        branchId={branchId}
        onSuccess={() => accounting.refreshEntries()}
      />

      {/* Add Account Drawer */}
      <AddAccountDrawer 
        isOpen={isAddAccountOpen} 
        onClose={() => setIsAddAccountOpen(false)}
        onSuccess={async () => {
          await accounting.refreshEntries();
          setIsAddAccountOpen(false);
        }}
      />

      {/* Edit Account Dialog */}
      <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
        <DialogContent className="bg-input-background border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update account information
            </DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <AccountEditForm
              account={editingAccount}
              onSave={async (updates) => {
                try {
                  await accountService.updateAccount(editingAccount.id!, updates);
                  await accounting.refreshEntries();
                  toast.success('Account updated successfully');
                  setIsEditAccountOpen(false);
                  setEditingAccount(null);
                } catch (error: any) {
                  toast.error(`Failed to update account: ${error.message}`);
                }
              }}
              onCancel={() => {
                setIsEditAccountOpen(false);
                setEditingAccount(null);
              }}
            />
        )}
      </DialogContent>
      </Dialog>

      <ControlAccountBreakdownDrawer
        open={!!controlBreakdown}
        onClose={() => setControlBreakdown(null)}
        companyId={companyId ?? ''}
        branchId={branchId}
        account={controlBreakdown?.account ?? null}
        controlKind={controlBreakdown?.kind ?? null}
        formatCurrency={formatCurrency}
        onOpenGlLedger={(a) => setLedgerAccount(a)}
        onNavigate={(view) =>
          setCurrentView(view === 'contacts' ? 'contacts' : 'ar-ap-reconciliation-center')
        }
      />

      {/* Account Ledger View - Full Screen */}
      {ledgerAccount && (
        <AccountLedgerPage
          accountId={ledgerAccount.id}
          accountName={ledgerAccount.name}
          accountCode={ledgerAccount.code}
          accountType={ledgerAccount.type}
          onClose={() => setLedgerAccount(null)}
        />
      )}

      {attachmentsDialogList ? (
        <AttachmentViewer
          attachments={attachmentsDialogList}
          isOpen={!!attachmentsDialogList}
          onClose={() => setAttachmentsDialogList(null)}
        />
      ) : null}

      {/* Transaction Detail Modal (PF-14.3B: pass group entries to show edit trail when opening from grouped row) */}
      {transactionReference && (
        <TransactionDetailModal
          isOpen={!!transactionReference}
          onClose={clearTransactionDetail}
          referenceNumber={transactionReference}
          journalEntryIdHint={transactionJournalEntryIdHint ?? undefined}
          groupEntries={selectedGroupEntries ?? undefined}
          autoLaunchUnifiedEdit={transactionDetailAutoEdit}
          onAutoLaunchUnifiedEditConsumed={() => setTransactionDetailAutoEdit(false)}
          autoOpenPaymentTrace={transactionDetailAutoOpenTrace}
          onAutoOpenPaymentTraceConsumed={() => setTransactionDetailAutoOpenTrace(false)}
          autoScrollToAudit={transactionDetailScrollToAudit}
          onAutoScrollToAuditConsumed={() => setTransactionDetailScrollToAudit(false)}
        />
      )}

      {pendingConfirm ? (
        <TransactionConfirmDialog
          open
          title={pendingConfirm.title}
          description={pendingConfirm.message}
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={confirmPendingJournalAction}
          onCancel={dismissPendingConfirm}
        />
      ) : null}

      {/* Listen for transaction detail events */}
      {typeof window !== 'undefined' && (
        <TransactionDetailListener
          onOpen={(referenceNumber, opts) => {
            openJournalEntryDetail(referenceNumber, opts?.journalEntryId ?? null, null, {
              autoEdit: !!opts?.autoLaunchUnifiedEdit,
            });
          }}
        />
      )}
    </div>
  );
};

// Component to listen for transaction detail events
const TransactionDetailListener: React.FC<{
  onOpen: (ref: string, opts?: { autoLaunchUnifiedEdit?: boolean; journalEntryId?: string }) => void;
}> = ({ onOpen }) => {
  React.useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      const d = event.detail || {};
      if (d.referenceNumber == null || d.referenceNumber === '') return;
      onOpen(String(d.referenceNumber), {
        autoLaunchUnifiedEdit: !!d.autoLaunchUnifiedEdit,
        journalEntryId: d.journalEntryId ? String(d.journalEntryId) : undefined,
      });
    };

    window.addEventListener('openTransactionDetail' as any, handleOpen);
    return () => {
      window.removeEventListener('openTransactionDetail' as any, handleOpen);
    };
  }, [onOpen]);

  return null;
};

// Account Edit Form Component
const AccountEditForm = ({ account, onSave, onCancel }: { account: any; onSave: (updates: any) => Promise<void>; onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    name: account.name || '',
    type: account.type || account.accountType || 'Cash',
    account_type: account.account_type || 'Asset',
    code: account.code || '',
    is_active: account.isActive ?? true,
    is_default_cash: account.is_default_cash ?? false,
    is_default_bank: account.is_default_bank ?? false,
    branch_id: account.branch_id || null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      name: formData.name,
      type: formData.type,
      account_type: formData.account_type,
      code: formData.code,
      is_active: formData.is_active,
      is_default_cash: formData.is_default_cash,
      is_default_bank: formData.is_default_bank,
      branch_id: formData.branch_id || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground mb-2 block">Account Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-card border-border text-foreground"
            required
          />
        </div>
        <div>
          <Label className="text-muted-foreground mb-2 block">Account Code</Label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="bg-card border-border text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-muted-foreground mb-2 block">Account Type *</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Bank">Bank</SelectItem>
              <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-muted-foreground mb-2 block">Category *</Label>
          <Select value={formData.account_type} onValueChange={(value) => setFormData({ ...formData, account_type: value })}>
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="Asset">Asset</SelectItem>
              <SelectItem value="Liability">Liability</SelectItem>
              <SelectItem value="Expense">Expense</SelectItem>
              <SelectItem value="Revenue">Revenue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label className="text-muted-foreground">Active</Label>
        </div>
        {formData.type === 'Cash' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_default_cash}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default_cash: checked })}
            />
            <Label className="text-muted-foreground">Default Cash</Label>
          </div>
        )}
        {formData.type === 'Bank' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_default_bank}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default_bank: checked })}
            />
            <Label className="text-muted-foreground">Default Bank</Label>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white">
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
};