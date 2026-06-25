import React from 'react';
import type { CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import type { TieOutRowSummary } from '@/app/services/unifiedLedgerTieOutService';

export function CompareSummaryCards({
  oldBalance,
  newBalance,
  difference,
  pass,
  oldRowCount,
  newRowCount,
  oldEngineName,
  newEngineName,
  oldQueryMs,
  newQueryMs,
  extra,
}: {
  oldBalance: number;
  newBalance: number;
  difference: number;
  pass?: boolean;
  oldRowCount?: number;
  newRowCount?: number;
  oldEngineName?: string;
  newEngineName?: string;
  oldQueryMs?: number;
  newQueryMs?: number;
  extra?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Old balance" value={oldBalance} />
        <StatCard label="New balance" value={newBalance} />
        <StatCard
          label="Difference"
          value={difference}
          highlight={Math.abs(difference) > 0.01}
        />
        {pass !== undefined && (
          <StatCard label="Pass" value={pass ? 'PASS' : 'FAIL'} text highlight={!pass} />
        )}
      </div>
      {(oldEngineName || newEngineName) && (
        <div className="text-sm text-gray-400 grid md:grid-cols-2 gap-2">
          {oldEngineName && (
            <p>
              Old: <strong className="text-white">{oldEngineName}</strong>
              {oldRowCount != null && ` (${oldRowCount} rows`}
              {oldQueryMs != null && `, ${oldQueryMs.toFixed(0)} ms)`}
            </p>
          )}
          {newEngineName && (
            <p>
              New: <strong className="text-white">{newEngineName}</strong>
              {newRowCount != null && ` (${newRowCount} rows`}
              {newQueryMs != null && `, ${newQueryMs.toFixed(0)} ms)`}
            </p>
          )}
        </div>
      )}
      {extra}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  text,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  text?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? 'border-amber-500/50 bg-amber-500/10' : 'border-gray-800 bg-gray-900/50'}`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-mono mt-1">
        {text
          ? String(value)
          : typeof value === 'number'
            ? value.toLocaleString(undefined, { minimumFractionDigits: 2 })
            : value}
      </div>
    </div>
  );
}

export function CompareDiffTable({
  title,
  rows,
}: {
  title: string;
  rows: CompareRowSummary[] | TieOutRowSummary[];
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-gray-800 p-3 text-sm text-gray-500">
        {title}: none
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-3 py-2 bg-gray-900/80 text-sm font-medium">{title}</div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left p-2">Entry</th>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Type</th>
              <th className="text-right p-2">Dr</th>
              <th className="text-right p-2">Cr</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r, i) => (
              <tr key={`${r.journalEntryId}-${i}`} className="border-b border-gray-800/50">
                <td className="p-2">{r.entryNo || r.journalEntryId.slice(0, 8)}</td>
                <td className="p-2">{r.entryDate}</td>
                <td className="p-2">{r.referenceType || '—'}</td>
                <td className="p-2 text-right">{r.debit.toFixed(2)}</td>
                <td className="p-2 text-right">{r.credit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function downloadCompareJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
