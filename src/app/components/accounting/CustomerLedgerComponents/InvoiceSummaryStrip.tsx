'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { AccountLedgerEntry } from '@/app/services/accountingService';
import { supabase } from '@/lib/supabase';

interface InvoiceSummaryStripProps {
  ledgerEntries: AccountLedgerEntry[];
  customerId: string;
  companyId: string;
}

export const InvoiceSummaryStrip: React.FC<InvoiceSummaryStripProps> = ({
  ledgerEntries,
  customerId,
  companyId,
}) => {
  const [saleDetailsMap, setSaleDetailsMap] = useState<Map<string, any>>(new Map());

  // Get unique sale IDs from ledger entries
  const saleIds = useMemo(() => {
    const ids = new Set<string>();
    ledgerEntries.forEach(entry => {
      if (entry.sale_id) {
        ids.add(entry.sale_id);
      }
    });
    return Array.from(ids);
  }, [ledgerEntries]);

  // Fetch sale details
  useEffect(() => {
    if (saleIds.length > 0 && companyId) {
      const fetchSaleDetails = async () => {
        try {
          const { data: sales } = await supabase
            .from('sales')
            .select('id, invoice_no, total, paid_amount, due_amount')
            .in('id', saleIds)
            .eq('customer_id', customerId)
            .eq('company_id', companyId);

          if (sales) {
            const map = new Map<string, any>();
            sales.forEach(sale => {
              map.set(sale.id, sale);
            });
            setSaleDetailsMap(map);
          }
        } catch (error) {
          console.error('[INVOICE SUMMARY] Error fetching sale details:', error);
        }
      };
      fetchSaleDetails();
    }
  }, [saleIds, customerId, companyId]);

  // Calculate summary from ledger entries and sale details
  const summary = useMemo(() => {
    // Group entries by sale_id
    const saleGroups = new Map<string, {
      saleId: string;
      entries: AccountLedgerEntry[];
      totalPayments: number; // Sum of CREDIT entries (cash/bank/wallets only)
    }>();

    ledgerEntries.forEach(entry => {
      if (entry.sale_id) {
        if (!saleGroups.has(entry.sale_id)) {
          saleGroups.set(entry.sale_id, {
            saleId: entry.sale_id,
            entries: [],
            totalPayments: 0,
          });
        }
        const group = saleGroups.get(entry.sale_id)!;
        group.entries.push(entry);
        
        // Count payments (CREDIT entries, exclude discounts)
        // Only count actual payments (cash/bank/wallets), NOT discounts
        if (entry.credit > 0) {
          const desc = entry.description?.toLowerCase() || '';
          // Exclude discounts
          if (!desc.includes('discount')) {
            // Only count if it's a payment (has payment_id or source is Payment)
            if (entry.payment_id || entry.source_module === 'Payment') {
              group.totalPayments += entry.credit;
            }
          }
        }
      }
    });

    // Calculate totals
    let totalInvoices = saleGroups.size;
    let totalInvoiceAmount = 0;
    let totalPaymentReceived = 0;
    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;

    saleGroups.forEach((group, saleId) => {
      const saleDetail = saleDetailsMap.get(saleId);
      const invoiceTotal = saleDetail?.total || 0;
      const paidAmount = saleDetail?.paid_amount || group.totalPayments;
      
      // Total Invoice Amount (from sales table, NO commission)
      totalInvoiceAmount += invoiceTotal;
      
      // Total Payment Received (sum of CREDIT entries, cash/bank/wallets only, NO discounts)
      // This is already filtered in group.totalPayments (excludes discounts)
      totalPaymentReceived += group.totalPayments;

      // Payment Status
      if (invoiceTotal > 0) {
        if (paidAmount >= invoiceTotal) {
          fullyPaidCount++;
        } else if (paidAmount > 0) {
          partiallyPaidCount++;
        } else {
          unpaidCount++;
        }
      }
    });

    const pendingAmount = totalInvoiceAmount - totalPaymentReceived;

    return {
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount,
      fullyPaidCount,
      partiallyPaidCount,
      unpaidCount,
    };
  }, [ledgerEntries, saleDetailsMap]);

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex-shrink-0">
      <div className="grid grid-cols-2 gap-8">
        {/* Invoices Summary */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Invoices Summary</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-gray-400">Total Invoices</span>
              <span className="text-white font-semibold">{summary.totalInvoices}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-gray-400">Total Invoice Amount</span>
              <span className="text-white font-semibold">
                Rs {summary.totalInvoiceAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-gray-400">Total Payment Received</span>
              <span className="text-white font-semibold">
                Rs {summary.totalPaymentReceived.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-400 font-semibold">Pending Amount</span>
              <span className="text-white font-bold text-lg">
                Rs {summary.pendingAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase mb-3">Payment Status</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-gray-400">Fully Paid Invoices</span>
              <span className="text-white font-semibold">{summary.fullyPaidCount}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-gray-400">Partially Paid</span>
              <span className="text-white font-semibold">{summary.partiallyPaidCount}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-400">Unpaid</span>
              <span className="text-white font-semibold">{summary.unpaidCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
