import React, { useState, useEffect } from 'react';
import { X, Wallet, Building2, CreditCard, AlertCircle, Check, ChevronDown, Upload, FileText, Calendar, Clock, Trash2, History, Banknote } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { useAccounting, type PaymentMethod, type Account } from '@/app/context/AccountingContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { accountHelperService } from '@/app/services/accountHelperService';
import { toast } from 'sonner';

// ============================================
// 🎯 TYPES
// ============================================

export type PaymentContextType = 'supplier' | 'customer' | 'worker' | 'rental';

export interface PreviousPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  accountName?: string;
}

export interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  context: PaymentContextType;
  entityName: string;
  entityId?: string;
  outstandingAmount: number;
  totalAmount?: number; // Total invoice amount (for showing payment progress)
  paidAmount?: number; // Already paid amount
  previousPayments?: PreviousPayment[]; // Payment history for this invoice
  referenceNo?: string; // Invoice number (string) for display
  referenceId?: string; // UUID of sale/purchase/rental (for journal entry reference_id)
  onSuccess?: () => void;
  // Edit mode props
  editMode?: boolean;
  paymentToEdit?: {
    id: string;
    amount: number;
    method: string;
    accountId?: string;
    date: string;
    referenceNumber?: string;
    notes?: string;
  };
}

// ============================================
// 🎯 UNIFIED PAYMENT DIALOG (REDESIGNED)
// ============================================

export const UnifiedPaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  context,
  entityName,
  entityId,
  outstandingAmount,
  totalAmount,
  paidAmount = 0,
  previousPayments = [],
  referenceNo,
  referenceId, // CRITICAL FIX: UUID for journal entry reference_id
  onSuccess,
  editMode = false,
  paymentToEdit
}) => {
  const accounting = useAccounting();
  const settings = useSettings();
  const { branchId, companyId, user } = useSupabase();
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 🎯 NEW: Date & Time states (combined as datetime-local)
  const [paymentDateTime, setPaymentDateTime] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  
  // 🎯 NEW: Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      if (editMode && paymentToEdit) {
        // Edit mode: populate with existing payment data
        setAmount(paymentToEdit.amount);
        setPaymentMethod((paymentToEdit.method.charAt(0).toUpperCase() + paymentToEdit.method.slice(1)) as PaymentMethod || 'Cash');
        setSelectedAccount(paymentToEdit.accountId || '');
        setNotes(paymentToEdit.notes || '');
        
        // Format date for datetime-local input
        const paymentDate = new Date(paymentToEdit.date);
        const year = paymentDate.getFullYear();
        const month = String(paymentDate.getMonth() + 1).padStart(2, '0');
        const day = String(paymentDate.getDate()).padStart(2, '0');
        const hours = String(paymentDate.getHours() || 0).padStart(2, '0');
        const minutes = String(paymentDate.getMinutes() || 0).padStart(2, '0');
        setPaymentDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      } else {
        // Add mode: reset to defaults
        setAmount(0);
        setPaymentMethod('Cash');
        setSelectedAccount('');
        setNotes('');
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        setPaymentDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      }
      setAttachments([]);
    }
  }, [isOpen, editMode, paymentToEdit]);

  // 🎯 Filter accounts based on payment method AND branch
  // Include: branch-specific accounts + global accounts
  const getFilteredAccounts = (): Account[] => {
    return accounting.accounts.filter(account => {
      // Filter by payment method type
      if (account.type !== paymentMethod) return false;
      
      // Include if: no branch restriction (global) OR matches current branch
      const isGlobal = !account.branchId || account.branchId === 'global' || account.branchId === '';
      const isBranchSpecific = account.branchId === branchId;
      
      return isGlobal || isBranchSpecific;
    });
  };

  // Reset account selection when payment method changes + Auto-select default account
  React.useEffect(() => {
    // 🎯 AUTO-SELECT DEFAULT ACCOUNT FROM SETTINGS
    const defaultPayment = settings.defaultAccounts?.paymentMethods?.find(
      p => p.method === paymentMethod
    );
    
    if (defaultPayment?.defaultAccount) {
      // Find matching account by name
      const matchingAccount = accounting.accounts.find(
        acc => acc.type === paymentMethod && acc.name === defaultPayment.defaultAccount
      );
      
      if (matchingAccount) {
        setSelectedAccount(matchingAccount.id);
        return;
      }
    }
    
    // Fallback: clear selection if no default found
    setSelectedAccount('');
  }, [paymentMethod, settings.defaultAccounts, accounting.accounts]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Auto-select amount on focus (global numeric input behavior)
  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (amount > 0) {
      e.target.select();
    }
  };

  // Handle amount change (0 = empty display)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setAmount(value);
  };

  // Get context-specific labels
  const getContextLabels = () => {
    switch (context) {
      case 'supplier':
        return {
          title: 'Make Payment to Supplier',
          entityLabel: 'Supplier',
          actionButton: 'Make Payment',
          successMessage: 'Payment made successfully',
          badge: 'bg-red-500/10 text-red-400 border-red-500/20',
          icon: '💰'
        };
      case 'customer':
        return {
          title: 'Receive Payment from Customer',
          entityLabel: 'Customer',
          actionButton: 'Receive Payment',
          successMessage: 'Payment received successfully',
          badge: 'bg-green-500/10 text-green-400 border-green-500/20',
          icon: '💵'
        };
      case 'worker':
        return {
          title: 'Pay Worker',
          entityLabel: 'Worker',
          actionButton: 'Make Payment',
          successMessage: 'Worker payment completed',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          icon: '👷'
        };
      case 'rental':
        return {
          title: 'Pay Rental',
          entityLabel: 'Rental',
          actionButton: 'Make Payment',
          successMessage: 'Rental payment completed',
          badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: '🏠'
        };
    }
  };

  const labels = getContextLabels();

  // 🎯 Validation - Account ALWAYS required
  const canSubmit = 
    amount > 0 && 
    amount <= outstandingAmount && 
    selectedAccount !== '' &&
    !isProcessing;

  // Handle payment submission
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsProcessing(true);

    try {
      let success = false;
      let workerPaymentRef: string | undefined;

      // EDIT MODE: Update existing payment
      if (editMode && paymentToEdit) {
        const paymentDate = paymentDateTime.split('T')[0];
        
        if (context === 'customer' && referenceId) {
          const { saleService } = await import('@/app/services/saleService');
          await saleService.updatePayment(
            paymentToEdit.id,
            referenceId,
            {
              amount,
              paymentMethod,
              accountId: selectedAccount,
              paymentDate,
              referenceNumber: notes || undefined,
              notes: notes || undefined
            }
          );
          success = true;
        } else if (context === 'supplier' && referenceId) {
          const { purchaseService } = await import('@/app/services/purchaseService');
          await purchaseService.updatePayment(
            paymentToEdit.id,
            referenceId,
            {
              amount,
              paymentMethod,
              accountId: selectedAccount,
              paymentDate,
              referenceNumber: notes || undefined,
              notes: notes || undefined
            }
          );
          success = true;
        }
      } else {
        // ADD MODE: Create new payment
        // Route to appropriate accounting function based on context
        switch (context) {
          case 'supplier':
          // STEP 2 FIX: Create payment record first (like customer payments)
          if (!referenceId) {
            toast.error('Purchase ID is required for payment recording');
            setIsProcessing(false);
            return;
          }
          if (!selectedAccount) {
            toast.error('Please select an account for payment');
            setIsProcessing(false);
            return;
          }
          if (!companyId) {
            toast.error('Company ID is required');
            setIsProcessing(false);
            return;
          }
          
          // CRITICAL FIX: branchId can be "all" from context, but purchaseService will get actual branch_id from purchase record
          // So we pass it as optional - purchaseService will use purchase's branch_id instead
          try {
            const paymentRef = generateDocumentNumber('payment');
            const { purchaseService } = await import('@/app/services/purchaseService');
            await purchaseService.recordPayment(
              referenceId,
              amount,
              paymentMethod,
              selectedAccount,
              companyId,
              branchId && branchId !== 'all' ? branchId : undefined,
              paymentRef
            );
            incrementNextNumber('payment');
            success = await accounting.recordSupplierPayment({
              purchaseId: referenceId,
              supplierName: entityName,
              supplierId: entityId,
              amount,
              paymentMethod,
              referenceNo: paymentRef || referenceNo || `PUR-${Date.now()}`
            });
          } catch (paymentError: any) {
            console.error('[UNIFIED PAYMENT] Error recording purchase payment:', paymentError);
            toast.error('Payment failed', {
              description: paymentError.message || 'Unable to record payment. Please try again.'
            });
            setIsProcessing(false);
            return;
          }
          break;

        case 'customer':
          if (!referenceId) {
            toast.error('Sale ID is required for payment recording');
            setIsProcessing(false);
            return;
          }
          if (!selectedAccount) {
            toast.error('Please select an account for payment');
            setIsProcessing(false);
            return;
          }
          if (!companyId || !branchId) {
            toast.error('Company ID and Branch ID are required');
            setIsProcessing(false);
            return;
          }
          
          try {
            const paymentRef = generateDocumentNumber('payment');
            const { saleService } = await import('@/app/services/saleService');
            await saleService.recordPayment(
              referenceId,
              amount,
              paymentMethod,
              selectedAccount,
              companyId,
              branchId,
              paymentDateTime.split('T')[0],
              paymentRef
            );
            incrementNextNumber('payment');
            success = await accounting.recordSalePayment({
              saleId: referenceId,
              invoiceNo: referenceNo || `INV-${Date.now()}`,
              customerName: entityName,
              customerId: entityId,
              amount,
              paymentMethod,
              accountId: selectedAccount
            });
          } catch (paymentError: any) {
            console.error('[UNIFIED PAYMENT] Error recording payment:', paymentError);
            toast.error('Payment failed', {
              description: paymentError.message || 'Unable to record payment. Please try again.'
            });
            setIsProcessing(false);
            return;
          }
          break;

        case 'worker': {
          const paymentRef = generateDocumentNumber('payment');
          success = await accounting.recordWorkerPayment({
            workerName: entityName,
            workerId: entityId,
            amount,
            paymentMethod,
            referenceNo: paymentRef
          });
          incrementNextNumber('payment');
          if (success) workerPaymentRef = paymentRef;
          break;
        }

        case 'rental':
          if (!referenceId || !companyId) {
            toast.error('Rental ID and Company are required');
            setIsProcessing(false);
            return;
          }
          try {
            const { rentalService } = await import('@/app/services/rentalService');
            await rentalService.addPayment(
              referenceId,
              companyId,
              amount,
              paymentMethod,
              notes || undefined,
              user?.id ?? undefined
            );
            success = true;
          } catch (rentalError: any) {
            toast.error(rentalError?.message || 'Rental payment failed');
            setIsProcessing(false);
            return;
          }
          break;
        }
      }

      if (success) {
        const selectedAccountDetails = accounting.accounts.find(a => a.id === selectedAccount);
        const accountInfo = selectedAccountDetails ? ` from ${selectedAccountDetails.name}` : '';
        toast.success(labels.successMessage, {
          description: `Rs ${amount.toLocaleString()} via ${paymentMethod}${accountInfo} on ${paymentDateTime}`
        });
        if (context === 'worker') onSuccess?.(workerPaymentRef);
        else onSuccess?.();
        onClose();
      } else {
        toast.error('Payment failed', {
          description: 'Unable to process payment. Please try again.'
        });
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Payment failed', {
        description: error?.message || 'An error occurred while processing payment.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog - COMPACT LAYOUT */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl">
                {labels.icon}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {editMode ? 'Edit Payment' : labels.title}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Complete transaction details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body - TWO COLUMN LAYOUT */}
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              
              {/* LEFT COLUMN */}
              <div className="space-y-4">
                
                {/* Entity Info Card */}
                <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-400">{labels.entityLabel} Details</span>
                    <Badge variant="outline" className={labels.badge}>
                      {context.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-white mb-1">{entityName}</p>
                  {referenceNo && (
                    <p className="text-xs text-gray-500 font-mono bg-gray-900/50 px-2 py-1 rounded inline-block">
                      Ref: {referenceNo}
                    </p>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                    {/* Show total amount if provided */}
                    {totalAmount !== undefined && totalAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Total Amount</span>
                        <span className="text-sm font-semibold text-white">
                          Rs {totalAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {/* Show paid amount if any */}
                    {paidAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Already Paid</span>
                        <span className="text-sm font-semibold text-green-400">
                          Rs {paidAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                      <span className="text-xs text-gray-400">Outstanding Amount</span>
                      <span className="text-xl font-bold text-yellow-400">
                        Rs {outstandingAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* 🎯 Payment History Section (if previous payments exist) */}
                {previousPayments.length > 0 && (
                  <div className="bg-gradient-to-br from-green-950/20 to-gray-900/50 border border-green-900/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <History size={14} className="text-green-400" />
                      <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">
                        Already Received Payments ({previousPayments.length})
                      </span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {previousPayments.map((payment, index) => (
                        <div key={payment.id || index} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                              <Banknote size={12} className="text-green-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">
                                {new Date(payment.date).toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </p>
                              {payment.accountName && (
                                <p className="text-[10px] text-gray-500">{payment.method} • {payment.accountName}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-green-400">
                            Rs {payment.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Amount */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Amount <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">
                      Rs
                    </span>
                    <input
                      type="number"
                      value={amount === 0 ? '' : amount}
                      onChange={handleAmountChange}
                      onFocus={handleAmountFocus}
                      placeholder="0.00"
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-14 pr-4 py-3 text-white text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                      min="0"
                      max={outstandingAmount}
                      step="0.01"
                    />
                  </div>
                  {amount > outstandingAmount && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                      <AlertCircle size={14} />
                      <span>Amount cannot exceed outstanding balance</span>
                    </div>
                  )}
                  {amount > 0 && amount <= outstandingAmount && (
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-gray-400">Remaining Balance</span>
                      <span className="text-green-400 font-semibold">
                        Rs {(outstandingAmount - amount).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment Method - COMPACT */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Method <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Cash')}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                        paymentMethod === 'Cash'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <Wallet size={18} className={paymentMethod === 'Cash' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${paymentMethod === 'Cash' ? 'text-blue-400' : 'text-gray-400'}`}>
                        Cash
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Bank')}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                        paymentMethod === 'Bank'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <Building2 size={18} className={paymentMethod === 'Bank' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${paymentMethod === 'Bank' ? 'text-blue-400' : 'text-gray-400'}`}>
                        Bank
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Mobile Wallet')}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                        paymentMethod === 'Mobile Wallet'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <CreditCard size={18} className={paymentMethod === 'Mobile Wallet' ? 'text-blue-400' : 'text-gray-400'} />
                      <span className={`text-xs font-medium ${paymentMethod === 'Mobile Wallet' ? 'text-blue-400' : 'text-gray-400'}`}>
                        Wallet
                      </span>
                    </button>
                  </div>
                </div>

                {/* Account Selection */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Select Account <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAccount}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2.5 pr-10 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option value="" className="text-gray-500">
                        {paymentMethod === 'Cash' && 'Select Cash Account'}
                        {paymentMethod === 'Bank' && 'Select Bank Account'}
                        {paymentMethod === 'Mobile Wallet' && 'Select Wallet Account'}
                      </option>
                      {getFilteredAccounts().map(account => (
                        <option key={account.id} value={account.id} className="text-white bg-gray-900">
                          {account.name} • Balance: Rs {account.balance.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                  </div>
                  {selectedAccount === '' && (
                    <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={11} />
                      Please select an account to proceed
                    </p>
                  )}
                  {selectedAccount && (() => {
                    const account = accounting.accounts.find(a => a.id === selectedAccount);
                    if (account && amount > account.balance) {
                      return (
                        <div className="flex items-center gap-2 mt-2 text-orange-400 text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                          <AlertCircle size={14} />
                          <span>Warning: Amount exceeds account balance</span>
                        </div>
                      );
                    }
                    if (account) {
                      return (
                        <div className="mt-2 text-xs text-gray-400">
                        Selected: <span className="text-white font-medium">{account.name}</span>
                      </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                
                {/* Date & Time */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Payment Date & Time <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                      type="datetime-local"
                      value={paymentDateTime}
                      onChange={(e) => setPaymentDateTime(e.target.value)}
                      className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Attachments */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Attachments (Optional)
                  </label>
                  
                  {/* Upload Area */}
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400 mb-0.5">
                        <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-600">PDF, PNG, JPG up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                  </label>

                  {/* Uploaded Files */}
                  {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="text-blue-400 flex-shrink-0" size={16} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add payment notes, remarks, or additional details..."
                    rows={5}
                    className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">
              {attachments.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <FileText size={12} />
                  {attachments.length} file{attachments.length > 1 ? 's' : ''} attached
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check size={16} />
                    {editMode ? 'Update Payment' : labels.actionButton}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};