'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Download, Calendar, Search, FileText, Printer, FileSpreadsheet,
  ArrowLeft, TrendingUp, TrendingDown, MapPin, Building2
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { contactService } from '@/app/services/contactService';
import { branchService, Branch } from '@/app/services/branchService';
import { CalendarDateRangePicker } from '@/app/components/ui/CalendarDateRangePicker';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';
import { TransactionDetailModal } from './TransactionDetailModal';

interface CustomerLedgerPageProps {
  customerId: string;
  customerName: string;
  customerCode?: string;
  onClose: () => void;
}

export const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({
  customerId,
  customerName,
  customerCode,
  onClose,
}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const [ledgerEntries, setLedgerEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(contextBranchId);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        setBranches(branchesData);
      } catch (error) {
        console.error('[CUSTOMER LEDGER] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // Load ledger
  useEffect(() => {
    if (customerId && companyId) {
      loadLedger();
    }
  }, [customerId, companyId, selectedBranchId, dateRange]);

  const loadLedger = async () => {
    if (!customerId || !companyId) return;

    setLoading(true);
    try {
      const startDate = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

      const entries = await accountingService.getCustomerLedger(
        customerId,
        companyId,
        selectedBranchId,
        startDate,
        endDate,
        searchTerm.trim() || undefined
      );

      setLedgerEntries(entries);
      
      // Calculate opening balance (first entry's running balance minus first entry's change)
      if (entries.length > 0) {
        const firstEntry = entries[0];
        const firstChange = (firstEntry.debit || 0) - (firstEntry.credit || 0);
        setOpeningBalance(firstEntry.running_balance - firstChange);
      } else {
        setOpeningBalance(0);
      }
    } catch (error: any) {
      console.error('[CUSTOMER LEDGER] Error loading ledger:', error);
      toast.error('Failed to load customer ledger');
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) {
      return ledgerEntries;
    }

    const search = searchTerm.toLowerCase().trim();
    
    return ledgerEntries.filter(entry => {
      // Reference number match (JE-0047, EXP-0001, etc.)
      if (entry.reference_number?.toLowerCase().includes(search)) return true;
      
      // Description match
      if (entry.description?.toLowerCase().includes(search)) return true;
      
      // Amount match (partial)
      const amountStr = ((entry.debit || 0) + (entry.credit || 0)).toString();
      if (amountStr.includes(search)) return true;
      
      // Source module match
      if (entry.source_module?.toLowerCase().includes(search)) return true;
      
      return false;
    });
  }, [ledgerEntries, searchTerm]);

  const totals = useMemo(() => {
    const totalCharges = filteredEntries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    const totalPayments = filteredEntries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalDiscounts = 0; // TODO: Calculate from discount entries
    const outstandingBalance = filteredEntries.length > 0 
      ? filteredEntries[filteredEntries.length - 1].running_balance 
      : openingBalance;
    
    return {
      totalCharges,
      totalPayments,
      totalDiscounts,
      outstandingBalance,
    };
  }, [filteredEntries, openingBalance]);

  const closingBalance = filteredEntries.length > 0 
    ? filteredEntries[filteredEntries.length - 1].running_balance 
    : openingBalance;

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const handleExportPDF = () => {
    toast.info('PDF export feature coming soon');
  };

  const handleExportExcel = () => {
    toast.info('Excel export feature coming soon');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReferenceClick = (referenceNumber: string) => {
    setSelectedReference(referenceNumber);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Customer Ledger</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-lg font-semibold text-gray-200">{customerName}</span>
              {customerCode && (
                <Badge variant="outline" className="bg-gray-800 text-gray-400 border-gray-700">
                  {customerCode}
                </Badge>
              )}
              {selectedBranch && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Building2 size={14} />
                  <span>{selectedBranch.code ? `${selectedBranch.code} | ${selectedBranch.name}` : selectedBranch.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="bg-gray-950 border-b border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Total Charges</p>
            <p className="text-2xl font-bold text-red-400">
              Rs {totals.totalCharges.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Total Payments</p>
            <p className="text-2xl font-bold text-green-400">
              Rs {totals.totalPayments.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Total Discounts</p>
            <p className="text-2xl font-bold text-yellow-400">
              Rs {totals.totalDiscounts.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase mb-1">Outstanding Balance</p>
            <p className={cn(
              "text-2xl font-bold",
              totals.outstandingBalance >= 0 ? "text-yellow-400" : "text-green-400"
            )}>
              Rs {Math.abs(totals.outstandingBalance).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {/* Opening/Closing Balance */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-gray-400">Opening Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                openingBalance >= 0 ? "text-yellow-400" : "text-green-400"
              )}>
                Rs {openingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Closing Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                closingBalance >= 0 ? "text-yellow-400" : "text-green-400"
              )}>
                Rs {closingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 flex-1">
          {/* Global Search - WIDE and PROMINENT */}
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search by reference (JE-0047), description, customer, invoice, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-2.5 bg-gray-800 border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Compact Branch Filter */}
          <div className="flex items-center gap-2 min-w-[180px]">
            <Building2 size={16} className="text-gray-400" />
            <select
              value={selectedBranchId || 'all'}
              onChange={(e) => {
                const newBranchId = e.target.value === 'all' ? undefined : e.target.value;
                setSelectedBranchId(newBranchId);
                // Trigger reload when branch changes
                if (customerId && companyId) {
                  loadLedger();
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 flex-1"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.code ? `${branch.code} | ${branch.name}` : branch.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Compact Date Range */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <CalendarDateRangePicker
              dateRange={dateRange}
              onDateRangeChange={(range) => {
                setDateRange(range);
                // Auto-reload on date change
                if (customerId && companyId) {
                  setTimeout(() => loadLedger(), 100);
                }
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto bg-gray-950">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading ledger...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No ledger entries found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 sticky top-0 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-400 uppercase">
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reference No</th>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Running Balance</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-blue-500/10 border-b border-gray-800 font-semibold">
                  <td className="px-4 py-3 text-gray-300">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                  <td className="px-4 py-3 text-white">Opening Balance</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className="px-4 py-3 text-right text-gray-500">-</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-bold",
                    openingBalance >= 0 ? "text-yellow-400" : "text-green-400"
                  )}>
                    Rs {openingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">-</td>
                </tr>

                {filteredEntries.map((entry, index) => {
                  const branch = branches.find(b => {
                    // Try to find branch from journal entry if available
                    return false; // TODO: Get branch from entry
                  });

                  return (
                    <tr
                      key={`${entry.journal_entry_id}-${index}`}
                      className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {format(new Date(entry.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleReferenceClick(entry.reference_number)}
                          className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                        >
                          {entry.reference_number}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-gray-700 text-gray-300 text-xs">
                          {entry.source_module}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{entry.description}</td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right tabular-nums",
                        entry.debit > 0 ? "text-green-400" : "text-gray-500"
                      )}>
                        {entry.debit > 0 ? (
                          <span>Rs {entry.debit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm text-right tabular-nums",
                        entry.credit > 0 ? "text-red-400" : "text-gray-500"
                      )}>
                        {entry.credit > 0 ? (
                          <span>Rs {entry.credit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                        entry.running_balance >= 0 ? "text-yellow-400" : "text-green-400"
                      )}>
                        Rs {entry.running_balance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {entry.branch_name || (branch ? (branch.code ? `${branch.code} | ${branch.name}` : branch.name) : '-')}
                      </td>
                    </tr>
                  );
                })}

                {/* Closing Balance Row */}
                <tr className="bg-gray-900 font-bold border-t-2 border-blue-500/30">
                  <td colSpan={4} className="px-4 py-3 text-right text-white uppercase text-sm">
                    Closing Balance:
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 text-lg">
                    Rs {totals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-right text-red-400 text-lg">
                    Rs {totals.totalCharges.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className={cn(
                    "px-4 py-3 text-right text-2xl",
                    closingBalance >= 0 ? "text-yellow-400" : "text-green-400"
                  )}>
                    Rs {Math.abs(closingBalance).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedReference && (
        <TransactionDetailModal
          isOpen={!!selectedReference}
          onClose={() => setSelectedReference(null)}
          referenceNumber={selectedReference}
          companyId={companyId || ''}
        />
      )}
    </div>
  );
};
