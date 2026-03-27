'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Calendar, Search, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { accountingService, AccountLedgerEntry } from '@/app/services/accountingService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { supabase } from '@/lib/supabase';
import { CalendarDateRangePicker } from '@/app/components/ui/CalendarDateRangePicker';
import { format } from 'date-fns';
import { cn } from '@/app/components/ui/utils';

interface AccountLedgerViewProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType?: string;
  /** When opening from Trial Balance drill-down, pass report period so the ledger opens with that range */
  initialDateRange?: { from: string; to: string };
}

export const AccountLedgerView: React.FC<AccountLedgerViewProps> = ({
  isOpen,
  onClose,
  accountId,
  accountName,
  accountCode,
  accountType,
  initialDateRange,
}) => {
  const { companyId } = useSupabase();
  const [ledgerEntries, setLedgerEntries] = useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => ({
    from: initialDateRange?.from ? new Date(initialDateRange.from) : undefined,
    to: initialDateRange?.to ? new Date(initialDateRange.to) : undefined,
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);

  useEffect(() => {
    if (isOpen && initialDateRange?.from && initialDateRange?.to) {
      setDateRange({ from: new Date(initialDateRange.from), to: new Date(initialDateRange.to) });
    }
  }, [isOpen, initialDateRange?.from, initialDateRange?.to]);

  useEffect(() => {
    if (isOpen && accountId && companyId) {
      loadLedger();
    }
  }, [isOpen, accountId, companyId, dateRange]);

  const loadLedger = async () => {
    if (!accountId || !companyId) return;

    setLoading(true);
    try {
      const startDate = dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
      const endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

      const entries = await accountingService.getAccountLedger(
        accountId,
        companyId,
        startDate,
        endDate
      );

      setLedgerEntries(entries);
    } catch (error: any) {
      console.error('[ACCOUNT LEDGER] Error loading ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = ledgerEntries.filter(entry =>
    entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.reference_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebit = filteredEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredit = filteredEntries.reduce((sum, entry) => sum + entry.credit, 0);
  const closingBalance = filteredEntries.length > 0 
    ? filteredEntries[filteredEntries.length - 1].running_balance 
    : openingBalance;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold">Account Ledger</h2>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-sm text-gray-300">
                  {accountCode && <span className="font-mono">{accountCode} - </span>}
                  <span className="font-semibold">{accountName}</span>
                </p>
                {accountType && (
                  <Badge className="bg-blue-600 text-white text-xs">
                    {accountType}
                  </Badge>
                )}
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
          </DialogTitle>
        </DialogHeader>

        {/* Header with Opening/Closing Balance */}
        <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between border border-gray-700">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase">Opening Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                openingBalance >= 0 ? "text-green-400" : "text-red-400"
              )}>
                Rs {openingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Closing Balance</p>
              <p className={cn(
                "text-lg font-semibold mt-1",
                closingBalance >= 0 ? "text-green-400" : "text-red-400"
              )}>
                Rs {closingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase">Date Range</p>
            <p className="text-sm text-gray-300 mt-1">
              {dateRange.from && dateRange.to
                ? `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`
                : dateRange.from
                ? `From ${format(dateRange.from, 'dd MMM yyyy')}`
                : 'All Time'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search by description or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <CalendarDateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={loadLedger}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>

          {/* Ledger Table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading ledger...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No ledger entries found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr className="text-xs font-semibold text-gray-400 uppercase">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Reference No</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-right">Debit</th>
                      <th className="px-4 py-3 text-right">Credit</th>
                      <th className="px-4 py-3 text-right">Running Balance</th>
                      <th className="px-4 py-3 text-right w-24">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry, index) => (
                      <tr
                        key={`${entry.journal_entry_id}-${index}`}
                        className={cn(
                          'border-b border-gray-800 hover:bg-gray-800/50 transition-colors',
                          entry.ledger_kind === 'reversal' && 'bg-amber-500/5 border-amber-900/40'
                        )}
                      >
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {format(new Date(entry.date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              if (window.dispatchEvent) {
                                window.dispatchEvent(
                                  new CustomEvent('openTransactionDetail', {
                                    detail: {
                                      referenceNumber: entry.entry_no || entry.reference_number,
                                      autoLaunchUnifiedEdit: false,
                                    },
                                  })
                                );
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium"
                          >
                            {entry.reference_number}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{entry.description}</td>
                        <td className={cn(
                          "px-4 py-3 text-sm text-right tabular-nums",
                          entry.debit > 0 ? "text-green-400" : "text-gray-500"
                        )}>
                          {entry.debit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-sm text-right tabular-nums",
                          entry.credit > 0 ? "text-red-400" : "text-gray-500"
                        )}>
                          {entry.credit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-sm font-semibold text-right tabular-nums",
                          entry.running_balance >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {entry.running_balance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-gray-700 text-gray-300 text-xs">
                            {entry.source_module}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {entry.created_by ? 'User' : 'System'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-sky-400 hover:text-sky-300"
                            onClick={() => {
                              if (window.dispatchEvent) {
                                window.dispatchEvent(
                                  new CustomEvent('openTransactionDetail', {
                                    detail: {
                                      referenceNumber: entry.journal_entry_id,
                                      autoLaunchUnifiedEdit: true,
                                    },
                                  })
                                );
                              }
                            }}
                          >
                            <Edit size={14} className="mr-1" />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-800 sticky bottom-0">
                    <tr className="font-semibold text-white">
                      <td colSpan={3} className="px-4 py-3 text-right">Totals:</td>
                      <td className="px-4 py-3 text-right text-green-400">
                        Rs {totalDebit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400">
                        Rs {totalCredit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          closingBalance >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          Rs {closingBalance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
