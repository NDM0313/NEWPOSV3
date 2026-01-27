'use client';

import React, { useState, useMemo } from 'react';
import { AccountLedgerEntry } from '@/app/services/accountingService';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DetailLedgerTableProps {
  entries: AccountLedgerEntry[];
  onReferenceClick: (entry: AccountLedgerEntry) => void;
}

export const DetailLedgerTable: React.FC<DetailLedgerTableProps> = ({
  entries,
  onReferenceClick,
}) => {
  const [expandedSales, setExpandedSales] = useState<Set<string>>(new Set());
  const [saleDetailsMap, setSaleDetailsMap] = useState<Map<string, any>>(new Map());

  // Group entries by sale_id
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, AccountLedgerEntry[]>();
    const standalone: AccountLedgerEntry[] = [];

    entries.forEach(entry => {
      if (entry.sale_id) {
        if (!groups.has(entry.sale_id)) {
          groups.set(entry.sale_id, []);
        }
        groups.get(entry.sale_id)!.push(entry);
      } else {
        standalone.push(entry);
      }
    });

    return { groups, standalone };
  }, [entries]);

  // Fetch sale details for expanded sales
  React.useEffect(() => {
    const saleIds = Array.from(expandedSales);
    if (saleIds.length === 0) return;

    const fetchSaleDetails = async () => {
      try {
        const { data: sales } = await supabase
          .from('sales')
          .select('id, invoice_no, subtotal, total, discount_amount, expenses, invoice_date')
          .in('id', saleIds);

        if (sales) {
          const map = new Map<string, any>();
          sales.forEach(sale => {
            map.set(sale.id, sale);
          });
          setSaleDetailsMap(map);
        }
      } catch (error) {
        console.error('[DETAIL LEDGER] Error fetching sale details:', error);
      }
    };

    fetchSaleDetails();
  }, [expandedSales]);

  const toggleSale = (saleId: string) => {
    const newExpanded = new Set(expandedSales);
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId);
    } else {
      newExpanded.add(saleId);
    }
    setExpandedSales(newExpanded);
  };

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No ledger entries found
      </div>
    );
  }

  const rows: JSX.Element[] = [];

  // Add grouped sale entries
  groupedEntries.groups.forEach((saleEntries, saleId) => {
    const firstEntry = saleEntries[0];
    const saleDetail = saleDetailsMap.get(saleId);
    const invoiceNo = saleDetail?.invoice_no || firstEntry.reference_number || 'N/A';
    const saleTotal = saleDetail?.total || 0;
    const isExpanded = expandedSales.has(saleId);

    // Sale Invoice Row
    rows.push(
      <tr
        key={`sale-${saleId}`}
        className="border-b-2 border-blue-500/30 bg-blue-500/5 font-semibold cursor-pointer"
        onClick={() => toggleSale(saleId)}
      >
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-300">
          {saleDetail?.invoice_date
            ? format(new Date(saleDetail.invoice_date), 'dd MMM yyyy')
            : format(new Date(firstEntry.date), 'dd MMM yyyy')}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReferenceClick(firstEntry);
            }}
            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
          >
            {invoiceNo}
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-300">Sale Invoice</td>
        <td className="px-4 py-3 text-sm text-gray-300">-</td>
        <td className="px-4 py-3 text-sm text-gray-300">-</td>
        <td className="px-4 py-3 text-sm text-white font-semibold">Sale Invoice</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-300">
          {saleTotal > 0 ? (
            <span>Rs {saleTotal.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</span>
          ) : (
            <span className="text-gray-600">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-right tabular-nums text-gray-600">-</td>
        <td className="px-4 py-3 text-sm text-right tabular-nums font-semibold text-gray-300">
          Rs {firstEntry.running_balance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
      </tr>
    );

    // Expanded details
    if (isExpanded && saleDetail) {
      const subtotal = saleDetail.subtotal || 0;
      const expenses = saleDetail.expenses || 0;
      const discount = saleDetail.discount_amount || 0;

      // Items Total
      if (subtotal > 0) {
        rows.push(
          <tr key={`sale-${saleId}-subtotal`} className="bg-gray-900/30 border-b border-gray-800/50">
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400 pl-8">Items Total</td>
            <td className="px-4 py-2 text-xs text-right text-gray-400">
              Rs {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
          </tr>
        );
      }

      // Extra Charges
      if (expenses > 0) {
        rows.push(
          <tr key={`sale-${saleId}-expenses`} className="bg-gray-900/30 border-b border-gray-800/50">
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400 pl-8">Extra Charges</td>
            <td className="px-4 py-2 text-xs text-right text-gray-400">
              Rs {expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
          </tr>
        );
      }

      // Discount
      if (discount > 0) {
        rows.push(
          <tr key={`sale-${saleId}-discount`} className="bg-gray-900/30 border-b border-gray-800/50">
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400">-</td>
            <td className="px-4 py-2 text-xs text-gray-400 pl-8">Discount</td>
            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
            <td className="px-4 py-2 text-xs text-right text-red-400">
              Rs {discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-2 text-xs text-right text-gray-500">-</td>
          </tr>
        );
      }

      // Payment entries for this sale
      saleEntries.forEach((entry, idx) => {
        if (entry.description?.toLowerCase().includes('commission')) return;

        rows.push(
          <tr
            key={`${entry.journal_entry_id}-${idx}`}
            className="bg-gray-900/30 border-b border-gray-800/50"
          >
            <td className="px-4 py-2"></td>
            <td className="px-4 py-2 text-sm text-gray-400 pl-8">
              {format(new Date(entry.date), 'dd MMM yyyy')}
            </td>
            <td className="px-4 py-2">
              <button
                onClick={() => onReferenceClick(entry)}
                className="text-blue-400 hover:text-blue-300 hover:underline text-xs font-medium font-mono"
              >
                {entry.reference_number}
              </button>
            </td>
            <td className="px-4 py-2 text-xs text-gray-400">{entry.document_type || entry.source_module}</td>
            <td className="px-4 py-2 text-xs text-gray-400">{entry.account_name || '-'}</td>
            <td className="px-4 py-2 text-xs text-gray-400">{entry.description}</td>
            <td className="px-4 py-2 text-xs text-gray-400">{entry.notes || '-'}</td>
            <td className="px-4 py-2 text-xs text-right tabular-nums text-gray-400">
              {entry.debit > 0 ? (
                <span>Rs {entry.debit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</span>
              ) : (
                <span className="text-gray-600">-</span>
              )}
            </td>
            <td className="px-4 py-2 text-xs text-right tabular-nums text-gray-400">
              {entry.credit > 0 ? (
                <span>Rs {entry.credit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</span>
              ) : (
                <span className="text-gray-600">-</span>
              )}
            </td>
            <td className="px-4 py-2 text-xs text-right tabular-nums font-semibold text-gray-400">
              Rs {entry.running_balance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
          </tr>
        );
      });
    }
  });

  // Add standalone entries
  groupedEntries.standalone.forEach((entry, idx) => {
    rows.push(
      <tr
        key={`standalone-${entry.journal_entry_id}-${idx}`}
        className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
      >
        <td className="px-4 py-3"></td>
        <td className="px-4 py-3 text-sm text-gray-300">
          {format(new Date(entry.date), 'dd MMM yyyy')}
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => onReferenceClick(entry)}
            className="text-blue-400 hover:text-blue-300 hover:underline text-sm font-medium font-mono"
          >
            {entry.reference_number}
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-300">{entry.document_type || entry.source_module}</td>
        <td className="px-4 py-3 text-sm text-gray-300">{entry.account_name || '-'}</td>
        <td className="px-4 py-3 text-sm text-gray-300">{entry.description}</td>
        <td className="px-4 py-3 text-sm text-gray-300">{entry.notes || '-'}</td>
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
    );
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-900 sticky top-0 border-b border-gray-800">
          <tr className="text-xs font-semibold text-gray-400 uppercase">
            <th className="px-4 py-3 text-left w-8"></th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Reference No</th>
            <th className="px-4 py-3 text-left">Document Type</th>
            <th className="px-4 py-3 text-left">Payment Account</th>
            <th className="px-4 py-3 text-left">Description</th>
            <th className="px-4 py-3 text-left">Notes / Reference</th>
            <th className="px-4 py-3 text-right">Debit</th>
            <th className="px-4 py-3 text-right">Credit</th>
            <th className="px-4 py-3 text-right">Running Balance</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
};
