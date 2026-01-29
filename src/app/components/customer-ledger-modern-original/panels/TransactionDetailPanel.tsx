import { useState, useEffect } from 'react';
import { X, Calendar, FileText, CreditCard, MessageSquare, Link2, Clock, Edit, Trash2, Copy, Share2, Download, Receipt } from 'lucide-react';
import type { Transaction } from '../../../types/index';
import { saleService } from '@/app/services/saleService';

interface TransactionDetailPanelProps {
  transaction: Transaction;
  onClose: () => void;
}

export function TransactionDetailPanel({ transaction, onClose }: TransactionDetailPanelProps) {
  const [saleDetails, setSaleDetails] = useState<any>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!transaction?.id) return;
    setSaleDetails(null);
    setPaymentDetails(null);
    if (transaction.documentType === 'Sale') {
      setLoadingDetails(true);
      saleService
        .getSaleById(transaction.id)
        .then((sale) => {
          setSaleDetails(sale || null);
        })
        .catch(() => setSaleDetails(null))
        .finally(() => setLoadingDetails(false));
    } else if (transaction.documentType === 'Payment') {
      setLoadingDetails(true);
      saleService
        .getPaymentById(transaction.id)
        .then((payment) => {
          setPaymentDetails(payment || null);
        })
        .catch(() => setPaymentDetails(null))
        .finally(() => setLoadingDetails(false));
    }
  }, [transaction?.id, transaction?.documentType]);

  const isSale = transaction.documentType === 'Sale';
  const isPayment = transaction.documentType === 'Payment';
  const title = isSale ? 'Sale Details' : isPayment ? 'Payment Details' : 'Transaction Details';
  const subtitle = isSale ? 'Invoice and items' : isPayment ? 'Payment information' : 'Complete information';

  return (
    <div className="w-96 flex flex-col max-h-[calc(100vh-200px)] overflow-hidden shadow-xl border-l border-border bg-card">
      {/* Panel Header – ERP theme */}
      <div className="px-6 py-4 flex-shrink-0 border-b border-border bg-muted">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-xs mt-0.5 text-muted-foreground">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/30 text-primary">
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/30 text-primary">
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 bg-primary/10 border border-primary/30 text-primary">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        <div className="rounded-xl p-4 text-center bg-primary/10 border border-primary/30">
          <div className="text-xs mb-1 text-primary">Reference Number</div>
          <div className="text-2xl font-bold text-primary">{transaction.referenceNo}</div>
        </div>

        {/* Sale-specific details */}
        {isSale && (
          <div 
            className="rounded-xl p-4"
            style={{ 
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)'
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium mb-3" style={{ color: '#60a5fa' }}>
              <Receipt className="w-4 h-4" />
              Sale / Invoice Details
            </div>
            {loadingDetails ? (
              <div className="text-sm" style={{ color: '#94a3b8' }}>Loading sale details...</div>
            ) : saleDetails ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Invoice No</span>
                  <span style={{ color: '#cbd5e1' }}>{saleDetails.invoice_no || transaction.referenceNo}</span>
                </div>
                {saleDetails.customer?.name && (
                  <div className="flex justify-between">
                    <span style={{ color: '#94a3b8' }}>Customer</span>
                    <span style={{ color: '#cbd5e1' }}>{saleDetails.customer.name}</span>
                  </div>
                )}
                {saleDetails.items?.length > 0 && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Items ({saleDetails.items.length})</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto rounded p-2" style={{ background: 'rgba(15, 23, 42, 0.5)' }}>
                      {saleDetails.items.slice(0, 8).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span style={{ color: '#cbd5e1' }}>{item.product?.name || item.product_name || 'Item'}</span>
                          <span style={{ color: '#94a3b8' }}>×{item.quantity} — Rs {(item.total ?? item.unit_price * item.quantity).toLocaleString('en-PK')}</span>
                        </div>
                      ))}
                      {saleDetails.items.length > 8 && (
                        <div className="text-xs pt-1" style={{ color: '#64748b' }}>+{saleDetails.items.length - 8} more</div>
                      )}
                    </div>
                  </div>
                )}
                <div className="pt-2" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.3)' }}>
                  <div className="flex justify-between font-medium">
                    <span style={{ color: '#94a3b8' }}>Total</span>
                    <span style={{ color: '#e2e8f0' }}>Rs {(saleDetails.total ?? transaction.debit).toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#94a3b8' }}>Paid</span>
                    <span style={{ color: '#10b981' }}>Rs {(saleDetails.paid_amount ?? 0).toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: '#94a3b8' }}>Due</span>
                    <span style={{ color: '#f97316' }}>Rs {(saleDetails.due_amount ?? 0).toLocaleString('en-PK')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm" style={{ color: '#94a3b8' }}>Sale record not found. Showing ledger summary.</div>
            )}
          </div>
        )}

        {/* Payment-specific details */}
        {isPayment && (
          <div 
            className="rounded-xl p-4"
            style={{ 
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium mb-3" style={{ color: '#10b981' }}>
              <CreditCard className="w-4 h-4" />
              Payment Details
            </div>
            {loadingDetails ? (
              <div className="text-sm" style={{ color: '#94a3b8' }}>Loading payment details...</div>
            ) : paymentDetails ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Reference</span>
                  <span style={{ color: '#cbd5e1' }}>{paymentDetails.referenceNo || transaction.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#94a3b8' }}>Method</span>
                  <span style={{ color: '#cbd5e1' }}>{paymentDetails.method || transaction.paymentAccount || '-'}</span>
                </div>
                {paymentDetails.accountName && (
                  <div className="flex justify-between">
                    <span style={{ color: '#94a3b8' }}>Account</span>
                    <span style={{ color: '#cbd5e1' }}>{paymentDetails.accountName}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.3)' }}>
                  <span style={{ color: '#94a3b8' }}>Amount</span>
                  <span style={{ color: '#10b981' }}>Rs {(paymentDetails.amount ?? transaction.credit).toLocaleString('en-PK')}</span>
                </div>
                {paymentDetails.notes && (
                  <div className="pt-2">
                    <div className="text-xs mb-1" style={{ color: '#94a3b8' }}>Notes</div>
                    <div className="p-2 rounded text-xs" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#cbd5e1' }}>{paymentDetails.notes}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm" style={{ color: '#94a3b8' }}>Payment record not found. Showing ledger summary.</div>
            )}
          </div>
        )}

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
              <div className="text-sm font-medium" style={{ color: '#cbd5e1' }}>{transaction.paymentAccount || '-'}</div>
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

        {/* Linked Invoices (Sale) */}
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Payments */}
        {transaction.linkedPayments && transaction.linkedPayments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: '#94a3b8' }}>
              <Link2 className="w-3.5 h-3.5" />
              Linked Payments
            </div>
            <div className="space-y-2">
              {transaction.linkedPayments.map((ref) => (
                <div 
                  key={ref} 
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium" style={{ color: '#10b981' }}>{ref}</span>
                  </div>
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
            <span className="font-mono truncate max-w-[180px]" style={{ color: '#cbd5e1' }} title={transaction.id}>{transaction.id}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: '#94a3b8' }}>Created On</span>
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
