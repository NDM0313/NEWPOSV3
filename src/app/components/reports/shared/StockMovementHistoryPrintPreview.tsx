import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { ReportBrandHeader } from '@/app/components/reports/shared/ReportBrandHeader';
import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { ReportHeaderFieldVisibility } from '@/app/components/reports/shared/reportPrintConfig';
import type { ProductReportSection } from '@/app/lib/stockMovementReportLogic';
import { formatProductSummaryLine } from '@/app/lib/stockMovementDisplay';
import { formatQty } from '@/app/utils/quantity';

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
  dataListFontSize?: number;
  tableHeaderFontSize?: number;
  summaryFontSize?: number;
  columnPaddingPx?: number;
  showCurrencySymbol?: boolean;
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
  dataListFontSize,
  tableHeaderFontSize,
  columnPaddingPx = 4,
  fontFamily = 'Arial, Helvetica, sans-serif',
  orientation = 'landscape',
}: Props) {
  const fmtInOut = (n: number) => (n === 0 ? '—' : formatQty(n));
  const fmtBalance = (n: number) => formatQty(n);
  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const listFont = dataListFontSize ?? fontSize;
  const headerFont = tableHeaderFontSize ?? Math.max(8, listFont - 1);
  const hPad = Math.max(2, Math.min(10, columnPaddingPx));

  return (
    <div
      className={cn('pdf-print-root pdf-document pdf-document-compact bg-white text-black', landscapeClass)}
      style={{ fontSize: listFont, fontFamily }}
      data-orientation={orientation}
    >
      {showHeader && (
        <ReportBrandHeader brand={brand} fieldVisibility={fieldVisibility} title={title} subtitle={subtitle} />
      )}

      <p className="text-xs text-muted-foreground mb-1">Generated: {generatedAt}</p>
      <p className="text-xs text-muted-foreground mb-4">Filters: {filterSummary}</p>
      <p className="text-xs text-muted-foreground mb-6 italic">
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
              <p className="text-sm font-bold text-gray-800" style={{ fontSize: listFont + 1 }}>
                {formatProductSummaryLine(section.summary)}
              </p>
            </div>

            <table className="w-full border-collapse" style={{ fontSize: listFont }}>
              <thead>
                <tr className="bg-gray-100" style={{ fontSize: headerFont }}>
                  <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Date</th>
                  <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Branch</th>
                  {showVariationColumn && (
                    <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Variation</th>
                  )}
                  <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Type</th>
                  <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Reference</th>
                  <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Party</th>
                  <th className="border border-gray-300 text-right" style={{ padding: `4px ${hPad}px` }}>In</th>
                  <th className="border border-gray-300 text-right" style={{ padding: `4px ${hPad}px` }}>Out</th>
                  <th className="border border-gray-300 text-right" style={{ padding: `4px ${hPad}px` }}>Balance</th>
                  <th className="border border-gray-300 text-left" style={{ padding: `4px ${hPad}px` }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {section.isEmpty || section.rows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="border border-gray-300 px-2 py-2 text-muted-foreground italic">
                      No stock movement found for this product.
                    </td>
                  </tr>
                ) : (
                  section.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{new Date(r.date).toLocaleString()}</td>
                      <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{r.branchName || '—'}</td>
                      {showVariationColumn && (
                        <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{r.variationLabel || '—'}</td>
                      )}
                      <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{r.movementTypeLabel}</td>
                      <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{r.reference || '—'}</td>
                      <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{r.party || '—'}</td>
                      <td className="border border-gray-300 text-right" style={{ padding: `4px ${hPad}px` }}>{fmtInOut(r.qtyIn)}</td>
                      <td className="border border-gray-300 text-right" style={{ padding: `4px ${hPad}px` }}>{fmtInOut(r.qtyOut)}</td>
                      <td className="border border-gray-300 text-right font-medium" style={{ padding: `4px ${hPad}px` }}>{fmtBalance(r.runningBalance)}</td>
                      <td className="border border-gray-300" style={{ padding: `4px ${hPad}px` }}>{r.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      {showFooter && (
        <p className="text-xs text-muted-foreground text-center mt-6 pt-4 border-t border-gray-200">
          Stock Ledger by Product — {sections.length} product(s)
        </p>
      )}
    </div>
  );
}

