import React from 'react';
import type { CompanyBrand } from '@/app/services/companyBrandService';
import { REPORT_DEFAULT_FONT_SIZE, formatReportMoneyDisplay } from './reportPrintConfig';
import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';
import { ReportBrandHeader } from './ReportBrandHeader';
import { ReportBrandFooter } from './ReportBrandFooter';

import type { PageMargins } from '@/app/types/printingSettings';

export type TabularReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
};

export interface TabularReportPreviewProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  periodLabel?: string;
  generatedAt?: string;
  generatedBy?: string;
  columns: TabularReportColumn[];
  rows: (string | number)[][];
  footerRows?: (string | number)[][];
  stats?: { label: string; value: string }[];
  fieldVisibility?: ReportHeaderFieldVisibility;
  /** When false, hides the branded header block entirely. */
  showHeader?: boolean;
  /** When false, hides the page-number footer. */
  showFooter?: boolean;
  /** Shorter layout for small reports — avoids forced A4 min-height blank page. */
  compact?: boolean;
  fontSize?: number;
  dataListFontSize?: number;
  tableHeaderFontSize?: number;
  summaryFontSize?: number;
  columnPaddingPx?: number;
  showCurrencySymbol?: boolean;
  fontFamily?: string;
  margins?: PageMargins;
  orientation?: ReportPrintOrientation;
}

/**
 * A4-only print-friendly table for tabular report PDF/print capture.
 * Always uses pdf-document layout; never thermal width.
 */
export const TabularReportPreview: React.FC<TabularReportPreviewProps> = ({
  brand,
  title,
  subtitle,
  periodLabel,
  generatedAt,
  generatedBy,
  columns,
  rows,
  footerRows,
  stats,
  fieldVisibility,
  showHeader = true,
  showFooter = true,
  compact = false,
  fontSize = REPORT_DEFAULT_FONT_SIZE,
  dataListFontSize,
  tableHeaderFontSize,
  summaryFontSize,
  columnPaddingPx = 4,
  showCurrencySymbol = true,
  fontFamily = 'Arial, Helvetica, sans-serif',
  margins,
  orientation = 'portrait',
}) => {
  const metaRows: { label: string; value: string }[] = [];
  if (periodLabel) metaRows.push({ label: 'Period', value: periodLabel });
  if (generatedAt) metaRows.push({ label: 'Generated', value: generatedAt });
  if (generatedBy) metaRows.push({ label: 'By', value: generatedBy });

  const marginStyle: React.CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const rootClass = [
    compact ? 'pdf-document pdf-document-compact' : 'pdf-document',
    landscapeClass,
    'bg-white text-black',
  ]
    .filter(Boolean)
    .join(' ');
  const listFont = dataListFontSize ?? (compact ? Math.max(8, fontSize - 2) : fontSize);
  const headerFont = tableHeaderFontSize ?? listFont;
  const bandFont = summaryFontSize ?? (compact ? Math.max(8, listFont - 2) : Math.max(9, listFont - 1));
  const hPad = Math.max(2, Math.min(10, columnPaddingPx));
  const moneyText = (v: string) => formatReportMoneyDisplay(v, showCurrencySymbol);
  const cellText = (cell: string | number, align?: string) => {
    const raw = String(cell);
    return align === 'right' ? moneyText(raw) : raw;
  };

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{
        fontFamily,
        fontSize: listFont,
        color: '#111',
        ...marginStyle,
      }}
    >
      {showHeader ? (
        <ReportBrandHeader
          brand={brand}
          title={title}
          subtitle={subtitle}
          metaRows={metaRows.length ? metaRows : undefined}
          fieldVisibility={fieldVisibility}
          compact={compact}
        />
      ) : (
        <div style={{ marginBottom: compact ? 8 : 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', color: '#111' }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 11, color: '#333', marginTop: 4, fontWeight: 600 }}>{subtitle}</div>
          ) : null}
        </div>
      )}

      {stats && stats.length > 0 ? (
        <table
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{ width: '100%', borderCollapse: 'collapse', marginBottom: compact ? 8 : 12 }}
        >
          <tbody>
            <tr>
              {stats.map((s) => (
                <td
                  key={s.label}
                  style={{
                    border: '1px solid #ccc',
                    padding: compact ? `4px ${hPad}px` : `6px ${hPad}px`,
                    textAlign: 'center',
                    fontSize: bandFont,
                    width: `${100 / stats.length}%`,
                  }}
                >
                  <div style={{ color: '#666', fontSize: Math.max(7, bandFont - 1), marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontWeight: 700 }}>{moneyText(s.value)}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : null}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: listFont }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  border: '1px solid #333',
                  padding: compact ? `3px ${hPad}px` : `5px ${hPad}px`,
                  background: '#f0f0f0',
                  textAlign: col.align ?? 'left',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  fontSize: headerFont,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ border: '1px solid #ccc', padding: 12, textAlign: 'center' }}>
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      border: '1px solid #ccc',
                      padding: compact ? `2px ${hPad}px` : `4px ${hPad}px`,
                      textAlign: columns[j]?.align ?? 'left',
                      verticalAlign: 'top',
                      fontSize: listFont,
                    }}
                  >
                    {cellText(cell, columns[j]?.align)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footerRows && footerRows.length > 0 ? (
          <tfoot>
            {footerRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      border: '1px solid #333',
                      padding: compact ? `3px ${hPad}px` : `5px ${hPad}px`,
                      fontWeight: 700,
                      background: '#f5f5f5',
                      textAlign: columns[j]?.align ?? 'left',
                      fontSize: listFont,
                    }}
                  >
                    {cellText(cell, columns[j]?.align)}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        ) : null}
      </table>

      {showFooter ? (
        <ReportBrandFooter currentPage={1} totalPages={1} compact={compact} />
      ) : null}
    </div>
  );
};
