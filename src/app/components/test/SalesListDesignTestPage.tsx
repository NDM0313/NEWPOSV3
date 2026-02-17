/**
 * Sales List Design Test Page
 * Design: POS vs Regular tabs + Draft/Order/Quotation/Final status.
 * Review here; when approved, apply to SalesPage.
 */
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ShoppingCart,
  Receipt,
  FileEdit,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Zap,
  Store,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/app/components/ui/utils';
import { useNavigation } from '@/app/context/NavigationContext';
import { useSales, Sale, PaymentStatus, ShippingStatus } from '@/app/context/SalesContext';
import { useDateRange } from '@/app/context/DateRangeContext';
import { formatDateAndTime } from '@/app/components/ui/utils';

type SourceTab = 'all' | 'pos' | 'regular';
type StatusTab = 'all' | 'draft' | 'order' | 'quotation' | 'final';

function isLikelyPOS(sale: Sale): boolean {
  const walkIn = (sale.customerName || '').toLowerCase().includes('walk-in');
  const final = sale.status === 'final';
  return !!(walkIn && final);
}

export const SalesListDesignTestPage = () => {
  const { setCurrentView } = useNavigation();
  const { sales, loading } = useSales();
  const { startDate, endDate } = useDateRange();

  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (startDate && endDate) {
        const d = new Date(sale.date);
        if (d < startDate || d > endDate) return false;
      }
      const pos = isLikelyPOS(sale);
      if (sourceTab === 'pos' && !pos) return false;
      if (sourceTab === 'regular' && pos) return false;
      if (statusTab !== 'all') {
        const s = (sale.status || 'final').toLowerCase();
        if (statusTab !== s) return false;
      }
      return true;
    });
  }, [sales, sourceTab, statusTab, startDate, endDate]);

  const getSourceBadge = (sale: Sale) => {
    const pos = isLikelyPOS(sale);
    if (pos) {
      return (
        <Badge className="gap-1 h-6 px-2 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">
          <Zap size={12} />
          POS
        </Badge>
      );
    }
    return (
      <Badge className="gap-1 h-6 px-2 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/40">
        <Store size={12} />
        Regular
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'final').toLowerCase();
    const config: Record<string, { bg: string; text: string; border: string; icon: typeof FileEdit }> = {
      draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40', icon: FileEdit },
      order: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40', icon: Package },
      quotation: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40', icon: Receipt },
      final: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40', icon: CheckCircle },
    };
    const { bg, text, border, icon: Icon } = config[s] || config.final;
    return (
      <Badge className={cn('gap-1 h-6 px-2 text-xs font-medium capitalize', bg, text, border)}>
        <Icon size={12} />
        {s}
      </Badge>
    );
  };

  const getPaymentBadge = (status: PaymentStatus) => {
    const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
      paid: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      partial: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      unpaid: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
    };
    const c = config[status] ?? config.unpaid;
    const { bg, text, icon: Icon } = c;
    return (
      <Badge className={cn('gap-1 h-6 px-2 text-xs font-medium capitalize', bg, text)}>
        <Icon size={12} />
        {status}
      </Badge>
    );
  };

  const getShippingBadge = (status: ShippingStatus) => {
    const config: Record<string, string> = {
      delivered: 'bg-green-500/20 text-green-400',
      processing: 'bg-blue-500/20 text-blue-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return (
      <Badge className={cn('text-xs font-medium capitalize h-6 px-2', config[status] || config.pending)}>
        {status}
      </Badge>
    );
  };

  const sourceTabs: { id: SourceTab; label: string; icon: typeof Zap }[] = [
    { id: 'all', label: 'All', icon: ShoppingCart },
    { id: 'pos', label: 'POS', icon: Zap },
    { id: 'regular', label: 'Regular', icon: Store },
  ];

  const statusTabs: { id: StatusTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'order', label: 'Order' },
    { id: 'quotation', label: 'Quotation' },
    { id: 'final', label: 'Final' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-white">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('sales')}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Sales List Design (Test)</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              POS vs Regular tabs + Draft/Order/Quotation/Final. Review then apply to Sales page.
            </p>
          </div>
        </div>
      </div>

      {/* Source tabs: All | POS | Regular */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-800 bg-[#0F1419]">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Source</p>
        <div className="flex gap-2 flex-wrap">
          {sourceTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSourceTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                sourceTab === id
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status tabs: All | Draft | Order | Quotation | Final */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-800 bg-[#0F1419]">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Status</p>
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusTab(id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                statusTab === id
                  ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-900/30'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-[120px]">Date</th>
                  <th className="text-left px-4 py-3 w-[110px]">Invoice No.</th>
                  <th className="text-left px-4 py-3 w-[100px]">Type</th>
                  <th className="text-left px-4 py-3 w-[100px]">Status</th>
                  <th className="text-left px-4 py-3 w-[180px]">Customer</th>
                  <th className="text-left px-4 py-3 w-[120px]">Location</th>
                  <th className="text-center px-4 py-3 w-[100px]">Payment</th>
                  <th className="text-right px-4 py-3 w-[90px]">Total</th>
                  <th className="text-right px-4 py-3 w-[90px]">Paid</th>
                  <th className="text-right px-4 py-3 w-[90px]">Due</th>
                  <th className="text-center px-4 py-3 w-[90px]">Shipping</th>
                  <th className="text-center px-4 py-3 w-[70px]">Items</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <Loader2 size={48} className="mx-auto text-blue-500 animate-spin mb-3" />
                      <p className="text-gray-400 text-sm">Loading sales...</p>
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <ShoppingCart size={48} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-gray-400 text-sm">No sales match the selected filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const dateTime = formatDateAndTime(sale.createdAt);
                    const locationText = sale.location || '—';
                    const itemsCount = Array.isArray(sale.items) ? sale.items.length : sale.itemsCount || 0;
                    return (
                      <tr
                        key={sale.id}
                        className="border-b border-gray-800 last:border-b-0 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="text-gray-300">{dateTime.date}</div>
                          <div className="text-xs text-gray-500">{dateTime.time}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-blue-400">
                          {sale.invoiceNo}
                        </td>
                        <td className="px-4 py-3">{getSourceBadge(sale)}</td>
                        <td className="px-4 py-3">{getStatusBadge(sale.status || 'final')}</td>
                        <td className="px-4 py-3 text-sm text-white truncate max-w-[180px]">
                          {sale.customerName || 'Walk-in Customer'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[120px]">
                          {locationText}
                        </td>
                        <td className="px-4 py-3 text-center">{getPaymentBadge(sale.paymentStatus)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-white tabular-nums">
                          ${sale.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-400 tabular-nums">
                          ${sale.paid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-400 tabular-nums">
                          {sale.due > 0 ? `$${sale.due.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">{getShippingBadge(sale.shippingStatus)}</td>
                        <td className="px-4 py-3 text-center text-sm text-gray-300">{itemsCount}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-6 py-3 border-t border-gray-800 bg-[#0F1419] text-xs text-gray-500">
        Showing {filteredSales.length} sale(s). POS = Walk-in + Final (inferred). When design is approved, apply Type + Status + tabs to SalesPage.
      </div>
    </div>
  );
};
