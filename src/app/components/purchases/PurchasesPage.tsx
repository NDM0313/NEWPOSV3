import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Plus, ShoppingBag, DollarSign, AlertCircle, 
  MoreVertical, Eye, Edit, Trash2, FileText, Phone, MapPin,
  Package, CheckCircle, Clock, XCircle, Receipt
} from 'lucide-react';
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
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
import { cn } from "@/app/components/ui/utils";
import { useNavigation } from '@/app/context/NavigationContext';
import { usePurchases } from '@/app/context/PurchaseContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { purchaseService } from '@/app/services/purchaseService';
import { Pagination } from '@/app/components/ui/pagination';
import { ListToolbar } from '@/app/components/ui/list-toolbar';
import { formatLongDate } from '@/app/components/ui/utils';
import { UnifiedPaymentDialog } from '@/app/components/shared/UnifiedPaymentDialog';
import { UnifiedLedgerView } from '@/app/components/shared/UnifiedLedgerView';
import { ViewPurchaseDetailsDrawer } from './ViewPurchaseDetailsDrawer';
import { toast } from 'sonner';

type PurchaseStatus = 'received' | 'ordered' | 'pending';
type PaymentStatus = 'paid' | 'partial' | 'unpaid';

interface Purchase {
  id: number; // Display ID (index-based for UI compatibility)
  uuid: string; // Actual Supabase UUID for database operations
  poNo: string;
  supplier: string;
  supplierContact: string;
  date: string;
  reference: string;
  location: string;
  items: number;
  grandTotal: number;
  paymentDue: number;
  status: PurchaseStatus;
  paymentStatus: PaymentStatus;
  addedBy: string;
}

// Mock data removed - using purchaseService which loads from Supabase

export const PurchasesPage = () => {
  const { openDrawer } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { startDate, endDate } = useDateRange();
  const { purchases: contextPurchases, loading: contextLoading, refreshPurchases } = usePurchases();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  
  // Filter states
  const [dateFilter, setDateFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // Check for supplier filter from ContactsPage
  useEffect(() => {
    const supplierId = sessionStorage.getItem('purchasesFilter_supplierId');
    const supplierName = sessionStorage.getItem('purchasesFilter_supplierName');
    if (supplierId) {
      setSupplierFilter(supplierId);
      sessionStorage.removeItem('purchasesFilter_supplierId');
      sessionStorage.removeItem('purchasesFilter_supplierName');
      if (supplierName) {
        toast.info(`Filtering purchases for ${supplierName}`);
      }
    }
  }, []);
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [branchFilter, setBranchFilter] = useState('all');

  // ✅ Action States for Unified Components
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    poNo: true,
    reference: true,
    supplier: true,
    location: true,
    status: true,
    items: true,
    grandTotal: true,
    paymentDue: true,
    paymentStatus: true,
    addedBy: true,
  });

  // ✅ Action Handlers
  const handleMakePayment = (purchase: Purchase) => {
    if (purchase.paymentDue === 0) {
      toast.error('No outstanding payment for this purchase');
      return;
    }
    setSelectedPurchase(purchase);
    setIsPaymentDialogOpen(true);
  };

  const handleViewLedger = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsLedgerOpen(true);
  };

  const handlePaymentComplete = async () => {
    setIsPaymentDialogOpen(false);
    setSelectedPurchase(null);
    await loadPurchases(); // Refresh purchases list
  };

  const handlePrintPO = (purchase: Purchase) => {
    window.print();
    toast.info(`Printing PO ${purchase.poNo}`);
  };

  const handleDelete = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPurchase || !selectedPurchase.uuid) {
      toast.error('Purchase ID not found');
      return;
    }
    
    try {
      await purchaseService.deletePurchase(selectedPurchase.uuid);
      toast.success(`Purchase ${selectedPurchase.poNo} deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedPurchase(null);
      await loadPurchases();
    } catch (error: any) {
      console.error('[PURCHASES PAGE] Error deleting purchase:', error);
      toast.error('Failed to delete purchase: ' + (error.message || 'Unknown error'));
    }
  };

  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setViewDetailsOpen(true);
  };

  const handleEdit = (purchase: Purchase) => {
    openDrawer('edit-purchase', undefined, { purchase });
  };

  // Load purchases from Supabase
  const loadPurchases = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await purchaseService.getAllPurchases(companyId, branchId || undefined);
      
      // Convert Supabase format to app format
      const convertedPurchases: Purchase[] = data.map((p: any, index: number) => ({
        id: index + 1, // Use index-based ID for compatibility with existing UI
        uuid: p.id, // Store actual Supabase UUID for database operations
        poNo: p.po_no || `PO-${String(index + 1).padStart(3, '0')}`,
        supplier: p.supplier?.name || p.supplier_name || 'Unknown Supplier',
        supplierContact: p.supplier?.phone || '',
        date: p.po_date || new Date().toISOString().split('T')[0],
        reference: p.reference || '',
        location: p.branch_name || 'Main Branch (HQ)',
        items: p.items?.length || 0,
        grandTotal: p.total || 0,
        paymentDue: p.due_amount || 0,
        status: p.status === 'received' ? 'received' : p.status === 'ordered' ? 'ordered' : 'pending',
        paymentStatus: p.payment_status || 'unpaid',
        addedBy: p.created_by_user?.full_name || 'Unknown',
      }));
      
      setPurchases(convertedPurchases);
    } catch (error: any) {
      console.error('[PURCHASES PAGE] Error loading purchases:', error);
      toast.error('Failed to load purchases: ' + (error.message || 'Unknown error'));
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  // Sync context purchases to local state for filtering
  useEffect(() => {
    if (contextPurchases.length > 0) {
      const convertedPurchases: Purchase[] = contextPurchases.map((p: any, index: number) => ({
        id: index + 1,
        uuid: p.id,
        poNo: p.purchaseNo || `PO-${String(index + 1).padStart(3, '0')}`,
        supplier: p.supplierName || 'Unknown Supplier',
        supplierContact: p.contactNumber || '',
        date: p.date || new Date().toISOString().split('T')[0],
        reference: '',
        location: p.location || 'Main Branch (HQ)',
        items: p.itemsCount || 0,
        grandTotal: p.total || 0,
        paymentDue: p.due || 0,
        status: p.status === 'received' ? 'received' : p.status === 'ordered' ? 'ordered' : 'pending',
        paymentStatus: p.paymentStatus || 'unpaid',
        addedBy: 'Unknown',
      }));
      setPurchases(convertedPurchases);
      setLoading(contextLoading);
    } else if (!contextLoading && companyId) {
      // Fallback: load directly if context is empty
      loadPurchases();
    } else {
      setLoading(contextLoading);
    }
  }, [contextPurchases, contextLoading, companyId, loadPurchases]);

  // Columns configuration for Column Manager
  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'poNo', label: 'PO Number' },
    { key: 'reference', label: 'Reference' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'location', label: 'Location' },
    { key: 'status', label: 'Purchase Status' },
    { key: 'items', label: 'Items' },
    { key: 'grandTotal', label: 'Grand Total' },
    { key: 'paymentDue', label: 'Payment Due' },
    { key: 'paymentStatus', label: 'Payment Status' },
    { key: 'addedBy', label: 'Added By' },
  ];

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof visibleColumns] }));
  };

  // Filter data by date range
  const filterByDateRange = useCallback((dateStr: string | undefined): boolean => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    
    const date = new Date(dateStr);
    if (startDate && date < new Date(startDate)) return false;
    if (endDate && date > new Date(endDate + 'T23:59:59')) return false;
    return true;
  }, [startDate, endDate]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
      // Date range filter (from global date range context)
      if (!filterByDateRange(purchase.date)) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          purchase.poNo.toLowerCase().includes(search) ||
          purchase.supplier.toLowerCase().includes(search) ||
          purchase.reference.toLowerCase().includes(search) ||
          purchase.location.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date filter (local filter - can be removed if using global date range only)
      if (dateFilter !== 'all') {
        // Add date filter logic here
      }

      // Supplier filter
      if (supplierFilter !== 'all' && purchase.supplier !== supplierFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && purchase.status !== statusFilter) return false;

      // Payment status filter
      if (paymentStatusFilter !== 'all' && purchase.paymentStatus !== paymentStatusFilter) return false;

      // Branch filter
      if (branchFilter !== 'all' && purchase.location !== branchFilter) return false;

      return true;
    });
  }, [purchases, searchTerm, dateFilter, supplierFilter, statusFilter, paymentStatusFilter, branchFilter, filterByDateRange]);

  // Calculate summary
  const summary = useMemo(() => ({
    totalPurchase: filteredPurchases.reduce((sum, p) => sum + p.grandTotal, 0),
    totalDue: filteredPurchases.reduce((sum, p) => sum + p.paymentDue, 0),
    returns: 2500, // Mock value
    orderCount: filteredPurchases.length,
  }), [filteredPurchases]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Paginated purchases
  const paginatedPurchases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredPurchases.slice(startIndex, endIndex);
  }, [filteredPurchases, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredPurchases.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, supplierFilter, statusFilter, paymentStatusFilter, branchFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setDateFilter('all');
    setSupplierFilter('all');
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setBranchFilter('all');
  };

  const activeFilterCount = [
    dateFilter !== 'all',
    supplierFilter !== 'all',
    statusFilter !== 'all',
    paymentStatusFilter !== 'all',
    branchFilter !== 'all',
  ].filter(Boolean).length;

  const getPurchaseStatusBadge = (status: PurchaseStatus) => {
    const config = {
      received: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle },
      ordered: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: Clock },
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: AlertCircle },
    };
    const { bg, text, border, icon: Icon } = config[status];
    return (
      <Badge className={cn('text-xs font-medium capitalize gap-1 h-6 px-2', bg, text, border)}>
        <Icon size={12} />
        {status}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    const config = {
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
      partial: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      unpaid: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    };
    const { bg, text, border } = config[status];
    return (
      <Badge className={cn('text-xs font-medium capitalize h-6 px-2', bg, text, border)}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#0B0F19]">
      {/* Page Header - Fixed */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Purchases</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage purchase orders and supplier transactions</p>
          </div>
          <Button 
            onClick={() => openDrawer('addPurchase')}
            className="bg-orange-600 hover:bg-orange-500 text-white h-10 gap-2"
          >
            <Plus size={16} />
            Add Purchase
          </Button>
        </div>
      </div>

      {/* Summary Cards - Fixed */}
      <div className="shrink-0 px-6 py-4 bg-[#0F1419] border-b border-gray-800">
        <div className="grid grid-cols-4 gap-4">
          {/* Total Purchase */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Total Purchase</p>
                <p className="text-2xl font-bold text-white mt-1">${summary.totalPurchase.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">This month</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                <ShoppingBag size={24} className="text-orange-500" />
              </div>
            </div>
          </div>

          {/* Amount Due */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Amount Due</p>
                <p className="text-2xl font-bold text-red-400 mt-1">${summary.totalDue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Pending payments</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <DollarSign size={24} className="text-red-500" />
              </div>
            </div>
          </div>

          {/* Returns */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Returns</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">${summary.returns.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">2 items returned</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <Package size={24} className="text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Purchase Orders */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Purchase Orders</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{summary.orderCount}</p>
                <p className="text-xs text-gray-500 mt-1">Active orders</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText size={24} className="text-blue-500" />
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
          placeholder: "Search by PO #, supplier, branch, reference..."
        }}
        rowsSelector={{
          value: pageSize,
          onChange: handlePageSizeChange,
          totalItems: filteredPurchases.length
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
          }
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

                {/* Supplier Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Supplier</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Suppliers' },
                      { value: 'Bilal Fabrics', label: 'Bilal Fabrics' },
                      { value: 'ChenOne', label: 'ChenOne' },
                      { value: 'Sapphire Mills', label: 'Sapphire Mills' },
                      { value: 'Premium Fabrics Ltd', label: 'Premium Fabrics Ltd' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="supplier"
                          checked={supplierFilter === opt.value}
                          onChange={() => setSupplierFilter(opt.value)}
                          className="w-4 h-4 bg-gray-950 border-gray-700"
                        />
                        <span className="text-sm text-gray-300">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Purchase Status Filter */}
                <div>
                  <label className="text-xs text-gray-400 mb-2 block font-medium">Purchase Status</label>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'received', label: 'Received' },
                      { value: 'ordered', label: 'Ordered' },
                      { value: 'pending', label: 'Pending' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          checked={statusFilter === opt.value}
                          onChange={() => setStatusFilter(opt.value as any)}
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
                      { value: 'unpaid', label: 'Unpaid / Due' },
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
              </div>
            </div>
          )
        }}
        importConfig={{
          onImport: () => console.log('Import Purchases')
        }}
        exportConfig={{
          onExportCSV: () => console.log('Export CSV'),
          onExportExcel: () => console.log('Export Excel'),
          onExportPDF: () => console.log('Export PDF')
        }}
      />

      {/* Purchases Table - Scrollable */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Table Header */}
              <div className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
                <div className="grid gap-3 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  style={{
                    gridTemplateColumns: `${visibleColumns.date ? '100px ' : ''}${visibleColumns.poNo ? '110px ' : ''}${visibleColumns.reference ? '110px ' : ''}${visibleColumns.supplier ? '200px ' : ''}${visibleColumns.location ? '150px ' : ''}${visibleColumns.status ? '130px ' : ''}${visibleColumns.items ? '80px ' : ''}${visibleColumns.grandTotal ? '120px ' : ''}${visibleColumns.paymentDue ? '120px ' : ''}${visibleColumns.paymentStatus ? '130px ' : ''}${visibleColumns.addedBy ? '130px ' : ''}60px`.trim()
                  }}
                >
                  {visibleColumns.date && <div className="text-left">Date</div>}
                  {visibleColumns.poNo && <div className="text-left">PO No.</div>}
                  {visibleColumns.reference && <div className="text-left">Reference</div>}
                  {visibleColumns.supplier && <div className="text-left">Supplier</div>}
                  {visibleColumns.location && <div className="text-left">Location</div>}
                  {visibleColumns.status && <div className="text-center">Status</div>}
                  {visibleColumns.items && <div className="text-center">Items</div>}
                  {visibleColumns.grandTotal && <div className="text-right">Total</div>}
                  {visibleColumns.paymentDue && <div className="text-right">Due</div>}
                  {visibleColumns.paymentStatus && <div className="text-center">Payment</div>}
                  {visibleColumns.addedBy && <div className="text-left">Added By</div>}
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div>
                {paginatedPurchases.length === 0 ? (
                  <div className="py-12 text-center">
                    <ShoppingBag size={48} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm">No purchases found</p>
                    <p className="text-gray-600 text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  paginatedPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      onMouseEnter={() => setHoveredRow(purchase.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className="relative grid gap-3 px-4 h-16 hover:bg-gray-800/30 transition-colors items-center after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gray-700 last:after:hidden"
                      style={{
                        gridTemplateColumns: `${visibleColumns.date ? '100px ' : ''}${visibleColumns.poNo ? '110px ' : ''}${visibleColumns.reference ? '110px ' : ''}${visibleColumns.supplier ? '200px ' : ''}${visibleColumns.location ? '150px ' : ''}${visibleColumns.status ? '130px ' : ''}${visibleColumns.items ? '80px ' : ''}${visibleColumns.grandTotal ? '120px ' : ''}${visibleColumns.paymentDue ? '120px ' : ''}${visibleColumns.paymentStatus ? '130px ' : ''}${visibleColumns.addedBy ? '130px ' : ''}60px`.trim()
                      }}
                    >
                      {/* Date */}
                      {visibleColumns.date && (
                        <div className="text-sm text-gray-400">{formatLongDate(purchase.date)}</div>
                      )}

                      {/* PO No */}
                      {visibleColumns.poNo && (
                        <div className="text-sm text-orange-400 font-mono font-semibold">{purchase.poNo}</div>
                      )}

                      {/* Reference */}
                      {visibleColumns.reference && (
                        <div className="text-sm text-gray-400">{purchase.reference || '-'}</div>
                      )}

                      {/* Supplier */}
                      {visibleColumns.supplier && (
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate leading-[1.3]">{purchase.supplier}</div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 leading-[1.3] mt-0.5">
                            <Phone size={10} className="text-gray-600" />
                            <span>{purchase.supplierContact}</span>
                          </div>
                        </div>
                      )}

                      {/* Location */}
                      {visibleColumns.location && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin size={12} className="text-gray-600" />
                          <span className="truncate">{purchase.location}</span>
                        </div>
                      )}

                      {/* Status */}
                      {visibleColumns.status && (
                        <div className="flex justify-center">
                          {getPurchaseStatusBadge(purchase.status)}
                        </div>
                      )}

                      {/* Items */}
                      {visibleColumns.items && (
                        <div className="flex items-center justify-center gap-1 text-gray-300">
                          <Package size={12} className="text-gray-500" />
                          <span className="text-sm font-medium">{purchase.items}</span>
                        </div>
                      )}

                      {/* Grand Total */}
                      {visibleColumns.grandTotal && (
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white tabular-nums">
                            ${purchase.grandTotal.toLocaleString()}
                          </div>
                        </div>
                      )}

                      {/* Payment Due */}
                      {visibleColumns.paymentDue && (
                        <div className="text-right">
                          {purchase.paymentDue > 0 ? (
                            <div className="text-sm font-semibold text-red-400 tabular-nums">
                              ${purchase.paymentDue.toLocaleString()}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600">-</div>
                          )}
                        </div>
                      )}

                      {/* Payment Status */}
                      {visibleColumns.paymentStatus && (
                        <div className="flex justify-center">
                          {getPaymentStatusBadge(purchase.paymentStatus)}
                        </div>
                      )}

                      {/* Added By */}
                      {visibleColumns.addedBy && (
                        <div className="text-xs text-gray-400">{purchase.addedBy}</div>
                      )}

                      {/* Actions */}
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className={cn(
                                "w-8 h-8 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-all flex items-center justify-center text-gray-400 hover:text-white",
                                hoveredRow === purchase.id ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 text-white w-52">
                            <DropdownMenuItem 
                              onClick={() => handleViewDetails(purchase)}
                              className="hover:bg-gray-800 cursor-pointer"
                            >
                              <Eye size={14} className="mr-2 text-blue-400" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEdit(purchase)}
                              className="hover:bg-gray-800 cursor-pointer"
                            >
                              <Edit size={14} className="mr-2 text-green-400" />
                              Edit Purchase
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handlePrintPO(purchase)}>
                              <FileText size={14} className="mr-2 text-purple-400" />
                              Print PO
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-gray-700" />
                            
                            {/* 🎯 MAKE PAYMENT - Only show if there's outstanding payment */}
                            {purchase.paymentDue > 0 && (
                              <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleMakePayment(purchase)}>
                                <DollarSign size={14} className="mr-2 text-yellow-400" />
                                Make Payment
                              </DropdownMenuItem>
                            )}
                            
                            {/* 🎯 VIEW LEDGER */}
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer" onClick={() => handleViewLedger(purchase)}>
                              <Receipt size={14} className="mr-2 text-blue-400" />
                              View Ledger
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator className="bg-gray-700" />
                            <DropdownMenuItem className="hover:bg-gray-800 cursor-pointer text-red-400" onClick={() => handleDelete(purchase)}>
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
        totalItems={filteredPurchases.length}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Unified Payment Dialog */}
      {selectedPurchase && (
        <UnifiedPaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false);
            setSelectedPurchase(null);
          }}
          context="supplier"
          entityName={selectedPurchase.supplier}
          entityId={selectedPurchase.uuid}
          outstandingAmount={selectedPurchase.paymentDue}
          referenceNo={selectedPurchase.poNo}
          onSuccess={handlePaymentComplete}
        />
      )}

      {/* View Purchase Details Drawer */}
      {selectedPurchase && (
        <ViewPurchaseDetailsDrawer
          isOpen={viewDetailsOpen}
          onClose={() => {
            setViewDetailsOpen(false);
            setSelectedPurchase(null);
          }}
          purchase={selectedPurchase}
        />
      )}

      {/* Unified Ledger View */}
      {selectedPurchase && (
        <UnifiedLedgerView
          isOpen={isLedgerOpen}
          onClose={() => {
            setIsLedgerOpen(false);
            setSelectedPurchase(null);
          }}
          entityType="supplier"
          entityName={selectedPurchase.supplier}
          entityId={selectedPurchase.uuid}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {selectedPurchase && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                Are you sure you want to delete <strong>{selectedPurchase.poNo}</strong>? 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};