/**
 * Wholesale import: clearance paid to courier vs supplier goods payable.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Truck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { shipmentAccountingService } from '@/app/services/shipmentAccountingService';
import { courierService } from '@/app/services/courierService';
import { purchaseService } from '@/app/services/purchaseService';
import {
  isWholesaleImportClearance,
  purchaseClearanceAmount,
  purchaseSupplierDue,
  purchaseSupplierPayableBase,
} from '@/app/wholesale/wholesaleImportPurchase';
import type { Purchase } from '@/app/context/PurchaseContext';
import { toast } from 'sonner';

export interface WholesaleImportClearanceWorkflowProps {
  purchase: Purchase;
  companyId: string;
  formatCurrency: (n: number) => string;
  onUpdated?: () => void;
}

export const WholesaleImportClearanceWorkflow: React.FC<WholesaleImportClearanceWorkflowProps> = ({
  purchase,
  companyId,
  formatCurrency,
  onUpdated,
}) => {
  const [couriers, setCouriers] = useState<Array<{ id: string; contactId: string; name: string }>>([]);
  const [courierId, setCourierId] = useState<string>(purchase.clearanceCourierId ?? '');
  const [courierPaid, setCourierPaid] = useState<number | null>(null);
  const [courierBalance, setCourierBalance] = useState<number | null>(null);
  const [courierName, setCourierName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const clearanceAmount = purchaseClearanceAmount(purchase);
  const supplierPayable = purchaseSupplierPayableBase(purchase);
  const supplierDue = purchaseSupplierDue(purchase);
  const clearanceMode = isWholesaleImportClearance(purchase) || purchase.freightSettlement === 'courier';

  const loadCourierStatus = useCallback(async () => {
    const cid = purchase.clearanceCourierId || courierId;
    if (!companyId || !cid) return;
    setLoading(true);
    try {
      const balances = await shipmentAccountingService.getCourierBalances(companyId);
      const row = balances.find((b) => b.courier_id === cid);
      if (row) {
        setCourierName(row.courier_name || '');
        setCourierPaid(Number(row.total_paid) || 0);
        setCourierBalance(Number(row.balance) || 0);
      } else {
        const ledger = await shipmentAccountingService.getCourierLedger(companyId, cid, { limit: 50 });
        const paid = ledger
          .filter((r: { entry_kind?: string }) => String(r.entry_kind || '').toLowerCase() === 'payment')
          .reduce((s: number, r: { debit?: number }) => s + (Number(r.debit) || 0), 0);
        setCourierPaid(paid);
        setCourierBalance(Math.max(0, clearanceAmount - paid));
        setCourierName((ledger[0] as { courier_name?: string } | undefined)?.courier_name || '');
      }
    } catch (e) {
      console.warn('[WholesaleImportClearance]', e);
    } finally {
      setLoading(false);
    }
  }, [companyId, purchase.clearanceCourierId, courierId, clearanceAmount]);

  useEffect(() => {
    if (!companyId) return;
    courierService.getByCompanyId(companyId).then((list) => {
      setCouriers(
        list.map((c) => ({
          id: c.id,
          contactId: c.contact_id || c.id,
          name: c.name,
        }))
      );
    });
  }, [companyId]);

  useEffect(() => {
    if (purchase.clearanceCourierId) setCourierId(purchase.clearanceCourierId);
  }, [purchase.clearanceCourierId]);

  useEffect(() => {
    if (clearanceMode && (purchase.clearanceCourierId || courierId)) {
      void loadCourierStatus();
    }
  }, [clearanceMode, purchase.clearanceCourierId, courierId, loadCourierStatus]);

  const handleSaveCourierLink = async () => {
    if (!purchase.id || !courierId) {
      toast.error('Select a clearance courier');
      return;
    }
    setSaving(true);
    try {
      await purchaseService.updatePurchase(purchase.id, {
        freight_settlement: 'courier',
        clearance_courier_id: courierId,
      } as any);
      toast.success('Clearance courier linked');
      onUpdated?.();
      void loadCourierStatus();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save courier link');
    } finally {
      setSaving(false);
    }
  };

  if (clearanceAmount <= 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="text-amber-400" size={18} />
        <h3 className="text-sm font-semibold text-amber-200 uppercase tracking-wide">
          Wholesale import clearance
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3">
          <p className="text-gray-400 mb-1">Supplier goods payable</p>
          <p className="text-white font-semibold">{formatCurrency(supplierPayable)}</p>
          <p className="text-gray-500 text-xs mt-1">Excludes clearance / freight</p>
        </div>
        <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3">
          <p className="text-gray-400 mb-1">Supplier due</p>
          <p className={`font-bold text-lg ${supplierDue > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatCurrency(supplierDue)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3">
          <p className="text-gray-400 mb-1">Clearance (courier)</p>
          <p className="text-amber-300 font-semibold">{formatCurrency(clearanceAmount)}</p>
          {courierName && <p className="text-gray-500 text-xs mt-1">{courierName}</p>}
        </div>
        <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-3">
          <p className="text-gray-400 mb-1">Clearance paid to courier</p>
          {loading ? (
            <Loader2 className="animate-spin text-gray-400" size={18} />
          ) : (
            <>
              <p className="text-green-400 font-semibold">{formatCurrency(courierPaid ?? 0)}</p>
              {(courierBalance ?? 0) <= 0.01 ? (
                <p className="text-green-500/80 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Clearance settled
                </p>
              ) : (
                <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Balance {formatCurrency(courierBalance ?? 0)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {!purchase.clearanceCourierId && (
        <div className="space-y-2">
          <Label className="text-gray-400 text-xs">Link clearance courier</Label>
          <div className="flex flex-wrap gap-2">
            <select
              className="flex-1 min-w-[200px] bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white"
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
            >
              <option value="">Select courier…</option>
              {couriers.map((c) => (
                <option key={c.contactId} value={c.contactId}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={saving || !courierId} onClick={() => void handleSaveCourierLink()}>
              {saving ? <Loader2 className="animate-spin" size={14} /> : 'Save'}
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Clearance is paid to the courier agent, not the goods supplier. Supplier payments apply to goods only.
          </p>
        </div>
      )}
    </div>
  );
};
