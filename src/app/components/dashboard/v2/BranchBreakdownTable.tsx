import React from 'react';
import type { BranchMetricRow } from '@/app/lib/dashboardV2Mappers';

interface Props {
  rows: BranchMetricRow[];
  formatCurrency: (n: number) => string;
}

export const BranchBreakdownTable: React.FC<Props> = ({ rows, formatCurrency }) => {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-[#374151] bg-[#1F2937] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#374151]">
        <h3 className="text-white font-semibold">Branch Breakdown</h3>
        <p className="text-[#9CA3AF] text-xs mt-0.5">Period totals by branch</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#9CA3AF] text-left border-b border-[#374151]">
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 font-medium text-right">Sales</th>
              <th className="px-4 py-2 font-medium text-right">Purchases</th>
              <th className="px-4 py-2 font-medium text-right">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.branchId} className="border-b border-[#374151]/50 text-white">
                <td className="px-4 py-2">{r.branchName}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.sales)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.purchases)}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(r.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
