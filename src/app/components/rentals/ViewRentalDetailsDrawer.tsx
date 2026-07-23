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
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import { formatQty } from '@/app/utils/quantity';
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
import { resolveRentalPaymentDisplay } from '@/app/lib/rentalPaymentRef';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';

interface ViewRentalDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rental: RentalUI | null;
  onRefresh?: () => Promise<void>;
  onEdit?: (rental: RentalUI) => void;
  onAddPayment?: () => void;
  /** Edit rental payment (opens unified payment dialog on parent) */
  onEditPayment?: (rental: RentalUI, payment: import('@/app/components/sales/ViewPaymentsModal').Payment) => void;
  /** Called when Add Payment is clicked from within PickupModal - opens payment dialog */
  onAddPaymentForPickup?: (rental: RentalUI) => void;
  onReceiveReturn?: () => void;
  onDelete?: () => void;
  onMarkAsPickedUp?: (rentalId: string, payload: { actualPickupDate: string; notes?: string; documentType: string; documentNumber: string; documentExpiry?: string; documentReceived: boolean; remainingPaymentConfirmed: boolean; documentFrontImage?: string; documentBackImage?: string; customerPhoto?: string }) => Promise<void>;
  /** Open print layout immediately when the drawer mounts (list Print action). */
  openPrintOnMount?: boolean;
}

export const ViewRentalDetailsDrawer: React.FC<ViewRentalDetailsDrawerProps> = ({
  isOpen,
  onClose,
  rental,
  onRefresh,
  onEdit,
  onAddPayment,
  onEditPayment,
  onAddPaymentForPickup,
  onReceiveReturn,
  onDelete,
  onMarkAsPickedUp,
  openPrintOnMount = false,
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
  const [billRefDraft, setBillRefDraft] = useState('');
  const [billRefEditing, setBillRefEditing] = useState(false);
  const [savingBillRef, setSavingBillRef] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [financialBreakdownOpen, setFinancialBreakdownOpen] = useState(false);

  const loadPayments = useCallback(async (rentalId: string, bookingNo?: string) => {
    setLoadingPayments(true);
    try {
      const fetched = await rentalService.getRentalPayments(rentalId);
      setPayments(
        (fetched || []).map((p: any) => {
          const { referenceNo, subtitle } = resolveRentalPaymentDisplay({
            bookingNo: bookingNo || fullRental?.rentalNo || rental?.rentalNo,
            storedReference: p.reference,
          });
          return {
            id: p.id,
            date: p.payment_date || p.created_at?.split('T')[0] || '',
            amount: p.amount,
            method: p.method,
            referenceNo,
            referenceSubtitle: subtitle,
            paymentType: String(p.payment_type || '').toLowerCase(),
          };
        })
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
    } catch (err) {
      console.error('[VIEW RENTAL] Failed to load activity logs:', err);
      setActivityLogs([]);
    } finally {
      setLoadingActivityLogs(false);
    }
  }, [companyId]);

  const reloadRentalData = useCallback(async (rentalId: string, bookingNo?: string) => {
    await Promise.all([
      loadPayments(rentalId, bookingNo),
      loadActivityLogs(rentalId),
    ]);
  }, [loadPayments, loadActivityLogs]);

  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        const map = new Map<string, string>();
        branchesData.forEach((b) => map.set(b.id, b.name));
        setBranchMap(map);
      } catch {}
    };
    loadBranches();
  }, [companyId]);

  useEffect(() => {
    setFinancialBreakdownOpen(false);
  }, [isOpen, rental?.id]);

  useEffect(() => {
    if (isOpen && openPrintOnMount) {
      setShowPrintLayout(true);
    }
    if (!isOpen) {
      setShowPrintLayout(false);
    }
  }, [isOpen, openPrintOnMount, rental?.id]);

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
              damageCharges: Number(data.damage_charges ?? rental.damageCharges ?? 0) || 0,
              conditionType: data.condition_type ?? rental.conditionType ?? null,
              damageNotes: data.damage_notes ?? rental.damageNotes ?? null,
              penaltyPaid: data.penalty_paid === true || rental.penaltyPaid === true,
              refundAmount: Number(data.refund_amount ?? rental.refundAmount ?? 0) || 0,
              salesmanId: data.salesman_id ?? null,
              commissionAmount: Number(data.commission_amount ?? 0) || 0,
              commissionPercent: data.commission_percent != null ? Number(data.commission_percent) : null,
              commissionStatus: data.commission_status ?? null,
            } as RentalUI);
          }
          loadPayments(rental.id, rental.rentalNo);
          loadActivityLogs(rental.id);
        })
        .catch(() => setFullRental(rental))
        .finally(() => setLoading(false));
    } else {
      setFullRental(null);
    }
  }, [isOpen, rental?.id, loadPayments, loadActivityLogs]);

  useEffect(() => {
    if (isOpen && rental?.id && activeTab === 'history') {
      loadActivityLogs(rental.id);
    }
  }, [isOpen, rental?.id, activeTab, loadActivityLogs]);

  useEffect(() => {
    if (!isOpen || !rental?.id) return;
    const handlePaymentsChanged = () => {
      void reloadRentalData(rental.id, rental.rentalNo);
    };
    window.addEventListener('rentalPaymentsChanged', handlePaymentsChanged);
    return () => window.removeEventListener('rentalPaymentsChanged', handlePaymentsChanged);
  }, [isOpen, rental?.id, rental?.rentalNo, reloadRentalData]);

  const r = fullRental || rental;

  useEffect(() => {
    setBillRefDraft(r?.documentNumber || '');
    setBillRefEditing(false);
  }, [r?.id, r?.documentNumber]);

  const canEditBillRef = !!r && ['draft', 'booked'].includes(r.status);

  const handleSaveBillRef = async () => {
    if (!r?.id) return;
    setSavingBillRef(true);
    try {
      await rentalService.updateRentalMeta(r.id, { documentNumber: billRefDraft.trim() || null });
      toast.success('Bill reference updated');
      setBillRefEditing(false);
      await reloadRentalData(r.id, r.rentalNo);
      await onRefresh?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update bill reference');
    } finally {
      setSavingBillRef(false);
    }
  };

  if (!isOpen) return null;

  const damageCharges = Number(r?.damageCharges ?? 0) || 0;
  const rentalBookingTotal = Number(r?.totalAmount ?? 0);
  const combinedRentalPlusDamage = rentalBookingTotal + damageCharges;
  const refundAmt = Number(r?.refundAmount ?? 0) || 0;
  const conditionKey = String(r?.conditionType || '').toLowerCase();
  const conditionLabel =
    conditionKey === 'minor_damage'
      ? 'Minor damage'
      : conditionKey === 'major_damage'
        ? 'Major damage'
        : conditionKey === 'good'
          ? 'Good'
          : r?.conditionType
            ? String(r.conditionType).replace(/_/g, ' ')
            : '';

  const getStatusBadge = () => {
    const cls =
      r?.status === 'booked'
        ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
        : r?.status === 'draft'
          ? 'bg-gray-500/20 text-muted-foreground border-gray-500/30'
          : r?.status === 'rented'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : r?.status === 'returned'
              ? 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30'
              : r?.status === 'overdue'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : 'bg-gray-600/20 text-muted-foreground border-gray-600/30';
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
      <div className="fixed right-0 top-0 h-full w-full md:w-[900px] bg-input-background shadow-2xl z-50 overflow-hidden flex flex-col border-l border-border">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
              {r?.rentalNo || '—'}
              {r && getStatusBadge()}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Rental Booking Details</p>
            {r?.documentNumber && !billRefEditing ? (
              <p className="text-sm text-violet-300 mt-1">Bill: {r.documentNumber}</p>
            ) : null}
            {/* Status workflow bar: Booked → Picked Up → Returned — operator flow clarity */}
            {r && !['draft', 'cancelled'].includes(r.status) && (
              <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">Flow: Booked → Pick up (confirm delivery) → Return (confirm items back). Add payment from Payments tab when needed.</p>
              <div className="flex items-center gap-1">
                <div className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  r.status === 'booked' ? 'bg-pink-500/30 text-pink-400 border border-pink-500/50' : 'bg-green-500/20 text-[var(--erp-money-positive)]/80 border border-green-500/30'
                )}>
                  Booked
                </div>
                <div className={cn('w-6 h-0.5', r.status === 'booked' ? 'bg-gray-600' : 'bg-green-500/30')} />
                <div className="relative">
                  <div className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                    ['rented', 'overdue'].includes(r.status) ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50' : ['returned'].includes(r.status) ? 'bg-green-500/20 text-[var(--erp-money-positive)]/80 border border-green-500/30' : 'bg-muted/50 text-muted-foreground border border-border'
                  )}>
                    Picked Up
                  </div>
                  {r.status === 'overdue' && (
                    <Badge className="absolute -top-2 -right-2 text-[9px] px-1.5 py-0 bg-red-500 text-foreground border-0">Overdue</Badge>
                  )}
                </div>
                <div className={cn('w-6 h-0.5', ['returned'].includes(r.status) ? 'bg-green-500/30' : 'bg-gray-600')} />
                <div className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  r.status === 'returned' ? 'bg-green-500/30 text-[var(--erp-money-positive)] border border-green-500/50' : 'bg-muted/50 text-muted-foreground border border-border'
                )}>
                  Returned
                </div>
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
                    r.status === 'overdue' ? "text-red-400 border-red-500/50 hover:bg-red-500/20" : "text-[var(--erp-money-positive)]"
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
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => setShowPrintLayout(true)}
            >
              <Printer size={16} className="mr-2" />
              Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                {(r?.status === 'draft' || r?.status === 'booked') && (
                  <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={() => r && onEdit?.(r)}>
                    <Edit size={14} className="mr-2" />
                    Edit Booking
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="hover:bg-muted cursor-pointer" onClick={() => setViewPaymentsModalOpen(true)}>
                  <CreditCard size={14} className="mr-2" />
                  View Payments
                </DropdownMenuItem>
                {(r?.status === 'draft' || r?.status === 'booked') && (
                  <DropdownMenuItem className="hover:bg-muted cursor-pointer text-red-400" onClick={onDelete}>
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-muted/40 border-b border-border px-6 shrink-0">
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
                  activeTab === tab.id ? 'text-blue-400' : 'text-muted-foreground hover:text-muted-foreground'
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
            <p className="text-muted-foreground">No rental selected</p>
          ) : (
            <>
              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                        <User size={16} />
                        Customer Information
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Customer Name</p>
                          <p className="text-foreground font-medium">{r.customerName}</p>
                        </div>
                        {r.customerContact && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Contact</p>
                            <p className="text-foreground flex items-center gap-2">
                              <Phone size={14} className="text-muted-foreground" />
                              {r.customerContact}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                        <FileText size={16} />
                        Booking Details
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Pickup Date</p>
                          <p className="text-foreground flex items-center gap-2">
                            <Calendar size={14} className="text-muted-foreground" />
                            {r.startDate ? new Date(r.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Expected Return</p>
                          <p className="text-foreground">
                            {r.expectedReturnDate ? new Date(r.expectedReturnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </p>
                        </div>
                        {r.actualReturnDate && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Actual Return</p>
                            <p className="text-foreground">{new Date(r.actualReturnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Branch</p>
                          <p className="text-foreground flex items-center gap-2">
                            <Building2 size={14} className="text-muted-foreground" />
                            {branchMap.get(r.branchId) || r.location || r.branchId || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-muted/40 border-b border-border">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Package size={16} />
                        Items ({(r.items || []).length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-muted-foreground">Product</TableHead>
                            <TableHead className="text-muted-foreground">SKU</TableHead>
                            <TableHead className="text-muted-foreground text-right">Rate</TableHead>
                            <TableHead className="text-muted-foreground text-center">Qty</TableHead>
                            <TableHead className="text-muted-foreground text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(r.items || []).map((item) => (
                            <TableRow key={item.id} className="border-border">
                              <TableCell className="text-foreground font-medium">{item.productName || '—'}</TableCell>
                              <TableCell className="text-muted-foreground">{item.sku || '—'}</TableCell>
                              <TableCell className="text-right text-foreground">{formatCurrency(Number(item.rate || 0))}</TableCell>
                              <TableCell className="text-center text-foreground tabular-nums">{formatQty(item.quantity)}</TableCell>
                              <TableCell className="text-right text-foreground font-medium">{formatCurrency(Number(item.total || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {(damageCharges > 0 || (conditionKey && conditionKey !== 'good')) && (
                    <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-amber-200/90 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-400" />
                        Return — damage &amp; penalty
                      </h3>
                      <div className="space-y-2 text-sm">
                        {conditionLabel && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Item condition</span>
                            <span className="text-foreground font-medium text-right">{conditionLabel}</span>
                          </div>
                        )}
                        {damageCharges > 0 && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Penalty / damage charge</span>
                            <span className="text-amber-300 font-bold tabular-nums">{formatCurrency(damageCharges)}</span>
                          </div>
                        )}
                        {r.damageNotes && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Damage notes</p>
                            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{r.damageNotes}</p>
                          </div>
                        )}
                        {damageCharges > 0 && (
                          <div className="flex justify-between gap-4 pt-1 border-t border-amber-900/30">
                            <span className="text-muted-foreground">Penalty settlement</span>
                            <span className={r.penaltyPaid ? 'text-[var(--erp-money-positive)] text-sm' : 'text-amber-400 text-sm'}>
                              {r.penaltyPaid ? 'Received (posted)' : 'On customer account (credit)'}
                            </span>
                          </div>
                        )}
                        {refundAmt > 0 && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Security deposit refund (net)</span>
                            <span className="text-[var(--erp-money-positive)] font-medium tabular-nums">{formatCurrency(refundAmt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-2">
                      <DollarSign size={16} />
                      Payment summary
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      <strong className="text-muted-foreground">Rental charges</strong> = booking line items only. Damage/penalty is separate and shown above when the rental was returned with assessment.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rental booking total</span>
                        <span className="text-foreground font-bold tabular-nums">{formatCurrency(rentalBookingTotal)}</span>
                      </div>
                      {damageCharges > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">+ Damage / penalty</span>
                          <span className="text-amber-400 font-semibold tabular-nums">{formatCurrency(damageCharges)}</span>
                        </div>
                      )}
                      {damageCharges > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setFinancialBreakdownOpen((v) => !v)}
                            className="w-full flex items-center justify-between gap-2 pt-2 mt-1 border-t border-border text-left rounded-lg px-2 py-2 -mx-2 hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                              {financialBreakdownOpen ? (
                                <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                              )}
                              <span>
                                Rental fee + damage <span className="text-muted-foreground font-normal">(tap for breakdown)</span>
                              </span>
                            </span>
                            <span className="text-foreground font-bold tabular-nums text-sm">{formatCurrency(combinedRentalPlusDamage)}</span>
                          </button>
                          {financialBreakdownOpen && (
                            <div className="rounded-lg border border-border bg-input-background/60 p-3 text-xs text-muted-foreground space-y-2">
                              <p>
                                <span className="text-muted-foreground font-medium">Rental contract:</span>{' '}
                                {formatCurrency(rentalBookingTotal)} — agreed rent from items/rates.
                              </p>
                              <p>
                                <span className="text-amber-300 font-medium">Damage / penalty:</span>{' '}
                                {formatCurrency(damageCharges)}
                                {conditionLabel ? ` — condition recorded as “${conditionLabel}”.` : '.'}
                              </p>
                              {r.damageNotes && (
                                <p className="text-muted-foreground italic border-l-2 border-amber-700/50 pl-2">{r.damageNotes}</p>
                              )}
                              <p className="text-muted-foreground pt-1 border-t border-border">
                                Sum <span className="text-foreground font-semibold">{formatCurrency(combinedRentalPlusDamage)}</span> is for your reference;
                                rental <strong className="text-muted-foreground">Paid / Due</strong> below still follow the booking invoice only.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                      {(r as any).commissionAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Salesman Commission
                            {(r as any).commissionPercent != null && <span className="text-muted-foreground ml-1">({(r as any).commissionPercent}%)</span>}
                          </span>
                          <span className="text-amber-400 font-medium tabular-nums">{formatCurrency((r as any).commissionAmount)}</span>
                        </div>
                      )}
                      {(r as any).commissionStatus && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Commission Status</span>
                          <span className={(r as any).commissionStatus === 'posted' ? 'text-blue-400 text-xs font-medium' : 'text-amber-400 text-xs font-medium'}>
                            {(r as any).commissionStatus === 'posted' ? 'Posted' : 'Pending'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm pt-2 border-t border-border">
                        <span className="text-muted-foreground">Paid (on booking)</span>
                        <span className="text-[var(--erp-money-positive)] font-medium tabular-nums">{formatCurrency(r.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-medium">Due (on booking)</span>
                        <span className={cn('font-bold tabular-nums', r.dueAmount > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                          {formatCurrency(r.dueAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bill / manual ref #</h3>
                      {canEditBillRef && !billRefEditing && (
                        <Button variant="ghost" size="sm" className="text-blue-400 h-8" onClick={() => setBillRefEditing(true)}>
                          Edit
                        </Button>
                      )}
                    </div>
                    {billRefEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={billRefDraft}
                          onChange={(e) => setBillRefDraft(e.target.value)}
                          placeholder="Paper bill book reference"
                          className="bg-muted border-border text-foreground"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void handleSaveBillRef()} disabled={savingBillRef}>
                            {savingBillRef ? 'Saving…' : 'Save'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setBillRefEditing(false); setBillRefDraft(r.documentNumber || ''); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-foreground text-sm">{r.documentNumber || '—'}</p>
                    )}
                  </div>

                  {r.notes && (
                    <div className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</h3>
                      <p className="text-foreground text-sm">{r.notes}</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-foreground">Payment History</h3>
                    {(r.status === 'rented' || r.status === 'overdue') && r.dueAmount > 0 && (
                      <Button onClick={onAddPayment} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <CreditCard size={16} className="mr-2" />
                        Add Payment
                      </Button>
                    )}
                  </div>
                  {loadingPayments ? (
                    <div className="text-center py-12 text-muted-foreground">Loading…</div>
                  ) : payments.length > 0 ? (
                    <div className="space-y-3">
                      {payments.map((p) => (
                        <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <p className="text-foreground font-semibold tabular-nums">{formatCurrency(Number(p.amount || 0))}</p>
                            <p className="text-sm text-muted-foreground">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</p>
                            {p.referenceNo && p.referenceNo !== '—' && (
                              <p className="text-xs text-muted-foreground mt-1 truncate" title={p.referenceNo}>
                                Ref: {p.referenceNo}
                              </p>
                            )}
                            {(p as { referenceSubtitle?: string }).referenceSubtitle && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {(p as { referenceSubtitle?: string }).referenceSubtitle}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {p.paymentType === 'penalty' && (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Damage / penalty</Badge>
                            )}
                            {p.paymentType === 'advance' && (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">Advance</Badge>
                            )}
                            {p.paymentType === 'remaining' && (
                              <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-[10px]">Balance</Badge>
                            )}
                            <Badge className="bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30 capitalize">{p.method || 'Cash'}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
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
                  <h3 className="text-lg font-semibold text-foreground">Activity History</h3>
                  {loadingActivityLogs ? (
                    <div className="text-center py-12 text-muted-foreground">Loading…</div>
                  ) : activityLogs.length > 0 ? (
                    <div className="space-y-3">
                      {activityLogs.map((log) => {
                        const action = String(log.action || '');
                        const icon =
                          action.includes('payment_added') ? <DollarSign size={16} className="text-blue-400" /> :
                          action.includes('payment_deleted') ? <DollarSign size={16} className="text-red-400" /> :
                          action.includes('payment_edited') ? <Edit size={16} className="text-amber-400" /> :
                          action.includes('picked_up') ? <Truck size={16} className="text-blue-400" /> :
                          action.includes('returned') ? <CornerDownLeft size={16} className="text-[var(--erp-money-positive)]" /> :
                          action.includes('cancelled') || action.includes('deleted') ? <Trash2 size={16} className="text-red-400" /> :
                          action.includes('status_change') || action.includes('finalized') ? <CheckCircle2 size={16} className="text-[var(--erp-money-positive)]" /> :
                          action.includes('created') ? <FileText size={16} className="text-pink-400" /> :
                          action.includes('edited') ? <Edit size={16} className="text-yellow-400" /> :
                          <History size={16} className="text-muted-foreground" />;
                        const actionLabel = action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                        return (
                          <div key={log.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">{icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground capitalize">
                                  {actionLabel}
                                </Badge>
                                {log.performed_by_name ? (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User size={12} />
                                    {log.performed_by_name}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-foreground text-sm">{log.description || activityLogService.formatActivityLog(log)}</p>
                              <DateTimeDisplay date={log.created_at} className="text-xs text-muted-foreground mt-1.5" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                      <p className="font-medium">No activity yet</p>
                      <p className="text-xs mt-1">Pickup, return, and payment actions will appear here.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {r && showPrintLayout && (
        <div className="fixed inset-0 z-[60] bg-card flex items-center justify-center p-4 overflow-auto">
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
          onEditPayment={
            onEditPayment && r
              ? (payment) => {
                  onEditPayment(r, payment);
                  setViewPaymentsModalOpen(false);
                }
              : undefined
          }
          onDeletePayment={async (paymentId) => {
            if (r) {
              await rentalService.deletePayment(paymentId, r.id, companyId!);
              await reloadRentalData(r.id, r.rentalNo);
              await onRefresh?.();
            }
          }}
          onRefresh={async () => {
            await reloadRentalData(r.id, r.rentalNo);
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
            if (r) await reloadRentalData(r.id, r.rentalNo);
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
