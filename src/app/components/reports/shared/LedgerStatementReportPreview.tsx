import React, { useMemo } from 'react';

import type { CompanyBrand } from '@/app/services/companyBrandService';
import type { PageMargins } from '@/app/types/printingSettings';

import type { ReportHeaderFieldVisibility, ReportPrintOrientation } from './reportPrintConfig';

import { REPORT_DEFAULT_FONT_SIZE } from './reportPrintConfig';

import { ReportBrandHeader } from './ReportBrandHeader';

import { ReportBrandFooter } from './ReportBrandFooter';

import { LEDGER_EXPORT_COLUMNS } from './ledgerExportColumns';

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
  /** Show payment method + created-by columns (default: landscape). Ignored when visibleColumns is set. */
  showOptionalColumns?: boolean;
  /** Same keys as LEDGER_EXPORT_COLUMNS / Columns picker. When set, drives which columns print. */
  visibleColumns?: Record<string, boolean>;
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

const MONEY_KEYS = new Set(['debit', 'credit', 'balance']);
const OPTIONAL_KEYS = new Set(['payment', 'createdBy']);

type PreviewCol = { key: string; label: string; align: 'left' | 'right' };

const PREVIEW_COLUMNS: PreviewCol[] = LEDGER_EXPORT_COLUMNS.map((c) => ({
  key: c.key,
  label: c.key === 'reference' ? 'Ref' : c.key === 'payment' ? 'Payment' : c.key === 'createdBy' ? 'Created By' : c.label,
  align: c.align === 'right' ? 'right' : 'left',
}));

/**
 * A4 ledger statement PDF — column set follows Columns picker when visibleColumns is passed.
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
  visibleColumns,
}: LedgerStatementReportPreviewProps) {
  const includeOptionalLegacy = showOptionalColumns ?? orientation === 'landscape';

  const visibleCols = useMemo(() => {
    return PREVIEW_COLUMNS.filter((col) => {
      if (visibleColumns) {
        return visibleColumns[col.key] !== false;
      }
      if (OPTIONAL_KEYS.has(col.key)) return includeOptionalLegacy;
      return true;
    });
  }, [visibleColumns, includeOptionalLegacy]);

  const colCount = visibleCols.length;
  const beforeMoneyCount = visibleCols.filter((c) => !MONEY_KEYS.has(c.key) && !OPTIONAL_KEYS.has(c.key)).length;
  const showDebit = visibleCols.some((c) => c.key === 'debit');
  const showCredit = visibleCols.some((c) => c.key === 'credit');
  const showBalance = visibleCols.some((c) => c.key === 'balance');
  const afterMoneyCount = visibleCols.filter((c) => OPTIONAL_KEYS.has(c.key)).length;
  const footerLabelSpan = Math.max(1, beforeMoneyCount);

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

  const cellValue = (row: LedgerStatementReportRow, key: string): React.ReactNode => {
    switch (key) {
      case 'date':
        return row.date ? formatDate(row.date) : '—';
      case 'reference':
        return row.referenceNo;
      case 'type':
        return row.transactionType;
      case 'description':
        return row.description || '—';
      case 'branch':
        return row.branch || '—';
      case 'debit':
        return row.debit ? formatCurrency(row.debit) : '—';
      case 'credit':
        return row.credit ? formatCurrency(row.credit) : '—';
      case 'balance':
        return formatCurrency(row.runningBalance);
      case 'payment':
        return row.paymentMethod || '—';
      case 'createdBy':
        return row.createdBy || '—';
      default:
        return '—';
    }
  };

  const cellStyle = (key: string, align: 'left' | 'right'): React.CSSProperties => ({
    padding: '3px 4px',
    textAlign: align,
    whiteSpace: key === 'date' ? 'nowrap' : undefined,
    fontFamily: key === 'reference' ? 'monospace' : undefined,
    fontSize: key === 'reference' || key === 'type' || key === 'branch' || OPTIONAL_KEYS.has(key) ? 9 : undefined,
    fontWeight: key === 'balance' ? 600 : undefined,
  });

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

      {colCount > 0 ? (
        <table className="pdf-ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: tableFont }}>
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <th key={col.key} style={{ ...TH_STYLE, textAlign: col.align }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
              {colCount <= 1 ? (
                <td style={{ padding: '4px 5px', color: '#111' }}>
                  Opening balance {formatCurrency(openingBalance)}
                </td>
              ) : (
                <>
                  <td colSpan={colCount - 1} style={{ padding: '4px 5px', color: '#111' }}>
                    Opening balance
                  </td>
                  <td style={{ padding: '4px 5px', textAlign: 'right', color: '#111' }}>
                    {formatCurrency(openingBalance)}
                  </td>
                </>
              )}
            </tr>
            {rows.map((row, i) => (
              <tr key={`${row.referenceNo}-${i}`} style={{ borderBottom: '1px solid #ddd' }}>
                {visibleCols.map((col) => (
                  <td key={col.key} style={cellStyle(col.key, col.align)}>
                    {cellValue(row, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
              <td colSpan={footerLabelSpan} style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
                Totals / Closing balance
              </td>
              {showDebit ? (
                <td style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
                  {formatCurrency(totalDebit)}
                </td>
              ) : null}
              {showCredit ? (
                <td style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
                  {formatCurrency(totalCredit)}
                </td>
              ) : null}
              {showBalance ? (
                <td style={{ padding: '5px 4px', textAlign: 'right', color: '#111' }}>
                  {formatCurrency(closingBalance)}
                </td>
              ) : null}
              {afterMoneyCount > 0
                ? Array.from({ length: afterMoneyCount }, (_, i) => <td key={`opt-${i}`} />)
                : null}
            </tr>
          </tfoot>
        </table>
      ) : null}

      {showFooter ? <ReportBrandFooter currentPage={1} totalPages={1} /> : null}
    </div>
  );
}
