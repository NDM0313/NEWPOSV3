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
import { ModernCustomerSearch } from './modern-original/ModernCustomerSearch';
import { ModernDateFilter } from './modern-original/ModernDateFilter';
import { ModernSummaryCards } from './modern-original/ModernSummaryCards';
import { ModernLedgerTabs } from './modern-original/ModernLedgerTabs';
import { ModernTransactionModal } from './modern-original/ModernTransactionModal';
import type { LedgerData } from '@/app/services/customerLedgerTypes';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { toast } from 'sonner';

// LedgerData interface is imported from customerLedgerTypes

interface CustomerLedgerPageOriginalProps {
  initialCustomerId?: string;
  onClose?: () => void;
}

export default function CustomerLedgerPageOriginal({ 
  initialCustomerId,
  onClose 
}: CustomerLedgerPageOriginalProps = {}) {
  const { companyId } = useSupabase();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateRange, setDateRange] = useState({ from: '2025-01-01', to: new Date().toISOString().split('T')[0] });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Data states
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load customers on mount
  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  // Select initial customer if provided
  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === initialCustomerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [initialCustomerId, customers]);

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
        // If initialCustomerId provided, find and select it, otherwise select first
        if (initialCustomerId) {
          const customer = data.find(c => c.id === initialCustomerId);
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

  if (loading && !ledgerData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !ledgerData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
        <ErrorMessage message={error} onRetry={loadCustomers} />
      </div>
    );
  }

  if (!ledgerData || !selectedCustomer) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111827' }}>
        <div className="text-center">
          <p className="text-gray-400">No customer selected or no data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark" style={{ background: '#111827' }}>
      {/* Modern Header with Dark Theme */}
      <header className="sticky top-0 z-20 shadow-sm" style={{ 
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #374151'
      }}>
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          {/* Top Row - Title and Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  style={{ color: '#ffffff' }}
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-2xl flex items-center gap-3" style={{ color: '#ffffff' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  }}>
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  Customer Ledger
                </h1>
                <p className="text-sm mt-1 ml-13" style={{ color: '#9ca3af' }}>Manage and track customer accounts</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm" style={{
                color: '#ffffff',
                background: '#1f2937',
                border: '1px solid #374151'
              }} onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                 onMouseLeave={(e) => e.currentTarget.style.background = '#1f2937'}>
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm" style={{
                color: '#ffffff',
                background: '#1f2937',
                border: '1px solid #374151'
              }} onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                 onMouseLeave={(e) => e.currentTarget.style.background = '#1f2937'}>
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button className="px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 shadow-sm" style={{
                color: '#ffffff',
                background: '#1f2937',
                border: '1px solid #374151'
              }} onMouseEnter={(e) => e.currentTarget.style.background = '#374151'}
                 onMouseLeave={(e) => e.currentTarget.style.background = '#1f2937'}>
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Filters Row */}
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
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-6">
        {/* Summary Cards Section */}
        <ModernSummaryCards ledgerData={ledgerData} />

        {/* Ledger Content */}
        <div className="mt-6">
          <ModernLedgerTabs
            ledgerData={ledgerData}
            onTransactionClick={setSelectedTransaction}
          />
        </div>
      </div>

      {/* Transaction Modal */}
      {selectedTransaction && (
        <ModernTransactionModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  );
}
