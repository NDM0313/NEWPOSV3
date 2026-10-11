/**
 * Offline sync helpers for pending `purchase` records (create vs cancel).
 */
import * as purchasesApi from '../api/purchases';
import type { CreatePurchaseInput } from '../api/purchases';
import type { PendingRecord, PurchasePendingPayload } from './offlineStore';

export async function syncPurchasePending(
  record: PendingRecord
): Promise<{ serverId: string } | { error: string }> {
  const raw = record.payload as PurchasePendingPayload;
  if (!raw || typeof raw !== 'object' || !('action' in raw)) {
    return { error: 'Invalid purchase pending payload' };
  }
  if (raw.action === 'cancel') {
    const { error } = await purchasesApi.cancelPurchase(raw.companyId, raw.purchaseId, {
      userId: raw.userId ?? null,
      reason: raw.reason ?? null,
    });
    if (error) return { error };
    return { serverId: raw.purchaseId };
  }
  if (raw.action !== 'create' || !raw.input || typeof raw.input !== 'object') {
    return { error: 'Invalid purchase create payload' };
  }
  const input = raw.input as unknown as CreatePurchaseInput;
  const { data, error } = await purchasesApi.createPurchase(input);
  if (error) return { error };
  if (!data?.id) return { error: 'Create returned no id' };
  return { serverId: data.id };
}
