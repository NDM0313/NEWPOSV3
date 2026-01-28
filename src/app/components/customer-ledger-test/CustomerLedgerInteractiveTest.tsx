/**
 * Customer Ledger Interactive Test Page
 * 
 * This page allows manual testing of all Customer Ledger API functions
 * with interactive controls and real-time results.
 */

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Database, 
  Zap, 
  AlertCircle,
  Play,
  RefreshCw,
  Search,
  Calendar,
  FileText,
  DollarSign,
  Clock,
  Users
} from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import type { Customer, Transaction, Invoice, Payment } from '@/app/services/customerLedgerTypes';

interface TestResult {
  success: boolean;
  data?: any;
  error?: any;
  duration?: number;
}

export default function CustomerLedgerInteractiveTest() {
  const { user, companyId } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fromDate, setFromDate] = useState<string>('2025-01-01');
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Test Results
  const [customersResult, setCustomersResult] = useState<TestResult | null>(null);
  const [customerDetailsResult, setCustomerDetailsResult] = useState<TestResult | null>(null);
  const [ledgerSummaryResult, setLedgerSummaryResult] = useState<TestResult | null>(null);
  const [transactionsResult, setTransactionsResult] = useState<TestResult | null>(null);
  const [invoicesResult, setInvoicesResult] = useState<TestResult | null>(null);
  const [paymentsResult, setPaymentsResult] = useState<TestResult | null>(null);
  const [agingResult, setAgingResult] = useState<TestResult | null>(null);

  // Load customers on mount
  useEffect(() => {
    if (companyId) {
      loadCustomers();
    }
  }, [companyId]);

  const loadCustomers = async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getCustomers(companyId);
      const duration = Date.now() - startTime;
      
      setCustomers(data);
      setCustomersResult({ success: true, data, duration });
      
      if (data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data[0].id);
      }
    } catch (error: any) {
      setCustomersResult({ success: false, error, duration: 0 });
      console.error('[TEST] Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const testGetCustomers = async () => {
    if (!companyId) {
      alert('Company ID not available');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getCustomers(companyId);
      const duration = Date.now() - startTime;
      
      setCustomers(data);
      setCustomersResult({ success: true, data, duration });
      
      if (data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(data[0].id);
      }
    } catch (error: any) {
      setCustomersResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const testGetCustomerById = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer first');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getCustomerById(selectedCustomerId);
      const duration = Date.now() - startTime;
      
      setCustomerDetailsResult({ success: true, data, duration });
    } catch (error: any) {
      setCustomerDetailsResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const testGetLedgerSummary = async () => {
    if (!selectedCustomerId || !companyId) {
      alert('Please select a customer first');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getLedgerSummary(
        selectedCustomerId,
        companyId,
        fromDate,
        toDate
      );
      const duration = Date.now() - startTime;
      
      setLedgerSummaryResult({ success: true, data, duration });
    } catch (error: any) {
      setLedgerSummaryResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const testGetTransactions = async () => {
    if (!selectedCustomerId || !companyId) {
      alert('Please select a customer first');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getTransactions(
        selectedCustomerId,
        companyId,
        fromDate,
        toDate
      );
      const duration = Date.now() - startTime;
      
      setTransactionsResult({ success: true, data, duration });
    } catch (error: any) {
      setTransactionsResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const testGetInvoices = async () => {
    if (!selectedCustomerId || !companyId) {
      alert('Please select a customer first');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getInvoices(
        selectedCustomerId,
        companyId,
        fromDate,
        toDate
      );
      const duration = Date.now() - startTime;
      
      setInvoicesResult({ success: true, data, duration });
    } catch (error: any) {
      setInvoicesResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const testGetPayments = async () => {
    if (!selectedCustomerId || !companyId) {
      alert('Please select a customer first');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getPayments(
        selectedCustomerId,
        companyId,
        fromDate,
        toDate
      );
      const duration = Date.now() - startTime;
      
      setPaymentsResult({ success: true, data, duration });
    } catch (error: any) {
      setPaymentsResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const testGetAgingReport = async () => {
    if (!selectedCustomerId || !companyId) {
      alert('Please select a customer first');
      return;
    }
    
    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await customerLedgerAPI.getAgingReport(selectedCustomerId, companyId);
      const duration = Date.now() - startTime;
      
      setAgingResult({ success: true, data, duration });
    } catch (error: any) {
      setAgingResult({ success: false, error, duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  const clearAllResults = () => {
    setCustomersResult(null);
    setCustomerDetailsResult(null);
    setLedgerSummaryResult(null);
    setTransactionsResult(null);
    setInvoicesResult(null);
    setPaymentsResult(null);
    setAgingResult(null);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const TestCard = ({ 
    title, 
    icon: Icon, 
    onTest, 
    result, 
    disabled = false 
  }: { 
    title: string; 
    icon: any; 
    onTest: () => void; 
    result: TestResult | null;
    disabled?: boolean;
  }) => (
    <div className="p-4 rounded-lg border" style={{ 
      background: '#1e293b', 
      borderColor: '#334155' 
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-white">{title}</h3>
        </div>
        {result && (
          result.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )
        )}
      </div>
      
      <button
        onClick={onTest}
        disabled={disabled || loading || !companyId}
        className="w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: disabled || loading || !companyId ? '#475569' : '#3b82f6',
          color: '#ffffff'
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Test Function
          </>
        )}
      </button>
      
      {result && (
        <div className="mt-3 p-3 rounded bg-black/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Status:</span>
            <span className={`text-xs font-medium ${result.success ? 'text-green-500' : 'text-red-500'}`}>
              {result.success ? '✅ Success' : '❌ Failed'}
            </span>
          </div>
          {result.duration && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Duration:</span>
              <span className="text-xs text-gray-300">{result.duration}ms</span>
            </div>
          )}
          {result.error && (
            <div className="mt-2">
              <span className="text-xs text-red-400 font-mono">
                {result.error.message || JSON.stringify(result.error)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen p-8" style={{ background: '#0f172a' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Customer Ledger Interactive Test</h1>
          </div>
          <p className="text-gray-400">
            Manually test all Customer Ledger API functions with interactive controls
          </p>
        </div>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Customer Selection */}
          <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-white">Customer Selection</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                  disabled={customers.length === 0}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={loadCustomers}
                disabled={loading || !companyId}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Customers
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-white">Date Range</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                />
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-white">Info</h2>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Company ID:</span>
                <span className="text-white ml-2 font-mono text-xs">
                  {companyId || 'Not available'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Total Customers:</span>
                <span className="text-white ml-2">{customers.length}</span>
              </div>
              <div>
                <span className="text-gray-400">Selected:</span>
                <span className="text-white ml-2">
                  {selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name || 'N/A' : 'None'}
                </span>
              </div>
            </div>
            
            <button
              onClick={clearAllResults}
              className="w-full mt-4 px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors"
            >
              Clear All Results
            </button>
          </div>
        </div>

        {/* Test Functions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <TestCard
            title="1. Get All Customers"
            icon={Users}
            onTest={testGetCustomers}
            result={customersResult}
          />
          
          <TestCard
            title="2. Get Customer By ID"
            icon={Search}
            onTest={testGetCustomerById}
            result={customerDetailsResult}
            disabled={!selectedCustomerId}
          />
          
          <TestCard
            title="3. Get Ledger Summary"
            icon={FileText}
            onTest={testGetLedgerSummary}
            result={ledgerSummaryResult}
            disabled={!selectedCustomerId}
          />
          
          <TestCard
            title="4. Get Transactions"
            icon={FileText}
            onTest={testGetTransactions}
            result={transactionsResult}
            disabled={!selectedCustomerId}
          />
          
          <TestCard
            title="5. Get Invoices"
            icon={FileText}
            onTest={testGetInvoices}
            result={invoicesResult}
            disabled={!selectedCustomerId}
          />
          
          <TestCard
            title="6. Get Payments"
            icon={DollarSign}
            onTest={testGetPayments}
            result={paymentsResult}
            disabled={!selectedCustomerId}
          />
          
          <TestCard
            title="7. Get Aging Report"
            icon={Clock}
            onTest={testGetAgingReport}
            result={agingResult}
            disabled={!selectedCustomerId}
          />
        </div>

        {/* Results Display */}
        <div className="space-y-6">
          {/* Customer Details Result */}
          {customerDetailsResult?.success && customerDetailsResult.data && (
            <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
              <h2 className="text-xl font-semibold text-white mb-4">Customer Details</h2>
              <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto">
                {JSON.stringify(customerDetailsResult.data, null, 2)}
              </pre>
            </div>
          )}

          {/* Ledger Summary Result */}
          {ledgerSummaryResult?.success && ledgerSummaryResult.data && (
            <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
              <h2 className="text-xl font-semibold text-white mb-4">Ledger Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">Opening Balance</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(ledgerSummaryResult.data.openingBalance || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">Total Debit</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(ledgerSummaryResult.data.totalDebit || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">Total Credit</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(ledgerSummaryResult.data.totalCredit || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">Closing Balance</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(ledgerSummaryResult.data.closingBalance || 0)}
                  </div>
                </div>
              </div>
              <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto">
                {JSON.stringify(ledgerSummaryResult.data, null, 2)}
              </pre>
            </div>
          )}

          {/* Transactions Result */}
          {transactionsResult?.success && transactionsResult.data && (
            <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
              <h2 className="text-xl font-semibold text-white mb-4">
                Transactions ({transactionsResult.data.length})
              </h2>
              <div className="max-h-96 overflow-auto">
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300">
                  {JSON.stringify(transactionsResult.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Invoices Result */}
          {invoicesResult?.success && invoicesResult.data && (
            <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
              <h2 className="text-xl font-semibold text-white mb-4">
                Invoices ({invoicesResult.data.length})
              </h2>
              <div className="max-h-96 overflow-auto">
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300">
                  {JSON.stringify(invoicesResult.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Payments Result */}
          {paymentsResult?.success && paymentsResult.data && (
            <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
              <h2 className="text-xl font-semibold text-white mb-4">
                Payments ({paymentsResult.data.length})
              </h2>
              <div className="max-h-96 overflow-auto">
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300">
                  {JSON.stringify(paymentsResult.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Aging Report Result */}
          {agingResult?.success && agingResult.data && (
            <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
              <h2 className="text-xl font-semibold text-white mb-4">Aging Report</h2>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">Current</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(agingResult.data.current || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">1-30 Days</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(agingResult.data.days1to30 || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">31-60 Days</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(agingResult.data.days31to60 || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">61-90 Days</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(agingResult.data.days61to90 || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">90+ Days</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(agingResult.data.days90plus || 0)}
                  </div>
                </div>
                <div className="p-3 rounded bg-black/20">
                  <div className="text-xs text-gray-400">Total</div>
                  <div className="text-lg font-semibold text-white">
                    {formatAmount(agingResult.data.total || 0)}
                  </div>
                </div>
              </div>
              <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto">
                {JSON.stringify(agingResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
