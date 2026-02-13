/**
 * Studio Pipeline Page – Sirf Studio ki detail
 * Work done, Pending, Production pipeline + Edit button
 * Edit pe click → Sale form drawer open hota hai
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Loader2,
  Edit2,
  Package,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  RotateCw,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioService } from '@/app/services/studioService';
import { saleService } from '@/app/services/saleService';
import { studioProductionService } from '@/app/services/studioProductionService';
import { cn } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { format } from 'date-fns';
import { toast } from 'sonner';

type ProductionStatus = 'Not Started' | 'In Progress' | 'Completed';

interface StudioItem {
  id: string;
  invoiceNo: string;
  customerName: string;
  fabricSummary: string;
  meters: number;
  saleDate: string;
  deliveryDeadline: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  productionStatus: ProductionStatus;
  source: 'studio_order' | 'sale';
}

function formatDateSafe(value: string | undefined | null, fmt: string): string {
  if (value == null || String(value).trim() === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return format(d, fmt);
  } catch {
    return '—';
  }
}

export const StudioPipelinePage = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [sales, setSales] = useState<StudioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const deriveProductionStatus = useCallback((stages: Array<{ status?: string }>): ProductionStatus => {
    if (!stages || stages.length === 0) return 'Not Started';
    const allCompleted = stages.every((s: any) => s.status === 'completed');
    if (allCompleted) return 'Completed';
    const anyInProgress = stages.some((s: any) => s.status === 'in_progress' || s.status === 'completed');
    return anyInProgress ? 'In Progress' : 'Not Started';
  }, []);

  const convertFromOrder = useCallback((order: any): StudioItem => {
    let status: ProductionStatus = 'Not Started';
    if (['pending', 'in_progress', 'completed', 'cancelled'].includes(order.status)) {
      status = order.status === 'completed' ? 'Completed' : order.status === 'in_progress' ? 'In Progress' : 'Not Started';
    }
    return {
      id: order.id || '',
      invoiceNo: order.order_no || `ORD-${order.id?.slice(0, 8)}`,
      customerName: order.customer?.name || order.customer_name || 'Unknown',
      fabricSummary: (order.items?.[0]?.item_description) || 'N/A',
      meters: (order.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0),
      saleDate: order.order_date || '',
      deliveryDeadline: order.delivery_date || order.actual_delivery_date || '',
      totalAmount: Number(order.total_cost) || 0,
      paidAmount: Number(order.advance_paid) || 0,
      balanceDue: Number(order.balance_due) || 0,
      productionStatus: status,
      source: 'studio_order',
    };
  }, []);

  const convertFromSale = useCallback((sale: any, stages?: Array<{ status?: string }>): StudioItem => {
    const items = sale.items || [];
    const productionStatus = stages ? deriveProductionStatus(stages) : 'Not Started';
    return {
      id: sale.id || '',
      invoiceNo: sale.invoice_no || sale.invoiceNo || `STD-${sale.id?.slice(0, 8)}`,
      customerName: sale.customer_name || sale.customer?.name || 'Unknown',
      fabricSummary: items.length > 0 ? (items[0].product_name || items[0].item_description || 'N/A') : 'N/A',
      meters: items.reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0),
      saleDate: sale.invoice_date || sale.invoiceDate || '',
      deliveryDeadline: sale.notes || '',
      totalAmount: Number(sale.total) || 0,
      paidAmount: Number(sale.paid_amount) || 0,
      balanceDue: Number(sale.due_amount) ?? 0,
      productionStatus,
      source: 'sale',
    };
  }, [deriveProductionStatus]);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const effectiveBranchId = branchId === 'all' ? undefined : branchId || undefined;
      const [orders, studioSalesFromSales] = await Promise.all([
        studioService.getAllStudioOrders(companyId, effectiveBranchId),
        saleService.getStudioSales(companyId, effectiveBranchId).catch(() => []),
      ]);
      const fromOrders = orders.map(convertFromOrder);

      const saleIds = (studioSalesFromSales || []).map((s: any) => s.id).filter(Boolean);
      const stagesBySaleId: Record<string, Array<{ status?: string }>> = {};
      if (saleIds.length > 0) {
        try {
          const allProductions = await studioProductionService.getProductions(companyId, effectiveBranchId);
          const productionsBySale = allProductions.filter((p: any) => p.sale_id && saleIds.includes(p.sale_id));
          for (const saleId of saleIds) {
            const prod = productionsBySale.find((p: any) => p.sale_id === saleId);
            if (prod?.id) {
              const stages = await studioProductionService.getStagesByProductionId(prod.id);
              stagesBySaleId[saleId] = stages || [];
            }
          }
        } catch (_) {}
      }
      const fromSales = (studioSalesFromSales || []).map((sale: any) =>
        convertFromSale(sale, stagesBySaleId[sale.id])
      );
      setSales([...fromOrders, ...fromSales]);
    } catch (e) {
      console.error('[StudioPipeline] Error loading:', e);
      toast.error('Failed to load studio pipeline');
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromOrder, convertFromSale]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onFocusRefetch = useCallback(() => {
    if (companyId) loadData();
  }, [companyId, loadData]);
  useEffect(() => {
    window.addEventListener('focus', onFocusRefetch);
    return () => window.removeEventListener('focus', onFocusRefetch);
  }, [onFocusRefetch]);

  useEffect(() => {
    const onSaved = () => loadData();
    window.addEventListener('studio-production-saved', onSaved);
    return () => window.removeEventListener('studio-production-saved', onSaved);
  }, [loadData]);

  const handleOpenDetail = (item: StudioItem) => {
    setSelectedStudioSaleId?.(item.id);
    setCurrentView('studio-sale-detail-new');
  };

  const notStarted = sales.filter(s => s.productionStatus === 'Not Started');
  const inProgress = sales.filter(s => s.productionStatus === 'In Progress');
  const completed = sales.filter(s => s.productionStatus === 'Completed');

  const getDeadlineAlert = (deadline: string, status: ProductionStatus) => {
    if (status === 'Completed' || !deadline) return null;
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 3) return 'near';
    return null;
  };

  const PipelineCard = ({ item }: { item: StudioItem }) => {
    const alert = getDeadlineAlert(item.deliveryDeadline, item.productionStatus);
    return (
      <div
        onClick={() => handleOpenDetail(item)}
        className={cn(
          "rounded-xl border p-4 cursor-pointer transition-all hover:border-gray-600 bg-gray-900/80",
          alert === 'overdue' && "border-red-700/50 bg-red-950/20",
          alert === 'near' && "border-yellow-700/50 bg-yellow-950/10"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-mono font-bold text-white text-sm">{item.invoiceNo}</p>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(item);
            }}
            title="Open Production – Edit tasks, assign workers"
          >
            <Edit2 size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
          <User size={14} className="text-gray-500 shrink-0" />
          {item.customerName}
        </div>
        <div className="text-xs text-gray-500 mb-2">{item.fabricSummary} • {item.meters}m</div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Calendar size={12} />
          Deadline: {formatDateSafe(item.deliveryDeadline, 'dd MMM yyyy')}
          {alert === 'overdue' && <AlertTriangle size={12} className="text-red-400" />}
          {alert === 'near' && <Clock size={12} className="text-yellow-400" />}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">{formatCurrency(item.totalAmount)}</span>
          {item.balanceDue > 0 && (
            <span className="text-orange-400 font-medium">Due: {formatCurrency(item.balanceDue)}</span>
          )}
        </div>
      </div>
    );
  };

  const PipelineColumn = ({
    title,
    icon: Icon,
    count,
    items,
    colorClass,
  }: {
    title: string;
    icon: React.ElementType;
    count: number;
    items: StudioItem[];
    colorClass: string;
  }) => (
    <div className="flex flex-col min-w-[280px] max-w-[320px]">
      <div className={cn("flex items-center gap-2 mb-4 px-3 py-2 rounded-lg", colorClass)}>
        <Icon size={20} />
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="outline" className="ml-auto text-xs">{count}</Badge>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-280px)]">
        {items.map((item) => (
          <PipelineCard key={`${item.source}-${item.id}`} item={item} />
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">No items</div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => setCurrentView('studio-sales-list-new')}
          >
            <ChevronLeft size={20} className="mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Studio Production Pipeline</h1>
            <p className="text-sm text-gray-400 mt-0.5">Work done, pending, aur production stages – Edit button se sale form open</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData()}
          disabled={loading}
          className="border-gray-600 text-gray-300 hover:bg-gray-800"
        >
          {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <RotateCw size={16} className="mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Circle size={16} />
            Not Started
          </div>
          <p className="text-2xl font-bold text-white">{notStarted.length}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-400 text-sm mb-1">
            <Clock size={16} />
            In Progress
          </div>
          <p className="text-2xl font-bold text-white">{inProgress.length}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
            <CheckCircle2 size={16} />
            Completed
          </div>
          <p className="text-2xl font-bold text-white">{completed.length}</p>
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        <PipelineColumn
          title="Not Started"
          icon={Circle}
          count={notStarted.length}
          items={notStarted}
          colorClass="bg-gray-800/50 text-gray-400"
        />
        <PipelineColumn
          title="In Progress"
          icon={Clock}
          count={inProgress.length}
          items={inProgress}
          colorClass="bg-blue-500/20 text-blue-400"
        />
        <PipelineColumn
          title="Completed"
          icon={CheckCircle2}
          count={completed.length}
          items={completed}
          colorClass="bg-green-500/20 text-green-400"
        />
      </div>
    </div>
  );
};
