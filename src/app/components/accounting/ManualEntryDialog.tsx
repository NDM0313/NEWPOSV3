import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useAccounting } from '@/app/context/AccountingContext';
import { toast } from 'sonner';

interface ManualEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCOUNT_OPTIONS = [
  'Cash - Main Counter',
  'Bank - HBL Business',
  'Bank - Meezan Current',
  'Mobile Wallet - JazzCash',
  'Accounts Receivable',
  'Accounts Payable',
  'Sales Revenue',
  'Rental Income',
  'Studio Income',
  'Purchase Expense',
  'Worker Payable',
  'Security Deposits'
];

export const ManualEntryDialog: React.FC<ManualEntryDialogProps> = ({ isOpen, onClose }) => {
  const accounting = useAccounting();
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset form
  const resetForm = () => {
    setDebitAccount('');
    setCreditAccount('');
    setAmount(0);
    setDescription('');
    setReferenceNo('');
  };

  // Handle submit
  const handleSubmit = () => {
    if (!debitAccount || !creditAccount || amount <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    if (debitAccount === creditAccount) {
      toast.error('Debit and Credit accounts cannot be the same');
      return;
    }

    setIsProcessing(true);

    try {
      accounting.addEntry({
        date: new Date(),
        debitAccount,
        creditAccount,
        amount,
        description: description || 'Manual journal entry',
        module: 'Accounting',
        source: 'Manual',
        referenceNo: referenceNo || `MAN-${Date.now()}`,
        metadata: {}
      });

      toast.success('Manual entry recorded successfully');
      resetForm();
      onClose();
    } catch (error) {
      toast.error('Failed to record entry');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-white">Manual Journal Entry</h2>
              <p className="text-sm text-gray-400 mt-1">Record custom accounting transaction</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Reference No */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Reference No (Optional)
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full bg-gray-950 border-2 border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Debit Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Debit Account <span className="text-red-400">*</span>
              </label>
              <select
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                className="w-full bg-gray-950 border-2 border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select Debit Account</option>
                {ACCOUNT_OPTIONS.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>

            {/* Credit Account */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Credit Account <span className="text-red-400">*</span>
              </label>
              <select
                value={creditAccount}
                onChange={(e) => setCreditAccount(e.target.value)}
                className="w-full bg-gray-950 border-2 border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Select Credit Account</option>
                {ACCOUNT_OPTIONS.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">
                  Rs
                </span>
                <input
                  type="number"
                  value={amount === 0 ? '' : amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  className="w-full bg-gray-950 border-2 border-gray-700 rounded-lg pl-14 pr-4 py-2.5 text-white text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter transaction description..."
                rows={3}
                className="w-full bg-gray-950 border-2 border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            {/* Info Alert */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-blue-300">
                <p className="font-semibold mb-1">Double-Entry Accounting</p>
                <p className="text-blue-400/80">
                  Every transaction must have equal debit and credit. This entry will DR {debitAccount || '___'} and CR {creditAccount || '___'} for Rs {amount.toLocaleString()}.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!debitAccount || !creditAccount || amount <= 0 || isProcessing}
              className="bg-blue-600 hover:bg-blue-500 text-white min-w-[120px]"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check size={16} />
                  Record Entry
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
