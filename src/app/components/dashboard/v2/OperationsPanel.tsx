import React from 'react';
import { Package, FileText, CreditCard, Calendar } from 'lucide-react';
import type { DashboardV2Snapshot } from '@/app/lib/dashboardV2Mappers';

interface Props {
  operations: DashboardV2Snapshot['operations'];
  formatCurrency: (n: number) => string;
  onNavigate?: (view: string) => void;
}

function RecentList({
  title,
  icon: Icon,
  items,
  formatCurrency,
  viewTarget,
  onNavigate,
}: {
  title: string;
  icon: React.ElementType;
  items: { id: string; label: string; amount: number; date: string }[];
  formatCurrency: (n: number) => string;
  viewTarget?: string;
  onNavigate?: (view: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#374151] bg-[#1F2937] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#374151] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#9CA3AF]" />
          <h4 className="text-white font-medium text-sm">{title}</h4>
        </div>
        {viewTarget && onNavigate && items.length ? (
          <button type="button" onClick={() => onNavigate(viewTarget)} className="text-xs text-[#3B82F6]">
            View all
          </button>
        ) : null}
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#374151]">
          {items.map((r) => (
            <li key={r.id} className="px-4 py-2 flex justify-between text-sm">
              <span className="text-white truncate mr-2">{r.label}</span>
              <span className="text-[#9CA3AF] shrink-0">
                {formatCurrency(r.amount)} · {r.date}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-[#6B7280] text-xs text-center">None in period</p>
      )}
    </div>
  );
}

export const OperationsPanel: React.FC<Props> = ({ operations, formatCurrency, onNavigate }) => {
  const lowStock = operations.lowStock.slice(0, 10);

  return (
    <div className="space-y-4">
      <h3 className="text-white font-semibold">Operations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <RecentList
          title="Recent Sales"
          icon={FileText}
          items={operations.recentSales}
          formatCurrency={formatCurrency}
          viewTarget="sales"
          onNavigate={onNavigate}
        />
        <RecentList
          title="Recent Purchases"
          icon={Package}
          items={operations.recentPurchases}
          formatCurrency={formatCurrency}
          viewTarget="purchases"
          onNavigate={onNavigate}
        />
        <RecentList
          title="Recent Expenses"
          icon={CreditCard}
          items={operations.recentExpenses}
          formatCurrency={formatCurrency}
          viewTarget="expenses"
          onNavigate={onNavigate}
        />
        <RecentList
          title="Recent Payments"
          icon={CreditCard}
          items={operations.recentPayments}
          formatCurrency={formatCurrency}
          viewTarget="payments"
          onNavigate={onNavigate}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#374151] bg-[#1F2937] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#374151] flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-400" />
            <h4 className="text-white font-medium text-sm">Low / Out of Stock ({operations.lowStock.length})</h4>
            {onNavigate ? (
              <button type="button" onClick={() => onNavigate('inventory')} className="text-xs text-[#3B82F6] ml-auto">
                Inventory
              </button>
            ) : null}
          </div>
          {lowStock.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9CA3AF] text-left border-b border-[#374151]">
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2 text-right">Stock</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((r) => (
                  <tr key={r.id} className="border-b border-[#374151]/50 text-white">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right">
                      {r.stock} / {r.minStock}
                    </td>
                    <td className="px-4 py-2 text-right capitalize text-[#9CA3AF]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-[#6B7280] text-xs text-center">No low or out-of-stock items</p>
          )}
        </div>

        <div className="rounded-xl border border-[#374151] bg-[#1F2937] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#374151] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h4 className="text-white font-medium text-sm">Rentals Due / Overdue</h4>
            {onNavigate ? (
              <button type="button" onClick={() => onNavigate('rentals')} className="text-xs text-[#3B82F6] ml-auto">
                Rentals
              </button>
            ) : null}
          </div>
          {operations.rentals.length ? (
            <ul className="divide-y divide-[#374151]">
              {operations.rentals.slice(0, 8).map((r) => (
                <li key={r.id} className="px-4 py-2 flex justify-between text-sm">
                  <span className="text-white">{r.bookingNo}</span>
                  <span className="text-[#9CA3AF]">
                    {r.status} · {formatCurrency(r.dueAmount)} · {r.returnDate}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-[#6B7280] text-xs text-center">No rental alerts</p>
          )}
        </div>
      </div>
    </div>
  );
};
