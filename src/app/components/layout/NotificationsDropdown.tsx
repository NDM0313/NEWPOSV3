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
import { useSupabase } from '../../context/SupabaseContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { safeRpcBranchId } from '@/app/lib/safeRpcBranchId';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { productService } from '../../services/productService';
import { shipmentAccountingService } from '../../services/shipmentAccountingService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  NOTIFICATION_ACCOUNTING_NAV_KEY,
  PENDING_EXPENSE_OPEN_KEY,
} from '@/app/lib/notificationNavConstants';
import { safeSessionStorageSetItem } from '@/app/lib/safeBrowserStorage';

const MAX_NOTIFICATIONS = 10;
const DUE_FETCH_LIMIT = 8;

export type NotificationItem = {
  id: string;
  type: 'receivable' | 'payable' | 'expense' | 'low_stock' | 'courier_balance';
  message: string;
  date?: string;
  entityId?: string;
};

type DueSale = { id: string; invoice_no?: string | null; due_amount?: number | null; invoice_date?: string | null };
type DuePurchase = { id: string; po_no?: string | null; due_amount?: number | null; po_date?: string | null };
type PendingExpense = { id: string; expense_no?: string | null; amount?: number | null; expense_date?: string | null };

/**
 * Header bell — lightweight badge queries only.
 * Must NOT call useSales/usePurchases/useExpenses (those activate full list loads on every page).
 */
export const NotificationsDropdown: React.FC = () => {
  const { setCurrentView, openDrawer } = useNavigation();
  const { companyId } = useSupabase();
  const { branchId } = useGlobalFilter();
  const { formatCurrency } = useFormatCurrency();
  const [open, setOpen] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<
    { id: string; name?: string; sku?: string; current_stock?: number }[]
  >([]);
  const [courierBalances, setCourierBalances] = useState<{ courier_name: string; balance: number }[]>([]);
  const [dueSales, setDueSales] = useState<DueSale[]>([]);
  const [duePurchases, setDuePurchases] = useState<DuePurchase[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    const rpcBranch = safeRpcBranchId(branchId ?? null);
    const mark = import.meta.env?.DEV ? `notif-badge:${companyId}` : '';
    if (mark) console.time(mark);

    (async () => {
      try {
        let salesQ = supabase
          .from('sales')
          .select('id, invoice_no, due_amount, invoice_date')
          .eq('company_id', companyId)
          .gt('due_amount', 0)
          .order('invoice_date', { ascending: false })
          .limit(DUE_FETCH_LIMIT);
        let purchQ = supabase
          .from('purchases')
          .select('id, po_no, due_amount, po_date')
          .eq('company_id', companyId)
          .gt('due_amount', 0)
          .order('po_date', { ascending: false })
          .limit(DUE_FETCH_LIMIT);
        let expQ = supabase
          .from('expenses')
          .select('id, expense_no, amount, expense_date, status')
          .eq('company_id', companyId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(DUE_FETCH_LIMIT);

        if (rpcBranch) {
          salesQ = salesQ.eq('branch_id', rpcBranch);
          purchQ = purchQ.eq('branch_id', rpcBranch);
          expQ = expQ.eq('branch_id', rpcBranch);
        }

        const [lowStock, couriers, salesRes, purchRes, expRes] = await Promise.all([
          productService.getLowStockProducts(companyId, rpcBranch).catch(() => []),
          shipmentAccountingService.getCourierBalances(companyId).catch(() => []),
          salesQ.then((r) => r.data ?? []).catch(() => [] as DueSale[]),
          purchQ.then((r) => r.data ?? []).catch(() => [] as DuePurchase[]),
          expQ.then((r) => r.data ?? []).catch(() => [] as PendingExpense[]),
        ]);
        if (cancelled) return;
        setLowStockProducts(Array.isArray(lowStock) ? lowStock : []);
        setCourierBalances(
          (couriers ?? [])
            .filter((c: { balance: number }) => c.balance > 0)
            .map((c: { courier_name: string; balance: number }) => ({
              courier_name: c.courier_name,
              balance: c.balance,
            })),
        );
        setDueSales((salesRes as DueSale[]) || []);
        setDuePurchases((purchRes as DuePurchase[]) || []);
        setPendingExpenses((expRes as PendingExpense[]) || []);
      } catch {
        if (!cancelled) {
          setLowStockProducts([]);
          setCourierBalances([]);
          setDueSales([]);
          setDuePurchases([]);
          setPendingExpenses([]);
        }
      } finally {
        if (mark) console.timeEnd(mark);
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
    dueSales.forEach((sale) => {
      notifs.push({
        id: `sale-${sale.id}`,
        type: 'receivable',
        message: `Payment due: ${sale.invoice_no || sale.id} — ${formatCurrency(Number(sale.due_amount) || 0)}`,
        date: sale.invoice_date || undefined,
        entityId: String(sale.id),
      });
    });
    duePurchases.forEach((purchase) => {
      notifs.push({
        id: `purchase-${purchase.id}`,
        type: 'payable',
        message: `Unpaid purchase: ${purchase.po_no || purchase.id} — ${formatCurrency(Number(purchase.due_amount) || 0)}`,
        date: purchase.po_date || undefined,
        entityId: String(purchase.id),
      });
    });
    pendingExpenses.forEach((expense) => {
      notifs.push({
        id: `expense-${expense.id}`,
        type: 'expense',
        message: `Pending expense: ${expense.expense_no || expense.id} — ${formatCurrency(Number(expense.amount) || 0)}`,
        date: expense.expense_date || undefined,
        entityId: expense.id,
      });
    });
    return notifs.slice(0, MAX_NOTIFICATIONS);
  }, [dueSales, duePurchases, pendingExpenses, lowStockProducts, courierBalances, formatCurrency]);

  const notificationCount = notifications.length;

  const handleNotificationClick = useCallback(
    async (notif: NotificationItem) => {
      setOpen(false);
      try {
        if (notif.type === 'receivable' && notif.entityId) {
          setCurrentView('sales');
          const { saleService } = await import('@/app/services/saleService');
          const { convertFromSupabaseSale } = await import('@/app/context/SalesContext');
          const full = await saleService.getSaleById(notif.entityId);
          if (!full) {
            toast.error('Sale not found.');
            return;
          }
          openDrawer('edit-sale', undefined, { sale: convertFromSupabaseSale(full) });
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
          safeSessionStorageSetItem(PENDING_EXPENSE_OPEN_KEY, notif.entityId);
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
          safeSessionStorageSetItem(
            NOTIFICATION_ACCOUNTING_NAV_KEY,
            JSON.stringify({ tab: 'courier' }),
          );
          setCurrentView('accounting');
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not open notification target.';
        toast.error(msg);
      }
    },
    [openDrawer, setCurrentView],
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
