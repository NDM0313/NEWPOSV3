import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search,
  Plus,
  Eye,
  ChevronRight,
  Palette,
  Scissors,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Download,
  Filter
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { useNavigation } from '../../context/NavigationContext';
import { useSupabase } from '../../context/SupabaseContext';
import { contactService } from '../../services/contactService';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// 🎯 TYPES & INTERFACES
// ============================================

type DepartmentType = 'Dyeing' | 'Stitching' | 'Handwork';
type WorkerStatus = 'Available' | 'Busy' | 'Overloaded';

interface Worker {
  id: string;
  name: string;
  phone: string;
  department: DepartmentType;
  activeJobs: number;
  pendingJobs: number;
  completedJobs: number;
  pendingAmount: number;
  totalEarnings: number;
  status: WorkerStatus;
  rating: number;
  joinedDate: Date;
}

// ============================================
// 🎨 DATA LOADING
// ============================================

// ============================================
// 🎨 HELPER FUNCTIONS
// ============================================

const getDepartmentColor = (dept: DepartmentType) => {
  switch (dept) {
    case 'Dyeing': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'Stitching': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Handwork': return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
  }
};

const getDepartmentIcon = (dept: DepartmentType) => {
  switch (dept) {
    case 'Dyeing': return Palette;
    case 'Stitching': return Scissors;
    case 'Handwork': return Sparkles;
  }
};

const getStatusColor = (status: WorkerStatus) => {
  switch (status) {
    case 'Available': return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'Busy': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'Overloaded': return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
};

const getStatusIcon = (status: WorkerStatus) => {
  switch (status) {
    case 'Available': return CheckCircle2;
    case 'Busy': return Clock;
    case 'Overloaded': return AlertTriangle;
  }
};

// ============================================
// 🎯 MAIN COMPONENT
// ============================================

export const StudioWorkflowPage: React.FC = () => {
  const { setCurrentView, openDrawer } = useNavigation();
  const { companyId } = useSupabase();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  
  // Load workers from Contacts (type=worker) – same list as Contacts page
  const loadWorkers = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const workerContacts = await contactService.getAllContacts(companyId, 'worker');
      
      // Map contact (type=worker) to component Worker format
      const mappedWorkers: Worker[] = (workerContacts || []).map((c: any) => {
        // Map worker_role to department (Contacts: tailor, stitching-master, cutter, hand-worker, dyer, helper)
        let department: DepartmentType = 'Stitching';
        const role = (c.worker_role || '').toLowerCase();
        if (role === 'dyer') {
          department = 'Dyeing';
        } else if (role === 'hand-worker' || role === 'helper') {
          department = 'Handwork';
        } else if (role === 'tailor' || role === 'stitching-master' || role === 'cutter') {
          department = 'Stitching';
        }
        
        const balance = Number(c.current_balance) || 0;
        let status: WorkerStatus = 'Available';
        if (balance > 5000) status = 'Overloaded';
        else if (balance > 0) status = 'Busy';
        
        return {
          id: c.id || '',
          name: c.name || '',
          phone: c.phone || c.mobile || '',
          department,
          activeJobs: 0,
          pendingJobs: 0,
          completedJobs: 0,
          pendingAmount: balance,
          totalEarnings: 0,
          status,
          rating: 4.5,
          joinedDate: c.created_at ? new Date(c.created_at) : new Date()
        };
      });
      
      setWorkers(mappedWorkers);
    } catch (error) {
      console.error('[STUDIO WORKFLOW] Error loading workers:', error);
      toast.error('Failed to load workers');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);
  
  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // Filtered workers (workers in deps so list updates when data loads)
  const filteredWorkers = useMemo(() => {
    return workers.filter(worker => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          worker.name.toLowerCase().includes(search) ||
          worker.phone.includes(search) ||
          worker.department.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Department filter
      if (departmentFilter !== 'all' && worker.department !== departmentFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && worker.status !== statusFilter) return false;

      return true;
    });
  }, [workers, searchTerm, departmentFilter, statusFilter]);

  // Pagination
  const paginatedWorkers = useMemo(() => {
    if (pageSize === -1) return filteredWorkers;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredWorkers.slice(startIndex, startIndex + pageSize);
  }, [filteredWorkers, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredWorkers.length / pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, statusFilter]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleViewWorkerDetail = (workerId: string) => {
    // Open worker detail in new tab
    const detailUrl = `/worker-detail/${workerId}`;
    window.open(detailUrl, '_blank');
    // In real app, you would use router navigation
    console.log('Opening worker detail:', workerId);
  };

  const handleAddWorker = () => {
    // Navigate to Contacts page
    setCurrentView('contacts');
    // Open Add Contact drawer with Worker type pre-selected
    setTimeout(() => {
      openDrawer('addContact', undefined, { contactType: 'worker' });
    }, 100); // Small delay to ensure page transition
  };

  // Summary stats
  const stats = useMemo(() => ({
    totalWorkers: workers.length,
    activeWorkers: workers.filter(w => w.activeJobs > 0).length,
    availableWorkers: workers.filter(w => w.status === 'Available').length,
    totalPendingAmount: workers.reduce((sum, w) => sum + w.pendingAmount, 0)
  }), [workers]);

  // Active filter count
  const activeFilterCount = [
    departmentFilter !== 'all',
    statusFilter !== 'all'
  ].filter(Boolean).length;

  // Clear filters
  const clearFilters = () => {
    setDepartmentFilter('all');
    setStatusFilter('all');
  };

  // Export handlers
  const handleExportCSV = () => {
    console.log('Export Workers CSV');
  };

  const handleExportExcel = () => {
    console.log('Export Workers Excel');
  };

  const handleExportPDF = () => {
    console.log('Export Workers PDF');
  };
  
  // Show loader while loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 size={48} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-800 pb-4">
          <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="text-blue-400" size={32} />
            Workers Management
          </h2>
          <p className="text-gray-400 mt-1">Monitor workload, progress, and production involvement</p>
          </div>

        <div className="flex items-center gap-3">
          <Button 
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-600/20"
            onClick={handleAddWorker}
          >
            <Plus size={18} />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Workers</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalWorkers}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="text-blue-400" size={24} />
            </div>
              </div>
            </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Workers</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.activeWorkers}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="text-yellow-400" size={24} />
            </div>
            </div>
          </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Available</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.availableWorkers}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="text-green-400" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pending Payments</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">
                Rs {stats.totalPendingAmount.toLocaleString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <TrendingUp className="text-orange-400" size={24} />
            </div>
          </div>
                  </div>
                </div>

      {/* Quick Filters */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant={departmentFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDepartmentFilter('all')}
            className={departmentFilter === 'all' ? 'bg-blue-600' : 'border-gray-700 text-gray-400'}
          >
            All Departments
          </Button>
          <Button
            variant={departmentFilter === 'Dyeing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDepartmentFilter('Dyeing')}
            className={departmentFilter === 'Dyeing' ? 'bg-purple-600' : 'border-gray-700 text-gray-400'}
          >
            <Palette size={14} className="mr-2" />
            Dyeing
          </Button>
          <Button
            variant={departmentFilter === 'Stitching' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDepartmentFilter('Stitching')}
            className={departmentFilter === 'Stitching' ? 'bg-blue-600' : 'border-gray-700 text-gray-400'}
          >
            <Scissors size={14} className="mr-2" />
            Stitching
          </Button>
          <Button
            variant={departmentFilter === 'Handwork' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDepartmentFilter('Handwork')}
            className={departmentFilter === 'Handwork' ? 'bg-pink-600' : 'border-gray-700 text-gray-400'}
          >
            <Sparkles size={14} className="mr-2" />
            Handwork
          </Button>

          <div className="h-6 w-px bg-gray-700 mx-2" />

          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className={statusFilter === 'all' ? 'bg-blue-600' : 'border-gray-700 text-gray-400'}
          >
            All Status
          </Button>
                            <Button 
            variant={statusFilter === 'Available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Available')}
            className={statusFilter === 'Available' ? 'bg-green-600' : 'border-gray-700 text-gray-400'}
          >
            Available
                            </Button>
                            <Button 
            variant={statusFilter === 'Busy' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Busy')}
            className={statusFilter === 'Busy' ? 'bg-yellow-600' : 'border-gray-700 text-gray-400'}
          >
            Busy
                            </Button>
                            <Button 
            variant={statusFilter === 'Overloaded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Overloaded')}
            className={statusFilter === 'Overloaded' ? 'bg-red-600' : 'border-gray-700 text-gray-400'}
          >
            Overloaded
                            </Button>
        </div>
      </div>

      {/* Search & Export Toolbar */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, phone, department..."
              className="pl-10 bg-gray-900 border-gray-700 text-white h-10"
            />
          </div>

          {/* Rows Per Page */}
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm h-10 min-w-[100px]"
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={-1}>All ({filteredWorkers.length})</option>
          </select>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 hover:bg-gray-800 h-10 gap-2"
            onClick={handleExportCSV}
          >
            <Download size={16} />
            Export
                </Button>
            </div>
          </div>

      {/* Workers Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-950/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">Worker</th>
                <th className="px-6 py-3 font-medium">Department</th>
                <th className="px-6 py-3 font-medium text-center">Active Jobs</th>
                <th className="px-6 py-3 font-medium text-center">Pending Jobs</th>
                <th className="px-6 py-3 font-medium text-center">Completed</th>
                <th className="px-6 py-3 font-medium text-right">Pending Amount</th>
                <th className="px-6 py-3 font-medium text-center">Status</th>
                <th className="px-6 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-800">
              {paginatedWorkers.map((worker) => {
                const DeptIcon = getDepartmentIcon(worker.department);
                const StatusIcon = getStatusIcon(worker.status);

                return (
                  <tr 
                    key={worker.id} 
                    className="group hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => handleViewWorkerDetail(worker.id)}
                  >
                    {/* Worker Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {worker.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-white">{worker.name}</p>
                          <p className="text-xs text-gray-500">{worker.phone}</p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={getDepartmentColor(worker.department)}>
                        <DeptIcon size={12} className="mr-1" />
                        {worker.department}
                      </Badge>
                    </td>

                    {/* Active Jobs */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold ${
                        worker.activeJobs > 0 
                          ? 'bg-yellow-500/20 text-yellow-400' 
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {worker.activeJobs}
                      </span>
                    </td>

                    {/* Pending Jobs */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold ${
                        worker.pendingJobs > 0 
                          ? 'bg-orange-500/20 text-orange-400' 
                          : 'bg-gray-800 text-gray-500'
                      }`}>
                        {worker.pendingJobs}
                      </span>
                    </td>

                    {/* Completed */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-green-400 font-medium">
                        <CheckCircle2 size={14} />
                        {worker.completedJobs}
                      </span>
                    </td>

                    {/* Pending Amount */}
                    <td className="px-6 py-4 text-right">
                      {worker.pendingAmount > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-orange-400">
                            Rs {worker.pendingAmount.toLocaleString()}
                          </span>
                          <button 
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 group/link"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Go to accounting for worker:', worker.id);
                            }}
                          >
                            View in Accounting
                            <ChevronRight size={12} className="group-hover/link:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Cleared</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <Badge variant="outline" className={getStatusColor(worker.status)}>
                        <StatusIcon size={12} className="mr-1" />
                        {worker.status}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewWorkerDetail(worker.id);
                        }}
                      >
                        <Eye size={16} className="mr-2" />
                        View Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
        </div>

        {/* Empty State */}
        {paginatedWorkers.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-400 text-lg font-medium">No workers found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your filters or search term</p>
        </div>
      )}
        </div>
    </div>
  );
};