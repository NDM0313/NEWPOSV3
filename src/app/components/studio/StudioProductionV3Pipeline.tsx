/**
 * Studio Production V3 Pipeline (Safe Zone)
 * Lists V3 orders; click opens order detail on same flow (no redirect to Sales).
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioProductionV3Service, ensureStudioProductionV3OrdersForCompany } from '@/app/services/studioProductionV3Service';
import type { StudioProductionOrderV3, StudioProductionStageV3 } from '@/app/services/studioProductionV3Service';

export const StudioProductionV3Pipeline = () => {
  const { setCurrentView, setSelectedStudioOrderIdV3 } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [orders, setOrders] = useState<(StudioProductionOrderV3 & { stages?: StudioProductionStageV3[] })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = () => {
    if (!companyId) return;
    studioProductionV3Service
      .getOrdersByCompany(companyId, branchId ?? undefined)
      .then(async (list) => {
        const withStages = await Promise.all(
          list.map(async (o) => {
            const stages = await studioProductionV3Service.getStagesByOrderId(o.id);
            return { ...o, stages };
          })
        );
        setOrders(withStages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    ensureStudioProductionV3OrdersForCompany(companyId, branchId ?? null)
      .then(() => {
        if (!cancelled) loadOrders();
      })
      .catch(() => {
        if (!cancelled) loadOrders();
      });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const openOrderDetail = (orderId: string) => {
    setSelectedStudioOrderIdV3?.(orderId);
    setCurrentView('studio-order-detail-v3');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentView('studio-dashboard-new')}
          className="text-gray-400 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Studio Production V3 Pipeline</h1>
          <p className="text-sm text-gray-400">Stages, workers, cost summary</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const allCompleted = o.stages?.length ? o.stages.every((s) => s.status === 'completed') : false;
            return (
              <div key={o.id} className="rounded-lg border border-gray-700/50 bg-gray-800/30 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-medium text-white">{o.production_no}</p>
                      <p className="text-sm text-gray-400">
                        Stages: {o.stages?.length ?? 0} — {allCompleted ? 'All completed' : 'In progress'}
                        {o.generated_invoice_id && ' · Invoice generated'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={o.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                      {o.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-600 text-emerald-200"
                      onClick={() => openOrderDetail(o.id)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <p className="text-gray-500 py-8 text-center">No V3 production orders. Studio sales (STD-*) create orders here.</p>
          )}
        </div>
      )}
    </div>
  );
};
