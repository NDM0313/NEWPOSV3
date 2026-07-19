import React from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import { ReportBrandFooter } from '@/app/components/reports/shared/ReportBrandFooter';
import { ReportBrandHeader } from '@/app/components/reports/shared/ReportBrandHeader';
import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from '@/app/components/reports/shared/reportPrintConfig';
import { REPORT_DEFAULT_FONT_SIZE, formatReportMoneyDisplay } from '@/app/components/reports/shared/reportPrintConfig';

export interface FinancialReportPrintLayoutProps {
  title: string;
  periodLabel: string;
  branchLabel?: string;
  brand?: CompanyBrand | null;
  generatedAt?: string;
  fieldVisibility?: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  orientation?: ReportPrintOrientation;
  fontSize?: number;
  dataListFontSize?: number;
  tableHeaderFontSize?: number;
  summaryFontSize?: number;
  columnPaddingPx?: number;
  fontFamily?: string;
  margins?: PageMargins;
  children: React.ReactNode;
}

export const FinancialReportPrintLayout = React.forwardRef<HTMLDivElement, FinancialReportPrintLayoutProps>(
  function FinancialReportPrintLayout(
    {
      title,
      periodLabel,
      branchLabel,
      brand,
      generatedAt,
      fieldVisibility,
      showHeader = true,
      showFooter = true,
      orientation = 'portrait',
      fontSize = REPORT_DEFAULT_FONT_SIZE,
      dataListFontSize,
      fontFamily = 'Arial, Helvetica, sans-serif',
      margins,
      children,
    },
    ref,
  ) {
    const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
    const rootClass = ['pdf-document', landscapeClass, 'bg-white text-black'].filter(Boolean).join(' ');
    const metaSubtitle = branchLabel ? `${periodLabel} · ${branchLabel}` : periodLabel;
    const listFont = dataListFontSize ?? fontSize;

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
        ref={ref}
        className={rootClass}
        data-print-format="a4"
        style={{ fontFamily, fontSize: listFont, color: '#111', ...marginStyle }}
      >
        {showHeader && brand ? (
          <ReportBrandHeader
            brand={brand}
            title={title}
            metaRows={[
              { label: 'Period', value: metaSubtitle },
              ...(generatedAt ? [{ label: 'Generated', value: generatedAt }] : []),
            ]}
            fieldVisibility={fieldVisibility}
          />
        ) : (
          <div style={{ marginBottom: 14, borderBottom: '2px solid #111', paddingBottom: 10 }}>
            <div style={{ fontSize: Math.max(14, fontSize + 5), fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
            <div style={{ fontSize: Math.max(9, fontSize - 1), marginTop: 4, color: '#444' }}>{metaSubtitle}</div>
          </div>
        )}
        {children}
        {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
      </div>
    );
  },
);

/** Simple print-friendly table from export rows */
export function FinancialReportDataTable({
  headers,
  rows,
  dataListFontSize,
  tableHeaderFontSize,
  columnPaddingPx = 4,
  showCurrencySymbol = true,
}: {
  headers: string[];
  rows: (string | number)[][];
  dataListFontSize?: number;
  tableHeaderFontSize?: number;
  columnPaddingPx?: number;
  showCurrencySymbol?: boolean;
}) {
  const listFont = dataListFontSize ?? 9;
  const headerFont = tableHeaderFontSize ?? Math.max(8, listFont - 1);
  const hPad = Math.max(2, Math.min(10, columnPaddingPx));
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
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: listFont }}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} style={thStyle}>
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
                <td colSpan={headers.length} style={{ height: 6 }} />
              </tr>
            );
          }
          const isTotal =
            String(row[0] ?? '').toLowerCase().includes('total') ||
            String(row[0] ?? '').toLowerCase().includes('difference');
          return (
            <tr
              key={i}
              style={{
                fontWeight: isTotal ? 700 : 400,
                borderBottom: '1px solid #ddd',
                background: isTotal ? '#f3f4f6' : undefined,
              }}
            >
              {headers.map((_, j) => {
                const raw = row[j] ?? '';
                const text =
                  typeof raw === 'string' && !showCurrencySymbol
                    ? formatReportMoneyDisplay(raw, false)
                    : raw;
                return (
                  <td key={j} style={{ padding: `4px ${hPad}px`, color: '#111', verticalAlign: 'top', fontSize: listFont }}>
                    {text}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
