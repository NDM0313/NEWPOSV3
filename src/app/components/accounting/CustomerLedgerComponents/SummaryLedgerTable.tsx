'use client';

import React, { useState, useMemo } from 'react';
import { AccountLedgerEntry } from '@/app/services/accountingService';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SummaryLedgerTableProps {
  entries: AccountLedgerEntry[];
  onReferenceClick: (entry: AccountLedgerEntry) => void;
}

export const SummaryLedgerTable: React.FC<SummaryLedgerTableProps> = ({
  entries,
  onReferenceClick,
}) => {
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [saleDetailsMap, setSaleDetailsMap] = useState<Map<string, any>>(new Map());

  // Group entries by sale_id (invoice level)
  const invoiceGroups = useMemo(() => {
    const groups = new Map<string, {
      invoiceNo: string;
      invoiceDate: string;
      invoiceTotal: number;
      totalPaid: number;
      outstanding: number;
      entries: AccountLedgerEntry[];
      runningBalance: number;
    }>();
    const standalone: AccountLedgerEntry[] = [];

    entries.forEach(entry => {
      if (entry.sale_id) {
        if (!groups.has(entry.sale_id)) {
          groups.set(entry.sale_id, {
            invoiceNo: entry.reference_number,
            invoiceDate: entry.date,
            invoiceTotal: 0,
            totalPaid: 0,
            outstanding: 0,
            entries: [],
            runningBalance: entry.running_balance,
          });
        }
        const group = groups.get(entry.sale_id)!;
        group.entries.push(entry);
        // Calculate totals
        if (entry.debit > 0) {
          group.invoiceTotal += entry.debit;
        }
        if (entry.credit > 0) {
          group.totalPaid += entry.credit;
        }
      } else {
        standalone.push(entry);
      }
    });

    // Calculate outstanding for each group
    groups.forEach(group => {
      group.outstanding = group.invoiceTotal - group.totalPaid;
    });

    return { groups, standalone };
  }, [entries]);

  // Fetch sale details for expanded invoices
  React.useEffect(() => {
    const saleIds = Array.from(expandedInvoices);
    if (saleIds.length === 0) return;

    const fetchSaleDetails = async () => {
      try {
        const { data: sales } = await supabase
          .from('sales')
          .select('id, invoice_no, invoice_date, total, paid_amount, due_amount')
          .in('id', saleIds);

        if (sales) {
          const map = new Map<string, any>();
          sales.forEach(sale => {
            map.set(sale.id, sale);
          });
          setSaleDetailsMap(map);
        }
      } catch (error) {
        console.error('[SUMMARY LEDGER] Error fetching sale details:', error);
      }
    };

    fetchSaleDetails();
  }, [expandedInvoices]);

  const toggleInvoice = (saleId: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId);
    } else {
      newExpanded.add(saleId);
    }
    setExpandedInvoices(newExpanded);
  };

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No ledger entries found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-900 sticky top-0 border-b border-gray-800">
          <tr className="text-xs font-semibold text-gray-400 uppercase">
            <th className="px-4 py-3 text-left w-8"></th>
            <th className="px-4 py-3 text-left">Invoice No</th>
            <th className="px-4 py-3 text-left">Invoice Date</th>
            <th className="px-4 py-3 text-right">Invoice Total</th>
            <th className="px-4 py-3 text-right">Total Paid</th>
            <th className="px-4 py-3 text-right">Outstanding Balance</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(invoiceGroups.groups.entries()).map(([saleId, group]) => {
            const saleDetail = saleDetailsMap.get(saleId);
            const invoiceNo = saleDetail?.invoice_no || group.invoiceNo;
            const invoiceDate = saleDetail?.invoice_date || group.invoiceDate;
            const invoiceTotal = saleDetail?.total || group.invoiceTotal;
            const totalPaid = saleDetail?.paid_amount || group.totalPaid;
            const outstanding = saleDetail?.due_amount || group.outstanding;
            const isExpanded = expandedInvoices.has(saleId);

            return (
              <React.Fragment key={saleId}>
                <tr
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => toggleInvoice(saleId)}
                >
                  <td className="px-4 py-3">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (group.entries[0]) {
                          onReferenceClick(group.entries[0]);
                        }
                      }}
                      className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                    >
                      {invoiceNo}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {format(new Date(invoiceDate), 'dd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-300">
                    Rs {invoiceTotal.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-300">
                    Rs {totalPaid.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-gray-300">
                    Rs {outstanding.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>

                {/* Expanded ledger entries */}
                {isExpanded && group.entries.map((entry, idx) => (
                  <tr
                    key={`${entry.journal_entry_id}-${idx}`}
                    className="bg-gray-900/30 border-b border-gray-800/50"
                  >
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-xs text-gray-400 pl-8">
                      <button
                        onClick={() => onReferenceClick(entry)}
                        className="text-blue-400 hover:text-blue-300 hover:underline font-mono"
                      >
                        {entry.reference_number}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {format(new Date(entry.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-gray-400">
                      {entry.debit > 0 ? (
                        <span>Rs {entry.debit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-gray-400">
                      {entry.credit > 0 ? (
                        <span>Rs {entry.credit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-gray-400">
                      Rs {entry.running_balance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}

          {/* Standalone entries (not linked to sales) */}
          {invoiceGroups.standalone.map((entry, idx) => (
            <tr
              key={`standalone-${entry.journal_entry_id}-${idx}`}
              className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onReferenceClick(entry)}
                  className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
                >
                  {entry.reference_number}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-gray-300">
                {format(new Date(entry.date), 'dd MMM yyyy')}
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-300">
                {entry.debit > 0 ? (
                  <span>Rs {entry.debit.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</span>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-300">
                {entry.credit > 0 ? (
                  <span>Rs {entry.credit.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}</span>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-gray-300">
                Rs {entry.running_balance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
