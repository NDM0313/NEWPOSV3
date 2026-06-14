import { useState, useEffect, useMemo } from 'react';

import {

  ArrowLeft,

  TrendingUp,

  TrendingDown,

  DollarSign,

  ShoppingCart,

  Package,

  RefreshCw,

  Wallet,

  Building2,

} from 'lucide-react';

import type { User } from '../../types';

import * as inventoryApi from '../../api/inventory';

import { getMyWorkerDashboardMetrics } from '../../api/myWorkerDashboard';

import { getDashboardMetrics, type FinancialDashboardMetrics } from '../../api/dashboardMetrics';

import { DateRangeBar, makeInitialRange, type DateRangeValue } from '../shared/DateRangeBar';
import { dateRangePresetLabel } from '../../lib/dateRangePresets';

import {

  useEffectiveWorkerId,

  useEffectiveWorkerProfileId,

} from '../../context/CounterWorkerContext';

import { usePermissions } from '../../context/PermissionContext';

import { MOBILE_DATA_INVALIDATED_EVENT, shouldAcceptMobileInvalidation, type MobileInvalidationDetail } from '../../lib/dataInvalidationBus';



interface DashboardModuleProps {

  onBack: () => void;

  user: User;

  companyId: string | null;

  branchId: string | null;

  onNewSale?: () => void;

  onNewPurchase?: () => void;

}



function StatCard({

  title,

  value,

  displayValue,

  change,

  trend,

  icon,

  color,

}: {

  title: string;

  value?: number;

  displayValue?: string;

  change?: number;

  trend?: 'up' | 'down';

  icon: React.ReactNode;

  color: 'blue' | 'green' | 'purple' | 'amber' | 'cyan';

}) {

  const colorClasses = {

    blue: 'bg-[#3B82F6]/10 text-[#3B82F6]',

    green: 'bg-[#10B981]/10 text-[#10B981]',

    purple: 'bg-[#8B5CF6]/10 text-[#8B5CF6]',

    amber: 'bg-[#F59E0B]/10 text-[#F59E0B]',

    cyan: 'bg-[#06B6D4]/10 text-[#06B6D4]',

  };

  const shown =

    displayValue ?? (title.includes('Orders') ? String(value ?? 0) : `Rs. ${(value ?? 0).toLocaleString()}`);

  return (

    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">

      <div className="flex items-start justify-between mb-3">

        <div className={`w-10 h-10 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>

          {icon}

        </div>

        {change != null && trend && (

          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${trend === 'up' ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'}`}>

            {trend === 'up' ? <TrendingUp size={14} className="text-[#10B981]" /> : <TrendingDown size={14} className="text-[#EF4444]" />}

            <span className={`text-xs font-medium ${trend === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>

              {Math.abs(change)}%

            </span>

          </div>

        )}

      </div>

      <p className="text-xs text-[#9CA3AF] mb-1">{title}</p>

      <p className="text-2xl font-bold text-white">{shown}</p>

    </div>

  );

}



export function DashboardModule({ onBack, user, companyId, branchId, onNewSale, onNewPurchase }: DashboardModuleProps) {

  const { isAdminOrOwner } = usePermissions();

  const effectiveUserId = useEffectiveWorkerId(user.id);

  const effectiveProfileId = useEffectiveWorkerProfileId();

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makeInitialRange('today'));

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [income, setIncome] = useState(0);

  const [expense, setExpense] = useState(0);

  const [profit, setProfit] = useState(0);

  const [receivable, setReceivable] = useState(0);

  const [payable, setPayable] = useState(0);

  const [orders, setOrders] = useState(0);

  const [paymentsIn, setPaymentsIn] = useState(0);

  const [paymentsOut, setPaymentsOut] = useState(0);

  const [executiveMetrics, setExecutiveMetrics] = useState<FinancialDashboardMetrics | null>(null);

  const [executiveMetricsError, setExecutiveMetricsError] = useState<string | null>(null);

  const [lowStock, setLowStock] = useState<{ name: string; current: number; min: number }[]>([]);

  const [pendingOrders, setPendingOrders] = useState<{ id: string; customer: string; amount: number; status: string }[]>([]);



  const executiveDisplay = useMemo(() => {

    const m = executiveMetrics;

    if (!m) return null;

    const pu = Number(m.period_purchases) || 0;

    const opEx = Number(m.period_operating_expenses) || 0;

    const combined = Number(m.monthly_expenses) || 0;

    const showLegacyCombined = pu === 0 && opEx === 0 && combined > 0;

    const periodSales = Number(m.today_sales) || Number(m.monthly_revenue) || 0;
    const periodPurchases = Number(m.period_purchases) || 0;
    const periodOpEx = Number(m.period_operating_expenses) || 0;
    const periodProfit =
      Number(m.today_profit) ||
      Number(m.monthly_profit) ||
      periodSales - periodPurchases - periodOpEx;

    return {

      periodSales,

      periodProfit,

      purchases: pu,

      operatingExpenses: opEx,

      showLegacyCombined,

      combinedOutflows: combined,

      profitMarginPct: m.profit_margin_pct,

      cash: m.cash_balance,

      bank: m.bank_balance,

      receivables: m.receivables,

      payables: m.payables,

    };

  }, [executiveMetrics]);



  const loadData = async () => {

    if (!companyId) return;

    setIsRefreshing(true);

    const invBranch = branchId && branchId !== 'all' && branchId !== 'default' ? branchId : null;

    const fromDate = dateRange.from;
    const toDate = dateRange.to;



    const invRes = await inventoryApi.getInventory(companyId, invBranch);

    const lowStockItems = (invRes.data || []).filter((p) => p.isLowStock).slice(0, 5);

    setLowStock(lowStockItems.map((p) => ({ name: p.name, current: p.stock, min: p.minStock })));

    setPendingOrders([]);



    if (isAdminOrOwner) {

      const { data: payload, error: execErr } = await getDashboardMetrics(companyId, branchId, fromDate, toDate);

      if (payload && !execErr) {

        setExecutiveMetrics(payload.metrics);

        setExecutiveMetricsError(payload.metrics.error ?? null);

        if (payload.low_stock_items?.length) {

          setLowStock(

            payload.low_stock_items.slice(0, 5).map((p) => ({

              name: p.name ?? 'Item',

              current: p.current_stock,

              min: p.min_stock,

            })),

          );

        }

      } else {

        setExecutiveMetrics(null);

        setExecutiveMetricsError(execErr ?? 'Executive metrics unavailable.');

      }

      setIncome(0);

      setExpense(0);

      setProfit(0);

      setReceivable(0);

      setPayable(0);

      setPaymentsIn(0);

      setPaymentsOut(0);

      setOrders(0);

      setIsRefreshing(false);

      return;

    }



    if (!effectiveUserId) {

      setIsRefreshing(false);

      return;

    }



    setExecutiveMetrics(null);

    const { data: metrics, error: metricsErr } = await getMyWorkerDashboardMetrics(

      companyId,

      branchId,

      effectiveUserId,

      effectiveProfileId,

      { fromDate, toDate },

    );



    if (metrics && !metricsErr) {

      setIncome(metrics.revenue);

      setExpense(metrics.cost);

      setProfit(metrics.profit);

      setReceivable(metrics.receivables);

      setPayable(metrics.payables);

      setPaymentsIn(metrics.paymentsIn);

      setPaymentsOut(metrics.paymentsOut);

      setOrders(metrics.ordersCount);

      setIsRefreshing(false);

      return;

    }



    setIncome(0);

    setExpense(0);

    setReceivable(0);

    setPayable(0);

    setProfit(0);

    setPaymentsIn(0);

    setPaymentsOut(0);

    setOrders(0);

    setIsRefreshing(false);

  };



  useEffect(() => {

    void loadData();

  }, [companyId, branchId, dateRange.from, dateRange.to, dateRange.preset, effectiveUserId, effectiveProfileId, isAdminOrOwner]);



  useEffect(() => {

    if (!companyId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const onInvalidated = (event: Event) => {

      const detail = (event as CustomEvent<MobileInvalidationDetail>).detail;

      if (

        !shouldAcceptMobileInvalidation(detail, {

          domain: ['sales', 'purchases', 'accounting', 'contacts'],

          companyId,

          branchId: branchId ?? null,

        })

      ) {

        return;

      }

      if (timer) return;

      timer = setTimeout(() => {

        timer = null;

        void loadData();

      }, 250);

    };

    window.addEventListener(MOBILE_DATA_INVALIDATED_EVENT, onInvalidated as EventListener);

    return () => {

      if (timer) clearTimeout(timer);

      window.removeEventListener(MOBILE_DATA_INVALIDATED_EVENT, onInvalidated as EventListener);

    };

  }, [branchId, companyId, dateRange.from, dateRange.to, dateRange.preset, effectiveUserId, effectiveProfileId, isAdminOrOwner]);



  const periodLabel = dateRangePresetLabel(dateRange);

  const branchLabel =

    branchId && branchId !== 'all' && branchId !== 'default' ? 'selected branch' : 'all branches';



  return (

    <div className="min-h-screen pb-24 bg-[#111827]">

      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40 flow-screen-header">

        <div className="flex items-center justify-between px-4 h-14">

          <div className="flex items-center gap-3">

            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors text-white">

              <ArrowLeft className="w-5 h-5" />

            </button>

            <div className="flex items-center gap-2">

              <div className="w-8 h-8 bg-[#3B82F6] rounded-lg flex items-center justify-center">

                <TrendingUp size={18} className="text-white" />

              </div>

              <h1 className="text-white font-semibold text-base">Dashboard</h1>

            </div>

          </div>

          <button

            onClick={() => loadData()}

            disabled={isRefreshing}

            className="p-2 text-[#9CA3AF] hover:text-white hover:bg-[#374151] rounded-lg transition-colors disabled:opacity-50 text-white"

          >

            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />

          </button>

        </div>

        <div className="px-4 pb-3">
          <DateRangeBar
            value={dateRange}
            onChange={setDateRange}
            variant="dark"
            hidePresets={['all', 'quarter', 'year', 'custom']}
          />
        </div>

      </div>



      <div className="p-4 space-y-4">

        {isAdminOrOwner ? (

          <>

            <p className="text-[11px] text-[#6B7280] leading-snug">

              Company-wide executive metrics for {branchLabel} ({periodLabel}; Sat–Fri for This week / Last week). Period net = sales − purchases − operating expenses.

            </p>

            {executiveMetricsError && !executiveDisplay ? (

              <p className="text-xs text-amber-400/90">{executiveMetricsError}</p>

            ) : null}

            {executiveDisplay ? (

              <div className="space-y-3">

                <StatCard

                  title={dateRange.preset === 'today' ? 'Today sales' : 'Period sales'}

                  value={executiveDisplay.periodSales}

                  icon={<DollarSign size={20} />}

                  color="green"

                />

                <StatCard

                  title={dateRange.preset === 'today' ? 'Today net profit' : 'Period net profit'}

                  value={executiveDisplay.periodProfit}

                  icon={<TrendingUp size={20} />}

                  color="blue"

                />

                {executiveDisplay.showLegacyCombined ? (

                  <StatCard

                    title="Outflows (combined)"

                    value={executiveDisplay.combinedOutflows}

                    icon={<ShoppingCart size={20} />}

                    color="amber"

                  />

                ) : (

                  <>

                    <StatCard

                      title="Purchases (period)"

                      value={executiveDisplay.purchases}

                      icon={<ShoppingCart size={20} />}

                      color="purple"

                    />

                    <StatCard

                      title="Operating expenses"

                      value={executiveDisplay.operatingExpenses}

                      icon={<TrendingDown size={20} />}

                      color="amber"

                    />

                  </>

                )}

                <StatCard

                  title="Profit margin"

                  displayValue={`${executiveDisplay.profitMarginPct}%`}

                  icon={<TrendingUp size={20} />}

                  color="cyan"

                />

                <StatCard title="Cash balance" value={executiveDisplay.cash} icon={<Wallet size={20} />} color="green" />

                <StatCard title="Bank balance" value={executiveDisplay.bank} icon={<Building2 size={20} />} color="blue" />

                <StatCard

                  title="Receivables (operational)"

                  value={executiveDisplay.receivables}

                  icon={<Package size={20} />}

                  color="blue"

                />

                <StatCard

                  title="Payables (operational)"

                  value={executiveDisplay.payables}

                  icon={<Package size={20} />}

                  color="green"

                />

              </div>

            ) : (

              <p className="text-sm text-[#9CA3AF]">Could not load executive metrics.</p>

            )}

          </>

        ) : (

          <>

            <p className="text-[11px] text-[#6B7280] leading-snug">

              Revenue, receivables, payables, and payments are scoped to the active logged-in user (sales/purchases/payments you created). Low stock uses branch inventory for the selected branch.

            </p>

            <div className="space-y-3">

              <StatCard title="My revenue" value={income} icon={<DollarSign size={20} />} color="blue" />

              <StatCard title="My cost (purchases + expenses)" value={expense} icon={<ShoppingCart size={20} />} color="green" />

              <StatCard title="My net profit" value={profit} icon={<TrendingUp size={20} />} color="purple" />

              <StatCard title="My receivables" value={receivable} icon={<Package size={20} />} color="blue" />

              <StatCard title="My payables" value={payable} icon={<Package size={20} />} color="green" />

              <StatCard title="My payments received" value={paymentsIn} icon={<TrendingUp size={20} />} color="blue" />

              <StatCard title="My payments made" value={paymentsOut} icon={<TrendingDown size={20} />} color="green" />

              <StatCard title="My orders" value={orders} icon={<Package size={20} />} color="blue" />

            </div>

          </>

        )}



        {lowStock.length > 0 && (

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">

            <div className="flex items-center gap-2 mb-4">

              <h3 className="font-semibold text-white">Low Stock Alert</h3>

              <span className="ml-auto px-2 py-1 bg-[#F59E0B]/10 text-[#F59E0B] text-xs rounded">

                {lowStock.length} items

              </span>

            </div>

            <div className="space-y-2">

              {lowStock.map((item, i) => (

                <div key={i} className="bg-[#111827] rounded-lg p-3 flex items-center justify-between">

                  <div>

                    <p className="text-sm text-white font-medium">{item.name}</p>

                    <p className="text-xs text-[#9CA3AF] mt-1">

                      Current: {item.current} • Min: {item.min}

                    </p>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}



        {pendingOrders.length > 0 && (

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">

            <h3 className="font-semibold text-white mb-4">Pending Orders</h3>

            <div className="space-y-2">

              {pendingOrders.map((order) => (

                <div key={order.id} className="bg-[#111827] rounded-lg p-3 flex items-center justify-between">

                  <div>

                    <p className="text-sm text-white font-medium">{order.id || 'Order'}</p>

                    <p className="text-xs text-[#9CA3AF] mt-1">{order.customer}</p>

                  </div>

                  <div className="text-right">

                    <p className="text-sm text-white font-medium">Rs. {order.amount.toLocaleString()}</p>

                    <span className={`text-xs px-2 py-0.5 rounded ${order.status === 'pending' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#3B82F6]/10 text-[#3B82F6]'}`}>

                      {order.status}

                    </span>

                  </div>

                </div>

              ))}

            </div>

          </div>

        )}



        <div className="grid grid-cols-2 gap-3">

          {onNewSale && (

            <button onClick={onNewSale} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-colors text-left">

              <ShoppingCart className="w-6 h-6 text-[#3B82F6] mb-2" />

              <p className="text-sm font-medium text-white">New Sale</p>

            </button>

          )}

          {onNewPurchase && (

            <button onClick={onNewPurchase} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#10B981] transition-colors text-left">

              <Package className="w-6 h-6 text-[#10B981] mb-2" />

              <p className="text-sm font-medium text-white">New Purchase</p>

            </button>

          )}

        </div>

      </div>

    </div>

  );

}


