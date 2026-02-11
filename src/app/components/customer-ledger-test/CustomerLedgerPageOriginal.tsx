/**
 * Customer Ledger Page - Original Design Implementation
 * 
 * This is the exact clone of the original ModernLedger design from the ZIP file
 * with API integration replacing mock data.
 */

import { useState, useEffect } from 'react';
import { Search, Calendar, Download, Printer, Filter, ChevronDown, FileText, X } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI, type CustomerLedgerSummary, type AgingReport } from '@/app/services/customerLedgerApi';
import type { Customer, Transaction, Invoice, Payment } from '@/app/services/customerLedgerTypes';
import { buildTransactionsWithOpeningBalance } from '@/app/services/customerLedgerTypes';
import { ModernCustomerSearch } from './modern-original/ModernCustomerSearch';
import { ModernDateFilter } from './modern-original/ModernDateFilter';
import { ModernSummaryCards } from './modern-original/ModernSummaryCards';
import { ModernLedgerTabs } from './modern-original/ModernLedgerTabs';
import { ModernTransactionModal } from './modern-original/ModernTransactionModal';
import { LedgerPrintView } from './modern-original/print/LedgerPrintView';
import { ViewSaleDetailsDrawer } from '@/app/components/sales/ViewSaleDetailsDrawer';
import type { LedgerData } from '@/app/services/customerLedgerTypes';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { supabase } from '@/lib/supabase';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { toast } from 'sonner';

// LedgerData interface is imported from customerLedgerTypes

interface CustomerLedgerPageOriginalProps {
  initialCustomerId?: string;
  onClose?: () => void;
  /** When true, render inside LedgerHub (no full-screen, no close, no customer search row) */
  embedded?: boolean;
}

export default function CustomerLedgerPageOriginal({ 
  initialCustomerId,
  onClose,
  embedded = false,
}: CustomerLedgerPageOriginalProps = {}) {
  const { companyId } = useSupabase();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateRange, setDateRange] = useState({ from: '2025-01-01', to: new Date().toISOString().split('T')[0] });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [saleDrawerSaleId, setSaleDrawerSaleId] = useState<string | null>(null);

  // Data states
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [saleItemsMap, setSaleItemsMap] = useState<Map<string, any[]>>(new Map());

  // Load customers on mount
  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  // Select initial customer if provided (and when embedded, keep in sync with parent dropdown)
  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      const id = String(initialCustomerId).trim();
      const customer = customers.find(c => (c.id && String(c.id).trim()) === id);
      if (customer) {
        setSelectedCustomer(customer);
      }
    } else if (embedded && !initialCustomerId) {
      setSelectedCustomer(null);
    }
  }, [initialCustomerId, customers, embedded]);

  // Load ledger data when customer or date range changes
  useEffect(() => {
    if (selectedCustomer && companyId) {
      loadLedgerData();
    }
  }, [selectedCustomer, dateRange, companyId]);

  const loadCustomers = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await customerLedgerAPI.getCustomers(companyId);
      setCustomers(data);
      if (data.length > 0 && !selectedCustomer) {
        // If initialCustomerId provided, find and select it (match by id, trim for consistency), otherwise select first
        if (initialCustomerId) {
          const id = String(initialCustomerId).trim();
          const customer = data.find(c => (c.id && String(c.id).trim()) === id);
          setSelectedCustomer(customer || data[0]);
        } else {
          setSelectedCustomer(data[0]);
        }
      }
    } catch (err: any) {
      console.error('[CUSTOMER LEDGER] Error loading customers:', err);
      setError(err.message || 'Failed to load customers');
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadLedgerData = async () => {
    if (!selectedCustomer || !companyId) return;

    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [summary, transactions, invoices, payments, aging] = await Promise.all([
        customerLedgerAPI.getLedgerSummary(
          selectedCustomer.id,
          companyId,
          dateRange.from,
          dateRange.to
        ),
        customerLedgerAPI.getTransactions(
          selectedCustomer.id,
          companyId,
          dateRange.from,
          dateRange.to
        ),
        customerLedgerAPI.getInvoices(
          selectedCustomer.id,
          companyId,
          dateRange.from,
          dateRange.to
        ),
        customerLedgerAPI.getPayments(
          selectedCustomer.id,
          companyId,
          dateRange.from,
          dateRange.to
        ),
        customerLedgerAPI.getAgingReport(selectedCustomer.id, companyId),
      ]);

      // Convert to LedgerData format
      const ledger: LedgerData = {
        openingBalance: summary.openingBalance,
        totalDebit: summary.totalDebit,
        totalCredit: summary.totalCredit,
        closingBalance: summary.closingBalance,
        transactions: transactions,
        detailTransactions: transactions.map(t => ({ ...t })), // Convert to DetailTransaction format
        invoices: invoices,
        invoicesSummary: {
          totalInvoices: summary.totalInvoices,
          totalInvoiceAmount: summary.totalInvoiceAmount,
          totalPaymentReceived: summary.totalPaymentReceived,
          pendingAmount: summary.pendingAmount,
          fullyPaid: summary.fullyPaid,
          partiallyPaid: summary.partiallyPaid,
          unpaid: summary.unpaid,
        },
      };

      setLedgerData(ledger);
    } catch (err: any) {
      console.error('[CUSTOMER LEDGER] Error loading ledger data:', err);
      setError(err.message || 'Failed to load ledger data');
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch sale_items for all Sale transactions (1:1 with backend – no mock)
  useEffect(() => {
    if (!ledgerData?.transactions || !companyId) {
      setSaleItemsMap(new Map());
      return;
    }
    const saleIds = ledgerData.transactions
      .filter((t) => (t.documentType === 'Sale' || t.documentType === 'Studio Sale') && t.id)
      .map((t) => t.id);
    if (saleIds.length === 0) {
      setSaleItemsMap(new Map());
      return;
    }
    const selectCols = 'id, sale_id, product_id, variation_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details, variation:product_variations(id, attributes)';
    const fetchItems = async () => {
      try {
        let { data: items, error: err } = await supabase
          .from('sales_items')
          .select(selectCols)
          .in('sale_id', saleIds)
          .order('sale_id')
          .order('id');
        if (err && (err.code === '42P01' || String(err.message).includes('sales_items'))) {
          const res = await supabase
            .from('sale_items')
            .select(selectCols)
            .in('sale_id', saleIds)
            .order('sale_id')
            .order('id');
          items = res.data;
          err = res.error;
        }
        if (err) {
          const res = await supabase
            .from('sale_items')
            .select('id, sale_id, product_id, variation_id, product_name, sku, quantity, unit, unit_price, discount_amount, tax_amount, total, packing_type, packing_quantity, packing_unit, packing_details')
            .in('sale_id', saleIds)
            .order('sale_id')
            .order('id');
          items = res.data;
        }
        const map = new Map<string, any[]>();
        (items || []).forEach((it: any) => {
          const sid = it.sale_id;
          if (!map.has(sid)) map.set(sid, []);
          map.get(sid)!.push(it);
        });
        setSaleItemsMap(map);
        // Step 1 – Raw DB verification: log raw sale_items/sales_items for a problematic sale (e.g. SL-0016) or first Sale
        const transactions = ledgerData?.transactions ?? [];
        const saleIdForDebug =
          transactions.find((t: any) => (t.documentType === 'Sale' || t.documentType === 'Studio Sale') && t.referenceNo === 'SL-0016')?.id ??
          transactions.find((t: any) => t.documentType === 'Sale' || t.documentType === 'Studio Sale')?.id;
        const rawItemsForDebug = saleIdForDebug ? (map.get(saleIdForDebug) || []) : [];
        const refNoForDebug = transactions.find((t: any) => t.id === saleIdForDebug)?.referenceNo ?? '';
        console.log('[CUSTOMER LEDGER ORIGINAL] Step 1 – Raw DB verification (sale_items/sales_items):', {
          saleId: saleIdForDebug,
          referenceNo: refNoForDebug,
          count: rawItemsForDebug.length,
          rawRecords: rawItemsForDebug.map((it: any) => ({
            packing_type: it.packing_type,
            packing_quantity: it.packing_quantity,
            packing_unit: it.packing_unit,
            quantity: it.quantity,
            unit: it.unit,
            variation_id: it.variation_id,
            product_name: it.product_name,
          })),
        });
        if (items?.length) {
          console.log('[CUSTOMER LEDGER ORIGINAL] Sale items fetched (raw):', { saleIds: saleIds.length, itemCount: items.length, sample: items[0] });
        }
      } catch (e) {
        console.error('[CUSTOMER LEDGER ORIGINAL] Error fetching sale items:', e);
        setSaleItemsMap(new Map());
      }
    };
    fetchItems();
  }, [ledgerData?.transactions, companyId]);

  // Display transactions = Opening Balance (first row) + period transactions — shown in all views
  const displayTransactions = ledgerData
    ? buildTransactionsWithOpeningBalance(
        ledgerData.openingBalance,
        ledgerData.transactions,
        dateRange.from
      )
    : [];
  const ledgerDataForViews = ledgerData
    ? { ...ledgerData, transactions: displayTransactions }
    : null;

  if (loading && !ledgerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !ledgerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
        <ErrorMessage message={error} onRetry={loadCustomers} />
      </div>
    );
  }

  if (!ledgerData || !selectedCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F19]">
        <div className="text-center">
          <p className="text-sm text-gray-400">No customer selected or no data available</p>
        </div>
      </div>
    );
  }

  const content = (
    <>
      {!embedded && (
        <header className="shrink-0 px-6 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-white"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Customer Ledger</h1>
                  <p className="text-sm text-gray-400 mt-0.5">Manage and track customer accounts</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPrintOpen(true)}
                className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-gray-900 border border-gray-700 text-white hover:bg-gray-800"
              >
                <Download className="w-4 h-4" />
                Export / PDF
              </button>
              <button
                onClick={() => setPrintOpen(true)}
                className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-gray-900 border border-gray-700 text-white hover:bg-gray-800"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-gray-900 border border-gray-700 text-white hover:bg-gray-800">
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ModernCustomerSearch
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelect={setSelectedCustomer}
            />
            <ModernDateFilter
              dateRange={dateRange}
              onApply={setDateRange}
            />
          </div>
        </header>
      )}
      {embedded && (
        <div className="flex items-center gap-4 mb-4">
          <ModernDateFilter
            dateRange={dateRange}
            onApply={setDateRange}
          />
        </div>
      )}
      <div className={embedded ? '' : 'flex-1 overflow-auto px-6 py-4'}>
        {/* Summary Cards Section – same strip as Products (bg-[#0F1419], border-b) */}
        <div className="shrink-0 pb-6 border-b border-gray-800">
          <ModernSummaryCards ledgerData={ledgerData} />
        </div>

        {/* Ledger Content – tabs same as Products table section (transactions include Opening Balance as first row) */}
        <div className="mt-6">
          <ModernLedgerTabs
            ledgerData={ledgerDataForViews!}
            saleItemsMap={saleItemsMap}
            accountName={selectedCustomer?.name ?? ''}
            dateRange={dateRange}
            onTransactionClick={(transaction) => {
              if (transaction.documentType === 'Opening Balance') return;
              if (transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale') {
                setSaleDrawerSaleId(transaction.id);
                setSelectedTransaction(null);
              } else {
                setSaleDrawerSaleId(null);
                setSelectedTransaction(transaction);
              }
            }}
          />
        </div>
      </div>

      {/* Sale Transaction Details (full page) – opens when sale reference is clicked */}
      <ViewSaleDetailsDrawer
        isOpen={!!saleDrawerSaleId}
        onClose={() => setSaleDrawerSaleId(null)}
        saleId={saleDrawerSaleId}
      />

      {/* Payment / other transaction modal – opens when payment reference is clicked */}
      {selectedTransaction && (
        <ModernTransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {/* Print / PDF modal – same data as screen (Opening Balance as first row) */}
      {printOpen && ledgerData && selectedCustomer && (
        <LedgerPrintView
          transactions={displayTransactions}
          accountName={selectedCustomer.name}
          dateRange={dateRange}
          openingBalance={ledgerData.openingBalance}
          orientation="portrait"
          onClose={() => setPrintOpen(false)}
        />
      )}
    </>
  );

  return (
    <div className={embedded ? 'flex flex-col' : 'min-h-screen flex flex-col bg-[#0B0F19]'}>
      {content}
    </div>
  );
}
