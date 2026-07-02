import React from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';
import { REPORT_DEFAULT_FONT_SIZE } from './reportPrintConfig';
import { ReportBrandHeader } from './ReportBrandHeader';
import { ReportBrandFooter } from './ReportBrandFooter';

export interface CashBookReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
}

export interface CashBookReportPreviewProps {
  brand: CompanyBrand;
  title: string;
  subtitle?: string;
  periodLabel: string;
  branchScopeLabel?: string;
  generatedAt: string;
  columns: CashBookReportColumn[];
  rows: (string | number)[][];
  summaryStats: { label: string; value: string }[];
  openingBalance?: string;
  closingBalance?: string;
  formatCurrency?: (n: number) => string;
  fieldVisibility?: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  orientation?: ReportPrintOrientation;
  fontSize?: number;
  fontFamily?: string;
  margins?: PageMargins;
  /** Column index for opening/closing balance (default: last column). */
  balanceColumnIndex?: number;
}

const TH_STYLE: React.CSSProperties = {
  padding: '5px 4px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 9,
  background: '#f0f0f0',
  color: '#111',
  border: '1px solid #333',
};

/**
 * A4 cash-book style report (Roznamcha, Cash Flow) — white print sheet with summary band.
 */
export function CashBookReportPreview({
  brand,
  title,
  subtitle,
  periodLabel,
  branchScopeLabel = 'All branches',
  generatedAt,
  columns,
  rows,
  summaryStats,
  openingBalance,
  closingBalance,
  fieldVisibility,
  showHeader = true,
  showFooter = true,
  orientation = 'landscape',
  fontSize = REPORT_DEFAULT_FONT_SIZE,
  fontFamily = 'Arial, Helvetica, sans-serif',
  margins,
  balanceColumnIndex,
}: CashBookReportPreviewProps) {
  const balanceCol = balanceColumnIndex ?? columns.length - 1;
  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const rootClass = ['pdf-document', landscapeClass, 'bg-white text-black'].filter(Boolean).join(' ');
  const tableFont = Math.max(8, fontSize - 2);
  const metaSubtitle = `${periodLabel} · ${branchScopeLabel}`;

  const marginStyle: React.CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{ fontFamily, fontSize: tableFont, color: '#111', ...marginStyle }}
    >
      {showHeader ? (
        <ReportBrandHeader
          brand={brand}
          title={title}
          subtitle={subtitle}
          metaRows={[
            { label: 'Period', value: metaSubtitle },
            { label: 'Generated', value: generatedAt },
          ]}
          fieldVisibility={fieldVisibility}
        />
      ) : (
        <div style={{ marginBottom: 14, borderBottom: '2px solid #111', paddingBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{subtitle}</div> : null}
          <div style={{ fontSize: 10, marginTop: 4, color: '#444' }}>
            {metaSubtitle} · Generated: {generatedAt}
          </div>
        </div>
      )}

      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}
      >
        <tbody>
          <tr>
            {summaryStats.map((s) => (
              <td
                key={s.label}
                style={{
                  border: '1px solid #ccc',
                  padding: '5px 6px',
                  textAlign: 'center',
                  fontSize: 9,
                  color: '#111',
                  background: '#fff',
                }}
              >
                <div style={{ color: '#666', fontSize: 8, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 700 }}>{s.value}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFont }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...TH_STYLE, textAlign: col.align ?? 'left' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {openingBalance != null ? (
            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
              <td colSpan={balanceCol} style={{ padding: '4px 5px' }}>
                Opening balance
              </td>
              <td colSpan={columns.length - balanceCol} style={{ padding: '4px 5px', textAlign: 'right' }}>
                {openingBalance}
              </td>
            </tr>
          ) : null}
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
              {row.map((cell, j) => {
                const col = columns[j];
                return (
                  <td
                    key={j}
                    style={{
                      padding: '3px 4px',
                      textAlign: col?.align ?? 'left',
                      fontFamily: col?.mono ? 'monospace' : undefined,
                      fontSize: col?.mono ? 8 : undefined,
                      whiteSpace: col?.align === 'right' ? 'nowrap' : undefined,
                    }}
                  >
                    {cell === '' || cell == null ? '—' : String(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {closingBalance != null ? (
          <tfoot>
            <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
              <td colSpan={balanceCol} style={{ padding: '5px 4px', textAlign: 'right' }}>
                Closing balance
              </td>
              <td colSpan={columns.length - balanceCol} style={{ padding: '5px 4px', textAlign: 'right' }}>
                {closingBalance}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>

      {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
    </div>
  );
}
