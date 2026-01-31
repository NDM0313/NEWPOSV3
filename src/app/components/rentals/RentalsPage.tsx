/**
 * Rentals Page – Full ERP listing (Sale/Purchase standard)
 * Columns: Rental No, Customer, Product/Item, Branch, Start Date, Expected Return, Actual Return, Status, Total, Paid, Due, Actions
 * Actions: View, Edit (draft), Receive Return (rented/overdue), Add Payment, Print, Delete (draft)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus, Package, DollarSign, Calendar, MoreVertical, Eye, Edit, Trash2, FileText,
  CornerDownLeft, Receipt, MapPin, Loader2, ShoppingBag,
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
import { toast } from 'sonner';

const STATUS_LABELS: Record<RentalStatus, string> = {
  draft: 'Draft',
  rented: 'Rented',
  returned: 'Returned',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

interface RentalsPageProps {
  onAddRental?: () => void;
}

const STATUS_CLASS: Record<RentalStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rented: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  returned: 'bg-green-500/20 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-600/20 text-gray-500 border-gray-600/30',
};

export const RentalsPage = ({ onAddRental }: RentalsPageProps = {}) => {
  const { companyId, branchId } = useSupabase();
  const { startDate, endDate } = useDateRange();
  const { rentals, loading, refreshRentals, finalizeRental, receiveReturn, cancelRental, addPayment, deletePayment, deleteRental } = useRentals();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RentalStatus>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRental, setSelectedRental] = useState<RentalUI | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnDate, setReturnDate] = useState('');

  const [visibleColumns, setVisibleColumns] = useState({
    rentalNo: true,
    customer: true,
    product: true,
    branch: true,
    startDate: true,
    expectedReturn: true,
    actualReturn: true,
    status: true,
    total: true,
    paid: true,
    due: true,
  });

  const [columnOrder, setColumnOrder] = useState([
    'rentalNo', 'customer', 'product', 'branch', 'startDate', 'expectedReturn', 'actualReturn', 'status', 'total', 'paid', 'due',
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

  const summary = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRentals = rentals.filter((r) => r.startDate.startsWith(thisMonth));
    const totalAmount = monthRentals.reduce((s, r) => s + r.totalAmount, 0);
    const totalDue = rentals.filter((r) => r.status === 'rented' || r.status === 'overdue').reduce((s, r) => s + r.dueAmount, 0);
    const active = rentals.filter((r) => r.status === 'rented' || r.status === 'overdue').length;
    const returned = rentals.filter((r) => r.status === 'returned').length;
    return { totalAmount, totalDue, active, returned };
  }, [rentals]);

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
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnDialogOpen(true);
  };

  const confirmReturn = async () => {
    if (!selectedRental) return;
    try {
      await receiveReturn(selectedRental.id, returnDate);
      setReturnDialogOpen(false);
      setSelectedRental(null);
    } catch (e: any) {
      toast.error(e?.message || 'Return failed');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
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

      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Rental (Month)</p>
            <p className="text-2xl font-bold text-white mt-1">${summary.totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Amount Due</p>
            <p className="text-2xl font-bold text-red-400 mt-1">${summary.totalDue.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Active Rentals</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{summary.active}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Returned</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{summary.returned}</p>
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
                      key === 'total' || key === 'paid' || key === 'due' ? 'text-right' : key === 'status' ? 'text-center' : 'text-left';
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
                          case 'total':
                            cell = <span className="text-sm font-semibold text-white tabular-nums">${r.totalAmount.toLocaleString()}</span>;
                            break;
                          case 'paid':
                            cell = <span className="text-sm text-gray-300 tabular-nums">${r.paidAmount.toLocaleString()}</span>;
                            break;
                          case 'due':
                            cell = (
                              <span
                                className={cn(
                                  'text-sm tabular-nums',
                                  r.dueAmount > 0 ? 'text-red-400 font-semibold' : 'text-gray-600'
                                )}
                              >
                                ${r.dueAmount.toLocaleString()}
                              </span>
                            );
                            break;
                          default:
                            break;
                        }
                        return <div key={key}>{cell}</div>;
                      })}

                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-gray-800/80"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className={cn(
                                'w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white',
                                hoveredRow === r.id ? 'opacity-100' : 'opacity-0'
                              )}
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
                            {r.status === 'draft' && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => toast.info('Edit rental – wire to RentalForm')}
                              >
                                <Edit size={14} className="mr-2 text-green-400" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {(r.status === 'rented' || r.status === 'overdue') && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => handleReturn(r)}
                              >
                                <CornerDownLeft size={14} className="mr-2 text-orange-400" />
                                Receive Return
                              </DropdownMenuItem>
                            )}
                            {(r.status === 'rented' || r.status === 'overdue') && (
                              <DropdownMenuItem
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => {
                                  setSelectedRental(r);
                                  setViewPaymentsOpen(false);
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
                              onClick={() => toast.info('Print rental – wire to Print view')}
                            >
                              <FileText size={14} className="mr-2 text-purple-400" />
                              Print
                            </DropdownMenuItem>
                            {r.status === 'draft' && (
                              <>
                                <DropdownMenuSeparator className="bg-gray-700" />
                                <DropdownMenuItem
                                  className="hover:bg-gray-800 cursor-pointer text-red-400"
                                  onClick={() => handleDelete(r)}
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
            if (!viewPaymentsOpen) setSelectedRental(null);
          }}
          context="customer"
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
          }}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Rental</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete rental <strong>{selectedRental?.rentalNo}</strong>? Only draft rentals can be deleted.
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

      <AlertDialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Receive Return</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm return for <strong>{selectedRental?.rentalNo}</strong>. Actual return date:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="date"
            className="w-full mt-2 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReturn} className="bg-green-600 hover:bg-green-500">
              Confirm Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
