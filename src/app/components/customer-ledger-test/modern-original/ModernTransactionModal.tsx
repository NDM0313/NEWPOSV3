import { X, FileText, Calendar, CreditCard, FileText as DocumentIcon } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface ModernTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export function ModernTransactionModal({ transaction, onClose }: ModernTransactionModalProps) {
  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 bg-black/75"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-gray-900 border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header – Products-style, no gradient */}
        <div className="px-8 py-6 border-b border-gray-800 bg-gray-900/80">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-600">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Transaction Details</h2>
                <p className="text-sm mt-1 text-gray-500">{transaction.referenceNo}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-8 py-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl p-4 bg-gray-900/50 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div className="text-xs text-gray-500">Transaction Date</div>
              </div>
              <div className="text-base text-white">
                {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <div className="rounded-xl p-4 bg-gray-900/50 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <DocumentIcon className="w-4 h-4 text-gray-500" />
                <div className="text-xs text-gray-500">Document Type</div>
              </div>
              <div className="text-base text-white">{transaction.documentType}</div>
            </div>

            <div className="rounded-xl p-4 bg-gray-900/50 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <div className="text-xs text-gray-500">Payment Account</div>
              </div>
              <div className="text-base text-white">{transaction.paymentAccount}</div>
            </div>

            <div className="rounded-xl p-4 bg-gray-900/50 border border-gray-800">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <div className="text-xs text-gray-500">Reference Number</div>
              </div>
              <div className="text-base text-white">{transaction.referenceNo}</div>
            </div>
          </div>

          <div className="rounded-xl p-4 mb-6 bg-gray-900/50 border border-gray-800">
            <div className="text-xs mb-2 text-gray-500">Description</div>
            <div className="text-sm text-white">{transaction.description}</div>
          </div>

          {transaction.notes && (
            <div className="rounded-xl p-4 mb-6 bg-yellow-500/10 border border-yellow-500/20">
              <div className="text-xs mb-2 text-yellow-400">Notes</div>
              <div className="text-sm text-yellow-300/90">{transaction.notes}</div>
            </div>
          )}

          <div className="rounded-xl p-6 mb-6 bg-gray-900/50 border border-gray-800">
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-xs mb-2 text-gray-500">Debit Amount</div>
                <div className={`text-2xl font-semibold tabular-nums ${transaction.debit > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                  {transaction.debit > 0 ? `Rs ${transaction.debit.toLocaleString('en-PK')}` : '-'}
                </div>
              </div>
              <div className="text-center border-l border-r border-gray-800">
                <div className="text-xs mb-2 text-gray-500">Credit Amount</div>
                <div className={`text-2xl font-semibold tabular-nums ${transaction.credit > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {transaction.credit > 0 ? `Rs ${transaction.credit.toLocaleString('en-PK')}` : '-'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs mb-2 text-gray-500">Running Balance</div>
                <div className="text-2xl font-semibold tabular-nums text-white">
                  Rs {transaction.runningBalance.toLocaleString('en-PK')}
                </div>
              </div>
            </div>
          </div>

          {transaction.linkedInvoices && transaction.linkedInvoices.length > 0 && (
            <div className="rounded-xl p-4 mb-6 bg-blue-500/10 border border-blue-500/20">
              <div className="text-xs mb-3 text-blue-400">Linked Invoices</div>
              <div className="flex flex-wrap gap-2">
                {transaction.linkedInvoices.map((invoice) => (
                  <span
                    key={invoice}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-gray-900/80 text-blue-400 border border-gray-700"
                  >
                    {invoice}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 text-xs border-t border-gray-800 text-gray-500">
            <div className="flex justify-between">
              <span>Transaction ID: {transaction.id}</span>
              <span>Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer – Products-style buttons */}
        <div className="px-8 py-5 flex justify-end gap-3 border-t border-gray-800 bg-gray-900/80">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm rounded-lg transition-colors bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            Close
          </button>
          <button className="px-6 py-2.5 text-sm rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500 shadow-sm">
            Print Details
          </button>
        </div>
      </div>
    </div>
  );
}
