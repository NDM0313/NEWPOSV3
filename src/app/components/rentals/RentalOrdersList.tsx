import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService } from '@/app/services/rentalService';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { 
  Search, 
  Calendar, 
  Filter, 
  MoreVertical, 
  ArrowRight, 
  CornerDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  X,
  Eye,
  Columns,
  FileDown,
  Phone,
  CreditCard,
  Shield,
  Edit,
  Ban,
  Upload,
  DollarSign,
  Plus,
  TrendingUp,
  Package,
  AlertTriangle,
  CalendarCheck,
  Truck,
  Receipt
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";
import { ReturnDressModal } from './ReturnDressModal';
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Label } from "../ui/label";
import { CalendarDateRangePicker } from "../ui/CalendarDateRangePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Checkbox } from "../ui/checkbox";
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';

type RentalStatus = 'Booked' | 'Dispatched' | 'Returned' | 'Overdue' | 'Cancelled';
type RentalType = 'Standard' | 'Premium';

interface RentalOrder {
  id: string;
  productName: string;
  productCode: string;
  productImage: string;
  rentalType: RentalType;
  customerName: string;
  customerMobile: string;
  pickupDate: string;
  pickupTime?: string;
  returnDate: string;
  rentalAmount: number;
  paidAmount: number;
  balanceDue: number;
  securityDeposit: number;
  guaranteeType: 'ID Card' | 'License' | 'Passport';
  documentAttached: boolean;
  status: RentalStatus;
}

// Rental data will be loaded from Supabase

// Column visibility options
const allColumns = [
  { id: 'product', label: 'Product', default: true },
  { id: 'customer', label: 'Customer', default: true },
  { id: 'pickupDate', label: 'Pickup Date', default: true },
  { id: 'returnDate', label: 'Return Date', default: true },
  { id: 'rentalAmount', label: 'Rental Amount', default: true },
  { id: 'paidAmount', label: 'Paid Amount', default: true },
  { id: 'balanceDue', label: 'Balance Due', default: true },
  { id: 'securityDeposit', label: 'Security Deposit', default: false },
  { id: 'status', label: 'Status', default: true },
  { id: 'action', label: 'Action', default: true },
];

export const RentalOrdersList = () => {
  const { companyId, branchId } = useSupabase();
  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RentalOrder | null>(null);

  // 🎯 Payment & Ledger States
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  
  // 🎯 Action Dialogs (TASK 4 FIX)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [lateFeeDialogOpen, setLateFeeDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<RentalStatus | 'all'>('all');
  const [filterDateRange, setFilterDateRange] = useState<{ from?: Date; to?: Date }>({});
  
  // Rows selector
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    allColumns.reduce((acc, col) => ({ ...acc, [col.id]: col.default }), {})
  );
  const [columnOpen, setColumnOpen] = useState(false);

  // Convert Supabase rental to RentalOrder format
  const convertFromSupabaseRental = useCallback((rental: any): RentalOrder => {
    // Get first item for product info
    const firstItem = rental.items?.[0];
    const product = firstItem?.product || {};
    
    // Map status
    const statusMap: Record<string, RentalStatus> = {
      'booked': 'Booked',
      'picked_up': 'Dispatched',
      'returned': 'Returned',
      'overdue': 'Overdue',
      'cancelled': 'Cancelled',
      'closed': 'Returned'
    };
    
    return {
      id: rental.id || rental.booking_no || '',
      productName: product.name || firstItem?.product_name || 'Unknown Product',
      productCode: product.sku || firstItem?.product_name || '',
      productImage: product.image_url || '/placeholder-product.jpg',
      rentalType: rental.rental_charges > 50000 ? 'Premium' : 'Standard',
      customerName: rental.customer_name || rental.customer?.name || 'Walk-in Customer',
      customerMobile: rental.customer?.phone || '',
      pickupDate: rental.pickup_date || rental.booking_date || '',
      pickupTime: rental.pickup_time,
      returnDate: rental.return_date || '',
      rentalAmount: rental.rental_charges || 0,
      paidAmount: rental.paid_amount || 0,
      balanceDue: (rental.total_amount || 0) - (rental.paid_amount || 0),
      securityDeposit: rental.security_deposit || 0,
      guaranteeType: 'ID Card', // Default, can be enhanced
      documentAttached: false, // Can be enhanced
      status: statusMap[rental.status] || 'Booked'
    };
  }, []);

  // Load rentals from Supabase
  const loadRentals = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const rentalsData = await rentalService.getAllRentals(companyId, branchId || undefined);
      const convertedOrders = rentalsData.map(convertFromSupabaseRental);
      setOrders(convertedOrders);
    } catch (error: any) {
      console.error('[RENTAL ORDERS LIST] Error loading rentals:', error);
      toast.error('Failed to load rentals: ' + (error.message || 'Unknown error'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseRental]);

  // Load rentals on mount
  useEffect(() => {
    loadRentals();
  }, [loadRentals]);

  // Action Handlers (TASK 4 FIX - Complete implementation)
  const handleDispatch = async () => {
    if (!selectedOrder) return;
    
    try {
      await rentalService.updateRental(selectedOrder.id, { status: 'picked_up' });
      toast.success(`Order ${selectedOrder.id} dispatched successfully`);
      setDispatchDialogOpen(false);
      setSelectedOrder(null);
      await loadRentals();
    } catch (error: any) {
      console.error('[RENTAL] Error dispatching:', error);
      toast.error('Failed to dispatch order: ' + (error.message || 'Unknown error'));
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    
    try {
      await rentalService.updateRental(selectedOrder.id, { status: 'cancelled' });
      toast.success(`Order ${selectedOrder.id} cancelled successfully`);
      setCancelDialogOpen(false);
      setSelectedOrder(null);
      await loadRentals();
    } catch (error: any) {
      console.error('[RENTAL] Error cancelling:', error);
      toast.error('Failed to cancel order: ' + (error.message || 'Unknown error'));
    }
  };

  const handleExtend = async (newReturnDate: string) => {
    if (!selectedOrder) return;
    
    try {
      const pickupDate = new Date(selectedOrder.pickupDate);
      const returnDate = new Date(newReturnDate);
      const durationDays = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      
      await rentalService.updateRental(selectedOrder.id, { 
        return_date: newReturnDate,
        duration_days: durationDays
      });
      toast.success(`Return date extended to ${newReturnDate}`);
      setExtendDialogOpen(false);
      setSelectedOrder(null);
      await loadRentals();
    } catch (error: any) {
      console.error('[RENTAL] Error extending date:', error);
      toast.error('Failed to extend return date: ' + (error.message || 'Unknown error'));
    }
  };

  const handleLateFee = async (feeAmount: number) => {
    if (!selectedOrder) return;
    
    try {
      const currentTotal = selectedOrder.rentalAmount;
      await rentalService.updateRental(selectedOrder.id, { 
        late_fee: feeAmount,
        total_amount: currentTotal + feeAmount
      });
      toast.success(`Late fee of Rs. ${feeAmount} applied`);
      setLateFeeDialogOpen(false);
      setSelectedOrder(null);
      await loadRentals();
    } catch (error: any) {
      console.error('[RENTAL] Error applying late fee:', error);
      toast.error('Failed to apply late fee: ' + (error.message || 'Unknown error'));
    }
  };

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const activeRentals = orders.filter(o => o.status === 'Dispatched').length;
    const overdueReturns = orders.filter(o => o.status === 'Overdue').length;
    const totalOutstanding = orders.reduce((sum, o) => sum + o.balanceDue, 0);
    const todayDate = new Date().toISOString().split('T')[0];
    const todayDispatches = orders.filter(o => o.pickupDate === todayDate).length;
    const todayReturns = orders.filter(o => o.returnDate === todayDate).length;

    return {
      activeRentals,
      overdueReturns,
      totalOutstanding,
      todayDispatches,
      todayReturns
    };
  }, [orders]);

  // Get return date status
  const getReturnDateStatus = (returnDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const returnDateObj = new Date(returnDate);
    returnDateObj.setHours(0, 0, 0, 0);
    
    const diffTime = returnDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 2) return 'neardue';
    return 'normal';
  };

  // Apply search and filters with auto-sort
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        o.id.toLowerCase().includes(query) || 
        o.customerName.toLowerCase().includes(query) ||
        o.customerMobile.includes(query) ||
        o.productName.toLowerCase().includes(query) ||
        o.productCode.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === filterStatus);
    }

    // Date range filter
    if (filterDateRange.from || filterDateRange.to) {
      filtered = filtered.filter(o => {
        const returnDate = new Date(o.returnDate);
        if (filterDateRange.from && returnDate < filterDateRange.from) return false;
        if (filterDateRange.to && returnDate > filterDateRange.to) return false;
        return true;
      });
    }

    // AUTO-SORT: Overdue first, then near-due, then normal
    filtered.sort((a, b) => {
      const statusA = getReturnDateStatus(a.returnDate);
      const statusB = getReturnDateStatus(b.returnDate);
      
      const priority = { overdue: 0, today: 1, neardue: 2, normal: 3 };
      return priority[statusA] - priority[statusB];
    });

    return filtered;
  }, [orders, searchQuery, filterStatus, filterDateRange]);

  // Paginated orders
  const displayedOrders = rowsPerPage === 0 ? filteredOrders : filteredOrders.slice(0, rowsPerPage);

  // Check if filters are active
  const hasActiveFilters = filterStatus !== 'all' || filterDateRange.from || filterDateRange.to;

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterDateRange({});
    setFilterOpen(false);
  };

  const handleAction = (order: RentalOrder, action: string) => {
    setSelectedOrder(order);
    
    switch (action) {
      case 'view':
        // Open view details drawer (TASK 4 FIX)
        // TODO: Create ViewRentalDetailsDrawer component
        toast.info(`View details for ${order.id}`);
        break;
      case 'edit':
        // Open edit drawer (TASK 4 FIX)
        // TODO: Open RentalBookingDrawer in edit mode
        toast.info(`Edit booking ${order.id}`);
        break;
      case 'return':
        setReturnModalOpen(true);
        break;
      case 'payment':
        setPaymentDialogOpen(true);
        break;
      case 'ledger':
        setLedgerOpen(true);
        break;
      case 'dispatch':
        setDispatchDialogOpen(true);
        break;
      case 'document':
        toast.info(`Upload document for ${order.id}`);
        // TODO: Implement document upload
        break;
      case 'extend':
        setExtendDialogOpen(true);
        break;
      case 'latefee':
        setLateFeeDialogOpen(true);
        break;
      case 'cancel':
        setCancelDialogOpen(true);
        break;
      default:
        console.log('Unknown action:', action, order.id);
    }
  };

  // Handle row click to view details (TASK 4 FIX)
  const handleRowClick = (order: RentalOrder) => {
    setSelectedOrder(order);
    // Open view details - for now show toast, later implement drawer
    toast.info(`Viewing details for ${order.id}`);
    // TODO: Open ViewRentalDetailsDrawer
  };

  return (
    <div className="space-y-6">
      {/* DASHBOARD SUMMARY CARDS */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Active Rentals</span>
            <Package size={16} className="text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.activeRentals}</p>
          <p className="text-xs text-blue-400 mt-1">Currently dispatched</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-red-900/10 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Overdue Returns</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.overdueReturns}</p>
          <p className="text-xs text-red-400 mt-1">Need immediate action</p>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Outstanding</span>
            <DollarSign size={16} className="text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">₹{(stats.totalOutstanding / 1000).toFixed(0)}k</p>
          <p className="text-xs text-green-400 mt-1">Total balance due</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Today's Dispatches</span>
            <Truck size={16} className="text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.todayDispatches}</p>
          <p className="text-xs text-purple-400 mt-1">Scheduled pickups</p>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border border-orange-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Today's Returns</span>
            <CalendarCheck size={16} className="text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.todayReturns}</p>
          <p className="text-xs text-orange-400 mt-1">Expected back</p>
        </div>
      </div>

      {/* GLOBAL TOOLBAR (Same as Products Page) */}
      <div className="flex items-center justify-between gap-4">
        {/* LEFT: Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <Input 
            placeholder="Search order ID, customer, mobile, product..." 
            className="bg-gray-900 border-gray-800 pl-10 text-white h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* MIDDLE: Rows Selector + Column Manager */}
        <div className="flex items-center gap-2">
          <Select value={rowsPerPage.toString()} onValueChange={(val) => setRowsPerPage(parseInt(val))}>
            <SelectTrigger className="w-[120px] bg-gray-900 border-gray-800 text-white h-10">
              <Eye size={14} className="mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
              <SelectItem value="500">500 rows</SelectItem>
              <SelectItem value="1000">1000 rows</SelectItem>
              <SelectItem value="0">All rows</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={columnOpen} onOpenChange={setColumnOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-gray-800 text-gray-400 hover:bg-gray-800 h-10">
                <Columns size={16} className="mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] bg-gray-900 border-gray-800 p-4" align="end">
              <h4 className="font-semibold text-white mb-3 text-sm">Toggle Columns</h4>
              <div className="space-y-2">
                {allColumns.map((col) => (
                  <div key={col.id} className="flex items-center gap-2">
                    <Checkbox
                      id={col.id}
                      checked={columnVisibility[col.id]}
                      onCheckedChange={(checked) => 
                        setColumnVisibility(prev => ({ ...prev, [col.id]: checked as boolean }))
                      }
                      className="border-gray-700"
                    />
                    <label htmlFor={col.id} className="text-sm text-gray-300 cursor-pointer">
                      {col.label}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* RIGHT: Filter + Export */}
        <div className="flex items-center gap-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "border-gray-800 hover:bg-gray-800 h-10",
                  hasActiveFilters ? "text-pink-400 border-pink-900/50 bg-pink-900/10" : "text-gray-400"
                )}
              >
                <Filter size={16} className="mr-2" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-2 h-5 w-5 rounded-full bg-pink-500 text-white text-[10px] flex items-center justify-center">
                    {[filterStatus !== 'all', filterDateRange.from || filterDateRange.to].filter(Boolean).length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] bg-gray-900 border-gray-800 p-0" align="end">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-white">Filters</h3>
                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 text-xs text-pink-400">
                    Clear All
                  </Button>
                )}
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400 uppercase">Status</Label>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as RentalStatus | 'all')}>
                    <SelectTrigger className="bg-gray-950 border-gray-800 text-white h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800 text-white">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Booked">Booked</SelectItem>
                      <SelectItem value="Dispatched">Dispatched</SelectItem>
                      <SelectItem value="Returned">Returned</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-gray-400 uppercase">Return Date Range</Label>
                  <CalendarDateRangePicker
                    date={filterDateRange}
                    onDateChange={setFilterDateRange}
                    className="bg-gray-950 border-gray-800 text-white h-9"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" className="border-gray-800 text-gray-400 hover:bg-gray-800 h-10">
            <FileDown size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50">
        {/* Results Header */}
        <div className="bg-gray-900/70 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {loading ? 'Loading...' : (
              <>
                Showing <span className="text-white font-medium">{displayedOrders.length}</span> of <span className="text-white font-medium">{filteredOrders.length}</span> bookings
              </>
            )}
          </p>
          {hasActiveFilters && (
            <span className="text-xs text-pink-400 flex items-center gap-1">
              <Filter size={12} />
              Filters active
            </span>
          )}
        </div>

        {/* Table with sticky header */}
        <div className="overflow-auto max-h-[600px]">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
              <p className="mt-2">Loading rentals...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900 text-gray-400 font-medium border-b border-gray-800 sticky top-0 z-10">
                <tr>
                  {columnVisibility.product && <th className="p-4 font-medium">Product</th>}
                  {columnVisibility.customer && <th className="p-4 font-medium">Customer</th>}
                  {columnVisibility.pickupDate && <th className="p-4 font-medium">Pickup Date</th>}
                  {columnVisibility.returnDate && <th className="p-4 font-medium">Return Date</th>}
                  {columnVisibility.rentalAmount && <th className="p-4 font-medium text-right">Rental Amount</th>}
                  {columnVisibility.paidAmount && <th className="p-4 font-medium text-right">Paid Amount</th>}
                  {columnVisibility.balanceDue && <th className="p-4 font-medium text-right">Balance Due</th>}
                  {columnVisibility.securityDeposit && <th className="p-4 font-medium text-right">Security</th>}
                  {columnVisibility.status && <th className="p-4 font-medium">Status</th>}
                  {columnVisibility.action && <th className="p-4 font-medium text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500">
                      No bookings found
                    </td>
                  </tr>
                ) : displayedOrders.map((order) => {
                const dateStatus = getReturnDateStatus(order.returnDate);
                const isOverdue = dateStatus === 'overdue';
                const isNearDue = dateStatus === 'today' || dateStatus === 'neardue';

                return (
                  <tr 
                    key={order.id} 
                    onClick={() => handleRowClick(order)}
                    className={cn(
                      "hover:bg-gray-800/50 transition-colors cursor-pointer",
                      isOverdue && "bg-red-900/10",
                      isNearDue && !isOverdue && "bg-orange-900/10"
                    )}
                  >
                    {/* Product Column */}
                    {columnVisibility.product && (
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded bg-gray-800 overflow-hidden shrink-0 border border-gray-700">
                            <img src={order.productImage} alt="" className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{order.productName}</p>
                            <p className="text-xs text-gray-500">{order.productCode}</p>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "mt-1 text-[10px] px-1.5 py-0",
                                order.rentalType === 'Premium' 
                                  ? "bg-purple-900/20 text-purple-400 border-purple-900/50" 
                                  : "bg-blue-900/20 text-blue-400 border-blue-900/50"
                              )}
                            >
                              {order.rentalType}
                            </Badge>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Customer Column */}
                    {columnVisibility.customer && (
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {order.customerName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{order.customerName}</p>
                            <p className="text-xs text-gray-500 font-mono">{order.customerMobile}</p>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Pickup Date Column */}
                    {columnVisibility.pickupDate && (
                      <td className="p-4">
                        <div className="text-gray-400 text-xs">
                          <div className="font-mono">{order.pickupDate}</div>
                          {order.pickupTime && <div className="text-gray-600">{order.pickupTime}</div>}
                        </div>
                      </td>
                    )}

                    {/* Return Date Column */}
                    {columnVisibility.returnDate && (
                      <td className="p-4">
                        <div className={cn(
                          "font-mono text-xs flex items-center gap-2",
                          isOverdue && "text-red-400 font-bold",
                          isNearDue && !isOverdue && "text-orange-400 font-bold",
                          !isOverdue && !isNearDue && "text-gray-400"
                        )}>
                          {order.returnDate}
                          {isOverdue && <AlertTriangle size={14} className="text-red-400" />}
                          {dateStatus === 'today' && <Clock size={14} className="text-orange-400" />}
                        </div>
                      </td>
                    )}

                    {/* Rental Amount Column */}
                    {columnVisibility.rentalAmount && (
                      <td className="p-4 text-right">
                        <div className="text-white font-medium">₹{order.rentalAmount.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Per booking</div>
                      </td>
                    )}

                    {/* Paid Amount Column */}
                    {columnVisibility.paidAmount && (
                      <td className="p-4 text-right">
                        <div className="text-green-400 font-medium">₹{order.paidAmount.toLocaleString()}</div>
                      </td>
                    )}

                    {/* Balance Due Column */}
                    {columnVisibility.balanceDue && (
                      <td className="p-4 text-right">
                        <div className={cn(
                          "font-medium",
                          order.balanceDue > 0 ? "text-red-400" : "text-gray-600"
                        )}>
                          {order.balanceDue > 0 ? `₹${order.balanceDue.toLocaleString()}` : '-'}
                        </div>
                      </td>
                    )}

                    {/* Security Deposit Column */}
                    {columnVisibility.securityDeposit && (
                      <td className="p-4 text-right">
                        <div className="text-white font-medium">₹{order.securityDeposit.toLocaleString()}</div>
                        <div className="text-xs text-gray-500 flex items-center justify-end gap-1 mt-1">
                          <Shield size={10} />
                          {order.guaranteeType}
                          {order.documentAttached && <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-900/50 text-[10px] px-1 py-0 ml-1">📎</Badge>}
                        </div>
                      </td>
                    )}

                    {/* Status Column */}
                    {columnVisibility.status && (
                      <td className="p-4">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "capitalize border font-normal",
                            order.status === 'Booked' && "bg-blue-900/20 text-blue-400 border-blue-900/50",
                            order.status === 'Dispatched' && "bg-orange-900/20 text-orange-400 border-orange-900/50",
                            order.status === 'Returned' && "bg-green-900/20 text-green-400 border-green-900/50",
                            order.status === 'Overdue' && "bg-red-900/20 text-red-400 border-red-900/50",
                            order.status === 'Cancelled' && "bg-gray-900/20 text-gray-400 border-gray-900/50"
                          )}
                        >
                          {order.status}
                        </Badge>
                      </td>
                    )}

                    {/* Action Column */}
                    {columnVisibility.action && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Primary Action Button */}
                          {order.status === 'Booked' && (
                            <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-500 h-8 text-xs font-medium"
                              onClick={() => handleAction(order, 'dispatch')}
                            >
                              Dispatch <ArrowRight size={12} className="ml-1" />
                            </Button>
                          )}
                          {(order.status === 'Dispatched' || order.status === 'Overdue') && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-green-800 text-green-400 hover:bg-green-900/20 h-8 text-xs font-medium"
                              onClick={() => handleAction(order, 'return')}
                            >
                              <CornerDownLeft size={12} className="mr-1" /> Process Return
                            </Button>
                          )}
                          {order.status === 'Returned' && (
                            <span className="text-xs text-green-500 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Complete
                            </span>
                          )}

                          {/* Three Dots Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white w-48">
                              <DropdownMenuItem onClick={() => handleAction(order, 'view')} className="hover:bg-gray-800 cursor-pointer">
                                <Eye size={14} className="mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(order, 'edit')} className="hover:bg-gray-800 cursor-pointer">
                                <Edit size={14} className="mr-2" />
                                Edit Booking
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-800" />
                              <DropdownMenuItem onClick={() => handleAction(order, 'payment')} className="hover:bg-gray-800 cursor-pointer">
                                <CreditCard size={14} className="mr-2" />
                                Add Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(order, 'ledger')} className="hover:bg-gray-800 cursor-pointer">
                                <Receipt size={14} className="mr-2 text-blue-400" />
                                View Ledger
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(order, 'document')} className="hover:bg-gray-800 cursor-pointer">
                                <Upload size={14} className="mr-2" />
                                Upload Document
                              </DropdownMenuItem>
                              {order.status === 'Dispatched' && (
                                <DropdownMenuItem onClick={() => handleAction(order, 'extend')} className="hover:bg-gray-800 cursor-pointer">
                                  <Calendar size={14} className="mr-2" />
                                  Extend Return Date
                                </DropdownMenuItem>
                              )}
                              {order.status === 'Overdue' && (
                                <DropdownMenuItem onClick={() => handleAction(order, 'latefee')} className="hover:bg-gray-800 cursor-pointer text-yellow-400">
                                  <AlertTriangle size={14} className="mr-2" />
                                  Apply Late Fee
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-gray-800" />
                              <DropdownMenuItem onClick={() => handleAction(order, 'cancel')} className="hover:bg-gray-800 cursor-pointer text-red-400">
                                <Ban size={14} className="mr-2" />
                                Cancel Booking
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        {/* Footer - Sticky */}
        <div className="bg-gray-900/70 px-4 py-2 border-t border-gray-800 sticky bottom-0">
          <p className="text-xs text-gray-500">
            Total {filteredOrders.length} booking{filteredOrders.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Return Modal */}
      {returnModalOpen && selectedOrder && (
        <ReturnDressModal 
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          customerName={selectedOrder.customerName}
          returnDate={new Date()}
          securityType="id_card"
          securityValue={selectedOrder.securityDeposit}
        />
      )}

      {/* Payment Dialog */}
      {paymentDialogOpen && selectedOrder && (
        <UnifiedPaymentDialog 
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            setSelectedOrder(null);
          }}
          context="customer"
          entityName={selectedOrder.customerName}
          entityId={selectedOrder.id}
          outstandingAmount={selectedOrder.balanceDue}
          referenceNo={selectedOrder.id}
          onSuccess={() => {
            // Refresh data or update UI
            console.log('Payment recorded for rental:', selectedOrder.id);
          }}
        />
      )}

      {/* Ledger View */}
      {ledgerOpen && selectedOrder && (
        <UnifiedLedgerView 
          isOpen={ledgerOpen}
          onClose={() => {
            setLedgerOpen(false);
            setSelectedOrder(null);
          }}
          entityType="customer"
          entityName={selectedOrder.customerName}
          entityId={selectedOrder.id}
        />
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Rental Booking</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to cancel booking {selectedOrder?.id}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              No, Keep Booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dispatch Dialog */}
      <AlertDialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Dispatch Rental Order</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Mark order {selectedOrder?.id} as dispatched? This will update the status to "Dispatched".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDispatch}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Dispatch Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Date Dialog */}
      <AlertDialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Extend Return Date</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Extend return date for order {selectedOrder?.id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-gray-300">New Return Date</Label>
            <Input
              type="date"
              id="newReturnDate"
              className="bg-gray-800 border-gray-700 text-white mt-2"
              defaultValue={selectedOrder?.returnDate}
              min={selectedOrder?.returnDate}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const input = document.getElementById('newReturnDate') as HTMLInputElement;
                if (input?.value) {
                  handleExtend(input.value);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Extend Date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Late Fee Dialog */}
      <AlertDialog open={lateFeeDialogOpen} onOpenChange={setLateFeeDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Late Fee</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Apply late fee for order {selectedOrder?.id}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-gray-300">Late Fee Amount (Rs.)</Label>
            <Input
              type="number"
              id="lateFeeAmount"
              className="bg-gray-800 border-gray-700 text-white mt-2"
              placeholder="Enter late fee amount"
              min="0"
              step="0.01"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const input = document.getElementById('lateFeeAmount') as HTMLInputElement;
                const amount = parseFloat(input?.value || '0');
                if (amount > 0) {
                  handleLateFee(amount);
                } else {
                  toast.error('Please enter a valid late fee amount');
                }
              }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              Apply Late Fee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};