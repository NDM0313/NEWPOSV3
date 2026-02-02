import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Package, Loader2, FileText, Calendar, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useProduction } from '@/app/context/ProductionContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { cn } from '../ui/utils';
import type { StudioProduction, StudioProductionStatus } from '@/app/services/studioProductionService';

const statusConfig: Record<StudioProductionStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export const StudioProductionListPage = () => {
  const { setCurrentView, setSelectedProductionId, selectedStudioSaleId } = useNavigation();
  const { productions, loading, refreshProductions } = useProduction();
  const { companyId } = useSupabase();
  const [filterStatus, setFilterStatus] = useState<StudioProductionStatus | 'all'>('all');

  useEffect(() => {
    if (companyId) refreshProductions();
  }, [companyId, refreshProductions]);

  // Option A: When opened from Sale "View Production", show only productions for this sale
  const bySale = selectedStudioSaleId
    ? productions.filter((p: StudioProduction) => (p as any).sale_id === selectedStudioSaleId)
    : productions;
  const filtered = filterStatus === 'all'
    ? bySale
    : bySale.filter(p => p.status === filterStatus);

  const openDetail = (p: StudioProduction) => {
    setSelectedProductionId?.(p.id);
    setCurrentView('studio-production-detail');
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView(selectedStudioSaleId ? 'studio-sale-detail-new' : 'studio')} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {selectedStudioSaleId ? 'Productions for this sale' : 'Studio Production'}
            </h1>
            <p className="text-xs text-gray-500">Production jobs – draft → in progress → completed</p>
          </div>
        </div>
        <Button
          onClick={() => setCurrentView('studio-production-add')}
          className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
        >
          <Plus size={18} />
          Add Production Job
        </Button>
      </div>

      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2 shrink-0">
        {(['all', 'draft', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium',
              filterStatus === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:text-white'
            )}
          >
            {s === 'all' ? 'All' : statusConfig[s]?.label ?? s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Package size={48} className="mx-auto mb-3 opacity-50" />
            <p>No production jobs found</p>
            <Button variant="outline" className="mt-4" onClick={() => setCurrentView('studio-production-add')}>
              Add Production Job
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const product = (p as any).product;
              const worker = (p as any).worker;
              const cfg = statusConfig[p.status];
              return (
                <div
                  key={p.id}
                  onClick={() => openDetail(p)}
                  className={cn(
                    'flex items-center justify-between gap-4 p-4 rounded-xl border cursor-pointer transition-colors',
                    'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800/50'
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{p.production_no}</p>
                      <p className="text-sm text-gray-400 truncate">{product?.name ?? p.product_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm text-gray-400">{p.quantity} {p.unit}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar size={12} /> {p.production_date}
                    </span>
                    {worker?.name && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <User size={12} /> {worker.name}
                      </span>
                    )}
                    <Badge className={cn('text-xs border', cfg?.className)}>{cfg?.label ?? p.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
