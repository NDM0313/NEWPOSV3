/**
 * Studio Production V2 Pipeline (Safe Zone)
 * Shown when feature_flags.studio_production_v2 is enabled.
 * Uses studioProductionV2Service only. Legacy service untouched.
 * When studio_customer_invoice_v1 is on, expanded row shows Customer Billing.
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, Loader2, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { studioProductionV2Service, ensureStudioProductionV2OrdersForCompany } from '@/app/services/studioProductionV2Service';
import type { StudioProductionOrderV2, StudioProductionStageV2 } from '@/app/services/studioProductionV2Service';
import { CustomerBillingCard } from './CustomerBillingCard';

export const StudioProductionV2Pipeline = () => {
  const { setCurrentView } = useNavigation();
  const { companyId, branchId } = useSupabase();
  const { featureFlags } = useSettings();
  const [orders, setOrders] = useState<(StudioProductionOrderV2 & { stages?: StudioProductionStageV2[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const showCustomerBilling = featureFlags?.studio_customer_invoice_v1 === true;

  const loadOrders = () => {
    if (!companyId) return;
    studioProductionV2Service
      .getOrdersByCompany(companyId, branchId ?? undefined)
      .then(async (list) => {
        const withStages = await Promise.all(
          list.map(async (o) => {
            const stages = await studioProductionV2Service.getStagesByOrderId(o.id);
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
    ensureStudioProductionV2OrdersForCompany(companyId, branchId ?? null)
      .then(() => {
        if (!cancelled) loadOrders();
      })
      .catch(() => {
        if (!cancelled) loadOrders();
      });
    return () => { cancelled = true; };
  }, [companyId, branchId]);

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
          <h1 className="text-2xl font-bold text-white">Studio Production V2 Pipeline</h1>
          <p className="text-sm text-gray-400">Advanced workflow (Safe Zone)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border border-gray-700/50 bg-gray-800/30 overflow-hidden">
              <button
                type="button"
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
              >
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-medium text-white">{o.production_no}</p>
                    <p className="text-sm text-gray-400">
                      Stages: {o.stages?.length ?? 0} — {o.stages?.every((s) => s.status === 'completed') ? 'Completed' : 'In progress'}
                      {o.customer_invoice_generated && ' · Invoice generated'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={o.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                    {o.status}
                  </Badge>
                  {expandedOrderId === o.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>
              {expandedOrderId === o.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-700/50">
                  {showCustomerBilling ? (
                    <CustomerBillingCard
                      orderId={o.id}
                      status={o.status}
                      customerInvoiceGenerated={o.customer_invoice_generated}
                      generatedSaleId={o.generated_sale_id}
                      productId={o.product_id}
                      companyId={companyId ?? undefined}
                      onInvoiceGenerated={loadOrders}
                      onProductCreated={loadOrders}
                    />
                  ) : (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mt-3">
                      <p className="text-sm text-amber-200/90 mb-2">
                        <strong>Customer Invoice</strong> — Generate sale invoice from this production after completion.
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        Enable <strong>Studio Customer Invoice</strong> in Settings → Modules → Developer to see Production Cost, Customer Price, and &quot;Generate Sale Invoice&quot; here.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-600 text-amber-200"
                        onClick={(e) => { e.stopPropagation(); setCurrentView('settings'); }}
                      >
                        Open Settings
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {orders.length === 0 && (
            <p className="text-gray-500 py-8 text-center">No V2 production orders. Enable from dashboard or studio sales.</p>
          )}
        </div>
      )}
    </div>
  );
};
