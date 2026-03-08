/**
 * Studio Production V2 Dashboard (Safe Zone)
 * Shown when feature_flags.studio_production_v2 is enabled.
 * Uses studioProductionV2Service only. Legacy service untouched.
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { studioProductionV2Service, ensureStudioProductionV2OrdersForCompany } from '@/app/services/studioProductionV2Service';
import type { StudioProductionOrderV2 } from '@/app/services/studioProductionV2Service';

export const StudioProductionV2Dashboard = () => {
  const { setCurrentView, setSelectedStudioSaleId } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const [orders, setOrders] = useState<StudioProductionOrderV2[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    ensureStudioProductionV2OrdersForCompany(companyId, branchId ?? null)
      .then(() => studioProductionV2Service.getOrdersByCompany(companyId, branchId ?? undefined))
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

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
          <h1 className="text-2xl font-bold text-white">Studio Production V2</h1>
          <p className="text-sm text-gray-400">Advanced workflow (Safe Zone)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-4">
          <p className="text-gray-400 mb-2">
            Production orders (V2): <span className="font-medium text-white">{orders.length}</span>
          </p>
          <ul className="space-y-2">
            {orders.slice(0, 10).map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-2 text-sm text-gray-300"
              >
                <Package className="h-4 w-4 text-amber-500" />
                {o.production_no} — <span className="text-gray-500">{o.status}</span>
              </li>
            ))}
            {orders.length === 0 && (
              <li className="text-gray-500">No V2 orders yet. Create from a studio sale when ready.</li>
            )}
          </ul>
          <Button
            variant="outline"
            className="mt-4 border-amber-600 text-amber-200"
            onClick={() => setCurrentView('studio-pipeline')}
          >
            Open Pipeline
          </Button>
        </div>
      )}
    </div>
  );
};
