import React, { useState, useMemo } from 'react';
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
  MoreVertical,
  XCircle,
  Star,
  List
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
import { TransactionDetailModal } from './TransactionDetailModal';
import { AddAccountDrawer } from './AddAccountDrawer';
import { useSupabase } from '@/app/context/SupabaseContext';
import { accountService } from '@/app/services/accountService';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

export const AccountingDashboard = () => {
  const accounting = useAccounting();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const { openDrawer } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts' | 'receivables' | 'payables' | 'deposits' | 'studio' | 'reports'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  
  // 🎯 Manual Entry Dialog State
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  
  // 🎯 Account Management State
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  
  // 🎯 Ledger & Transaction State
  const [ledgerAccount, setLedgerAccount] = useState<any>(null);
  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Role (from auth context in real app)
  const userRole = 'Admin'; // Admin | User
  
  // 🎯 Use real entries from AccountingContext
  const transactions = useMemo(() => {
    return accounting.entries;
  }, [accounting.entries]);
  
  // Calculate summary stats
  const summary = useMemo(() => {
    const totalIncome = transactions
      .filter(t => ['Sales Income', 'Rental Income', 'Studio Sales Income'].includes(t.creditAccount))
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalExpense = transactions
      .filter(t => t.debitAccount === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalReceivable = transactions
      .filter(t => t.debitAccount === 'Accounts Receivable')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalPayable = transactions
      .filter(t => t.creditAccount === 'Accounts Payable')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalIncome,
      totalExpense,
      totalReceivable,
      totalPayable,
      netProfit: totalIncome - totalExpense,
    };
  }, [transactions]);
  
  // Tab configuration
  const tabs = [
    { key: 'transactions', label: 'Transactions', icon: Receipt },
    { key: 'accounts', label: 'Accounts', icon: Wallet },
    { key: 'receivables', label: 'Receivables', icon: TrendingUp },
    { key: 'payables', label: 'Payables', icon: TrendingDown },
    { key: 'deposits', label: 'Deposits', icon: Shield },
    { key: 'studio', label: 'Studio Costs', icon: Wrench },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
  ];

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

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19] overflow-hidden">
      {/* Page Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 bg-[#0F1419]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Accounting</h1>
            <p className="text-sm text-gray-400 mt-0.5">Financial transactions and reporting</p>
          </div>
          {userRole === 'Admin' && activeTab === 'transactions' && (
            <Button 
              onClick={() => setManualEntryOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2 shadow-lg shadow-blue-900/30"
            >
              <Plus size={16} />
              Manual Entry
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
                <p className="text-2xl font-bold text-green-400 mt-1">${summary.totalIncome.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">This period</p>
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
                <p className="text-2xl font-bold text-red-400 mt-1">${summary.totalExpense.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">This period</p>
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
                )}>${summary.netProfit.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Income - Expense</p>
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
                <p className="text-2xl font-bold text-blue-400 mt-1">${summary.totalReceivable.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">To receive</p>
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
                <p className="text-2xl font-bold text-orange-400 mt-1">${summary.totalPayable.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">To pay</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Building2 size={24} className="text-orange-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 border-b border-gray-800">
        <div className="flex gap-1 -mb-px">
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
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Transactions</h3>
                <p className="text-sm text-gray-400">All journal entries from accounting system</p>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {accounting.entries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm">No transactions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-900 border-b border-gray-800">
                      <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Reference</th>
                        <th className="px-4 py-3 text-left">Module</th>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Payment Method</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-left">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounting.entries.map((entry) => {
                        // Get reference from metadata or generate from id
                        const referenceNumber = entry.referenceNo || 
                          (entry.metadata as any)?.paymentId?.substring(0, 8) || 
                          entry.id?.substring(0, 8) || 
                          'N/A';
                        const module = entry.module || 'Accounting';
                        const amount = entry.amount || 0;
                        const paymentMethod = (entry.metadata as any)?.paymentMethod || 'N/A';
                        const type = amount >= 0 ? 'Income' : 'Expense';
                        
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
                            onClick={() => setTransactionReference(referenceNumber)}
                          >
                            <td className="px-4 py-3 text-sm text-gray-300">
                              {entry.date ? new Date(entry.date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTransactionReference(referenceNumber);
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
                              <Badge className={
                                type === 'Income'
                                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                  : 'bg-red-500/20 text-red-400 border-red-500/30'
                              }>
                                {type}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400 capitalize">
                              {paymentMethod}
                            </td>
                            <td className={cn(
                              "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                              amount >= 0 ? "text-green-400" : "text-red-400"
                            )}>
                              {Math.abs(amount).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {entry.source || 'Manual'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transactions_old' && (
          <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
              <Button
                variant="outline"
                onClick={() => setFilterOpen(!filterOpen)}
                className={cn(
                  "border-gray-800 text-gray-300 hover:bg-gray-800 transition-all",
                  filterOpen && "bg-gray-800 border-blue-500"
                )}
              >
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
            </div>

            {/* Filter Panel */}
            {filterOpen && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">All Types</option>
                      <option value="expense">Expense</option>
                      <option value="sale">Sale</option>
                      <option value="purchase">Purchase</option>
                      <option value="payment">Payment</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900/70 border-b border-gray-800 sticky top-0 z-10">
                    <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Reference</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Account</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <Receipt size={48} className="mx-auto text-gray-600 mb-3" />
                          <p className="text-gray-400 text-sm">No transactions yet</p>
                          <p className="text-gray-600 text-xs mt-1">Transactions will appear here</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions
                        .map((txn) => {
                          // Determine transaction type based on source and accounts
                          const getTransactionType = () => {
                            if (txn.source === 'Expense') return 'Expense';
                            if (txn.source === 'Sale') return 'Income';
                            if (txn.source === 'Purchase') return 'Purchase';
                            if (txn.debitAccount === 'Accounts Receivable') return 'Receivable';
                            if (txn.creditAccount === 'Accounts Payable') return 'Payable';
                            return 'Transfer';
                          };

                          const transactionType = getTransactionType();
                          const accountName = txn.debitAccount !== 'Expense' && txn.debitAccount !== 'Accounts Receivable' 
                            ? txn.debitAccount 
                            : txn.creditAccount;

                          return (
                            <tr 
                              key={txn.id} 
                              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3 text-sm text-gray-400">
                                {new Date(txn.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-3 text-sm text-blue-400 font-mono">
                                {txn.referenceNo}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                <Badge className="bg-gray-800/50 text-gray-300 border-gray-700/50">
                                  {txn.module}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-300 max-w-md">
                                {txn.description}
                              </td>
                              <td className="px-4 py-3 text-sm text-green-400 font-medium">
                                {transactionType}
                              </td>
                              <td className="px-4 py-3 text-sm text-red-400">
                                {accountName}
                              </td>
                              <td className="px-4 py-3 text-sm text-white font-semibold text-right tabular-nums">
                                ${txn.amount.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {txn.createdBy}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {/* Header with Create Button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Accounts</h3>
                <p className="text-sm text-gray-400">Manage your financial accounts</p>
              </div>
              <Button
                onClick={() => setIsAddAccountOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
              >
                <Plus size={16} /> Create New Account
              </Button>
            </div>

            {/* Accounts Table */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {accounting.accounts.length === 0 ? (
                <div className="text-center py-12">
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-900 border-b border-gray-800">
                      <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3 text-left">Account Name</th>
                        <th className="px-4 py-3 text-left">Account Type</th>
                        <th className="px-4 py-3 text-left">Scope</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounting.accounts.map((account) => (
                        <tr 
                          key={account.id} 
                          className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-gray-300 font-medium">
                            <div className="flex items-center gap-2">
                              {account.name}
                              {(account as any).is_default_cash && (
                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                  Default Cash
                                </Badge>
                              )}
                              {(account as any).is_default_bank && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                  Default Bank
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                              {account.type || account.accountType || 'Asset'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {account.branch ? 'Branch' : 'Global'}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                            account.balance >= 0 ? "text-green-400" : "text-red-400"
                          )}>
                            Rs {account.balance.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {account.isActive ? (
                              <Badge className="bg-green-500/10 text-green-400 border-green-500/30">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/30">
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical size={16} className="text-gray-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setLedgerAccount({
                                      id: account.id,
                                      name: account.name,
                                      code: (account as any).code,
                                      type: account.type || account.accountType || 'Asset',
                                    });
                                  }}
                                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                                >
                                  <FileText size={14} className="mr-2" /> View Ledger
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    // TODO: Implement View Transactions
                                    toast.info('View Transactions - Coming soon');
                                  }}
                                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                                >
                                  <List size={14} className="mr-2" /> View Transactions
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    // TODO: Implement Account Summary
                                    toast.info('Account Summary - Coming soon');
                                  }}
                                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                                >
                                  <BarChart3 size={14} className="mr-2" /> Account Summary
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingAccount(account);
                                    setIsEditAccountOpen(true);
                                  }}
                                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                                >
                                  <Edit size={14} className="mr-2" /> Edit Account
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await accountService.updateAccount(account.id!, {
                                        is_active: !account.isActive
                                      });
                                      await accounting.refreshEntries();
                                      toast.success(`Account ${account.isActive ? 'deactivated' : 'activated'}`);
                                    } catch (error: any) {
                                      toast.error(`Failed to update account: ${error.message}`);
                                    }
                                  }}
                                  className="text-gray-300 hover:text-white hover:bg-gray-800"
                                >
                                  {account.isActive ? (
                                    <>
                                      <XCircle size={14} className="mr-2" /> Deactivate Account
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 size={14} className="mr-2" /> Activate Account
                                    </>
                                  )}
                                </DropdownMenuItem>
                                {(account.type === 'Cash' || account.accountType === 'Cash') && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        // Unset other default cash accounts first
                                        const cashAccounts = accounting.accounts.filter(
                                          a => (a.type === 'Cash' || a.accountType === 'Cash') && a.id !== account.id
                                        );
                                        for (const acc of cashAccounts) {
                                          await accountService.updateAccount(acc.id!, { is_default_cash: false });
                                        }
                                        // Set this as default
                                        await accountService.updateAccount(account.id!, { is_default_cash: true });
                                        await accounting.refreshEntries();
                                        toast.success('Set as default Cash account');
                                      } catch (error: any) {
                                        toast.error(`Failed to set default: ${error.message}`);
                                      }
                                    }}
                                    className="text-gray-300 hover:text-white hover:bg-gray-800"
                                  >
                                    <Star size={14} className="mr-2" /> Set as Default Cash
                                  </DropdownMenuItem>
                                )}
                                {(account.type === 'Bank' || account.accountType === 'Bank') && (
                                  <DropdownMenuItem
                                    onClick={async () => {
                                      try {
                                        // Unset other default bank accounts first
                                        const bankAccounts = accounting.accounts.filter(
                                          a => (a.type === 'Bank' || a.accountType === 'Bank') && a.id !== account.id
                                        );
                                        for (const acc of bankAccounts) {
                                          await accountService.updateAccount(acc.id!, { is_default_bank: false });
                                        }
                                        // Set this as default
                                        await accountService.updateAccount(account.id!, { is_default_bank: true });
                                        await accounting.refreshEntries();
                                        toast.success('Set as default Bank account');
                                      } catch (error: any) {
                                        toast.error(`Failed to set default: ${error.message}`);
                                      }
                                    }}
                                    className="text-gray-300 hover:text-white hover:bg-gray-800"
                                  >
                                    <Star size={14} className="mr-2" /> Set as Default Bank
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'receivables' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
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
                            ${sale.total.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-400 text-right">
                            ${sale.paid.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400 font-semibold text-right">
                            ${sale.due.toLocaleString()}
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
                            ${purchase.total.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-green-400 text-right">
                            ${purchase.paid.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-400 font-semibold text-right">
                            ${purchase.due.toLocaleString()}
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

        {activeTab === 'deposits' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <Shield size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Security Deposits</p>
              <p className="text-gray-600 text-xs mt-1">Rental security deposits tracking</p>
              <p className="text-gray-500 text-xs mt-2">Feature coming soon - Rental module integration</p>
            </div>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <Wrench size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Studio Production Costs</p>
              <p className="text-gray-600 text-xs mt-1">Worker payments and job costs</p>
              <p className="text-gray-500 text-xs mt-2">Feature coming soon - Studio module integration</p>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Income</p>
                    <p className="text-2xl font-bold text-green-400">${summary.totalIncome.toLocaleString()}</p>
                  </div>
                  <TrendingUp size={32} className="text-green-500/50" />
                </div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Expense</p>
                    <p className="text-2xl font-bold text-red-400">${summary.totalExpense.toLocaleString()}</p>
                  </div>
                  <TrendingDown size={32} className="text-red-500/50" />
                </div>
              </div>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Net Profit</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      summary.netProfit >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      ${summary.netProfit.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign size={32} className={summary.netProfit >= 0 ? "text-green-500/50" : "text-red-500/50"} />
                </div>
              </div>
            </div>

            {/* Account Balances */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Account Balances</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from(accounting.balances.entries()).map(([accountType, balance]) => (
                  <div key={accountType} className="bg-gray-950/50 border border-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{accountType}</p>
                    <p className={cn(
                      "text-xl font-bold",
                      balance >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      ${balance.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction Summary */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Transaction Summary</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <span className="text-sm text-gray-400">Total Transactions</span>
                  <span className="text-sm font-semibold text-white">{transactions.length}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <span className="text-sm text-gray-400">Sales Transactions</span>
                  <span className="text-sm font-semibold text-white">
                    {transactions.filter(t => t.source === 'Sale').length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <span className="text-sm text-gray-400">Purchase Transactions</span>
                  <span className="text-sm font-semibold text-white">
                    {transactions.filter(t => t.source === 'Purchase').length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-800">
                  <span className="text-sm text-gray-400">Expense Transactions</span>
                  <span className="text-sm font-semibold text-white">
                    {transactions.filter(t => t.source === 'Expense').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Manual Entry Dialog */}
      <ManualEntryDialog 
        isOpen={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
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

      {/* Account Ledger View Modal */}
      {ledgerAccount && (
        <AccountLedgerView
          isOpen={!!ledgerAccount}
          onClose={() => setLedgerAccount(null)}
          accountId={ledgerAccount.id}
          accountName={ledgerAccount.name}
          accountCode={ledgerAccount.code}
          accountType={ledgerAccount.type}
        />
      )}

      {/* Transaction Detail Modal */}
      {transactionReference && (
        <TransactionDetailModal
          isOpen={!!transactionReference}
          onClose={() => setTransactionReference(null)}
          referenceNumber={transactionReference}
        />
      )}

      {/* Listen for transaction detail events */}
      {typeof window !== 'undefined' && (
        <TransactionDetailListener
          onOpen={(referenceNumber) => setTransactionReference(referenceNumber)}
        />
      )}
    </div>
  );
};

// Component to listen for transaction detail events
const TransactionDetailListener: React.FC<{ onOpen: (ref: string) => void }> = ({ onOpen }) => {
  React.useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      onOpen(event.detail.referenceNumber);
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