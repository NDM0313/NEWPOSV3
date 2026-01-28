import { X, Calendar, FileText, CreditCard, MessageSquare, Link2, User, Clock, Edit, Trash2, Copy, Share2, Download } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';

interface TransactionDetailPanelProps {
  transaction: Transaction;
  onClose: () => void;
}

export function TransactionDetailPanel({ transaction, onClose }: TransactionDetailPanelProps) {
  return (
    <div 
      className="w-96 flex flex-col max-h-[calc(100vh-200px)] overflow-hidden shadow-xl"
      style={{ 
        borderLeft: '1px solid #334155',
        background: '#273548'
      }}
    >
      {/* Panel Header */}
      <div 
        className="px-6 py-4 flex-shrink-0"
        style={{ 
          borderBottom: '1px solid #334155',
          background: 'linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(30, 41, 59, 0.5))'
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: '#e2e8f0' }}>Transaction Details</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Complete information</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(100, 116, 139, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button 
            className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button 
            className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button 
            className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      {/* Panel Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Reference Badge */}
        <div 
          className="rounded-xl p-4 text-center"
          style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
        >
          <div className="text-xs mb-1" style={{ color: '#60a5fa' }}>Reference Number</div>
          <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{transaction.referenceNo}</div>
        </div>

        {/* Basic Info */}
        <div className="space-y-3">
          <div 
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(59, 130, 246, 0.08)' }}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-0.5" style={{ color: '#94a3b8' }}>Transaction Date</div>
              <div className="text-sm font-medium" style={{ color: '#cbd5e1' }}>
                {new Date(transaction.date).toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: 'long', 
                  year: 'numeric',
                  weekday: 'long'
                })}
              </div>
            </div>
          </div>

          <div 
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(168, 85, 247, 0.08)' }}
          >
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-0.5" style={{ color: '#94a3b8' }}>Document Type</div>
              <div className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{transaction.documentType}</div>
            </div>
          </div>

          <div 
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'rgba(16, 185, 129, 0.08)' }}
          >
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-0.5" style={{ color: '#94a3b8' }}>Payment Account</div>
              <div className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{transaction.paymentAccount}</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="text-xs mb-2" style={{ color: '#94a3b8' }}>Description</div>
          <div 
            className="p-3 rounded-lg text-sm"
            style={{ background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.2)', color: '#cbd5e1' }}
          >
            {transaction.description}
          </div>
        </div>

        {/* Amount Details */}
        <div 
          className="rounded-xl p-4"
          style={{ 
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          <div className="text-xs mb-3 font-medium" style={{ color: '#94a3b8' }}>Financial Details</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#94a3b8' }}>Debit Amount</span>
              <span className={`text-base font-bold tabular-nums ${transaction.debit > 0 ? 'text-orange-500' : 'text-slate-600'}`}>
                {transaction.debit > 0 ? `Rs ${transaction.debit.toLocaleString('en-PK')}` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#94a3b8' }}>Credit Amount</span>
              <span className={`text-base font-bold tabular-nums ${transaction.credit > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>
                {transaction.credit > 0 ? `Rs ${transaction.credit.toLocaleString('en-PK')}` : '-'}
              </span>
            </div>
            <div className="pt-3" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.3)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Running Balance</span>
                <span className="text-xl font-bold tabular-nums" style={{ color: '#3b82f6' }}>
                  Rs {transaction.runningBalance.toLocaleString('en-PK')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {transaction.notes && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: '#94a3b8' }}>
              <MessageSquare className="w-3.5 h-3.5" />
              Notes
            </div>
            <div 
              className="p-3 rounded-lg text-sm"
              style={{ background: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.2)', color: '#fb923c' }}
            >
              {transaction.notes}
            </div>
          </div>
        )}

        {/* Linked Transactions */}
        {transaction.linkedInvoices && transaction.linkedInvoices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: '#94a3b8' }}>
              <Link2 className="w-3.5 h-3.5" />
              Linked Invoices
            </div>
            <div className="space-y-2">
              {transaction.linkedInvoices.map((invoice) => (
                <div 
                  key={invoice} 
                  className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer"
                  style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium" style={{ color: '#3b82f6' }}>{invoice}</span>
                  </div>
                  <button className="text-blue-500 hover:text-blue-400">
                    <X className="w-4 h-4 rotate-45" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 space-y-2" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.2)' }}>
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: '#94a3b8' }}>
            <Clock className="w-3.5 h-3.5" />
            Additional Information
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#94a3b8' }}>Transaction ID</span>
            <span className="font-mono" style={{ color: '#cbd5e1' }}>{transaction.id}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#94a3b8' }}>Created By</span>
            <span className="flex items-center gap-1" style={{ color: '#cbd5e1' }}>
              <User className="w-3 h-3" />
              System Admin
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#94a3b8' }}>Created On</span>
            <span style={{ color: '#cbd5e1' }}>{new Date(transaction.date).toLocaleString('en-GB')}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#94a3b8' }}>Last Modified</span>
            <span style={{ color: '#cbd5e1' }}>{new Date(transaction.date).toLocaleString('en-GB')}</span>
          </div>
        </div>
      </div>

      {/* Panel Footer */}
      <div 
        className="px-6 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid #334155', background: 'rgba(30, 41, 59, 0.5)' }}
      >
        <div className="flex gap-2">
          <button className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
