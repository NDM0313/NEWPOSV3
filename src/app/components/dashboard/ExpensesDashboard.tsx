import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Receipt, 
  Calendar, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
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
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { toast } from "sonner";
import { Building2, Zap, Users, ShoppingCart, Briefcase, Utensils, Car, Wallet, Home } from 'lucide-react';
import { ListToolbar } from '../ui/list-toolbar';
import { useExpenses } from '../../context/ExpenseContext';
import { useAccounting } from '../../context/AccountingContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useFormatDate } from '../../hooks/useFormatDate';
import { expenseCategoryService, type ExpenseCategoryRow, type ExpenseCategoryTreeItem } from '../../services/expenseCategoryService';

const getCategoryBadgeStyle = (category: string) => {
  switch (category) {
    case 'Rent': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Salaries': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Utilities': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'Stitching': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

const ICON_BY_SLUG: Record<string, React.ComponentType<{ size?: number }>> = {
  Zap, Users, Car, Building2, Utensils, Wallet, Briefcase, Home, ShoppingCart,
  Other: Wallet,
};

function flattenCategories(tree: ExpenseCategoryTreeItem[]): ExpenseCategoryRow[] {
  const out: ExpenseCategoryRow[] = [];
  tree.forEach((node) => {
    out.push(node);
    node.children.forEach((child) => out.push(child));
  });
  return out;
}

export const ExpensesDashboard = () => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const { expenses, loading, deleteExpense, refreshExpenses } = useExpenses();
  const { accounts } = useAccounting();
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'categories'>('overview');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoriesFromDb, setCategoriesFromDb] = useState<ExpenseCategoryTreeItem[]>([]);

  const loadCategoriesFromDb = React.useCallback(() => {
    if (!companyId) return;
    expenseCategoryService.getTree(companyId).then(setCategoriesFromDb).catch(() => setCategoriesFromDb([]));
  }, [companyId]);

  useEffect(() => {
    loadCategoriesFromDb();
  }, [loadCategoriesFromDb]);

  // 🎯 NEW: Action States
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  // List filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  
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
    if (selectedExpense) {
      try {
        await deleteExpense(selectedExpense.id);
        toast.success(`Expense "${selectedExpense.expense_no || selectedExpense.id}" deleted successfully.`);
        setDeleteAlertOpen(false);
        setSelectedExpense(null);
      } catch (error: any) {
        console.error('[EXPENSES DASHBOARD] Error deleting expense:', error);
        toast.error('Failed to delete expense: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleEditCategory = (category: any) => {
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (category: any) => {
    if (category.count > 0) {
      toast.error(`This category is used in ${category.count} records. Cannot delete.`, {
        description: "Please reassign or delete the associated expenses first.",
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
    setIsCategoryModalOpen(true);
  };

  // Calculate chart data from real expenses
  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (exp.amount || 0);
    });
    
    const colors = ['#3B82F6', '#8B5CF6', '#F97316', '#9CA3AF', '#10B981', '#EF4444'];
    return Object.entries(categoryTotals).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  }, [expenses]);

  // Categories list: from expense_categories (DB) when available, else from expense counts
  const categoriesList = useMemo(() => {
    const flat = flattenCategories(categoriesFromDb);
    if (flat.length > 0) {
      return flat.map((cat) => ({
        ...cat,
        icon: ICON_BY_SLUG[cat.icon] || Receipt,
        color: cat.color?.startsWith('bg-') ? cat.color : `bg-${cat.color || 'gray'}-500`,
        count: expenses.filter((e) => (e.category || '') === cat.name).length,
      }));
    }
    const categoryCounts: Record<string, number> = {};
    expenses.forEach(exp => {
      const cat = exp.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const iconMap: Record<string, any> = {
      'Rent': Building2, 'Salaries': Users, 'Utilities': Zap, 'Stitching': ShoppingCart,
      'Office Supplies': Briefcase, 'Food & Meals': Utensils,
    };
    const colorMap: Record<string, string> = {
      'Rent': 'bg-blue-500', 'Salaries': 'bg-purple-500', 'Utilities': 'bg-orange-500',
      'Stitching': 'bg-yellow-500', 'Office Supplies': 'bg-gray-500', 'Food & Meals': 'bg-red-500',
    };
    return Object.entries(categoryCounts).map(([name, count], index) => ({
      id: String(index + 1),
      name,
      icon: iconMap[name] || Receipt,
      color: colorMap[name] || 'bg-gray-500',
      count,
    }));
  }, [expenses, categoriesFromDb]);

  // Filtered expenses (search, category, account, date range)
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (expense.expenseNo || '').toLowerCase().includes(search) ||
               (expense.category || '').toLowerCase().includes(search) ||
               (expense.description || '').toLowerCase().includes(search) ||
               (expense.payeeName || '').toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && (expense.category || '') !== categoryFilter) return false;

      // Account filter
      if (accountFilter !== 'all' && (expense.paymentMethod || '') !== accountFilter) return false;

      // Date filter (From Date – To Date)
      const expenseDate = expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '';
      if (fromDate && expenseDate < fromDate) return false;
      if (toDate && expenseDate > toDate) return false;

      return true;
    });
  }, [expenses, searchTerm, categoryFilter, accountFilter, fromDate, toDate]);

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
  }, [searchTerm, categoryFilter, accountFilter, fromDate, toDate]);

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
    accountFilter !== 'all',
    !!fromDate,
    !!toDate
  ].filter(Boolean).length;

  // Clear filters
  const clearFilters = () => {
    setCategoryFilter('all');
    setAccountFilter('all');
    setFromDate('');
    setToDate('');
  };

  // Bottom summary: total of filtered expenses
  const summaryTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [filteredExpenses]
  );

  // Export handlers
  const handleExportCSV = () => {
    console.log('Export Expenses CSV');
  };

  const handleExportExcel = () => {
    console.log('Export Expenses Excel');
  };

  const handleExportPDF = () => {
    console.log('Export Expenses PDF');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-800 pb-4">
        <div className="space-y-4 w-full md:w-auto">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Expenses</h2>
            <p className="text-gray-400 mt-1">Track and manage business operational costs.</p>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center gap-6 mt-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                "pb-2 text-sm font-medium transition-all relative",
                activeTab === 'overview' 
                  ? "text-blue-400" 
                  : "text-gray-400 hover:text-gray-300"
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
                activeTab === 'list' 
                  ? "text-blue-400" 
                  : "text-gray-400 hover:text-gray-300"
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
                activeTab === 'categories' 
                  ? "text-blue-400" 
                  : "text-gray-400 hover:text-gray-300"
              )}
            >
              Categories
              {activeTab === 'categories' && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
           {activeTab === 'categories' ? (
             <Button 
               onClick={handleAddCategory}
               className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-600/20"
             >
               <Plus size={18} />
               Add New Category
             </Button>
           ) : (
             <Button 
               onClick={() => setIsDrawerOpen(true)}
               className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-600/20"
             >
               <Plus size={18} />
               Record Expense
             </Button>
           )}
        </div>
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
                    {formatCurrency(expenses.reduce((sum, e) => sum + (e.amount || 0), 0))}
                  </h3>
                </div>
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <TrendingUp className="text-red-500" size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="text-gray-500">{expenses.length} expenses this month</span>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Pending Expenses</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {expenses.filter(e => e.status === 'pending').length}
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
                  <p className="text-gray-400 text-sm font-medium">Highest Category</p>
                  <h3 className="text-2xl font-bold text-white mt-2">
                    {chartData.length > 0 ? chartData[0].name : 'N/A'}
                  </h3>
                </div>
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <DollarSign className="text-blue-500" size={20} />
                </div>
              </div>
              <div className="mt-4">
                 {chartData.length > 0 && (
                   <>
                     <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(chartData[0].value / expenses.reduce((sum, e) => sum + (e.amount || 0), 0)) * 100}%` }}></div>
                     </div>
                     <p className="text-gray-500 text-xs mt-2">
                       {((chartData[0].value / expenses.reduce((sum, e) => sum + (e.amount || 0), 0)) * 100).toFixed(1)}% of total expenses
                     </p>
                   </>
                 )}
              </div>
            </div>
          </div>

          {/* Donut Chart Section */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
            <h3 className="text-lg font-bold text-white mb-2 self-start">Expense Breakdown</h3>
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
              
              {/* Center Text */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                 <p className="text-gray-500 text-sm">Total</p>
                 <p className="text-3xl font-bold text-white">{formatCurrency(expenses.reduce((sum, e) => sum + (e.amount || 0), 0))}</p>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'list' ? (
        /* All Expenses List Tab */
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
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
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
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
                        {categoriesList.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

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
                        <option value="Meezan Bank">Meezan Bank</option>
                        <option value="Cash Drawer">Cash Drawer</option>
                        <option value="JazzCash">JazzCash</option>
                      </select>
                    </div>
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
                       <th className="px-6 py-3 font-medium">Expense For</th>
                       <th className="px-6 py-3 font-medium">Paid Via</th>
                       <th className="px-6 py-3 font-medium text-right">Amount</th>
                       <th className="px-6 py-3 font-medium text-center">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                          <p className="text-gray-400 text-sm">Loading expenses...</p>
                        </td>
                      </tr>
                    ) : paginatedExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
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
                                {formatDate(expense.date)}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                             {expense.expenseNo || '—'}
                          </td>
                          <td className="px-6 py-4">
                             <Badge variant="outline" className={cn("font-normal", getCategoryBadgeStyle(expense.category))}>
                                {expense.category}
                             </Badge>
                          </td>
                          <td className="px-6 py-4 text-white">
                             {expense.description}
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                             {expense.paymentMethod}
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
        /* Categories Tab */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-2 duration-300">
           {categoriesList.map((category) => (
             <div 
               key={category.id}
               className="group relative bg-gray-900/50 border border-gray-800 rounded-xl p-5 transition-all hover:bg-gray-800/50 hover:border-gray-700 hover:shadow-lg hover:-translate-y-1"
             >
               {/* Color Dot */}
               <div className={cn("absolute top-5 right-5 w-2 h-2 rounded-full", category.color)} />

               <div className="flex flex-col h-full justify-between gap-4">
                 <div className="flex items-start gap-4">
                   <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 text-gray-400 group-hover:text-white transition-colors">
                     <category.icon size={24} />
                   </div>
                   <div>
                     <h3 className="font-bold text-white text-lg">{category.name}</h3>
                     <p className="text-sm text-gray-500">{category.count} Expenses</p>
                   </div>
                 </div>
                 
                 {/* Hover Actions */}
                 <div className="pt-4 border-t border-gray-800/50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditCategory(category)}
                      className="flex-1 h-8 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs"
                    >
                      <Pencil size={12} className="mr-2" /> Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteCategory(category)}
                      className="h-8 bg-red-900/10 hover:bg-red-900/20 text-red-400 hover:text-red-300 px-3"
                    >
                      <Trash size={12} />
                    </Button>
                 </div>
               </div>
             </div>
           ))}

           {/* Add New Card (Empty State-ish) */}
           <button 
             onClick={handleAddCategory}
             className="border border-dashed border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-white hover:border-gray-600 hover:bg-gray-900/30 transition-all min-h-[160px]"
           >
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center">
                <Plus size={24} />
              </div>
              <span className="font-medium">Add New Category</span>
           </button>
        </div>
      )}

      <AddExpenseDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      
      <AddCategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        categoryToEdit={selectedCategory}
        onSuccess={loadCategoriesFromDb}
      />

    </div>
  );
};