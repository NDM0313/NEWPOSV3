'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Calendar, Download, Printer, Filter, FileText, 
  X, User, ChevronDown, Loader2
} from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI, type CustomerLedgerSummary, type AgingReport } from '@/app/services/customerLedgerApi';
import type { Customer, Transaction, Invoice, Payment, LedgerData } from '@/app/services/customerLedgerTypes';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { EmptyState } from '@/app/components/shared/EmptyState';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

// Import tab components (we'll create simplified versions)
import { OverviewTab } from './tabs/OverviewTab';
import { TransactionsTab } from './tabs/TransactionsTab';
import { InvoicesTab } from './tabs/InvoicesTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { AgingReportTab } from './tabs/AgingReportTab';

export const CustomerLedgerTestPage: React.FC = () => {
  const { companyId } = useSupabase();
  
  // State management
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'invoices' | 'payments' | 'aging'>('overview');
  
  // Data states
  const [ledgerSummary, setLedgerSummary] = useState<CustomerLedgerSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
  
  // Loading and error states
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Load customers on mount
  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  // Load ledger data when customer or date range changes
  useEffect(() => {
    if (selectedCustomer && companyId) {
      loadLedgerData();
    }
  }, [selectedCustomer, dateRange, companyId]);

  const loadCustomers = async () => {
    if (!companyId) return;
    
    try {
      setLoadingCustomers(true);
      setError(null);
      const data = await customerLedgerAPI.getCustomers(companyId);
      setCustomers(data);
      if (data.length > 0 && !selectedCustomer) {
        setSelectedCustomer(data[0]);
      }
    } catch (err: any) {
      console.error('[CUSTOMER LEDGER] Error loading customers:', err);
      setError(err.message || 'Failed to load customers');
      toast.error('Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadLedgerData = async () => {
    if (!selectedCustomer || !companyId) return;

    try {
      setLoadingData(true);
      setError(null);

      // Load all data in parallel
      const [summary, trans, invs, pays, aging] = await Promise.all([
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

      setLedgerSummary(summary);
      setTransactions(trans);
      setInvoices(invs);
      setPayments(pays);
      setAgingReport(aging);
    } catch (err: any) {
      console.error('[CUSTOMER LEDGER] Error loading ledger data:', err);
      setError(err.message || 'Failed to load ledger data');
      toast.error('Failed to load ledger data');
    } finally {
      setLoadingData(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.phone.includes(customerSearchTerm)
  );

  const formatDateRange = () => {
    const from = new Date(dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const to = new Date(dateRange.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${from} - ${to}`;
  };

  if (loadingCustomers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading customers..." />
      </div>
    );
  }

  if (error && !selectedCustomer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
        <ErrorMessage message={error} onRetry={loadCustomers} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Modern Header with Glassmorphism Effect */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          {/* Top Row - Title and Actions */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                Customer Ledger
              </h1>
              <p className="text-sm text-slate-500 mt-1 ml-13">Manage and track customer accounts</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-slate-300 hover:bg-slate-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-slate-300 hover:bg-slate-50"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-slate-300 hover:bg-slate-50"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-4">
            {/* Customer Search */}
            <div className="relative flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setCustomerSearchOpen(!customerSearchOpen)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm hover:border-slate-400 transition-all"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-slate-900">
                        {selectedCustomer ? selectedCustomer.name : 'Select Customer'}
                      </div>
                      {selectedCustomer && (
                        <div className="text-xs text-slate-500">
                          {selectedCustomer.code} • {selectedCustomer.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-slate-400 transition-transform",
                    customerSearchOpen && "rotate-180"
                  )} />
                </div>
              </button>

              {customerSearchOpen && (
                <div className="absolute z-30 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-3 border-b border-slate-200 bg-slate-50">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search customers..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="pl-10"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-80">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">No customers found</div>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setCustomerSearchOpen(false);
                            setCustomerSearchTerm('');
                          }}
                          className={cn(
                            "w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors flex items-center gap-3 border-l-4",
                            selectedCustomer?.id === customer.id
                              ? 'bg-blue-50 border-blue-600'
                              : 'border-transparent'
                          )}
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="text-slate-900">{customer.name}</div>
                            <div className="text-xs text-slate-500">{customer.code} • {customer.phone}</div>
                          </div>
                          <div className="text-xs text-slate-400">{customer.city}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Date Range Filter */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="pl-10 w-40"
                />
              </div>
              <span className="text-slate-400">to</span>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="pl-10 w-40"
                />
              </div>
              <Badge variant="outline" className="px-3 py-1">
                {formatDateRange()}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-6">
        {!selectedCustomer ? (
          <EmptyState
            title="No Customer Selected"
            message="Please select a customer to view their ledger"
          />
        ) : loadingData ? (
          <LoadingSpinner size="lg" text="Loading ledger data..." />
        ) : error ? (
          <ErrorMessage message={error} onRetry={loadLedgerData} />
        ) : (
          <>
            {/* Summary Cards - Will be shown in OverviewTab */}
            
            {/* Ledger Content */}
            <div className="mt-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Tab Headers */}
                <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex gap-0 overflow-x-auto">
                    {[
                      { id: 'overview', label: 'Overview', icon: '📊' },
                      { id: 'transactions', label: 'All Transactions', icon: '📋', count: transactions.length },
                      { id: 'invoices', label: 'Invoices', icon: '📄', count: invoices.length },
                      { id: 'payments', label: 'Payments', icon: '💳' },
                      { id: 'aging', label: 'Aging Report', icon: '⏰' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                          "flex items-center gap-3 px-6 py-4 border-b-2 transition-all whitespace-nowrap",
                          activeTab === tab.id
                            ? 'border-blue-600 bg-blue-50/50'
                            : 'border-transparent hover:bg-slate-50'
                        )}
                      >
                        <span className="text-lg">{tab.icon}</span>
                        <div className="text-left">
                          <div className={cn(
                            "text-sm",
                            activeTab === tab.id ? 'text-blue-700' : 'text-slate-700'
                          )}>
                            {tab.label}
                          </div>
                          {tab.count !== undefined && (
                            <div className="text-xs text-slate-500">{tab.count} entries</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'overview' && ledgerSummary && (
                    <OverviewTab
                      summary={ledgerSummary}
                      transactions={transactions.slice(0, 5)}
                      invoices={invoices}
                    />
                  )}
                  {activeTab === 'transactions' && (
                    <TransactionsTab transactions={transactions} />
                  )}
                  {activeTab === 'invoices' && (
                    <InvoicesTab invoices={invoices} />
                  )}
                  {activeTab === 'payments' && (
                    <PaymentsTab payments={payments} />
                  )}
                  {activeTab === 'aging' && agingReport && (
                    <AgingReportTab agingReport={agingReport} />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
