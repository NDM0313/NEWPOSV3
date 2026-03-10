/**
 * Phase-2 Intelligence: Business Alert Engine
 * Evaluates rules and returns alerts for dashboard (low stock, dead inventory,
 * high expenses, profit drop, overdue receivables). No persisted table; on-demand evaluation.
 */
import { inventoryIntelligenceService } from './inventoryIntelligenceService';
import { getFinancialDashboardMetrics } from './financialDashboardService';
import { supabase } from '@/lib/supabase';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface BusinessAlert {
  id: string;
  type: 'low_stock' | 'dead_stock' | 'high_expenses' | 'profit_drop' | 'overdue_receivables' | 'overdue_payables';
  title: string;
  message: string;
  severity: AlertSeverity;
  count?: number;
  value?: number;
  actionUrl?: string;
  createdAt: string;
}

function makeId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fetch all active business alerts for the company.
 */
export async function getBusinessAlerts(companyId: string): Promise<BusinessAlert[]> {
  if (!companyId) return [];

  const alerts: BusinessAlert[] = [];
  const now = new Date().toISOString();

  try {
    const [lowStock, deadStock, financial, receivables, payables] = await Promise.all([
      inventoryIntelligenceService.getLowStockAlerts(companyId),
      inventoryIntelligenceService.getDeadStock(companyId),
      getFinancialDashboardMetrics(companyId),
      supabase.from('sales').select('id, due_amount, sale_date, invoice_no').eq('company_id', companyId).eq('status', 'final').gt('due_amount', 0),
      supabase.from('purchases').select('id, due_amount, po_date').eq('company_id', companyId).in('status', ['final', 'received']).gt('due_amount', 0),
    ]);

    if (lowStock.length > 0) {
      alerts.push({
        id: makeId(),
        type: 'low_stock',
        title: 'Low Stock',
        message: `${lowStock.length} product(s) below minimum stock level.`,
        severity: lowStock.some((x) => x.status === 'Out') ? 'critical' : 'warning',
        count: lowStock.length,
        actionUrl: 'inventory',
        createdAt: now,
      });
    }

    if (deadStock.length > 0) {
      const totalValue = deadStock.reduce((s, x) => s + x.stockValue, 0);
      alerts.push({
        id: makeId(),
        type: 'dead_stock',
        title: 'Dead Stock',
        message: `${deadStock.length} product(s) with no recent movement. Value: ${totalValue.toFixed(0)}.`,
        severity: 'info',
        count: deadStock.length,
        value: totalValue,
        actionUrl: 'inventory-analytics-test',
        createdAt: now,
      });
    }

    if (financial.monthly_expenses > 0 && financial.monthly_revenue > 0) {
      const expenseRatio = financial.monthly_expenses / financial.monthly_revenue;
      if (expenseRatio > 0.9) {
        alerts.push({
          id: makeId(),
          type: 'high_expenses',
          title: 'High Expenses',
          message: `Expenses are ${(expenseRatio * 100).toFixed(0)}% of revenue this month.`,
          severity: 'warning',
          value: financial.monthly_expenses,
          createdAt: now,
        });
      }
      if (financial.monthly_profit < 0 && financial.monthly_revenue > 0) {
        alerts.push({
          id: makeId(),
          type: 'profit_drop',
          title: 'Profit Drop',
          message: `Net profit is negative this month (${financial.monthly_profit.toFixed(0)}).`,
          severity: 'critical',
          value: financial.monthly_profit,
          actionUrl: 'reports',
          createdAt: now,
        });
      }
    }

    const overdueDays = (dateStr: string | null) => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return Math.floor((today.getTime() - d.getTime()) / 86400000);
    };

    const overdueSales = (receivables.data || []).filter((s: any) => overdueDays(s.sale_date) > 0);
    const overduePurchases = (payables.data || []).filter((p: any) => overdueDays(p.po_date) > 0);

    if (overdueSales.length > 0) {
      const total = overdueSales.reduce((s: number, x: any) => s + Number(x.due_amount || 0), 0);
      alerts.push({
        id: makeId(),
        type: 'overdue_receivables',
        title: 'Overdue Receivables',
        message: `${overdueSales.length} invoice(s) past due. Total: ${total.toFixed(0)}.`,
        severity: total > 0 ? 'warning' : 'info',
        count: overdueSales.length,
        value: total,
        actionUrl: 'accounting',
        createdAt: now,
      });
    }

    if (overduePurchases.length > 0) {
      const total = overduePurchases.reduce((s: number, x: any) => s + Number(x.due_amount || 0), 0);
      alerts.push({
        id: makeId(),
        type: 'overdue_payables',
        title: 'Overdue Payables',
        message: `${overduePurchases.length} purchase(s) past due. Total: ${total.toFixed(0)}.`,
        severity: 'warning',
        count: overduePurchases.length,
        value: total,
        actionUrl: 'purchases',
        createdAt: now,
      });
    }
  } catch (e) {
    console.warn('[BUSINESS ALERTS] Error:', e);
  }

  return alerts;
}

export const businessAlertsService = {
  getBusinessAlerts,
};
