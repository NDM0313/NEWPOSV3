import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { saleService } from '@/app/services/saleService';
import { studioProductionService } from '@/app/services/studioProductionService';
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
  Search,
  X,
  User,
  Calendar,
  DollarSign,
  MoreVertical,
  FileText,
  Phone
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useNavigation } from '@/app/context/NavigationContext';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

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
        "bg-gray-900/60 border border-gray-800 rounded-2xl p-6 cursor-pointer transition-all hover:border-gray-700 shadow-sm group",
        "hover:shadow-lg hover:-translate-y-1"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center",
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

const stageTypeToLabel = (t: string) => t === 'dyer' ? 'Dyeing' : t === 'handwork' ? 'Handwork' : t === 'stitching' ? 'Stitching' : t;
const stageTypeIcon = (t: string) => t === 'dyer' ? Palette : t === 'handwork' ? Sparkles : Scissors;

/** Order Details dialog – Worker Detail inspired: header, graphical progress stepper, worker cost breakdown, financial summary. No Edit/Save. */
const OrderDetailsModal = ({
  orderId,
  onClose,
  onOpenProduction
}: {
  orderId: string;
  onClose: () => void;
  onOpenProduction: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await saleService.getSale(orderId);
        if (cancelled || !s?.id) return;
        setSale(s);
        const prods = await studioProductionService.getProductionsBySaleId(s.id);
        if (cancelled || !prods?.length) {
          setStages([]);
          return;
        }
        const st = await studioProductionService.getStagesByProductionId(prods[0].id);
        if (cancelled) return;
        setStages(st || []);
      } catch (e) {
        if (!cancelled) setSale(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const customerName = sale?.customer_name || sale?.customer?.name || '—';
  const customerPhone = sale?.customer?.phone || '';
  const invoiceNo = sale?.invoice_no || sale?.invoiceNo || orderId?.slice(0, 8) || '—';
  const items = sale?.items || [];
  const fabricName = items.length > 0 ? (items[0].product_name || items[0].item_description || 'Fabric') : '—';
  const totalBill = sale?.total != null ? Number(sale.total) : 0;
  const paidAmount = sale?.paid_amount != null ? Number(sale.paid_amount) : 0;
  const balanceDue = sale?.due_amount != null ? Number(sale.due_amount) : totalBill - paidAmount;
  const workerCostTotal = stages.reduce((sum: number, s: any) => sum + (Number(s?.cost) || 0), 0);
  const allCompleted = stages.length > 0 && stages.every((s: any) => s.status === 'completed');
  const anyInProgress = stages.some((s: any) => s.status === 'in_progress' || s.status === 'completed');
  const derivedStatus = allCompleted ? 'Completed' : anyInProgress ? 'In Progress' : 'Pending';
  const expectedDelivery = sale?.notes || (stages.length > 0
    ? stages.map((s: any) => s.expected_completion_date).filter(Boolean).pop()
    : null) || '—';
  const expectedDeliveryFormatted = expectedDelivery && expectedDelivery !== '—'
    ? (() => { try { return format(new Date(expectedDelivery), 'dd MMM yyyy'); } catch { return String(expectedDelivery).slice(0, 10); } })()
    : '—';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-white">Order details</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-gray-500">Loading…</div>
          ) : !sale ? (
            <div className="py-12 text-center text-gray-500">Order not found</div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Invoice</p>
                    <p className="text-lg font-bold text-white mt-0.5">{invoiceNo}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs shrink-0',
                      derivedStatus === 'Completed' && 'bg-green-500/20 text-green-400 border-green-700',
                      derivedStatus === 'In Progress' && 'bg-blue-500/20 text-blue-400 border-blue-700',
                      derivedStatus === 'Pending' && 'bg-gray-500/20 text-gray-400 border-gray-700'
                    )}
                  >
                    {derivedStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-gray-500 shrink-0" />
                  <div>
                    <p className="text-white font-medium">{customerName}</p>
                    {customerPhone && (
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {customerPhone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package size={14} className="text-gray-500 shrink-0" />
                  <p className="text-gray-300">{fabricName}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-gray-500 shrink-0" />
                  <p className="text-gray-400">Expected delivery: <span className="text-white">{expectedDeliveryFormatted}</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                  <div>
                    <p className="text-xs text-gray-500">Total bill</p>
                    <p className="text-white font-semibold">Rs {totalBill.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Balance due</p>
                    <p className={cn('font-semibold', balanceDue > 0 ? 'text-orange-400' : 'text-green-400')}>
                      Rs {balanceDue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Production progress – graphical stepper */}
              <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-cyan-400" />
                  Production progress
                </h4>
                {stages.length === 0 ? (
                  <p className="text-gray-400 text-sm">No stages yet</p>
                ) : (
                  <div className="space-y-3">
                    {stages.map((s: any, i: number) => {
                      const Icon = stageTypeIcon(s.stage_type);
                      const isCompleted = s.status === 'completed';
                      const isInProgress = s.status === 'in_progress';
                      const isPending = s.status === 'pending';
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-lg border',
                            isCompleted && 'bg-green-500/10 border-green-700/50',
                            isInProgress && 'bg-amber-500/10 border-amber-700/50',
                            isPending && 'bg-gray-800/50 border-gray-700'
                          )}
                        >
                          <div className={cn(
                            'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                            isCompleted && 'bg-green-500/20 text-green-400',
                            isInProgress && 'bg-amber-500/20 text-amber-400',
                            isPending && 'bg-gray-700 text-gray-500'
                          )}>
                            {isCompleted ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-medium',
                              isCompleted && 'text-green-400',
                              isInProgress && 'text-amber-400',
                              isPending && 'text-gray-400'
                            )}>
                              {stageTypeToLabel(s.stage_type)}
                              {isCompleted && ' ✔'}
                              {isInProgress && ' ⏳'}
                              {isPending && ' Pending'}
                            </p>
                            {(s.worker?.name || s.expected_completion_date || s.cost != null) && (
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                {s.worker?.name && <p>Assigned: {s.worker.name}</p>}
                                {s.expected_completion_date && <p>ETA: {String(s.expected_completion_date).slice(0, 10)}</p>}
                                {s.cost != null && s.cost > 0 && <p>Cost: Rs {Number(s.cost).toLocaleString()}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Worker cost breakdown */}
              <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <User size={16} className="text-cyan-400" />
                  Worker cost breakdown
                </h4>
                {stages.length === 0 ? (
                  <p className="text-gray-400 text-sm">No stages</p>
                ) : (
                  <div className="space-y-3">
                    {stages.map((s: any) => {
                      const fmt = (d: string | undefined) => d ? (() => { try { return format(new Date(d), 'dd MMM yyyy'); } catch { return null; } })() : null;
                      const assignedDate = s.assigned_worker_id && s.updated_at ? fmt(s.updated_at) : (s.created_at ? fmt(s.created_at) : null);
                      const completedDate = fmt(s.completed_at);
                      return (
                        <div key={s.id} className="border-b border-gray-800 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-300 font-medium">{stageTypeToLabel(s.stage_type)}</span>
                            <span className="text-white font-medium">Rs {(Number(s.cost) || 0).toLocaleString()}</span>
                            <Badge variant="outline" className={cn(
                              'text-[10px]',
                              s.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-700' : 'bg-gray-500/20 text-gray-400 border-gray-700'
                            )}>
                              {s.status === 'completed' ? 'Payable' : '—'}
                            </Badge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                            <span>Assigned: {assignedDate || '—'}</span>
                            <span>Completed: {completedDate || '—'}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between font-semibold text-white pt-2 border-t border-gray-700">
                      <span>Total worker cost</span>
                      <span>Rs {workerCostTotal.toLocaleString()}</span>
                    </div>
                    <div className="pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onOpenProduction}
                        className="w-full border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 text-xs"
                      >
                        Record / Edit worker payment
                      </Button>
                      <p className="text-[10px] text-gray-500 mt-1.5 text-center">Opens Production page to record or edit worker payments</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial summary – more detail */}
              <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <DollarSign size={16} className="text-cyan-400" />
                  Financial summary
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Customer bill (total)</span>
                    <span className="text-white">Rs {totalBill.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Paid by customer</span>
                    <span className="text-green-400">Rs {paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Balance due (customer)</span>
                    <span className={balanceDue <= 0 ? 'text-green-400' : 'text-orange-400'}>
                      Rs {balanceDue.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-800">
                    <span className="text-gray-400">Worker cost total</span>
                    <span className="text-white">Rs {workerCostTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Net margin (bill − worker cost)</span>
                    <span className={totalBill - workerCostTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                      Rs {(totalBill - workerCostTotal).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-800">
                    <span className="text-gray-400">Customer payment status</span>
                    <span className={balanceDue <= 0 ? 'text-green-400' : 'text-orange-400'}>
                      {balanceDue <= 0 ? 'Paid' : 'Rs ' + balanceDue.toLocaleString() + ' due'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Worker payment</span>
                    <span className="text-gray-400 text-xs">
                      {stages.filter((s: any) => s.status === 'completed').length > 0 ? 'Payable (record in Accounting)' : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions – no Edit/Save */}
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={onOpenProduction} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                  Open Production
                </Button>
                <Button onClick={onClose} variant="outline" className="w-full border-gray-700 text-gray-300">
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const StudioDashboardNew = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [orders, setOrders] = useState<StudioOrderDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusDetailOrderId, setStatusDetailOrderId] = useState<string | null>(null);

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

  // Map stage_type (DB) to display label
  const stageTypeToLabel = (stageType: string): string => {
    if (stageType === 'dyer') return 'Dyeing';
    if (stageType === 'handwork') return 'Handwork';
    if (stageType === 'stitching') return 'Stitching';
    return stageType || 'Stage';
  };

  // Derive current stage, worker, status, expected date from studio_production_stages (DB-driven)
  const deriveFromStages = useCallback((
    stages: Array<{ stage_type: string; status?: string; assigned_worker_id?: string | null; expected_completion_date?: string | null; worker?: { name?: string } }>,
    saleDeadline: string
  ): { currentStage: string; assignedWorker: string; status: string; expectedDate: string } => {
    if (!stages || stages.length === 0) {
      return { currentStage: 'Ready for Production', assignedWorker: 'Unassigned', status: 'Pending', expectedDate: saleDeadline || '—' };
    }
    // Stages already in created_at order (dyer → handwork → stitching)
    const active = stages.find((s: any) => s.status === 'pending' || s.status === 'in_progress');
    const allCompleted = stages.every((s: any) => s.status === 'completed');
    if (allCompleted) {
      return { currentStage: 'Completed', assignedWorker: '—', status: 'Completed', expectedDate: '—' };
    }
    if (active) {
      const workerName = (active as any).worker?.name;
      const expected = active.expected_completion_date || saleDeadline || '—';
      const status = active.status === 'in_progress' || stages.some((s: any) => s.status === 'completed') ? 'In Progress' : 'Pending';
      return {
        currentStage: stageTypeToLabel(active.stage_type),
        assignedWorker: (active.assigned_worker_id && workerName) ? workerName : 'Unassigned',
        status,
        expectedDate: expected,
      };
    }
    return { currentStage: 'Ready for Production', assignedWorker: 'Unassigned', status: 'Pending', expectedDate: saleDeadline || '—' };
  }, []);

  // Convert sale + productions/stages to display format (fully DB-driven)
  const convertSaleToDisplay = useCallback(async (sale: any): Promise<StudioOrderDisplay> => {
    const items = sale.items || [];
    const firstItem = items[0];
    const customer = sale.customer || {};
    const saleDeadline = sale.notes || ''; // sale deadline / expected date when no stage
    let stages: any[] = [];
    try {
      const productions = await studioProductionService.getProductionsBySaleId(sale.id);
      if (productions && productions.length > 0) {
        stages = await studioProductionService.getStagesByProductionId(productions[0].id);
      }
    } catch (_) { /* no production yet */ }
    const { currentStage, assignedWorker, status, expectedDate } = deriveFromStages(stages, saleDeadline);
    const formatExpected = (v: string) => {
      if (!v || v === '—') return '—';
      if (v.includes('T')) return v.slice(0, 10); // ISO → YYYY-MM-DD
      return v;
    };
    return {
      id: sale.id,
      rowKey: `sale_${sale.id}`,
      invoiceNo: sale.invoice_no || `STD-${sale.id?.slice(0, 8) || ''}`,
      customerName: sale.customer_name || customer.name || '',
      customerPhone: customer.phone || '',
      fabricName: firstItem?.product_name || firstItem?.product?.name || 'Sale items',
      currentStage,
      assignedWorker,
      expectedDate: formatExpected(expectedDate && expectedDate !== '—' ? expectedDate : (saleDeadline || '—')),
      status,
      source: 'sale',
    };
  }, [deriveFromStages]);

  // Load studio orders + studio sales with real production/stage data from DB
  const loadStudioOrders = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [studioOrdersData, studioSalesData] = await Promise.all([
        studioService.getAllStudioOrders(companyId, branchId === 'all' ? undefined : branchId || undefined),
        saleService.getStudioSales(companyId, branchId === 'all' ? undefined : branchId || undefined).catch(() => []),
      ]);
      const fromOrders = (studioOrdersData || []).map(convertFromSupabaseOrder);
      const fromSales = await Promise.all((studioSalesData || []).map((sale: any) => convertSaleToDisplay(sale)));
      setOrders([...fromOrders, ...fromSales]);
    } catch (error) {
      console.error('[STUDIO DASHBOARD] Error loading studio orders:', error);
      toast.error('Failed to load studio orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseOrder, convertSaleToDisplay]);

  // Load orders on mount and when returning to dashboard (refetch so data is fresh)
  useEffect(() => {
    if (companyId) loadStudioOrders();
    else setLoading(false);
  }, [companyId, loadStudioOrders]);

  // Refetch when user returns to this view (e.g. after saving on detail page)
  const onFocusRefetch = useCallback(() => {
    if (companyId) loadStudioOrders();
  }, [companyId, loadStudioOrders]);
  useEffect(() => {
    window.addEventListener('focus', onFocusRefetch);
    return () => window.removeEventListener('focus', onFocusRefetch);
  }, [onFocusRefetch]);

  // Calculate department counts
  const departmentCounts = {
    readyForProduction: orders.filter(o => o.currentStage === 'Ready for Production').length,
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
    <div className="space-y-6 p-4 sm:p-6 min-h-0">
      {/* HEADER - Figma: clean bar */}
      <div className="pb-2 border-b border-gray-800/80">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">Studio Production Dashboard</h1>
        <p className="text-sm text-gray-400">Department-wise order tracking</p>
      </div>

      {/* DEPARTMENT CARDS – studio sales (Ready for Production) + department-wise */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
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
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 shadow-sm">
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

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
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
                      className={cn(
                        "text-xs",
                        order.status === 'Completed' && "bg-green-500/20 text-green-400 border-green-700",
                        order.status === 'In Progress' && "bg-blue-500/20 text-blue-400 border-blue-700",
                        order.status === 'Pending' && "bg-gray-500/20 text-gray-400 border-gray-700"
                      )}
                    >
                      {order.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudioSaleId?.(order.id);
                          setCurrentView('studio-sale-detail-new');
                        }}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs"
                      >
                        <Package size={14} className="mr-1.5" />
                        Open Production
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white min-w-[180px]">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusDetailOrderId(order.id);
                            }}
                            className="text-gray-300 focus:bg-gray-800 focus:text-white cursor-pointer"
                          >
                            <FileText size={14} className="mr-2" />
                            View Order Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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

      {/* Order Details modal – opened by status badge click or Action → View Order Details */}
      {statusDetailOrderId && (
        <OrderDetailsModal
          orderId={statusDetailOrderId}
          onClose={() => setStatusDetailOrderId(null)}
          onOpenProduction={() => {
            setSelectedStudioSaleId?.(statusDetailOrderId);
            setCurrentView('studio-sale-detail-new');
            setStatusDetailOrderId(null);
          }}
        />
      )}
    </div>
  );
};
