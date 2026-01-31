import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  DollarSign,
  Calendar,
  FileText,
  User,
  CreditCard,
  Banknote,
  Building2,
  Wallet,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  History,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/app/components/ui/alert-dialog';
import { cn } from '@/app/components/ui/utils';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export interface Payment {
  id: string;
  date: string;
  referenceNo: string;
  amount: number;
  method: string;
  accountId?: string;
  accountName?: string;
  notes?: string;
  createdAt?: string;
}

export interface InvoiceDetails {
  id: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  customerId?: string;
  total: number;
  paid: number;
  due: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  payments?: Payment[];
}

interface ViewPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceDetails | null;
  onAddPayment: () => void;
  onEditPayment?: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getPaymentStatusConfig = (status: string) => {
  switch (status) {
    case 'paid':
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle, label: 'Paid' };
    case 'partial':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock, label: 'Partial' };
    case 'unpaid':
    default:
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle, label: 'Unpaid' };
  }
};

const getPaymentMethodIcon = (method: string) => {
  const m = method.toLowerCase();
  if (m.includes('cash')) return Banknote;
  if (m.includes('bank')) return Building2;
  if (m.includes('wallet') || m.includes('mobile')) return Wallet;
  if (m.includes('card')) return CreditCard;
  return DollarSign;
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ViewPaymentsModal: React.FC<ViewPaymentsModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onAddPayment,
  onEditPayment,
  onDeletePayment,
  onRefresh,
}) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Fetch payments when modal opens or refreshes
  useEffect(() => {
    if (isOpen && invoice?.id) {
      const fetchPayments = async () => {
        setLoadingPayments(true);
        try {
          // STEP 2 FIX: Determine if this is a purchase or sale based on invoice number pattern
          // Purchase: PO-XXX, Sale: INV-XXX or other patterns
          const isPurchase = invoice.invoiceNo?.startsWith('PO-') || false;
          const isRental = invoice.invoiceNo?.startsWith('RN-') || false;
          
          if (isRental) {
            try {
              const { rentalService } = await import('@/app/services/rentalService');
              const fetchedPayments = await rentalService.getRentalPayments(invoice.id);
              setPayments((fetchedPayments || []).map((p: any) => ({
                id: p.id,
                date: p.payment_date || p.created_at?.split('T')[0] || '',
                referenceNo: p.reference || '',
                amount: p.amount,
                method: p.method,
                notes: p.reference,
                createdAt: p.created_at,
              })));
            } catch (rentalError: any) {
              console.error('[VIEW PAYMENTS] Error fetching rental payments:', rentalError);
              setPayments(invoice.payments || []);
            }
          } else if (isPurchase) {
            // Purchase payments
            try {
              const { purchaseService } = await import('@/app/services/purchaseService');
              console.log('[VIEW PAYMENTS] Fetching purchase payments for:', invoice.id);
              const fetchedPayments = await purchaseService.getPurchasePayments(invoice.id);
              console.log('[VIEW PAYMENTS] Purchase payments loaded:', fetchedPayments);
              setPayments(fetchedPayments || []);
            } catch (purchaseError: any) {
              console.error('[VIEW PAYMENTS] Error fetching purchase payments:', purchaseError);
              setPayments(invoice.payments || []);
            }
          } else {
            // Sale payments
            try {
              const { saleService } = await import('@/app/services/saleService');
              console.log('[VIEW PAYMENTS] Fetching sale payments for:', invoice.id);
              const fetchedPayments = await saleService.getSalePayments(invoice.id);
              console.log('[VIEW PAYMENTS] Sale payments loaded:', fetchedPayments);
              setPayments(fetchedPayments || []);
            } catch (saleError: any) {
              console.error('[VIEW PAYMENTS] Error fetching sale payments:', saleError);
              setPayments(invoice.payments || []);
            }
          }
        } catch (error: any) {
          console.error('[VIEW PAYMENTS] Error fetching payments:', error);
          setPayments(invoice.payments || []);
        } finally {
          setLoadingPayments(false);
        }
      };
      fetchPayments();
    } else {
      setPayments(invoice?.payments || []);
    }
  }, [isOpen, invoice?.id, invoice?.invoiceNo, invoice?.payments]);

  if (!isOpen || !invoice) return null;

  const statusConfig = getPaymentStatusConfig(invoice.paymentStatus);
  const StatusIcon = statusConfig.icon;
  const progressPercent = invoice.total > 0 ? Math.min((invoice.paid / invoice.total) * 100, 100) : 0;

  const handleDeleteClick = (payment: Payment) => {
    setPaymentToDelete(payment);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!paymentToDelete || !onDeletePayment) return;

    setIsDeleting(true);
    try {
      // CRITICAL FIX: Increased timeout to 30 seconds for complex delete operations
      // Delete involves: payment deletion, journal entry reversal, activity logging, balance updates
      const deletePromise = onDeletePayment(paymentToDelete.id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Payment deletion is taking longer than expected. Please wait or try again.')), 30000)
      );
      
      await Promise.race([deletePromise, timeoutPromise]);
      
      toast.success('Payment deleted successfully. Reverse entry created.');
      setDeleteConfirmOpen(false);
      setPaymentToDelete(null);
      
      // CRITICAL FIX: Refetch payments after deletion
      if (invoice?.id) {
        const { saleService } = await import('@/app/services/saleService');
        const fetchedPayments = await saleService.getSalePayments(invoice.id);
        setPayments(fetchedPayments);
      }
      
      // CRITICAL FIX: Call refresh callback
      await onRefresh?.();
    } catch (error: any) {
      console.error('[VIEW PAYMENTS] Error deleting payment:', error);
      toast.error(error?.message || 'Failed to delete payment. Please try again.');
    } finally {
      // CRITICAL FIX: Always reset loading state
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Main Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={true}>
        <DialogContent 
          className="bg-gray-900 border-gray-700 text-white sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col"
          onInteractOutside={(e) => {
            // Prevent closing when clicking outside if delete confirmation is open
            if (deleteConfirmOpen) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="border-b border-gray-800 pb-4">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Receipt size={20} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Payment Details</h2>
                  <p className="text-xs text-gray-400">Invoice {invoice.invoiceNo}</p>
                </div>
              </div>
              <Badge className={cn('text-xs font-medium capitalize gap-1 h-7 px-3', statusConfig.bg, statusConfig.text, statusConfig.border)}>
                <StatusIcon size={14} />
                {statusConfig.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Invoice Summary Card */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-700 flex items-center justify-center">
                    <User size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="text-sm font-medium text-white">{invoice.customerName || 'Walk-in Customer'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-700 flex items-center justify-center">
                    <Calendar size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Date</p>
                    <p className="text-sm font-medium text-white">{formatDate(invoice.date)}</p>
                  </div>
                </div>
              </div>

              {/* Payment Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Payment Progress</span>
                  <span className="text-white font-semibold">{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      progressPercent >= 100 ? 'bg-green-500' : progressPercent > 0 ? 'bg-yellow-500' : 'bg-gray-600'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2 bg-gray-900/50 rounded-lg">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-sm font-bold text-white">Rs {invoice.total.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <p className="text-xs text-green-400">Paid</p>
                    <p className="text-sm font-bold text-green-400">Rs {invoice.paid.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    <p className="text-xs text-red-400">Due</p>
                    <p className="text-sm font-bold text-red-400">Rs {invoice.due.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment History Section */}
            <div className="bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Payment History</h3>
                  <Badge className="bg-gray-700 text-gray-300 text-xs">{payments.length}</Badge>
                </div>
                {invoice.due > 0 && (
                  <Button
                    size="sm"
                    onClick={onAddPayment}
                    className="bg-green-600 hover:bg-green-500 text-white h-8 gap-1.5"
                  >
                    <Plus size={14} />
                    Add Payment
                  </Button>
                )}
              </div>

              {loadingPayments ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Loading payment history...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <DollarSign size={24} className="text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-sm mb-1">No payments recorded yet</p>
                  <p className="text-gray-500 text-xs mb-4">Click "Add Payment" to record a payment</p>
                  {invoice.due > 0 && (
                    <Button
                      size="sm"
                      onClick={onAddPayment}
                      className="bg-green-600 hover:bg-green-500 text-white"
                    >
                      <Plus size={14} className="mr-1" />
                      Add First Payment
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-900/30 text-xs font-medium text-gray-500 uppercase">
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Reference</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-2">Method</div>
                    <div className="col-span-2">Account</div>
                    <div className="col-span-2 text-center">Actions</div>
                  </div>

                  {/* Table Body */}
                  {payments.map((payment, index) => {
                    const MethodIcon = getPaymentMethodIcon(payment.method);
                    return (
                      <div
                        key={payment.id || index}
                        className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-800/30 transition-colors"
                      >
                        <div className="col-span-2">
                          <p className="text-sm text-white">{formatDate(payment.date)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs font-mono text-gray-400">{payment.referenceNo || '—'}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-sm font-semibold text-green-400">
                            Rs {payment.amount.toLocaleString()}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5">
                            <MethodIcon size={12} className="text-gray-500" />
                            <span className="text-xs text-gray-300 capitalize">{payment.method}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-400 truncate">{payment.accountName || '—'}</p>
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-1">
                          {onEditPayment && (
                            <button
                              onClick={() => onEditPayment(payment)}
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors"
                              title="Edit Payment"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {onDeletePayment && (
                            <button
                              onClick={() => handleDeleteClick(payment)}
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete Payment"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {payment.notes && (
                            <button
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title={payment.notes}
                            >
                              <FileText size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Additional Info */}
            {invoice.due === 0 && (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <CheckCircle size={20} className="text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-400">Fully Paid</p>
                  <p className="text-xs text-green-300/70">This invoice has been completely paid.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-800 pt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} recorded
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
              >
                Close
              </Button>
              {invoice.due > 0 && (
                <Button
                  onClick={onAddPayment}
                  className="bg-green-600 hover:bg-green-500 text-white"
                >
                  <Plus size={16} className="mr-1" />
                  Add Payment
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - Rendered outside main dialog to avoid aria-hidden conflicts */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setDeleteConfirmOpen(false);
          setPaymentToDelete(null);
        }
      }} modal={true}>
        <AlertDialogContent 
          className="bg-gray-900 border-gray-700"
          onInteractOutside={(e) => {
            // Prevent closing when deleting
            if (isDeleting) {
              e.preventDefault();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle size={20} className="text-red-400" />
              Delete Payment
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {paymentToDelete && (
                <>
                  Are you sure you want to delete this payment of{' '}
                  <span className="font-semibold text-red-400">
                    Rs {paymentToDelete.amount.toLocaleString()}
                  </span>
                  ?
                  <br />
                  <span className="text-xs mt-2 block">
                    This will update the invoice balance and cannot be undone.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={14} className="mr-1" />
                  Delete Payment
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ViewPaymentsModal;
