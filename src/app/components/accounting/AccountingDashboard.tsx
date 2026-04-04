import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
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
  TestTube,
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
  RotateCcw,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { cn } from '@/app/components/ui/utils';
import { useAccounting } from '@/app/context/AccountingContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSales } from '@/app/context/SalesContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import type { AccountingEntry } from '@/app/context/AccountingContext';
import { ManualEntryDialog } from './ManualEntryDialog';
import { AccountLedgerView } from './AccountLedgerView';
import { AccountLedgerPage } from './AccountLedgerPage';
import { TransactionDetailModal } from './TransactionDetailModal';
import { AddAccountDrawer } from './AddAccountDrawer';
import { LedgerHub } from './LedgerHub';
import { PayCourierModal } from './PayCourierModal';
import { useSettings } from '@/app/context/SettingsContext';
import { AccountingTestPage } from '@/app/components/test/AccountingTestPage';
import { AddEntryV2 } from './AddEntryV2';
import { useSupabase } from '@/app/context/SupabaseContext';
import { INTEGRITY_LAB_SESSION_KEY } from '@/app/lib/integrityLabConstants';
import { ControlAccountBreakdownDrawer } from './ControlAccountBreakdownDrawer';
import type { ControlAccountBreakdownResult, PartyGlRow } from '@/app/services/controlAccountBreakdownService';
import { fetchControlAccountBreakdown } from '@/app/services/controlAccountBreakdownService';

/** Add Entry: V2 = new default (typed, theme-matched). Set false to use legacy AccountingTestPage. */
const USE_ADD_ENTRY_V2 = true;
import { useGlobalFilter } from '@/app/context/GlobalFilterContext';
import { accountService } from '@/app/services/accountService';
import { toast } from 'sonner';
import { getControlAccountKind } from '@/app/lib/accountControlKind';
import { AccountsHierarchyList } from '@/app/components/accounting/AccountsHierarchyList';
import { useAccountsHierarchyModel } from '@/app/components/accounting/useAccountsHierarchyModel';
import { AccountingDashboardAccountRowMenu } from '@/app/components/accounting/AccountingDashboardAccountRowMenu';
import { ChartOfAccountsPartyDropdown } from '@/app/components/accounting/ChartOfAccountsPartyDropdown';

const StudioCostsTab = lazy(() => import('./StudioCostsTab').then((m) => ({ default: m.StudioCostsTab })));
const DepositsTab = lazy(() => import('./DepositsTab').then((m) => ({ default: m.DepositsTab })));
const CourierReportsTab = lazy(() => import('./CourierReportsTab').then((m) => ({ default: m.CourierReportsTab })));
const DayBookReport = lazy(() => import('@/app/components/reports/DayBookReport').then((m) => ({ default: m.DayBookReport })));
const RoznamchaReport = lazy(() => import('@/app/components/reports/RoznamchaReport').then((m) => ({ default: m.RoznamchaReport })));
const AccountLedgerReportPage = lazy(() => import('@/app/components/reports/AccountLedgerReportPage').then((m) => ({ default: m.AccountLedgerReportPage })));
const AccountingIntegrityTestLab = lazy(() => import('./AccountingIntegrityTestLab'));
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
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

/** Journal list: line amount is stored positive; classify by module/source (sign-based Income/Expense was wrong for all rows). */
function journalRowPresentation(entry: AccountingEntry): {
  typeLabel: string;
  amountClass: string;
  badgeClass: string;
} {
  if (entry.source === 'Reversal') {
    return {
      typeLabel: 'Reversal',
      amountClass: 'text-amber-400',
      badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
  }
  if (entry.module === 'Expenses' || entry.source === 'Expense') {
    return {
      typeLabel: 'Expense',
      amountClass: 'text-red-400',
      badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
  }
  if (entry.module === 'Purchases' || entry.source === 'Purchase') {
    return {
      typeLabel: 'Purchase',
      amountClass: 'text-orange-400',
      badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };
  }
  if (entry.source === 'Sale' || entry.source === 'Payment' || entry.module === 'Sales') {
    return {
      typeLabel: 'Income',
      amountClass: 'text-green-400',
      badgeClass: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
  }
  return {
    typeLabel: 'Journal',
    amountClass: 'text-gray-300',
    badgeClass: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
}
import { Switch } from '@/app/components/ui/switch';

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

export const AccountingDashboard = () => {
  const { canAccessAccounting, canPostAccounting } = useCheckPermission();
  const { modules: settingsModules } = useSettings();
  const accounting = useAccounting();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const { openDrawer, setCurrentView } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { setCurrentModule, startDate: globalStartDate, endDate: globalEndDate } = useGlobalFilter();
  const { formatCurrency } = useFormatCurrency();

  useEffect(() => {
    setCurrentModule('accounting');
  }, [setCurrentModule]);

  const [activeTab, setActiveTab] = useState<'journal_entries' | 'daybook' | 'roznamcha' | 'accounts' | 'ledger' | 'receivables' | 'payables' | 'courier' | 'deposits' | 'studio' | 'account_statements' | 'integrity_lab'>('journal_entries');
  /** Align Account Statements period with global header filter when set (same idea as Day Book / Roznamcha). */
  const reportStartDate = useMemo(() => {
    const g = globalStartDate && String(globalStartDate).trim();
    if (g) return g.slice(0, 10);
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, [globalStartDate]);
  const reportEndDate = useMemo(() => {
    const g = globalEndDate && String(globalEndDate).trim();
    if (g) return g.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }, [globalEndDate]);

  const accountStatementBranchLabel =
    !branchId || branchId === 'all' ? 'All branches' : 'Current session branch';
  
  // UI-only view mode: Operational (day-to-day accounts) vs Professional (full Chart of Accounts)
  const [accountsViewMode, setAccountsViewMode] = useState<'operational' | 'professional'>('operational');
  const [showSubAccounts, setShowSubAccounts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  
  // 🎯 Add Entry flow (type selector + modals, same as Accounting Test page)
  const [addEntryFlowOpen, setAddEntryFlowOpen] = useState(false);
  const [addEntryInitialType, setAddEntryInitialType] = useState<import('./AddEntryV2').AddEntryV2Type | undefined>(undefined);
  // Legacy manual-entry-only dialog (kept for any direct use)
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  
  // 🎯 Account Management State
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [payCourierOpen, setPayCourierOpen] = useState(false);
  /** Parent row id → collapsed (children hidden). Empty = all groups expanded. */
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
  }>({ loading: false, error: null, rows: [] });
  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  /** PF-14.3B: When opening a grouped journal row, pass all entries in the group for the detail trail. */
  const [selectedGroupEntries, setSelectedGroupEntries] = useState<AccountingEntry[] | null>(null);
  /** Open TransactionDetailModal and immediately run unified source-aware edit when true. */
  const [transactionDetailAutoEdit, setTransactionDetailAutoEdit] = useState(false);
  /** PF-14.3B: Default = grouped (one logical row per sale); audit = all raw JEs. */
  const [journalViewMode, setJournalViewMode] = useState<'grouped' | 'audit'>('grouped');
  
  // Ledger: type chosen from dropdown (no inner Ledger dropdown on page)
  const [ledgerType, setLedgerType] = useState<'customer' | 'supplier' | 'user' | 'worker'>('customer');
  
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

  useEffect(() => {
    const handleOpenAddEntryV2 = (event: Event) => {
      const d = (event as CustomEvent).detail || {};
      const requested = d.entryType as import('./AddEntryV2').AddEntryV2Type | undefined;
      setAddEntryInitialType(requested);
      setActiveTab('journal_entries');
      setAddEntryFlowOpen(true);
    };
    window.addEventListener('openAddEntryV2', handleOpenAddEntryV2 as EventListener);
    return () => window.removeEventListener('openAddEntryV2', handleOpenAddEntryV2 as EventListener);
  }, []);
  
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

  const { hierarchyRows } = useAccountsHierarchyModel(
    accounting.accounts,
    transactions,
    accountsViewMode,
    showSubAccounts,
    collapsedGroupIds,
    setCollapsedGroupIds
  );

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
    setCoaPartyFetch({ loading: true, error: null, rows: [], note: undefined, controlLabel: label });
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
        setCoaPartyFetch({
          loading: false,
          error: null,
          rows: r.partyRows,
          note: r.partySectionNote,
          controlLabel: label,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setCoaPartyFetch({
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load parties',
          rows: [],
          controlLabel: label,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [coaPartyPanelAccountId, companyId, branchId, accounting.accounts]);

  // Tab configuration: Journal Entries | Day Book | Roznamcha | Accounts | Ledger | Receivables | Payables | Studio Costs | Account Statements
  const allTabs = [
    { key: 'journal_entries', label: 'Journal Entries', icon: Receipt },
    { key: 'daybook', label: 'Day Book', icon: List },
    { key: 'roznamcha', label: 'Roznamcha', icon: BookMarked },
    { key: 'accounts', label: 'Accounts', icon: Wallet },
    { key: 'ledger', label: 'Party statements', icon: FileText },
    { key: 'receivables', label: 'Receivables', icon: TrendingUp },
    { key: 'payables', label: 'Payables', icon: TrendingDown },
    { key: 'courier', label: 'Courier Reports', icon: Truck },
    { key: 'deposits', label: 'Deposits', icon: Shield, isHidden: !settingsModules.rentalModuleEnabled },
    { key: 'studio', label: 'Studio Costs', icon: Wrench, isHidden: !settingsModules.studioModuleEnabled },
    { key: 'account_statements', label: 'Account Statements', icon: BarChart3 },
    { key: 'integrity_lab', label: 'Integrity Test Lab', icon: TestTube },
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
      const raw = sessionStorage.getItem(INTEGRITY_LAB_SESSION_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as {
        tab?: typeof activeTab;
        ledgerType?: typeof ledgerType;
        searchTerm?: string;
      };
      if (o.tab) setActiveTab(o.tab);
      if (o.ledgerType) setLedgerType(o.ledgerType);
      if (o.searchTerm) setSearchTerm(o.searchTerm);
      sessionStorage.removeItem(INTEGRITY_LAB_SESSION_KEY);
      if (o.searchTerm) {
        toast.info(`Filtered journal search: ${o.searchTerm.slice(0, 8)}…`);
      }
    } catch {
      sessionStorage.removeItem(INTEGRITY_LAB_SESSION_KEY);
    }
  }, []);

  // Filter transactions based on search and filters
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(txn =>
        txn.referenceNo.toLowerCase().includes(search) ||
        txn.description.toLowerCase().includes(search) ||
        txn.module.toLowerCase().includes(search) ||
        txn.debitAccount.toLowerCase().includes(search) ||
        txn.creditAccount.toLowerCase().includes(search) ||
        txn.createdBy.toLowerCase().includes(search)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(txn => {
        if (typeFilter === 'expense') return txn.source === 'Expense';
        if (typeFilter === 'sale') return txn.source === 'Sale';
        if (typeFilter === 'purchase') return txn.source === 'Purchase';
        if (typeFilter === 'payment') return txn.source === 'Payment';
        return true;
      });
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
    const keyToEntries = new Map<string, AccountingEntry[]>();
    for (const t of filteredTransactions) {
      const rt = t.metadata?.rootReferenceType ?? t.metadata?.referenceType;
      const ri = t.metadata?.rootReferenceId ?? t.metadata?.referenceId;
      const key = rt && ri ? `${rt}:${ri}` : `single:${t.id}`;
      if (!keyToEntries.has(key)) keyToEntries.set(key, []);
      keyToEntries.get(key)!.push(t);
    }
    const groups: JournalGroup[] = [];
    keyToEntries.forEach((entries, rootKey) => {
      const primary =
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'sale') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'purchase') ??
        entries.find((e) => (e.metadata?.referenceType ?? '') === 'payment') ??
        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      groups.push({ rootKey, primary, entries });
    });
    groups.sort((a, b) => new Date(b.primary.date).getTime() - new Date(a.primary.date).getTime());
    return groups;
  }, [filteredTransactions]);

  // Sorted list for display: default date+time desc; column header sort applies to both grouped and audit
  const sortedGroupedRows = useMemo(() => {
    const dir = journalSortDir === 'asc' ? 1 : -1;
    return [...groupedJournalRows].sort((a, b) => {
      const va = getEntrySortValue(a.primary, journalSortKey);
      const vb = getEntrySortValue(b.primary, journalSortKey);
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
      <div className="h-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 mx-auto text-amber-500/60 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
          <p className="text-gray-400 text-sm">You do not have permission to view Accounting. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  // Ledger full screen – same page, dropdown se select karne par full screen overlay
  if (activeTab === 'ledger') {
    return (
      <div className="fixed inset-0 z-50 bg-[#111827] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0F1419]">
          <h2 className="text-lg font-semibold text-white">
            {ledgerType === 'customer' ? 'Customer Ledger' : ledgerType === 'supplier' ? 'Supplier Ledger' : ledgerType === 'user' ? 'User Ledger' : 'Worker Ledger'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => setActiveTab('journal_entries')}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6">
          <LedgerHub ledgerType={ledgerType} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19] overflow-hidden">
      {/* Page Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 bg-[#0F1419]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Accounting</h1>
            <p className="text-sm text-gray-400 mt-0.5">Financial transactions and reporting</p>
          </div>
          {canAccessAccounting && canPostAccounting && activeTab === 'journal_entries' && (
            <Button 
              onClick={() => {
                setAddEntryInitialType(undefined);
                setAddEntryFlowOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2 shadow-lg shadow-blue-900/30"
            >
              <Plus size={16} />
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-5 gap-4">
          {/* Total Income */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Income</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(summary.totalIncome)}</p>
                <p className="text-xs text-gray-500 mt-1">GL derived (journal lines)</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp size={24} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Total Expense */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Expense</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(summary.totalExpense)}</p>
                <p className="text-xs text-gray-500 mt-1">GL derived (journal lines)</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <TrendingDown size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Net Profit</p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  summary.netProfit >= 0 ? "text-green-400" : "text-red-400"
                )}>{formatCurrency(summary.netProfit)}</p>
                <p className="text-xs text-gray-500 mt-1">GL derived (Income - Expense)</p>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                summary.netProfit >= 0 ? "bg-green-500/10" : "bg-red-500/10"
              )}>
                <DollarSign size={24} className={summary.netProfit >= 0 ? "text-green-500" : "text-red-500"} />
              </div>
            </div>
          </div>

          {/* Receivables */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Receivables</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(summary.totalReceivable)}</p>
                <p className="text-xs text-gray-500 mt-1">GL derived (AR journal legs)</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Users size={24} className="text-blue-500" />
              </div>
            </div>
          </div>

          {/* Payables */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Payables</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(summary.totalPayable)}</p>
                <p className="text-xs text-gray-500 mt-1">GL derived (AP/worker payable legs)</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Building2 size={24} className="text-orange-500" />
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-600 mt-3 max-w-6xl leading-relaxed">
          <span className="font-medium text-gray-500">Semantics map — </span>
          These cards are <span className="text-gray-400">GL journal–derived</span> (revenue/expense accounts and AR/AP control legs). Operational follow-up uses the{' '}
          <span className="text-gray-400">Receivables / Payables</span> tabs (document due: <code className="text-gray-500">sales.due</code> / <code className="text-gray-500">purchases.due</code>). Party operational roll-up (Contacts, executive dashboard AR/AP after migration 20260370) comes from{' '}
          <code className="text-gray-500">get_contact_balances_summary</code>. Compare numbers only within the same source.
        </p>
      </div>

      {/* Tabs – Ledger is dropdown only (no page change on click; select option → same page, same UI) */}
      <div className="shrink-0 px-6 border-b border-gray-800">
        <div className="flex gap-1 -mb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            if (tab.key === 'ledger') {
              return (
                <DropdownMenu key="ledger">
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2",
                        activeTab === 'ledger'
                          ? "text-blue-400 border-blue-400"
                          : "text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700"
                      )}
                    >
                      <FileText size={16} />
                      Ledger
                      <ChevronDown size={14} className="opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-gray-900 border-gray-800">
                    <DropdownMenuItem onClick={() => { setLedgerType('customer'); setActiveTab('ledger'); }}>
                      Customer Ledger
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setLedgerType('supplier'); setActiveTab('ledger'); }}>
                      Supplier Ledger
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setLedgerType('user'); setActiveTab('ledger'); }}>
                      User Ledger
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setLedgerType('worker'); setActiveTab('ledger'); }}>
                      Worker Ledger
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2",
                  activeTab === tab.key
                    ? "text-blue-400 border-blue-400"
                    : "text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700"
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-6 py-4 bg-[#0B0F19]">
        {activeTab === 'journal_entries' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-white">Journal Entries</h3>
                <p className="text-sm text-gray-400">
                  {journalViewMode === 'grouped'
                    ? 'One row per document (e.g. sale); open a row to see original + edit adjustments.'
                    : 'All raw journal entries – audit view.'}
                  {' '}(50 per page).
                  {canPostAccounting ? ' Manual correction: use Reverse to create a reversal entry, or Manual Entry for adjustments.' : ' Posting and corrections require Manager or Admin role.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">View:</span>
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

            {/* Journal Entries Table with pagination */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm font-medium">No journal entries yet</p>
                  <p className="text-gray-500 text-xs mt-1">Create a sale, record a payment, or add an entry to see transactions here.</p>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-900 border-b border-gray-800">
                      <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                                className="flex items-center gap-1 w-full group hover:text-gray-300 transition-colors focus:outline-none focus:ring-0"
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
                            const referenceNumber = entry.referenceNo || (entry.metadata as any)?.paymentId?.substring(0, 8) || entry.id?.substring(0, 8) || 'N/A';
                            const module = entry.module || 'Accounting';
                            const amount = entry.amount || 0;
                            const paymentMethod = (entry.metadata as any)?.paymentMethod || 'N/A';
                            const pres = journalRowPresentation(entry);
                            const isReversal = entry.source === 'Reversal';
                            const adjustmentCount = group.entries.length > 1 ? group.entries.length - 1 : 0;
                            return (
                              <tr
                                key={group.rootKey}
                                className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                                onClick={() => {
                                  setTransactionDetailAutoEdit(false);
                                  setTransactionReference(referenceNumber);
                                  setSelectedGroupEntries(group.entries);
                                }}
                              >
                                <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                                  {entry.date ? (
                                    <div className="flex flex-col gap-0.5">
                                      <DateTimeDisplay date={entry.date} dateOnly className="text-gray-300" />
                                      {(entry.metadata as { createdAt?: string } | undefined)?.createdAt ? (
                                        <span className="text-[10px] text-gray-600">
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTransactionDetailAutoEdit(false);
                                      setTransactionReference(referenceNumber);
                                      setSelectedGroupEntries(group.entries);
                                    }}
                                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium"
                                  >
                                    {referenceNumber}
                                    {adjustmentCount > 0 && (
                                      <span className="ml-1.5 text-gray-500 font-normal">(+{adjustmentCount})</span>
                                    )}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                    {module}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                                  {entry.description || 'No description'}
                                  {adjustmentCount > 0 && (
                                    <span className="text-gray-500 ml-1">(edit trail)</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={pres.badgeClass}>
                                    {pres.typeLabel}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-400 capitalize">{paymentMethod}</td>
                                <td className={cn('px-4 py-3 text-sm font-semibold text-right tabular-nums', pres.amountClass)}>
                                  {formatCurrency(Math.abs(amount))}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">{entry.source || 'Manual'}</td>
                                <td className="px-4 py-3 text-sm text-gray-300 tabular-nums">{group.entries.length}</td>
                                <td className="px-4 py-3">
                                  <Badge
                                    className={
                                      isReversal
                                        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 text-xs'
                                        : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25 text-xs'
                                    }
                                  >
                                    {isReversal ? 'Reversal' : 'Posted'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400 max-w-[180px]" title={`Debit: ${entry.debitAccount} → Credit: ${entry.creditAccount}`}>
                                  <span className="text-gray-500">Debit:</span> {entry.debitAccount}
                                  <span className="text-gray-600 mx-1">→</span>
                                  <span className="text-blue-400 font-medium">Credit: {entry.creditAccount}</span>
                                </td>
                                {canPostAccounting && (
                                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {!isReversal && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-gray-300 hover:text-white hover:bg-gray-800/80"
                                            onClick={() => {
                                              setSelectedGroupEntries(group.entries);
                                              setTransactionDetailAutoEdit(false);
                                              setTransactionReference(entry.referenceNo || entry.id);
                                            }}
                                            title="Open journal detail (read-only)"
                                          >
                                            <Eye className="w-4 h-4 mr-1" />
                                            View
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                            onClick={() => {
                                              setSelectedGroupEntries(group.entries);
                                              setTransactionDetailAutoEdit(true);
                                              setTransactionReference(entry.id);
                                            }}
                                            title="Open unified editor (same as transaction detail)"
                                          >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                            onClick={() => {
                                              if (
                                                window.confirm(
                                                  'Create a reversal entry for this journal entry? This will post a new entry that offsets the original.'
                                                )
                                              ) {
                                                accounting.createReversalEntry(entry.id);
                                              }
                                            }}
                                            title="Create reversal (manual correction)"
                                          >
                                            <RotateCcw className="w-4 h-4 mr-1" />
                                            Reverse
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        : (paginatedJournalEntries as AccountingEntry[]).map((entry) => {
                            const referenceNumber = entry.referenceNo || (entry.metadata as any)?.paymentId?.substring(0, 8) || entry.id?.substring(0, 8) || 'N/A';
                            const module = entry.module || 'Accounting';
                            const amount = entry.amount || 0;
                            const paymentMethod = (entry.metadata as any)?.paymentMethod || 'N/A';
                            const pres = journalRowPresentation(entry);
                            const isReversal = entry.source === 'Reversal';
                            return (
                              <tr
                                key={entry.id}
                                className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                                onClick={() => {
                                  setTransactionDetailAutoEdit(false);
                                  setTransactionReference(referenceNumber);
                                  setSelectedGroupEntries(null);
                                }}
                              >
                                <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                                  {entry.date ? (
                                    <div className="flex flex-col gap-0.5">
                                      <DateTimeDisplay date={entry.date} dateOnly className="text-gray-300" />
                                      {(entry.metadata as { createdAt?: string } | undefined)?.createdAt ? (
                                        <span className="text-[10px] text-gray-600">
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
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTransactionDetailAutoEdit(false);
                                      setTransactionReference(referenceNumber);
                                      setSelectedGroupEntries(null);
                                    }}
                                    className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium"
                                  >
                                    {referenceNumber}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                    {module}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">
                                  {entry.description || 'No description'}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={pres.badgeClass}>
                                    {pres.typeLabel}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-400 capitalize">{paymentMethod}</td>
                                <td className={cn('px-4 py-3 text-sm font-semibold text-right tabular-nums', pres.amountClass)}>
                                  {formatCurrency(Math.abs(amount))}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400">{entry.source || 'Manual'}</td>
                                <td className="px-4 py-3 text-sm text-gray-300 tabular-nums">1</td>
                                <td className="px-4 py-3">
                                  <Badge
                                    className={
                                      isReversal
                                        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30 text-xs'
                                        : 'bg-emerald-500/10 text-emerald-200 border-emerald-500/25 text-xs'
                                    }
                                  >
                                    {isReversal ? 'Reversal' : 'Posted'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-400 max-w-[180px]" title={`Debit: ${entry.debitAccount} → Credit: ${entry.creditAccount}`}>
                                  <span className="text-gray-500">Debit:</span> {entry.debitAccount}
                                  <span className="text-gray-600 mx-1">→</span>
                                  <span className="text-blue-400 font-medium">Credit: {entry.creditAccount}</span>
                                </td>
                                {canPostAccounting && (
                                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex flex-wrap items-center gap-1">
                                      {!isReversal && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-gray-300 hover:text-white hover:bg-gray-800/80"
                                            onClick={() => {
                                              setSelectedGroupEntries(null);
                                              setTransactionDetailAutoEdit(false);
                                              setTransactionReference(entry.referenceNo || entry.id);
                                            }}
                                            title="Open journal detail (read-only)"
                                          >
                                            <Eye className="w-4 h-4 mr-1" />
                                            View
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                            onClick={() => {
                                              setSelectedGroupEntries(null);
                                              setTransactionDetailAutoEdit(true);
                                              setTransactionReference(entry.id);
                                            }}
                                            title="Open unified editor (same as transaction detail)"
                                          >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                            onClick={() => {
                                              if (
                                                window.confirm(
                                                  'Create a reversal entry for this journal entry? This will post a new entry that offsets the original.'
                                                )
                                              ) {
                                                accounting.createReversalEntry(entry.id);
                                              }
                                            }}
                                            title="Create reversal (manual correction)"
                                          >
                                            <RotateCcw className="w-4 h-4 mr-1" />
                                            Reverse
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
                {totalJournalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-900/80">
                    <p className="text-xs text-gray-400">
                      Showing {(currentPage - 1) * JOURNAL_PAGE_SIZE + 1}–{Math.min(currentPage * JOURNAL_PAGE_SIZE, listForPagination.length)} of {listForPagination.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-gray-700 text-gray-300"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalJournalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalJournalPages || Math.abs(p - currentPage) <= 2)
                        .map((p, idx, arr) => (
                          <React.Fragment key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-500">…</span>}
                            <button
                              type="button"
                              className={cn(
                                'h-8 min-w-[2rem] rounded px-2 text-sm font-medium',
                                p === currentPage ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
                        className="h-8 border-gray-700 text-gray-300"
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
            <h3 className="text-lg font-bold text-white">Day Book (Journal)</h3>
            <p className="text-sm text-gray-400 mb-4">Click voucher number to open transaction detail</p>
            <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
              <DayBookReport
                onVoucherClick={(voucher) => {
                  setTransactionDetailAutoEdit(false);
                  setTransactionReference(voucher);
                }}
                onEditJournalEntry={(journalEntryId) => {
                  setSelectedGroupEntries(null);
                  setTransactionDetailAutoEdit(true);
                  setTransactionReference(journalEntryId);
                }}
                globalStartDate={globalStartDate}
                globalEndDate={globalEndDate}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'roznamcha' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Roznamcha (Daily Cash Book)</h3>
            <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
              <RoznamchaReport
                globalStartDate={globalStartDate}
                globalEndDate={globalEndDate}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {/* Header with Mode Toggle & Create Button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Accounts</h3>
                <p className="text-sm text-gray-400">
                  {accountsViewMode === 'operational'
                    ? 'Operational View: Cash, Bank, Wallet, expense/income, AR/AP, worker payables & advances — party names on sub-accounts'
                    : 'Professional View: Full Chart of Accounts'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-1.5">
                  <button
                    onClick={() => setAccountsViewMode('operational')}
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded transition-colors",
                      accountsViewMode === 'operational'
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:text-gray-300"
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
                        : "text-gray-400 hover:text-gray-300"
                    )}
                  >
                    Professional
                  </button>
                  {accountsViewMode === 'professional' && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSubAccounts}
                        onChange={(e) => setShowSubAccounts(e.target.checked)}
                        className="rounded border-gray-600 bg-gray-800 text-blue-500"
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
              <div className="rounded-xl border border-gray-800 bg-gray-900/50 text-center py-12">
                <Wallet size={48} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No accounts found</p>
                <p className="text-gray-600 text-xs mt-1">Create your first account to get started</p>
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
                renderRowInlineExtra={(row) => {
                  const account = row.account;
                  const ck = getControlAccountKind({ name: account.name, code: (account as { code?: string }).code });
                  const linkedName = (account as { linked_contact_name?: string | null }).linked_contact_name;
                  const showPartyToggle = Boolean(account.id && (ck || linkedName));
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
                  const partyBtn = showPartyToggle ? (
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
                          : 'text-gray-400 hover:bg-gray-800 hover:text-violet-200 border-gray-700/80'
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
                    return (
                      <ChartOfAccountsPartyDropdown
                        formatCurrency={formatCurrency}
                        onCollapse={() => setCoaPartyPanelAccountId(null)}
                        loading={coaPartyFetch.loading}
                        error={coaPartyFetch.error}
                        partyRows={coaPartyFetch.rows}
                        partySectionNote={coaPartyFetch.note}
                        scopeLabel={coaPartyFetch.controlLabel}
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
                    onOpenAccountStatements={() => setActiveTab('account_statements')}
                  />
                )}
              />
            )}
          </div>
        )}

        {activeTab === 'receivables' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 text-[11px] text-gray-500">
              Source: operational document due (`sales.due`) for invoice follow-up
            </div>
            {sales.sales.filter(s => s.due > 0).length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp size={48} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No receivables</p>
                <p className="text-gray-600 text-xs mt-1">All customers are paid up</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-800">
                    <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                          className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-300 font-medium">
                            {sale.customerName}
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-400 font-mono">
                            {sale.invoiceNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {new Date(sale.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300 text-right">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-400 text-right">
                            {formatCurrency(sale.paid)}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400 font-semibold text-right">
                            {formatCurrency(sale.due)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge className={
                              sale.paymentStatus === 'paid' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/30'
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
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm text-gray-400">Supplier & Courier payables</span>
              {canPostAccounting && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white gap-1.5"
                  onClick={() => setPayCourierOpen(true)}
                >
                  <Truck size={14} />
                  Pay Courier
                </Button>
              )}
            </div>
            <div className="px-4 py-2 border-b border-gray-800 text-[11px] text-gray-500">
              Source: operational document due (`purchases.due`) for vendor settlement workflow
            </div>
            {purchases.purchases.filter(p => p.due > 0).length === 0 ? (
              <div className="text-center py-12">
                <TrendingDown size={48} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No payables</p>
                <p className="text-gray-600 text-xs mt-1">All suppliers are paid up</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900 border-b border-gray-800">
                    <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                          className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-300 font-medium">
                            {purchase.supplierName}
                          </td>
                          <td className="px-4 py-3 text-sm text-blue-400 font-mono">
                            {purchase.purchaseNo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {new Date(purchase.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300 text-right">
                            {formatCurrency(purchase.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-400 text-right">
                            {formatCurrency(purchase.paid)}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400 font-semibold text-right">
                            {formatCurrency(purchase.due)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge className={
                              purchase.paymentStatus === 'paid' 
                                ? 'bg-green-500/10 text-green-400 border-green-500/30'
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
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
            <CourierReportsTab />
          </Suspense>
        )}

        {activeTab === 'deposits' && settingsModules.rentalModuleEnabled && (
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
            <DepositsTab />
          </Suspense>
        )}

        {activeTab === 'studio' && (
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
            <StudioCostsTab />
          </Suspense>
        )}

        {activeTab === 'account_statements' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Account Statements</h3>
            <p className="text-sm text-gray-400 mb-4">Account-wise ledger / statement by date range</p>
            <div className="text-xs text-gray-500 mb-2">Period: {reportStartDate} to {reportEndDate}</div>
            <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
              <AccountLedgerReportPage
                startDate={reportStartDate}
                endDate={reportEndDate}
                branchId={branchId}
                branchScopeLabel={accountStatementBranchLabel}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'integrity_lab' && (
          <Suspense fallback={<div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>}>
            <AccountingIntegrityTestLab />
          </Suspense>
        )}
      </div>
      
      {/* Add Entry flow: V2 (default) or legacy */}
      {addEntryFlowOpen && USE_ADD_ENTRY_V2 && (
        <AddEntryV2
          initialEntryType={addEntryInitialType}
          onClose={() => {
            setAddEntryFlowOpen(false);
            setAddEntryInitialType(undefined);
            accounting.refreshEntries();
          }}
        />
      )}
      {addEntryFlowOpen && !USE_ADD_ENTRY_V2 && (
        <AccountingTestPage
          embedded
          onClose={() => {
            setAddEntryFlowOpen(false);
            accounting.refreshEntries();
          }}
        />
      )}

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
        <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription className="text-gray-400">
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

      {/* Transaction Detail Modal (PF-14.3B: pass group entries to show edit trail when opening from grouped row) */}
      {transactionReference && (
        <TransactionDetailModal
          isOpen={!!transactionReference}
          onClose={() => {
            setTransactionReference(null);
            setSelectedGroupEntries(null);
            setTransactionDetailAutoEdit(false);
          }}
          referenceNumber={transactionReference}
          groupEntries={selectedGroupEntries ?? undefined}
          autoLaunchUnifiedEdit={transactionDetailAutoEdit}
          onAutoLaunchUnifiedEditConsumed={() => setTransactionDetailAutoEdit(false)}
        />
      )}

      {/* Listen for transaction detail events */}
      {typeof window !== 'undefined' && (
        <TransactionDetailListener
          onOpen={(referenceNumber, opts) => {
            setTransactionReference(referenceNumber);
            setSelectedGroupEntries(null);
            setTransactionDetailAutoEdit(!!opts?.autoLaunchUnifiedEdit);
          }}
        />
      )}
    </div>
  );
};

// Component to listen for transaction detail events
const TransactionDetailListener: React.FC<{
  onOpen: (ref: string, opts?: { autoLaunchUnifiedEdit?: boolean }) => void;
}> = ({ onOpen }) => {
  React.useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      const d = event.detail || {};
      if (d.referenceNumber == null || d.referenceNumber === '') return;
      onOpen(String(d.referenceNumber), { autoLaunchUnifiedEdit: !!d.autoLaunchUnifiedEdit });
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
          <Label className="text-gray-300 mb-2 block">Account Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="bg-gray-900 border-gray-700 text-white"
            required
          />
        </div>
        <div>
          <Label className="text-gray-300 mb-2 block">Account Code</Label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            className="bg-gray-900 border-gray-700 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-300 mb-2 block">Account Type *</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 text-white">
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Bank">Bank</SelectItem>
              <SelectItem value="Mobile Wallet">Mobile Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-gray-300 mb-2 block">Category *</Label>
          <Select value={formData.account_type} onValueChange={(value) => setFormData({ ...formData, account_type: value })}>
            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700 text-white">
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
          <Label className="text-gray-300">Active</Label>
        </div>
        {formData.type === 'Cash' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_default_cash}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default_cash: checked })}
            />
            <Label className="text-gray-300">Default Cash</Label>
          </div>
        )}
        {formData.type === 'Bank' && (
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_default_bank}
              onCheckedChange={(checked) => setFormData({ ...formData, is_default_bank: checked })}
            />
            <Label className="text-gray-300">Default Bank</Label>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} className="text-gray-400 hover:text-white">
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white">
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
};