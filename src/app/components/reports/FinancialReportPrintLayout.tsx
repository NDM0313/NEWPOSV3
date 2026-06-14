import React from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useUnifiedDocumentSettings } from '@/app/documents/useUnifiedDocumentSettings';

export interface FinancialReportPrintLayoutProps {
  title: string;
  periodLabel: string;
  branchLabel?: string;
  children: React.ReactNode;
}

export const FinancialReportPrintLayout = React.forwardRef<HTMLDivElement, FinancialReportPrintLayoutProps>(
  function FinancialReportPrintLayout({ title, periodLabel, branchLabel, children }, ref) {
    const { companyId } = useSupabase();
    const { company } = useSettings();
    const { showLogo } = useUnifiedDocumentSettings(companyId, 'ledger_statement');

    return (
      <div
        ref={ref}
        className="financial-report-print-root rounded-xl border border-gray-800 bg-white text-gray-900 p-6 shadow-sm print:shadow-none print:border-0"
      >
        <div className="flex items-start gap-4 border-b border-gray-200 pb-4 mb-4 print:border-gray-400">
          {showLogo && company?.logoUrl ? (
            <img src={company.logoUrl} alt="" className="h-14 w-auto max-w-[120px] object-contain shrink-0" />
          ) : null}
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">{company?.name || 'Company'}</p>
            <h2 className="text-base font-semibold text-gray-800 mt-0.5">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">
              {periodLabel}
              {branchLabel ? ` · ${branchLabel}` : ''}
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }
);

/** Simple print-friendly table from export rows */
export function FinancialReportDataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-sm border-collapse financial-report-data-table">
      <thead>
        <tr className="border-b border-gray-300">
          {headers.map((h) => (
            <th key={h} className="text-left p-2 font-semibold text-gray-800">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          if (row.length === 0) {
            return (
              <tr key={`spacer-${i}`}>
                <td colSpan={headers.length} className="h-2" />
              </tr>
            );
          }
          const isTotal = String(row[0] ?? '').toLowerCase().includes('total') || String(row[0] ?? '').toLowerCase().includes('difference');
          return (
            <tr key={i} className={isTotal ? 'font-semibold border-t border-gray-200' : 'border-b border-gray-100'}>
              {headers.map((_, j) => (
                <td key={j} className="p-2 text-gray-900 align-top">
                  {row[j] ?? ''}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
