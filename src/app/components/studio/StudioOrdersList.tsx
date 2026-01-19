import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download,
  Eye,
  FileText,
  Calendar,
  User,
  Package,
  Layers,
  Clock,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  ChevronDown,
  X,
  Palette,
  Scissors,
  Package2,
  UserCircle2,
  Zap,
  UserPlus,
  DollarSign,
  XCircle
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type StudioStatus = 'Draft' | 'In Production' | 'Waiting' | 'Ready' | 'Delivered' | 'Closed';
type SubStatus = 'At Dyer' | 'At Handwork' | 'At Tailor' | 'Quality Check' | 'Packaging';
type Priority = 'Normal' | 'Urgent';

interface StudioJob {
  id: string;
  jobId: string;
  linkedInvoice: string;
  customerName: string;
  customerMobile: string;
  productName: string;
  productCode: string;
  productImage: string;
  priority: Priority;
  expectedDelivery: string;
  currentStep: string;
  assignedWorker: string;
  status: StudioStatus;
  subStatus?: SubStatus;
  internalCost: number;
  customerBilling: number;
  createdDate: string;
}

// Mock data
const mockJobs: StudioJob[] = [
  {
    id: "1",
    jobId: "STU-0001",
    linkedInvoice: "INV-2045",
    customerName: "Ayesha Malik",
    customerMobile: "+92 345 1122334",
    productName: "Royal Red Bridal Lehenga",
    productCode: "RBL-001",
    productImage: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
    priority: "Urgent",
    expectedDelivery: "2026-01-25",
    currentStep: "Handwork",
    assignedWorker: "Ahmed (Handwork)",
    status: "In Production",
    subStatus: "At Handwork",
    internalCost: 3500,
    customerBilling: 5500,
    createdDate: "2026-01-18",
  },
  {
    id: "2",
    jobId: "STU-0002",
    linkedInvoice: "INV-2046",
    customerName: "Sarah Khan",
    customerMobile: "+92 300 1234567",
    productName: "Emerald Green Sharara",
    productCode: "EGS-002",
    productImage: "https://images.unsplash.com/photo-1583391725988-e3eefa84d0f7?w=800&q=80",
    priority: "Normal",
    expectedDelivery: "2026-02-05",
    currentStep: "Dyeing",
    assignedWorker: "Ali Dyer",
    status: "In Production",
    subStatus: "At Dyer",
    internalCost: 2800,
    customerBilling: 4200,
    createdDate: "2026-01-17",
  },
  {
    id: "3",
    jobId: "STU-0003",
    linkedInvoice: "INV-2047",
    customerName: "Zara Ahmed",
    customerMobile: "+92 333 4567890",
    productName: "Ivory Gold Gown",
    productCode: "IGG-003",
    productImage: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
    priority: "Urgent",
    expectedDelivery: new Date().toISOString().split('T')[0], // Today - URGENT!
    currentStep: "Quality Check",
    assignedWorker: "QC Team",
    status: "Waiting",
    subStatus: "Quality Check",
    internalCost: 4500,
    customerBilling: 6800,
    createdDate: "2026-01-10",
  },
  {
    id: "4",
    jobId: "STU-0004",
    linkedInvoice: "INV-2048",
    customerName: "Fatima Ali",
    customerMobile: "+92 321 9876543",
    productName: "Peach Walima Dress",
    productCode: "PWD-004",
    productImage: "https://images.unsplash.com/photo-1518049362260-00ac5bf47086?w=800&q=80",
    priority: "Normal",
    expectedDelivery: "2026-01-30",
    currentStep: "Ready",
    assignedWorker: "-",
    status: "Ready",
    internalCost: 3200,
    customerBilling: 4900,
    createdDate: "2026-01-15",
  },
];

// Column visibility options
const allColumns = [
  { id: 'jobId', label: 'Job ID', default: true },
  { id: 'customer', label: 'Customer', default: true },
  { id: 'product', label: 'Product', default: true },
  { id: 'currentStep', label: 'Current Step', default: true },
  { id: 'assignedWorker', label: 'Assigned Worker', default: true },
  { id: 'deliveryDate', label: 'Delivery Date', default: true },
  { id: 'internalCost', label: 'Internal Cost', default: false },
  { id: 'customerBilling', label: 'Customer Billing', default: true },
  { id: 'status', label: 'Status', default: true },
  { id: 'action', label: 'Action', default: true },
];

export const StudioOrdersList = () => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StudioStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterDateRange, setFilterDateRange] = useState<{ from?: Date; to?: Date }>({});

  // Rows selector
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(
    allColumns.reduce((acc, col) => ({ ...acc, [col.id]: col.default }), {})
  );
  const [columnOpen, setColumnOpen] = useState(false);

  // Calculate dashboard stats
  const stats = useMemo(() => {
    const dyeingJobs = mockJobs.filter(j => j.currentStep === 'Dyeing' && j.status === 'In Production').length;
    const handworkJobs = mockJobs.filter(j => j.currentStep === 'Handwork' && j.status === 'In Production').length;
    const stitchingJobs = mockJobs.filter(j => j.currentStep === 'Stitching' && j.status === 'In Production').length;
    const overdueJobs = mockJobs.filter(j => {
      const today = new Date();
      const deliveryDate = new Date(j.expectedDelivery);
      return deliveryDate < today && j.status !== 'Delivered' && j.status !== 'Closed';
    }).length;
    const completedJobs = mockJobs.filter(j => j.status === 'Delivered' || j.status === 'Closed').length;

    return {
      dyeingJobs,
      handworkJobs,
      stitchingJobs,
      overdueJobs,
      completedJobs
    };
  }, []);

  // Get delivery date status
  const getDeliveryStatus = (deliveryDate: string, status: StudioStatus) => {
    if (status === 'Delivered' || status === 'Closed') return 'delivered';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDateObj = new Date(deliveryDate);
    deliveryDateObj.setHours(0, 0, 0, 0);
    
    const diffTime = deliveryDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'delayed';
    if (diffDays === 0) return 'today';
    if (diffDays <= 2) return 'neardue';
    return 'normal';
  };

  // Apply search and filters with auto-sort
  const filteredJobs = useMemo(() => {
    let jobs = [...mockJobs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      jobs = jobs.filter(j => 
        j.jobId.toLowerCase().includes(query) || 
        j.linkedInvoice.toLowerCase().includes(query) ||
        j.customerName.toLowerCase().includes(query) ||
        j.customerMobile.includes(query) ||
        j.productName.toLowerCase().includes(query) ||
        j.productCode.toLowerCase().includes(query) ||
        j.assignedWorker.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      jobs = jobs.filter(j => j.status === filterStatus);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      jobs = jobs.filter(j => j.priority === filterPriority);
    }

    // Date range filter
    if (filterDateRange.from || filterDateRange.to) {
      jobs = jobs.filter(j => {
        const deliveryDate = new Date(j.expectedDelivery);
        if (filterDateRange.from && deliveryDate < filterDateRange.from) return false;
        if (filterDateRange.to && deliveryDate > filterDateRange.to) return false;
        return true;
      });
    }

    // AUTO-SORT: Delayed first, then urgent, then normal
    jobs.sort((a, b) => {
      const statusA = getDeliveryStatus(a.expectedDelivery, a.status);
      const statusB = getDeliveryStatus(b.expectedDelivery, b.status);
      
      // Priority order
      const priority = { delayed: 0, today: 1, neardue: 2, normal: 3, delivered: 4 };
      
      // If same delivery status, sort by priority
      if (priority[statusA] === priority[statusB]) {
        if (a.priority === 'Urgent' && b.priority === 'Normal') return -1;
        if (a.priority === 'Normal' && b.priority === 'Urgent') return 1;
      }
      
      return priority[statusA] - priority[statusB];
    });

    return jobs;
  }, [searchQuery, filterStatus, filterPriority, filterDateRange]);

  // Paginated jobs
  const displayedJobs = rowsPerPage === 0 ? filteredJobs : filteredJobs.slice(0, rowsPerPage);

  // Check if filters are active
  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || filterDateRange.from || filterDateRange.to;

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterDateRange({});
    setFilterOpen(false);
  };

  const handleAction = (job: StudioJob, action: string) => {
    console.log(action, job.jobId);
  };

  return (
    <div className="space-y-6">
      {/* DASHBOARD SUMMARY CARDS - STAGE-WISE */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Dyeing (Dahair)</span>
            <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-400 text-lg">🎨</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.dyeingJobs}</p>
          <p className="text-xs text-purple-400 mt-1">Active Jobs</p>
        </div>

        <div className="bg-gradient-to-br from-pink-900/30 to-pink-900/10 border border-pink-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Handwork</span>
            <div className="h-8 w-8 rounded-full bg-pink-500/20 flex items-center justify-center">
              <span className="text-pink-400 text-lg">✋</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.handworkJobs}</p>
          <p className="text-xs text-pink-400 mt-1">Active Jobs</p>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Stitching (Tailor)</span>
            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-lg">✂️</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.stitchingJobs}</p>
          <p className="text-xs text-blue-400 mt-1">Active Jobs</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-red-900/10 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Overdue</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.overdueJobs}</p>
          <p className="text-xs text-red-400 mt-1">Need Action</p>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-900/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-medium">Completed</span>
            <CheckCircle2 size={16} className="text-green-400" />
          </div>
          <p className="text-3xl font-bold text-white">{stats.completedJobs}</p>
          <p className="text-xs text-green-400 mt-1">Total Done</p>
        </div>
      </div>

      {/* GLOBAL TOOLBAR */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          {/* LEFT: Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <Input
                type="text"
                placeholder="Search jobs, invoices, customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-950 border-gray-700 text-white h-10"
              />
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2">
            {/* Filter Button */}
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

            {/* Export Button */}
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 h-10">
              <Download size={16} className="mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* FILTER PANEL (Conditional) */}
        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="In Production">In Production</option>
                <option value="Waiting">Waiting</option>
                <option value="Ready">Ready</option>
                <option value="Delivered">Delivered</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="text-xs text-gray-500 uppercase font-medium mb-2 block">Priority</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as any)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            {/* Clear Filters */}
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
            Showing <span className="text-white font-medium">{displayedJobs.length}</span> of <span className="text-white font-medium">{filteredJobs.length}</span> jobs
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
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900 text-gray-400 font-medium border-b border-gray-800 sticky top-0 z-10">
              <tr>
                {columnVisibility.jobId && <th className="p-4 font-medium">Job ID</th>}
                {columnVisibility.customer && <th className="p-4 font-medium">Customer</th>}
                {columnVisibility.product && <th className="p-4 font-medium">Product</th>}
                {columnVisibility.currentStep && <th className="p-4 font-medium">Current Step</th>}
                {columnVisibility.assignedWorker && <th className="p-4 font-medium">Assigned Worker</th>}
                {columnVisibility.deliveryDate && <th className="p-4 font-medium">Delivery Date</th>}
                {columnVisibility.internalCost && <th className="p-4 font-medium text-right">Internal Cost</th>}
                {columnVisibility.customerBilling && <th className="p-4 font-medium text-right">Customer Billing</th>}
                {columnVisibility.status && <th className="p-4 font-medium">Status</th>}
                {columnVisibility.action && <th className="p-4 font-medium text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    No studio jobs found
                  </td>
                </tr>
              ) : displayedJobs.map((job) => {
                const deliveryStatus = getDeliveryStatus(job.expectedDelivery, job.status);
                const isDelayed = deliveryStatus === 'delayed';
                const isNearDue = deliveryStatus === 'today' || deliveryStatus === 'neardue';
                const isUrgent = job.priority === 'Urgent';

                return (
                  <tr 
                    key={job.id} 
                    className={cn(
                      "hover:bg-gray-800/50 transition-colors",
                      isDelayed && "bg-red-900/10",
                      isNearDue && !isDelayed && "bg-orange-900/10",
                      isUrgent && !isDelayed && !isNearDue && "bg-yellow-900/5"
                    )}
                  >
                    {/* Job ID Column */}
                    {columnVisibility.jobId && (
                      <td className="p-4">
                        <div>
                          <p className="font-mono font-bold text-white">{job.jobId}</p>
                          <p className="text-xs text-gray-500 font-mono">{job.linkedInvoice}</p>
                          {isUrgent && (
                            <Badge variant="outline" className="mt-1 bg-yellow-900/20 text-yellow-400 border-yellow-900/50 text-[10px] px-1.5 py-0">
                              URGENT
                            </Badge>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Customer Column */}
                    {columnVisibility.customer && (
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {job.customerName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{job.customerName}</p>
                            <p className="text-xs text-gray-500 font-mono">{job.customerMobile}</p>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Product Column */}
                    {columnVisibility.product && (
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded bg-gray-800 overflow-hidden shrink-0 border border-gray-700">
                            <img src={job.productImage} alt="" className="h-full w-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{job.productName}</p>
                            <p className="text-xs text-gray-500">{job.productCode}</p>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Current Step Column */}
                    {columnVisibility.currentStep && (
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{job.currentStep}</p>
                          {job.subStatus && (
                            <Badge variant="outline" className="mt-1 bg-blue-900/20 text-blue-400 border-blue-900/50 text-[10px] px-1.5 py-0">
                              {job.subStatus}
                            </Badge>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Assigned Worker Column */}
                    {columnVisibility.assignedWorker && (
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {job.assignedWorker !== '-' ? (
                            <>
                              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-orange-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white">
                                {job.assignedWorker.charAt(0)}
                              </div>
                              <span className="text-gray-300 text-sm">{job.assignedWorker}</span>
                            </>
                          ) : (
                            <span className="text-gray-600 text-sm">Not assigned</span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Delivery Date Column */}
                    {columnVisibility.deliveryDate && (
                      <td className="p-4">
                        <div className={cn(
                          "font-mono text-xs flex items-center gap-2",
                          isDelayed && "text-red-400 font-bold",
                          isNearDue && !isDelayed && "text-orange-400 font-bold",
                          !isDelayed && !isNearDue && "text-gray-400"
                        )}>
                          {job.expectedDelivery}
                          {isDelayed && <AlertTriangle size={14} className="text-red-400" />}
                          {deliveryStatus === 'today' && <Clock size={14} className="text-orange-400" />}
                          {isUrgent && <Zap size={14} className="text-yellow-400" />}
                        </div>
                      </td>
                    )}

                    {/* Internal Cost Column (Admin Only) */}
                    {columnVisibility.internalCost && (
                      <td className="p-4 text-right">
                        <div className="text-orange-400 font-medium">₹{job.internalCost.toLocaleString()}</div>
                        <div className="text-xs text-gray-600">Admin only</div>
                      </td>
                    )}

                    {/* Customer Billing Column */}
                    {columnVisibility.customerBilling && (
                      <td className="p-4 text-right">
                        <div className="text-green-400 font-medium">₹{job.customerBilling.toLocaleString()}</div>
                        {columnVisibility.internalCost && (
                          <div className="text-xs text-gray-600">
                            +₹{(job.customerBilling - job.internalCost).toLocaleString()} profit
                          </div>
                        )}
                      </td>
                    )}

                    {/* Status Column */}
                    {columnVisibility.status && (
                      <td className="p-4">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "capitalize border font-normal",
                            job.status === 'Draft' && "bg-gray-900/20 text-gray-400 border-gray-900/50",
                            job.status === 'In Production' && "bg-blue-900/20 text-blue-400 border-blue-900/50",
                            job.status === 'Waiting' && "bg-orange-900/20 text-orange-400 border-orange-900/50",
                            job.status === 'Ready' && "bg-green-900/20 text-green-400 border-green-900/50",
                            job.status === 'Delivered' && "bg-purple-900/20 text-purple-400 border-purple-900/50",
                            job.status === 'Closed' && "bg-gray-900/20 text-gray-500 border-gray-900/50"
                          )}
                        >
                          {job.status}
                        </Badge>
                      </td>
                    )}

                    {/* Action Column */}
                    {columnVisibility.action && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Primary Action based on status */}
                          {job.status === 'In Production' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-blue-800 text-blue-400 hover:bg-blue-900/20 h-8 text-xs font-medium"
                              onClick={() => handleAction(job, 'workflow')}
                            >
                              <Zap size={12} className="mr-1" /> Update Step
                            </Button>
                          )}
                          {job.status === 'Ready' && (
                            <Button 
                              size="sm" 
                              className="bg-green-600 hover:bg-green-500 h-8 text-xs font-medium"
                              onClick={() => handleAction(job, 'deliver')}
                            >
                              <CheckCircle2 size={12} className="mr-1" /> Mark Delivered
                            </Button>
                          )}

                          {/* Three Dots Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white w-56">
                              <DropdownMenuItem onClick={() => handleAction(job, 'view')} className="hover:bg-gray-800 cursor-pointer">
                                <Eye size={14} className="mr-2" />
                                View Job Card
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(job, 'workflow')} className="hover:bg-gray-800 cursor-pointer">
                                <Zap size={14} className="mr-2" />
                                Edit Workflow
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-800" />
                              <DropdownMenuItem onClick={() => handleAction(job, 'assign')} className="hover:bg-gray-800 cursor-pointer">
                                <UserPlus size={14} className="mr-2" />
                                Assign Worker
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(job, 'cost')} className="hover:bg-gray-800 cursor-pointer">
                                <DollarSign size={14} className="mr-2" />
                                Add Cost
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(job, 'complete')} className="hover:bg-gray-800 cursor-pointer">
                                <CheckCircle2 size={14} className="mr-2" />
                                Mark Step Complete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-gray-800" />
                              <DropdownMenuItem onClick={() => handleAction(job, 'invoice')} className="hover:bg-gray-800 cursor-pointer text-green-400">
                                <FileText size={14} className="mr-2" />
                                Generate Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(job, 'close')} className="hover:bg-gray-800 cursor-pointer text-red-400">
                                <XCircle size={14} className="mr-2" />
                                Close Job
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
        </div>

        {/* Footer - Sticky */}
        <div className="bg-gray-900/70 px-4 py-2 border-t border-gray-800 sticky bottom-0">
          <p className="text-xs text-gray-500">
            Total {filteredJobs.length} studio job{filteredJobs.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>
    </div>
  );
};