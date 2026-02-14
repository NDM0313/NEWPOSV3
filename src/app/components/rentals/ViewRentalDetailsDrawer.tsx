import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar,
  User,
  Phone,
  Package,
  DollarSign,
  Printer,
  FileText,
  Building2,
  Edit,
  Trash2,
  MoreVertical,
  CornerDownLeft,
  CreditCard,
  History,
  Loader2,
  Truck,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { RentalUI } from '@/app/context/RentalContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService } from '@/app/services/rentalService';
import { activityLogService } from '@/app/services/activityLogService';
import { branchService } from '@/app/services/branchService';
import { RentalPrintLayout } from '@/app/components/shared/RentalPrintLayout';
import { ViewPaymentsModal } from '@/app/components/sales/ViewPaymentsModal';
import { PickupModal } from '@/app/components/rentals/PickupModal';
import { cn } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { toast } from 'sonner';

interface ViewRentalDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rental: RentalUI | null;
  onRefresh?: () => Promise<void>;
  onEdit?: (rental: RentalUI) => void;
  onAddPayment?: () => void;
  /** Called when Add Payment is clicked from within PickupModal - opens payment dialog */
  onAddPaymentForPickup?: (rental: RentalUI) => void;
  onReceiveReturn?: () => void;
  onDelete?: () => void;
  onMarkAsPickedUp?: (rentalId: string, payload: { actualPickupDate: string; notes?: string; documentType: string; documentNumber: string; documentExpiry?: string; documentReceived: boolean; remainingPaymentConfirmed: boolean; documentFrontImage?: string; documentBackImage?: string; customerPhoto?: string }) => Promise<void>;
}

export const ViewRentalDetailsDrawer: React.FC<ViewRentalDetailsDrawerProps> = ({
  isOpen,
  onClose,
  rental,
  onRefresh,
  onEdit,
  onAddPayment,
  onAddPaymentForPickup,
  onReceiveReturn,
  onDelete,
  onMarkAsPickedUp,
}) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [activeTab, setActiveTab] = useState<'details' | 'payments' | 'history'>('details');
  const [fullRental, setFullRental] = useState<RentalUI | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [viewPaymentsModalOpen, setViewPaymentsModalOpen] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  const loadPayments = useCallback(async (rentalId: string) => {
    setLoadingPayments(true);
    try {
      const fetched = await rentalService.getRentalPayments(rentalId);
      setPayments(
        (fetched || []).map((p: any) => ({
          id: p.id,
          date: p.payment_date || p.created_at?.split('T')[0] || '',
          amount: p.amount,
          method: p.method,
          referenceNo: p.reference || '',
        }))
      );
    } catch {
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  const loadActivityLogs = useCallback(async (rentalId: string) => {
    if (!companyId) return;
    setLoadingActivityLogs(true);
    try {
      const logs = await activityLogService.getEntityActivityLogs(companyId, 'rental', rentalId);
      setActivityLogs(logs || []);
    } catch {
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [companyId]);

  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        const map = new Map<string, string>();
        branchesData.forEach((b) => map.set(b.id, b.name));
        setBranchMap(map);
      } catch (e) {
        toast.error('Could not load branch names');
      }
    };
    loadBranches();
  }, [companyId]);

  useEffect(() => {
    if (isOpen && rental?.id) {
      setFullRental(rental);
      setLoading(true);
      rentalService
        .getRental(rental.id)
        .then((data: any) => {
          if (data) {
            const items = (data.items || []).map((i: any) => ({
              id: i.id,
              productId: i.product_id,
              productName: i.product_name || i.product?.name || '',
              sku: i.sku || i.product?.sku || '',
              quantity: Number(i.quantity ?? 0),
              unit: i.unit || 'piece',
              rate: Number(i.rate ?? i.rate_per_day ?? 0),
              total: Number(i.total ?? 0),
            }));
            setFullRental({
              ...rental,
              ...data,
              items,
              startDate: data.start_date || data.pickup_date || data.booking_date || rental.startDate,
              expectedReturnDate: data.expected_return_date || data.return_date || rental.expectedReturnDate,
              actualReturnDate: data.actual_return_date ?? rental.actualReturnDate,
              totalAmount: Number(data.total_amount ?? data.rental_charges ?? rental.totalAmount),
              paidAmount: Number(data.paid_amount ?? rental.paidAmount),
              dueAmount: Number(data.due_amount ?? rental.dueAmount),
              location: data.branch?.name || data.branch?.code || rental.location || data.branch_id,
            } as RentalUI);
          }
          loadPayments(rental.id);
          loadActivityLogs(rental.id);
        })
        .catch(() => setFullRental(rental))
        .finally(() => setLoading(false));
    } else {
      setFullRental(null);
    }
  }, [isOpen, rental?.id, loadPayments, loadActivityLogs]);

  const r = fullRental || rental;
  if (!isOpen) return null;

  const getStatusBadge = () => {
    const cls =
      r?.status === 'booked'
        ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
        : r?.status === 'draft'
          ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
          : r?.status === 'rented'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : r?.status === 'returned'
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : r?.status === 'overdue'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : 'bg-gray-600/20 text-gray-500 border-gray-600/30';
    const label =
      r?.status === 'booked'
        ? 'Booked'
        : r?.status === 'draft'
          ? 'Draft'
          : r?.status === 'rented'
            ? 'Rented'
            : r?.status === 'returned'
              ? 'Returned'
              : r?.status === 'overdue'
                ? 'Overdue'
                : r?.status === 'cancelled'
                  ? 'Cancelled'
                  : r?.status || '';
    return <Badge className={cn('text-xs font-semibold border', cls)}>{label}</Badge>;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full md:w-[900px] bg-gray-950 shadow-2xl z-50 overflow-hidden flex flex-col border-l border-gray-800">
        {/* Header */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              {r?.rentalNo || '—'}
              {r && getStatusBadge()}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">Rental Booking Details</p>
            {/* Status workflow bar: Booked → Picked Up → Returned */}
            {r && !['draft', 'cancelled'].includes(r.status) && (
              <div className="flex items-center gap-1 mt-4">
                <div className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  r.status === 'booked' ? 'bg-pink-500/30 text-pink-400 border border-pink-500/50' : 'bg-green-500/20 text-green-400/80 border border-green-500/30'
                )}>
                  Booked
                </div>
                <div className={cn('w-6 h-0.5', r.status === 'booked' ? 'bg-gray-600' : 'bg-green-500/30')} />
                <div className="relative">
                  <div className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    ['rented', 'overdue'].includes(r.status) ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50' : ['returned'].includes(r.status) ? 'bg-green-500/20 text-green-400/80 border border-green-500/30' : 'bg-gray-800/50 text-gray-400 border border-gray-700'
                  )}>
                    Picked Up
                  </div>
                  {r.status === 'overdue' && (
                    <Badge className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0 bg-red-500 text-white border-0">Overdue</Badge>
                  )}
                </div>
                <div className={cn('w-6 h-0.5', ['returned'].includes(r.status) ? 'bg-green-500/30' : 'bg-gray-600')} />
                <div className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  r.status === 'returned' ? 'bg-green-500/30 text-green-400 border border-green-500/50' : 'bg-gray-800/50 text-gray-400 border border-gray-700'
                )}>
                  Returned
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {r?.status === 'booked' && onMarkAsPickedUp && (
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => setPickupModalOpen(true)}
              >
                <Truck size={14} className="mr-2" />
                Pick Up
              </Button>
            )}
            {(r?.status === 'rented' || r?.status === 'overdue') && onReceiveReturn && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  className={cn(
                    "border-green-500/50 hover:bg-green-500/20 hover:border-green-500",
                    r.status === 'overdue' ? "text-red-400 border-red-500/50 hover:bg-red-500/20" : "text-green-400"
                  )}
                  variant="outline"
                  onClick={onReceiveReturn}
                >
                  <CornerDownLeft size={14} className="mr-1" />
                  Return
                </Button>
                {r?.status === 'overdue' && (
                  <Badge className="text-[10px] bg-red-500/30 text-red-400 border-red-500/50">Overdue</Badge>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={() => setShowPrintLayout(true)}
            >
              <Printer size={16} className="mr-2" />
              Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-800">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white">
                {(r?.status === 'draft' || r?.status === 'booked') && (
                  <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => r && onEdit?.(r)}>
                    <Edit size={14} className="mr-2" />
                    Edit Booking
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => setViewPaymentsModalOpen(true)}>
                  <CreditCard size={14} className="mr-2" />
                  View Payments
                </DropdownMenuItem>
                {(r?.status === 'draft' || r?.status === 'booked') && (
                  <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer text-red-400" onClick={onDelete}>
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900/50 border-b border-gray-800 px-6 shrink-0">
          <div className="flex gap-1">
            {[
              { id: 'details', label: 'Details' },
              { id: 'payments', label: 'Payments' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-4 py-3 text-sm font-medium transition-colors relative',
                  activeTab === tab.id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={40} className="text-pink-500 animate-spin" />
            </div>
          ) : !r ? (
            <p className="text-gray-400">No rental selected</p>
          ) : (
            <>
              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <User size={16} />
                        Customer Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Customer Name</p>
                          <p className="text-white font-medium">{r.customerName}</p>
                        </div>
                        {r.customerContact && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Contact</p>
                            <p className="text-white flex items-center gap-2">
                              <Phone size={14} className="text-gray-500" />
                              {r.customerContact}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <FileText size={16} />
                        Booking Details
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Pickup Date</p>
                          <p className="text-white flex items-center gap-2">
                            <Calendar size={14} className="text-gray-500" />
                            {r.startDate ? new Date(r.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Expected Return</p>
                          <p className="text-white">
                            {r.expectedReturnDate ? new Date(r.expectedReturnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        {r.actualReturnDate && (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Actual Return</p>
                            <p className="text-white">{new Date(r.actualReturnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Branch</p>
                          <p className="text-white flex items-center gap-2">
                            <Building2 size={14} className="text-gray-500" />
                            {branchMap.get(r.branchId) || r.location || r.branchId || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-gray-950/50 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                        <Package size={16} />
                        Items ({(r.items || []).length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-800 hover:bg-transparent">
                            <TableHead className="text-gray-400">Product</TableHead>
                            <TableHead className="text-gray-400">SKU</TableHead>
                            <TableHead className="text-gray-400 text-right">Rate</TableHead>
                            <TableHead className="text-gray-400 text-center">Qty</TableHead>
                            <TableHead className="text-gray-400 text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(r.items || []).map((item) => (
                            <TableRow key={item.id} className="border-gray-800">
                              <TableCell className="text-white font-medium">{item.productName || '—'}</TableCell>
                              <TableCell className="text-gray-400">{item.sku || '—'}</TableCell>
                              <TableCell className="text-right text-white">{formatCurrency(Number(item.rate || 0))}</TableCell>
                              <TableCell className="text-center text-white">{item.quantity}</TableCell>
                              <TableCell className="text-right text-white font-medium">{formatCurrency(Number(item.total || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <DollarSign size={16} />
                      Payment Summary
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Total</span>
                        <span className="text-white font-bold">{formatCurrency(r.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Paid</span>
                        <span className="text-green-400 font-medium">{formatCurrency(r.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Due</span>
                        <span className={cn('font-bold', r.dueAmount > 0 ? 'text-red-400' : 'text-gray-500')}>
                          {formatCurrency(r.dueAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {r.notes && (
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Notes</h3>
                      <p className="text-white text-sm">{r.notes}</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Payment History</h3>
                    {(r.status === 'rented' || r.status === 'overdue') && r.dueAmount > 0 && (
                      <Button onClick={onAddPayment} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <CreditCard size={16} className="mr-2" />
                        Add Payment
                      </Button>
                    )}
                  </div>
                  {loadingPayments ? (
                    <div className="text-center py-12 text-gray-400">Loading payments...</div>
                  ) : payments.length > 0 ? (
                    <div className="space-y-3">
                      {payments.map((p) => (
                        <div key={p.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex justify-between items-center">
                          <div>
                            <p className="text-white font-semibold">{formatCurrency(Number(p.amount || 0))}</p>
                            <p className="text-sm text-gray-400">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</p>
                          </div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 capitalize">{p.method || 'Cash'}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-xl">
                      No payments recorded yet.
                      <br />
                      <Button variant="link" className="text-blue-400 mt-2" onClick={() => setViewPaymentsModalOpen(true)}>
                        View full payment modal
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Activity History</h3>
                  {loadingActivityLogs ? (
                    <div className="text-center py-12 text-gray-400">Loading...</div>
                  ) : activityLogs.length > 0 ? (
                    <div className="space-y-2">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
                          <History size={16} className="text-gray-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-white text-sm">{log.description || activityLogService.formatActivityLog(log)}</p>
                            <p className="text-xs text-gray-500 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500 border border-dashed border-gray-700 rounded-xl">No activity logs yet.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {r && showPrintLayout && (
        <div className="fixed inset-0 z-[60] bg-gray-900 flex items-center justify-center p-4 overflow-auto">
          <RentalPrintLayout rental={r} onClose={() => setShowPrintLayout(false)} />
        </div>
      )}

      {r && (
        <ViewPaymentsModal
          isOpen={viewPaymentsModalOpen}
          onClose={() => setViewPaymentsModalOpen(false)}
          invoice={{
            id: r.id,
            invoiceNo: r.rentalNo,
            date: r.startDate,
            customerName: r.customerName,
            customerId: r.customerId || '',
            total: r.totalAmount,
            paid: r.paidAmount,
            due: r.dueAmount,
            paymentStatus: r.dueAmount <= 0 ? 'paid' : r.paidAmount > 0 ? 'partial' : 'unpaid',
            payments: [],
            referenceType: 'rental',
          }}
          onAddPayment={() => {
            setViewPaymentsModalOpen(false);
            onAddPayment?.();
          }}
          onDeletePayment={async (paymentId) => {
            if (r) {
              await rentalService.deletePayment(paymentId, r.id, companyId!);
              await loadPayments(r.id);
              await onRefresh?.();
            }
          }}
          onRefresh={async () => {
            await loadPayments(r.id);
            await onRefresh?.();
          }}
        />
      )}

      {r && onMarkAsPickedUp && (
        <PickupModal
          open={pickupModalOpen}
          onOpenChange={setPickupModalOpen}
          rental={r}
          onConfirm={async (id, payload) => {
            await onMarkAsPickedUp(id, payload);
            await onRefresh?.();
          }}
          onAddPayment={(rental) => {
            setPickupModalOpen(false);
            onAddPaymentForPickup?.(rental);
          }}
        />
      )}
    </>
  );
};
