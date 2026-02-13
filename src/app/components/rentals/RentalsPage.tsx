/**
 * Rentals Page – Full ERP listing (Sale/Purchase standard)
 * Columns: Rental No, Customer, Product/Item, Branch, Start Date, Expected Return, Actual Return, Status, Total, Paid, Due, Actions
 * Actions: View, Edit (draft), Receive Return (rented/overdue), Add Payment, Print, Delete (draft)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus, Package, DollarSign, Calendar, MoreVertical, Eye, Edit, Trash2, FileText,
  CornerDownLeft, Receipt, MapPin, Loader2, ShoppingBag, Truck, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
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
import { useRentals, RentalUI, RentalStatus } from '@/app/context/RentalContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { Pagination } from '@/app/components/ui/pagination';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { formatLongDate } from '@/app/components/ui/utils';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { ViewPaymentsModal } from '@/app/components/sales/ViewPaymentsModal';
import { ViewRentalDetailsDrawer } from '@/app/components/rentals/ViewRentalDetailsDrawer';
import { PickupModal } from '@/app/components/rentals/PickupModal';
import { ReturnModal } from '@/app/components/rentals/ReturnModal';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

const STATUS_LABELS: Record<RentalStatus, string> = {
  draft: 'Draft',
  booked: 'Booked',
  rented: 'Rented',
  returned: 'Returned',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

interface RentalsPageProps {
  onAddRental?: () => void;
  onEditRental?: (rental: RentalUI) => void;
  /** When true, hide the page header (used when embedded in RentalDashboard with tabs) */
  embedded?: boolean;
}

const STATUS_CLASS: Record<RentalStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  booked: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  rented: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  returned: 'bg-green-500/20 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-600/20 text-gray-500 border-gray-600/30',
};

export const RentalsPage = ({ onAddRental, onEditRental, embedded }: RentalsPageProps = {}) => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { startDate, endDate } = useDateRange();
  const { rentals, loading, refreshRentals, receiveReturn, cancelRental, addPayment, deletePayment, deleteRental, markAsPickedUp, getRentalById } = useRentals();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RentalStatus>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRental, setSelectedRental] = useState<RentalUI | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentOpenedFromPickup, setPaymentOpenedFromPickup] = useState(false);
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState({
    rentalNo: true,
    customer: true,
    product: true,
    branch: true,
    startDate: true,
    expectedReturn: true,
    actualReturn: true,
    status: true,
    action: true,
    total: true,
    paid: true,
    due: true,
  });

  const [columnOrder, setColumnOrder] = useState([
    'rentalNo', 'customer', 'product', 'branch', 'startDate', 'expectedReturn', 'actualReturn', 'status', 'action', 'total', 'paid', 'due',
  ]);

  const columnLabels: Record<string, string> = {
    rentalNo: 'Rental No',
    customer: 'Customer',
    product: 'Product / Item',
    branch: 'Branch',
    startDate: 'Start Date',
    expectedReturn: 'Expected Return',
    actualReturn: 'Actual Return',
    status: 'Status',
    action: 'Action',
    total: 'Total',
    paid: 'Paid',
    due: 'Due',
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const moveColumnUp = (key: string) => {
    const i = columnOrder.indexOf(key);
    if (i > 0) {
      const next = [...columnOrder];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      setColumnOrder(next);
    }
  };

  const moveColumnDown = (key: string) => {
    const i = columnOrder.indexOf(key);
    if (i < columnOrder.length - 1 && i >= 0) {
      const next = [...columnOrder];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      setColumnOrder(next);
    }
  };

  const getColumnWidth = (key: string): string => {
    const w: Record<string, string> = {
      rentalNo: '110px', customer: '160px', product: '140px', branch: '120px',
      startDate: '100px', expectedReturn: '110px', actualReturn: '100px', status: '100px',
      action: '120px',
      total: '100px', paid: '90px', due: '90px',
    };
    return w[key] || '100px';
  };

  const gridTemplateColumns = useMemo(() => {
    const parts = columnOrder
      .filter((k) => visibleColumns[k as keyof typeof visibleColumns])
      .map(getColumnWidth);
    return `${parts.join(' ')} 60px`.trim();
  }, [columnOrder, visibleColumns]);

  const filterByDate = useCallback(
    (dateStr: string | undefined) => {
      if (!startDate && !endDate) return true;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
      return true;
    },
    [startDate, endDate]
  );

  const filteredRentals = useMemo(() => {
    return rentals.filter((r) => {
      if (!filterByDate(r.startDate)) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !r.rentalNo.toLowerCase().includes(q) &&
          !r.customerName.toLowerCase().includes(q) &&
          !r.location.toLowerCase().includes(q) &&
          !(r.items?.[0]?.productName || '').toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (branchFilter !== 'all' && r.branchId !== branchFilter) return false;
      return true;
    });
  }, [rentals, searchTerm, statusFilter, branchFilter, filterByDate]);

  const paginatedRentals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRentals.slice(start, start + pageSize);
  }, [filteredRentals, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRentals.length / pageSize));

  const today = new Date().toISOString().slice(0, 10);

  const summary = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRentals = rentals.filter((r) => r.startDate.startsWith(thisMonth));
    const totalAmount = monthRentals.reduce((s, r) => s + r.totalAmount, 0);
    const totalDue = rentals.filter((r) => r.status === 'rented' || r.status === 'overdue').reduce((s, r) => s + r.dueAmount, 0);
    const returned = rentals.filter((r) => r.status === 'returned').length;
    const todayPickups = rentals.filter((r) => r.startDate === today && r.status === 'booked').length;
    const todayReturns = rentals.filter((r) => r.expectedReturnDate === today && ['booked', 'rented', 'overdue'].includes(r.status)).length;
    const active = rentals.filter((r) => r.status === 'rented').length;
    const overdue = rentals.filter((r) => r.status === 'overdue' || (r.status === 'rented' && r.expectedReturnDate < today)).length;
    const rentableProducts = new Set(rentals.flatMap((r) => r.items?.map((i) => i.productId) ?? [])).size;
    const utilization = rentableProducts > 0 ? Math.round((active / rentableProducts) * 100) : 0;
    return { totalAmount, totalDue, active, returned, todayPickups, todayReturns, overdue, utilization };
  }, [rentals, today]);

  const handleDelete = (r: RentalUI) => {
    setSelectedRental(r);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedRental) return;
    try {
      await deleteRental(selectedRental.id);
      setDeleteDialogOpen(false);
      setSelectedRental(null);
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const handleReturn = (r: RentalUI) => {
    setSelectedRental(r);
    setReturnDialogOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0F19]">
      {!embedded && (
        <div className="shrink-0 px-6 py-4 border-b border-gray-800">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Rentals</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage rental orders and returns</p>
            </div>
            <Button
              className="bg-pink-600 hover:bg-pink-500 text-white h-10 gap-2"
              onClick={() => (onAddRental ? onAddRental() : toast.info('Add Rental – open from Rental list view'))}
            >
              <Plus size={16} />
              Add Rental
            </Button>
          </div>
        </div>
      )}

      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Rental (Month)</p>
            <p className="text-2xl font-bold text-white mt-1">${summary.totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Amount Due</p>
            <p className="text-2xl font-bold text-red-400 mt-1">${summary.totalDue.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Today Pickups</p>
            <p className="text-2xl font-bold text-pink-400 mt-1">{summary.todayPickups}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Today Returns</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{summary.todayReturns}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Active Rentals</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{summary.active}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Overdue</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{summary.overdue}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Utilization %</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{summary.utilization}%</p>
          </div>
        </div>
      </div>

      <ListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Search by rental no, customer, branch…',
        }}
        rowsSelector={{
          value: pageSize,
          onChange: (v) => {
            setPageSize(v);
            setCurrentPage(1);
          },
          totalItems: filteredRentals.length,
        }}
        columnsManager={{
          columns: columnOrder.map((k) => ({ key: k, label: columnLabels[k] })),
          visibleColumns: visibleColumns as Record<string, boolean>,
          onToggle: toggleColumn,
          onShowAll: () => {
            setVisibleColumns(
              Object.fromEntries(Object.keys(visibleColumns).map((k) => [k, true])) as typeof visibleColumns
            );
          },
          onMoveUp: moveColumnUp,
          onMoveDown: moveColumnDown,
        }}
        filter={{
          isOpen: filterOpen,
          onToggle: () => setFilterOpen(!filterOpen),
          activeCount: [statusFilter, branchFilter].filter((f) => f !== 'all').length,
          renderPanel: () => (
            <div className="absolute right-0 top-12 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 z-50">
              <p className="text-sm font-semibold text-white mb-2">Filters</p>
              <label className="text-xs text-gray-400">Status</label>
              <select
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                {(Object.keys(STATUS_LABELS) as RentalStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <label className="text-xs text-gray-400 mt-2 block">Branch</label>
              <select
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="all">All</option>
                {Array.from(new Set(rentals.map((r) => r.branchId))).map((bid) => (
                  <option key={bid} value={bid}>
                    {rentals.find((r) => r.branchId === bid)?.location || bid}
                  </option>
                ))}
              </select>
            </div>
          ),
        }}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              <div className="sticky top-0 z-10 min-w-[1200px] w-max bg-gray-900 border-b border-gray-800">
                <div
                  className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{ gridTemplateColumns: gridTemplateColumns }}
                >
                      {columnOrder.map((key) => {
                        if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                        const align =
                          key === 'total' || key === 'paid' || key === 'due' ? 'text-right' : key === 'status' || key === 'action' ? 'text-center' : 'text-left';
                    return (
                      <div key={key} className={align}>
                        {columnLabels[key]}
                      </div>
                    );
                  })}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              <div className="min-w-[1200px] w-max">
                {loading ? (
                  <div className="py-12 text-center">
                    <Loader2 size={48} className="mx-auto text-pink-500 mb-3 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading rentals…</p>
                  </div>
                ) : paginatedRentals.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingBag size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No rentals found</p>
                  </div>
                ) : (
                  paginatedRentals.map((r) => (
                    <div
                      key={r.id}
                      onMouseEnter={() => setHoveredRow(r.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="grid gap-3 px-4 h-14 min-w-[1200px] w-max hover:bg-gray-800/30 items-center border-b border-gray-800 last:border-b-0"
                      style={{ gridTemplateColumns: gridTemplateColumns }}
                    >
                      {columnOrder.map((key) => {
                        if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                        let cell: React.ReactNode = null;
                        switch (key) {
                          case 'rentalNo':
                            cell = <span className="text-sm font-mono text-pink-400">{r.rentalNo}</span>;
                            break;
                          case 'customer':
                            cell = <span className="text-sm text-white truncate">{r.customerName}</span>;
                            break;
                          case 'product':
                            cell = (
                              <span className="text-sm text-gray-300 truncate">
                                {r.items?.[0]?.productName || '—'}
                              </span>
                            );
                            break;
                          case 'branch':
                            cell = <span className="text-xs text-gray-400 truncate">{r.location || '—'}</span>;
                            break;
                          case 'startDate':
                            cell = <span className="text-sm text-gray-400">{formatLongDate(r.startDate)}</span>;
                            break;
                          case 'expectedReturn':
                            cell = <span className="text-sm text-gray-400">{formatLongDate(r.expectedReturnDate)}</span>;
                            break;
                          case 'actualReturn':
                            cell = (
                              <span className="text-sm text-gray-400">
                                {r.actualReturnDate ? formatLongDate(r.actualReturnDate) : '—'}
                              </span>
                            );
                            break;
                          case 'status':
                            cell = (
                              <Badge className={cn('text-xs font-medium', STATUS_CLASS[r.status])}>
                                {STATUS_LABELS[r.status]}
                              </Badge>
                            );
                            break;
                          case 'action':
                            cell = (
                              <div className="flex items-center gap-1">
                                {r.status === 'booked' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-amber-400 border-amber-500/50 hover:bg-amber-500/20 hover:border-amber-500"
                                    onClick={() => { setSelectedRental(r); setPickupModalOpen(true); }}
                                  >
                                    <Truck size={14} className="mr-1" />
                                    Pick Up
                                  </Button>
                                )}
                                {(r.status === 'rented' || r.status === 'overdue') && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={cn(
                                        "h-8 border-green-500/50 hover:bg-green-500/20 hover:border-green-500",
                                        r.status === 'overdue' ? "text-red-400" : "text-green-400"
                                      )}
                                      onClick={() => handleReturn(r)}
                                    >
                                      <CornerDownLeft size={14} className="mr-1" />
                                      Return
                                    </Button>
                                    {r.status === 'overdue' && (
                                      <Badge className="text-[10px] bg-red-500/30 text-red-400 border-red-500/50">Overdue</Badge>
                                    )}
                                  </div>
                                )}
                                {['draft', 'returned', 'cancelled'].includes(r.status) && (
                                  <span className="text-xs text-gray-500">—</span>
                                )}
                              </div>
                            );
                            break;
                          case 'total':
                            cell = <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(r.totalAmount)}</span>;
                            break;
                          case 'paid': {
                            const canAddPayment = r.status === 'rented' || r.status === 'overdue';
                            const openPayment = () => { if (canAddPayment) { setSelectedRental(r); setPaymentDialogOpen(true); } };
                            cell = (
                              <div
                                role={canAddPayment ? 'button' : undefined}
                                tabIndex={canAddPayment ? 0 : undefined}
                                onClick={openPayment}
                                onKeyDown={(e) => canAddPayment && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openPayment())}
                                className={cn(
                                  'text-sm text-gray-300 tabular-nums w-full text-right',
                                  canAddPayment && 'cursor-pointer hover:text-white hover:underline'
                                )}
                              >
                                {formatCurrency(r.paidAmount)}
                              </div>
                            );
                            break;
                          }
                          case 'due': {
                            const canAddPayment = r.status === 'rented' || r.status === 'overdue';
                            const openPayment = () => { if (canAddPayment) { setSelectedRental(r); setPaymentDialogOpen(true); } };
                            const openPaymentHistory = () => { setSelectedRental(r); setViewPaymentsOpen(true); };
                            const paymentStatus = r.dueAmount <= 0 ? 'paid' : r.paidAmount > 0 ? 'partial' : 'due';
                            cell = (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={openPaymentHistory}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openPaymentHistory())}
                                className="w-full text-right cursor-pointer hover:opacity-90"
                              >
                                {paymentStatus === 'paid' ? (
                                  <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30 gap-1 inline-flex">
                                    <CheckCircle2 size={10} />
                                    Paid
                                  </Badge>
                                ) : paymentStatus === 'partial' ? (
                                  <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 inline-flex">
                                    Partial
                                  </Badge>
                                ) : (
                                  <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30 gap-1 inline-flex">
                                    Due
                                  </Badge>
                                )}
                                {r.dueAmount > 0 && (
                                  <span className="ml-1 text-xs text-gray-400">{formatCurrency(r.dueAmount)}</span>
                                )}
                              </div>
                            );
                            break;
                          }
                          default:
                            break;
                        }
                        return <div key={key}>{cell}</div>;
                      })}

                      <div className="flex items-center justify-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white"
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            <DropdownMenuItem
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => {
                                setSelectedRental(r);
                                setViewDetailsOpen(true);
                              }}
                            >
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View
                            </DropdownMenuItem>
                            {(r.status === 'draft' || r.status === 'booked') && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => onEditRental?.(r)}
                              >
                                <Edit size={14} className="mr-2 text-green-400" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {(r.status === 'rented' || r.status === 'overdue') && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                  setSelectedRental(r);
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                <DollarSign size={14} className="mr-2 text-green-400" />
                                Add Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => {
                                setSelectedRental(r);
                                setViewPaymentsOpen(true);
                              }}
                            >
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Payments
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => {
                                setSelectedRental(r);
                                setViewDetailsOpen(true);
                              }}
                            >
                              <FileText size={14} className="mr-2 text-purple-400" />
                              Print
                            </DropdownMenuItem>
                            {(r.status === 'draft' || r.status === 'booked') && (
                              <>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem
                                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                                  onClick={() => {
                                    setSelectedRental(r);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredRentals.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setCurrentPage(1);
        }}
      />

      {selectedRental && (
        <ViewPaymentsModal
          isOpen={viewPaymentsOpen}
          onClose={() => {
            setViewPaymentsOpen(false);
            setSelectedRental(null);
          }}
          invoice={{
            id: selectedRental.id,
            invoiceNo: selectedRental.rentalNo,
            date: selectedRental.startDate,
            customerName: selectedRental.customerName,
            customerId: selectedRental.customerId || '',
            total: selectedRental.totalAmount,
            paid: selectedRental.paidAmount,
            due: selectedRental.dueAmount,
            paymentStatus: selectedRental.dueAmount <= 0 ? 'paid' : selectedRental.paidAmount > 0 ? 'partial' : 'unpaid',
            payments: [],
            referenceType: 'rental',
          }}
          onAddPayment={() => {
            setViewPaymentsOpen(false);
            setPaymentDialogOpen(true);
          }}
          onDeletePayment={async (paymentId: string) => {
            if (!selectedRental) throw new Error('Rental not selected');
            await deletePayment(selectedRental.id, paymentId);
            await refreshRentals();
          }}
          onRefresh={refreshRentals}
        />
      )}

      {selectedRental && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            if (paymentOpenedFromPickup) {
              setPaymentOpenedFromPickup(false);
              setPickupModalOpen(true);
            }
            if (!viewPaymentsOpen && !pickupModalOpen) setSelectedRental(null);
          }}
          context="rental"
          entityName={selectedRental.customerName}
          entityId={selectedRental.customerId || selectedRental.id}
          outstandingAmount={selectedRental.dueAmount}
          totalAmount={selectedRental.totalAmount}
          paidAmount={selectedRental.paidAmount}
          referenceNo={selectedRental.rentalNo}
          referenceId={selectedRental.id}
          onSuccess={async () => {
            await refreshRentals();
            setPaymentDialogOpen(false);
            if (selectedRental && getRentalById) {
              const updated = getRentalById(selectedRental.id);
              if (updated) setSelectedRental(updated);
            }
            if (paymentOpenedFromPickup) {
              setPaymentOpenedFromPickup(false);
              setPickupModalOpen(true);
            }
          }}
        />
      )}

      <ViewRentalDetailsDrawer
        isOpen={viewDetailsOpen}
        onClose={() => {
          setViewDetailsOpen(false);
          setSelectedRental(null);
        }}
        rental={selectedRental}
        onRefresh={refreshRentals}
        onEdit={(r) => {
          setViewDetailsOpen(false);
          setSelectedRental(null);
          onEditRental?.(r);
        }}
        onAddPayment={() => {
          setViewDetailsOpen(false);
          setPaymentDialogOpen(true);
        }}
        onAddPaymentForPickup={(r) => {
          setSelectedRental(r);
          setViewDetailsOpen(false);
          setPaymentDialogOpen(true);
        }}
        onReceiveReturn={() => {
          setViewDetailsOpen(false);
          handleReturn(selectedRental!);
        }}
        onDelete={() => {
          handleDelete(selectedRental!);
          setViewDetailsOpen(false);
        }}
        onMarkAsPickedUp={markAsPickedUp}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Rental</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete rental <strong>{selectedRental?.rentalNo}</strong>? Only draft or booked rentals can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-500">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PickupModal
        open={pickupModalOpen}
        onOpenChange={setPickupModalOpen}
        rental={selectedRental}
        onConfirm={async (id, payload) => await markAsPickedUp(id, payload)}
        onAddPayment={(r) => {
          setSelectedRental(r);
          setPaymentOpenedFromPickup(true);
          setPickupModalOpen(false);
          setPaymentDialogOpen(true);
        }}
      />

      <ReturnModal
        open={returnDialogOpen}
        onOpenChange={(open) => {
          setReturnDialogOpen(open);
          if (!open) setSelectedRental(null);
        }}
        rental={selectedRental}
        documentInfo={selectedRental ? { documentType: selectedRental.documentType, documentNumber: selectedRental.documentNumber } : undefined}
        onConfirm={async (id, payload) => await receiveReturn(id, payload)}
      />
    </div>
  );
};
