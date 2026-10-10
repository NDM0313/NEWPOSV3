import React, { useState } from 'react';
import { useAccounting } from '@/app/context/AccountingContext';
import { useNavigation } from '@/app/context/NavigationContext';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Check, AlertCircle, Receipt, DollarSign, Eye, ExternalLink } from 'lucide-react';
import { UnifiedPaymentDialog, type PaymentContextType } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView, type LedgerEntityType } from '@/app/components/shared/UnifiedLedgerView';

/**
 * 🎯 ACCOUNTING INTEGRATION DEMO
 * 
 * This component demonstrates how modules auto-generate accounting entries.
 * Each button triggers the corresponding accounting function.
 */

export const AccountingIntegrationDemo = () => {
  const accounting = useAccounting();
  const navigation = useNavigation();
  const [lastAction, setLastAction] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState<PaymentContextType>('supplier');
  const [paymentEntity, setPaymentEntity] = useState({ name: '', id: '', outstanding: 0, reference: '' });

  // Ledger view state
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerEntity, setLedgerEntity] = useState<{ type: LedgerEntityType; name: string; id?: string }>({ 
    type: 'supplier', 
    name: '' 
  });

  const showResult = (action: string, result: boolean) => {
    setLastAction(action);
    setSuccess(result);
    setTimeout(() => setLastAction(''), 3000);
  };

  // ============================================
  // 📝 SALES DEMO
  // ============================================
  const handleTestSale = () => {
    const result = accounting.recordSale({
      invoiceNo: `INV-${Date.now()}`,
      customerName: 'Test Customer',
      amount: 50000,
      paymentMethod: 'Cash',
      paidAmount: 50000,
      module: 'Sales'
    });
    showResult('Sale recorded (Full Payment)', result);
  };

  const handleTestCreditSale = () => {
    const result = accounting.recordSale({
      invoiceNo: `INV-${Date.now()}`,
      customerName: 'Credit Customer',
      amount: 75000,
      paymentMethod: 'Cash',
      paidAmount: 25000,
      module: 'Sales'
    });
    showResult('Credit Sale recorded (Partial Payment)', result);
  };

  // ============================================
  // 🏠 RENTAL DEMO
  // ============================================
  const handleTestRentalBooking = () => {
    const result = accounting.recordRentalBooking({
      bookingId: `RNT-${Date.now()}`,
      customerName: 'Rental Customer',
      advanceAmount: 15000,
      securityDepositAmount: 50000,
      securityDepositType: 'Cash',
      paymentMethod: 'Cash'
    });
    showResult('Rental Booking recorded (Advance + Security)', result);
  };

  const handleTestRentalDelivery = () => {
    const result = accounting.recordRentalDelivery({
      bookingId: `RNT-${Date.now()}`,
      customerName: 'Rental Customer',
      remainingAmount: 35000,
      paymentMethod: 'Bank'
    });
    showResult('Rental Delivery recorded (Remaining Payment)', result);
  };

  // ============================================
  // 🎨 STUDIO DEMO
  // ============================================
  const handleTestStudioSale = () => {
    const result = accounting.recordStudioSale({
      invoiceNo: `STD-${Date.now()}`,
      customerName: 'Studio Customer',
      amount: 125000,
      paymentMethod: 'Cash',
      paidAmount: 125000
    });
    showResult('Studio Sale recorded', result);
  };

  const handleTestWorkerJob = () => {
    const result = accounting.recordWorkerJobCompletion({
      invoiceNo: `STD-${Date.now()}`,
      workerName: 'Ali Hassan',
      stage: 'Dyeing',
      cost: 8000
    });
    showResult('Worker Job Completed (Cost recorded)', result);
  };

  const handleTestWorkerPayment = () => {
    const result = accounting.recordWorkerPayment({
      workerName: 'Ali Hassan',
      amount: 8000,
      paymentMethod: 'Bank',
      referenceNo: `PAY-${Date.now()}`
    });
    showResult('Worker Payment recorded', result);
  };

  // ============================================
  // 💸 EXPENSE DEMO
  // ============================================
  const handleTestExpense = () => {
    const result = accounting.recordExpense({
      expenseId: `EXP-${Date.now()}`,
      category: 'Utilities',
      amount: 5000,
      paymentMethod: 'Cash',
      description: 'Electricity bill'
    });
    showResult('Expense recorded', result);
  };

  // ============================================
  // 📦 PURCHASE DEMO
  // ============================================
  const handleTestPurchase = () => {
    const result = accounting.recordPurchase({
      purchaseId: `PUR-${Date.now()}`,
      supplierName: 'Textile Suppliers Ltd',
      amount: 150000,
      purchaseType: 'Inventory',
      paidAmount: 0, // Credit purchase
      description: 'Fabric purchase'
    });
    showResult('Purchase recorded (Credit)', result);
  };

  const handleTestPurchaseWithPayment = () => {
    const result = accounting.recordPurchase({
      purchaseId: `PUR-${Date.now()}`,
      supplierName: 'Rawalpindi Fabrics',
      amount: 80000,
      purchaseType: 'Inventory',
      paidAmount: 30000,
      paymentMethod: 'Bank',
      description: 'Partial payment purchase'
    });
    showResult('Purchase recorded (Partial Payment)', result);
  };

  const handleTestSupplierPayment = () => {
    const result = accounting.recordSupplierPayment({
      supplierName: 'Textile Suppliers Ltd',
      amount: 50000,
      paymentMethod: 'Bank',
      referenceNo: `PAY-${Date.now()}`
    });
    showResult('Supplier Payment recorded', result);
  };

  // ============================================
  // 🎯 UNIFIED PAYMENT DIALOG TESTS
  // ============================================
  const openSupplierPayment = () => {
    setPaymentEntity({
      name: 'Textile Suppliers Ltd',
      id: 'SUP-001',
      outstanding: 150000,
      reference: 'PUR-1001'
    });
    setPaymentContext('supplier');
    setPaymentDialogOpen(true);
  };

  const openCustomerPayment = () => {
    setPaymentEntity({
      name: 'Ayesha Khan',
      id: 'CUST-001',
      outstanding: 50000,
      reference: 'INV-2001'
    });
    setPaymentContext('customer');
    setPaymentDialogOpen(true);
  };

  const openWorkerPayment = () => {
    setPaymentEntity({
      name: 'Ali Hassan',
      id: 'WRK-001',
      outstanding: 8000,
      reference: 'JOB-5001'
    });
    setPaymentContext('worker');
    setPaymentDialogOpen(true);
  };

  // ============================================
  // 🎯 UNIFIED LEDGER VIEW TESTS
  // ============================================
  const openSupplierLedger = () => {
    setLedgerEntity({
      type: 'supplier',
      name: 'Textile Suppliers Ltd',
      id: 'SUP-001'
    });
    setLedgerOpen(true);
  };

  const openCustomerLedger = () => {
    setLedgerEntity({
      type: 'customer',
      name: 'Ayesha Khan',
      id: 'CUST-001'
    });
    setLedgerOpen(true);
  };

  const openWorkerLedger = () => {
    setLedgerEntity({
      type: 'worker',
      name: 'Ali Hassan',
      id: 'WRK-001'
    });
    setLedgerOpen(true);
  };

  return (
    <div className="min-h-screen bg-input-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Receipt className="text-blue-400" size={32} />
            <h1 className="text-3xl font-bold text-foreground">Accounting Integration Demo</h1>
          </div>
          <p className="text-muted-foreground">
            Test automatic accounting entry generation from different modules.
            Each action creates proper double-entry transactions.
          </p>
          
          {/* Status Display */}
          {lastAction && (
            <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
              success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
            }`}>
              {success ? (
                <>
                  <Check className="text-[var(--erp-money-positive)]" size={20} />
                  <span className="text-[var(--erp-money-positive)] font-medium">✅ {lastAction}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="text-red-400" size={20} />
                  <span className="text-red-400 font-medium">❌ Failed: {lastAction}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm mb-1">Total Entries</p>
            <p className="text-3xl font-bold text-foreground">{accounting.entries.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm mb-1">Cash Balance</p>
            <p className="text-3xl font-bold text-[var(--erp-money-positive)]">
              Rs {accounting.getAccountBalance('Cash').toLocaleString()}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm mb-1">Supplier Payables</p>
            <p className="text-3xl font-bold text-red-400">
              Rs {accounting.getAccountBalance('Accounts Payable').toLocaleString()}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-muted-foreground text-sm mb-1">Worker Payables</p>
            <p className="text-3xl font-bold text-orange-400">
              Rs {accounting.getAccountBalance('Worker Payable').toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sales Module */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="text-blue-400" size={24} />
              <h2 className="text-xl font-bold text-foreground">Sales Module</h2>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleTestSale}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Full Payment Sale
              </Button>
              <Button 
                onClick={handleTestCreditSale}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Credit Sale (Partial)
              </Button>
            </div>
            <div className="mt-4 p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-muted-foreground">DR:</strong> Cash/Receivable | 
                <strong className="text-muted-foreground"> CR:</strong> Sales Income
              </p>
            </div>
          </div>

          {/* Rental Module */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="text-purple-400" size={24} />
              <h2 className="text-xl font-bold text-foreground">Rental Module</h2>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleTestRentalBooking}
                className="w-full bg-purple-600 hover:bg-purple-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Rental Booking
              </Button>
              <Button 
                onClick={handleTestRentalDelivery}
                className="w-full bg-purple-600 hover:bg-purple-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Rental Delivery
              </Button>
            </div>
            <div className="mt-4 p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-muted-foreground">Security = Liability</strong> (NOT income!)
              </p>
            </div>
          </div>

          {/* Studio Module */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="text-pink-400" size={24} />
              <h2 className="text-xl font-bold text-foreground">Studio Module</h2>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleTestStudioSale}
                className="w-full bg-pink-600 hover:bg-pink-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Studio Sale
              </Button>
              <Button 
                onClick={handleTestWorkerJob}
                className="w-full bg-pink-600 hover:bg-pink-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Worker Job Completion
              </Button>
              <Button 
                onClick={handleTestWorkerPayment}
                className="w-full bg-pink-600 hover:bg-pink-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Worker Payment
              </Button>
            </div>
            <div className="mt-4 p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-muted-foreground">Worker Payment = Expense</strong> (NOT sales reduction!)
              </p>
            </div>
          </div>

          {/* Expense Module */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="text-orange-400" size={24} />
              <h2 className="text-xl font-bold text-foreground">Expense Module</h2>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleTestExpense}
                className="w-full bg-orange-600 hover:bg-orange-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Expense
              </Button>
            </div>
            <div className="mt-4 p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-muted-foreground">DR:</strong> Expense | 
                <strong className="text-muted-foreground"> CR:</strong> Cash/Bank
              </p>
            </div>
          </div>

          {/* Purchase Module */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="text-muted-foreground" size={24} />
              <h2 className="text-xl font-bold text-foreground">Purchase Module</h2>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleTestPurchase}
                className="w-full bg-gray-600 hover:bg-gray-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Credit Purchase
              </Button>
              <Button 
                onClick={handleTestPurchaseWithPayment}
                className="w-full bg-gray-600 hover:bg-gray-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Partial Payment Purchase
              </Button>
              <Button 
                onClick={handleTestSupplierPayment}
                className="w-full bg-gray-600 hover:bg-gray-500 text-foreground justify-start"
              >
                <Check size={16} className="mr-2" />
                Record Supplier Payment
              </Button>
            </div>
            <div className="mt-4 p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong className="text-muted-foreground">DR:</strong> Inventory | 
                <strong className="text-muted-foreground"> CR:</strong> Accounts Payable
              </p>
            </div>
          </div>

        </div>

        {/* Recent Entries */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Recent Accounting Entries</h2>
          
          {accounting.entries.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto text-muted-foreground mb-3" size={48} />
              <p className="text-muted-foreground">No entries yet. Try the buttons above to generate transactions!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {accounting.entries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="bg-muted/40 border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className={
                          entry.source === 'Sale' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          entry.source === 'Rental' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          entry.source === 'Studio' ? 'bg-pink-500/10 text-pink-400 border-pink-500/20' :
                          entry.source === 'Expense' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          entry.source === 'Purchase' ? 'bg-gray-500/10 text-muted-foreground border-gray-500/20' :
                          entry.source === 'Payment' ? 'bg-green-500/10 text-[var(--erp-money-positive)] border-green-500/20' :
                          'bg-gray-500/10 text-muted-foreground border-gray-500/20'
                        }>
                          {entry.source}
                        </Badge>
                        <span className="text-blue-400 font-mono text-xs">{entry.referenceNo}</span>
                        <span className="text-muted-foreground text-xs">{entry.date.toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground text-sm mb-2">{entry.description}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">DR: </span>
                          <span className="text-[var(--erp-money-positive)] font-medium">{entry.debitAccount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CR: </span>
                          <span className="text-red-400 font-medium">{entry.creditAccount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">Rs {entry.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{entry.module}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 🎯 UNIFIED PAYMENT SYSTEM TEST */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="text-[var(--erp-money-positive)]" size={32} />
            <div>
              <h2 className="text-2xl font-bold text-foreground">🎯 Unified Payment System</h2>
              <p className="text-muted-foreground text-sm">One dialog for all payment types - Test it here!</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Supplier Payment */}
            <div className="bg-muted/40 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-red-400 mb-2">Supplier Payment</h3>
              <p className="text-sm text-muted-foreground mb-4">Pay outstanding to supplier</p>
              <Button 
                onClick={openSupplierPayment}
                className="w-full bg-red-600 hover:bg-red-500 text-foreground"
              >
                <DollarSign size={16} className="mr-2" />
                Make Payment
              </Button>
              <Button 
                onClick={openSupplierLedger}
                variant="outline"
                className="w-full mt-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Eye size={16} className="mr-2" />
                View Ledger
              </Button>
            </div>

            {/* Customer Receipt */}
            <div className="bg-muted/40 border border-green-500/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-[var(--erp-money-positive)] mb-2">Customer Receipt</h3>
              <p className="text-sm text-muted-foreground mb-4">Receive payment from customer</p>
              <Button 
                onClick={openCustomerPayment}
                className="w-full bg-green-600 hover:bg-green-500 text-foreground"
              >
                <DollarSign size={16} className="mr-2" />
                Receive Payment
              </Button>
              <Button 
                onClick={openCustomerLedger}
                variant="outline"
                className="w-full mt-2 border-green-500/30 text-[var(--erp-money-positive)] hover:bg-green-500/10"
              >
                <Eye size={16} className="mr-2" />
                View Ledger
              </Button>
            </div>

            {/* Worker Payment */}
            <div className="bg-muted/40 border border-orange-500/20 rounded-xl p-4">
              <h3 className="text-lg font-bold text-orange-400 mb-2">Worker Payment</h3>
              <p className="text-sm text-muted-foreground mb-4">Pay worker for job completion</p>
              <Button 
                onClick={openWorkerPayment}
                className="w-full bg-orange-600 hover:bg-orange-500 text-foreground"
              >
                <DollarSign size={16} className="mr-2" />
                Pay Worker
              </Button>
              <Button 
                onClick={openWorkerLedger}
                variant="outline"
                className="w-full mt-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              >
                <Eye size={16} className="mr-2" />
                View Ledger
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-400">
              <strong>💡 Pro Tip:</strong> Same component is used for all three payment types. 
              Only the context changes (supplier/customer/worker). Zero code duplication! 🚀
            </p>
          </div>

          <div className="mt-4">
            <Button 
              onClick={() => navigation.navigate('purchase-example')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-foreground"
            >
              <ExternalLink size={16} className="mr-2" />
              View Full Purchase List Example (Three-Dot Menu Demo)
            </Button>
          </div>
        </div>

      </div>

      {/* 🎯 UNIFIED PAYMENT DIALOG */}
      <UnifiedPaymentDialog
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        context={paymentContext}
        entityName={paymentEntity.name}
        entityId={paymentEntity.id}
        outstandingAmount={paymentEntity.outstanding}
        referenceNo={paymentEntity.reference}
        onSuccess={() => {
          showResult(`${paymentContext} payment successful`, true);
          setPaymentDialogOpen(false);
        }}
      />

      {/* 🎯 UNIFIED LEDGER VIEW */}
      <UnifiedLedgerView
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        entityType={ledgerEntity.type}
        entityName={ledgerEntity.name}
        entityId={ledgerEntity.id}
      />
    </div>
  );
};