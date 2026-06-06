import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { DateTimeDisplay } from '../ui/DateTimeDisplay';
import { useNavigation } from '../../context/NavigationContext';
import { useSales } from '../../context/SalesContext';
import { usePurchases } from '../../context/PurchaseContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useSupabase } from '../../context/SupabaseContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { safeRpcBranchId } from '@/app/lib/safeRpcBranchId';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { productService } from '../../services/productService';
import { shipmentAccountingService } from '../../services/shipmentAccountingService';
import { toast } from 'sonner';
import {
  NOTIFICATION_ACCOUNTING_NAV_KEY,
  PENDING_EXPENSE_OPEN_KEY,
} from '@/app/lib/notificationNavConstants';

const MAX_NOTIFICATIONS = 10;

export type NotificationItem = {
  id: string;
  type: 'receivable' | 'payable' | 'expense' | 'low_stock' | 'courier_balance';
  message: string;
  date?: string;
  entityId?: string;
};

export const NotificationsDropdown: React.FC = () => {
  const { setCurrentView, openDrawer } = useNavigation();
  const { companyId } = useSupabase();
  const { branchId } = useGlobalFilter();
  const { formatCurrency } = useFormatCurrency();
  const sales = useSales();
  const purchases = usePurchases();
  const expenses = useExpenses();
  const [open, setOpen] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<
    { id: string; name?: string; sku?: string; current_stock?: number }[]
  >([]);
  const [courierBalances, setCourierBalances] = useState<{ courier_name: string; balance: number }[]>([]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const [lowStock, couriers] = await Promise.all([
          productService.getLowStockProducts(companyId, safeRpcBranchId(branchId ?? null)).catch(() => []),
          shipmentAccountingService.getCourierBalances(companyId).catch(() => []),
        ]);
        if (cancelled) return;
        setLowStockProducts(Array.isArray(lowStock) ? lowStock : []);
        setCourierBalances(
          (couriers ?? [])
            .filter((c: { balance: number }) => c.balance > 0)
            .map((c: { courier_name: string; balance: number }) => ({
              courier_name: c.courier_name,
              balance: c.balance,
            }))
        );
      } catch {
        if (!cancelled) {
          setLowStockProducts([]);
          setCourierBalances([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  const notifications = useMemo((): NotificationItem[] => {
    const notifs: NotificationItem[] = [];
    lowStockProducts.forEach((p) => {
      notifs.push({
        id: `lowstock-${p.id}`,
        type: 'low_stock',
        message: `Low stock: ${p.name || p.sku || 'Product'} — ${Number(p.current_stock) ?? 0} left`,
        entityId: p.id,
      });
    });
    courierBalances.forEach((c, i) => {
      notifs.push({
        id: `courier-${c.courier_name}-${i}`,
        type: 'courier_balance',
        message: `Courier due: ${c.courier_name} — ${formatCurrency(c.balance)}`,
        entityId: c.courier_name,
      });
    });
    sales.sales
      .filter((s) => s.type === 'invoice' && s.due > 0)
      .forEach((sale) => {
        notifs.push({
          id: `sale-${sale.id}`,
          type: 'receivable',
          message: `Payment due: ${sale.invoiceNo} — ${formatCurrency(sale.due)}`,
          date: sale.date,
          entityId: String(sale.id),
        });
      });
    purchases.purchases
      .filter((p) => p.due > 0)
      .forEach((purchase) => {
        notifs.push({
          id: `purchase-${purchase.id}`,
          type: 'payable',
          message: `Unpaid purchase: ${purchase.purchaseNo} — ${formatCurrency(purchase.due)}`,
          date: purchase.date,
          entityId: String(purchase.id),
        });
      });
    expenses.expenses
      .filter((e) => e.status === 'pending')
      .forEach((expense) => {
        notifs.push({
          id: `expense-${expense.id}`,
          type: 'expense',
          message: `Pending expense: ${expense.expenseNo} — ${formatCurrency(expense.amount)}`,
          date: expense.date,
          entityId: expense.id,
        });
      });
    return notifs.slice(0, MAX_NOTIFICATIONS);
  }, [
    sales.sales,
    purchases.purchases,
    expenses.expenses,
    lowStockProducts,
    courierBalances,
    formatCurrency,
  ]);

  const notificationCount = notifications.length;

  const handleNotificationClick = useCallback(
    async (notif: NotificationItem) => {
      setOpen(false);
      try {
        if (notif.type === 'receivable' && notif.entityId) {
          setCurrentView('sales');
          const { saleService } = await import('@/app/services/saleService');
          const full = await saleService.getSaleById(notif.entityId);
          if (!full) {
            toast.error('Sale not found.');
            return;
          }
          openDrawer('edit-sale', undefined, { sale: full });
          return;
        }
        if (notif.type === 'payable' && notif.entityId) {
          setCurrentView('purchases');
          const { purchaseService } = await import('@/app/services/purchaseService');
          const full = await purchaseService.getPurchase(notif.entityId);
          if (!full) {
            toast.error('Purchase not found.');
            return;
          }
          openDrawer('edit-purchase', undefined, { purchase: full });
          return;
        }
        if (notif.type === 'expense' && notif.entityId) {
          setCurrentView('expenses');
          sessionStorage.setItem(PENDING_EXPENSE_OPEN_KEY, notif.entityId);
          return;
        }
        if (notif.type === 'low_stock' && notif.entityId) {
          setCurrentView('products');
          const { productService: ps } = await import('@/app/services/productService');
          const product = await ps.getProduct(notif.entityId);
          if (!product) {
            toast.error('Product not found.');
            return;
          }
          openDrawer('edit-product', undefined, { product });
          return;
        }
        if (notif.type === 'courier_balance') {
          sessionStorage.setItem(
            NOTIFICATION_ACCOUNTING_NAV_KEY,
            JSON.stringify({ tab: 'courier' })
          );
          setCurrentView('accounting');
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not open notification target.';
        toast.error(msg);
      }
    },
    [openDrawer, setCurrentView]
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 md:p-2.5 rounded-xl transition-all bg-accent hover:bg-muted border border-border text-muted-foreground hover:text-foreground touch-manipulation"
          title="Notifications"
          type="button"
        >
          <Bell size={20} />
          {notificationCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground border-2 border-header-background text-xs font-bold shadow-sm">
              {notificationCount > 99 ? '99+' : notificationCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 bg-card border-border shadow-2xl rounded-lg p-2 max-h-[400px] overflow-y-auto"
      >
        <div className="px-3 py-2 mb-2 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Notifications
            {notificationCount > 0 ? ` (${notificationCount})` : ''}
          </p>
        </div>
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-muted-foreground">
            <Bell size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent transition-all"
              onClick={() => void handleNotificationClick(notif)}
            >
              <p className="text-sm font-medium text-foreground w-full">{notif.message}</p>
              {notif.date ? (
                <DateTimeDisplay date={notif.date} dateOnly className="text-xs text-muted-foreground" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
