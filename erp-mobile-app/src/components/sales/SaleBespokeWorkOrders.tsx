import { useCallback, useEffect, useState } from 'react';
import { Loader2, Scissors } from 'lucide-react';
import {
  completeBespokeWorkOrder,
  createBespokeWorkOrder,
  listBespokeParentSaleItems,
  listBespokeWorkOrdersBySale,
  type BespokeWorkOrderRow,
} from '../../api/bespokeWorkOrders';
import { getContacts } from '../../api/contacts';

interface SaleBespokeWorkOrdersProps {
  companyId: string;
  branchId: string;
  saleId: string;
  userId: string;
  saleStatus: string;
}

export function SaleBespokeWorkOrders({
  companyId,
  branchId,
  saleId,
  userId,
  saleStatus,
}: SaleBespokeWorkOrdersProps) {
  const [orders, setOrders] = useState<BespokeWorkOrderRow[]>([]);
  const [parents, setParents] = useState<Array<{ id: string; product_name: string | null; sku: string | null }>>([]);
  const [tailors, setTailors] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parentItemId, setParentItemId] = useState('');
  const [tailorId, setTailorId] = useState('');
  const [cost, setCost] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wo, pi, contacts] = await Promise.all([
        listBespokeWorkOrdersBySale(saleId),
        listBespokeParentSaleItems(saleId),
        getContacts(companyId, 'supplier'),
      ]);
      setOrders(wo);
      setParents(pi);
      const workerList = (contacts.data ?? [])
        .filter((c) => c.id && c.name)
        .map((c) => ({ id: c.id!, name: c.name! }));
      setTailors(workerList);
      if (!parentItemId && pi[0]?.id) setParentItemId(pi[0].id);
      if (!tailorId && workerList[0]?.id) setTailorId(workerList[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }, [saleId, companyId, parentItemId, tailorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!parentItemId || !tailorId) {
      setError('Select dress line and worker.');
      return;
    }
    const productionCost = parseFloat(cost) || 0;
    if (productionCost <= 0) {
      setError('Production cost must be greater than 0.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBespokeWorkOrder({
        companyId,
        branchId,
        saleId,
        parentSalesItemId: parentItemId,
        tailorContactId: tailorId,
        productionCost,
        createdByAuthUserId: userId,
      });
      setCost('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (woId: string) => {
    setBusy(true);
    setError(null);
    try {
      await completeBespokeWorkOrder(woId, userId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setBusy(false);
    }
  };

  const posted = String(saleStatus).toLowerCase() === 'final';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Work orders…
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-violet-500/30 rounded-lg p-3 bg-gray-950/80">
      <div className="flex items-center gap-2 text-violet-300 text-sm font-medium">
        <Scissors size={16} /> Customization work orders
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {orders.length === 0 ? (
        <p className="text-xs text-gray-500">No work orders yet. Create one per custom dress line.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {orders.map((wo) => (
            <li key={wo.id} className="flex justify-between items-center gap-2 bg-gray-900 rounded px-2 py-1.5">
              <span>
                {wo.work_order_no} · {wo.status}
                {wo.tailor?.name ? ` · ${wo.tailor.name}` : ''}
              </span>
              {wo.status !== 'completed' && wo.status !== 'cancelled' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleComplete(wo.id)}
                  className="text-xs text-emerald-400 font-medium"
                >
                  Complete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!posted && parents.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-800">
          <select
            value={parentItemId}
            onChange={(e) => setParentItemId(e.target.value)}
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded text-sm text-white"
          >
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.product_name || p.sku || 'Custom').slice(0, 40)}
              </option>
            ))}
          </select>
          <select
            value={tailorId}
            onChange={(e) => setTailorId(e.target.value)}
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded text-sm text-white"
          >
            {tailors.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Production cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full h-9 bg-gray-900 border border-gray-700 rounded px-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreate()}
            className="w-full h-9 rounded bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Create work order
          </button>
        </div>
      )}
      {posted && (
        <p className="text-xs text-amber-500/90">Sale is final — new work orders are locked.</p>
      )}
    </div>
  );
}
