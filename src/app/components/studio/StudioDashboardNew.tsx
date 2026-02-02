import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { saleService } from '@/app/services/saleService';
import { toast } from 'sonner';
import { 
  Palette, 
  Sparkles, 
  Scissors, 
  CheckCircle2,
  Clock,
  TrendingUp,
  Package,
  ArrowRight,
  Filter,
  Search
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';

// Studio orders will be loaded from Supabase

interface DepartmentCardProps {
  name: string;
  icon: React.ElementType;
  count: number;
  color: string;
  onClick: () => void;
}

const DepartmentCard = ({ name, icon: Icon, count, color, onClick }: DepartmentCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer transition-all hover:border-gray-700 group",
        "hover:shadow-lg hover:-translate-y-1"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "h-14 w-14 rounded-xl flex items-center justify-center",
          color === 'purple' && "bg-purple-500/20",
          color === 'blue' && "bg-blue-500/20",
          color === 'green' && "bg-green-500/20",
          color === 'orange' && "bg-orange-500/20"
        )}>
          <Icon size={28} className={cn(
            color === 'purple' && "text-purple-400",
            color === 'blue' && "text-blue-400",
            color === 'green' && "text-green-400",
            color === 'orange' && "text-orange-400"
          )} />
        </div>
        <ArrowRight size={20} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-1">{count}</h3>
      <p className="text-sm text-gray-400">{name}</p>
    </div>
  );
};

interface StudioOrderDisplay {
  id: string;
  rowKey: string; // unique key for React (e.g. order_xxx / sale_xxx)
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  fabricName: string;
  currentStage: string;
  assignedWorker: string;
  expectedDate: string;
  status: string;
  source: 'studio_order' | 'sale';
}

export const StudioDashboardNew = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [orders, setOrders] = useState<StudioOrderDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Convert Supabase studio_order to display format
  const convertFromSupabaseOrder = useCallback((supabaseOrder: any): StudioOrderDisplay => {
    const firstItem = supabaseOrder.items?.[0];
    const jobCards = supabaseOrder.job_cards || [];
    
    let currentStage = 'Dyeing';
    let assignedWorker = 'Unassigned';
    
    if (jobCards.length > 0) {
      const activeJob = jobCards.find((jc: any) => jc.status === 'in_progress');
      if (activeJob) {
        currentStage = activeJob.task_type === 'cutting' ? 'Dyeing' : 
                      activeJob.task_type === 'embroidery' ? 'Handwork' : 
                      activeJob.task_type === 'stitching' ? 'Stitching' : 'Dyeing';
        assignedWorker = activeJob.worker?.name || 'Unassigned';
      } else {
        const allCompleted = jobCards.every((jc: any) => jc.status === 'completed');
        if (allCompleted) currentStage = 'Completed';
      }
    }

    return {
      id: supabaseOrder.id,
      rowKey: `order_${supabaseOrder.id}`,
      invoiceNo: supabaseOrder.order_no || `ST-${supabaseOrder.id?.slice(0, 8) || ''}`,
      customerName: supabaseOrder.customer_name || supabaseOrder.customer?.name || '',
      customerPhone: supabaseOrder.customer?.phone || '',
      fabricName: firstItem?.item_description || 'Fabric',
      currentStage,
      assignedWorker,
      expectedDate: supabaseOrder.delivery_date || '',
      status: supabaseOrder.status === 'completed' ? 'Completed' : 'In Progress',
      source: 'studio_order',
    };
  }, []);

  // Convert sale (sales table, is_studio = true) to display format – show on dashboard so user can shift to production
  const convertFromSale = useCallback((sale: any): StudioOrderDisplay => {
    const items = sale.items || [];
    const firstItem = items[0];
    const customer = sale.customer || {};
    return {
      id: sale.id,
      rowKey: `sale_${sale.id}`,
      invoiceNo: sale.invoice_no || `SL-${sale.id?.slice(0, 8) || ''}`,
      customerName: sale.customer_name || customer.name || '',
      customerPhone: customer.phone || '',
      fabricName: firstItem?.product_name || firstItem?.product?.name || 'Sale items',
      currentStage: 'Ready for Production',
      assignedWorker: '—',
      expectedDate: sale.notes || '',
      status: 'Pending',
      source: 'sale',
    };
  }, []);

  // Load studio orders + studio sales (sales with is_studio = true) so both show and can shift to production
  const loadStudioOrders = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const [studioOrdersData, studioSalesData] = await Promise.all([
        studioService.getAllStudioOrders(companyId, branchId === 'all' ? undefined : branchId || undefined),
        saleService.getStudioSales(companyId, branchId === 'all' ? undefined : branchId || undefined).catch(() => []),
      ]);
      const fromOrders = (studioOrdersData || []).map(convertFromSupabaseOrder);
      const fromSales = (studioSalesData || []).map(convertFromSale);
      setOrders([...fromOrders, ...fromSales]);
    } catch (error) {
      console.error('[STUDIO DASHBOARD] Error loading studio orders:', error);
      toast.error('Failed to load studio orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseOrder, convertFromSale]);

  // Load orders on mount
  useEffect(() => {
    if (companyId) {
      loadStudioOrders();
    } else {
      setLoading(false);
    }
  }, [companyId, loadStudioOrders]);

  // Calculate department counts
  const departmentCounts = {
    dyeing: orders.filter(o => o.currentStage === 'Dyeing').length,
    handwork: orders.filter(o => o.currentStage === 'Handwork').length,
    stitching: orders.filter(o => o.currentStage === 'Stitching').length,
    completed: orders.filter(o => o.status === 'Completed').length
  };

  // Filter orders based on department selection (Completed = by status)
  const filteredOrders = selectedDepartment
    ? selectedDepartment === 'Completed'
      ? orders.filter(o => o.status === 'Completed')
      : orders.filter(o => o.currentStage === selectedDepartment)
    : orders;

  // Apply search filter
  const searchFilteredOrders = filteredOrders.filter(o =>
    o.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.fabricName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.assignedWorker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Studio Production Dashboard</h1>
        <p className="text-sm text-gray-400">Department-wise order tracking</p>
      </div>

      {/* DEPARTMENT CARDS – studio sales (Ready for Production) + department-wise */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DepartmentCard
          name="Ready for Production"
          icon={Package}
          count={departmentCounts.readyForProduction}
          color="blue"
          onClick={() => setSelectedDepartment(selectedDepartment === 'Ready for Production' ? null : 'Ready for Production')}
        />
        <DepartmentCard
          name="Dyeing Department"
          icon={Palette}
          count={departmentCounts.dyeing}
          color="purple"
          onClick={() => setSelectedDepartment(selectedDepartment === 'Dyeing' ? null : 'Dyeing')}
        />
        <DepartmentCard
          name="Handwork / Embroidery"
          icon={Sparkles}
          count={departmentCounts.handwork}
          color="blue"
          onClick={() => setSelectedDepartment(selectedDepartment === 'Handwork' ? null : 'Handwork')}
        />
        <DepartmentCard
          name="Stitching Department"
          icon={Scissors}
          count={departmentCounts.stitching}
          color="green"
          onClick={() => setSelectedDepartment(selectedDepartment === 'Stitching' ? null : 'Stitching')}
        />
        <DepartmentCard
          name="Completed Today"
          icon={CheckCircle2}
          count={departmentCounts.completed}
          color="orange"
          onClick={() => setSelectedDepartment(selectedDepartment === 'Completed' ? null : 'Completed')}
        />
      </div>

      {/* ACTIVE FILTER INDICATOR */}
      {selectedDepartment && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-300">
                Filtered by: {selectedDepartment} Department
              </p>
              <p className="text-xs text-blue-400/70 mt-0.5">
                Showing {searchFilteredOrders.length} orders
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedDepartment(null)}
            className="border-blue-700 text-blue-300 hover:bg-blue-900/30"
          >
            Clear Filter
          </Button>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <Input
            type="text"
            placeholder="Search by invoice, customer, fabric, or worker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-950 border-gray-700 text-white"
          />
        </div>
      </div>

      {/* DEPARTMENT DETAIL TABLE */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">
            {selectedDepartment ? `${selectedDepartment} Department Orders` : 'All Active Orders'}
          </h2>
          <Button
            size="sm"
            onClick={() => setCurrentView('studio-sales-list-new')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            View Full List
          </Button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-950 border-b border-gray-800">
              <tr>
                <th className="p-4 text-left text-gray-400 font-medium">Invoice No</th>
                <th className="p-4 text-left text-gray-400 font-medium">Customer</th>
                <th className="p-4 text-left text-gray-400 font-medium">Fabric</th>
                <th className="p-4 text-left text-gray-400 font-medium">Current Stage</th>
                <th className="p-4 text-left text-gray-400 font-medium">Assigned Worker</th>
                <th className="p-4 text-center text-gray-400 font-medium">Expected Date</th>
                <th className="p-4 text-center text-gray-400 font-medium">Status</th>
                <th className="p-4 text-center text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="mt-2">Loading studio orders...</p>
                  </td>
                </tr>
              ) : searchFilteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              ) : searchFilteredOrders.map(order => (
                <tr key={order.rowKey} className="hover:bg-gray-800/50">
                  <td className="p-4">
                    <p className="text-white font-medium">{order.invoiceNo}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-white">{order.customerName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{order.customerPhone}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-gray-400" />
                      <p className="text-gray-300">{order.fabricName}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        order.currentStage === 'Ready for Production' && "bg-cyan-500/20 text-cyan-400 border-cyan-700",
                        order.currentStage === 'Dyeing' && "bg-purple-500/20 text-purple-400 border-purple-700",
                        order.currentStage === 'Handwork' && "bg-blue-500/20 text-blue-400 border-blue-700",
                        order.currentStage === 'Stitching' && "bg-green-500/20 text-green-400 border-green-700",
                        order.currentStage === 'Completed' && "bg-orange-500/20 text-orange-400 border-orange-700"
                      )}
                    >
                      {order.currentStage}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <p className="text-gray-300">{order.assignedWorker}</p>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-yellow-400">
                      <Clock size={12} />
                      <p className="text-xs">{order.expectedDate}</p>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <Badge
                      variant="outline"
                      className="bg-blue-500/20 text-blue-400 border-blue-700 text-xs"
                    >
                      {order.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudioSaleId?.(order.id);
                          setCurrentView('studio-sale-detail-new');
                        }}
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
                      >
                        View Sale
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudioSaleId?.(order.id);
                          setCurrentView('studio-production-add');
                        }}
                        className="border-cyan-600 text-cyan-400 hover:bg-cyan-900/30 text-xs"
                      >
                        Shift to Production
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudioSaleId?.(order.id);
                          setCurrentView('studio-production-test');
                        }}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs"
                      >
                        Send to Studio (Test)
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK STATS – from real data */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Package size={18} className="text-cyan-400" />
            <p className="text-sm text-gray-400">Ready for Production</p>
          </div>
          <p className="text-2xl font-bold text-white">{departmentCounts.readyForProduction}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={18} className="text-green-400" />
            <p className="text-sm text-gray-400">Total Studio Orders</p>
          </div>
          <p className="text-2xl font-bold text-white">{orders.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 size={18} className="text-blue-400" />
            <p className="text-sm text-gray-400">Completed</p>
          </div>
          <p className="text-2xl font-bold text-white">{departmentCounts.completed}</p>
        </div>
      </div>
    </div>
  );
};
