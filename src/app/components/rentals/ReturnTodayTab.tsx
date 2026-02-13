import React from 'react';
import { CornerDownLeft, Package, Loader2, ShoppingBag, Calendar, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useRentals, RentalUI } from '@/app/context/RentalContext';
import { formatLongDate } from '../ui/utils';

interface ReturnTodayTabProps {
  onProcessReturn: (rental: RentalUI) => void;
}

export const ReturnTodayTab = ({ onProcessReturn }: ReturnTodayTabProps) => {
  const { rentals, loading } = useRentals();
  const today = new Date().toISOString().slice(0, 10);

  const todayReturns = rentals
    .filter((r) => r.status === 'rented' || r.status === 'overdue')
    .filter((r) => r.expectedReturnDate === today || r.expectedReturnDate < today)
    .sort((a, b) => (a.expectedReturnDate < b.expectedReturnDate ? -1 : 1));

  return (
    <div className="h-full flex flex-col p-6">
      <div className="shrink-0 mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <CornerDownLeft size={20} className="text-green-400" />
          Return Today
        </h3>
        <p className="text-sm text-gray-400 mt-0.5">
          Rentals due or overdue for return ({todayReturns.length})
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={40} className="text-pink-500 animate-spin" />
        </div>
      ) : todayReturns.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <ShoppingBag size={64} className="mb-4 opacity-50" />
          <p className="text-lg font-medium">No returns due today</p>
          <p className="text-sm mt-1">All rentals due or overdue are already processed</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {todayReturns.map((r) => (
            <div
              key={r.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                    <Package size={24} className="text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-green-400 font-semibold">{r.rentalNo}</p>
                      <Badge
                        className={r.status === 'overdue' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}
                      >
                        {r.status === 'overdue' ? 'Overdue' : 'Rented'}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-500 shrink-0" />
                        <span className="text-gray-400">Customer:</span>
                        <span className="text-white font-medium truncate">{r.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-gray-500 shrink-0" />
                        <span className="text-gray-400">Items:</span>
                        <span className="text-white truncate">
                          {r.items?.map((i) => `${i.productName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ') || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-500 shrink-0" />
                        <span className="text-gray-400">Pickup:</span>
                        <span className="text-white">{formatLongDate(r.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Due:</span>
                        <span className={r.dueAmount > 0 ? 'text-red-400 font-semibold' : 'text-gray-300'}>
                          ${r.dueAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-600/20"
                    onClick={() => onProcessReturn(r)}
                  >
                    <CornerDownLeft size={18} className="mr-2" />
                    Process Return
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
