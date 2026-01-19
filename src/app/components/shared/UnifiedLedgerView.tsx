import React, { useState, useMemo } from 'react';
import { X, Receipt, TrendingUp, TrendingDown, Calendar, FileText, Printer, Download, BarChart3, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAccounting, type AccountingEntry } from '@/app/context/AccountingContext';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

// ============================================
// 🎯 TYPES
// ============================================

export type LedgerEntityType = 'supplier' | 'customer' | 'worker';

export interface LedgerViewProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: LedgerEntityType;
  entityName: string;
  entityId?: string;
}

// ============================================
// 🎯 DEMO DATA GENERATOR
// ============================================

const generateDemoTransactions = (entityType: LedgerEntityType, entityName: string): AccountingEntry[] => {
  // ✅ Safety check for undefined/null entityName
  if (!entityName) {
    entityName = entityType === 'supplier' ? 'Unknown Supplier' : 
                 entityType === 'customer' ? 'Unknown Customer' : 
                 'Unknown Worker';
  }
  
  const baseId = entityName.replace(/\s/g, '').toLowerCase();
  const now = new Date();
  
  const demos: AccountingEntry[] = [
    // Recent transactions (Last 7 days)
    {
      id: `${baseId}-001`,
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      source: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sale' : 'Payment',
      referenceNo: `${entityType === 'supplier' ? 'PUR' : entityType === 'customer' ? 'INV' : 'WKR'}-${Date.now().toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Inventory' : 'Cash - Main Counter',
      creditAccount: entityType === 'supplier' ? 'Accounts Payable' : entityType === 'customer' ? 'Sales Revenue' : 'Worker Payable',
      amount: 45000,
      description: `${entityType === 'supplier' ? 'Purchase order received' : entityType === 'customer' ? 'Invoice sale payment' : 'Worker service payment'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sales' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    {
      id: `${baseId}-002`,
      date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      source: 'Payment',
      referenceNo: `PAY-${Date.now().toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Accounts Payable' : 'Cash - Main Counter',
      creditAccount: entityType === 'supplier' ? 'Bank - HBL Business' : 'Accounts Receivable',
      amount: 15000,
      description: `${entityType === 'supplier' ? 'Partial payment to supplier' : entityType === 'customer' ? 'Payment received from customer' : 'Worker advance payment'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sales' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    // Last month
    {
      id: `${baseId}-003`,
      date: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      source: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Rental' : 'Payment',
      referenceNo: `${entityType === 'supplier' ? 'PUR' : entityType === 'customer' ? 'RNT' : 'WKR'}-${(Date.now() - 1000).toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Inventory' : 'Cash - Main Counter',
      creditAccount: entityType === 'supplier' ? 'Accounts Payable' : entityType === 'customer' ? 'Rental Income' : 'Worker Payable',
      amount: 85000,
      description: `${entityType === 'supplier' ? 'Bulk fabric purchase' : entityType === 'customer' ? 'Bridal rental booking' : 'Worker monthly salary'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Rental' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    {
      id: `${baseId}-004`,
      date: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      source: 'Payment',
      referenceNo: `PAY-${(Date.now() - 2000).toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Accounts Payable' : 'Mobile Wallet - JazzCash',
      creditAccount: entityType === 'supplier' ? 'Cash - Main Counter' : 'Accounts Receivable',
      amount: 30000,
      description: `${entityType === 'supplier' ? 'Cash payment to supplier' : entityType === 'customer' ? 'Digital payment received' : 'Worker bonus payment'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sales' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    // Older transactions (2-3 months ago)
    {
      id: `${baseId}-005`,
      date: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      source: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Studio' : 'Payment',
      referenceNo: `${entityType === 'supplier' ? 'PUR' : entityType === 'customer' ? 'STD' : 'WKR'}-${(Date.now() - 3000).toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Inventory' : 'Cash - Main Counter',
      creditAccount: entityType === 'supplier' ? 'Accounts Payable' : entityType === 'customer' ? 'Studio Income' : 'Worker Payable',
      amount: 120000,
      description: `${entityType === 'supplier' ? 'Premium material purchase' : entityType === 'customer' ? 'Studio photoshoot package' : 'Worker project payment'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Studio' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    {
      id: `${baseId}-006`,
      date: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      source: 'Payment',
      referenceNo: `PAY-${(Date.now() - 4000).toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Accounts Payable' : 'Bank - Meezan Current',
      creditAccount: entityType === 'supplier' ? 'Bank - HBL Business' : 'Accounts Receivable',
      amount: 50000,
      description: `${entityType === 'supplier' ? 'Bank transfer to supplier' : entityType === 'customer' ? 'Bank payment received' : 'Worker settlement'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sales' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    {
      id: `${baseId}-007`,
      date: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000),
      source: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sale' : 'Manual',
      referenceNo: `${entityType === 'supplier' ? 'PUR' : entityType === 'customer' ? 'INV' : 'WKR'}-${(Date.now() - 5000).toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Inventory' : 'Cash - Main Counter',
      creditAccount: entityType === 'supplier' ? 'Accounts Payable' : entityType === 'customer' ? 'Sales Revenue' : 'Worker Payable',
      amount: 95000,
      description: `${entityType === 'supplier' ? 'Seasonal stock purchase' : entityType === 'customer' ? 'Full payment sale' : 'Worker advance'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sales' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    },
    {
      id: `${baseId}-008`,
      date: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      source: 'Payment',
      referenceNo: `PAY-${(Date.now() - 6000).toString().slice(-4)}`,
      debitAccount: entityType === 'supplier' ? 'Accounts Payable' : 'Cash - Main Counter',
      creditAccount: entityType === 'supplier' ? 'Cash - Main Counter' : 'Accounts Receivable',
      amount: 40000,
      description: `${entityType === 'supplier' ? 'Final settlement payment' : entityType === 'customer' ? 'Advance payment received' : 'Worker final pay'} - ${entityName}`,
      module: entityType === 'supplier' ? 'Purchase' : entityType === 'customer' ? 'Sales' : 'Expense',
      metadata: {
        [`${entityType}Name`]: entityName,
        [`${entityType}Id`]: baseId
      }
    }
  ];

  return demos;
};

// ============================================
// 🎯 UNIFIED LEDGER VIEW
// ============================================

export const UnifiedLedgerView: React.FC<LedgerViewProps> = ({
  isOpen,
  onClose,
  entityType,
  entityName,
  entityId
}) => {
  const accounting = useAccounting();
  const [activeTab, setActiveTab] = useState<'summary' | 'detailed' | 'statement'>('summary');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');

  // Get entity-specific entries (combine real + demo data)
  const entries = useMemo(() => {
    let filtered = accounting.entries;

    // Filter by entity
    filtered = filtered.filter(entry => {
      const metadata = entry.metadata;
      if (!metadata) return false;

      switch (entityType) {
        case 'supplier':
          return metadata.supplierName === entityName || 
                 (entityId && metadata.supplierId === entityId);
        case 'customer':
          return metadata.customerName === entityName || 
                 (entityId && metadata.customerId === entityId);
        case 'worker':
          return metadata.workerName === entityName || 
                 (entityId && metadata.workerId === entityId);
        default:
          return false;
      }
    });

    // 🎯 ADD DEMO DATA if no real entries exist
    if (filtered.length === 0) {
      filtered = generateDemoTransactions(entityType, entityName);
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      const daysAgo = dateFilter === '7days' ? 7 : dateFilter === '30days' ? 30 : 90;
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(entry => entry.date >= cutoffDate);
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [accounting.entries, entityType, entityName, entityId, dateFilter]);

  // Calculate totals with running balance
  const { totals, entriesWithBalance } = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = 0;
    
    const withBalance = entries.map(entry => {
      // Determine if this is a debit or credit to the entity
      const isEntityDebit = 
        (entityType === 'supplier' && entry.debitAccount === 'Accounts Payable') ||
        (entityType === 'customer' && entry.creditAccount === 'Accounts Receivable') ||
        (entityType === 'worker' && entry.debitAccount === 'Worker Payable');

      if (isEntityDebit) {
        totalDebit += entry.amount;
        runningBalance -= entry.amount;
      } else {
        totalCredit += entry.amount;
        runningBalance += entry.amount;
      }

      return {
        ...entry,
        isDebit: isEntityDebit,
        runningBalance: Math.abs(runningBalance)
      };
    });

    const balance = totalCredit - totalDebit;

    return { 
      totals: { totalDebit, totalCredit, balance },
      entriesWithBalance: withBalance.reverse() // Show oldest first for running balance
    };
  }, [entries, entityType]);

  // Get entity-specific labels
  const getEntityLabels = () => {
    switch (entityType) {
      case 'supplier':
        return {
          title: 'Supplier Ledger',
          badge: 'bg-red-500/10 text-red-400 border-red-500/20',
          balanceLabel: 'Outstanding Payable',
          balanceColor: totals.balance > 0 ? 'text-red-400' : 'text-green-400'
        };
      case 'customer':
        return {
          title: 'Customer Ledger',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          balanceLabel: 'Outstanding Receivable',
          balanceColor: totals.balance > 0 ? 'text-yellow-400' : 'text-green-400'
        };
      case 'worker':
        return {
          title: 'Worker Ledger',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          balanceLabel: 'Outstanding Payable',
          balanceColor: totals.balance > 0 ? 'text-orange-400' : 'text-green-400'
        };
    }
  };

  const labels = getEntityLabels();

  // Get transaction type badge
  const getTransactionBadge = (entry: AccountingEntry) => {
    const styles = {
      Sale: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      Rental: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      Studio: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
      Expense: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      Purchase: 'bg-red-500/10 text-red-400 border-red-500/20',
      Payment: 'bg-green-500/10 text-green-400 border-green-500/20',
      Manual: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    };
    return styles[entry.source] || styles.Manual;
  };

  // Print handler
  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  // Export handlers
  const handleExportPDF = () => {
    toast.success('PDF export started');
    console.log('Exporting PDF ledger for:', entityName);
  };

  const handleExportExcel = () => {
    toast.success('Excel export started');
    console.log('Exporting Excel ledger for:', entityName);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog - BIGGER SIZE for Ledger */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-[95vw] lg:max-w-7xl max-h-[92vh] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-2xl font-bold text-white">{labels.title}</h2>
              <p className="text-sm text-gray-400 mt-1">Complete transaction history & financial statement</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Entity Info Card */}
          <div className="p-6 border-b border-gray-800 bg-gray-950/30">
            <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className={labels.badge}>
                      {entityType.toUpperCase()}
                    </Badge>
                    <h3 className="text-3xl font-bold text-white">{entityName}</h3>
                    {entityId && (
                      <span className="text-sm text-gray-500 font-mono">ID: {entityId}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Total Transactions</p>
                      <p className="text-2xl font-bold text-white">{entries.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Total Charges</p>
                      <p className="text-2xl font-bold text-red-400">Rs {totals.totalCredit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">Total Payments</p>
                      <p className="text-2xl font-bold text-green-400">Rs {totals.totalDebit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">{labels.balanceLabel}</p>
                      <p className={`text-3xl font-bold ${labels.balanceColor}`}>
                        Rs {Math.abs(totals.balance).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="h-20 w-20 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Receipt className="text-blue-400" size={40} />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs & Actions */}
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/20">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('summary')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'summary'
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                <BarChart3 size={16} className="inline mr-2" />
                Summary View
              </button>
              <button
                onClick={() => setActiveTab('detailed')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'detailed'
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                <FileText size={16} className="inline mr-2" />
                Detailed Report
              </button>
              <button
                onClick={() => setActiveTab('statement')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'statement'
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                <FileSpreadsheet size={16} className="inline mr-2" />
                Statement
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4">
                <Calendar size={16} className="text-gray-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Printer size={14} className="mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <Download size={14} className="mr-2" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <FileSpreadsheet size={14} className="mr-2" />
                Excel
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {entries.length === 0 ? (
              <div className="text-center py-16">
                <Receipt className="mx-auto text-gray-600 mb-4" size={64} />
                <p className="text-gray-500 text-lg">No transactions found</p>
                <p className="text-sm text-gray-600 mt-2">Transactions will appear here once recorded</p>
              </div>
            ) : (
              <>
                {/* SUMMARY VIEW */}
                {activeTab === 'summary' && (
                  <div className="space-y-3">
                    {entries.map((entry) => {
                      const isDebit = 
                        (entityType === 'supplier' && entry.debitAccount === 'Accounts Payable') ||
                        (entityType === 'customer' && entry.creditAccount === 'Accounts Receivable') ||
                        (entityType === 'worker' && entry.debitAccount === 'Worker Payable');

                      return (
                        <div
                          key={entry.id}
                          className="bg-gray-950/50 border border-gray-800 rounded-lg p-5 hover:bg-gray-800/30 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className={getTransactionBadge(entry)}>
                                  {entry.source}
                                </Badge>
                                <span className="text-blue-400 font-mono text-sm font-semibold">{entry.referenceNo}</span>
                                <span className="text-gray-500 text-sm">
                                  {entry.date.toLocaleDateString('en-GB')} {entry.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <p className="text-gray-300 mb-3">{entry.description}</p>

                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  {isDebit ? (
                                    <TrendingDown className="text-green-400" size={16} />
                                  ) : (
                                    <TrendingUp className="text-red-400" size={16} />
                                  )}
                                  <div>
                                    <span className="text-gray-500">
                                      {isDebit ? 'Payment Received' : 'New Charge'}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-500">Module: </span>
                                  <span className="text-gray-300 font-medium">{entry.module}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Entry: </span>
                                  <span className="text-gray-300 font-mono text-xs">{entry.id}</span>
                                </div>
                              </div>

                              <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">DR: </span>
                                  <span className="text-green-400 font-semibold">{entry.debitAccount}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">CR: </span>
                                  <span className="text-red-400 font-semibold">{entry.creditAccount}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right ml-6">
                              <p className={`text-3xl font-bold ${isDebit ? 'text-green-400' : 'text-red-400'}`}>
                                {isDebit ? '-' : '+'} Rs {entry.amount.toLocaleString()}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {isDebit ? 'Payment' : 'Charge'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* DETAILED REPORT VIEW */}
                {activeTab === 'detailed' && (
                  <div className="bg-gray-950/50 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-950 border-b border-gray-800">
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Date</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Ref No</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Description</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Type</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">DR Account</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">CR Account</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Debit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => {
                          const isDebit = 
                            (entityType === 'supplier' && entry.debitAccount === 'Accounts Payable') ||
                            (entityType === 'customer' && entry.creditAccount === 'Accounts Receivable') ||
                            (entityType === 'worker' && entry.debitAccount === 'Worker Payable');

                          return (
                            <tr key={entry.id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                              <td className="p-4 text-gray-400 text-sm">
                                {entry.date.toLocaleDateString('en-GB')}
                              </td>
                              <td className="p-4">
                                <span className="text-blue-400 font-mono text-sm">{entry.referenceNo}</span>
                              </td>
                              <td className="p-4 text-gray-300 text-sm max-w-xs truncate">
                                {entry.description}
                              </td>
                              <td className="p-4">
                                <Badge variant="outline" className={getTransactionBadge(entry)}>
                                  {entry.source}
                                </Badge>
                              </td>
                              <td className="p-4 text-green-400 text-sm font-medium">
                                {entry.debitAccount}
                              </td>
                              <td className="p-4 text-red-400 text-sm font-medium">
                                {entry.creditAccount}
                              </td>
                              <td className="p-4 text-right">
                                {isDebit ? (
                                  <span className="text-green-400 font-bold">Rs {entry.amount.toLocaleString()}</span>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                {!isDebit ? (
                                  <span className="text-red-400 font-bold">Rs {entry.amount.toLocaleString()}</span>
                                ) : (
                                  <span className="text-gray-600">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Totals Row */}
                        <tr className="bg-gray-950 font-bold">
                          <td colSpan={6} className="p-4 text-right text-white uppercase text-sm">
                            Total:
                          </td>
                          <td className="p-4 text-right text-green-400 text-lg">
                            Rs {totals.totalDebit.toLocaleString()}
                          </td>
                          <td className="p-4 text-right text-red-400 text-lg">
                            Rs {totals.totalCredit.toLocaleString()}
                          </td>
                        </tr>
                        <tr className="bg-blue-500/10 font-bold">
                          <td colSpan={6} className="p-4 text-right text-white uppercase text-sm">
                            {labels.balanceLabel}:
                          </td>
                          <td colSpan={2} className={`p-4 text-right text-2xl ${labels.balanceColor}`}>
                            Rs {Math.abs(totals.balance).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* STATEMENT VIEW (Running Balance) */}
                {activeTab === 'statement' && (
                  <div className="bg-gray-950/50 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="bg-gray-950 p-6 border-b border-gray-800">
                      <h3 className="text-lg font-bold text-white mb-2">Account Statement</h3>
                      <p className="text-sm text-gray-400">
                        Period: {dateFilter === 'all' ? 'All Time' : dateFilter === '7days' ? 'Last 7 Days' : dateFilter === '30days' ? 'Last 30 Days' : 'Last 90 Days'}
                      </p>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-900 border-b border-gray-800">
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Date</th>
                          <th className="text-left p-4 text-xs font-semibold text-gray-400 uppercase">Particulars</th>
                          <th className="text-center p-4 text-xs font-semibold text-gray-400 uppercase">Ref No</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Debit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Credit</th>
                          <th className="text-right p-4 text-xs font-semibold text-gray-400 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening Balance */}
                        <tr className="bg-blue-500/10 border-b border-gray-800 font-semibold">
                          <td className="p-4 text-gray-300">-</td>
                          <td className="p-4 text-white">Opening Balance</td>
                          <td className="p-4 text-center text-gray-500">-</td>
                          <td className="p-4 text-right text-gray-500">-</td>
                          <td className="p-4 text-right text-gray-500">-</td>
                          <td className="p-4 text-right text-white">Rs 0</td>
                        </tr>

                        {/* Transactions with running balance */}
                        {entriesWithBalance.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-800 hover:bg-gray-800/20 transition-colors">
                            <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                              {entry.date.toLocaleDateString('en-GB')}
                            </td>
                            <td className="p-4 text-gray-300 text-sm">
                              {entry.description}
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-blue-400 font-mono text-xs">{entry.referenceNo}</span>
                            </td>
                            <td className="p-4 text-right">
                              {entry.isDebit ? (
                                <span className="text-green-400 font-semibold">Rs {entry.amount.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {!entry.isDebit ? (
                                <span className="text-red-400 font-semibold">Rs {entry.amount.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <span className={cn(
                                "font-bold",
                                entry.runningBalance > 0 ? "text-yellow-400" : "text-green-400"
                              )}>
                                Rs {entry.runningBalance.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {/* Closing Balance */}
                        <tr className="bg-gray-950 font-bold border-t-2 border-blue-500/30">
                          <td colSpan={3} className="p-4 text-right text-white uppercase">
                            Closing Balance:
                          </td>
                          <td className="p-4 text-right text-green-400 text-lg">
                            Rs {totals.totalDebit.toLocaleString()}
                          </td>
                          <td className="p-4 text-right text-red-400 text-lg">
                            Rs {totals.totalCredit.toLocaleString()}
                          </td>
                          <td className={`p-4 text-right text-2xl ${labels.balanceColor}`}>
                            Rs {Math.abs(totals.balance).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-800 flex items-center justify-between bg-gray-950/50">
            <div className="text-sm text-gray-400">
              Showing <span className="text-white font-semibold">{entries.length}</span> transaction{entries.length !== 1 ? 's' : ''} 
              {dateFilter !== 'all' && <span className="ml-2">({dateFilter === '7days' ? 'Last 7 Days' : dateFilter === '30days' ? 'Last 30 Days' : 'Last 90 Days'})</span>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500 mr-4">
                Generated on {new Date().toLocaleDateString('en-GB')} at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <Button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};