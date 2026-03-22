/**
 * Customer Ledger Page - Original Design Implementation
 * 
 * This is the exact clone of the original ModernLedger design from the ZIP file
 * with API integration replacing mock data.
 */

import { useState, useEffect, useRef } from 'react';
import { Download, Printer, Filter, FileText, X } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import type { Customer, Transaction } from '@/app/services/customerLedgerTypes';
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
import { getTodayYYYYMMDD, cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { toast } from 'sonner';
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import {
  getSingleCustomerPartyReconciliation,
  type SingleCustomerPartyReconciliation,
} from '@/app/services/contactBalanceReconciliationService';
import { CustomerGlJournalTable } from './CustomerGlJournalTable';
import { Badge } from '@/app/components/ui/badge';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

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
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  /** Canonical cutover: three explicit engines — no single mixed “ledger” list. */
  const [statementEngine, setStatementEngine] = useState<'operational' | 'gl' | 'reconciliation'>('operational');
  // Default: Last 90 Days (rentals + sales; Pakistan timezone)
  const [dateRange, setDateRange] = useState(() => {
    const to = getTodayYYYYMMDD();
    const fromD = new Date(to + 'T12:00:00');
    fromD.setDate(fromD.getDate() - 90);
    const from = fromD.toISOString().split('T')[0];
    return { from, to };
  });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [saleDrawerSaleId, setSaleDrawerSaleId] = useState<string | null>(null);

  // Data states
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [operationalLoading, setOperationalLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const [glEntries, setGlEntries] = useState<AccountLedgerEntry[]>([]);
  const [glLoading, setGlLoading] = useState(false);
  const [glError, setGlError] = useState<string | null>(null);
  const [recon, setRecon] = useState<SingleCustomerPartyReconciliation | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);
  const [balanceRefreshTick, setBalanceRefreshTick] = useState(0);
  const [printOpen, setPrintOpen] = useState(false);
  const [saleItemsMap, setSaleItemsMap] = useState<Map<string, any[]>>(new Map());
  const [studioDetailsMap, setStudioDetailsMap] = useState<Map<string, { notes?: string; productionStatus?: string }>>(new Map());

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
  const loadLedgerData = async () => {
    if (!selectedCustomer || !companyId) return;

    try {
      setOperationalLoading(true);
      setOperationalError(null);

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
        detailTransactions: transactions.map(t => ({ ...t })),
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
      setOperationalError(err.message || 'Failed to load operational statement');
      toast.error('Failed to load operational statement');
    } finally {
      setOperationalLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer && companyId) {
      loadLedgerData();
    }
  }, [selectedCustomer, dateRange, companyId]);

  // Same refresh pattern as supplier/worker/user: listen for sale/payment/ledger events
  const loadLedgerRef = useRef<() => void>(() => {});
  loadLedgerRef.current = loadLedgerData;
  const currentCustomerId = selectedCustomer?.id;
  useEffect(() => {
    const handleRefresh = () => loadLedgerRef.current();
    const handleLedgerUpdated = (e: Event) => {
      const d = (e as CustomEvent)?.detail;
      if (d?.ledgerType !== 'customer') return;
      if (d.entityId && d.entityId !== currentCustomerId) return;
      handleRefresh();
    };
    window.addEventListener('saleSaved', handleRefresh);
    window.addEventListener('paymentAdded', handleRefresh);
    window.addEventListener('saleDeleted', handleRefresh);
    window.addEventListener('ledgerUpdated', handleLedgerUpdated);
    return () => {
      window.removeEventListener('saleSaved', handleRefresh);
      window.removeEventListener('paymentAdded', handleRefresh);
      window.removeEventListener('saleDeleted', handleRefresh);
      window.removeEventListener('ledgerUpdated', handleLedgerUpdated);
    };
  }, [currentCustomerId, companyId]);

  useEffect(() => {
    const bump = () => setBalanceRefreshTick((t) => t + 1);
    window.addEventListener('contactBalancesRefresh', bump);
    return () => window.removeEventListener('contactBalancesRefresh', bump);
  }, []);

  useEffect(() => {
    if (statementEngine !== 'gl' || !selectedCustomer || !companyId) return;
    let cancelled = false;
    (async () => {
      setGlLoading(true);
      setGlError(null);
      try {
        const entries = await accountingService.getCustomerLedger(
          selectedCustomer.id,
          companyId,
          branchId ?? undefined,
          dateRange.from,
          dateRange.to,
          undefined,
          'gl_journal_only'
        );
        if (!cancelled) setGlEntries(entries);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load GL statement';
        if (!cancelled) setGlError(msg);
      } finally {
        if (!cancelled) setGlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    statementEngine,
    selectedCustomer?.id,
    companyId,
    branchId,
    dateRange.from,
    dateRange.to,
    balanceRefreshTick,
  ]);

  useEffect(() => {
    if (statementEngine !== 'reconciliation' || !selectedCustomer || !companyId) return;
    let cancelled = false;
    (async () => {
      setReconLoading(true);
      setReconError(null);
      try {
        const r = await getSingleCustomerPartyReconciliation(companyId, selectedCustomer.id, branchId);
        if (!cancelled) setRecon(r);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load reconciliation';
        if (!cancelled) setReconError(msg);
      } finally {
        if (!cancelled) setReconLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statementEngine, selectedCustomer?.id, companyId, branchId, balanceRefreshTick]);

  useEffect(() => {
    setLedgerData(null);
  }, [selectedCustomer?.id]);

  const loadCustomers = async () => {
    if (!companyId) return;
    
    try {
      setCustomersLoading(true);
      setCustomersError(null);
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
      setCustomersError(err.message || 'Failed to load customers');
      toast.error('Failed to load customers');
    } finally {
      setCustomersLoading(false);
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

  // Fetch studio details (notes, production status) for Studio Sale transactions
  useEffect(() => {
    if (!ledgerData?.transactions || !companyId) {
      setStudioDetailsMap(new Map());
      return;
    }
    const studioSaleIds = ledgerData.transactions
      .filter((t) => t.documentType === 'Studio Sale' && t.id)
      .map((t) => t.id);
    if (studioSaleIds.length === 0) {
      setStudioDetailsMap(new Map());
      return;
    }
    const fetchStudioDetails = async () => {
      try {
        const map = new Map<string, { notes?: string; productionStatus?: string }>();
        const { data: sales } = await supabase
          .from('sales')
          .select('id, notes')
          .in('id', studioSaleIds);
        (sales || []).forEach((s: any) => {
          map.set(s.id, { notes: s.notes || undefined });
        });
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('sale_id, status')
          .in('sale_id', studioSaleIds)
          .order('created_at', { ascending: false });
        (productions || []).forEach((p: any) => {
          const existing = map.get(p.sale_id) || {};
          if (!existing.productionStatus) map.set(p.sale_id, { ...existing, productionStatus: p.status || undefined });
        });
        setStudioDetailsMap(map);
      } catch (e) {
        console.error('[CUSTOMER LEDGER] Error fetching studio details:', e);
        setStudioDetailsMap(new Map());
      }
    };
    fetchStudioDetails();
  }, [ledgerData?.transactions, companyId]);

  const spinnerWrapClass = embedded
    ? 'py-12 flex justify-center'
    : 'min-h-screen flex items-center justify-center bg-[#0B0F19]';

  if (!companyId) {
    return (
      <div className={embedded ? 'py-8 text-center text-sm text-gray-400' : spinnerWrapClass}>
        {!embedded ? <p className="text-sm text-gray-400">Company context required</p> : null}
      </div>
    );
  }

  if (customersLoading && customers.length === 0) {
    return (
      <div className={spinnerWrapClass}>
        <LoadingSpinner />
      </div>
    );
  }

  if (customersError && customers.length === 0) {
    return (
      <div className={spinnerWrapClass}>
        <ErrorMessage message={customersError} onRetry={loadCustomers} />
      </div>
    );
  }

  if (!selectedCustomer) {
    return (
      <div
        className={
          embedded ? 'py-6 text-sm text-amber-200/90 text-center' : 'min-h-screen flex flex-col bg-[#0B0F19]'
        }
      >
        {!embedded && (
          <header className="shrink-0 px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-4 mb-4">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-white"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-xl font-bold text-white">Customer statement</h1>
            </div>
            <ModernCustomerSearch
              customers={customers}
              selectedCustomer={null}
              onSelect={setSelectedCustomer}
            />
          </header>
        )}
        <p className={cn('text-center text-gray-400', embedded ? '' : 'mt-8 px-6')}>
          {embedded
            ? 'Customer not in list or still loading. Pick another customer above.'
            : 'Select a customer to open operational, GL, and reconciliation views.'}
        </p>
      </div>
    );
  }

  // Operational only: opening row + period rows (never mixed with GL running balance on this screen).
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

  const openPrint = () => {
    if (statementEngine !== 'operational' || !ledgerData) {
      toast.message('Switch to the Operational tab to print or export.');
      return;
    }
    setPrintOpen(true);
  };

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
                  <h1 className="text-2xl font-bold text-white">Customer statement</h1>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Operational (Not GL) · GL (Journal) · Reconciliation (Variance) — three engines only; no blended
                    balance.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openPrint}
                className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 bg-gray-900 border border-gray-700 text-white hover:bg-gray-800"
              >
                <Download className="w-4 h-4" />
                Export / PDF
              </button>
              <button
                type="button"
                onClick={openPrint}
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
        <div className="flex flex-col gap-3 mb-4">
          <p className="text-[11px] text-gray-500">
            <Badge variant="outline" className="mr-2 border-gray-600 text-gray-300">
              Customer statement
            </Badge>
            Choose engine below; each tab has its own source of truth.
          </p>
          <ModernDateFilter dateRange={dateRange} onApply={setDateRange} />
        </div>
      )}
      <div className={embedded ? '' : 'flex-1 overflow-auto px-6 py-4'}>
        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              {
                id: 'operational' as const,
                label: 'Operational',
                badge: 'Not GL',
                sub: 'Sales, rentals, openings, payments (subledger)',
              },
              {
                id: 'gl' as const,
                label: 'GL (journal)',
                badge: 'Journal',
                sub: 'AR lines from journal only',
              },
              {
                id: 'reconciliation' as const,
                label: 'Reconciliation',
                badge: 'Variance',
                sub: 'Operational receivable vs GL AR slice',
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatementEngine(t.id)}
              className={cn(
                'flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors min-w-[160px]',
                statementEngine === t.id
                  ? 'border-blue-500/80 bg-blue-500/15 text-white'
                  : 'border-gray-700 bg-[#0F1419] text-gray-300 hover:border-gray-600'
              )}
            >
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{t.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-700/80 text-gray-100">
                  {t.badge}
                </Badge>
              </span>
              <span className="text-[11px] text-gray-500 mt-0.5">{t.sub}</span>
            </button>
          ))}
        </div>

        {statementEngine === 'operational' && (
          <>
            {operationalError && (
              <div className="mb-4 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {operationalError}
              </div>
            )}
            <p className="text-[11px] text-sky-200/80 mb-3">
              <Badge className="mr-2 bg-sky-600/25 text-sky-100 border-0">Operational</Badge>
              Running balance is subledger only (not GL). Same sources as customer ledger API — not journal truth.
            </p>
            <div className="shrink-0 pb-6 border-b border-gray-800">
              {operationalLoading && !ledgerData ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner />
                </div>
              ) : ledgerData ? (
                <ModernSummaryCards ledgerData={ledgerData} />
              ) : (
                <p className="text-sm text-gray-500 py-8 text-center">No operational summary in this range.</p>
              )}
            </div>
            <div className="mt-6">
              {operationalLoading && !ledgerData ? null : ledgerDataForViews ? (
                <ModernLedgerTabs
                  ledgerData={ledgerDataForViews}
                  saleItemsMap={saleItemsMap}
                  studioDetailsMap={studioDetailsMap}
                  accountName={selectedCustomer.name}
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
              ) : (
                <p className="text-sm text-gray-500">No operational rows in this date range.</p>
              )}
            </div>
          </>
        )}

        {statementEngine === 'gl' && (
          <div className="space-y-3">
            <p className="text-[11px] text-violet-200/85">
              <Badge className="mr-2 bg-violet-600/30 text-violet-100 border-0">GL (journal)</Badge>
              Running balance from AR journal lines only — no sales/rentals due column merged here.
            </p>
            <CustomerGlJournalTable
              entries={glEntries}
              loading={glLoading}
              error={glError}
              formatCurrency={formatCurrency}
              dateFrom={dateRange.from}
              dateTo={dateRange.to}
            />
          </div>
        )}

        {statementEngine === 'reconciliation' && (
          <div className="rounded-xl border border-gray-800 bg-[#0F1419] p-6 space-y-4">
            <p className="text-[11px] text-amber-200/85">
              <Badge className="mr-2 bg-amber-600/25 text-amber-100 border-0">Reconciliation</Badge>
              Operational receivable (RPC summary) vs GL AR slice for this contact. Company unmapped JE count is a
              global hygiene signal (not only this customer).
            </p>
            {reconLoading && (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            )}
            {reconError && (
              <div className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {reconError}
              </div>
            )}
            {!reconLoading && !reconError && recon && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Operational receivable</dt>
                  <dd className="text-xl font-semibold text-white mt-1 tabular-nums">
                    {formatCurrency(recon.operationalReceivable)}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4">
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">GL AR (journal slice)</dt>
                  <dd className="text-xl font-semibold text-violet-200 mt-1 tabular-nums">
                    {formatCurrency(recon.glArReceivable)}
                  </dd>
                </div>
                <div className="rounded-lg border border-gray-800 bg-[#0B0F14] p-4 sm:col-span-2">
                  <dt className="text-gray-500 text-xs uppercase tracking-wide">Variance (operational − GL)</dt>
                  <dd
                    className={cn(
                      'text-2xl font-bold mt-1 tabular-nums',
                      Math.abs(recon.variance) < 0.01 ? 'text-emerald-300' : 'text-amber-300'
                    )}
                  >
                    {formatCurrency(recon.variance)}
                  </dd>
                  <p className="text-[11px] text-gray-500 mt-2">As of {recon.asOfDate} (company date).</p>
                </div>
                <div className="rounded-lg border border-amber-900/30 bg-amber-950/15 p-4 sm:col-span-2">
                  <dt className="text-amber-200/90 text-xs uppercase tracking-wide">
                    Unmapped / suspicious (company AR JEs)
                  </dt>
                  <dd className="text-lg font-semibold text-amber-100 mt-1 tabular-nums">
                    {recon.companyUnmappedArCount} distinct journal entries
                  </dd>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Use AR/AP Reconciliation Center for line-level review. Non-zero variance or unmapped counts warrant
                    investigation.
                  </p>
                </div>
              </dl>
            )}
          </div>
        )}
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
