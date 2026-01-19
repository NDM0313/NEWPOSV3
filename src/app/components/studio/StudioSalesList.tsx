import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download,
  Eye,
  MoreVertical,
  X,
  ExternalLink
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type StudioStatus = 'Pending' | 'In Progress' | 'Completed';
type CurrentStage = 'Dyeing' | 'Handwork' | 'Stitching' | 'Ready' | 'Not Started';

interface StudioSale {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerMobile: string;
  productName: string;
  fabricType: string;
  meters: number;
  saleDate: string;
  deadline: string;
  currentStage: CurrentStage;
  status: StudioStatus;
  amount: number;
}

// Mock data - Replace with real API call
const mockSales: StudioSale[] = [
  {
    id: "1",
    invoiceNo: "INV-2026-0015",
    customerName: "Ayesha Khan",
    customerMobile: "+92 300 1234567",
    productName: "Bridal Lehenga",
    fabricType: "Silk Lawn - Red",
    meters: 5,
    saleDate: "2026-01-03",
    deadline: "2026-01-20",
    currentStage: "Dyeing",
    status: "In Progress",
    amount: 15000
  },
  {
    id: "2",
    invoiceNo: "INV-2026-0018",
    customerName: "Fatima Ahmed",
    customerMobile: "+92 301 9876543",
    productName: "Wedding Sharara",
    fabricType: "Cotton Lawn - Blue",
    meters: 8,
    saleDate: "2026-01-04",
    deadline: "2026-01-25",
    currentStage: "Handwork",
    status: "In Progress",
    amount: 22000
  },
  {
    id: "3",
    invoiceNo: "INV-2026-0020",
    customerName: "Sara Malik",
    customerMobile: "+92 333 5551234",
    productName: "Party Dress",
    fabricType: "Chiffon - Green",
    meters: 3,
    saleDate: "2026-01-10",
    deadline: "2026-01-30",
    currentStage: "Not Started",
    status: "Pending",
    amount: 8500
  },
  {
    id: "4",
    invoiceNo: "INV-2026-0012",
    customerName: "Zainab Ali",
    customerMobile: "+92 321 4445678",
    productName: "Formal Suit",
    fabricType: "Lawn - White",
    meters: 4,
    saleDate: "2025-12-28",
    deadline: "2026-01-15",
    currentStage: "Ready",
    status: "Completed",
    amount: 12000
  }
];

export const StudioSalesList = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | StudioStatus>('all');
  const [filterStage, setFilterStage] = useState<'all' | CurrentStage>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Calculate delivery status for color coding
  const getDeadlineStatus = (deadline: string, status: StudioStatus) => {
    if (status === 'Completed') return 'completed';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'near';
    return 'normal';
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
        s.customerMobile.includes(query) ||
        s.productName.toLowerCase().includes(query) ||
        s.fabricType.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      sales = sales.filter(s => s.status === filterStatus);
    }

    // Stage filter
    if (filterStage !== 'all') {
      sales = sales.filter(s => s.currentStage === filterStage);
    }

    // Auto-sort: Overdue first, then near deadline, then normal
    sales.sort((a, b) => {
      const statusA = getDeadlineStatus(a.deadline, a.status);
      const statusB = getDeadlineStatus(b.deadline, b.status);
      
      const priority = { overdue: 0, today: 1, near: 2, normal: 3, completed: 4 };
      return priority[statusA] - priority[statusB];
    });

    return sales;
  }, [searchQuery, filterStatus, filterStage]);

  // Pagination
  const displayedSales = rowsPerPage === 0 ? filteredSales : filteredSales.slice(0, rowsPerPage);

  const hasActiveFilters = filterStatus !== 'all' || filterStage !== 'all';

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterStage('all');
    setFilterOpen(false);
  };

  const handleViewDetail = (sale: StudioSale) => {
    setSelectedStudioSaleId?.(sale.id);
    setCurrentView('studio-sale-detail');
  };

  // Status badge color
  const getStatusBadge = (status: StudioStatus) => {
    switch (status) {
      case 'Pending': return 'bg-gray-500/20 text-gray-400 border-gray-700';
      case 'In Progress': return 'bg-blue-500/20 text-blue-400 border-blue-700';
      case 'Completed': return 'bg-green-500/20 text-green-400 border-green-700';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-700';
    }
  };

  // Stage badge color
  const getStageBadge = (stage: CurrentStage) => {
    switch (stage) {
      case 'Not Started': return 'bg-gray-500/20 text-gray-400 border-gray-700';
      case 'Dyeing': return 'bg-purple-500/20 text-purple-400 border-purple-700';
      case 'Handwork': return 'bg-pink-500/20 text-pink-400 border-pink-700';
      case 'Stitching': return 'bg-orange-500/20 text-orange-400 border-orange-700';
      case 'Ready': return 'bg-green-500/20 text-green-400 border-green-700';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-700';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Studio Sales</h1>
          <p className="text-sm text-gray-400 mt-1">Manage fabric processing & production</p>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          {/* LEFT: Search + Rows Selector */}
          <div className="flex items-center gap-3 flex-1">
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-24"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={0}>All</option>
            </select>

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <Input
                type="text"
                placeholder="Search by invoice, customer, fabric..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-950 border-gray-700 text-white h-10"
              />
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterOpen(!filterOpen)}
              className={cn(
                "border-gray-700 text-gray-300 h-10",
                hasActiveFilters && "border-pink-500 text-pink-400 bg-pink-900/10"
              )}
            >
              <Filter size={16} className="mr-2" />
              Filter
              {hasActiveFilters && <Badge className="ml-2 bg-pink-500 text-white text-[10px] px-1.5 py-0">ON</Badge>}
            </Button>

            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 h-10">
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* FILTER PANEL */}
        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Current Stage</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value as any)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Stages</option>
                <option value="Not Started">Not Started</option>
                <option value="Dyeing">Dyeing</option>
                <option value="Handwork">Handwork</option>
                <option value="Stitching">Stitching</option>
                <option value="Ready">Ready</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                <X size={16} className="mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        )}
      </div>

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
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900 text-gray-400 font-medium border-b border-gray-800 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-medium">Invoice No</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Product / Fabric</th>
                <th className="p-4 font-medium">Sale Date</th>
                <th className="p-4 font-medium">Deadline</th>
                <th className="p-4 font-medium">Current Stage</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Amount</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    No studio sales found
                  </td>
                </tr>
              ) : displayedSales.map((sale) => {
                const deadlineStatus = getDeadlineStatus(sale.deadline, sale.status);
                const isOverdue = deadlineStatus === 'overdue';
                const isNear = deadlineStatus === 'today' || deadlineStatus === 'near';

                return (
                  <tr 
                    key={sale.id} 
                    className={cn(
                      "hover:bg-gray-800/50 transition-colors cursor-pointer",
                      isOverdue && "bg-red-900/10",
                      isNear && !isOverdue && "bg-yellow-900/10"
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
                      <p className="text-xs text-gray-500">{sale.customerMobile}</p>
                    </td>

                    {/* Product / Fabric */}
                    <td className="p-4">
                      <p className="text-white">{sale.productName}</p>
                      <p className="text-xs text-gray-500">{sale.fabricType} ({sale.meters}m)</p>
                    </td>

                    {/* Sale Date */}
                    <td className="p-4">
                      <p className="text-gray-300">{format(new Date(sale.saleDate), 'dd MMM yyyy')}</p>
                    </td>

                    {/* Deadline */}
                    <td className="p-4">
                      <p className={cn(
                        "font-medium",
                        isOverdue && "text-red-400",
                        deadlineStatus === 'today' && "text-orange-400",
                        deadlineStatus === 'near' && "text-yellow-400",
                        deadlineStatus === 'normal' && "text-gray-300",
                        deadlineStatus === 'completed' && "text-green-400"
                      )}>
                        {format(new Date(sale.deadline), 'dd MMM yyyy')}
                      </p>
                      {isOverdue && (
                        <p className="text-xs text-red-500 mt-0.5">Overdue!</p>
                      )}
                      {deadlineStatus === 'today' && (
                        <p className="text-xs text-orange-500 mt-0.5">Today!</p>
                      )}
                    </td>

                    {/* Current Stage */}
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5", getStageBadge(sale.currentStage))}>
                        {sale.currentStage}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5", getStatusBadge(sale.status))}>
                        {sale.status}
                      </Badge>
                    </td>

                    {/* Amount */}
                    <td className="p-4 text-right">
                      <p className="text-white font-semibold">Rs {sale.amount.toLocaleString()}</p>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
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
                            <Eye size={14} className="mr-2" />
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
