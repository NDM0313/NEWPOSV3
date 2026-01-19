import React, { useState, useMemo } from 'react';
import { 
  MoreVertical,
  ExternalLink,
  AlertTriangle,
  Clock,
  Filter
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
}

// Mock data
const mockSales: StudioSale[] = [
  {
    id: "1",
    invoiceNo: "INV-2026-0015",
    customerName: "Ayesha Khan",
    customerPhone: "+92 300 1234567",
    fabricSummary: "Silk Lawn - Red",
    meters: 5,
    saleDate: "2026-01-03",
    deliveryDeadline: "2026-01-20",
    totalAmount: 15000,
    paidAmount: 10000,
    balanceDue: 5000,
    productionStatus: "In Progress"
  },
  {
    id: "2",
    invoiceNo: "INV-2026-0018",
    customerName: "Fatima Ahmed",
    customerPhone: "+92 301 9876543",
    fabricSummary: "Cotton Lawn - Blue",
    meters: 8,
    saleDate: "2026-01-04",
    deliveryDeadline: "2026-01-25",
    totalAmount: 22000,
    paidAmount: 22000,
    balanceDue: 0,
    productionStatus: "In Progress"
  },
  {
    id: "3",
    invoiceNo: "INV-2026-0020",
    customerName: "Sara Malik",
    customerPhone: "+92 333 5551234",
    fabricSummary: "Chiffon - Green",
    meters: 3,
    saleDate: "2026-01-10",
    deliveryDeadline: "2026-01-30",
    totalAmount: 8500,
    paidAmount: 3000,
    balanceDue: 5500,
    productionStatus: "Not Started"
  },
  {
    id: "4",
    invoiceNo: "INV-2026-0012",
    customerName: "Zainab Ali",
    customerPhone: "+92 321 4445678",
    fabricSummary: "Lawn - White",
    meters: 4,
    saleDate: "2025-12-28",
    deliveryDeadline: "2026-01-15",
    totalAmount: 12000,
    paidAmount: 12000,
    balanceDue: 0,
    productionStatus: "Completed"
  },
  {
    id: "5",
    invoiceNo: "INV-2026-0008",
    customerName: "Maria Hassan",
    customerPhone: "+92 345 9998877",
    fabricSummary: "Velvet - Maroon",
    meters: 6,
    saleDate: "2025-12-20",
    deliveryDeadline: "2026-01-18",
    totalAmount: 28000,
    paidAmount: 15000,
    balanceDue: 13000,
    productionStatus: "In Progress"
  }
];

export const StudioSalesListNew = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | ProductionStatus>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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
    let sales = [...mockSales];

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      sales = sales.filter(s => 
        s.invoiceNo.toLowerCase().includes(query) || 
        s.customerName.toLowerCase().includes(query) ||
        s.customerPhone.includes(query) ||
        s.fabricSummary.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      sales = sales.filter(s => s.productionStatus === filterStatus);
    }

    // Auto-sort: Overdue → Near → Normal
    sales.sort((a, b) => {
      const alertA = getDeadlineAlert(a.deliveryDeadline, a.productionStatus);
      const alertB = getDeadlineAlert(b.deliveryDeadline, b.productionStatus);
      
      const priority = { overdue: 0, near: 1, null: 2 };
      return (priority[alertA as keyof typeof priority] || 2) - (priority[alertB as keyof typeof priority] || 2);
    });

    return sales;
  }, [searchQuery, filterStatus]);

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
                      <p className="text-gray-300">{format(new Date(sale.saleDate), 'dd MMM yyyy')}</p>
                    </td>

                    {/* Deadline */}
                    <td className="p-4">
                      <p className={cn(
                        "font-medium",
                        alert === 'overdue' && "text-red-400",
                        alert === 'near' && "text-yellow-400",
                        !alert && "text-gray-300"
                      )}>
                        {format(new Date(sale.deliveryDeadline), 'dd MMM yyyy')}
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