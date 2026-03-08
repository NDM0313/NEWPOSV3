/**
 * Studio Production V3 Dashboard (Safe Zone)
 * Shown when feature_flags.studio_production_v3 is enabled.
 * Uses only studioProductionV3Service and V3 tables.
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioProductionV3Service, ensureStudioProductionV3OrdersForCompany } from '@/app/services/studioProductionV3Service';
import type { StudioProductionOrderV3 } from '@/app/services/studioProductionV3Service';

export const StudioProductionV3Dashboard = () => {
  const { setCurrentView, setSelectedStudioOrderIdV3 } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [orders, setOrders] = useState<StudioProductionOrderV3[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    ensureStudioProductionV3OrdersForCompany(companyId, branchId ?? null)
      .then(() => studioProductionV3Service.getOrdersByCompany(companyId, branchId ?? undefined))
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

  const openOrder = (orderId: string) => {
    setSelectedStudioOrderIdV3?.(orderId);
    setCurrentView('studio-order-detail-v3');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentView('studio-sales-list-new')}
          className="text-gray-400 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Studio Production V3</h1>
          <p className="text-sm text-gray-400">Stages, cost breakdown, invoice panel</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
          <p className="text-gray-400 mb-2">
            Production orders (V3): <span className="font-medium text-white">{orders.length}</span>
          </p>
          <ul className="space-y-2">
            {orders.slice(0, 10).map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openOrder(o.id)}
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white text-left"
                >
                  <Package className="h-4 w-4 text-emerald-500 shrink-0" />
                  {o.production_no} — <span className="text-gray-500">{o.status}</span>
                </button>
              </li>
            ))}
            {orders.length === 0 && (
              <li className="text-gray-500">No V3 orders yet. Studio sales (STD-*) will appear here.</li>
            )}
          </ul>
          <Button
            variant="outline"
            className="mt-4 border-emerald-600 text-emerald-200"
            onClick={() => setCurrentView('studio-pipeline')}
          >
            Open Pipeline
          </Button>
        </div>
      )}
    </div>
  );
};
