import React from 'react';
import type { CompanyBrand } from '@/app/services/companyBrandService';
import { REPORT_DEFAULT_FONT_SIZE } from './reportPrintConfig';
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
    'ledger-report-print',
    landscapeClass,
    'bg-white text-black',
  ]
    .filter(Boolean)
    .join(' ');
  const tableFontSize = compact ? Math.max(8, fontSize - 2) : fontSize;

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{
        fontFamily,
        fontSize: tableFontSize,
        color: '#111',
        ...marginStyle,
      }}
    >
      <div className="report-first-page-block">
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
          <div className="report-title-block" style={{ marginBottom: compact ? 8 : 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', color: '#111' }}>{title}</div>
            {subtitle ? (
              <div style={{ fontSize: 11, color: '#333', marginTop: 4, fontWeight: 600 }}>{subtitle}</div>
            ) : null}
          </div>
        )}

        {stats && stats.length > 0 ? (
          <table
            role="presentation"
            className="report-summary"
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
                      padding: compact ? '4px 6px' : '6px 8px',
                      textAlign: 'center',
                      fontSize: compact ? 8 : 10,
                      width: `${100 / stats.length}%`,
                    }}
                  >
                    <div style={{ color: '#666', fontSize: compact ? 7 : 9, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontWeight: 700 }}>{s.value}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ) : null}
      </div>

      <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFontSize }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  border: '1px solid #333',
                  padding: compact ? '3px 4px' : '5px 6px',
                  background: '#f0f0f0',
                  textAlign: col.align ?? 'left',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
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
                      padding: compact ? '2px 4px' : '4px 6px',
                      textAlign: columns[j]?.align ?? 'left',
                      verticalAlign: 'top',
                    }}
                  >
                    {cell}
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
                      padding: compact ? '3px 4px' : '5px 6px',
                      fontWeight: 700,
                      background: '#f5f5f5',
                      textAlign: columns[j]?.align ?? 'left',
                    }}
                  >
                    {cell}
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
