import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Receipt, 
  Calendar, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  MoreVertical,
  Eye,
  Pencil,
  Trash,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Clock
} from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { AddExpenseDrawer } from './AddExpenseDrawer';
import { AddCategoryModal } from './AddCategoryModal';
import { ExpenseCategoryTreePanel } from './ExpenseCategoryTreePanel';
import { ExpenseDetailSheet } from './ExpenseDetailSheet';
import { expenseMatchesMainFilter, findPathToCategory, formatCategoryPathFromNodes } from '@/app/lib/expenseCategoryTreeUtils';
import { PENDING_EXPENSE_OPEN_KEY } from '@/app/lib/notificationNavConstants';
import {
  safeSessionStorageGetItem,
  safeSessionStorageRemoveItem,
} from '@/app/lib/safeBrowserStorage';
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { toast } from "sonner";
import { Building2, Zap, Users, ShoppingCart, Briefcase, Utensils, Car, Wallet, Home } from 'lucide-react';
import { ListToolbar } from '../ui/list-toolbar';
import { DatePicker } from '../ui/DatePicker';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { exportToCSV, exportToExcel, exportToPDF, type ExportData } from '@/app/utils/exportUtils';
import { useExpenses } from '../../context/ExpenseContext';
import { useAccounting } from '../../context/AccountingContext';
import { useSupabase } from '../../context/SupabaseContext';
import { expenseCategoryService, type ExpenseCategoryRow, type ExpenseCategoryTreeItem } from '../../services/expenseCategoryService';
import { expenseService } from '../../services/expenseService';
import { branchService } from '../../services/branchService';
import { normalizeCategoryForComparison } from '@/app/lib/expenseEditCanonical';
import {
  expenseDeleteOrCancelLabel,
  isPostedExpenseStatus,
} from '@/app/lib/expenseCancelPolicy';
import {
  EXPENSE_LIST_TRACE,
  isExpenseListDiagnosticsEnabled,
  logExpenseListTrace,
  setExpenseListDiagnosticsEnabled,
} from '@/app/lib/expenseListDiagnostics';

function isInCurrentCalendarMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function paymentDisplayForExpense(expense: { paymentAccountDisplay?: string; paymentMethod?: string }): string {
  return expense.paymentAccountDisplay || expense.paymentMethod || '—';
}

const getCategoryBadgeStyle = (category: string) => {
  switch (category) {
    case 'Rent': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Salaries': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Utilities': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'Stitching': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'approved': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

const ICON_BY_SLUG: Record<string, React.ComponentType<{ size?: number }>> = {
  Zap, Users, Car, Building2, Utensils, Wallet, Briefcase, Home, ShoppingCart,
  Other: Wallet,
};

export const ExpensesDashboard = () => {
  const { formatCurrency } = useFormatCurrency();
  const { companyId } = useSupabase();
  const { expenses, loading, deleteExpense, cancelExpense, refreshExpenses } = useExpenses();
  const { accounts } = useAccounting();
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'categories'>('overview');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryRow | null>(null);
  const [categoryModalParentId, setCategoryModalParentId] = useState<string | null>(null);
  const [categoriesFromDb, setCategoriesFromDb] = useState<ExpenseCategoryTreeItem[]>([]);

  // List filtering states (declared before hooks that depend on them)
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const loadCategoriesFromDb = React.useCallback(() => {
    if (!companyId) return;
    expenseCategoryService.getTree(companyId).then(setCategoriesFromDb).catch(() => setCategoriesFromDb([]));
  }, [companyId]);

  useEffect(() => {
    loadCategoriesFromDb();
  }, [loadCategoriesFromDb]);

  useEffect(() => {
    if (!companyId) return;
    branchService.getBranchesCached(companyId).then(setBranches).catch(() => setBranches([]));
  }, [companyId]);

  useEffect(() => {
    setSubCategoryFilter('all');
  }, [categoryFilter]);

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((b) => {
      const label = b.code ? `${b.code} | ${b.name}` : b.name;
      map.set(b.id, label);
    });
    return map;
  }, [branches]);

  const resolveExpenseBranchLabel = useCallback(
    (location?: string) => {
      if (!location) return '—';
      return branchNameById.get(location) || location;
    },
    [branchNameById]
  );

  const subCategoryFilterOptions = useMemo(() => {
    if (categoryFilter === 'all') return [];
    const main = categoriesFromDb.find((m) => m.name === categoryFilter);
    return main?.children ?? [];
  }, [categoryFilter, categoriesFromDb]);

  // 🎯 NEW: Action States
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  useEffect(() => {
    try {
      const pendingId = safeSessionStorageGetItem(PENDING_EXPENSE_OPEN_KEY);
      if (!pendingId || expenses.length === 0) return;
      const match = expenses.find((e) => e.id === pendingId);
      safeSessionStorageRemoveItem(PENDING_EXPENSE_OPEN_KEY);
      if (match) {
        setActiveTab('list');
        setSelectedExpense(match);
        setIsDrawerOpen(true);
      }
    } catch {
      safeSessionStorageRemoveItem(PENDING_EXPENSE_OPEN_KEY);
    }
  }, [expenses]);
  /** Expense documents whose GL posting was reversed (correction_reversal on the expense JE). */
  const [reversedExpenseIds, setReversedExpenseIds] = useState<Set<string>>(() => new Set());
  const [showReversedExpenses, setShowReversedExpenses] = useState(false);
  const [showFetchDiagnostics, setShowFetchDiagnostics] = useState(() => isExpenseListDiagnosticsEnabled());
  const [diagnosticWatchId, setDiagnosticWatchId] = useState('');

  useEffect(() => {
    if (!companyId || expenses.length === 0) {
      setReversedExpenseIds(new Set());
      return;
    }
    const ids = expenses.map((e) => e.id);
    expenseService
      .getReversedExpenseIds(companyId, ids)
      .then(setReversedExpenseIds)
      .catch(() => setReversedExpenseIds(new Set()));
  }, [companyId, expenses]);

  const operationalExpenses = useMemo(() => {
    if (showReversedExpenses) return expenses;
    return expenses.filter((e) => !reversedExpenseIds.has(e.id));
  }, [expenses, reversedExpenseIds, showReversedExpenses]);

  const monthExpenses = useMemo(
    () => operationalExpenses.filter((e) => isInCurrentCalendarMonth(e.date)),
    [operationalExpenses],
  );

  const accountFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    operationalExpenses.forEach((e) => {
      const id = e.paymentAccountId;
      if (id) {
        const acc = accounts.find((a) => a.id === id);
        byId.set(id, e.paymentAccountDisplay || (acc ? `${acc.code} — ${acc.name}` : id));
      }
    });
    return [...byId.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [operationalExpenses, accounts]);

  const monthCategoryBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; count: number; amount: number; categoryFilter: string }>();
    monthExpenses.forEach((e) => {
      const catId = (e as { expense_category_id?: string }).expense_category_id;
      const pathNodes = catId ? findPathToCategory(categoriesFromDb, catId) : null;
      const label = pathNodes?.length
        ? formatCategoryPathFromNodes(pathNodes)
        : (e.category || 'Other');
      const key = catId || label;
      const existing = map.get(key) || {
        label,
        count: 0,
        amount: 0,
        categoryFilter: pathNodes?.[0]?.name || e.category || 'Other',
      };
      existing.count += 1;
      existing.amount += e.amount || 0;
      map.set(key, existing);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [monthExpenses, categoriesFromDb]);

  const priorMonthTotal = useMemo(() => {
    const now = new Date();
    const priorMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const priorYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return operationalExpenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === priorYear && d.getMonth() === priorMonth;
      })
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [operationalExpenses]);

  const monthTotal = useMemo(
    () => monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [monthExpenses],
  );

  const selectedExpenseCategoryPath = useMemo(() => {
    if (!selectedExpense) return undefined;
    const catId = (selectedExpense as { expense_category_id?: string }).expense_category_id;
    const path = catId ? findPathToCategory(categoriesFromDb, catId) : null;
    return path?.length ? formatCategoryPathFromNodes(path) : undefined;
  }, [selectedExpense, categoriesFromDb]);

  // 🎯 NEW: Action Handlers
  const handleExpenseAction = (expense: any, action: string) => {
    setSelectedExpense(expense);
    
    switch(action) {
      case 'view':
        setViewDetailsOpen(true);
        break;
      case 'edit':
        setIsDrawerOpen(true);
        // Pre-fill form with expense data
        break;
      case 'delete':
        setDeleteAlertOpen(true);
        break;
      default:
        console.log('Action:', action, expense);
    }
  };
  
  const handleDeleteExpense = async () => {
    if (!selectedExpense) return;
    const posted = isPostedExpenseStatus(selectedExpense.status);
    try {
      if (posted) {
        await cancelExpense(selectedExpense.id);
        toast.success(`Expense "${selectedExpense.expenseNo || selectedExpense.id}" cancelled — audit trail kept.`);
      } else {
        await deleteExpense(selectedExpense.id);
        toast.success(`Expense "${selectedExpense.expenseNo || selectedExpense.id}" deleted.`);
      }
      await refreshExpenses();
      setDeleteAlertOpen(false);
      setSelectedExpense(null);
    } catch (error: any) {
      console.error('[EXPENSES DASHBOARD] Error removing expense:', error);
      toast.error(
        (posted ? 'Failed to cancel expense: ' : 'Failed to delete expense: ') + (error.message || 'Unknown error')
      );
    }
  };

  const handleEditCategory = (category: ExpenseCategoryRow) => {
    setSelectedCategory(category);
    setCategoryModalParentId(null);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (
    category: ExpenseCategoryRow & { count?: number; children?: ExpenseCategoryTreeItem[] },
  ) => {
    if ((category.children?.length ?? 0) > 0) {
      toast.error(`"${category.name}" has subcategories. Delete or move them first.`);
      return;
    }
    if ((category.count ?? 0) > 0) {
      toast.error(`This category is used in ${category.count} records. Cannot delete.`, {
        description: 'Please reassign or delete the associated expenses first.',
        duration: 4000,
      });
      return;
    }
    if (!category.company_id || !category.id) {
      toast.info('This category is from expense history; add a category in DB to edit/delete.');
      return;
    }
    try {
      await expenseCategoryService.delete(category.id);
      toast.success(`Category "${category.name}" deleted.`);
      loadCategoriesFromDb();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete category');
    }
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setCategoryModalParentId(null);
    setIsCategoryModalOpen(true);
  };

  const handleAddSubCategory = (parentId: string) => {
    setSelectedCategory(null);
    setCategoryModalParentId(parentId);
    setIsCategoryModalOpen(true);
  };

  // Calculate chart data from this month's expenses
  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    monthExpenses.forEach(exp => {
      const catId = (exp as { expense_category_id?: string }).expense_category_id;
      const pathNodes = catId ? findPathToCategory(categoriesFromDb, catId) : null;
      const cat = pathNodes?.length
        ? formatCategoryPathFromNodes(pathNodes)
        : (exp.category || 'Other');
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
    });
    
    const colors = ['#3B82F6', '#8B5CF6', '#F97316', '#9CA3AF', '#10B981', '#EF4444'];
    return Object.entries(categoryTotals)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses, categoriesFromDb]);

  // Total expense amount for Expense Breakdown center display (this month)
  const totalExpenseAmount = useMemo(
    () => monthTotal,
    [monthTotal]
  );

  const categoryFilterOptions = useMemo(() => {
    if (categoriesFromDb.length > 0) {
      return categoriesFromDb.map((m) => ({ id: m.id, name: m.name }));
    }
    const names = new Set<string>();
    operationalExpenses.forEach((exp) => names.add(exp.category || 'Other'));
    return Array.from(names).map((name, index) => ({ id: String(index), name }));
  }, [operationalExpenses, categoriesFromDb]);

  const operationalForCategoryCounts = useMemo(
    () =>
      monthExpenses.map((e) => ({
        category: e.category,
        expense_category_id: (e as { expense_category_id?: string }).expense_category_id,
        amount: e.amount,
      })),
    [monthExpenses],
  );

  // Filtered expenses (search, category, account, date range)
  const filteredExpenses = useMemo(() => {
    return operationalExpenses.filter((expense) => {
      let filterReason: string | undefined;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          (expense.expenseNo || '').toLowerCase().includes(search) ||
          (expense.category || '').toLowerCase().includes(search) ||
          (expense.description || '').toLowerCase().includes(search) ||
          (expense.payeeName || '').toLowerCase().includes(search);
        if (!matchesSearch) filterReason = 'search_term_mismatch';
      }

      // Category filter: sub-category exact match, or main includes its sub-categories
      if (!filterReason && categoryFilter !== 'all') {
        const catId = (expense as { expense_category_id?: string }).expense_category_id;
        if (subCategoryFilter !== 'all') {
          if (catId !== subCategoryFilter) {
            filterReason = `subcategory_filter: expense category id "${catId}" !== "${subCategoryFilter}"`;
          }
        } else {
          const main = categoriesFromDb.find((m) => m.name === categoryFilter);
          if (main) {
            if (!expenseMatchesMainFilter(expense.category, catId, main, categoriesFromDb)) {
              filterReason = `category_filter: not under "${categoryFilter}"`;
            }
          } else if ((expense.category || '') !== categoryFilter) {
            filterReason = `category_filter: list shows "${expense.category}" but filter is "${categoryFilter}"`;
          }
        }
      }

      if (!filterReason && branchFilter !== 'all') {
        if ((expense.location || '') !== branchFilter) {
          filterReason = 'branch_filter_mismatch';
        }
      }

      // Account filter (by payment_account_id)
      if (!filterReason && accountFilter !== 'all') {
        const payId = expense.paymentAccountId;
        if (payId !== accountFilter) filterReason = 'account_filter_mismatch';
      }

      // Date filter (From Date – To Date)
      const expenseDate = expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '';
      if (!filterReason && fromDate && expenseDate < fromDate) filterReason = 'before_from_date';
      if (!filterReason && toDate && expenseDate > toDate) filterReason = 'after_to_date';

      const watch = diagnosticWatchId.trim().toLowerCase();
      const isWatched =
        showFetchDiagnostics &&
        watch &&
        (expense.id.toLowerCase() === watch || (expense.expenseNo || '').toLowerCase() === watch);

      if (isWatched) {
        const inOperational = !reversedExpenseIds.has(expense.id);
        logExpenseListTrace('row pipeline', {
          expenseId: expense.id,
          reference: expense.expenseNo,
          status: expense.status,
          expense_date: expenseDate,
          branchOrLocation: expense.location,
          categoryRaw: expense.category,
          categoryNormalized: normalizeCategoryForComparison(expense.category),
          inOperationalList: inOperational,
          operationalReason: inOperational ? undefined : 'hidden: latest expense JE has active correction_reversal (or no newer JE)',
          passedFilters: !filterReason,
          filterReason: filterReason || null,
        });
      }

      return !filterReason;
    });
  }, [
    operationalExpenses,
    searchTerm,
    categoryFilter,
    subCategoryFilter,
    branchFilter,
    categoriesFromDb,
    accountFilter,
    fromDate,
    toDate,
    showFetchDiagnostics,
    diagnosticWatchId,
    reversedExpenseIds,
  ]);

  // Pagination
  const paginatedExpenses = useMemo(() => {
    if (pageSize === -1) return filteredExpenses;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(startIndex, startIndex + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredExpenses.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, subCategoryFilter, branchFilter, accountFilter, fromDate, toDate, showReversedExpenses]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Active filter count
  const activeFilterCount = [
    categoryFilter !== 'all',
    subCategoryFilter !== 'all',
    branchFilter !== 'all',
    accountFilter !== 'all',
    !!fromDate,
    !!toDate,
    showReversedExpenses,
  ].filter(Boolean).length;

  // Clear filters
  const clearFilters = () => {
    setCategoryFilter('all');
    setSubCategoryFilter('all');
    setBranchFilter('all');
    setAccountFilter('all');
    setFromDate('');
    setToDate('');
    setShowReversedExpenses(false);
  };

  // Bottom summary: total of filtered expenses
  const summaryTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [filteredExpenses]
  );

  // Export handlers (use filtered list from backend)
  const getExportData = (): ExportData => ({
    headers: ['Date', 'Reference #', 'Category', 'Branch', 'Expense For', 'Paid Via', 'Amount', 'Status'],
    rows: filteredExpenses.map((e) => [
      new Date(e.date).toLocaleDateString(),
      e.expenseNo || '—',
      e.category,
      resolveExpenseBranchLabel(e.location),
      e.description,
      paymentDisplayForExpense(e),
      e.amount ?? 0,
      e.status ?? '',
    ]),
    title: 'Expenses',
  });

  const handleExportCSV = () => {
    try { exportToCSV(getExportData(), 'expenses'); toast.success('Expenses exported as CSV'); } catch (e) { toast.error('Export failed'); }
  };

  const handleExportExcel = () => {
    try { exportToExcel(getExportData(), 'expenses'); toast.success('Expenses exported as Excel'); } catch (e) { toast.error('Export failed'); }
  };

  const handleExportPDF = () => {
    try { exportToPDF(getExportData(), 'expenses'); toast.success('PDF opened for print'); } catch (e) { toast.error('Export failed'); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header: title left, Add button right - always same row (like Accounting) */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-800 pb-4 flex-nowrap">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Expenses</h2>
          <p className="text-gray-400 mt-0.5 text-sm">Track and manage business operational costs.</p>
        </div>
        <div className="flex-shrink-0">
          {activeTab === 'categories' ? (
            <Button
              onClick={handleAddCategory}
              className="bg-blue-600 hover:bg-blue-500 text-white h-10 px-4 gap-2 shadow-lg shadow-blue-900/30 whitespace-nowrap"
            >
              <Plus size={18} />
              Add Category
            </Button>
          ) : (
            <Button
              onClick={() => { setSelectedExpense(null); setIsDrawerOpen(true); }}
              className="bg-blue-600 hover:bg-blue-500 text-white h-10 px-4 gap-2 shadow-lg shadow-blue-900/30 whitespace-nowrap"
            >
              <Plus size={18} />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "pb-2 text-sm font-medium transition-all relative",
            activeTab === 'overview' ? "text-blue-400" : "text-gray-400 hover:text-gray-300"
          )}
        >
          Overview
          {activeTab === 'overview' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={cn(
            "pb-2 text-sm font-medium transition-all relative",
            activeTab === 'list' ? "text-blue-400" : "text-gray-400 hover:text-gray-300"
          )}
        >
          All Expenses
          {activeTab === 'list' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={cn(
            "pb-2 text-sm font-medium transition-all relative",
            activeTab === 'categories' ? "text-blue-400" : "text-gray-400 hover:text-gray-300"
          )}
        >
          Categories
          {activeTab === 'categories' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 size={48} className="text-blue-500 animate-spin" />
        </div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Total Monthly Expense</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {formatCurrency(monthTotal)}
                  </h3>
                </div>
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <TrendingUp className="text-red-500" size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="text-gray-500">{monthExpenses.length} expenses this month</span>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Pending Expenses</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {monthExpenses.filter(e => e.status === 'pending' || e.status === 'submitted').length}
                  </h3>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg">
                  <Clock className="text-yellow-500" size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="text-gray-500">Require approval</span>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">vs Prior Month</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {priorMonthTotal > 0
                      ? `${monthTotal >= priorMonthTotal ? '+' : ''}${(((monthTotal - priorMonthTotal) / priorMonthTotal) * 100).toFixed(0)}%`
                      : monthTotal > 0 ? 'New' : '—'}
                  </h3>
                </div>
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  {monthTotal >= priorMonthTotal ? (
                    <TrendingUp className="text-blue-500" size={20} />
                  ) : (
                    <TrendingDown className="text-emerald-500" size={20} />
                  )}
                </div>
              </div>
              <div className="mt-4">
                 {chartData.length > 0 && totalExpenseAmount > 0 && (
                   <>
                     <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(chartData[0].value / totalExpenseAmount) * 100}%` }}></div>
                     </div>
                     <p className="text-gray-500 text-xs mt-2">
                       Top: {chartData[0].name} · {formatCurrency(priorMonthTotal)} prior month
                     </p>
                   </>
                 )}
              </div>
            </div>
          </div>

          {monthCategoryBreakdown.length > 0 ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">This month by category</h3>
                <span className="text-xs text-gray-500">{new Date().toLocaleString('en-PK', { month: 'long', year: 'numeric' })}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase bg-gray-950/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Category</th>
                    <th className="px-6 py-3 text-right font-medium">Count</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {monthCategoryBreakdown.map((row) => (
                    <tr
                      key={row.label}
                      className="hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => {
                        setCategoryFilter(row.categoryFilter);
                        setActiveTab('list');
                      }}
                    >
                      <td className="px-6 py-3 text-white">{row.label}</td>
                      <td className="px-6 py-3 text-right text-gray-400">{row.count}</td>
                      <td className="px-6 py-3 text-right font-medium text-red-400">-{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-800 bg-gray-950/50">
                    <td className="px-6 py-3 font-medium text-gray-400">Total</td>
                    <td className="px-6 py-3 text-right text-gray-400">{monthExpenses.length}</td>
                    <td className="px-6 py-3 text-right font-bold text-white">-{formatCurrency(monthTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}

          {/* Donut Chart Section */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
            <h3 className="text-lg font-bold text-white mb-2 self-start">Expense Breakdown (this month)</h3>
            <div className="h-[300px] w-full max-w-lg relative min-h-[300px] shrink-0">
              <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', borderRadius: '8px' }}
                    itemStyle={{ color: '#F3F4F6' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend 
                     verticalAlign="bottom" 
                     height={36} 
                     iconType="circle"
                     formatter={(value) => <span className="text-gray-400 ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center Text - Real total from database */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                 <p className="text-gray-500 text-sm">Total</p>
                 <p className="text-3xl font-bold text-white">{formatCurrency(totalExpenseAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'list' ? (
        /* All Expenses List Tab */
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-amber-100 cursor-pointer">
              <input
                type="checkbox"
                checked={showFetchDiagnostics}
                onChange={(e) => {
                  const on = e.target.checked;
                  setShowFetchDiagnostics(on);
                  setExpenseListDiagnosticsEnabled(on);
                }}
                className="rounded border-gray-600"
              />
              Show fetch diagnostics (console: {EXPENSE_LIST_TRACE})
            </label>
            {showFetchDiagnostics && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  type="text"
                  value={diagnosticWatchId}
                  onChange={(e) => setDiagnosticWatchId(e.target.value)}
                  placeholder="Expense UUID or EXP-… to trace"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-400 max-w-xl">
                  Open DevTools → Console. Each filter pass logs the watched row; a summary effect logs pipeline
                  (operational list → filters → current page).
                </p>
              </div>
            )}
          </div>
          {/* GLOBAL SEARCH & ACTION BAR */}
          <ListToolbar
            search={{
              value: searchTerm,
              onChange: setSearchTerm,
              placeholder: "Search by ref #, category, description, account..."
            }}
            rowsSelector={{
              value: pageSize,
              onChange: handlePageSizeChange,
              totalItems: filteredExpenses.length
            }}
            primaryAction={{
              label: 'Add Expense',
              icon: <Plus size={18} />,
              onClick: () => { setSelectedExpense(null); setIsDrawerOpen(true); },
              className: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
            }}
            filter={{
              isOpen: filterOpen,
              onToggle: () => setFilterOpen(!filterOpen),
              activeCount: activeFilterCount,
              renderPanel: () => (
                <div className="absolute right-0 top-12 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Filters</h3>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Date Filter: From – To */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                          From Date
                        </label>
                        <DatePicker
                          value={fromDate}
                          onChange={(v) => setFromDate(v)}
                          placeholder="From"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                          To Date
                        </label>
                        <DatePicker
                          value={toDate}
                          onChange={(v) => setToDate(v)}
                          placeholder="To"
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                        Category
                      </label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">All Categories</option>
                        {categoryFilterOptions.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    {subCategoryFilterOptions.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                          Sub-category
                        </label>
                        <select
                          value={subCategoryFilter}
                          onChange={(e) => setSubCategoryFilter(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="all">All sub-categories</option>
                          {subCategoryFilterOptions.map((sub) => (
                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {branches.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                          Branch
                        </label>
                        <select
                          value={branchFilter}
                          onChange={(e) => setBranchFilter(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        >
                          <option value="all">All Branches</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.code ? `${b.code} | ${b.name}` : b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Account Filter */}
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                        Payment Account
                      </label>
                      <select
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">All Accounts</option>
                        {accountFilterOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showReversedExpenses}
                        onChange={(e) => setShowReversedExpenses(e.target.checked)}
                        className="rounded border-gray-600 bg-gray-950"
                      />
                      Show reversed in journal (offset in GL)
                    </label>
                  </div>
                </div>
              )
            }}
            exportConfig={{
              onExportCSV: handleExportCSV,
              onExportExcel: handleExportExcel,
              onExportPDF: handleExportPDF
            }}
          />

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
           {/* Table */}
           <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
                    <tr>
                       <th className="px-6 py-3 font-medium">Date</th>
                       <th className="px-6 py-3 font-medium">Reference #</th>
                       <th className="px-6 py-3 font-medium">Category</th>
                       <th className="px-6 py-3 font-medium">Branch</th>
                       <th className="px-6 py-3 font-medium">Expense For</th>
                       <th className="px-6 py-3 font-medium">Paid Via</th>
                       <th className="px-6 py-3 font-medium text-right">Amount</th>
                       <th className="px-6 py-3 font-medium text-center">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                          <p className="text-gray-400 text-sm">Loading expenses...</p>
                        </td>
                      </tr>
                    ) : paginatedExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <Receipt size={48} className="mx-auto text-gray-600 mb-3" />
                          <p className="text-gray-400 text-sm">No expenses found</p>
                          <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedExpenses.map((expense) => (
                       <tr key={expense.id} className="group hover:bg-gray-800/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-300">
                             <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-500" />
                                {new Date(expense.date).toLocaleDateString()}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-white font-mono font-bold text-[0.825rem]">
                             {expense.expenseNo || '—'}
                          </td>
                          <td className="px-6 py-4">
                             <Badge variant="outline" className={cn("font-normal", getCategoryBadgeStyle(expense.category))}>
                                {expense.category}
                             </Badge>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-sm">
                             {resolveExpenseBranchLabel(expense.location)}
                          </td>
                          <td className="px-6 py-4 text-white">
                             {expense.description}
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                             {paymentDisplayForExpense(expense)}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-red-500">
                             -{formatCurrency(expense.amount)}
                          </td>
                          <td className="px-6 py-4 text-center">
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-white data-[state=open]:bg-gray-800">
                                   <MoreVertical size={16} />
                                 </Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end" className="w-[160px] bg-[#1F2937] border-gray-700 text-white">
                                 <DropdownMenuItem className="cursor-pointer hover:bg-gray-700 focus:bg-gray-700" onClick={() => handleExpenseAction(expense, 'view')}>
                                   <Eye className="mr-2 h-4 w-4 text-blue-400" />
                                   <span>View Details</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem className="cursor-pointer hover:bg-gray-700 focus:bg-gray-700" onClick={() => handleExpenseAction(expense, 'edit')}>
                                   <Pencil className="mr-2 h-4 w-4 text-gray-400" />
                                   <span>Edit</span>
                                 </DropdownMenuItem>
                                 <DropdownMenuSeparator className="bg-gray-700" />
                                 <DropdownMenuItem className="cursor-pointer hover:bg-red-900/20 focus:bg-red-900/20 text-red-400 hover:text-red-300" onClick={() => handleExpenseAction(expense, 'delete')}>
                                   <Trash className="mr-2 h-4 w-4" />
                                   <span>Delete</span>
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                             </DropdownMenu>
                          </td>
                       </tr>
                      ))
                    )}
                 </tbody>
              </table>
           </div>
           {/* Fixed summary bar – Total / Grand Total + entries count */}
           <div className="border-t border-gray-800 bg-gray-950/80 px-6 py-3 flex items-center justify-between text-sm">
             <span className="text-gray-400">
               {categoryFilter !== 'all' ? (
                 <>Filter: <span className="text-white font-medium">{categoryFilter}</span></>
               ) : (
                 <>Grand Total</>
               )}
               <span className="text-gray-500 ml-2">
                 · {filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}
               </span>
             </span>
             <span className="font-bold text-white text-lg">
               {formatCurrency(summaryTotal)}
             </span>
           </div>
        </div>
        </div>
      ) : (
        <ExpenseCategoryTreePanel
          tree={categoriesFromDb}
          operationalExpenses={operationalForCategoryCounts}
          scopedExpenses={operationalForCategoryCounts}
          iconBySlug={ICON_BY_SLUG}
          defaultIcon={Receipt}
          onAddMain={handleAddCategory}
          onAddSub={(parentId) => handleAddSubCategory(parentId)}
          onEdit={(row) => {
            setCategoryModalParentId(null);
            handleEditCategory(row);
          }}
          onDelete={(row) => void handleDeleteCategory(row)}
        />
      )}

      <AddExpenseDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => { setIsDrawerOpen(false); setSelectedExpense(null); }} 
        expenseToEdit={selectedExpense}
        onSuccess={refreshExpenses}
      />
      
      <ExpenseDetailSheet
        open={viewDetailsOpen}
        expense={selectedExpense}
        categoryPath={selectedExpenseCategoryPath}
        onClose={() => { setViewDetailsOpen(false); setSelectedExpense(null); }}
        onEdit={(exp) => {
          setViewDetailsOpen(false);
          setSelectedExpense(exp);
          setIsDrawerOpen(true);
        }}
        onDelete={(exp) => {
          setViewDetailsOpen(false);
          setSelectedExpense(exp);
          setDeleteAlertOpen(true);
        }}
        getStatusBadgeStyle={getStatusBadgeStyle}
      />
      
      <AddCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCategoryModalParentId(null);
        }}
        categoryToEdit={selectedCategory}
        initialParentId={categoryModalParentId}
        onSuccess={loadCategoriesFromDb}
      />

      {/* Delete / Cancel Expense Confirmation */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {expenseDeleteOrCancelLabel(selectedExpense?.status)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {isPostedExpenseStatus(selectedExpense?.status)
                ? `Cancel expense ${selectedExpense?.expenseNo || selectedExpense?.id}? Accounting will be voided; the row stays for audit and is hidden from normal reports.`
                : `Delete draft expense ${selectedExpense?.expenseNo || selectedExpense?.id}? This removes the row.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPostedExpenseStatus(selectedExpense?.status) ? 'Cancel Expense' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};