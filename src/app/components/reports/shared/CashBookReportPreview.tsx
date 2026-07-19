import React from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';
import { REPORT_DEFAULT_FONT_SIZE, formatReportMoneyDisplay } from './reportPrintConfig';
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
  dataListFontSize?: number;
  tableHeaderFontSize?: number;
  summaryFontSize?: number;
  columnPaddingPx?: number;
  showCurrencySymbol?: boolean;
  fontFamily?: string;
  margins?: PageMargins;
  /** Column index for opening/closing balance (default: last column). */
  balanceColumnIndex?: number;
}

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
  dataListFontSize,
  tableHeaderFontSize,
  summaryFontSize,
  columnPaddingPx = 4,
  showCurrencySymbol = true,
  fontFamily = 'Arial, Helvetica, sans-serif',
  margins,
  balanceColumnIndex,
}: CashBookReportPreviewProps) {
  const balanceCol = balanceColumnIndex ?? columns.length - 1;
  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const rootClass = ['pdf-document', landscapeClass, 'bg-white text-black'].filter(Boolean).join(' ');
  const listFont = dataListFontSize ?? Math.max(8, fontSize - 2);
  const headerFont = tableHeaderFontSize ?? Math.max(8, listFont - 1);
  const bandFont = summaryFontSize ?? Math.max(8, listFont - 1);
  const hPad = Math.max(2, Math.min(10, columnPaddingPx));
  const metaSubtitle = `${periodLabel} · ${branchScopeLabel}`;
  const moneyText = (v: string) => formatReportMoneyDisplay(v, showCurrencySymbol);

  const marginStyle: React.CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  const thStyle: React.CSSProperties = {
    padding: `5px ${hPad}px`,
    textAlign: 'left',
    fontWeight: 700,
    fontSize: headerFont,
    background: '#f0f0f0',
    color: '#111',
    border: '1px solid #333',
  };

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{ fontFamily, fontSize: listFont, color: '#111', ...marginStyle }}
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
          <div style={{ fontSize: Math.max(14, fontSize + 5), fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: Math.max(11, fontSize + 1), fontWeight: 600, marginTop: 4 }}>{subtitle}</div> : null}
          <div style={{ fontSize: Math.max(9, fontSize - 1), marginTop: 4, color: '#444' }}>
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
                  padding: `5px ${hPad}px`,
                  textAlign: 'center',
                  fontSize: bandFont,
                  color: '#111',
                  background: '#fff',
                }}
              >
                <div style={{ color: '#666', fontSize: Math.max(7, bandFont - 1), marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 700 }}>{moneyText(s.value)}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: listFont }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...thStyle, textAlign: col.align ?? 'left' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {openingBalance != null ? (
            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
              <td colSpan={balanceCol} style={{ padding: `4px ${hPad}px` }}>
                Opening balance
              </td>
              <td colSpan={columns.length - balanceCol} style={{ padding: `4px ${hPad}px`, textAlign: 'right' }}>
                {moneyText(openingBalance)}
              </td>
            </tr>
          ) : null}
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
              {row.map((cell, j) => {
                const col = columns[j];
                const raw = cell === '' || cell == null ? '—' : String(cell);
                const display =
                  col?.align === 'right' && raw !== '—' ? moneyText(raw) : raw;
                return (
                  <td
                    key={j}
                    style={{
                      padding: `3px ${hPad}px`,
                      textAlign: col?.align ?? 'left',
                      fontFamily: col?.mono ? 'monospace' : undefined,
                      fontSize: col?.mono ? Math.max(7, listFont - 2) : listFont,
                      whiteSpace: col?.align === 'right' ? 'nowrap' : undefined,
                    }}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {closingBalance != null ? (
          <tfoot>
            <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
              <td colSpan={balanceCol} style={{ padding: `5px ${hPad}px`, textAlign: 'right' }}>
                Closing balance
              </td>
              <td colSpan={columns.length - balanceCol} style={{ padding: `5px ${hPad}px`, textAlign: 'right' }}>
                {moneyText(closingBalance)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>

      {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
    </div>
  );
}
