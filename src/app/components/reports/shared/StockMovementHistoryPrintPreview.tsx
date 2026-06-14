import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { ReportBrandHeader } from '@/app/components/reports/shared/ReportBrandHeader';
import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { ReportHeaderFieldVisibility } from '@/app/components/reports/shared/reportPrintConfig';
import type { ProductReportSection } from '@/app/lib/stockMovementReportLogic';
import { formatProductSummaryLine } from '@/app/lib/stockMovementDisplay';

interface Props {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  generatedAt: string;
  filterSummary: string;
  sections: ProductReportSection[];
  fieldVisibility: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  fontSize?: number;
  fontFamily?: string;
  orientation?: 'portrait' | 'landscape';
}

export function StockMovementHistoryPrintPreview({
  brand,
  title,
  subtitle,
  generatedAt,
  filterSummary,
  sections,
  fieldVisibility,
  showHeader = true,
  showFooter = true,
  fontSize = 11,
  fontFamily = 'Arial, Helvetica, sans-serif',
  orientation = 'landscape',
}: Props) {
  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';

  return (
    <div
      className={cn('pdf-print-root pdf-document pdf-document-compact bg-white text-black', landscapeClass)}
      style={{ fontSize, fontFamily }}
      data-orientation={orientation}
    >
      {showHeader && (
        <ReportBrandHeader brand={brand} fieldVisibility={fieldVisibility} title={title} subtitle={subtitle} />
      )}

      <p className="text-xs text-gray-600 mb-1">Generated: {generatedAt}</p>
      <p className="text-xs text-gray-600 mb-4">Filters: {filterSummary}</p>
      <p className="text-xs text-gray-500 mb-6 italic">
        Data source: stock_movements ledger (read-only). Current stock = SUM(quantity) from movements;
        inventory_balance used only when no movement rows exist.
      </p>

      {sections.map((section) => {
        const showVariationColumn = !!section.showVariationColumn;
        const colSpan = showVariationColumn ? 10 : 9;

        return (
          <div key={section.summary.productId} className="mb-8 break-inside-avoid">
            <div className="border border-gray-300 rounded p-3 mb-2 bg-gray-50">
              <h3 className="font-bold text-sm">
                {section.summary.productName} — {section.summary.sku}
              </h3>
              <p className="text-sm font-bold text-gray-800" style={{ fontSize: fontSize + 1 }}>
                {formatProductSummaryLine(section.summary)}
              </p>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 text-left">Date</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Branch</th>
                  {showVariationColumn && (
                    <th className="border border-gray-300 px-2 py-1 text-left">Variation</th>
                  )}
                  <th className="border border-gray-300 px-2 py-1 text-left">Type</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Reference</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Party</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">In</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Out</th>
                  <th className="border border-gray-300 px-2 py-1 text-right">Balance</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {section.isEmpty || section.rows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="border border-gray-300 px-2 py-2 text-gray-500 italic">
                      No stock movement found for this product.
                    </td>
                  </tr>
                ) : (
                  section.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="border border-gray-300 px-2 py-1">{new Date(r.date).toLocaleString()}</td>
                      <td className="border border-gray-300 px-2 py-1">{r.branchName || '—'}</td>
                      {showVariationColumn && (
                        <td className="border border-gray-300 px-2 py-1">{r.variationLabel || '—'}</td>
                      )}
                      <td className="border border-gray-300 px-2 py-1">{r.movementTypeLabel}</td>
                      <td className="border border-gray-300 px-2 py-1">{r.reference || '—'}</td>
                      <td className="border border-gray-300 px-2 py-1">{r.party || '—'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{r.qtyIn || '—'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{r.qtyOut || '—'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-medium">{fmt(r.runningBalance)}</td>
                      <td className="border border-gray-300 px-2 py-1">{r.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      {showFooter && (
        <p className="text-xs text-gray-400 text-center mt-6 pt-4 border-t border-gray-200">
          Stock Ledger by Product — {sections.length} product(s)
        </p>
      )}
    </div>
  );
}
