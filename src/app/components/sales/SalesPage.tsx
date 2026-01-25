import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Plus, ShoppingCart, DollarSign, TrendingUp, 
  MoreVertical, Eye, Edit, Trash2, FileText, Phone, MapPin,
  Package, Truck, CheckCircle, Clock, XCircle, AlertCircle,
  UserCheck, Receipt, Loader2, PackageCheck, PackageX, ChevronDown
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/app/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { useSales, Sale } from '@/app/context/SalesContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { saleService } from '@/app/services/saleService';
import { branchService, Branch } from '@/app/services/branchService';
import { Pagination } from '@/app/components/ui/pagination';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { formatLongDate } from '@/app/components/ui/utils';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';
import { ViewSaleDetailsDrawer } from './ViewSaleDetailsDrawer';
import { ViewPaymentsModal, type InvoiceDetails, type Payment } from './ViewPaymentsModal';
import { toast } from 'sonner';

// Mock data removed - using SalesContext which loads from Supabase

export const SalesPage = () => {
  const { openDrawer, setCurrentView } = useNavigation();
  const { sales, deleteSale, updateSale, recordPayment, updateShippingStatus, refreshSales, loading } = useSales();
  const { companyId, branchId } = useSupabase();
  const { startDate, endDate } = useDateRange();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
  
  // Load branches for location display
  useEffect(() => {
    const loadBranches = async () => {
      if (!companyId) return;
      try {
        const branchesData = await branchService.getAllBranches(companyId);
        setBranches(branchesData);
        // Create mapping from branch_id to branch NAME only (UI rule: no code, no UUID)
        const map = new Map<string, string>();
        branchesData.forEach(branch => {
          map.set(branch.id, branch.name);
        });
        setBranchMap(map);
      } catch (error) {
        console.error('[SALES PAGE] Error loading branches:', error);
      }
    };
    loadBranches();
  }, [companyId]);

  // TASK 1 FIX - Ensure data loads on mount
  useEffect(() => {
    if (companyId && sales.length === 0 && !loading) {
      refreshSales();
    }
  }, [companyId, sales.length, loading, refreshSales]);
  
  // 🎯 Payment Dialog & Ledger states
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  
  // 🎯 View Payments Modal state
  const [viewPaymentsOpen, setViewPaymentsOpen] = useState(false);
  
  // 🎯 NEW: Additional dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  
  // Filter states
  const [dateFilter, setDateFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');

  // Check for customer filter from ContactsPage
  useEffect(() => {
    const customerId = sessionStorage.getItem('salesFilter_customerId');
    const customerName = sessionStorage.getItem('salesFilter_customerName');
    if (customerId) {
      setCustomerFilter(customerId);
      sessionStorage.removeItem('salesFilter_customerId');
      sessionStorage.removeItem('salesFilter_customerName');
      if (customerName) {
        toast.info(`Filtering sales for ${customerName}`);
      }
    }
  }, []);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [shippingStatusFilter, setShippingStatusFilter] = useState<'all' | ShippingStatus>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  
  // 🎯 UNIFIED ACTION HANDLER
  const handleSaleAction = async (action: string, sale: Sale) => {
    setSelectedSale(sale);
    
    switch (action) {
      case 'view_details':
        setViewDetailsOpen(true);
        break;
        
      case 'edit':
        // Open edit drawer with sale data
        openDrawer('edit-sale', undefined, { sale });
        break;
        
      case 'print_invoice':
        // Print invoice - opens print layout in ViewSaleDetailsDrawer
        setViewDetailsOpen(true);
        toast.success('Opening invoice for printing');
        break;
        
      case 'view_payments':
        setViewPaymentsOpen(true);
        break;
        
      case 'receive_payment':
        setPaymentDialogOpen(true);
        break;
        
      case 'view_ledger':
        setLedgerOpen(true);
        break;
        
      case 'update_shipping':
        setShippingDialogOpen(true);
        break;
        
      case 'delete':
        setDeleteDialogOpen(true);
        break;
        
      default:
        console.warn('Unknown action:', action);
        toast.error('Unknown action');
    }
  };
  
  // 🎯 DELETE HANDLER
  const handleDelete = async () => {
    if (!selectedSale) return;
    
    try {
      await deleteSale(selectedSale.id);
      toast.success(`Sale ${selectedSale.invoiceNo} deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedSale(null);
      await refreshSales();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete sale');
    }
  };
  
  // 🎯 SHIPPING UPDATE HANDLER
  const handleShippingUpdate = async (newStatus: ShippingStatus) => {
    if (!selectedSale) return;
    
    try {
      await updateShippingStatus(selectedSale.id, newStatus);
      toast.success(`Shipping status updated to ${newStatus}`);
      setShippingDialogOpen(false);
      setSelectedSale(null);
      await refreshSales();
    } catch (error: any) {
      console.error('Shipping update error:', error);
      toast.error(error.message || 'Failed to update shipping status');
    }
  };
  
  // Column visibility state
  // REMOVED: contact and paymentMethod columns per UX requirements
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    invoiceNo: true,
    customer: true,
    contact: false, // REMOVED from default view
    location: true,
    paymentStatus: true,
    paymentMethod: false, // REMOVED from default view
    total: true,
    paid: true,
    due: true,
    returnDue: false,
    shipping: true,
    items: true,
  });

  // Column order state - defines the order of columns
  // REMOVED: contact and paymentMethod from default order
  const [columnOrder, setColumnOrder] = useState([
    'date',
    'invoiceNo',
    'customer',
    'location',
    'paymentStatus',
    'total',
    'paid',
    'due',
    'returnDue',
    'shipping',
    'items',
  ]);

  // Columns configuration for Column Manager - ordered based on columnOrder
  const columns = columnOrder.map(key => {
    const labels: Record<string, string> = {
      date: 'Date',
      invoiceNo: 'Invoice No.',
      customer: 'Customer',
      contact: 'Contact',
      location: 'Location',
      paymentStatus: 'Payment Status',
      paymentMethod: 'Payment Method',
      total: 'Total Amount',
      paid: 'Paid',
      due: 'Due',
      returnDue: 'Return Due',
      shipping: 'Shipping Status',
      items: 'Items',
    };
    return { key, label: labels[key] };
  });

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof visibleColumns] }));
  };

  // Move column up in order
  const moveColumnUp = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index > 0) {
      const newOrder = [...columnOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      setColumnOrder(newOrder);
    }
  };

  // Move column down in order
  const moveColumnDown = (key: string) => {
    const index = columnOrder.indexOf(key);
    if (index < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      setColumnOrder(newOrder);
    }
  };

  // Get column widths based on column key
  const getColumnWidth = (key: string): string => {
    const widths: Record<string, string> = {
      date: '100px',
      invoiceNo: '110px',
      customer: '200px',
      contact: '140px',
      location: '150px',
      paymentStatus: '130px',
      paymentMethod: '130px',
      total: '110px',
      paid: '110px',
      due: '110px',
      returnDue: '110px',
      shipping: '120px',
      items: '80px',
    };
    return widths[key] || '100px';
  };

  // Build grid template columns string based on column order
  const gridTemplateColumns = useMemo(() => {
    const columns = columnOrder
      .filter(key => visibleColumns[key as keyof typeof visibleColumns])
      .map(key => getColumnWidth(key))
      .join(' ');
    return `${columns} 60px`.trim(); // 60px for Actions column
  }, [columnOrder, visibleColumns]);

  // Filtered sales - Use real data from context (TASK 1 FIX - "All" means no filter)
  const filteredSales = useMemo(() => {
    return sales.filter((sale: Sale) => {
      // Date range filter (from global date range context) - TASK 1 FIX: Only filter if dates are set
      if (startDate && endDate) {
        const saleDate = new Date(sale.date);
        if (saleDate < startDate || saleDate > endDate) return false;
      }
      // If no date range, show all (no filter applied)

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          sale.invoiceNo.toLowerCase().includes(search) ||
          sale.customer.toLowerCase().includes(search) ||
          sale.customerName.toLowerCase().includes(search) ||
          sale.contactNumber.includes(search) ||
          sale.location.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date filter (local filter - can be removed if using global date range only)
      if (dateFilter !== 'all') {
        // Add date filter logic here
      }

      // Customer filter
      if (customerFilter !== 'all' && sale.customer !== customerFilter) return false;

      // Payment status filter
      if (paymentStatusFilter !== 'all' && sale.paymentStatus !== paymentStatusFilter) return false;

      // Shipping status filter
      if (shippingStatusFilter !== 'all' && sale.shippingStatus !== shippingStatusFilter) return false;

      // Branch filter
      if (branchFilter !== 'all' && sale.location !== branchFilter) return false;

      // Payment method filter
      if (paymentMethodFilter !== 'all' && sale.paymentMethod !== paymentMethodFilter) return false;

      return true;
    });
  }, [sales, startDate, endDate, searchTerm, dateFilter, customerFilter, paymentStatusFilter, shippingStatusFilter, branchFilter, paymentMethodFilter]);

  // Calculate summary
  const summary = useMemo(() => ({
    totalSales: filteredSales.reduce((sum, s) => sum + s.total, 0),
    totalPaid: filteredSales.reduce((sum, s) => sum + s.paid, 0),
    totalDue: filteredSales.reduce((sum, s) => sum + s.due, 0),
    invoiceCount: filteredSales.length,
  }), [filteredSales]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated sales
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredSales.slice(startIndex, endIndex);
  }, [filteredSales, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredSales.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, customerFilter, paymentStatusFilter, shippingStatusFilter, branchFilter, paymentMethodFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setDateFilter('all');
    setCustomerFilter('all');
    setPaymentStatusFilter('all');
    setShippingStatusFilter('all');
    setBranchFilter('all');
    setPaymentMethodFilter('all');
  };

  const activeFilterCount = [
    dateFilter !== 'all',
    customerFilter !== 'all',
    paymentStatusFilter !== 'all',
    shippingStatusFilter !== 'all',
    branchFilter !== 'all',
    paymentMethodFilter !== 'all',
  ].filter(Boolean).length;

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const config = {
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle },
      partial: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock },
      unpaid: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle },
    };
    const { bg, text, border, icon: Icon } = config[status];
    return (
      <Badge className={cn('text-xs font-medium capitalize gap-1 h-6 px-2', bg, text, border)}>
        <Icon size={12} />
        {status}
      </Badge>
    );
  };

  const getShippingStatusBadge = (status: ShippingStatus) => {
    const config = {
      delivered: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
      processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    };
    const { bg, text, border } = config[status];
    return (
      <Badge className={cn('text-xs font-medium capitalize h-6 px-2', bg, text, border)}>
        {status}
      </Badge>
    );
  };

  // Render column cell based on column key
  const renderColumnCell = (columnKey: string, sale: Sale) => {
    switch (columnKey) {
      case 'date':
        return <div className="text-sm text-gray-400">{formatLongDate(sale.date)}</div>;
      
      case 'invoiceNo':
        return <div className="text-sm text-blue-400 font-mono font-semibold">{sale.invoiceNo}</div>;
      
      case 'customer':
        // Customer column: Name + Phone (if exists)
        // Same UX pattern as Supplier list
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate leading-[1.3]">
              {sale.customerName || 'Walk-in Customer'}
            </div>
            {/* Show phone number if exists - no placeholder/icon/dash if empty */}
            {sale.contactNumber && sale.contactNumber.trim() && (
              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <Phone size={10} className="text-gray-600" />
                <span className="truncate">{sale.contactNumber}</span>
              </div>
            )}
          </div>
        );
      
      case 'contact':
        // Legacy column - kept for backwards compatibility but hidden by default
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Phone size={12} className="text-gray-600" />
            <span className="truncate">{sale.contactNumber || '—'}</span>
          </div>
        );
      
      case 'location':
        // UI Rule: Show branch NAME only (not code, never UUID)
        // sale.location now contains branch name from context (or empty)
        // Fallback to branchMap for old data that might still have UUID
        let locationText = sale.location || '';
        
        // If it looks like a UUID, try branchMap fallback, then show '—'
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationText);
        if (isUUID) {
          const resolved = branchMap.get(locationText);
          // Extract just the name if branchMap returns "BR-001 | Name" format
          if (resolved && resolved.includes('|')) {
            locationText = resolved.split('|').pop()?.trim() || '';
          } else {
            locationText = resolved || '';
          }
        }
        // If it contains '|' (old format), extract just the name
        if (locationText.includes('|')) {
          locationText = locationText.split('|').pop()?.trim() || '';
        }
        
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin size={12} className="text-gray-600" />
            <span className="truncate">{locationText || '—'}</span>
          </div>
        );
      
      case 'paymentStatus':
        // Payment status badge is clickable to open View Payments modal
        return (
          <div className="flex justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSale(sale);
                setViewPaymentsOpen(true);
              }}
              className="cursor-pointer hover:scale-105 transition-transform"
              title="Click to view payments"
            >
              {getPaymentStatusBadge(sale.paymentStatus)}
            </button>
          </div>
        );
      
      case 'paymentMethod':
        return (
          <div className="flex justify-center">
            <span className="text-xs text-gray-400">{sale.paymentMethod}</span>
          </div>
        );
      
      case 'total':
        return (
          <div className="text-right">
            <div className="text-sm font-semibold text-white tabular-nums">
              ${sale.total.toLocaleString()}
            </div>
          </div>
        );
      
      case 'paid':
        return (
          <div className="text-right">
            <div className="text-sm font-semibold text-green-400 tabular-nums">
              ${sale.paid.toLocaleString()}
            </div>
          </div>
        );
      
      case 'due':
        return (
          <div className="text-right">
            {sale.due > 0 ? (
              <div className="text-sm font-semibold text-red-400 tabular-nums">
                ${sale.due.toLocaleString()}
              </div>
            ) : (
              <div className="text-sm text-gray-600">-</div>
            )}
          </div>
        );
      
      case 'returnDue':
        return (
          <div className="text-right">
            {sale.returnDue > 0 ? (
              <div className="text-sm font-semibold text-orange-400 tabular-nums">
                ${sale.returnDue.toLocaleString()}
              </div>
            ) : (
              <div className="text-sm text-gray-600">-</div>
            )}
          </div>
        );
      
      case 'shipping':
        // Shipping status is clickable with dropdown to change status
        return (
          <div className="flex justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  className="cursor-pointer hover:scale-105 transition-transform flex items-center gap-1"
                  title="Click to change shipping status"
                  onClick={(e) => e.stopPropagation()}
                >
                  {getShippingStatusBadge(sale.shippingStatus)}
                  <ChevronDown size={12} className="text-gray-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-48 p-2 bg-gray-900 border-gray-700" 
                align="center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1">
                  <p className="text-xs text-gray-400 px-2 pb-2 border-b border-gray-800">Change Status</p>
                  {(['pending', 'processing', 'delivered', 'cancelled'] as const).map(status => {
                    const isActive = sale.shippingStatus === status;
                    const statusConfig = {
                      pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                      processing: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                      delivered: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
                      cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
                    };
                    const config = statusConfig[status];
                    const Icon = config.icon;
                    
                    return (
                      <button
                        key={status}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!isActive) {
                            try {
                              await updateShippingStatus(sale.id, status);
                              toast.success(`Shipping status updated to ${status}`);
                              await refreshSales();
                            } catch (error: any) {
                              toast.error(error.message || 'Failed to update status');
                            }
                          }
                        }}
                        disabled={isActive}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                          isActive 
                            ? `${config.bg} ${config.color} cursor-default` 
                            : "text-gray-300 hover:bg-gray-800"
                        )}
                      >
                        <Icon size={14} className={isActive ? config.color : 'text-gray-500'} />
                        <span className="capitalize">{status}</span>
                        {isActive && <CheckCircle size={12} className="ml-auto text-green-400" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        );
      
      case 'items':
        // Handle both array and number types for items
        const itemsCount = Array.isArray(sale.items) ? sale.items.length : (sale.itemsCount || sale.items || 0);
        return (
          <div className="flex items-center justify-center gap-1 text-gray-300">
            <Package size={12} className="text-gray-500" />
            <span className="text-sm font-medium">{itemsCount}</span>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header - Fixed */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sales</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your sales and customer invoices</p>
          </div>
          <Button 
            onClick={() => openDrawer('addSale')}
            className="bg-blue-600 hover:bg-blue-500 text-white h-10 gap-2"
          >
            <Plus size={16} />
            Add Sale
          </Button>
        </div>
      </div>

      {/* Summary Cards - Fixed */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Sales */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Sales</p>
                <p className="text-2xl font-bold text-white mt-1">${summary.totalSales.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">All invoices</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ShoppingCart size={24} className="text-blue-500" />
              </div>
            </div>
          </div>

          {/* Total Paid */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Paid</p>
                <p className="text-2xl font-bold text-green-400 mt-1">${summary.totalPaid.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Received amount</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-green-500" />
              </div>
            </div>
          </div>

          {/* Total Due */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Due</p>
                <p className="text-2xl font-bold text-red-400 mt-1">${summary.totalDue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Pending payments</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Invoices</p>
                <p className="text-2xl font-bold text-white mt-1">{summary.invoiceCount}</p>
                <p className="text-xs text-gray-500 mt-1">Active orders</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <FileText size={24} className="text-purple-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global List Toolbar */}
      <ListToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: "Search by invoice #, customer, SKU, branch..."
        }}
        rowsSelector={{
          value: pageSize,
          onChange: handlePageSizeChange,
          totalItems: filteredSales.length
        }}
        columnsManager={{
          columns,
          visibleColumns,
          onToggle: toggleColumn,
          onShowAll: () => {
            const allVisible = Object.keys(visibleColumns).reduce((acc, key) => {
              acc[key as keyof typeof visibleColumns] = true;
              return acc;
            }, {} as typeof visibleColumns);
            setVisibleColumns(allVisible);
          },
          onMoveUp: moveColumnUp,
          onMoveDown: moveColumnDown,
        }}
        filter={{
          isOpen: filterOpen,
          onToggle: () => setFilterOpen(!filterOpen),
          activeCount: activeFilterCount,
          renderPanel: () => (
            <div className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Advanced Filters</h3>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {/* Date Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Date Range</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Dates' },
                      { value: 'today', label: 'Today' },
                      { value: 'yesterday', label: 'Yesterday' },
                      { value: 'thisWeek', label: 'This Week' },
                      { value: 'thisMonth', label: 'This Month' },
                      { value: 'custom', label: 'Custom Range' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="date"
                          checked={dateFilter === opt.value}
                          onChange={() => setDateFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Payment Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'paid', label: 'Paid' },
                      { value: 'partial', label: 'Partial' },
                      { value: 'unpaid', label: 'Unpaid' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentStatus"
                          checked={paymentStatusFilter === opt.value}
                          onChange={() => setPaymentStatusFilter(opt.value as any)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Shipping Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Shipping Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'delivered', label: 'Delivered' },
                      { value: 'processing', label: 'Processing' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="shippingStatus"
                          checked={shippingStatusFilter === opt.value}
                          onChange={() => setShippingStatusFilter(opt.value as any)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Branch Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Branch</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Branches' },
                      { value: 'Main Branch (HQ)', label: 'Main Branch (HQ)' },
                      { value: 'Mall Outlet', label: 'Mall Outlet' },
                      { value: 'Warehouse', label: 'Warehouse' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="branch"
                          checked={branchFilter === opt.value}
                          onChange={() => setBranchFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Payment Method</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Methods' },
                      { value: 'Cash', label: 'Cash' },
                      { value: 'Card', label: 'Card' },
                      { value: 'Bank Transfer', label: 'Bank Transfer' },
                      { value: 'Credit', label: 'Credit' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          checked={paymentMethodFilter === opt.value}
                          onChange={() => setPaymentMethodFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        }}
        importConfig={{
          onImport: () => console.log('Import Sales')
        }}
        exportConfig={{
          onExportCSV: () => console.log('Export CSV'),
          onExportExcel: () => console.log('Export Excel'),
          onExportPDF: () => console.log('Export PDF')
        }}
      />

      {/* Sales Table - Scrollable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Table Header */}
              <div className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
                <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{
                    gridTemplateColumns: gridTemplateColumns
                  }}
                >
                  {columnOrder.map(key => {
                    if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                    
                    const alignments: Record<string, string> = {
                      date: 'text-left',
                      invoiceNo: 'text-left',
                      customer: 'text-left',
                      contact: 'text-left',
                      location: 'text-left',
                      paymentStatus: 'text-center',
                      paymentMethod: 'text-center',
                      total: 'text-right',
                      paid: 'text-right',
                      due: 'text-right',
                      returnDue: 'text-right',
                      shipping: 'text-center',
                      items: 'text-center',
                    };
                    
                    const labels: Record<string, string> = {
                      date: 'Date',
                      invoiceNo: 'Invoice No.',
                      customer: 'Customer',
                      contact: 'Contact',
                      location: 'Location',
                      paymentStatus: 'Payment',
                      paymentMethod: 'Method',
                      total: 'Total',
                      paid: 'Paid',
                      due: 'Due',
                      returnDue: 'Return Due',
                      shipping: 'Shipping',
                      items: 'Items',
                    };
                    
                    return (
                      <div key={key} className={alignments[key]}>
                        {labels[key]}
                      </div>
                    );
                  })}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div>
                {loading ? (
                  <div className="py-12 text-center">
                    <Loader2 size={48} className="mx-auto text-blue-500 mb-3 animate-spin" />
                    <p className="text-gray-400 text-sm">Loading sales...</p>
                  </div>
                ) : paginatedSales.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingCart size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No sales found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  paginatedSales.map((sale) => (
                    <div
                      key={sale.id}
                      onMouseEnter={() => setHoveredRow(sale.id || sale.invoiceNo)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="relative grid gap-3 px-4 h-16 hover:bg-gray-800/30 transition-colors items-center after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gray-700 last:after:hidden"
                      style={{
                        gridTemplateColumns: gridTemplateColumns
                      }}
                    >
                      {/* Render columns in order */}
                      {columnOrder.map(key => {
                        if (!visibleColumns[key as keyof typeof visibleColumns]) return null;
                        return <div key={key}>{renderColumnCell(key, sale)}</div>;
                      })}

                      {/* Actions */}
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className={cn(
                                "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                hoveredRow === (sale.id || sale.invoiceNo) ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('view_details', sale)}
                            >
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('edit', sale)}
                            >
                              <Edit size={14} className="mr-2 text-green-400" />
                              Edit Sale
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('print_invoice', sale)}
                            >
                              <FileText size={14} className="mr-2 text-purple-400" />
                              Print Invoice
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            
                            {/* 🎯 VIEW PAYMENTS - View payment history */}
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('view_payments', sale)}
                            >
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Payments
                            </DropdownMenuItem>
                            
                            {/* 🎯 RECEIVE PAYMENT - Only show if there's a due amount */}
                            {sale.due > 0 && (
                              <DropdownMenuItem 
                                className="hover:bg-gray-800 cursor-pointer"
                                onClick={() => handleSaleAction('receive_payment', sale)}
                              >
                                <DollarSign size={14} className="mr-2 text-green-400" />
                                Add Payment
                              </DropdownMenuItem>
                            )}
                            
                            {/* 🎯 VIEW LEDGER */}
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('view_ledger', sale)}
                            >
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Ledger
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSaleAction('update_shipping', sale)}
                            >
                              <Truck size={14} className="mr-2 text-orange-400" />
                              Update Shipping
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="hover:bg-gray-800 cursor-pointer text-red-400"
                              onClick={() => handleSaleAction('delete', sale)}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
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

      {/* Pagination Footer - Fixed */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredSales.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* 🎯 VIEW PAYMENTS MODAL */}
      {selectedSale && (
        <ViewPaymentsModal
          isOpen={viewPaymentsOpen}
          onClose={() => {
            setViewPaymentsOpen(false);
            setSelectedSale(null);
          }}
          invoice={{
            id: selectedSale.id,
            invoiceNo: selectedSale.invoiceNo,
            date: selectedSale.date,
            customerName: selectedSale.customerName,
            customerId: selectedSale.customer,
            total: selectedSale.total,
            paid: selectedSale.paid,
            due: selectedSale.due,
            paymentStatus: selectedSale.paymentStatus,
            payments: [], // Will be fetched dynamically in modal
          }}
          onAddPayment={() => {
            // Close View Payments and open Receive Payment dialog
            setViewPaymentsOpen(false);
            setPaymentDialogOpen(true);
          }}
          onDeletePayment={async (paymentId: string) => {
            // TODO: Implement payment deletion
            console.log('Delete payment:', paymentId);
            throw new Error('Payment deletion not yet implemented');
          }}
          onRefresh={async () => {
            await refreshSales();
          }}
        />
      )}

      {/* 🎯 UNIFIED PAYMENT DIALOG (Receive Payment from Customer) */}
      {selectedSale && (
        <UnifiedPaymentDialog
          isOpen={paymentDialogOpen}
          onClose={() => {
            setPaymentDialogOpen(false);
            // Re-open View Payments modal after payment is cancelled
            if (!viewPaymentsOpen) {
              setViewPaymentsOpen(true);
            }
          }}
          context="customer"
          entityName={selectedSale.customerName}
          entityId={selectedSale.customer}
          outstandingAmount={selectedSale.due}
          totalAmount={selectedSale.total}
          paidAmount={selectedSale.paid}
          previousPayments={(selectedSale as any).payments || []}
          referenceNo={selectedSale.invoiceNo}
          referenceId={selectedSale.id} // CRITICAL FIX: UUID for journal entry reference_id
          onSuccess={async () => {
            toast.success('Payment recorded successfully');
            await refreshSales();
            setPaymentDialogOpen(false);
            // Re-open View Payments modal to show updated data
            setViewPaymentsOpen(true);
          }}
        />
      )}

      {/* 🎯 UNIFIED LEDGER VIEW */}
      {selectedSale && (
        <UnifiedLedgerView
          isOpen={ledgerOpen}
          onClose={() => {
            setLedgerOpen(false);
            setSelectedSale(null);
          }}
          entityType="customer"
          entityName={selectedSale.customerName}
          entityId={selectedSale.id}
        />
      )}
      
      {/* 🎯 DELETE CONFIRMATION DIALOG */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Sale</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {selectedSale && (
                <>
                  Are you sure you want to delete sale <span className="font-semibold text-white">{selectedSale.invoiceNo}</span>?
                  <br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 🎯 VIEW SALE DETAILS DRAWER */}
      {selectedSale && (
        <ViewSaleDetailsDrawer
          isOpen={viewDetailsOpen}
          onClose={() => {
            setViewDetailsOpen(false);
            setSelectedSale(null);
          }}
          saleId={selectedSale.id}
          onEdit={() => {
            setViewDetailsOpen(false);
            handleSaleAction('edit', selectedSale);
          }}
          onDelete={() => {
            setViewDetailsOpen(false);
            handleSaleAction('delete', selectedSale);
          }}
          onAddPayment={() => {
            setViewDetailsOpen(false);
            handleSaleAction('receive_payment', selectedSale);
          }}
        />
      )}

      {/* 🎯 SHIPPING UPDATE DIALOG */}
      <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Update Shipping Status</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                Invoice: <span className="font-semibold text-blue-400">{selectedSale.invoiceNo}</span>
              </div>
              <div className="text-sm text-gray-400">
                Current Status: <span className="font-semibold text-white capitalize">{selectedSale.shippingStatus}</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">New Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['pending', 'processing', 'delivered', 'cancelled'] as ShippingStatus[]).map(status => (
                    <button
                      key={status}
                      onClick={() => handleShippingUpdate(status)}
                      disabled={selectedSale.shippingStatus === status}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        selectedSale.shippingStatus === status
                          ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                          : "bg-gray-800 hover:bg-gray-700 text-white"
                      )}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShippingDialogOpen(false)}
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};