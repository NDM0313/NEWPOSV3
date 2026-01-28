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
  onTransactionClick: (transaction: Transaction) => void;
}

type SortField = 'date' | 'reference' | 'type' | 'debit' | 'credit' | 'balance';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'table' | 'grouped' | 'classic' | 'compact' | 'timeline' | 'analytics';

export function TransactionsTab({ transactions, onTransactionClick }: TransactionsTabProps) {
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
      case 'Sale':
        return <FileText className="w-4 h-4" />;
      case 'Payment':
        return <CreditCard className="w-4 h-4" />;
      case 'Discount':
        return <Tag className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDocumentStyle = (type: string) => {
    switch (type) {
      case 'Sale':
        return 'text-blue-400';
      case 'Payment':
        return 'text-emerald-400';
      case 'Discount':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  // Filter and sort transactions
  let filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.paymentAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || t.documentType === filterType;
    return matchesSearch && matchesFilter;
  });

  // Sort transactions
  filteredTransactions = [...filteredTransactions].sort((a, b) => {
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
    setShowDetailPanel(true);
    onTransactionClick(transaction);
  };

  const removeFilter = (filter: string) => {
    setActiveFilters(activeFilters.filter(f => f !== filter));
  };

  // Calculate comprehensive stats
  const stats = {
    totalDebit: filteredTransactions.reduce((sum, t) => sum + t.debit, 0),
    totalCredit: filteredTransactions.reduce((sum, t) => sum + t.credit, 0),
    netBalance: filteredTransactions.reduce((sum, t) => sum + t.debit - t.credit, 0),
    salesCount: filteredTransactions.filter(t => t.documentType === 'Sale').length,
    paymentsCount: filteredTransactions.filter(t => t.documentType === 'Payment').length,
    discountsCount: filteredTransactions.filter(t => t.documentType === 'Discount').length,
    avgTransaction: filteredTransactions.length > 0 
      ? (filteredTransactions.reduce((sum, t) => sum + (t.debit || t.credit), 0) / filteredTransactions.length)
      : 0,
    highestTransaction: Math.max(...filteredTransactions.map(t => t.debit || t.credit || 0)),
    lowestTransaction: Math.min(...filteredTransactions.filter(t => t.debit > 0 || t.credit > 0).map(t => t.debit || t.credit)),
    withNotes: filteredTransactions.filter(t => t.notes).length,
    linkedTransactions: filteredTransactions.filter(t => t.linkedInvoices && t.linkedInvoices.length > 0).length,
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 text-slate-400" />;
    return sortOrder === 'asc' 
      ? <ChevronDown className="w-3.5 h-3.5 text-blue-600 rotate-180" />
      : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Top Stats Bar */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 border border-blue-400 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <Zap className="w-4 h-4 text-white/60" />
          </div>
          <div className="text-xs text-blue-100 mb-1">Total Entries</div>
          <div className="text-2xl text-white font-bold">{filteredTransactions.length}</div>
          <div className="text-xs text-blue-200 mt-1">of {transactions.length} total</div>
        </div>

        <div 
          className="rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: '#f97316' }} />
            </div>
            <div className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#f97316' }}>{stats.salesCount}</div>
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Total Debit</div>
          <div className="text-lg font-semibold" style={{ color: '#f97316' }}>Rs {stats.totalDebit.toLocaleString('en-PK')}</div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>Sales recorded</div>
        </div>

        <div 
          className="rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
              <ArrowDownRight className="w-5 h-5" style={{ color: '#10b981' }} />
            </div>
            <div className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>{stats.paymentsCount}</div>
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Total Credit</div>
          <div className="text-lg font-semibold" style={{ color: '#10b981' }}>Rs {stats.totalCredit.toLocaleString('en-PK')}</div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>Payments received</div>
        </div>

        <div 
          className="rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>
              <DollarSign className="w-5 h-5" style={{ color: '#a855f7' }} />
            </div>
            <TrendingUp className={`w-4 h-4 ${stats.netBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Net Balance</div>
          <div className={`text-lg font-semibold ${stats.netBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            Rs {Math.abs(stats.netBalance).toLocaleString('en-PK')}
          </div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>{stats.netBalance >= 0 ? 'Receivable' : 'Payable'}</div>
        </div>

        <div 
          className="rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.2)' }}>
              <BarChart3 className="w-5 h-5" style={{ color: '#6366f1' }} />
            </div>
            <History className="w-4 h-4" style={{ color: '#64748b' }} />
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Average Value</div>
          <div className="text-lg font-semibold" style={{ color: '#6366f1' }}>Rs {stats.avgTransaction.toLocaleString('en-PK', { maximumFractionDigits: 0 })}</div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>Per transaction</div>
        </div>

        <div 
          className="rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245, 158, 11, 0.2)' }}>
              <MessageSquare className="w-5 h-5" style={{ color: '#f59e0b' }} />
            </div>
            <Link2 className="w-4 h-4" style={{ color: '#64748b' }} />
          </div>
          <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>With Details</div>
          <div className="text-lg font-semibold" style={{ color: '#f59e0b' }}>{stats.withNotes}</div>
          <div className="text-xs mt-1" style={{ color: '#64748b' }}>{stats.linkedTransactions} linked</div>
        </div>
      </div>

      {/* Advanced Control Bar */}
      <div 
        className="rounded-xl p-4"
        style={{ 
          background: 'linear-gradient(to right, rgba(100, 116, 139, 0.1), rgba(59, 130, 246, 0.08))',
          border: '1px solid rgba(100, 116, 139, 0.2)'
        }}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search transactions by reference, description, payment method, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              style={{ 
                background: 'rgba(30, 41, 59, 0.3)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#e2e8f0'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Saved Views Dropdown */}
            <select 
              className="px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                background: 'rgba(30, 41, 59, 0.3)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#e2e8f0'
              }}
            >
              {savedViews.map((view) => (
                <option key={view}>{view}</option>
              ))}
            </select>

            <button 
              className="p-2.5 rounded-lg transition-colors" 
              title="Save current view"
              style={{ 
                background: 'rgba(30, 41, 59, 0.3)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#cbd5e1'
              }}
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* View Mode Pills */}
            <div 
              className="flex items-center rounded-lg p-1 shadow-sm"
              style={{ 
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(100, 116, 139, 0.3)'
              }}
            >
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
                style={viewMode !== 'table' ? { color: '#94a3b8' } : {}}
                onMouseEnter={(e) => {
                  if (viewMode !== 'table') e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'table') e.currentTarget.style.background = 'transparent';
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'grouped' ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
                style={viewMode !== 'grouped' ? { color: '#94a3b8' } : {}}
                onMouseEnter={(e) => {
                  if (viewMode !== 'grouped') e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'grouped') e.currentTarget.style.background = 'transparent';
                }}
              >
                <Calendar className="w-3.5 h-3.5" />
                Grouped
              </button>
              <button
                onClick={() => setViewMode('classic')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'classic' ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
                style={viewMode !== 'classic' ? { color: '#94a3b8' } : {}}
                onMouseEnter={(e) => {
                  if (viewMode !== 'classic') e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'classic') e.currentTarget.style.background = 'transparent';
                }}
              >
                <Grid className="w-3.5 h-3.5" />
                Classic
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'compact' ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
                style={viewMode !== 'compact' ? { color: '#94a3b8' } : {}}
                onMouseEnter={(e) => {
                  if (viewMode !== 'compact') e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'compact') e.currentTarget.style.background = 'transparent';
                }}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Compact
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
                style={viewMode !== 'timeline' ? { color: '#94a3b8' } : {}}
                onMouseEnter={(e) => {
                  if (viewMode !== 'timeline') e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'timeline') e.currentTarget.style.background = 'transparent';
                }}
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
                  viewMode === 'analytics' ? 'bg-blue-600 text-white shadow-sm' : ''
                }`}
                style={viewMode !== 'analytics' ? { color: '#94a3b8' } : {}}
                onMouseEnter={(e) => {
                  if (viewMode !== 'analytics') e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'analytics') e.currentTarget.style.background = 'transparent';
                }}
              >
                <PieChart className="w-3.5 h-3.5" />
                Analytics
              </button>
            </div>

            {/* Quick Filters */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              style={{ 
                background: 'rgba(30, 41, 59, 0.3)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#e2e8f0'
              }}
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
              className="px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
              style={{ 
                background: 'rgba(30, 41, 59, 0.3)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#cbd5e1'
              }}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Advanced
            </button>

            <button 
              onClick={() => setShowCustomizeModal(true)}
              className="px-4 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
              style={{ 
                background: 'rgba(30, 41, 59, 0.3)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                color: '#cbd5e1'
              }}
            >
              <Settings2 className="w-4 h-4" />
              Customize
            </button>

            <button 
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
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
          <span className="text-xs text-slate-600 font-medium">Active filters:</span>
          {searchTerm && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs border border-blue-200">
              <Search className="w-3 h-3" />
              Search: "{searchTerm}"
              <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-blue-900">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
          {filterType !== 'all' && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs border border-purple-200">
              <Filter className="w-3 h-3" />
              Type: {filterType}
              <button onClick={() => setFilterType('all')} className="ml-1 hover:text-purple-900">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}
          {activeFilters.map((filter) => (
            <div key={filter} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs border border-emerald-200">
              {filter}
              <button onClick={() => removeFilter(filter)} className="ml-1 hover:text-emerald-900">
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
            className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
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
            <div className="overflow-x-auto border rounded-xl shadow-sm" style={{ borderColor: '#334155', background: '#273548' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1e293b', borderBottom: '2px solid #334155' }}>
                    {visibleColumns.date && (
                      <th 
                        className="px-5 py-4 text-left text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" style={{ color: '#94a3b8' }} />
                          <span style={{ color: '#ffffff' }}>Date</span>
                          <SortIcon field="date" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.reference && (
                      <th 
                        className="px-5 py-4 text-left text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                        onClick={() => handleSort('reference')}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" style={{ color: '#94a3b8' }} />
                          <span style={{ color: '#ffffff' }}>Reference</span>
                          <SortIcon field="reference" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th 
                        className="px-5 py-4 text-left text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4" style={{ color: '#94a3b8' }} />
                          <span style={{ color: '#ffffff' }}>Type</span>
                          <SortIcon field="type" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.description && (
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" style={{ color: '#94a3b8' }} />
                          <span style={{ color: '#ffffff' }}>Description & Notes</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.paymentAccount && (
                      <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#94a3b8' }}>
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" style={{ color: '#94a3b8' }} />
                          <span style={{ color: '#ffffff' }}>Payment Method</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.debit && (
                      <th 
                        className="px-5 py-4 text-right text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                        onClick={() => handleSort('debit')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <ArrowUpRight className="w-4 h-4 text-orange-500" />
                          <span style={{ color: '#ffffff' }}>Debit</span>
                          <SortIcon field="debit" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.credit && (
                      <th 
                        className="px-5 py-4 text-right text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                        onClick={() => handleSort('credit')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                          <span style={{ color: '#ffffff' }}>Credit</span>
                          <SortIcon field="credit" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.balance && (
                      <th 
                        className="px-5 py-4 text-right text-xs font-bold cursor-pointer transition-colors uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1e293b'}
                        onClick={() => handleSort('balance')}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <DollarSign className="w-4 h-4 text-blue-500" />
                          <span style={{ color: '#ffffff' }}>Balance</span>
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
                      style={{
                        borderBottom: '1px solid #334155',
                        background: index % 2 === 0 ? '#273548' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedTransaction?.id !== transaction.id) {
                          e.currentTarget.style.background = '#334155';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTransaction?.id !== transaction.id) {
                          e.currentTarget.style.background = index % 2 === 0 ? '#273548' : 'transparent';
                        }
                      }}
                      className={`transition-all group ${
                        selectedTransaction?.id === transaction.id 
                          ? 'ring-2 ring-blue-500 ring-inset' 
                          : ''
                      }`}
                    >
                      {visibleColumns.date && (
                        <td className="px-5 py-4 whitespace-nowrap" style={{ color: '#ffffff' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs" style={{ background: '#3b82f6', color: '#ffffff' }}>
                              {new Date(transaction.date).getDate()}
                            </div>
                            <div>
                              <div className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{new Date(transaction.date).toLocaleDateString('en-GB', { month: 'short' })}</div>
                              <div className="text-xs" style={{ color: '#64748b' }}>{new Date(transaction.date).getFullYear()}</div>
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
                              <div className="px-1.5 py-0.5 rounded text-xs flex items-center gap-1" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }} title="Linked invoices">
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
                        <td className="px-5 py-4 max-w-md" style={{ color: '#ffffff' }}>
                          <div className="text-sm font-medium mb-1" style={{ color: '#ffffff' }}>
                            {transaction.description}
                          </div>
                          {transaction.notes && (
                            <div className="flex items-start gap-2 mt-2 p-2 rounded-lg" style={{
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: 'none'
                            }}>
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                              <span className="text-xs leading-relaxed" style={{ color: '#fbbf24' }}>{transaction.notes}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.paymentAccount && (
                        <td className="px-5 py-4" style={{ color: '#ffffff' }}>
                          <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1e293b' }}>
                              <CreditCard className="w-4 h-4" style={{ color: '#94a3b8' }} />
                            </div>
                            <span className="font-medium" style={{ color: '#ffffff' }}>{transaction.paymentAccount}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.debit && (
                        <td className="px-5 py-4 text-right tabular-nums">
                          {transaction.debit > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                              background: 'rgba(249, 115, 22, 0.1)',
                              border: 'none'
                            }}>
                              <ArrowUpRight className="w-4 h-4" style={{ color: '#f97316' }} />
                              <span className="text-base font-bold" style={{ color: '#fb923c' }}>{formatAmount(transaction.debit)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-lg">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.credit && (
                        <td className="px-5 py-4 text-right tabular-nums">
                          {transaction.credit > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: 'none'
                            }}>
                              <ArrowDownRight className="w-4 h-4" style={{ color: '#10b981' }} />
                              <span className="text-base font-bold" style={{ color: '#34d399' }}>{formatAmount(transaction.credit)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-lg">-</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.balance && (
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg" style={{
                            background: 'rgba(148, 163, 184, 0.15)'
                          }}>
                            <span className="text-base font-bold tabular-nums" style={{ color: '#ffffff' }}>
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
                  <tr style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)', borderTop: '2px solid #1e40af' }}>
                    <td colSpan={5} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Total Summary</div>
                          <div className="text-xs" style={{ color: '#bfdbfe' }}>{filteredTransactions.length} transactions displayed</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-xs mb-1" style={{ color: '#bfdbfe' }}>Total Debit</div>
                      <div className="text-lg font-bold tabular-nums text-white">Rs {stats.totalDebit.toLocaleString('en-PK')}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-xs mb-1" style={{ color: '#bfdbfe' }}>Total Credit</div>
                      <div className="text-lg font-bold tabular-nums text-white">Rs {stats.totalCredit.toLocaleString('en-PK')}</div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="text-xs mb-1" style={{ color: '#bfdbfe' }}>Net Balance</div>
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
              onTransactionClick={handleTransactionClick}
            />
          )}

          {/* Classic View - High-Density Ledger */}
          {viewMode === 'classic' && (
            <>
              {/* Print/PDF Controls for Classic View */}
              <div 
                style={{ 
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: '700' }}>
                    Ledger View - Print & PDF
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>
                    Export ledger in standard accounting format
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Print/PDF Button */}
                  <button
                    onClick={() => setShowLedgerPrint(true)}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#059669';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 10px -1px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#10b981';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <Printer className="w-4 h-4" />
                    Print / Save PDF
                  </button>
                </div>
              </div>

              <TransactionClassicView
                transactions={filteredTransactions}
                onTransactionClick={handleTransactionClick}
              />
            </>
          )}

          {/* Compact View */}
          {viewMode === 'compact' && (
            <div 
              className="rounded-xl overflow-hidden shadow-sm"
              style={{ 
                border: '1px solid rgba(100, 116, 139, 0.3)',
                background: '#273548'
              }}
            >
              <div>
                {filteredTransactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    onClick={() => handleTransactionClick(transaction)}
                    className="px-6 py-3 cursor-pointer transition-all flex items-center justify-between group"
                    style={{
                      background: selectedTransaction?.id === transaction.id 
                        ? 'rgba(59, 130, 246, 0.15)'
                        : index % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)',
                      borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                      ...(selectedTransaction?.id === transaction.id && {
                        boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.4)'
                      })
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTransaction?.id !== transaction.id) {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTransaction?.id !== transaction.id) {
                        e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)';
                      }
                    }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-xs w-24 font-medium" style={{ color: '#64748b' }}>
                        {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${getDocumentStyle(transaction.documentType)}`}>
                        {getDocumentIcon(transaction.documentType)}
                      </span>
                      <div className="text-sm font-medium min-w-[120px]" style={{ color: '#60a5fa' }}>{transaction.referenceNo}</div>
                      <div className="text-sm flex-1 truncate" style={{ color: '#cbd5e1' }}>{transaction.description}</div>
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
                      <div 
                        className="text-sm tabular-nums font-bold min-w-[120px] text-right rounded px-3 py-1"
                        style={{ 
                          background: 'rgba(100, 116, 139, 0.2)',
                          color: '#e2e8f0'
                        }}
                      >
                        {transaction.runningBalance.toLocaleString('en-PK')}
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-4 h-4" style={{ color: '#64748b' }} />
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
          accountName="Abdul Rehman Traders" 
          dateRange={{
            from: filteredTransactions.length > 0 ? filteredTransactions[0].date : new Date().toISOString(),
            to: filteredTransactions.length > 0 ? filteredTransactions[filteredTransactions.length - 1].date : new Date().toISOString()
          }}
          openingBalance={50000}
          orientation={printOrientation}
          onClose={() => setShowLedgerPrint(false)}
        />
      )}
    </div>
  );
}