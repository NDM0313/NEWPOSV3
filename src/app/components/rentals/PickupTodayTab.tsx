import React from 'react';
import { Truck, Package, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useRentals, RentalUI } from '@/app/context/RentalContext';
import { formatLongDate } from '../ui/utils';

interface PickupTodayTabProps {
  onProcessPickup: (rental: RentalUI) => void;
}

export const PickupTodayTab = ({ onProcessPickup }: PickupTodayTabProps) => {
  const { rentals, loading } = useRentals();
  const today = new Date().toISOString().slice(0, 10);

  const todayPickups = rentals.filter(
    (r) => r.startDate === today && r.status === 'booked'
  );

  return (
    <div className="h-full flex flex-col p-6">
      <div className="shrink-0 mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Truck size={20} className="text-amber-400" />
          Pickup Today
        </h3>
        <p className="text-sm text-gray-400 mt-0.5">
          Rentals scheduled for pickup on {formatLongDate(today)} ({todayPickups.length})
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={40} className="text-pink-500 animate-spin" />
        </div>
      ) : todayPickups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <ShoppingBag size={64} className="mb-4 opacity-50" />
          <p className="text-lg font-medium">No pickups today</p>
          <p className="text-sm mt-1">All rentals scheduled for today are already processed</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {todayPickups.map((r) => (
            <div
              key={r.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0">
                  <Package size={24} className="text-pink-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-pink-400 font-semibold">{r.rentalNo}</p>
                  <p className="text-white font-medium truncate">{r.customerName}</p>
                  <p className="text-sm text-gray-400 truncate">
                    {r.items?.[0]?.productName || '—'}
                    {r.items && r.items.length > 1 ? ` +${r.items.length - 1} more` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">Booked</Badge>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-500 text-white font-semibold shadow-lg shadow-green-600/20"
                  onClick={() => onProcessPickup(r)}
                >
                  <Truck size={18} className="mr-2" />
                  Process Pickup
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
