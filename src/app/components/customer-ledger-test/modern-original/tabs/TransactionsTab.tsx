import { useState } from 'react';
import { Search, Filter, Download, ArrowUpRight, ArrowDownRight, FileText, CreditCard, Tag, Printer, Settings2, ChevronDown, MoreVertical, TrendingUp, Calendar, DollarSign, SlidersHorizontal, PieChart, BarChart3, Clock, Link2, Paperclip, MessageSquare, Eye, Star, X as XIcon, Save, History, Zap, AlertCircle, List, Grid } from 'lucide-react';
import { PrintExportModal } from '../modals/PrintExportModal';
import { CustomizeColumnsModal } from '../modals/CustomizeColumnsModal';
import { AdvancedFilterModal } from '../modals/AdvancedFilterModal';
import { TransactionDetailPanel } from '../panels/TransactionDetailPanel';
import { TransactionTimeline } from '../views/TransactionTimeline';
import { TransactionAnalytics } from '../views/TransactionAnalytics';
import { TransactionGroupedView } from '../views/TransactionGroupedView';
import { TransactionClassicView } from '../views/TransactionClassicView';
import { LedgerPrintView } from '../print/LedgerPrintView';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface TransactionsTabProps {
  transactions: Transaction[];
  saleItemsMap?: Map<string, any[]>;
  onTransactionClick: (transaction: Transaction) => void;
  openingBalance?: number;
  accountName?: string;
  dateRange?: { from: string; to: string };
}

type SortField = 'date' | 'reference' | 'type' | 'debit' | 'credit' | 'balance';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'grouped' | 'classic' | 'compact' | 'timeline' | 'analytics';

export function TransactionsTab({ transactions, saleItemsMap = new Map(), onTransactionClick, openingBalance: openingBalanceProp = 0, accountName = 'Account', dateRange: dateRangeProp }: TransactionsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Sale' | 'Payment' | 'Discount'>('all');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [savedViews, setSavedViews] = useState<string[]>(['Default View', 'Recent Sales', 'Pending Payments']);
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    reference: true,
    type: true,
    description: true,
    paymentAccount: true,
    notes: true,
    debit: true,
    credit: true,
    balance: true,
  });
  
  // Ledger print/PDF state
  const [showLedgerPrint, setShowLedgerPrint] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');

  const formatAmount = (amount: number) => {
    return amount > 0 ? amount.toLocaleString('en-PK') : '-';
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'Opening Balance':
        return <DollarSign className="w-4 h-4" />;
      case 'Sale':
        return <FileText className="w-4 h-4" />;
      case 'Payment':
        return <CreditCard className="w-4 h-4" />;
      case 'Discount':
        return <Tag className="w-4 h-4" />;
      case 'Purchase':
        return <FileText className="w-4 h-4" />;
      case 'Expense':
        return <FileText className="w-4 h-4" />;
      case 'Job':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDocumentStyle = (type: string) => {
    switch (type) {
      case 'Opening Balance':
        return 'bg-gray-600/30 text-gray-300 border border-gray-600';
      case 'Sale':
        return 'text-blue-400';
      case 'Payment':
        return 'text-emerald-400';
      case 'Discount':
        return 'text-purple-400';
      case 'Purchase':
        return 'text-blue-400';
      case 'Expense':
        return 'text-amber-400';
      case 'Job':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  // Filter and sort — Opening Balance always included and always first
  const openingBalanceEntry = transactions.find(t => t.documentType === 'Opening Balance');
  const restTransactions = transactions.filter(t => t.documentType !== 'Opening Balance');
  const matchesSearch = (t: Transaction) =>
    t.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.paymentAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesFilter = (t: Transaction) => filterType === 'all' || t.documentType === filterType;

  let filteredRest = restTransactions.filter(t => matchesSearch(t) && matchesFilter(t));

  // Sort (only non–Opening Balance)
  filteredRest = [...filteredRest].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'reference':
        comparison = a.referenceNo.localeCompare(b.referenceNo);
        break;
      case 'type':
        comparison = a.documentType.localeCompare(b.documentType);
        break;
      case 'debit':
        comparison = a.debit - b.debit;
        break;
      case 'credit':
        comparison = a.credit - b.credit;
        break;
      case 'balance':
        comparison = a.runningBalance - b.runningBalance;
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Opening Balance first, then sorted rest
  const filteredTransactions = openingBalanceEntry
    ? [openingBalanceEntry, ...filteredRest]
    : filteredRest;

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = new Date(transaction.date).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    // Sale: full Sale Transaction Details page opens via parent (ViewSaleDetailsDrawer) – hide sidebar panel
    // Payment/other: show detail panel in sidebar
    setShowDetailPanel(transaction.documentType !== 'Sale');
    onTransactionClick(transaction);
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter(f => f !== filter));
  };

  // Period stats (exclude Opening Balance row)
  const periodTransactions = filteredTransactions.filter(t => t.documentType !== 'Opening Balance');
  const stats = {
    totalDebit: periodTransactions.reduce((sum, t) => sum + t.debit, 0),
    totalCredit: periodTransactions.reduce((sum, t) => sum + t.credit, 0),
    netBalance: periodTransactions.reduce((sum, t) => sum + t.debit - t.credit, 0),
    salesCount: periodTransactions.filter(t => t.documentType === 'Sale').length,
    paymentsCount: periodTransactions.filter(t => t.documentType === 'Payment').length,
    discountsCount: periodTransactions.filter(t => t.documentType === 'Discount').length,
    avgTransaction: periodTransactions.length > 0
      ? (periodTransactions.reduce((sum, t) => sum + (t.debit || t.credit), 0) / periodTransactions.length)
      : 0,
    highestTransaction: periodTransactions.length > 0 ? Math.max(...periodTransactions.map(t => t.debit || t.credit || 0)) : 0,
    lowestTransaction: periodTransactions.filter(t => t.debit > 0 || t.credit > 0).length > 0
      ? Math.min(...periodTransactions.filter(t => t.debit > 0 || t.credit > 0).map(t => t.debit || t.credit))
      : 0,
    withNotes: periodTransactions.filter(t => t.notes).length,
    linkedTransactions: periodTransactions.filter(t => t.linkedInvoices && t.linkedInvoices.length > 0).length,
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 text-gray-500" />;
    return sortOrder === 'asc' 
      ? <ChevronDown className="w-3.5 h-3.5 text-blue-500 rotate-180" />
      : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Top Stats Bar – same card style as Products page */}
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Entries</p>
              <p className="text-2xl font-bold text-white mt-1">{filteredTransactions.length}</p>
              <p className="text-xs text-gray-500 mt-1">of {transactions.length} total</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Debit</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">Rs {stats.totalDebit.toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">Sales ({stats.salesCount})</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Credit</p>
              <p className="text-2xl font-bold text-green-400 mt-1">Rs {stats.totalCredit.toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">Payments ({stats.paymentsCount})</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <ArrowDownRight className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Net Balance</p>
              <p className={`text-2xl font-bold mt-1 ${stats.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>Rs {Math.abs(stats.netBalance).toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.netBalance >= 0 ? 'Receivable' : 'Payable'}</p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stats.netBalance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <DollarSign className={`w-6 h-6 ${stats.netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Average Value</p>
              <p className="text-2xl font-bold text-white mt-1">Rs {stats.avgTransaction.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500 mt-1">Per transaction</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">With Details</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.withNotes}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.linkedTransactions} linked</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar – same style as Products (bg-gray-900, border-gray-700) */}
      <div className="rounded-xl p-4 bg-gray-900/50 border border-gray-800">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search transactions by reference, description, payment method, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white placeholder:text-gray-500 focus:border-gray-600"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select className="px-3 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white">
              {savedViews.map((view) => (
                <option key={view}>{view}</option>
              ))}
            </select>
            <button className="p-2.5 rounded-lg transition-colors bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800" title="Save current view">
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* View Mode Pills – Products-style dark */}
            <div className="flex items-center rounded-lg p-1 bg-gray-900/50 border border-gray-800">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/30'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'grouped' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/30'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Grouped
              </button>
              <button
                onClick={() => setViewMode('classic')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'classic' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/30'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Classic
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'compact' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/30'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Compact
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/30'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'analytics' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/30'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                Analytics
              </button>
            </div>

            {/* Quick Filters */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2.5 rounded-lg text-sm focus:outline-none bg-gray-950 border border-gray-700 text-white"
            >
              <option value="all">All Types ({filteredTransactions.length})</option>
              <option value="Sale">Sales ({stats.salesCount})</option>
              <option value="Payment">Payments ({stats.paymentsCount})</option>
              <option value="Discount">Discounts ({stats.discountsCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAdvancedFilter(true)}
              className="px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Advanced
            </button>
            <button 
              onClick={() => setShowCustomizeModal(true)}
              className="px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <Settings2 className="w-4 h-4" />
              Customize
            </button>
            <button 
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Chips */}
      {(activeFilters.length > 0 || searchTerm || filterType !== 'all') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Active filters:</span>
          {searchTerm && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs border border-gray-700">
              <Search className="w-3 h-3" />
              Search: "{searchTerm}"
              <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-blue-300">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
          {filterType !== 'all' && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs border border-gray-700">
              <Filter className="w-3 h-3" />
              Type: {filterType}
              <button onClick={() => setFilterType('all')} className="ml-1 hover:text-white">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
          {activeFilters.map((filter) => (
            <div key={filter} className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs border border-gray-700">
              {filter}
              <button onClick={() => removeFilter(filter)} className="ml-1 hover:text-white">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setActiveFilters([]);
            }}
            className="text-xs text-gray-500 hover:text-white underline font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex gap-4">
        {/* Transactions List */}
        <div className={`transition-all ${showDetailPanel ? 'flex-1' : 'w-full'}`}>
          {/* Timeline View */}
          {viewMode === 'timeline' && (
            <TransactionTimeline
              transactions={filteredTransactions}
              onTransactionClick={handleTransactionClick}
            />
          )}

          {/* Analytics View */}
          {viewMode === 'analytics' && (
            <TransactionAnalytics
              transactions={filteredTransactions}
              stats={stats}
            />
          )}

          {/* Table View - Simplified & Clean */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto border border-gray-800 rounded-xl bg-gray-900/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-950/95 border-b border-gray-800">
                    {visibleColumns.date && (
                      <th 
                        className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-white">Date</span>
                          <SortIcon field="date" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.reference && (
                      <th 
                        className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => handleSort('reference')}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-white">Reference</span>
                          <SortIcon field="reference" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th 
                        className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-gray-500" />
                          <span className="text-white">Type</span>
                          <SortIcon field="type" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.description && (
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-500" />
                          <span className="text-white">Description & Notes</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.paymentAccount && (
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="text-white">Payment Method</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.debit && (
                      <th 
                        className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => handleSort('debit')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <ArrowUpRight className="w-4 h-4 text-orange-500" />
                          <span className="text-white">Debit</span>
                          <SortIcon field="debit" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.credit && (
                      <th 
                        className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => handleSort('credit')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                          <span className="text-white">Credit</span>
                          <SortIcon field="credit" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.balance && (
                      <th 
                        className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-800/50"
                        onClick={() => handleSort('balance')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <DollarSign className="w-4 h-4 text-blue-500" />
                          <span className="text-white">Balance</span>
                          <SortIcon field="balance" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction, index) => (
                    <tr
                      key={transaction.id}
                      onClick={() => handleTransactionClick(transaction)}
                      className={`transition-all group cursor-pointer border-b border-gray-800 ${
                        index % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'
                      } hover:bg-gray-800/50 ${
                        selectedTransaction?.id === transaction.id ? 'ring-2 ring-blue-500 ring-inset bg-blue-500/10' : ''
                      }`}
                    >
                      {visibleColumns.date && (
                        <td className="px-5 py-4 whitespace-nowrap text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs bg-blue-600 text-white">
                              {new Date(transaction.date).getDate()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{new Date(transaction.date).toLocaleDateString('en-GB', { month: 'short' })}</div>
                              <div className="text-xs text-gray-500">{new Date(transaction.date).getFullYear()}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.reference && (
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-white hover:text-blue-400 flex items-center gap-1">
                              {transaction.referenceNo}
                              <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {transaction.linkedInvoices && transaction.linkedInvoices.length > 0 && (
                              <div className="px-1.5 py-0.5 rounded text-xs flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-gray-700" title="Linked invoices">
                                <Link2 className="w-3 h-3" />
                                {transaction.linkedInvoices.length}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${getDocumentStyle(transaction.documentType)}`}>
                            {getDocumentIcon(transaction.documentType)}
                            {transaction.documentType}
                          </span>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="px-5 py-4 max-w-md text-white">
                          <div className="text-sm font-medium mb-1 text-white">{transaction.description}</div>
                          {transaction.notes && (
                            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-yellow-400" />
                              <span className="text-xs leading-relaxed text-yellow-300/90">{transaction.notes}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.paymentAccount && (
                        <td className="px-5 py-4 text-white">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-900/80 border border-gray-800">
                              <CreditCard className="w-4 h-4 text-gray-500" />
                            </div>
                            <span className="font-medium text-white">{transaction.paymentAccount}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.debit && (
                        <td className="px-5 py-4 text-right tabular-nums">
                          {transaction.debit > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-gray-700">
                              <ArrowUpRight className="w-4 h-4 text-orange-400" />
                              <span className="text-base font-bold text-orange-400">{formatAmount(transaction.debit)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-lg">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.credit && (
                        <td className="px-5 py-4 text-right tabular-nums">
                          {transaction.credit > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-gray-700">
                              <ArrowDownRight className="w-4 h-4 text-green-400" />
                              <span className="text-base font-bold text-green-400">{formatAmount(transaction.credit)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-lg">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.balance && (
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700">
                            <span className="text-base font-bold tabular-nums text-white">
                              {transaction.runningBalance.toLocaleString('en-PK')}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                
                {/* Table Footer with Totals */}
                <tfoot>
                  <tr className="bg-gray-950 border-t-2 border-gray-800">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                          <BarChart3 className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Total Summary</div>
                          <div className="text-xs text-gray-500">{filteredTransactions.length} transactions displayed</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-xs mb-1 text-gray-500">Total Debit</div>
                      <div className="text-lg font-bold tabular-nums text-white">Rs {stats.totalDebit.toLocaleString('en-PK')}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-xs mb-1 text-gray-500">Total Credit</div>
                      <div className="text-lg font-bold tabular-nums text-white">Rs {stats.totalCredit.toLocaleString('en-PK')}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-xs mb-1 text-gray-500">Net Balance</div>
                      <div className="text-lg font-bold tabular-nums text-white">Rs {Math.abs(stats.netBalance).toLocaleString('en-PK')}</div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Grouped View */}
          {viewMode === 'grouped' && (
            <TransactionGroupedView
              transactions={filteredTransactions}
              saleItemsMap={saleItemsMap}
              onTransactionClick={handleTransactionClick}
            />
          )}

          {/* Classic View - High-Density Ledger */}
          {viewMode === 'classic' && (
            <>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-5 py-3 mb-4 flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-white">Ledger View - Print & PDF</div>
                  <div className="text-xs text-gray-500 mt-0.5">Export ledger in standard accounting format</div>
                </div>
                <button
                  onClick={() => setShowLedgerPrint(true)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 bg-green-600 text-white hover:bg-green-500 transition-colors shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save PDF
                </button>
              </div>

              <TransactionClassicView
                transactions={filteredTransactions}
                saleItemsMap={saleItemsMap}
                onTransactionClick={handleTransactionClick}
              />
            </>
          )}

          {/* Compact View – Products-style dark */}
          {viewMode === 'compact' && (
            <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-900/50">
              <div>
                {filteredTransactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    onClick={() => handleTransactionClick(transaction)}
                    className={`px-6 py-3 cursor-pointer transition-all flex items-center justify-between group border-b border-gray-800 ${
                      index % 2 === 0 ? 'bg-transparent' : 'bg-gray-900/30'
                    } hover:bg-gray-800/50 ${
                      selectedTransaction?.id === transaction.id ? 'ring-2 ring-blue-500 ring-inset bg-blue-500/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-xs w-24 font-medium text-gray-500">
                        {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${getDocumentStyle(transaction.documentType)}`}>
                        {getDocumentIcon(transaction.documentType)}
                      </span>
                      <div className="text-sm font-medium min-w-[120px] text-blue-400">{transaction.referenceNo}</div>
                      <div className="text-sm flex-1 truncate text-white">{transaction.description}</div>
                      <div className="flex items-center gap-2">
                        {transaction.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-500" />}
                        {transaction.linkedInvoices && transaction.linkedInvoices.length > 0 && <Link2 className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {transaction.debit > 0 && (
                        <div className="text-sm text-orange-500 tabular-nums font-semibold min-w-[100px] text-right">
                          +{transaction.debit.toLocaleString('en-PK')}
                        </div>
                      )}
                      {transaction.credit > 0 && (
                        <div className="text-sm text-emerald-500 tabular-nums font-semibold min-w-[100px] text-right">
                          -{transaction.credit.toLocaleString('en-PK')}
                        </div>
                      )}
                      <div className="text-sm tabular-nums font-bold min-w-[120px] text-right rounded px-3 py-1 bg-gray-800/50 text-gray-300">
                        {transaction.runningBalance.toLocaleString('en-PK')}
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {showDetailPanel && selectedTransaction && (
          <TransactionDetailPanel
            transaction={selectedTransaction}
            onClose={() => setShowDetailPanel(false)}
          />
        )}
      </div>

      {/* Modals */}
      {showPrintModal && (
        <PrintExportModal
          transactions={filteredTransactions}
          visibleColumns={visibleColumns}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {showCustomizeModal && (
        <CustomizeColumnsModal
          visibleColumns={visibleColumns}
          onUpdate={setVisibleColumns}
          onClose={() => setShowCustomizeModal(false)}
        />
      )}

      {showAdvancedFilter && (
        <AdvancedFilterModal
          onClose={() => setShowAdvancedFilter(false)}
        />
      )}

      {/* Ledger Print/PDF Modal */}
      {showLedgerPrint && (
        <LedgerPrintView
          transactions={filteredTransactions}
          saleItemsMap={saleItemsMap}
          accountName={accountName}
          dateRange={dateRangeProp ?? (filteredTransactions.length > 0
            ? { from: filteredTransactions[0].date, to: filteredTransactions[filteredTransactions.length - 1].date }
            : { from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] })}
          openingBalance={openingBalanceProp}
          orientation={printOrientation}
          onClose={() => setShowLedgerPrint(false)}
        />
      )}
    </div>
  );
}