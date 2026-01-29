import { useState, useEffect } from 'react';
import { X, Calendar, FileText, CreditCard, MessageSquare, Link2, Clock, Edit, Trash2, Copy, Share2, Download, Receipt } from 'lucide-react';
import type { Transaction } from '@/app/services/customerLedgerTypes';
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
    <div className="w-96 flex flex-col max-h-[calc(100vh-200px)] overflow-hidden shadow-xl border-l border-gray-800 bg-gray-900">
      {/* Panel Header – same style as Products page */}
      <div className="px-6 py-4 flex-shrink-0 border-b border-gray-800 bg-gray-950/95">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors text-gray-500 hover:bg-gray-800 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-500">
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-500">
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button className="flex-1 px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-500">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        <div className="rounded-xl p-4 text-center bg-blue-500/10 border border-blue-500/30">
          <div className="text-xs mb-1 text-blue-500">Reference Number</div>
          <div className="text-2xl font-bold text-blue-500">{transaction.referenceNo}</div>
        </div>

        {isSale && (
          <div className="rounded-xl p-4 bg-blue-500/10 border border-blue-500/25">
            <div className="flex items-center gap-2 text-sm font-medium mb-3 text-blue-500">
              <Receipt className="w-4 h-4" />
              Sale / Invoice Details
            </div>
            {loadingDetails ? (
              <div className="text-sm text-gray-500">Loading sale details...</div>
            ) : saleDetails ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoice No</span>
                  <span className="text-white">{saleDetails.invoice_no || transaction.referenceNo}</span>
                </div>
                {saleDetails.customer?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer</span>
                    <span className="text-white">{saleDetails.customer.name}</span>
                  </div>
                )}
                {saleDetails.items?.length > 0 && (
                  <div>
                    <div className="text-xs mb-1 text-gray-500">Items ({saleDetails.items.length})</div>
                    <div className="space-y-1 max-h-32 overflow-y-auto rounded p-2 bg-gray-800/50">
                      {saleDetails.items.slice(0, 8).map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-white">{item.product?.name || item.product_name || 'Item'}</span>
                          <span className="text-gray-500">×{item.quantity} — Rs {(item.total ?? item.unit_price * item.quantity).toLocaleString('en-PK')}</span>
                        </div>
                      ))}
                      {saleDetails.items.length > 8 && (
                        <div className="text-xs pt-1 text-gray-500">+{saleDetails.items.length - 8} more</div>
                      )}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-800">
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-500">Total</span>
                    <span className="text-white">Rs {(saleDetails.total ?? transaction.debit).toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Paid</span>
                    <span className="text-green-500">Rs {(saleDetails.paid_amount ?? 0).toLocaleString('en-PK')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due</span>
                    <span className="text-yellow-500">Rs {(saleDetails.due_amount ?? 0).toLocaleString('en-PK')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Sale record not found. Showing ledger summary.</div>
            )}
          </div>
        )}

        {isPayment && (
          <div className="rounded-xl p-4 bg-green-500/10 border border-green-500/25">
            <div className="flex items-center gap-2 text-sm font-medium mb-3 text-green-500">
              <CreditCard className="w-4 h-4" />
              Payment Details
            </div>
            {loadingDetails ? (
              <div className="text-sm text-gray-500">Loading payment details...</div>
            ) : paymentDetails ? (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="text-white">{paymentDetails.referenceNo || transaction.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Method</span>
                  <span className="text-white">{paymentDetails.method || transaction.paymentAccount || '-'}</span>
                </div>
                {paymentDetails.accountName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Account</span>
                    <span className="text-white">{paymentDetails.accountName}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium pt-2 border-t border-gray-800">
                  <span className="text-gray-500">Amount</span>
                  <span className="text-green-500">Rs {(paymentDetails.amount ?? transaction.credit).toLocaleString('en-PK')}</span>
                </div>
                {paymentDetails.notes && (
                  <div className="pt-2">
                    <div className="text-xs mb-1 text-gray-500">Notes</div>
                    <div className="p-2 rounded text-xs bg-gray-800 text-white">{paymentDetails.notes}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Payment record not found. Showing ledger summary.</div>
            )}
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 text-primary-foreground">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-0.5 text-gray-500">Transaction Date</div>
              <div className="text-sm font-medium text-white">
                {new Date(transaction.date).toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: 'long', 
                  year: 'numeric',
                  weekday: 'long'
                })}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-0.5 text-gray-500">Document Type</div>
              <div className="text-sm font-medium text-white">{transaction.documentType}</div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5">
            <div className="w-8 h-8 bg-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex-1">
              <div className="text-xs mb-0.5 text-gray-500">Payment Account</div>
              <div className="text-sm font-medium text-white">{transaction.paymentAccount || '-'}</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <div className="text-xs mb-2 text-gray-500">Description</div>
          <div className="p-3 rounded-lg text-sm bg-gray-800 border border-gray-800 text-white">
            {transaction.description}
          </div>
        </div>

        {/* Amount Details */}
        <div className="rounded-xl p-4 bg-primary/5 border border-primary/20">
          <div className="text-xs mb-3 font-medium text-gray-500">Financial Details</div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Debit Amount</span>
              <span className={`text-base font-bold tabular-nums ${transaction.debit > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
                {transaction.debit > 0 ? `Rs ${transaction.debit.toLocaleString('en-PK')}` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Credit Amount</span>
              <span className={`text-base font-bold tabular-nums ${transaction.credit > 0 ? 'text-green-500' : 'text-gray-500'}`}>
                {transaction.credit > 0 ? `Rs ${transaction.credit.toLocaleString('en-PK')}` : '-'}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Running Balance</span>
                <span className="text-xl font-bold tabular-nums text-primary">
                  Rs {transaction.runningBalance.toLocaleString('en-PK')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {transaction.notes && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-2 text-gray-500">
              <MessageSquare className="w-3.5 h-3.5" />
              Notes
            </div>
            <div className="p-3 rounded-lg text-sm bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
              {transaction.notes}
            </div>
          </div>
        )}

        {/* Linked Invoices (Sale) */}
        {transaction.linkedInvoices && transaction.linkedInvoices.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-2 text-gray-500">
              <Link2 className="w-3.5 h-3.5" />
              Linked Invoices
            </div>
            <div className="space-y-2">
              {transaction.linkedInvoices.map((invoice) => (
                <div
                  key={invoice}
                  className="flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer bg-primary/10 border border-primary/20"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">{invoice}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Payments */}
        {transaction.linkedPayments && transaction.linkedPayments.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-xs mb-2 text-gray-500">
              <Link2 className="w-3.5 h-3.5" />
              Linked Payments
            </div>
            <div className="space-y-2">
              {transaction.linkedPayments.map((ref) => (
                <div
                  key={ref}
                  className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-500">{ref}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 space-y-2 border-t border-gray-800">
          <div className="flex items-center gap-2 text-xs mb-3 text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            Additional Information
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Transaction ID</span>
            <span className="font-mono truncate max-w-[180px] text-white" title={transaction.id}>{transaction.id}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Created On</span>
            <span className="text-white">{new Date(transaction.date).toLocaleString('en-GB')}</span>
          </div>
        </div>
      </div>

      {/* Panel Footer – ERP theme */}
      <div className="px-6 py-4 flex-shrink-0 border-t border-gray-800 bg-gray-800">
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
