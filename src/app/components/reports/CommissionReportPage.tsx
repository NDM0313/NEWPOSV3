/**
 * Commission Report – period-based summary from sales (sale-level capture).
 * Uses global date range; supports filter by salesman.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useFormatDate } from '@/app/hooks/useFormatDate';
import { getCommissionReport, type CommissionReportResult, type CommissionSummaryRow } from '@/app/services/commissionReportService';
import { Loader2, Users, FileText } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { DateTimeDisplay } from '@/app/components/ui/DateTimeDisplay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';

export interface CommissionReportPageProps {
  startDate: string;
  endDate: string;
}

export const CommissionReportPage: React.FC<CommissionReportPageProps> = ({ startDate, endDate }) => {
  const { companyId } = useSupabase();
  const { formatCurrency } = useFormatCurrency();
  const { formatDate } = useFormatDate();
  const [data, setData] = useState<CommissionReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Filter by salesman: null = all, otherwise salesman_id */
  const [salesmanFilterId, setSalesmanFilterId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId || !startDate || !endDate) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getCommissionReport(companyId, startDate, endDate)
      .then(setData)
      .catch((e) => {
        setError(e?.message || 'Failed to load commission report');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [companyId, startDate, endDate]);

  const filteredSummary = useMemo((): CommissionSummaryRow[] => {
    if (!data?.summary) return [];
    if (!salesmanFilterId) return data.summary;
    return data.summary.filter((row) => row.salesman_id === salesmanFilterId);
  }, [data?.summary, salesmanFilterId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800 p-6">
        <p className="text-red-400">{error}</p>
      </Card>
    );
  }

  if (!data || data.summary.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800 p-8 text-center">
        <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
        <p className="text-gray-400">No commission data for this period.</p>
        <p className="text-sm text-gray-500 mt-1">Assign a salesman and commission on sales to see the report.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
        <Label className="text-sm font-medium text-gray-400 whitespace-nowrap">Salesperson</Label>
        <Select
          value={salesmanFilterId ?? 'all'}
          onValueChange={(v) => setSalesmanFilterId(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[220px] bg-gray-950 border-gray-700 text-white">
            <SelectValue placeholder="All salesmen" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700 text-white">
            <SelectItem value="all" className="focus:bg-gray-800">All salesmen</SelectItem>
            {data.summary.map((row) => (
              <SelectItem key={row.salesman_id} value={row.salesman_id} className="focus:bg-gray-800">
                {row.salesman_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-gray-500">
          {formatDate(new Date(data.period_start))} – {formatDate(new Date(data.period_end))}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredSummary.map((row) => (
          <Card key={row.salesman_id} className="bg-gray-900 border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users className="text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-white">{row.salesman_name}</h3>
                <p className="text-xs text-gray-500">{row.sale_count} sale(s)</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(row.total_commission)}</p>
            <p className="text-sm text-gray-500 mt-1">Commission · Sales: {formatCurrency(row.total_sales_amount)}</p>
          </Card>
        ))}
      </div>

      <Card className="bg-gray-900 border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText size={20} className="text-blue-400" />
            Commission by sale
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Period: {formatDate(new Date(data.period_start))} – {formatDate(new Date(data.period_end))}
            {salesmanFilterId && (
              <span className="ml-2 text-blue-400">· Filtered by salesperson</span>
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-950/80 text-gray-400 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Salesperson</th>
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredSummary.flatMap((row) =>
                row.sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-300">{row.salesman_name}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{sale.invoice_no}</td>
                    <td className="px-4 py-3 text-gray-400">
                      <DateTimeDisplay date={sale.invoice_date} dateOnly />
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate">{sale.customer_name}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(Number(sale.total))}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-400">{formatCurrency(Number(sale.commission_amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
