import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  MoreVertical,
  ExternalLink,
  AlertTriangle,
  Clock,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Package,
  Printer,
  FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { ListToolbar } from '../ui/list-toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { saleService } from '@/app/services/saleService';
import { studioProductionService } from '@/app/services/studioProductionService';
import { convertFromSupabaseSale } from '@/app/context/SalesContext';
import { ViewSaleDetailsDrawer } from '@/app/components/sales/ViewSaleDetailsDrawer';
import { exportToCSV, exportToExcel, exportToPDF, type ExportData } from '@/app/utils/exportUtils';
import { getStudioDeadlineFromNotes, parseStudioDeadlineFromNotes } from '@/app/utils/studioDeadlineNotes';
import { getSaleDisplayNumber } from '@/app/lib/documentDisplayNumbers';
import { toast } from 'sonner';
import {
  DATA_INVALIDATED_EVENT,
  shouldAcceptInvalidation,
  type DataInvalidationDetail,
} from '@/app/lib/dataInvalidationBus';

function formatDateSafe(value: string | undefined | null, formatStr: string): string {
  if (value == null || String(value).trim() === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return format(d, formatStr);
  } catch {
    return '—';
  }
}

type ProductionStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Cancelled';

interface StudioSale {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  fabricSummary: string;
  meters: number;
  saleDate: string;
  deliveryDeadline: string;
  notes: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  productionStatus: ProductionStatus;
  /** Raw `sales.status` (e.g. cancelled) for badges */
  saleStatus?: string | null;
  source?: 'studio_order' | 'sale';
}

export const StudioSalesListNew = () => {
  const { setCurrentView, setSelectedStudioSaleId, openDrawer } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ProductionStatus>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sales, setSales] = useState<StudioSale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const serverPageSize = 50;
  const [loading, setLoading] = useState<boolean>(true);
  const [printDrawerSaleId, setPrintDrawerSaleId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState<string | null>(null);

  // Convert Supabase StudioOrder to StudioSale interface
  const convertFromSupabaseOrder = useCallback((order: any): StudioSale => {
    const statusMap: Record<string, ProductionStatus> = {
      'pending': 'Not Started',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };

    // Get customer info
    const customer = order.customer || {};
    const customerName = customer.name || order.customer_name || 'Unknown';
    const customerPhone = customer.phone || '';

    // Get fabric summary from items or notes
    const items = order.items || [];
    const fabricSummary = items.length > 0 
      ? items[0].item_description || 'N/A'
      : 'N/A';
    const meters = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

    return {
      id: order.id || '',
      invoiceNo: order.order_no || `ORD-${order.id?.slice(0, 8)}`,
      customerName,
      customerPhone,
      fabricSummary,
      meters,
      saleDate: order.order_date || new Date().toISOString().split('T')[0],
      deliveryDeadline: order.delivery_date || order.actual_delivery_date || '',
      notes: order.notes || '',
      totalAmount: order.total_cost || 0,
      paidAmount: order.advance_paid || 0,
      balanceDue: order.balance_due || 0,
      productionStatus: order.status === 'cancelled' ? 'Cancelled' : (statusMap[order.status] || 'Not Started'),
      saleStatus: order.status || null,
      source: 'studio_order' as const
    };
  }, []);

  // Derive production status: Not Started = no tasks assigned; In Progress = any task assigned or started; Completed = all completed
  const deriveProductionStatus = useCallback((stages: Array<{ status?: string }>): ProductionStatus => {
    if (!stages || stages.length === 0) return 'Not Started';
    const allCompleted = stages.every((s: any) => s.status === 'completed');
    if (allCompleted) return 'Completed';
    const anyInProgress = stages.some((s: any) =>
      s.status === 'assigned' || s.status === 'in_progress' || s.status === 'completed'
    );
    return anyInProgress ? 'In Progress' : 'Not Started';
  }, []);

  // Convert sale (from sales table, is_studio = true) to StudioSale; optional stages for production status
  const convertFromSale = useCallback(
    (sale: any, stages?: Array<{ status?: string }>, designNameFromProduction?: string | null): StudioSale => {
    const customer = sale.customer || {};
    const items = sale.items || [];
    const dn = String(designNameFromProduction ?? '').trim();
    const fabricSummary =
      dn ||
      (items.length > 0 ? (items[0].product_name || items[0].item_description || 'N/A') : 'N/A');
    const meters = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    const rawStatus = String(sale.status || '').toLowerCase();
    const productionStatus: ProductionStatus =
      rawStatus === 'cancelled'
        ? 'Cancelled'
        : stages
          ? deriveProductionStatus(stages)
          : 'Not Started';
    const { notesWithoutDeadline } = parseStudioDeadlineFromNotes(sale.notes);
    const deliveryDeadline = sale.deadline || getStudioDeadlineFromNotes(sale.notes) || '';
    return {
      id: sale.id || '',
      invoiceNo:
        getSaleDisplayNumber(sale) ||
        sale.invoiceNo ||
        sale.order_no ||
        `STD-${sale.id?.slice(0, 8)}`,
      customerName: sale.customer_name || customer.name || 'Unknown',
      customerPhone: customer.phone || '',
      fabricSummary,
      meters,
      saleDate: sale.invoice_date || sale.invoiceDate || new Date().toISOString().split('T')[0],
      deliveryDeadline,
      notes: notesWithoutDeadline || '',
      totalAmount: Number(sale.total) || 0,
      paidAmount: Number(sale.paid_amount) || 0,
      balanceDue: Number(sale.due_amount) ?? (Number(sale.total) || 0) - (Number(sale.paid_amount) || 0),
      productionStatus,
      saleStatus: sale.status ?? null,
      source: 'sale' as const
    };
  }, [deriveProductionStatus]);

  const serverPage = currentPage;

  // Load studio sales (paginated server-side, 50 per page) with pagination + batch stage lookup (no N+1)
  const loadStudioOrders = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const effectiveBranchId = branchId === 'all' ? undefined : branchId || undefined;
      const offset = (serverPage - 1) * serverPageSize;
      const result = await saleService
        .getStudioSales(companyId, effectiveBranchId, {
          limit: serverPageSize,
          offset,
          includeCancelled: true,
        })
        .catch(() => ({ data: [], total: 0 }));
      const studioSalesFromSales = (result && typeof result === 'object' && 'data' in result ? (result as { data: any[] }).data : result) || [];
      const total = result && typeof result === 'object' && 'total' in result ? (result as { total: number }).total : studioSalesFromSales.length;
      setTotalCount(total);

      const saleIds = (studioSalesFromSales || []).map((s: any) => s.id).filter(Boolean);
      const stagesBySaleId: Record<string, Array<{ status?: string }>> = {};
      let productionsBySale: Array<{ id?: string; sale_id?: string; design_name?: string | null }> = [];
      if (saleIds.length > 0) {
        try {
          productionsBySale = await studioProductionService.getProductionsBySaleIds(saleIds);
          const productionIds = productionsBySale.map((p: any) => p.id).filter(Boolean);
          const stagesMap = productionIds.length > 0
            ? await studioProductionService.getStagesByProductionIds(productionIds)
            : new Map<string, any[]>();
          for (const saleId of saleIds) {
            const prod = productionsBySale.find((p: any) => p.sale_id === saleId);
            if (prod?.id) {
              stagesBySaleId[saleId] = stagesMap.get(prod.id) || [];
            }
          }
        } catch (_) {
          // ignore; status will stay Not Started
        }
      }

      const designBySaleId: Record<string, string> = {};
      for (const p of productionsBySale) {
        const sid = p.sale_id;
        const name = String(p.design_name ?? '').trim();
        if (sid && name && !designBySaleId[sid]) designBySaleId[sid] = name;
      }

      const fromSales = (studioSalesFromSales || []).map((sale: any) =>
        convertFromSale(sale, stagesBySaleId[sale.id], designBySaleId[sale.id] ?? null)
      );
      setSales(fromSales);
    } catch (error) {
      console.error('Error loading studio orders:', error);
      toast.error('Failed to load studio sales');
      setSales([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSale, serverPage]);

  useEffect(() => {
    loadStudioOrders();
  }, [loadStudioOrders]);

  // Refetch list when any sale is updated (e.g. after editing from this list's Edit → SaleForm)
  useEffect(() => {
    const handler = () => loadStudioOrders();
    window.addEventListener('saleUpdated', handler);
    return () => window.removeEventListener('saleUpdated', handler);
  }, [loadStudioOrders]);

  useEffect(() => {
    if (!companyId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onInvalidated = (ev: Event) => {
      const detail = (ev as CustomEvent<DataInvalidationDetail>).detail;
      if (
        !shouldAcceptInvalidation(detail, {
          domain: ['studio', 'sales', 'inventory'],
          companyId,
          branchId: branchId === 'all' ? null : branchId ?? null,
        })
      ) {
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadStudioOrders();
      }, 220);
    };
    window.addEventListener(DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(DATA_INVALIDATED_EVENT, onInvalidated as EventListener);
    };
  }, [companyId, branchId, loadStudioOrders]);

  // Calculate deadline alerts
  const getDeadlineAlert = (deadline: string, status: ProductionStatus) => {
    if (status === 'Completed' || status === 'Cancelled') return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'near';
    return null;
  };

  // Apply search and filters
  const filteredSales = useMemo(() => {
    let filtered = [...sales];

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.invoiceNo.toLowerCase().includes(query) || 
        s.customerName.toLowerCase().includes(query) ||
        s.customerPhone.includes(query) ||
        s.fabricSummary.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.productionStatus === filterStatus);
    }

    // Auto-sort: Overdue → Near → Normal
    filtered.sort((a, b) => {
      const alertA = getDeadlineAlert(a.deliveryDeadline, a.productionStatus);
      const alertB = getDeadlineAlert(b.deliveryDeadline, b.productionStatus);
      
      const priority = { overdue: 0, near: 1, null: 2 };
      return (priority[alertA as keyof typeof priority] || 2) - (priority[alertB as keyof typeof priority] || 2);
    });

    return filtered;
  }, [sales, searchQuery, filterStatus]);

  // Pagination (server: 50 per page)
  const totalPages = Math.max(1, Math.ceil(totalCount / serverPageSize));
  const displayedSales = filteredSales;

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const hasActiveFilters = filterStatus !== 'all';

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterOpen(false);
  };

  const handleViewDetail = (sale: StudioSale) => {
    setSelectedStudioSaleId?.(sale.id);
    setCurrentView('studio-sale-detail-new');
  };

  const handleEdit = async (sale: StudioSale) => {
    if (sale.saleStatus === 'cancelled' || sale.productionStatus === 'Cancelled') {
      toast.error('This invoice is cancelled and cannot be edited.');
      return;
    }
    if (sale.source !== 'sale') {
      toast.error('Studio orders cannot be edited from here. Open Production to manage.');
      return;
    }
    setEditLoading(sale.id);
    try {
      const full = await saleService.getSaleById(sale.id);
      if (full?.hasReturn) {
        toast.error('Cannot edit: This sale has a return.');
        return;
      }
      const saleWithItems = convertFromSupabaseSale(full);
      openDrawer?.('edit-sale', undefined, { sale: saleWithItems });
    } catch (e: any) {
      console.error('[StudioSalesList] Error loading sale for edit:', e);
      toast.error(e?.message || 'Could not load sale for edit');
    } finally {
      setEditLoading(null);
    }
  };

  // Status badge color
  const getStatusBadge = (status: ProductionStatus) => {
    switch (status) {
      case 'Not Started': return 'bg-gray-500/20 text-gray-400 border-gray-700';
      case 'In Progress': return 'bg-blue-500/20 text-blue-400 border-blue-700';
      case 'Completed': return 'bg-green-500/20 text-green-400 border-green-700';
      case 'Cancelled': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-700';
    }
  };

  // Export: use filtered list for current view
  const getExportData = useCallback((): ExportData => {
    const headers = [
      'Sale / Invoice No', 'Customer', 'Phone', 'Product / Fabric', 'Meters',
      'Sale Date', 'Deadline', 'Notes', 'Total Amount', 'Paid Amount', 'Balance Due', 'Production Status'
    ];
    const rows = filteredSales.map(s => [
      s.invoiceNo,
      s.customerName,
      s.customerPhone || '',
      s.fabricSummary,
      s.meters,
      formatDateSafe(s.saleDate, 'yyyy-MM-dd'),
      formatDateSafe(s.deliveryDeadline, 'yyyy-MM-dd'),
      s.notes || '',
      s.totalAmount,
      s.paidAmount,
      s.balanceDue,
      s.productionStatus
    ]);
    return { headers, rows, title: 'Studio Sales' };
  }, [filteredSales]);

  const handleExportCSV = () => {
    try {
      exportToCSV(getExportData(), 'studio_sales');
      toast.success('CSV exported successfully');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const handleExportExcel = () => {
    try {
      exportToExcel(getExportData(), 'studio_sales');
      toast.success('Excel exported successfully');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const handleExportPDF = () => {
    try {
      exportToPDF(getExportData(), 'studio_sales');
      toast.success('PDF opened for print');
    } catch (e) {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Studio Sales</h1>
          <p className="text-sm text-gray-400 mt-1">Manage fabric processing & production workflow</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white shrink-0"
          onClick={() => setCurrentView('studio-pipeline')}
        >
          <Package size={16} className="mr-2" />
          Production Pipeline
        </Button>
      </div>

      {/* GLOBAL SEARCH & ACTION BAR */}
      <ListToolbar
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search by invoice, customer, phone, fabric..."
        }}
        rowsSelector={{
          value: serverPageSize,
          onChange: () => {},
          totalItems: totalCount
        }}
        filter={{
          isOpen: filterOpen,
          onToggle: () => setFilterOpen(!filterOpen),
          activeCount: hasActiveFilters ? 1 : 0,
          renderPanel: () => (
            <div className="absolute right-0 top-12 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-4">
                {/* Production Status */}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-medium mb-2 block">
                    Production Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          )
        }}
        exportConfig={{
          onExportCSV: handleExportCSV,
          onExportExcel: handleExportExcel,
          onExportPDF: handleExportPDF
        }}
      />

      {/* TABLE */}
      <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50">
        {/* Results Header */}
        <div className="bg-gray-900/70 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Showing{' '}
            <span className="text-white font-medium">
              {totalCount === 0 ? 0 : (currentPage - 1) * serverPageSize + 1}-{Math.min(currentPage * serverPageSize, totalCount)}
            </span>
            {' '}of <span className="text-white font-medium">{totalCount}</span> sales
          </p>
          {hasActiveFilters && (
            <span className="text-xs text-pink-400 flex items-center gap-1">
              <Filter size={12} />
              Filters active
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900 text-gray-400 font-medium border-b border-gray-800 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-medium min-w-[140px]">Sale / Invoice No</th>
                <th className="p-4 font-medium min-w-[180px]">Customer</th>
                <th className="p-4 font-medium min-w-[180px]">Studio product / fabric</th>
                <th className="p-4 font-medium min-w-[120px]">Sale Date</th>
                <th className="p-4 font-medium min-w-[120px]">Deadline</th>
                <th className="p-4 font-medium min-w-[160px]">Notes</th>
                <th className="p-4 font-medium text-right min-w-[120px]">Total Amount</th>
                <th className="p-4 font-medium text-right min-w-[120px]">Paid Amount</th>
                <th className="p-4 font-medium text-right min-w-[120px]">Balance Due</th>
                <th className="p-4 font-medium min-w-[140px]">Production Status</th>
                <th className="p-4 font-medium text-center min-w-[80px]">Alerts</th>
                <th className="p-4 font-medium text-right min-w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedSales.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-500">
                    No studio sales found
                  </td>
                </tr>
              ) : displayedSales.map((sale) => {
                const alert = getDeadlineAlert(sale.deliveryDeadline, sale.productionStatus);

                return (
                  <tr 
                    key={sale.id} 
                    className={cn(
                      "group hover:bg-gray-800/50 transition-colors cursor-pointer",
                      alert === 'overdue' && "bg-red-900/10",
                      alert === 'near' && "bg-yellow-900/10"
                    )}
                    onClick={() => handleViewDetail(sale)}
                  >
                    {/* Invoice No */}
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono font-bold text-white hover:text-blue-400 transition-colors">
                          {sale.invoiceNo}
                        </p>
                        {(sale.saleStatus === 'cancelled' || sale.productionStatus === 'Cancelled') && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400 border-red-500/35">
                            Cancelled
                          </Badge>
                        )}
                        <ExternalLink size={14} className="text-gray-500" />
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="p-4">
                      <p className="text-white font-medium">{sale.customerName}</p>
                      <p className="text-xs text-gray-500">{sale.customerPhone}</p>
                    </td>

                    {/* Product / Fabric */}
                    <td className="p-4">
                      <p className="text-white">{sale.fabricSummary}</p>
                      <p className="text-xs text-gray-500">{sale.meters} meters</p>
                    </td>

                    {/* Sale Date */}
                    <td className="p-4">
                      <p className="text-gray-300">{formatDateSafe(sale.saleDate, 'dd MMM yyyy')}</p>
                    </td>

                    {/* Deadline */}
                    <td className="p-4">
                      <p className={cn(
                        "font-medium",
                        alert === 'overdue' && "text-red-400",
                        alert === 'near' && "text-yellow-400",
                        !alert && "text-gray-300"
                      )}>
                        {formatDateSafe(sale.deliveryDeadline, 'dd MMM yyyy')}
                      </p>
                    </td>

                    {/* Notes: first 40 chars, full text on hover */}
                    <td className="p-4 max-w-[200px]">
                      <p
                        className="text-gray-300 text-sm truncate flex items-center gap-1.5"
                        title={sale.notes || undefined}
                      >
                        {sale.notes ? (
                          <>
                            <FileText size={14} className="text-purple-400/80 shrink-0" aria-hidden />
                            <span>{sale.notes.length > 40 ? `${sale.notes.slice(0, 40)}…` : sale.notes}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </p>
                    </td>

                    {/* Total Amount */}
                    <td className="p-4 text-right">
                      <p className="text-white font-semibold">{formatCurrency(sale.totalAmount)}</p>
                    </td>

                    {/* Paid Amount */}
                    <td className="p-4 text-right">
                      <p className="text-green-400 font-semibold">{formatCurrency(sale.paidAmount)}</p>
                    </td>

                    {/* Balance Due */}
                    <td className="p-4 text-right">
                      <p className={cn(
                        "font-semibold",
                        sale.balanceDue > 0 ? "text-orange-400" : "text-gray-500"
                      )}>
                        {formatCurrency(sale.balanceDue)}
                      </p>
                    </td>

                    {/* Production Status */}
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5", getStatusBadge(sale.productionStatus))}>
                        {sale.productionStatus}
                      </Badge>
                    </td>

                    {/* Alerts */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {alert === 'overdue' && (
                          <div className="relative group">
                            <AlertTriangle size={18} className="text-red-400" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                              Overdue!
                            </div>
                          </div>
                        )}
                        {alert === 'near' && (
                          <div className="relative group">
                            <Clock size={18} className="text-yellow-400" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                              Deadline Near
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white opacity-70 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700 min-w-[200px]">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(sale);
                            }}
                            className="text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer"
                          >
                            <Eye size={14} className="mr-2" />
                            View Detail / Production
                          </DropdownMenuItem>
                          {sale.source === 'sale' && (
                            <>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(sale);
                                }}
                                disabled={!!editLoading}
                                className="text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer"
                              >
                                {editLoading === sale.id ? (
                                  <Loader2 size={14} className="mr-2 animate-spin" />
                                ) : (
                                  <Edit2 size={14} className="mr-2" />
                                )}
                                Edit Sale
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrintDrawerSaleId(sale.id);
                                }}
                                className="text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer"
                              >
                                <Printer size={14} className="mr-2" />
                                Print Invoice
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Print / View Invoice Drawer (for studio sales from sales table) */}
        {printDrawerSaleId && (
          <ViewSaleDetailsDrawer
            isOpen={!!printDrawerSaleId}
            onClose={() => setPrintDrawerSaleId(null)}
            saleId={printDrawerSaleId}
            onEdit={() => {
              setPrintDrawerSaleId(null);
              const sale = sales.find(s => s.id === printDrawerSaleId);
              if (sale) handleEdit(sale);
            }}
            onPrint={() => {}}
          />
        )}

        {/* Pagination */}
        {totalCount > 0 && totalPages > 1 && (
          <div className="bg-gray-900/70 px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Page <span className="text-white font-medium">{currentPage}</span> of <span className="text-white font-medium">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={16} className="mr-0.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight size={16} className="ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};