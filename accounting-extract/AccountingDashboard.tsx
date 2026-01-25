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
  TestTube
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { cn } from '@/app/components/ui/utils';
import { useAccounting } from '@/app/context/AccountingContext';
import { useNavigation } from '@/app/context/NavigationContext';
import type { AccountingEntry } from '@/app/context/AccountingContext';
import { ManualEntryDialog } from './ManualEntryDialog';

export const AccountingDashboard = () => {
  const accounting = useAccounting();
  const { openDrawer, setCurrentView } = useNavigation();
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts' | 'receivables' | 'payables' | 'deposits' | 'studio' | 'reports'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  
  // 🎯 Manual Entry Dialog State
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  
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

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Accounting</h1>
            <p className="text-sm text-gray-400 mt-0.5">Financial transactions and reporting</p>
          </div>
          {userRole === 'Admin' && activeTab === 'transactions' && (
            <Button 
              onClick={() => setManualEntryOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
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
      <div className="flex-1 overflow-auto px-6 py-4">
        {activeTab === 'transactions' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900 border-b border-gray-800">
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-left">Module</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Debit Account</th>
                    <th className="px-4 py-3 text-left">Credit Account</th>
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
                    transactions.map((txn) => (
                      <tr 
                        key={txn.id} 
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {txn.date.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-400 font-mono">
                          {txn.referenceNo}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <Badge className="bg-gray-800 text-gray-300 border-gray-700">
                            {txn.module}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {txn.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-400">
                          {txn.debitAccount}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-400">
                          {txn.creditAccount}
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-semibold text-right tabular-nums">
                          ${txn.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {txn.createdBy}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <Wallet size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Accounts Overview</p>
              <p className="text-gray-600 text-xs mt-1">Account balances and management</p>
            </div>
          </div>
        )}

        {activeTab === 'receivables' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <TrendingUp size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Accounts Receivable</p>
              <p className="text-gray-600 text-xs mt-1">Customer outstanding balances</p>
            </div>
          </div>
        )}

        {activeTab === 'payables' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <TrendingDown size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Accounts Payable</p>
              <p className="text-gray-600 text-xs mt-1">Supplier outstanding balances</p>
            </div>
          </div>
        )}

        {activeTab === 'deposits' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <Shield size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Security Deposits</p>
              <p className="text-gray-600 text-xs mt-1">Rental security deposits tracking</p>
            </div>
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <Wrench size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Studio Production Costs</p>
              <p className="text-gray-600 text-xs mt-1">Worker payments and job costs</p>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">Financial Reports</p>
              <p className="text-gray-600 text-xs mt-1">P&L, Balance Sheet, Cash Flow</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Manual Entry Dialog */}
      <ManualEntryDialog 
        isOpen={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
      />
    </div>
  );
};