import React, { useMemo } from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';

import { REPORT_DEFAULT_FONT_SIZE } from './reportPrintConfig';

import { ReportBrandHeader } from './ReportBrandHeader';

import { ReportBrandFooter } from './ReportBrandFooter';

import {
  LEDGER_PRINT_HEADER_LABELS,
  LEDGER_PRINT_HEADER_LABELS_WITH_OPTIONAL,
} from './ledgerExportColumns';

export interface LedgerStatementReportRow {
  date: string;
  referenceNo: string;
  transactionType: string;
  description: string;
  branch?: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod?: string;
  createdBy?: string;
}

export interface LedgerStatementReportPreviewProps {
  brand: CompanyBrand;
  title: string;
  partyName: string;
  periodLabel: string;
  branchScopeLabel?: string;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  rows: LedgerStatementReportRow[];
  formatCurrency: (n: number) => string;
  formatDate: (iso: string) => string;
  fieldVisibility?: ReportHeaderFieldVisibility;
  showHeader?: boolean;
  showFooter?: boolean;
  orientation?: ReportPrintOrientation;
  fontSize?: number;
  fontFamily?: string;
  margins?: PageMargins;
  /** Show payment method + created-by columns (default: landscape). */
  showOptionalColumns?: boolean;
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
 * A4 ledger statement PDF — 8-column print layout (Branch included).
 */
export function LedgerStatementReportPreview({
  brand,
  title,
  partyName,
  periodLabel,
  branchScopeLabel = 'All branches (GL scope)',
  generatedAt,
  openingBalance,
  closingBalance,
  totalDebit,
  totalCredit,
  rows,
  formatCurrency,
  formatDate,
  fieldVisibility,
  showHeader = true,
  showFooter = true,
  orientation = 'portrait',
  fontSize = REPORT_DEFAULT_FONT_SIZE,
  fontFamily = 'Arial, Helvetica, sans-serif',
  margins,
  showOptionalColumns,
}: LedgerStatementReportPreviewProps) {
  const includeOptional = showOptionalColumns ?? orientation === 'landscape';
  const headerLabels = includeOptional ? LEDGER_PRINT_HEADER_LABELS_WITH_OPTIONAL : LEDGER_PRINT_HEADER_LABELS;
  const colCount = headerLabels.length;

  const landscapeClass = orientation === 'landscape' ? 'pdf-document-landscape' : '';
  const rootClass = ['pdf-document', landscapeClass, 'bg-white text-black'].filter(Boolean).join(' ');
  const tableFont = Math.max(9, fontSize - 1);
  const metaSubtitle = `${periodLabel} · ${branchScopeLabel}`;

  const marginStyle: React.CSSProperties | undefined = margins
    ? {
        paddingTop: margins.top,
        paddingBottom: margins.bottom,
        paddingLeft: margins.left,
        paddingRight: margins.right,
      }
    : undefined;

  const thAlign = (label: string): React.CSSProperties['textAlign'] =>
    label === 'Debit' || label === 'Credit' || label === 'Balance' ? 'right' : 'left';

  const renderRowCells = (row: LedgerStatementReportRow) => {
    const cells: React.ReactNode[] = [
      <td key="date" style={{ padding: '3px 4px', whiteSpace: 'nowrap' }}>
        {row.date ? formatDate(row.date) : '—'}
      </td>,
      <td key="ref" style={{ padding: '3px 4px', fontFamily: 'monospace', fontSize: 9 }}>
        {row.referenceNo}
      </td>,
      <td key="type" style={{ padding: '3px 4px', fontSize: 9 }}>
        {row.transactionType}
      </td>,
      <td key="desc" style={{ padding: '3px 4px' }}>
        {row.description || '—'}
      </td>,
      <td key="branch" style={{ padding: '3px 4px', fontSize: 9 }}>
        {row.branch || '—'}
      </td>,
      <td key="debit" style={{ padding: '3px 4px', textAlign: 'right' }}>
        {row.debit ? formatCurrency(row.debit) : '—'}
      </td>,
      <td key="credit" style={{ padding: '3px 4px', textAlign: 'right' }}>
        {row.credit ? formatCurrency(row.credit) : '—'}
      </td>,
      <td key="bal" style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600 }}>
        {formatCurrency(row.runningBalance)}
      </td>,
    ];
    if (includeOptional) {
      cells.push(
        <td key="pay" style={{ padding: '3px 4px', fontSize: 9 }}>
          {row.paymentMethod || '—'}
        </td>,
        <td key="by" style={{ padding: '3px 4px', fontSize: 9 }}>
          {row.createdBy || '—'}
        </td>,
      );
    }
    return cells;
  };

  const footerLabelSpan = useMemo(() => colCount - 3, [colCount]);

  return (
    <div
      className={rootClass}
      data-print-format="a4"
      style={{
        fontFamily,
        fontSize: tableFont,
        color: '#111',
        ...marginStyle,
      }}
    >
      {showHeader ? (
        <ReportBrandHeader
          brand={brand}
          title={title}
          subtitle={partyName}
          metaRows={[
            { label: 'Period', value: metaSubtitle },
            { label: 'Generated', value: generatedAt },
          ]}
          fieldVisibility={fieldVisibility}
        />
      ) : (
        <div style={{ marginBottom: 14, borderBottom: '2px solid #111', paddingBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#111' }}>{title}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, color: '#111' }}>{partyName}</div>
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
            {[
              { label: 'Opening', value: formatCurrency(openingBalance) },
              { label: 'Closing', value: formatCurrency(closingBalance) },
              { label: 'Total debit', value: formatCurrency(totalDebit) },
              { label: 'Total credit', value: formatCurrency(totalCredit) },
            ].map((s) => (
              <td
                key={s.label}
                style={{
                  border: '1px solid #ccc',
                  padding: '5px 6px',
                  textAlign: 'center',
                  fontSize: 9,
                  width: '25%',
                  color: '#111',
                  background: '#fff',
                }}
              >
                <div style={{ color: '#666', fontSize: 8, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontWeight: 700, color: '#111' }}>{s.value}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table className="pdf-ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFont }}>
        <thead>
          <tr>
            {headerLabels.map((h) => (
              <th key={h} style={{ ...TH_STYLE, textAlign: thAlign(h) }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
            <td colSpan={colCount - 1} style={{ padding: '4px 5px', color: '#111' }}>
              Opening balance
            </td>
            <td style={{ padding: '4px 5px', textAlign: 'right', color: '#111' }}>
              {formatCurrency(openingBalance)}
            </td>
          </tr>
          {rows.map((row, i) => (
            <tr key={`${row.referenceNo}-${i}`} style={{ borderBottom: '1px solid #ddd' }}>
              {renderRowCells(row)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
            <td colSpan={footerLabelSpan} style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
              Totals / Closing balance
            </td>
            <td style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>{formatCurrency(totalDebit)}</td>
            <td style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>{formatCurrency(totalCredit)}</td>
            <td style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>{formatCurrency(closingBalance)}</td>
            {includeOptional ? <td colSpan={2} /> : null}
          </tr>
        </tfoot>
      </table>

      {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
    </div>
  );
}
