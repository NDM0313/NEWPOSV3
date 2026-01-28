import { X, FileText, Calendar, CreditCard, FileText as DocumentIcon } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface ModernTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
}

export function ModernTransactionModal({ transaction, onClose }: ModernTransactionModalProps) {
  return (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.75)' }} onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: '#273548' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-8 py-6" style={{
          borderBottom: '1px solid #334155',
          background: 'linear-gradient(90deg, #1e293b 0%, rgba(59, 130, 246, 0.1) 100%)'
        }}>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
              }}>
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl" style={{ color: '#ffffff' }}>Transaction Details</h2>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>{transaction.referenceNo}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#334155';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-8 py-6">
          {/* Transaction Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl p-4" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <div className="text-xs" style={{ color: '#94a3b8' }}>Transaction Date</div>
              </div>
              <div className="text-base" style={{ color: '#ffffff' }}>
                {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2 mb-2">
                <DocumentIcon className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <div className="text-xs" style={{ color: '#94a3b8' }}>Document Type</div>
              </div>
              <div className="text-base" style={{ color: '#ffffff' }}>{transaction.documentType}</div>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <div className="text-xs" style={{ color: '#94a3b8' }}>Payment Account</div>
              </div>
              <div className="text-base" style={{ color: '#ffffff' }}>{transaction.paymentAccount}</div>
            </div>

            <div className="rounded-xl p-4" style={{ background: '#1e293b' }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" style={{ color: '#94a3b8' }} />
                <div className="text-xs" style={{ color: '#94a3b8' }}>Reference Number</div>
              </div>
              <div className="text-base" style={{ color: '#ffffff' }}>{transaction.referenceNo}</div>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl p-4 mb-6" style={{ background: '#1e293b' }}>
            <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>Description</div>
            <div className="text-sm" style={{ color: '#ffffff' }}>{transaction.description}</div>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="rounded-xl p-4 mb-6" style={{
              background: 'rgba(245, 158, 11, 0.1)'
            }}>
              <div className="text-xs mb-2" style={{ color: '#f59e0b' }}>Notes</div>
              <div className="text-sm" style={{ color: '#fbbf24' }}>{transaction.notes}</div>
            </div>
          )}

          {/* Amount Details */}
          <div className="rounded-xl p-6 mb-6" style={{
            background: 'linear-gradient(135deg, #1e293b 0%, rgba(59, 130, 246, 0.05) 100%)'
          }}>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>Debit Amount</div>
                <div className="text-2xl" style={{ color: transaction.debit > 0 ? '#fb923c' : '#94a3b8' }}>
                  {transaction.debit > 0 ? `Rs ${transaction.debit.toLocaleString('en-PK')}` : '-'}
                </div>
              </div>
              <div className="text-center" style={{ borderLeft: '1px solid #334155', borderRight: '1px solid #334155' }}>
                <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>Credit Amount</div>
                <div className="text-2xl" style={{ color: transaction.credit > 0 ? '#10b981' : '#94a3b8' }}>
                  {transaction.credit > 0 ? `Rs ${transaction.credit.toLocaleString('en-PK')}` : '-'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>Running Balance</div>
                <div className="text-2xl" style={{ color: '#ffffff' }}>
                  Rs {transaction.runningBalance.toLocaleString('en-PK')}
                </div>
              </div>
            </div>
          </div>

          {/* Linked Invoices */}
          {transaction.linkedInvoices && transaction.linkedInvoices.length > 0 && (
            <div className="rounded-xl p-4 mb-6" style={{
              background: 'rgba(59, 130, 246, 0.1)'
            }}>
              <div className="text-xs mb-3" style={{ color: '#60a5fa' }}>Linked Invoices</div>
              <div className="flex flex-wrap gap-2">
                {transaction.linkedInvoices.map((invoice) => (
                  <span key={invoice} className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm" style={{
                    background: '#273548',
                    color: '#60a5fa'
                  }}>
                    {invoice}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="pt-4 text-xs" style={{
            borderTop: '1px solid #334155',
            color: '#64748b'
          }}>
            <div className="flex justify-between">
              <span>Transaction ID: {transaction.id}</span>
              <span>Generated on {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-5 flex justify-end gap-3" style={{
          borderTop: '1px solid #334155',
          background: '#1e293b'
        }}>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm rounded-lg transition-colors"
            style={{
              background: '#273548',
              border: '1px solid #334155',
              color: '#94a3b8'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#273548';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Close
          </button>
          <button 
            className="px-6 py-2.5 text-sm rounded-lg transition-all shadow-md"
            style={{
              background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
              color: '#ffffff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)';
            }}
          >
            Print Details
          </button>
        </div>
      </div>
    </div>
  );
}
