import React, { useState, useMemo } from 'react';
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
  List as ListIcon
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
import { Building2, Zap, Users, ShoppingCart, Briefcase, Utensils } from 'lucide-react';
import { ListToolbar } from '../ui/list-toolbar';

// Mock Data for Charts
const chartData = [
  { name: 'Rent', value: 40000, color: '#3B82F6' },
  { name: 'Salaries', value: 30000, color: '#8B5CF6' },
  { name: 'Utilities', value: 20000, color: '#F97316' },
  { name: 'Misc', value: 10000, color: '#9CA3AF' },
];

// Mock Data for Expenses List
const expenses = [
  { id: 1, date: 'Oct 24, 2023', ref: 'EXP-001', category: 'Rent', expenseFor: 'Shop Premises', account: 'Meezan Bank', amount: 40000, status: 'Paid' },
  { id: 2, date: 'Oct 22, 2023', ref: 'EXP-002', category: 'Salaries', expenseFor: 'All Staff', account: 'Meezan Bank', amount: 30000, status: 'Paid' },
  { id: 3, date: 'Oct 20, 2023', ref: 'EXP-003', category: 'Stitching', expenseFor: 'Batch #44', account: 'Cash Drawer', amount: 12500, status: 'Pending' },
  { id: 4, date: 'Oct 18, 2023', ref: 'EXP-004', category: 'Utilities', expenseFor: 'Electricity Bill', account: 'JazzCash', amount: 4200, status: 'Paid' },
  { id: 5, date: 'Oct 15, 2023', ref: 'EXP-005', category: 'Misc', expenseFor: 'Office Supplies', account: 'Cash Drawer', amount: 1500, status: 'Paid' },
  { id: 6, date: 'Oct 12, 2023', ref: 'EXP-006', category: 'Utilities', expenseFor: 'Internet Bill', account: 'JazzCash', amount: 3500, status: 'Paid' },
];

// Mock Data for Categories
const categoriesList = [
  { id: 1, name: 'Rent', icon: Building2, color: 'bg-blue-500', count: 50 },
  { id: 2, name: 'Salaries', icon: Users, color: 'bg-purple-500', count: 12 },
  { id: 3, name: 'Utilities', icon: Zap, color: 'bg-orange-500', count: 24 },
  { id: 4, name: 'Stitching', icon: ShoppingCart, color: 'bg-yellow-500', count: 5 },
  { id: 5, name: 'Office Supplies', icon: Briefcase, color: 'bg-gray-500', count: 0 },
  { id: 6, name: 'Food & Meals', icon: Utensils, color: 'bg-red-500', count: 8 },
];

const getCategoryBadgeStyle = (category: string) => {
  switch (category) {
    case 'Rent': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Salaries': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Utilities': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'Stitching': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

export const ExpensesDashboard = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'categories'>('overview');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

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
  
  const handleDeleteExpense = () => {
    if (selectedExpense) {
      console.log('Delete expense:', selectedExpense.id);
      toast.success(`Expense "${selectedExpense.ref}" deleted successfully.`);
      setDeleteAlertOpen(false);
      setSelectedExpense(null);
    }
  };

  const handleEditCategory = (category: any) => {
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = (category: any) => {
    if (category.count > 0) {
      toast.error(`This category is used in ${category.count} records. Cannot delete.`, {
        description: "Please reassign or delete the associated expenses first.",
        duration: 4000,
      });
    } else {
      toast.success(`Category "${category.name}" deleted successfully.`);
    }
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setIsCategoryModalOpen(true);
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = expense.ref.toLowerCase().includes(search) ||
               expense.category.toLowerCase().includes(search) ||
               expense.expenseFor.toLowerCase().includes(search) ||
               expense.account.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;

      // Account filter
      if (accountFilter !== 'all' && expense.account !== accountFilter) return false;

      return true;
    });
  }, [searchTerm, categoryFilter, accountFilter]);

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
  }, [searchTerm]);

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
    accountFilter !== 'all'
  ].filter(Boolean).length;

  // Clear filters
  const clearFilters = () => {
    setCategoryFilter('all');
    setAccountFilter('all');
  };

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
      {activeTab === 'overview' ? (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
          {/* Top Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Total Monthly Expense</p>
                  <h3 className="text-2xl font-bold text-white mt-2">$91,700</h3>
                </div>
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <TrendingUp className="text-red-500" size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="text-red-400 font-medium flex items-center gap-1">
                   <TrendingUp size={12} /> +12%
                </span>
                <span className="text-gray-500">vs last month</span>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Last Month Comparison</p>
                  <h3 className="text-2xl font-bold text-white mt-2">$81,200</h3>
                </div>
                <div className="bg-green-500/10 p-2 rounded-lg">
                  <TrendingDown className="text-green-500" size={20} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="text-green-400 font-medium flex items-center gap-1">
                   <TrendingDown size={12} /> -5%
                </span>
                <span className="text-gray-500">budget utilization</span>
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-xl flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Highest Category</p>
                  <h3 className="text-2xl font-bold text-white mt-2">Rent</h3>
                </div>
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <DollarSign className="text-blue-500" size={20} />
                </div>
              </div>
              <div className="mt-4">
                 <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: '45%' }}></div>
                 </div>
                 <p className="text-gray-500 text-xs mt-2">45% of total expenses</p>
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
                    formatter={(value: number) => `$${value.toLocaleString()}`}
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
                 <p className="text-3xl font-bold text-white">$91.7k</p>
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
                        <option value="Rent">Rent</option>
                        <option value="Salaries">Salaries</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Stitching">Stitching</option>
                        <option value="Misc">Misc</option>
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

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
           {/* Table */}
           <div className="overflow-x-auto">
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
                    {paginatedExpenses.map((expense) => (
                       <tr key={expense.id} className="group hover:bg-gray-800/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-300">
                             <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-500" />
                                {expense.date}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                             {expense.ref}
                          </td>
                          <td className="px-6 py-4">
                             <Badge variant="outline" className={cn("font-normal", getCategoryBadgeStyle(expense.category))}>
                                {expense.category}
                             </Badge>
                          </td>
                          <td className="px-6 py-4 text-white">
                             {expense.expenseFor}
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                             {expense.account}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-red-500">
                             -${expense.amount.toLocaleString()}
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
                    ))}
                 </tbody>
              </table>
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
      />

    </div>
  );
};