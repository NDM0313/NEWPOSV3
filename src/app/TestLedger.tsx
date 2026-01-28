/**
 * Customer Ledger Test Page
 * 
 * This page tests all database operations and API endpoints for the Customer Ledger module.
 * DO NOT modify main application until all tests pass.
 * 
 * Features:
 * - Tests all CRUD operations
 * - Verifies data mapping
 * - Shows detailed console logs
 * - Displays success/failure indicators
 * - Performance metrics
 */

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2, Database, Zap, AlertCircle } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import type { Customer, Transaction, Invoice, Payment } from '@/app/services/customerLedgerTypes';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  duration?: number;
  data?: any;
  error?: any;
}

export default function TestLedger() {
  const { user, companyId } = useSupabase();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [testData, setTestData] = useState<any>(null);

  const updateTestResult = (name: string, updates: Partial<TestResult>) => {
    setTestResults(prev => {
      const existing = prev.find(t => t.name === name);
      if (existing) {
        return prev.map(t => t.name === name ? { ...t, ...updates } : t);
      }
      return [...prev, { name, status: 'pending', message: '', ...updates }];
    });
  };

  const runTest = async (name: string, testFn: () => Promise<any>) => {
    const startTime = Date.now();
    updateTestResult(name, { status: 'running', message: 'Running...' });
    
    console.log(`[TEST] Starting: ${name}`);
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      updateTestResult(name, {
        status: 'success',
        message: '✅ Test passed',
        duration,
        data: result
      });
      
      console.log(`[TEST] ✅ Success: ${name} (${duration}ms)`, result);
      return { success: true, data: result };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      updateTestResult(name, {
        status: 'error',
        message: `❌ ${error.message || 'Test failed'}`,
        duration,
        error: error
      });
      
      console.error(`[TEST] ❌ Failed: ${name} (${duration}ms)`, error);
      return { success: false, error };
    }
  };

  // Test 1: Get All Customers
  const testGetCustomers = async () => {
    if (!companyId) throw new Error('Company ID not available');
    
    console.log('[TEST] Fetching customers for company:', companyId);
    const customers = await customerLedgerAPI.getCustomers(companyId);
    
    if (!Array.isArray(customers)) {
      throw new Error('Expected customers to be an array');
    }
    
    if (customers.length === 0) {
      console.warn('[TEST] ⚠️ No customers found. This may be expected if database is empty.');
    }
    
    console.log(`[TEST] Found ${customers.length} customers:`, customers);
    return customers;
  };

  // Test 2: Get Customer By ID
  const testGetCustomerById = async (customerId: string) => {
    console.log('[TEST] Fetching customer by ID:', customerId);
    const customer = await customerLedgerAPI.getCustomerById(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    console.log('[TEST] Customer details:', customer);
    return customer;
  };

  // Test 3: Get Ledger Summary
  const testGetLedgerSummary = async (customerId: string) => {
    if (!companyId) throw new Error('Company ID not available');
    
    const fromDate = '2025-01-01';
    const toDate = new Date().toISOString().split('T')[0];
    
    console.log('[TEST] Fetching ledger summary:', { customerId, fromDate, toDate });
    const summary = await customerLedgerAPI.getLedgerSummary(customerId, companyId, fromDate, toDate);
    
    // Validate summary structure
    const requiredFields = ['openingBalance', 'totalDebit', 'totalCredit', 'closingBalance', 'totalInvoices'];
    for (const field of requiredFields) {
      if (!(field in summary)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    console.log('[TEST] Ledger summary:', summary);
    return summary;
  };

  // Test 4: Get Transactions
  const testGetTransactions = async (customerId: string) => {
    if (!companyId) throw new Error('Company ID not available');
    
    const fromDate = '2025-01-01';
    const toDate = new Date().toISOString().split('T')[0];
    
    console.log('[TEST] Fetching transactions:', { customerId, fromDate, toDate });
    const transactions = await customerLedgerAPI.getTransactions(customerId, companyId, fromDate, toDate);
    
    if (!Array.isArray(transactions)) {
      throw new Error('Expected transactions to be an array');
    }
    
    // Validate transaction structure
    if (transactions.length > 0) {
      const first = transactions[0];
      const requiredFields = ['id', 'date', 'referenceNo', 'documentType', 'debit', 'credit', 'runningBalance'];
      for (const field of requiredFields) {
        if (!(field in first)) {
          throw new Error(`Transaction missing required field: ${field}`);
        }
      }
    }
    
    console.log(`[TEST] Found ${transactions.length} transactions:`, transactions);
    return transactions;
  };

  // Test 5: Get Invoices
  const testGetInvoices = async (customerId: string) => {
    if (!companyId) throw new Error('Company ID not available');
    
    const fromDate = '2025-01-01';
    const toDate = new Date().toISOString().split('T')[0];
    
    console.log('[TEST] Fetching invoices:', { customerId, fromDate, toDate });
    const invoices = await customerLedgerAPI.getInvoices(customerId, companyId, fromDate, toDate);
    
    if (!Array.isArray(invoices)) {
      throw new Error('Expected invoices to be an array');
    }
    
    // Validate invoice structure
    if (invoices.length > 0) {
      const first = invoices[0];
      const requiredFields = ['invoiceNo', 'date', 'invoiceTotal', 'status', 'paidAmount', 'pendingAmount'];
      for (const field of requiredFields) {
        if (!(field in first)) {
          throw new Error(`Invoice missing required field: ${field}`);
        }
      }
    }
    
    console.log(`[TEST] Found ${invoices.length} invoices:`, invoices);
    return invoices;
  };

  // Test 6: Get Payments
  const testGetPayments = async (customerId: string) => {
    if (!companyId) throw new Error('Company ID not available');
    
    const fromDate = '2025-01-01';
    const toDate = new Date().toISOString().split('T')[0];
    
    console.log('[TEST] Fetching payments:', { customerId, fromDate, toDate });
    const payments = await customerLedgerAPI.getPayments(customerId, companyId, fromDate, toDate);
    
    if (!Array.isArray(payments)) {
      throw new Error('Expected payments to be an array');
    }
    
    // Validate payment structure
    if (payments.length > 0) {
      const first = payments[0];
      const requiredFields = ['id', 'paymentNo', 'date', 'amount', 'method'];
      for (const field of requiredFields) {
        if (!(field in first)) {
          throw new Error(`Payment missing required field: ${field}`);
        }
      }
    }
    
    console.log(`[TEST] Found ${payments.length} payments:`, payments);
    return payments;
  };

  // Test 7: Get Aging Report
  const testGetAgingReport = async (customerId: string) => {
    if (!companyId) throw new Error('Company ID not available');
    
    console.log('[TEST] Fetching aging report:', { customerId });
    const aging = await customerLedgerAPI.getAgingReport(customerId, companyId);
    
    // Validate aging structure
    const requiredFields = ['current', 'days1to30', 'days31to60', 'days61to90', 'days90plus', 'total'];
    for (const field of requiredFields) {
      if (!(field in aging)) {
        throw new Error(`Aging report missing required field: ${field}`);
      }
    }
    
    console.log('[TEST] Aging report:', aging);
    return aging;
  };

  // Run All Tests
  const runAllTests = async () => {
    if (!companyId) {
      alert('Company ID not available. Please ensure you are logged in.');
      return;
    }

    setIsRunning(true);
    setTestResults([]);
    setTestData(null);

    console.log('='.repeat(80));
    console.log('[TEST SUITE] Starting Customer Ledger API Tests');
    console.log('='.repeat(80));
    console.log('[TEST] Company ID:', companyId);
    console.log('[TEST] User ID:', user?.id);

    try {
      // Test 1: Get Customers
      const customersResult = await runTest('1. Get All Customers', testGetCustomers);
      if (!customersResult.success) {
        console.error('[TEST SUITE] Cannot continue - customers fetch failed');
        setIsRunning(false);
        return;
      }

      const customers = customersResult.data as Customer[];
      
      if (customers.length === 0) {
        console.warn('[TEST SUITE] ⚠️ No customers found. Some tests will be skipped.');
        setIsRunning(false);
        return;
      }

      // Select first customer for remaining tests
      const testCustomer = customers[0];
      setSelectedCustomer(testCustomer);
      console.log('[TEST SUITE] Using customer for tests:', testCustomer);

      // Test 2: Get Customer By ID
      await runTest('2. Get Customer By ID', () => testGetCustomerById(testCustomer.id));

      // Test 3: Get Ledger Summary
      const summaryResult = await runTest('3. Get Ledger Summary', () => 
        testGetLedgerSummary(testCustomer.id)
      );

      // Test 4: Get Transactions
      const transactionsResult = await runTest('4. Get Transactions', () => 
        testGetTransactions(testCustomer.id)
      );

      // Test 5: Get Invoices
      const invoicesResult = await runTest('5. Get Invoices', () => 
        testGetInvoices(testCustomer.id)
      );

      // Test 6: Get Payments
      const paymentsResult = await runTest('6. Get Payments', () => 
        testGetPayments(testCustomer.id)
      );

      // Test 7: Get Aging Report
      const agingResult = await runTest('7. Get Aging Report', () => 
        testGetAgingReport(testCustomer.id)
      );

      // Compile test data
      setTestData({
        customer: testCustomer,
        summary: summaryResult.data,
        transactions: transactionsResult.data,
        invoices: invoicesResult.data,
        payments: paymentsResult.data,
        aging: agingResult.data,
      });

      // Summary
      const passed = testResults.filter(t => t.status === 'success').length;
      const failed = testResults.filter(t => t.status === 'error').length;
      const total = testResults.length;

      console.log('='.repeat(80));
      console.log('[TEST SUITE] Test Summary');
      console.log(`[TEST SUITE] Total: ${total}, Passed: ${passed}, Failed: ${failed}`);
      console.log('='.repeat(80));

    } catch (error) {
      console.error('[TEST SUITE] Fatal error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'running':
        return 'bg-blue-500/10 border-blue-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const successCount = testResults.filter(t => t.status === 'success').length;
  const errorCount = testResults.filter(t => t.status === 'error').length;
  const totalCount = testResults.length;

  return (
    <div className="min-h-screen p-8" style={{ background: '#0f172a' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Customer Ledger Test Page</h1>
          </div>
          <p className="text-gray-400">
            Test all database operations and API endpoints before integrating with main application
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-400">Total Tests</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalCount}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-400">Passed</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{successCount}</div>
          </div>
          <div className="p-4 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-400">Failed</span>
            </div>
            <div className="text-2xl font-bold text-red-500">{errorCount}</div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="mb-8 p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Test Control Panel</h2>
              <p className="text-sm text-gray-400">
                {companyId ? `Company ID: ${companyId}` : '⚠️ Company ID not available'}
              </p>
            </div>
            <button
              onClick={runAllTests}
              disabled={isRunning || !companyId}
              className="px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isRunning ? '#475569' : '#3b82f6',
                color: '#ffffff'
              }}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Run All Tests
                </>
              )}
            </button>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-3 mb-8">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="font-medium text-white">{result.name}</div>
                    <div className="text-sm text-gray-400 mt-1">{result.message}</div>
                    {result.error && (
                      <div className="text-xs text-red-400 mt-2 font-mono">
                        {result.error.message || JSON.stringify(result.error)}
                      </div>
                    )}
                  </div>
                </div>
                {result.duration && (
                  <div className="text-sm text-gray-400">
                    {result.duration}ms
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Test Data Display */}
        {testData && (
          <div className="p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <h2 className="text-xl font-semibold text-white mb-4">Test Data Preview</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Customer</h3>
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto">
                  {JSON.stringify(testData.customer, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Summary</h3>
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto">
                  {JSON.stringify(testData.summary, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Transactions ({testData.transactions?.length || 0})
                </h3>
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto max-h-64">
                  {JSON.stringify(testData.transactions, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Invoices ({testData.invoices?.length || 0})
                </h3>
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto max-h-64">
                  {JSON.stringify(testData.invoices, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Payments ({testData.payments?.length || 0})
                </h3>
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto max-h-64">
                  {JSON.stringify(testData.payments, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Aging Report</h3>
                <pre className="p-4 rounded bg-black/20 text-xs text-gray-300 overflow-auto">
                  {JSON.stringify(testData.aging, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 rounded-lg border" style={{ background: '#1e293b', borderColor: '#334155' }}>
          <h2 className="text-xl font-semibold text-white mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Ensure you are logged in and have a valid company ID</li>
            <li>Click "Run All Tests" to execute all API endpoint tests</li>
            <li>Check the console (F12) for detailed logs</li>
            <li>Verify all tests pass before proceeding with main application integration</li>
            <li>Review the test data preview to ensure data mapping is correct</li>
            <li>Only proceed to Phase 4-8 after all tests pass successfully</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
