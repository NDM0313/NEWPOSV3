import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  MoreVertical,
  ExternalLink,
  AlertTriangle,
  Clock,
  Filter,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';
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

type ProductionStatus = 'Not Started' | 'In Progress' | 'Completed';

interface StudioSale {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  fabricSummary: string;
  meters: number;
  saleDate: string;
  deliveryDeadline: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  productionStatus: ProductionStatus;
  source?: 'studio_order' | 'sale';
}

export const StudioSalesListNew = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ProductionStatus>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sales, setSales] = useState<StudioSale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Convert Supabase StudioOrder to StudioSale interface
  const convertFromSupabaseOrder = useCallback((order: any): StudioSale => {
    const statusMap: Record<string, ProductionStatus> = {
      'pending': 'Not Started',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Not Started'
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
      totalAmount: order.total_cost || 0,
      paidAmount: order.advance_paid || 0,
      balanceDue: order.balance_due || 0,
      productionStatus: statusMap[order.status] || 'Not Started',
      source: 'studio_order' as const
    };
  }, []);

  // Convert sale (from sales table, is_studio = true) to StudioSale
  const convertFromSale = useCallback((sale: any): StudioSale => {
    const customer = sale.customer || {};
    const items = sale.items || [];
    const fabricSummary = items.length > 0
      ? (items[0].product_name || 'N/A')
      : 'N/A';
    const meters = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    return {
      id: sale.id || '',
      invoiceNo: sale.invoice_no || sale.invoiceNo || `STD-${sale.id?.slice(0, 8)}`,
      customerName: sale.customer_name || customer.name || 'Unknown',
      customerPhone: customer.phone || '',
      fabricSummary,
      meters,
      saleDate: sale.invoice_date || sale.invoiceDate || new Date().toISOString().split('T')[0],
      deliveryDeadline: sale.notes || '',
      totalAmount: Number(sale.total) || 0,
      paidAmount: Number(sale.paid_amount) || 0,
      balanceDue: Number(sale.due_amount) || 0,
      productionStatus: 'Not Started',
      source: 'sale' as const
    };
  }, []);

  // Load studio orders + studio-type sales (from Sale Form) from Supabase
  const loadStudioOrders = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [orders, studioSalesFromSales] = await Promise.all([
        studioService.getAllStudioOrders(companyId, branchId === 'all' ? undefined : branchId || undefined),
        saleService.getStudioSales(companyId, branchId || undefined).catch(() => [])
      ]);
      const fromOrders = orders.map(convertFromSupabaseOrder);
      const fromSales = (studioSalesFromSales || []).map(convertFromSale);
      setSales([...fromOrders, ...fromSales]);
    } catch (error) {
      console.error('Error loading studio orders:', error);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseOrder, convertFromSale]);

  useEffect(() => {
    loadStudioOrders();
  }, [loadStudioOrders]);

  // Calculate deadline alerts
  const getDeadlineAlert = (deadline: string, status: ProductionStatus) => {
    if (status === 'Completed') return null;
    
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

  // Pagination
  const displayedSales = rowsPerPage === 0 ? filteredSales : filteredSales.slice(0, rowsPerPage);

  const hasActiveFilters = filterStatus !== 'all';

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterOpen(false);
  };

  const handleViewDetail = (sale: StudioSale) => {
    // Open in NEW TAB with unique URL
    const detailUrl = `/studio/sale/${sale.id}`;
    
    // For now, we'll use navigation context but set it to open like a new page
    // In a real app with routing, this would be: window.open(detailUrl, '_blank')
    setSelectedStudioSaleId?.(sale.id);
    setCurrentView('studio-sale-detail');
  };

  // Status badge color
  const getStatusBadge = (status: ProductionStatus) => {
    switch (status) {
      case 'Not Started': return 'bg-gray-500/20 text-gray-400 border-gray-700';
      case 'In Progress': return 'bg-blue-500/20 text-blue-400 border-blue-700';
      case 'Completed': return 'bg-green-500/20 text-green-400 border-green-700';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-700';
    }
  };

  // Export handlers
  const handleExportCSV = () => {
    console.log('Export CSV');
  };

  const handleExportExcel = () => {
    console.log('Export Excel');
  };

  const handleExportPDF = () => {
    console.log('Export PDF');
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
      </div>

      {/* GLOBAL SEARCH & ACTION BAR */}
      <ListToolbar
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search by invoice, customer, phone, fabric..."
        }}
        rowsSelector={{
          value: rowsPerPage,
          onChange: setRowsPerPage,
          totalItems: filteredSales.length
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
            Showing <span className="text-white font-medium">{displayedSales.length}</span> of <span className="text-white font-medium">{filteredSales.length}</span> sales
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
                <th className="p-4 font-medium min-w-[180px]">Product / Fabric</th>
                <th className="p-4 font-medium min-w-[120px]">Sale Date</th>
                <th className="p-4 font-medium min-w-[120px]">Deadline</th>
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
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    No studio sales found
                  </td>
                </tr>
              ) : displayedSales.map((sale) => {
                const alert = getDeadlineAlert(sale.deliveryDeadline, sale.productionStatus);

                return (
                  <tr 
                    key={sale.id} 
                    className={cn(
                      "hover:bg-gray-800/50 transition-colors cursor-pointer",
                      alert === 'overdue' && "bg-red-900/10",
                      alert === 'near' && "bg-yellow-900/10"
                    )}
                    onClick={() => handleViewDetail(sale)}
                  >
                    {/* Invoice No */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-white hover:text-blue-400 transition-colors">
                          {sale.invoiceNo}
                        </p>
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

                    {/* Total Amount */}
                    <td className="p-4 text-right">
                      <p className="text-white font-semibold">Rs {sale.totalAmount.toLocaleString()}</p>
                    </td>

                    {/* Paid Amount */}
                    <td className="p-4 text-right">
                      <p className="text-green-400 font-semibold">Rs {sale.paidAmount.toLocaleString()}</p>
                    </td>

                    {/* Balance Due */}
                    <td className="p-4 text-right">
                      <p className={cn(
                        "font-semibold",
                        sale.balanceDue > 0 ? "text-orange-400" : "text-gray-500"
                      )}>
                        Rs {sale.balanceDue.toLocaleString()}
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
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(sale);
                            }}
                            className="text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer"
                          >
                            View Detail
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};