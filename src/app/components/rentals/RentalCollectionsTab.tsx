/**
 * Rental Collections Tab – Customer Outstanding Dashboard
 * Shows rentals with due_amount > 0 (credit deliveries, partial payments)
 * Collect Payment button opens payment dialog
 */
import React, { useMemo } from 'react';
import { DollarSign, Phone, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useRentals, type RentalUI } from '@/app/context/RentalContext';
import { cn } from '@/app/components/ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

interface RentalCollectionsTabProps {
  onCollectPayment: (rental: RentalUI) => void;
}

export const RentalCollectionsTab = ({ onCollectPayment }: RentalCollectionsTabProps) => {
  const { rentals } = useRentals();
  const { formatCurrency } = useFormatCurrency();

  const getDue = (r: RentalUI) => {
    const d = r.dueAmount ?? 0;
    return d > 0 ? d : Math.max(0, (r.totalAmount ?? 0) - (r.paidAmount ?? 0));
  };

  const outstandingRentals = useMemo(() => {
    return rentals
      .filter((r) => {
        const due = getDue(r);
        return due > 0 && ['rented', 'overdue', 'booked', 'returned'].includes(r.status);
      })
      .sort((a, b) => getDue(b) - getDue(a));
  }, [rentals]);

  const totalOutstanding = useMemo(
    () => outstandingRentals.reduce((sum, r) => sum + getDue(r), 0),
    [outstandingRentals]
  );

  const agingBuckets = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const due = (r: RentalUI) => {
      const d = r.dueAmount ?? 0;
      return d > 0 ? d : Math.max(0, (r.totalAmount ?? 0) - (r.paidAmount ?? 0));
    };
    let current = 0, days1to30 = 0, days31to60 = 0, days61to90 = 0, days90plus = 0;
    outstandingRentals.forEach((r) => {
      const amt = due(r);
      const ret = r.expectedReturnDate;
      const days = ret >= today ? 0 : Math.floor((new Date(today).getTime() - new Date(ret).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) current += amt;
      else if (days <= 30) days1to30 += amt;
      else if (days <= 60) days31to60 += amt;
      else if (days <= 90) days61to90 += amt;
      else days90plus += amt;
    });
    return { current, days1to30, days31to60, days61to90, days90plus };
  }, [outstandingRentals]);

  const getDaysOverdue = (expectedReturn: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (expectedReturn >= today) return 0;
    const diff = new Date(today).getTime() - new Date(expectedReturn).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="shrink-0 mb-6">
        <h2 className="text-lg font-semibold text-white">Customer Outstanding</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Rentals with balance due – collect payments to reduce AR
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400">Total Outstanding</span>
            <p className="text-xl font-bold text-amber-400">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400">Rentals Due</span>
            <p className="text-xl font-bold text-white">{outstandingRentals.length}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400">Current</span>
            <p className="text-lg font-semibold text-green-400">{formatCurrency(agingBuckets.current)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400">1-30 Days</span>
            <p className="text-lg font-semibold text-amber-400">{formatCurrency(agingBuckets.days1to30)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400">31-60 Days</span>
            <p className="text-lg font-semibold text-orange-400">{formatCurrency(agingBuckets.days31to60)}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2">
            <span className="text-xs text-gray-400">61-90+ Days</span>
            <p className="text-lg font-semibold text-red-400">{formatCurrency(agingBuckets.days61to90 + agingBuckets.days90plus)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {outstandingRentals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <DollarSign size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">No outstanding rentals</p>
            <p className="text-sm mt-1">All rental payments are up to date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {outstandingRentals.map((r) => {
              const daysOverdue = getDaysOverdue(r.expectedReturnDate);
              return (
                <div
                  key={r.id}
                  className={cn(
                    'rounded-lg border p-4 flex items-center justify-between gap-4',
                    daysOverdue > 0
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-gray-700 bg-gray-800/30'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-pink-400 font-medium">{r.rentalNo}</span>
                      {r.status === 'returned' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">Returned</span>
                      )}
                      {daysOverdue > 0 && r.status !== 'returned' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                          {daysOverdue}d overdue
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium mt-1">{r.customerName}</p>
                    {r.customerContact && (
                      <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone size={12} /> {r.customerContact}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar size={12} /> Return: {r.expectedReturnDate}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-amber-400">
                      {formatCurrency(getDue(r))}
                    </p>
                    <p className="text-xs text-gray-500">
                      of {formatCurrency(r.totalAmount ?? 0)} total
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => onCollectPayment(r)}
                    >
                      <DollarSign size={14} className="mr-1.5" />
                      Collect Payment
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
