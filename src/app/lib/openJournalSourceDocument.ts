/**
 * Navigate from a journal row to its originating business document (UI only).
 */

import type { AccountingEntry } from '@/app/context/AccountingContext';
import { getJournalEntrySourceDocumentOpenTarget } from '@/app/lib/journalEntryEditPolicy';
import { isStudioSourceDocumentReferenceType } from '@/app/lib/transactionActionRules';
import { safeSessionStorageSetItem } from '@/app/lib/safeBrowserStorage';
import { toast } from 'sonner';

type OpenDrawerFn = (type: string, id?: string, data?: Record<string, unknown>) => void;
type SetCurrentViewFn = (view: string) => void;

export async function openJournalSourceDocumentFromEntry(
  entry: AccountingEntry,
  deps: {
    openDrawer: OpenDrawerFn;
    setCurrentView: SetCurrentViewFn;
  }
): Promise<void> {
  const target = getJournalEntrySourceDocumentOpenTarget(entry);
  if (target) {
    try {
      if (target.kind === 'sale') {
        const { saleService } = await import('@/app/services/saleService');
        const full = await saleService.getSaleById(target.id);
        if (!full) {
          toast.error('Sale not found.');
          return;
        }
        deps.openDrawer('edit-sale', undefined, { sale: full });
        return;
      }
      if (target.kind === 'purchase') {
        const { purchaseService } = await import('@/app/services/purchaseService');
        const full = await purchaseService.getPurchase(target.id);
        if (!full) {
          toast.error('Purchase not found.');
          return;
        }
        deps.openDrawer('edit-purchase', undefined, { purchase: full });
        return;
      }
      if (target.kind === 'sale_return') {
        safeSessionStorageSetItem('pendingAccountingOpen_saleReturnId', target.id);
        deps.setCurrentView('sales');
        toast.info('Opening Sales — return details will open on the Returns tab.');
        return;
      }
      if (target.kind === 'purchase_return') {
        safeSessionStorageSetItem('pendingAccountingOpen_purchaseReturnId', target.id);
        deps.setCurrentView('purchases');
        toast.info('Opening Purchases — return details will open when ready.');
        return;
      }
      if (target.kind === 'rental') {
        safeSessionStorageSetItem('pendingRentalDetailsId', target.id);
        deps.setCurrentView('rentals');
        toast.info('Opening Rentals — use the booking drawer to view or edit.');
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not open source document.';
      toast.error(msg);
      return;
    }
  }

  const rt = String(entry.metadata?.referenceType || '').toLowerCase().trim();
  const rid = entry.metadata?.referenceId ? String(entry.metadata.referenceId).trim() : '';
  if (isStudioSourceDocumentReferenceType(rt) && rid) {
    safeSessionStorageSetItem('pendingStudioProductionId', rid);
    deps.setCurrentView('studio-production-detail');
    toast.info('Opening Studio — production order details.');
    return;
  }

  toast.message('Open this record from its source module (Sales, Purchases, Rentals, or Studio).');
}
