/**
 * Reports → Sales tab: lifecycle filters aligned with Sales module status helpers.
 */
import type { Sale } from '@/app/context/SalesContext';
import { getEffectiveSaleStatus, type EffectiveSaleStatus } from '@/app/utils/statusHelpers';

export type SalesLifecycleFilter =
  | 'operational'
  | 'final_only'
  | 'orders_pipeline'
  | 'cancelled'
  | 'all';

const NON_OPERATIONAL: EffectiveSaleStatus[] = ['draft', 'quotation', 'cancelled'];

export function filterSalesByLifecycle(
  sales: Sale[],
  filter: SalesLifecycleFilter,
  showNonOperational: boolean
): Sale[] {
  return sales.filter((sale) => {
    const eff = getEffectiveSaleStatus(sale);
    if (!showNonOperational && NON_OPERATIONAL.includes(eff)) {
      if (filter === 'cancelled' && eff === 'cancelled') {
        // allow cancelled-only view even when showNonOperational is off
      } else if (filter !== 'cancelled' && filter !== 'all') {
        return false;
      }
    }
    switch (filter) {
      case 'final_only':
        return eff === 'final' || eff === 'returned' || eff === 'partially_returned';
      case 'orders_pipeline':
        return eff === 'order';
      case 'cancelled':
        return eff === 'cancelled';
      case 'operational':
        return (
          eff === 'final' ||
          eff === 'order' ||
          eff === 'returned' ||
          eff === 'partially_returned'
        );
      case 'all':
      default:
        return true;
    }
  });
}

/** Final invoices for metric cards (excludes cancelled and pipeline). */
export function salesForOperationalMetrics(sales: Sale[]): Sale[] {
  return sales.filter((s) => {
    const eff = getEffectiveSaleStatus(s);
    return eff === 'final' || eff === 'returned' || eff === 'partially_returned';
  });
}

export function orderPipelineSales(sales: Sale[]): Sale[] {
  return sales.filter((s) => getEffectiveSaleStatus(s) === 'order');
}

export function isStudioSale(sale: Sale): boolean {
  return !!(sale as Sale & { is_studio?: boolean }).is_studio;
}
