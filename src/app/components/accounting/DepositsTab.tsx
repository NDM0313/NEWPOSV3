'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, RefreshCw } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { rentalService } from '@/app/services/rentalService';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { cn } from '@/app/components/ui/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

interface RentalDepositRow {
  id: string;
  rentalNo: string;
  customerName: string;
  securityDeposit: number;
  refundAmount: number;
  netHeld: number;
  status: string;
  startDate: string;
  returnDate: string;
}

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  booked: 'Booked',
  rented: 'Rented',
  picked_up: 'Dispatched',
  returned: 'Returned',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

export const DepositsTab: React.FC = () => {
  const { companyId, branchId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RentalDepositRow[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalRefunded, setTotalRefunded] = useState(0);
  const [netHeld, setNetHeld] = useState(0);

  const loadDeposits = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const branchIdToUse = branchId && branchId !== 'all' ? branchId : undefined;
      const data = await rentalService.getAllRentals(companyId, branchIdToUse);
      const withDeposit = (data || []).filter(
        (r: any) => (r.security_deposit ?? 0) > 0 && r.status !== 'cancelled'
      );
      const mapped: RentalDepositRow[] = withDeposit.map((r: any) => {
        const deposit = Number(r.security_deposit ?? 0);
        const refund = Number(r.refund_amount ?? 0);
        return {
          id: r.id,
          rentalNo: r.rental_no || r.booking_no || '-',
          customerName: r.customer_name || r.customer?.name || 'Unknown',
          securityDeposit: deposit,
          refundAmount: refund,
          netHeld: deposit - refund,
          status: r.status || 'draft',
          startDate: r.start_date || r.pickup_date || r.booking_date || '-',
          returnDate: r.expected_return_date || r.return_date || '-',
        };
      });
      setRows(mapped);
      const collected = mapped.reduce((s, x) => s + x.securityDeposit, 0);
      const refunded = mapped.reduce((s, x) => s + x.refundAmount, 0);
      setTotalCollected(collected);
      setTotalRefunded(refunded);
      setNetHeld(collected - refunded);
    } catch (e) {
      console.error('[DepositsTab] Error:', e);
      setRows([]);
      setTotalCollected(0);
      setTotalRefunded(0);
      setNetHeld(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Security Deposits</h3>
          <p className="text-sm text-gray-400">Rental security deposits from database</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
          onClick={loadDeposits}
        >
          <RefreshCw size={14} className="mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Collected</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(totalCollected)}</p>
          <p className="text-xs text-gray-500 mt-1">Security deposits received</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Refunded</p>
          <p className="text-xl font-bold text-orange-400">{formatCurrency(totalRefunded)}</p>
          <p className="text-xs text-gray-500 mt-1">Refunded to customers</p>
        </div>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Net Held</p>
          <p className={cn(
            "text-xl font-bold",
            netHeld >= 0 ? "text-blue-400" : "text-red-400"
          )}>{formatCurrency(netHeld)}</p>
          <p className="text-xs text-gray-500 mt-1">Currently held</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-12">
            <Shield size={48} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">No security deposits</p>
            <p className="text-gray-500 text-xs mt-1">Deposits from rentals will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Rental #</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Start</th>
                  <th className="px-4 py-3 text-left">Return</th>
                  <th className="px-4 py-3 text-right">Deposit</th>
                  <th className="px-4 py-3 text-right">Refunded</th>
                  <th className="px-4 py-3 text-right">Net Held</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-sm font-medium text-white">{row.rentalNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        row.status === 'returned' || row.status === 'closed'
                          ? 'bg-green-500/10 text-green-400 border-green-500/30'
                          : row.status === 'overdue'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : row.status === 'cancelled'
                          ? 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }>
                        {statusLabel[row.status] || row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{row.startDate}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{row.returnDate}</td>
                    <td className="px-4 py-3 text-sm text-green-400 font-medium text-right">{formatCurrency(row.securityDeposit)}</td>
                    <td className="px-4 py-3 text-sm text-orange-400 text-right">{formatCurrency(row.refundAmount)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right">{formatCurrency(row.netHeld)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
